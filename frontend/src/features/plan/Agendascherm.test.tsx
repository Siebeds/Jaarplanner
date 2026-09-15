import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ik } from "../../lib/aanmelding";
import type { KlasWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { ikMet, metIk } from "../../test/rechten";
import { zetSchermbreedte } from "../../test/setup";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import { Agendascherm } from "./Agendascherm";

/**
 * The agenda's planning controls, as each side of the planning right sees them (E6-02, ADR-0030 §3, R7, R15).
 *
 * Written after `main`'s algemene fiches met the rights matrix in one merge: the two fiche chips, the side panel with
 * its create tiles, and the sheet a planned fiche opens are all the klas's planning. A gebruiker who may read the klas
 * and not plan it gets the calendar with none of them, and the sheet read-only. The whole screen is rendered, because
 * the gates sit inline in it and the record here is that a gate exists and is tested but not where the teacher is.
 */

const KLAS: KlasWeergave = {
  id: "klas-1",
  schooljaarId: "jaar-1",
  naam: "K3 groen",
  leerjaar: 0,
  aantalSubthemas: 0,
  jaarFasen: ["K3"],
  jaarfase: "K3",
  mogelijkeJaarfasen: [],
};

vi.mock("../../lib/selectie", () => ({
  useActieveSelectie: () => ({
    klas: KLAS,
    klasId: KLAS.id,
    schooljaarId: KLAS.schooljaarId,
    schooljaar: null,
    schooljaren: [],
    klassen: [KLAS],
    laadt: false,
    kiesSchooljaar: () => {},
    kiesKlas: () => {},
  }),
}));

const ROOSTER = {
  schooljaarId: "jaar-1",
  schooljaarNaam: "2026-2027",
  start: "2026-09-01",
  eind: "2027-06-30",
  niveau: "Themaperiode",
  blokindeling: "Themaperiode",
  blokken: [{ ordinaal: 1, start: "2026-09-01", eind: "2026-10-09", ouderOrdinaal: null, aantalOpenDagen: 27 }],
  onderbrekingen: [],
};

// Turnen on Tuesday 8 September, in the week the agenda opens on.
const TURNEN = {
  id: "fp-1",
  algemeneFicheId: "f-1",
  ficheNaam: "turnen",
  van: "2026-09-08",
  tot: "2026-09-08",
  momenten: [{ id: "fm-1", datum: "2026-09-08", begin: "10:30:00", einde: "11:20:00" }],
};

/** Every day from `van` to `tot`, a school day from Monday to Friday. */
function dagen(van: string, tot: string) {
  const lijst = [];
  for (let dag = new Date(`${van}T12:00:00Z`); dag <= new Date(`${tot}T12:00:00Z`); dag.setUTCDate(dag.getUTCDate() + 1)) {
    const weekdag = dag.getUTCDay();
    lijst.push({
      datum: dag.toISOString().slice(0, 10),
      isLesdag: weekdag !== 0 && weekdag !== 6,
      sluitingsnaam: null,
      activiteiten: [],
    });
  }
  return lijst;
}

function antwoord(pad: string): unknown {
  const url = new URL(pad, "http://localhost");
  switch (url.pathname) {
    case "/api/schooljaren/jaar-1/rooster":
      return ROOSTER;
    case "/api/klassen/klas-1/jaarplan":
      return { klasId: "klas-1", klasNaam: KLAS.naam, schooljaarId: "jaar-1", schooljaarNaam: "2026-2027",
        blokindeling: "Themaperiode", plaatsingen: [], blokken: [], geblokkeerdePeriodes: [] };
    case "/api/klassen/klas-1/jaarplan/weekplanning": {
      const van = url.searchParams.get("van") ?? "";
      const tot = url.searchParams.get("tot") ?? "";
      return { klasId: "klas-1", klasNaam: KLAS.naam, schooljaarId: "jaar-1", schooljaarNaam: "2026-2027", van, tot,
        dagen: dagen(van, tot), subthemaperiodes: [] };
    }
    case "/api/klassen/klas-1/hoekplaatsingen":
    case "/api/klassen/klas-1/hoeken":
      return [];
    case "/api/klassen/klas-1/algemene-ficheplaatsingen":
      return [TURNEN];
    case "/api/klassen/klas-1/algemene-fiches":
      return [{ id: "f-1", klasId: "klas-1", naam: "turnen", omschrijving: null, aantalPlaatsingen: 1, doelen: [] }];
    // The activiteiten list of the side panel (FB-017): one K3 subthema with one activiteit of one lesuur.
    case "/api/subthemas/voor-klas/klas-1":
      return [{ id: "s-1", naam: "De eekhoorn", leeftijd: "K3", themaId: "t-1", themaNaam: "Herfst" }];
    case "/api/themas/t-1/voor-klas/klas-1":
      return {
        id: "t-1", naam: "Herfst", duurWeken: 6, invalshoeken: null, kernwoordenschat: [], rijkeWoordenschat: [],
        heeftVoldoendeThemadoelen: true, themadoelen: [],
        subthemas: [{ id: "s-1", themaId: "t-1", naam: "De eekhoorn", duurWeken: 2, leeftijd: "K3", onderzoeksvragen: [],
          subdoelen: [], activiteiten: [{ id: "a-1", naam: "Eikels rapen", activiteitType: "Kring", hoek: null,
            verwachteUitkomsten: null, onderzoeksvraagId: null, kleur: null, lengteInLesuren: 1, doelkoppelingen: [] }] }],
      };
    default:
      return null;
  }
}

beforeEach(() => {
  // From `lg` the side panel is a column beside the agenda, open here on the hoekenfiches, so a panel that renders
  // is one the query below can find.
  zetSchermbreedte(true);
  useHoekenpaneel.setState({ open: true, soort: "hoeken" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pad: string, init?: RequestInit) => {
      // Every write succeeds: what a test of a write checks is what was sent, which the mock's calls record.
      if (init?.method === "POST") {
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const inhoud = antwoord(String(pad));
      return inhoud === null
        ? new Response("{}", { status: 404 })
        : new Response(JSON.stringify(inhoud), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});

afterEach(() => {
  zetSchermbreedte(false);
  useHoekenpaneel.setState({ open: false, soort: "hoeken", subthemaKeuze: null });
  vi.unstubAllGlobals();
});

function toon(ik: Ik) {
  const client = metIk(
    new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    ik,
  );
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/agenda/dag/2026-09-08"]}>
        <Routes>
          <Route path="agenda/dag/:datum" element={<Agendascherm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

const chip = (label: string) => screen.queryByRole("button", { name: label });
const paneel = () => screen.queryByRole("complementary", { name: t("hoekenpaneel.titel") });

/** Opens turnen's sheet from its block in the grid, as a click on the block does. */
async function openTurnen() {
  fireEvent.click(await screen.findByRole("button", { name: /^turnen/ }));
  return screen.findByRole("dialog");
}

describe("Agendascherm: de planning van een klas die je alleen mag bekijken", () => {
  it("toont geen fichechips en geen zijpaneel, en opent een algemene fiche alleen om te lezen", async () => {
    // A leerkracht of K3, of another klas: she reads this klas's agenda (I9) and plans only her own.
    toon(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-2"] }));

    expect(await screen.findByText(t("rechten.planningAlleenBekijken", { klas: KLAS.naam }))).toBeInTheDocument();
    expect(chip(t("periode.hoekenfiches"))).toBeNull();
    expect(chip(t("periode.algemeneFiches"))).toBeNull();
    // The activiteiten are for everyone who reads the agenda; their cards then plan nothing (owner, 2026-09-15).
    expect(chip(t("periode.activiteiten"))).not.toBeNull();
    expect(paneel()).toBeNull();

    const blad = await openTurnen();
    expect(within(blad).getByText("turnen")).toBeInTheDocument();
    expect(within(blad).queryByRole("button", { name: t("fichedetail.verwijder") })).toBeNull();
    expect(within(blad).queryByLabelText(t("fichedetail.dag"))).toBeNull();
  });

  it("geeft wie de klas mag plannen de twee chips, het zijpaneel en het blad om te wijzigen", async () => {
    toon(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-1"] }));

    // Before the sheet opens: an open dialog hides the rest of the page from the accessibility tree.
    await screen.findByRole("button", { name: /^turnen/ });
    expect(screen.queryByText(t("rechten.planningAlleenBekijken", { klas: KLAS.naam }))).toBeNull();
    expect(chip(t("periode.hoekenfiches"))).not.toBeNull();
    expect(chip(t("periode.algemeneFiches"))).not.toBeNull();
    expect(chip(t("periode.activiteiten"))).not.toBeNull();
    expect(paneel()).not.toBeNull();

    const blad = await openTurnen();
    expect(within(blad).getByRole("button", { name: t("fichedetail.verwijder") })).toBeInTheDocument();
    expect(within(blad).getByLabelText(t("fichedetail.dag"))).toBeInTheDocument();
  });
});

describe("Agendascherm: een activiteit uit het zijpaneel inplannen (FB-017)", () => {
  // The agenda opens on Tuesday 8 September, so the week a choice is kept for starts on Monday the 7th.
  const KEUZE = { subthemaId: "s-1", klasId: "klas-1", week: "2026-09-07" };
  const PLANNER = ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-1"] });

  /** The week's runs never arrive, or fail; everything else answers as in `antwoord`. */
  function weekplanningAntwoordt(hoe: "nooit" | "fout") {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (pad: string) => {
        const url = new URL(String(pad), "http://localhost");
        if (url.pathname === "/api/klassen/klas-1/jaarplan/weekplanning") {
          return hoe === "nooit" ? new Promise<Response>(() => {}) : new Response("{}", { status: 500 });
        }
        const inhoud = antwoord(String(pad));
        return inhoud === null
          ? new Response("{}", { status: 404 })
          : new Response(JSON.stringify(inhoud), { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
  }

  // Antagonist FB-017, rounds 1 and 2: "no subthema runs" is a claim only a read that succeeded can make.
  it("zegt niets over de week zolang de agenda de subthema's van die week nog leest", async () => {
    weekplanningAntwoordt("nooit");
    useHoekenpaneel.setState({ open: true, soort: "activiteiten" });
    const client = toon(PLANNER);

    await waitFor(() =>
      expect(client.getQueryState(["thema-bibliotheek", "bestemmingen", "klas-1"])?.status).toBe("success"),
    );
    expect(screen.queryByText(/loopt er geen subthema/)).toBeNull();
    expect(screen.queryByLabelText(t("activiteitenpaneel.subthema"))).toBeNull();
  });

  it("zegt minder, en niets anders, wanneer de agenda de week niet kon lezen", async () => {
    weekplanningAntwoordt("fout");
    useHoekenpaneel.setState({ open: true, soort: "activiteiten" });
    toon(PLANNER);

    expect(await screen.findByLabelText(t("activiteitenpaneel.subthema"))).toHaveValue("");
    expect(screen.queryByText(/loopt er geen subthema/)).toBeNull();
  });

  it("toont wie de klas alleen mag inkijken de kaarten, en niets om mee te plannen", async () => {
    useHoekenpaneel.setState({ open: true, soort: "activiteiten", subthemaKeuze: KEUZE });
    toon(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-2"] }));

    expect(await screen.findByText("Eikels rapen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eikels rapen/ })).toBeNull();
    expect(screen.queryByRole("button", { name: t("activiteit.toevoegen") })).toBeNull();
    // The fiche lists stay the planners'.
    expect(paneel()).toBeNull();
  });

  it("vraagt bij een aangeklikte kaart de dag en de uren, en plant ze in", async () => {
    useHoekenpaneel.setState({ open: true, soort: "activiteiten", subthemaKeuze: KEUZE });
    toon(ikMet({ leerkrachtLeeftijden: ["K3"], eigenKlasIds: ["klas-1"] }));

    fireEvent.click(await screen.findByRole("button", { name: /Eikels rapen/ }));

    const blad = await screen.findByRole("dialog", { name: t("activiteitplaatsing.titel", { naam: "Eikels rapen" }) });
    // A click names no day, so the sheet starts on the day the agenda stands on.
    expect(within(blad).getByLabelText(t("activiteitplaatsing.dag"))).toHaveValue("2026-09-08");

    fireEvent.click(within(blad).getByRole("button", { name: t("activiteitplaatsing.plaats") }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const post = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    expect(post).toBeDefined();
    expect(JSON.parse(String((post![1] as RequestInit).body))).toMatchObject({
      activiteitId: "a-1",
      datum: "2026-09-08",
    });
  });
});
