import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KlasWeergave, LeerplandoelDetail, MinimumdoelDetail, MinimumdoelRegel } from "../../lib/types";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import { zetSchermbreedte } from "../../test/setup";
import { useDoelenfilter } from "../../state/doelenfilter";
import { DoelenScherm } from "./DoelenScherm";

/**
 * "Koppel dit doel" opens a sheet that lists the CHOSEN klas's subthema's (fix round 1, F1). So the button asks about
 * that klas's leeftijden: a hoofdleerkracht of K3, who needs no klas (I20), with an L1 klas picked would otherwise open
 * a sheet with nothing to press (the E3-06 rule).
 *
 * The doel is opened from the minimumdoelen register, on a wide screen so the detail is the column beside the list
 * rather than a sheet. That register is the decree's tree (TB-010) and opens with every branch closed (FB-041), so the
 * way in is: open the branch by hand, the minimumdoel's row, then the code in its detail.
 */

// `laadt` is settable because the klasfilter has a rule that only holds while the klassen query is in flight: a
// pending list reads as "no klas", and acting on it would wipe a jaar/fase the teacher chose herself (TB-036).
const selectie = vi.hoisted(() => ({ klas: null as unknown, laadt: false }));
vi.mock("../../lib/selectie", () => ({
  useActieveSelectie: () => {
    const klas = selectie.klas as KlasWeergave;
    return {
      klas,
      klasId: klas.id,
      schooljaarId: klas.schooljaarId,
      schooljaar: null,
      schooljaren: [],
      klassen: [klas],
      laadt: selectie.laadt,
      kiesSchooljaar: () => {},
      kiesKlas: () => {},
    };
  },
}));

const CODE = "2.1.GL3.10";

const klasVan = (jaarfase: string): KlasWeergave => ({
  id: `klas-${jaarfase}`,
  schooljaarId: "jaar-1",
  naam: `${jaarfase} groen`,
  leerjaar: 0,
  aantalSubthemas: 0,
  jaarFasen: [jaarfase],
  jaarfase,
  mogelijkeJaarfasen: [],
  kanLeerlingenHebben: jaarfase === "K3",
});

const REF = "K-2.1";

const REGEL: MinimumdoelRegel = {
  ref: REF,
  leeftijd: "K-",
  nr: "2.1",
  omschrijving: "Tellen.",
  leergebied: "Wiskunde",
  rubriek: "Getallen",
  subrubriek: "Tellen",
  aantalLeerplandoelen: 1,
  jaarFasen: ["K3"],
  zonderLeerplandoelReden: null,
  zonderLeerplandoelDoelsets: [],
};

const MINIMUMDOEL: MinimumdoelDetail = {
  ref: REF,
  leeftijd: "K-",
  nr: "2.1",
  omschrijving: "Tellen.",
  leergebied: "Wiskunde",
  rubriek: "Getallen",
  subrubriek: "Tellen",
  soort: "TeBereikenIndividueel",
  nietMeerInOpstap: false,
  aantalLeerplandoelen: 1,
  jaarFasen: [
    {
      jaarFase: "K3",
      leerplandoelen: [
        { code: CODE, tekst: "Tot tien tellen.", disciplineNaam: "Wiskunde", domein: "Getallen", subdomein: "Tellen", nietMeerInOpstap: false },
      ],
    },
  ],
  zonderLeerplandoelReden: null,
  zonderLeerplandoelDoelsets: [],
};

const DETAIL: LeerplandoelDetail = {
  code: CODE,
  doelsoort: "Gemeenschappelijk",
  jaarFase: "K3",
  disciplineNummer: "2",
  disciplineNaam: "Wiskunde",
  domein: "Getallen",
  subdomein: "Tellen",
  cluster: null,
  tekst: "De kleuters tellen tot tien.",
  voorbeelden: null,
  toelichting: null,
  woordenschat: null,
  minimumdoelRef: null,
  minimumdoel: null,
  nietMeerInOpstap: false,
  koppelingen: [],
  gerelateerdeDoelen: [],
};

function antwoord(pad: string): unknown {
  switch (new URL(pad, "http://localhost").pathname) {
    case "/api/minimumdoelen/facetten":
      return {
        totaalAantalMinimumdoelen: 1,
        aantalTreffers: 1,
        aantalZonderOrdening: 0,
        leergebieden: [
          {
            naam: "Wiskunde",
            aantal: 1,
            rubrieken: [{ naam: "Getallen", aantal: 1, aantalZonderSubrubriek: 0, subrubrieken: [{ naam: "Tellen", aantal: 1 }] }],
          },
        ],
        leeftijden: [{ leeftijd: "K-", aantal: 1 }],
      };
    case "/api/minimumdoelen":
      return { regels: [REGEL], totaal: 1, overslaan: 0, aantal: 200 };
    case `/api/minimumdoelen/${REF}`:
      return MINIMUMDOEL;
    case "/api/leerplandoelen/facetten":
      return {
        totaalAantalDoelen: 1,
        disciplines: [{ nummer: "2", naam: "Wiskunde", aantal: 1 }],
        domeinen: [{ domein: "Getallen", aantal: 1, subdomeinen: [{ subdomein: "Tellen", aantal: 1 }] }],
        doelsoorten: [],
        jaarFasen: [],
      };
    case `/api/leerplandoelen/${CODE}`:
      return DETAIL;
    case "/api/themas/bibliotheek":
      return [];
    default:
      return null;
  }
}

/** Every URL the screen asked for, in order, so a test can look at what it fetched *after* a given moment. */
let opgevraagd: string[] = [];

beforeEach(() => {
  zetSchermbreedte(true);
  opgevraagd = [];
  selectie.laadt = false;
  useDoelenfilter.setState({ bron: "minimumdoelen", filter: {}, zoek: "", faseVanKlas: null });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pad: string) => {
      opgevraagd.push(String(pad));
      const inhoud = antwoord(String(pad));
      return inhoud === null
        ? new Response("{}", { status: 404 })
        : new Response(JSON.stringify(inhoud), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});

afterEach(() => {
  zetSchermbreedte(false);
  vi.unstubAllGlobals();
  // A test below silences console.error to read what React wrote to it. Restoring here rather than in that test keeps
  // a failing assertion from leaving the console muted for whatever runs next.
  vi.restoreAllMocks();
});

function toonScherm() {
  const client = metIk(
    new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    ikMet({ hoofdleerkrachtLeeftijden: ["K3"] }),
  );
  // A fresh element per render: handing `rerender` the same element object makes React bail out, and the klas switch
  // below is exactly a re-render with another klas in the (module-level) selectie mock.
  const boom = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DoelenScherm />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const { rerender } = render(boom());
  return { hertoon: () => rerender(boom()) };
}

async function openDoel(klasJaarfase: string) {
  selectie.klas = klasVan(klasJaarfase);
  toonScherm();
  for (const tak of [/^Wiskunde/, /^Getallen/, /^Tellen/]) {
    fireEvent.click(await screen.findByRole("button", { name: tak }));
  }
  fireEvent.click((await screen.findByText(REF)).closest("button")!);
  fireEvent.click((await screen.findByText(CODE)).closest("button")!);
  await screen.findByText(DETAIL.tekst);
}

describe("DoelenScherm: Koppel dit doel", () => {
  it("biedt een hoofdleerkracht van K3 met een L1-klas gekozen het koppelen niet aan", async () => {
    await openDoel("L1");
    expect(screen.queryByRole("button", { name: t("doel.koppelAan") })).toBeNull();
  });

  it("biedt het wel aan met een K3-klas gekozen", async () => {
    await openDoel("K3");
    expect(screen.getByRole("button", { name: t("doel.koppelAan") })).toBeInTheDocument();
  });
});

// FB-041: whoever goes to Doelen finds both registers closed, whatever filter or search is active.
describe("DoelenScherm: alles ingeklapt", () => {
  const takken = () => screen.getAllByRole("button", { expanded: true });

  it("opent de minimumdoelen met elk leergebied dicht, ook met de klasfilter", async () => {
    selectie.klas = klasVan("K3");
    toonScherm();

    expect(await screen.findByRole("button", { name: /^Wiskunde/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
    expect(screen.queryByText(REF)).not.toBeInTheDocument();
  });

  it("opent de leerplandoelen met elke discipline dicht, ook na een zoekterm", async () => {
    selectie.klas = klasVan("K3");
    useDoelenfilter.setState({ bron: "leerplandoelen", zoek: "tellen" });
    toonScherm();

    expect(await screen.findByRole("button", { name: /^Wiskunde/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
  });

  it("houdt een zelf geopende tak open, en klapt ze dicht als de zoekterm wijzigt", async () => {
    selectie.klas = klasVan("K3");
    toonScherm();

    fireEvent.click(await screen.findByRole("button", { name: /^Wiskunde/ }));
    expect(await screen.findByRole("button", { name: /^Getallen/ })).toBeInTheDocument();
    expect(takken()).toEqual([
      screen.getByRole("button", { name: /^Wiskunde/ }),
    ]);

    act(() => useDoelenfilter.setState({ zoek: "tel" }));
    expect(await screen.findByRole("button", { name: /^Wiskunde/, expanded: false })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Getallen/ })).not.toBeInTheDocument();
  });
});

/**
 * TB-036: the register opens on the klas's jaar/fase, and it gets there without writing to the filter store while
 * rendering. That store is what the screen renders from, so a write during its own render is the update React warns
 * about in the console, and a warning nobody acts on is a warning that hides the next one.
 */
describe("DoelenScherm: klasfilter", () => {
  const facettenVragen = (vanaf = 0) =>
    opgevraagd.slice(vanaf).filter((pad) => pad.startsWith("/api/minimumdoelen/facetten"));

  it("opent op de jaar/fase van de klas", async () => {
    selectie.klas = klasVan("K3");
    toonScherm();
    await screen.findByRole("button", { name: /^Wiskunde/ });

    expect(useDoelenfilter.getState().filter.jaarFase).toBe("K3");
    expect(useDoelenfilter.getState().faseVanKlas).toBe("K3");
    expect(facettenVragen().every((pad) => pad.includes("jaarFase=K3"))).toBe(true);
  });

  /**
   * The switch is where both halves show. The class arrives after the first render here, as it does in the browser
   * once the klassen query lands, so this is the render in which the old code wrote to a store it was already
   * subscribed to. And the screen must not fetch the previous class's jaar/fase once more on the way: an effect that
   * writes first and renders after would do exactly that.
   */
  it("volgt een andere klas zonder waarschuwing, en zonder de vorige jaar/fase nog eens te bevragen", async () => {
    const fouten = vi.spyOn(console, "error").mockImplementation(() => {});
    selectie.klas = klasVan("K3");
    const { hertoon } = toonScherm();
    await screen.findByRole("button", { name: /^Wiskunde/ });

    const tot = opgevraagd.length;
    selectie.klas = klasVan("L1");
    await act(async () => {
      hertoon();
    });

    expect(useDoelenfilter.getState().filter.jaarFase).toBe("L1");
    expect(facettenVragen(tot).length).toBeGreaterThan(0);
    expect(facettenVragen(tot).every((pad) => pad.includes("jaarFase=L1"))).toBe(true);
    expect(fouten.mock.calls.map((oproep) => oproep.map(String).join(" ")).join("\n")).not.toMatch(
      /Cannot update a component/,
    );
  });

  // The other half of the guard: while the klassen query is still running there is no klas to follow, and a teacher
  // who narrowed the register herself must not have that narrowing wiped by a list that has not arrived yet.
  it("laat een zelf gekozen jaar/fase staan zolang de klassen laden", async () => {
    selectie.klas = klasVan("K3");
    selectie.laadt = true;
    useDoelenfilter.setState({ filter: { jaarFase: "L5" } });
    toonScherm();
    await screen.findByRole("button", { name: /^Wiskunde/ });

    expect(useDoelenfilter.getState().filter.jaarFase).toBe("L5");
    expect(useDoelenfilter.getState().faseVanKlas).toBeNull();
    expect(facettenVragen().every((pad) => pad.includes("jaarFase=L5"))).toBe(true);
  });
});
