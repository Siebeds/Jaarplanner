import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t, telWoord } from "../../i18n";
import type { Ik } from "../../lib/aanmelding";
import type { MinimumdoelFacetten, MinimumdoelRegel } from "../../lib/types";
import { DIRECTIE, ikMet, metIk } from "../../test/rechten";
import { Minimumdoelenboom } from "./Minimumdoelenboom";

/**
 * The minimumdoelen register in the decree's own ordering (TB-010): leergebied, rubriek and subrubriek as a browse
 * tree, each minimumdoel once, with how many leerplandoelen work it out on its row.
 */

function regel(overrides: Partial<MinimumdoelRegel> = {}): MinimumdoelRegel {
  return {
    ref: "4-1.1.1",
    leeftijd: "4-",
    nr: "1.1.1",
    omschrijving: "De leerlingen kunnen woorden lezen met behulp van inzicht in de morfologische opbouw.",
    leergebied: "Nederlands",
    rubriek: "Lezen",
    subrubriek: "Vlot en vloeiend lezen",
    aantalLeerplandoelen: 16,
    jaarFasen: ["L1", "L2", "L3", "L4"],
    zonderLeerplandoelReden: null,
    zonderLeerplandoelDoelsets: [],
    ...overrides,
  };
}

const REGELS: MinimumdoelRegel[] = [
  regel(),
  regel({
    ref: "6-1.1.2",
    leeftijd: "6-",
    nr: "1.1.2",
    omschrijving: "De leerlingen lezen vlot:\n- met expressie;\n- met begrip.",
    aantalLeerplandoelen: 1,
    jaarFasen: ["L5"],
  }),
  regel({
    ref: "6-9.1.1",
    leeftijd: "6-",
    nr: "9.1.1",
    omschrijving: "De leerlingen reflecteren op hun leerproces.",
    leergebied: "Attitudes",
    rubriek: "Leren leren",
    subrubriek: null,
    aantalLeerplandoelen: 0,
    jaarFasen: [],
  }),
  regel({
    ref: "K-5.5.5",
    leeftijd: "K-",
    nr: "5.5.5",
    omschrijving: "Een minimumdoel waarvan de ordening niet bekend is.",
    leergebied: null,
    rubriek: null,
    subrubriek: null,
  }),
];

function facetten(overrides: Partial<MinimumdoelFacetten> = {}): MinimumdoelFacetten {
  return {
    totaalAantalMinimumdoelen: 998,
    aantalTreffers: 4,
    aantalZonderOrdening: 1,
    leergebieden: [
      {
        naam: "Nederlands",
        aantal: 2,
        rubrieken: [
          { naam: "Lezen", aantal: 2, aantalZonderSubrubriek: 0, subrubrieken: [{ naam: "Vlot en vloeiend lezen", aantal: 2 }] },
        ],
      },
      { naam: "Attitudes", aantal: 1, rubrieken: [{ naam: "Leren leren", aantal: 1, aantalZonderSubrubriek: 1, subrubrieken: [] }] },
    ],
    leeftijden: [
      { leeftijd: "K-", aantal: 1 },
      { leeftijd: "4-", aantal: 1 },
      { leeftijd: "6-", aantal: 2 },
    ],
    ...overrides,
  };
}

let paden: string[] = [];

function toon(opties: {
  facetten: MinimumdoelFacetten;
  gekozenRef?: string | null;
  onKies?: (ref: string) => void;
  onWisFilters?: () => void;
  /** Who is looking; directie unless a test says otherwise (E6-02: the Laadlink is directie's). */
  ik?: Ik;
}) {
  paden = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((pad: string) => {
      paden.push(pad);
      const url = new URL(pad, "http://localhost");
      const p = url.searchParams;
      const body =
        url.pathname === "/api/minimumdoelen/facetten"
          ? opties.facetten
          : (() => {
              const regels = REGELS.filter((r) =>
                p.get("zonderOrdening") === "true"
                  ? r.leergebied === null
                  : r.leergebied === p.get("leergebied") &&
                    r.rubriek === p.get("rubriek") &&
                    (p.get("zonderSubrubriek") === "true" ? r.subrubriek === null : r.subrubriek === p.get("subrubriek")),
              );
              return { regels, totaal: regels.length, overslaan: 0, aantal: 200 };
            })();
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    }),
  );

  const client = metIk(new QueryClient({ defaultOptions: { queries: { retry: false } } }), opties.ik ?? DIRECTIE);
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Minimumdoelenboom
          filter={{}}
          gekozenRef={opties.gekozenRef ?? null}
          onKies={opties.onKies ?? vi.fn()}
          onWisFilters={opties.onWisFilters ?? vi.fn()}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function open(naam: RegExp) {
  fireEvent.click(await screen.findByRole("button", { name: naam }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Minimumdoelenboom", () => {
  it("toont de leergebieden van het decreet, en de minimumdoelen zonder ordening apart en als laatste", async () => {
    toon({ facetten: facetten() });

    const knoppen = await screen.findAllByRole("button");
    expect(knoppen.map((knop) => knop.textContent)).toEqual([
      "Nederlands2",
      "Attitudes1",
      `${t("doelen.zonderOrdening")}1`,
    ]);
    // Closed: nothing but the facets has been asked for.
    expect(paden.every((pad) => pad.startsWith("/api/minimumdoelen/facetten"))).toBe(true);
  });

  it("opent een tak en toont per minimumdoel de doelzin en hoeveel leerplandoelen het uitwerken, over welke jaren", async () => {
    toon({ facetten: facetten() });

    await open(/^Nederlands/);
    await open(/^Lezen/);
    await open(/^Vlot en vloeiend lezen/);

    expect(await screen.findByText("4-1.1.1")).toBeInTheDocument();
    // Every year that holds one, listed: a span "L1–L4" would claim years the row does not know about.
    expect(
      screen.getByText(`${telWoord(16, "doelen.eenLeerplandoel", "doelen.aantalLeerplandoelen")} · L1, L2, L3, L4`),
    ).toBeInTheDocument();
    expect(screen.getByText(`${telWoord(1, "doelen.eenLeerplandoel", "doelen.aantalLeerplandoelen")} · L5`)).toBeInTheDocument();
    // The row is for finding: the doelzin, not the decree's list items, which the detail shows.
    expect(screen.getByText("De leerlingen lezen vlot:")).toBeInTheDocument();
    expect(screen.queryByText(/met expressie/)).not.toBeInTheDocument();
    const lijst = new URL(paden.find((pad) => pad.includes("subrubriek="))!, "http://localhost").searchParams;
    expect([lijst.get("leergebied"), lijst.get("rubriek"), lijst.get("subrubriek")]).toEqual([
      "Nederlands",
      "Lezen",
      "Vlot en vloeiend lezen",
    ]);
  });

  it("toont de minimumdoelen van een rubriek zonder subrubriek meteen, en zegt bij een minimumdoel zonder leerplandoel alleen dat", async () => {
    toon({ facetten: facetten() });

    await open(/^Attitudes/);
    await open(/^Leren leren/);

    expect(await screen.findByText("6-9.1.1")).toBeInTheDocument();
    expect(screen.getByText(t("doelen.geenLeerplandoel"))).toBeInTheDocument();
    expect(paden.some((pad) => pad.includes("zonderSubrubriek=true"))).toBe(true);
    expect(document.body.textContent).not.toMatch(/gedekt|ontbre|niet gekoppeld/i);
  });

  it("zegt bij de minimumdoelen zonder ordening wat dat betekent en wat het verandert", async () => {
    toon({ facetten: facetten() });

    await open(new RegExp(`^${t("doelen.zonderOrdening")}`));

    expect(await screen.findByText("K-5.5.5")).toBeInTheDocument();
    expect(screen.getByText(t("doelen.zonderOrdeningEen"))).toBeInTheDocument();
    expect(paden.some((pad) => pad.includes("zonderOrdening=true"))).toBe(true);
    // A branch is named from the top: the group without an ordering sends no level at all.
    expect(paden.some((pad) => pad.includes("zonderOrdening=true") && pad.includes("leergebied="))).toBe(false);
  });

  it("markeert het gekozen minimumdoel en geeft een ander door als het aangeklikt wordt", async () => {
    const onKies = vi.fn();
    toon({ facetten: facetten(), gekozenRef: "4-1.1.1", onKies });

    await open(/^Nederlands/);
    await open(/^Lezen/);
    await open(/^Vlot en vloeiend lezen/);

    const gekozen = (await screen.findByText("4-1.1.1")).closest("button")!;
    expect(gekozen).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByText("6-1.1.2").closest("button")!);
    expect(onKies).toHaveBeenCalledWith("6-1.1.2");
  });

  // FB-041: the register opens with every branch closed, even when the filter leaves a single branch.
  it("opent geen tak vanzelf, ook niet als er maar één tak is", async () => {
    toon({ facetten: facetten({ leergebieden: [facetten().leergebieden[0]], aantalTreffers: 2, aantalZonderOrdening: 0 }) });

    const knop = await screen.findByRole("button", { name: /^Nederlands/ });
    expect(knop).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("4-1.1.1")).not.toBeInTheDocument();
    expect(paden.every((pad) => pad.startsWith("/api/minimumdoelen/facetten"))).toBe(true);
  });

  it("zegt alleen dat er nog geen minimumdoelen zijn als er geen enkel is, en wijst naar Inladen", async () => {
    toon({ facetten: facetten({ totaalAantalMinimumdoelen: 0, aantalTreffers: 0, aantalZonderOrdening: 0, leergebieden: [] }) });

    expect(await screen.findByText(t("doelen.geenMinimumdoelenTitel"))).toBeInTheDocument();
    // Straight to the Op.stap section, since that is what "laad ze in" means (E6-02).
    expect(screen.getByRole("link", { name: t("doelen.laadIn") })).toHaveAttribute("href", "/inladen?bron=opstap");
  });

  // The E1-22 carry-forward closed by E6-02: loading Op.stap is directie's (R3), so for anyone else "Laad ze in bij
  // Inladen" would point at something they cannot do. Themabeheer loads thema's, not goals.
  it("wijst alleen directie naar Inladen: themabeheer ziet de lege lijst zonder link", async () => {
    toon({
      facetten: facetten({ totaalAantalMinimumdoelen: 0, aantalTreffers: 0, aantalZonderOrdening: 0, leergebieden: [] }),
      ik: ikMet({ heeftThemabeheer: true }),
    });

    expect(await screen.findByText(t("doelen.geenMinimumdoelenTitel"))).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t("doelen.laadIn") })).not.toBeInTheDocument();
  });

  it("zegt bij een filter zonder treffers dat het aan de filters ligt, niet dat er geen minimumdoelen zijn", async () => {
    const wis = vi.fn();
    toon({ facetten: facetten({ aantalTreffers: 0, aantalZonderOrdening: 0, leergebieden: [] }), onWisFilters: wis });

    expect(await screen.findByText(t("doelen.geenMinimumdoelTreffersTitel"))).toBeInTheDocument();
    expect(screen.queryByText(t("doelen.geenMinimumdoelenTitel"))).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t("doelen.geenTreffersActie") }));
    expect(wis).toHaveBeenCalledOnce();
  });
});
