import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t, telWoord } from "../../i18n";
import type { GeconcordeerdLeerplandoel, MinimumdoelDetail } from "../../lib/types";
import { Minimumdoeldetail } from "./Minimumdoeldetail";

/**
 * One minimumdoel and where Op.stap works it out (TB-010): the decreed text, its mijlpaal and kind, and the concorded
 * leerplandoelen per jaar/fase, each of which opens its own detail.
 */

const FASEN = ["JK", "K2", "K3", "L1", "L2", "L3", "L4", "L5", "L6"];

function lpd(code: string, tekst: string, nietMeerInOpstap = false): GeconcordeerdLeerplandoel {
  return { code, tekst, disciplineNaam: "Nederlands en communicatie", domein: "Lezen", subdomein: "Technisch lezen", nietMeerInOpstap };
}

function detail(overrides: Partial<MinimumdoelDetail> = {}): MinimumdoelDetail {
  return {
    ref: "4-1.1.1",
    leeftijd: "4-",
    nr: "1.1.1",
    omschrijving: "De leerlingen kunnen woorden lezen:\n- klankzuivere woorden;\n- woorden met clusters.",
    leergebied: "Nederlands",
    rubriek: "Lezen",
    subrubriek: "Vlot en vloeiend lezen",
    soort: "TeBereikenIndividueel",
    nietMeerInOpstap: false,
    aantalLeerplandoelen: 3,
    jaarFasen: FASEN.map((jaarFase) => ({
      jaarFase,
      leerplandoelen:
        jaarFase === "L1"
          ? [lpd("1.1.GL1.1", "De leerling leest klankzuivere woorden."), lpd("1.1.GL1.2", "De leerling leest woorden met clusters.")]
          : jaarFase === "L2"
            ? [lpd("1.1.GL2.1", "De leerling leest vlot.", true)]
            : [],
    })),
    zonderLeerplandoelReden: null,
    zonderLeerplandoelDoelsets: [],
    ...overrides,
  };
}

function toon(antwoord: MinimumdoelDetail | null, onKies = vi.fn()) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        antwoord === null
          ? new Response(null, { status: 404 })
          : new Response(JSON.stringify(antwoord), { status: 200, headers: { "Content-Type": "application/json" } }),
      ),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Minimumdoeldetail minimumdoelRef="4-1.1.1" onKies={onKies} />
    </QueryClientProvider>,
  );
  return onKies;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Minimumdoeldetail", () => {
  it("toont de decretale tekst met zijn opsomming, de mijlpaal, de soort en de plaats in het decreet", async () => {
    toon(detail());

    expect(await screen.findByText("4-1.1.1")).toBeInTheDocument();
    expect(screen.getByText(t("minimumdoel.mijlpaal4"))).toBeInTheDocument();
    expect(screen.getByText(t("minimumdoel.soortTeBereikenIndividueel"))).toBeInTheDocument();
    expect(screen.getByText("Nederlands / Lezen / Vlot en vloeiend lezen")).toBeInTheDocument();
    const tekst = screen.getByText((_, el) => el?.tagName === "P" && (el.textContent ?? "").startsWith("De leerlingen kunnen"));
    expect(tekst).toHaveClass("whitespace-pre-line");
    expect(tekst.textContent).toContain("\n- woorden met clusters.");
  });

  it("toont per jaar of fase hoeveel leerplandoelen het minimumdoel uitwerken, ook zonder kleur te zien", async () => {
    toon(detail());

    expect(await screen.findByRole("img", { name: t("minimumdoel.perJaarFaseLabel", { lijst: "L1: 2, L2: 1" }) })).toBeInTheDocument();
    expect(
      screen.getByText(telWoord(3, "minimumdoel.uitgewerktInEen", "minimumdoel.uitgewerktInMeer")),
    ).toBeInTheDocument();
  });

  it("opent een leerplandoel uit de lijst, en zegt het als een ervan vervallen is", async () => {
    const onKies = toon(detail());

    fireEvent.click(await screen.findByRole("button", { name: /1\.1\.GL1\.2/ }));

    expect(onKies).toHaveBeenCalledWith("1.1.GL1.2");
    expect(screen.getByText(t("doel.vervallen"))).toBeInTheDocument();
  });

  it("zegt 1 leerplandoel in het enkelvoud", async () => {
    toon(
      detail({
        aantalLeerplandoelen: 1,
        jaarFasen: FASEN.map((jaarFase) => ({ jaarFase, leerplandoelen: jaarFase === "L4" ? [lpd("1.1.GL4.1", "Een doel.")] : [] })),
      }),
    );

    expect(await screen.findByText(t("minimumdoel.uitgewerktInEen"))).toBeInTheDocument();
  });

  it("zegt bij een minimumdoel zonder leerplandoel alleen dat en de reden die de import kent, nooit dat er iets ontbreekt", async () => {
    toon(
      detail({
        aantalLeerplandoelen: 0,
        jaarFasen: FASEN.map((jaarFase) => ({ jaarFase, leerplandoelen: [] })),
        zonderLeerplandoelReden: "AlleenOvergeslagenDoelsets",
        zonderLeerplandoelDoelsets: ["Z"],
      }),
    );

    expect(await screen.findByText(t("doelen.zonderLeerplandoelEen"))).toBeInTheDocument();
    expect(screen.getByText(t("doelen.redenDoelsets", { doelsets: t("doelen.doelsetZ") }))).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/gedekt|ontbre|niet gekoppeld/i);
  });

  it("zegt dat het minimumdoel niet geladen is als het er niet is", async () => {
    toon(null);

    expect(await screen.findByText(t("minimumdoel.fout"))).toBeInTheDocument();
  });
});
