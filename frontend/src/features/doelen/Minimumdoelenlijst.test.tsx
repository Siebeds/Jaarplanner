import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { MinimumdoelFacetten, MinimumdoelRegel } from "../../lib/types";
import { Minimumdoelenlijst } from "./Minimumdoelenlijst";

/**
 * The minimumdoelen register after E1-12 and E1-21 filled it (E1-22).
 *
 * The defects this pins were all copy or completeness, which is why they survived: the empty state said the
 * minimumdoelen came from "het decretale bestand" and showed whenever no loaded goal concorded one, so it read
 * "Nog geen minimumdoelen" with 998 stored; a minimumdoel no loaded goal concords was invisible; and the list fetched
 * one page of 200 and stopped.
 */

function regel(overrides: Partial<MinimumdoelRegel> = {}): MinimumdoelRegel {
  return {
    ref: "4-2.1.7",
    leeftijd: "4-",
    nr: "2.1.7",
    omschrijving: "De leerlingen kunnen tellen tot 1000.",
    disciplineNummer: "2",
    disciplineNaam: "Wiskunde",
    domein: "Getallenkennis",
    subdomein: "Natuurlijke getallen",
    leerplandoelCodes: ["2.1.GL3.10"],
    zonderLeerplandoelReden: null,
    zonderLeerplandoelDoelsets: [],
    ...overrides,
  };
}

const ZONDER = { disciplineNummer: null, disciplineNaam: null, domein: null, subdomein: null, leerplandoelCodes: [] };

function facetten(overrides: Partial<MinimumdoelFacetten> = {}): MinimumdoelFacetten {
  return {
    totaalAantalMinimumdoelen: 998,
    aantalTreffers: 2,
    aantalZonderLeerplandoel: 1,
    disciplines: [{ nummer: "2", naam: "Wiskunde", aantal: 1 }],
    domeinen: [],
    jaarFasen: [],
    ...overrides,
  };
}

let paden: string[] = [];

function toon(opties: { facetten: MinimumdoelFacetten; regels: MinimumdoelRegel[]; totaal?: number; onWisFilters?: () => void }) {
  paden = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string) => {
      paden.push(pad);
      const url = new URL(pad, "http://localhost");
      const body =
        url.pathname === "/api/minimumdoelen/facetten"
          ? opties.facetten
          : (() => {
              const overslaan = Number(url.searchParams.get("overslaan") ?? 0);
              const aantal = Number(url.searchParams.get("aantal") ?? 50);
              return {
                regels: opties.regels.slice(overslaan, overslaan + aantal),
                totaal: opties.totaal ?? opties.regels.length,
                overslaan,
                aantal,
              };
            })();
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    }),
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Minimumdoelenlijst filter={{}} onKiesDoel={vi.fn()} onWisFilters={opties.onWisFilters ?? vi.fn()} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Minimumdoelenlijst", () => {
  it("zegt alleen dat er nog geen minimumdoelen zijn als er geen enkel is, en wijst naar Inladen", async () => {
    toon({ facetten: facetten({ totaalAantalMinimumdoelen: 0, aantalTreffers: 0, aantalZonderLeerplandoel: 0, disciplines: [] }), regels: [] });

    expect(await screen.findByText(t("doelen.geenMinimumdoelenTitel"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("doelen.laadIn") })).toHaveAttribute("href", "/inladen");
    expect(screen.queryByText(/decretale bestand/)).not.toBeInTheDocument();
  });

  it("toont ingeladen minimumdoelen zonder geconcordeerd leerplandoel in een eigen groep, nooit als een tekort", async () => {
    toon({
      facetten: facetten(),
      regels: [regel(), regel({ ref: "6-7.1.6", leeftijd: "6-", nr: "7.1.6", omschrijving: "De leerlingen kunnen zwemmen.", ...ZONDER })],
    });

    expect(await screen.findByText(t("doelen.zonderLeerplandoel"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.zonderLeerplandoelEen"))).toBeInTheDocument();
    expect(screen.getByText("Wiskunde")).toBeInTheDocument();
    expect(screen.getByText("6-7.1.6")).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.geenMinimumdoelenTitel"))).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/gedekt|ontbre|niet gekoppeld/i);
  });

  it("toont alle 998 na de import van de minimumdoelen alleen, voor er een leerplandoel is", async () => {
    const alle = Array.from({ length: 3 }, (_, i) => regel({ ref: `K-1.1.${i + 1}`, ...ZONDER }));
    toon({ facetten: facetten({ aantalTreffers: 3, aantalZonderLeerplandoel: 3, disciplines: [] }), regels: alle });

    expect(await screen.findByText(t("doelen.zonderLeerplandoelMeer"))).toBeInTheDocument();
    expect(screen.getByText("K-1.1.3")).toBeInTheDocument();
  });

  it("zegt per minimumdoel zonder leerplandoel waarom, maar alleen wat de import weet (owner ruling 2026-09-13)", async () => {
    toon({
      facetten: facetten({ aantalTreffers: 5, aantalZonderLeerplandoel: 5, disciplines: [] }),
      regels: [
        regel({ ref: "6-7.1.6", ...ZONDER, zonderLeerplandoelReden: "AlleenOvergeslagenDoelsets", zonderLeerplandoelDoelsets: ["Z"] }),
        regel({ ref: "6-9.9.1", ...ZONDER, zonderLeerplandoelReden: "AlleenOvergeslagenDoelsets", zonderLeerplandoelDoelsets: ["V", "Z"] }),
        regel({ ref: "K-1.2.6", ...ZONDER, zonderLeerplandoelReden: "GeenDoelInOpstap" }),
        regel({ ref: "4-9.9.9", ...ZONDER, zonderLeerplandoelReden: "DoelNietIngelezen" }),
        regel({ ref: "6-9.9.9", ...ZONDER, zonderLeerplandoelReden: null }),
      ],
    });

    expect(
      await screen.findByText(t("doelen.redenDoelsets", { doelsets: t("doelen.doelsetZ") })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t("doelen.redenDoelsets", { doelsets: `${t("doelen.doelsetV")} en ${t("doelen.doelsetZ")}` })),
    ).toBeInTheDocument();
    expect(screen.getByText(t("doelen.redenGeenDoel"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.redenNietIngelezen"))).toBeInTheDocument();
    // Five rows, four reasons: the one without a known reason gets no sentence at all.
    const zinnen = [t("doelen.redenGeenDoel"), t("doelen.redenNietIngelezen")];
    expect(screen.getAllByText((_, el) => el?.tagName === "P" && (zinnen.includes(el.textContent ?? "") || (el.textContent ?? "").startsWith("Alleen ")))).toHaveLength(4);
    expect(document.body.textContent).not.toMatch(/gedekt|ontbre|niet gekoppeld/i);
  });

  it("zegt dat een minimumdoel meer dan eens kan voorkomen, maar alleen als dat zo is", async () => {
    const tweeKeer = [regel(), regel({ disciplineNummer: "3", disciplineNaam: "Wetenschap en techniek", domein: "Natuur", subdomein: "Leven" })];
    const { unmount } = toon({
      facetten: facetten({ aantalTreffers: 1, aantalZonderLeerplandoel: 0, disciplines: [{ nummer: "2", naam: "Wiskunde", aantal: 1 }, { nummer: "3", naam: "Wetenschap en techniek", aantal: 1 }] }),
      regels: tweeKeer,
    });
    expect(await screen.findByText(t("doelen.herhaald"))).toBeInTheDocument();
    unmount();

    toon({ facetten: facetten({ aantalTreffers: 1, aantalZonderLeerplandoel: 0 }), regels: [regel()] });
    expect(await screen.findByText("Wiskunde")).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.herhaald"))).not.toBeInTheDocument();
  });

  it("houdt de regels van de decretale tekst op hun eigen lijn", async () => {
    toon({
      facetten: facetten(),
      regels: [regel({ omschrijving: "De kleuters kunnen deelnemen aan interactie:\n- elkaar laten uitspreken;\n- beurtgedrag." })],
    });

    const tekst = await screen.findByText((_, element) => element?.tagName === "P" && (element.textContent ?? "").startsWith("De kleuters"));
    expect(tekst).toHaveClass("whitespace-pre-line");
    expect(tekst.textContent).toContain("\n- elkaar laten uitspreken;");
  });

  it("zegt bij een filter zonder treffers dat het aan de filters ligt, niet dat er geen minimumdoelen zijn", async () => {
    const wis = vi.fn();
    toon({ facetten: facetten({ aantalTreffers: 0, aantalZonderLeerplandoel: 0 }), regels: [], onWisFilters: wis });

    expect(await screen.findByText(t("doelen.geenMinimumdoelTreffersTitel"))).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.geenMinimumdoelenTitel"))).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("doelen.geenTreffersActie") }));
    expect(wis).toHaveBeenCalledOnce();
  });

  it("laadt de rest pagina per pagina in plaats van na 200 te stoppen", async () => {
    const regels = Array.from({ length: 250 }, (_, i) => regel({ ref: `4-2.1.${i + 1}`, leerplandoelCodes: [] }));
    toon({ facetten: facetten({ aantalTreffers: 250, aantalZonderLeerplandoel: 0, disciplines: [{ nummer: "2", naam: "Wiskunde", aantal: 250 }] }), regels });

    expect(await screen.findByText("4-2.1.200")).toBeInTheDocument();
    expect(screen.queryByText("4-2.1.201")).not.toBeInTheDocument();
    // The heading counts the whole discipline, not the page that happens to be loaded.
    expect(screen.getByText("250")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t("doelen.nogTonen", { aantal: 50 }) }));
    expect(await screen.findByText("4-2.1.250")).toBeInTheDocument();
    expect(paden.some((pad) => pad.includes("overslaan=200"))).toBe(true);
    expect(screen.queryByRole("button", { name: /tonen/ })).not.toBeInTheDocument();
  });
});
