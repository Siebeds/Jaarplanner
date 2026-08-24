import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { t, tAantal } from "../../i18n";
import { DekkingPagina } from "../dekking/DekkingPagina";
import { dekking as maakDekking } from "../dekking/testdata";
import { dekkingKlasKey } from "../dekking/useDekking";
import { Jaarplankalender } from "./Jaarplankalender";
import { formatteerPeriode } from "./kalenderFormat";
import type {
  Generatieparameters,
  Generatieresultaat,
  Jaarplan,
  Planningsrooster,
} from "./types";

/**
 * Pins E3-06's acceptance criterion — "a generated plan renders per block" (FR-6.1) — and the two
 * properties the ribbon must not get wrong: an **empty** period still appears, and a **stale**
 * placement is shown rather than silently dropped.
 *
 * The API is faked at the fetch boundary, so this drives the real components, the real TanStack Query
 * chain (rooster is fetched using the schooljaarId the jaarplan returns) and the real nl.json copy.
 */

const KLAS_ID = "11111111-1111-1111-1111-111111111111";
const SCHOOLJAAR_ID = "22222222-2222-2222-2222-222222222222";

const rooster: Planningsrooster = {
  schooljaarId: SCHOOLJAAR_ID,
  schooljaarNaam: "2026-2027",
  start: "2026-09-01",
  eind: "2027-06-30",
  niveau: "Themaperiode",
  blokindeling: "themaperiode 5 wk, subthemaperiode 2 wk",
  blokken: [
    { ordinaal: 1, start: "2026-09-01", eind: "2026-11-01", ouderOrdinaal: null, aantalOpenDagen: 62, aantalOpenWeekdagen: 44 },
    { ordinaal: 2, start: "2026-11-09", eind: "2026-12-20", ouderOrdinaal: null, aantalOpenDagen: 42, aantalOpenWeekdagen: 30 },
  ],
  onderbrekingen: [{ naam: "Herfstvakantie", start: "2026-11-02", eind: "2026-11-08" }],
};

/**
 * The per-block load the server sends with the plan (E3-09), derived from the placements so the fixture cannot
 * describe a board that could not exist: a payload claiming 12 weeks of thema's in a period holding one 4-week card
 * would let a rendering test pass on a state the server never produces.
 *
 * `beschikbareWeken` rounds the rooster's open days **up**, exactly as the server does, so the two halves of every
 * assertion come from the same arithmetic the product uses.
 *
 * Rejected placements are excluded, matching `Themaplaatsing.IsGepland`: nothing is taught in a period on account of
 * a thema the teacher threw out.
 */
function maakBelasting(plaatsingen: Jaarplan["plaatsingen"]): Jaarplan["blokken"] {
  return rooster.blokken.map((blok) => {
    const inBlok = plaatsingen.filter(
      (plaatsing) =>
        plaatsing.blokStart === blok.start &&
        !plaatsing.isVervallen &&
        plaatsing.status !== "Geweigerd",
    );
    const benodigdeWeken = inBlok.reduce((som, plaatsing) => som + plaatsing.duurWeken, 0);
    const beschikbareWeken = Math.ceil(blok.aantalOpenDagen / 7);

    return {
      ordinaal: blok.ordinaal,
      start: blok.start,
      aantalThemas: inBlok.length,
      aantalDoelen: new Set(inBlok.flatMap((plaatsing) => plaatsing.doelcodes)).size,
      benodigdeWeken,
      beschikbareWeken,
      isOverbelast: benodigdeWeken > beschikbareWeken,
    };
  });
}

function maakJaarplan(
  plaatsingen: Jaarplan["plaatsingen"],
  blokken: Jaarplan["blokken"] = maakBelasting(plaatsingen),
): Jaarplan {
  return {
    klasId: KLAS_ID,
    klasNaam: "L3 derde leerjaar",
    schooljaarId: SCHOOLJAAR_ID,
    schooljaarNaam: "2026-2027",
    blokindeling: rooster.blokindeling,
    // E4-05: no period is blocked in these fixtures; the blocked-period cases build their own.
    geblokkeerdePeriodes: [],
    plaatsingen,
    blokken,
  };
}

/** A placement in the first block, overridable per field. */
function maakPlaatsing(
  overrides: Partial<Jaarplan["plaatsingen"][number]> & { id: string },
): Jaarplan["plaatsingen"][number] {
  return {
    themaId: `t-${overrides.id}`,
    themaNaam: "Thema",
    blokNiveau: "Themaperiode",
    blokStart: "2026-09-01",
    blokEind: "2026-11-01",
    blokOrdinaal: 1,
    isVervallen: false,
    status: "Voorgesteld",
    aiMotivatie: "past hier volgens de AI",
    vergrendeld: false,
    doelcodes: [],
    // A nominal thema length. 4 against block 1's 9 available weeks keeps the default fixture comfortably NOT te vol,
    // so a test that wants the flag has to ask for it rather than inherit it.
    duurWeken: 4,
    ...overrides,
  };
}

/**
 * Routes the GETs the kalender makes; everything else is a test bug, so it 404s loudly.
 *
 * `generatie` optionally controls the POST: a run result for success, or an HTTP status number to simulate a
 * failure. The order of the checks matters — the generation URL also contains "/jaarplan".
 */
/**
 * A coverage answer in which nothing is missing, so the E3-09 knelpunt line stays silent by default.
 *
 * The default is deliberately the *quiet* one: a fixture that reported gaps would put a knelpunt sentence on every
 * screen this file asserts about, and the tests that are actually about the signal would then be asserting the presence
 * of something they did not arrange.
 */
const DEKKING_NIETS_ONTBREEKT = {
  klasId: KLAS_ID,
  klasNaam: "L3 derde leerjaar",
  schooljaarId: SCHOOLJAAR_ID,
  schooljaarNaam: "2026-2027",
  bereik: "EigenJaarFase",
  gemetenJaarFasen: ["L3"],
  beschikbareJaarFasen: ["L3"],
  isTerugvalNaarHeelCurriculum: false,
  aantalBuitenBereik: 0,
  isBetrouwbaar: true,
  aantalOnopgelosteVervallenPlaatsingen: 0,
  aantalGedekt: 8,
  aantalLeerplandoelen: 8,
  doelen: [],
};

/**
 * The progress bar's payload (E9-06), DERIVED from whatever coverage answer the test arranged.
 *
 * Derived rather than a second fixture, because the bar and the `/dekking` read are the same computation server-side: a
 * test that arranges "3 of 11 covered" must not be able to get a bar saying something else, and two independent
 * fixtures is exactly how that would happen.
 *
 * **The ceiling defaults to the covered count**, so nothing is standing and the increment sentence stays silent unless
 * a test asks for one. Same reasoning as `DEKKING_NIETS_ONTBREEKT` being the quiet default: a fixture with proposals
 * outstanding would put an extra sentence on every screen this file asserts about.
 */
function voortgangUit(dekking: Record<string, unknown>, mogelijk?: number | null) {
  const gedekt = dekking.aantalGedekt as number | null;
  const totaal = dekking.aantalLeerplandoelen as number;
  const plafond = mogelijk === undefined ? gedekt : mogelijk;

  return {
    bereik: dekking.bereik,
    gemetenJaarFasen: dekking.gemetenJaarFasen,
    isTerugvalNaarHeelCurriculum: dekking.isTerugvalNaarHeelCurriculum,
    aantalBuitenBereik: dekking.aantalBuitenBereik,
    isBetrouwbaar: dekking.isBetrouwbaar,
    aantalOnopgelosteVervallenPlaatsingen: dekking.aantalOnopgelosteVervallenPlaatsingen,
    aantalGedekt: gedekt,
    aantalMogelijkGedekt: plafond,
    aantalLeerplandoelen: totaal,
    aantalOnbereikbaar: gedekt === null ? null : totaal - gedekt,
  };
}

function stubFetch(
  jaarplan: Jaarplan,
  generatie?: Generatieresultaat | number,
  dekking?: unknown,
  mogelijkGedekt?: number | null,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === "POST" && url.includes("/generatie")) {
        if (typeof generatie === "number") {
          // The real failure body is English ProblemDetails; the UI must never echo it.
          return new Response(
            JSON.stringify({ title: "Invalid AI response", detail: "Malformed JSON: …" }),
            { status: generatie },
          );
        }

        return new Response(JSON.stringify(generatie), { status: 200 });
      }
      // E3-04's parameter form lives in this screen. Its thema query is gated on the panel being open, so it
      // never fires here — but the stub routes it anyway, because this file's own contract is that an unrouted
      // URL "404s loudly" and an unrouted /themas 404'd SILENTLY: the form is closed, so the error never
      // rendered and the only symptom was a React act() warning attributed to a component this file does not
      // test. A stub that fails quietly is the thing this comment block was written against.
      if (url.includes("/api/themas")) {
        return new Response(JSON.stringify([{ id: "t0", naam: "Herfst" }]), { status: 200 });
      }
      // The form's KEPT settings (E3-04 persistence half). Unlike the thema query this one is NOT gated on the panel
      // being open, because the settings are sent with every run — so it fires on every render of this screen and must
      // be routed BEFORE the plain /jaarplan branch, which its URL extends. Leaving it to fall through returned a
      // Jaarplan where the form expected settings, and the form then threw inside an effect.
      if (url.includes("/jaarplan/parameters")) {
        return new Response(
          JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }),
          { status: 200 },
        );
      }
      // The dekking read behind the "goals this plan teaches nowhere" knelpunt (E3-09). Routed for every test in this
      // file, not only the ones about it, because an unrouted URL falls through to the 404 below and the knelpunt line
      // then renders its "could not be checked" state on every screen this file asserts against — including the axe
      // runs, which would be measuring a permanent error state nobody meant to put there.
      // E9-06's progress bar. **Routed BEFORE the plain /dekking branch, which its URL extends** — the same trap
      // `/jaarplan/parameters` documents four branches up. Falling through would hand the bar a `Dekking` payload with
      // no `aantalMogelijkGedekt`, which `bepaalVoortgangsbalk` reads as a withheld figure, so every test in this file
      // would silently render no bar at all and the suite would go green on a screen with the signal missing.
      if (url.includes("/dekking/voortgang")) {
        return new Response(
          JSON.stringify(
            voortgangUit(
              (dekking ?? DEKKING_NIETS_ONTBREEKT) as Record<string, unknown>,
              mogelijkGedekt,
            ),
          ),
          { status: 200 },
        );
      }
      if (url.includes("/dekking")) {
        return new Response(JSON.stringify(dekking ?? DEKKING_NIETS_ONTBREEKT), { status: 200 });
      }
      if (url.includes("/rooster")) {
        return new Response(JSON.stringify(rooster), { status: 200 });
      }
      if (url.includes("/jaarplan")) {
        return new Response(JSON.stringify(jaarplan), { status: 200 });
      }

      return new Response("unexpected request", { status: 404 });
    }),
  );
}

/**
 * Presses the whole-plan regeneration through its confirmation (E9-08).
 *
 * The trigger no longer runs anything: from E9-08 it opens a confirmation carrying the sentence about what the run
 * discards, which is what let that sentence stop living permanently above the board. So every test that wants a
 * regeneration to actually happen goes through both presses, and a test that wants the DISCLOSURE only presses once.
 */
/**
 * Opens the regeneration disclosure **without running anything** (E9-08), and returns the paragraph.
 *
 * The four tests below are about the disclosure, not about the run: what E4-04 promised is that a teacher learns what
 * the press discards *before* it happens. E9-08 moved that sentence from "permanently above the board" to "the moment
 * of the press", so these tests now open the confirmation and read it there. The promise is unchanged and is in fact
 * stronger, since the sentence can no longer be scrolled past days before the press it describes.
 */
async function opentHergeneratieUitleg() {
  fireEvent.click(await screen.findByRole("button", { name: t("kalender.hergenereer") }));

  return screen.getByText(t("kalender.hergenereerUitleg"));
}

async function drukHergenereer() {
  fireEvent.click(await screen.findByRole("button", { name: t("kalender.hergenereer") }));
  fireEvent.click(screen.getByRole("button", { name: t("kalender.hergenereerBevestig") }));
}

/**
 * The list of period cards.
 *
 * Needed because the year spine repeats two of the card labels by design — it carries a legend so its
 * colours never stand alone (Art. XII) — so a document-wide text query for "Te vol" is ambiguous and would
 * pass for the wrong reason.
 */
function periodes() {
  return screen.getByRole("list", { name: t("kalender.ribbonLabel") });
}

/**
 * Renders the screen with its own query client.
 *
 * The client is **returned** so a test can drive TanStack directly. One state this screen has to get right is only
 * reachable that way: a query that is `isError` while still holding data, which is what an errored *background*
 * refetch produces (`refetchQueries` on a key whose fetch then fails). Nothing in the component tree can be clicked
 * to reach it.
 */
/**
 * A router is required, not decorative (E3-09): the knelpunt line for goals the plan teaches nowhere links to
 * `/dekking`, and react-router's `Link` throws without a router context. The real screen always has one, since the
 * kalender is only ever reached through a route, so providing it here makes the harness match the app rather than
 * papering over a missing dependency. Rendering without it is what 75 of this file's tests did until the link existed.
 */
function renderKalender() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Jaarplankalender klasId={KLAS_ID} onOpenPeriode={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
    queryClient,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Jaarplankalender", () => {
  it("renders the generated plan per block, with the vakantie as a gap between them", async () => {
    stubFetch(
      maakJaarplan([
        {
          id: "p1",
          themaId: "t1",
          themaNaam: "Ik en mijn klas",
          blokNiveau: "Themaperiode",
          blokStart: "2026-09-01",
          blokEind: "2026-11-01",
          blokOrdinaal: 1,
          isVervallen: false,
          status: "Voorgesteld",
          aiMotivatie: "past bij het begin van het schooljaar",
          vergrendeld: false,
          doelcodes: ["NAT-L3-01", "NL-L3-04"],
          duurWeken: 5,
        },
      ]),
    );
    renderKalender();

    expect(await screen.findByText("Ik en mijn klas")).toBeInTheDocument();

    // Both periods render — including period 2, which holds nothing.
    expect(screen.getByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    expect(screen.getByText(t("kalender.periode", { ordinaal: 2 }))).toBeInTheDocument();
    expect(screen.getByText("Nog niets gepland")).toBeInTheDocument();

    // The vakantie is drawn between them.
    expect(screen.getByText("Herfstvakantie")).toBeInTheDocument();

    // The heading states the period in WHOLE weeks, rounded up, because the te-vol rule it sits above compares that
    // way (owner ruling 2026-08-04, E3-09): 62 open days is 8,9 weeks and reads 9; 42 is exactly 6. The precise figure
    // has not been lost, it moved to where it is load-bearing — the spine still sizes its segments on open days.
    expect(screen.getByText("9 weken")).toBeInTheDocument();
    expect(screen.getByText("6 weken")).toBeInTheDocument();
    // And no decimal survives anywhere on the board, which is the property that makes the two figures agree.
    expect(screen.queryByText(/\d,\d weken/)).toBeNull();

    // The count says GEKOPPELD, not "gedekt": doelcodes are links, and Art. V.1 makes a doel gedekt only
    // once its thema is placed. Asserting the exact word is the point — "gedekt" here would be a false
    // coverage claim in the product whose purpose is provable coverage.
    //
    // **Scoped to the CARD, which is a correction rather than a weakening** (E9-06 fix round, 2026-08-20). The negative
    // assertion used to be document-wide, and that was only ever true because nothing on the board reported coverage.
    // E9-06 put a coverage bar in the knelpunt slot, so *"8 van 8 doelen gedekt"* is now a legitimate sentence a few
    // hundred pixels away, and a document-wide `/gedekt/` would forbid the very figure CR4 asked for. What the claim was
    // always about is this card: a link count must not call itself coverage. Scoping it says that, and keeps it able to
    // fail — the document-wide version would now fail on correct behaviour, which is worse than not asserting at all.
    //
    // *It survived the E9-06 commit on timing rather than on truth,* which is worth recording: the bar renders `null`
    // until its own request resolves, so the assertion ran in the window before it. A negative assertion that depends on
    // a request not having answered yet is the same defect this branch corrected twice in E4-01's cache tests.
    const themakaart = screen.getByText("Ik en mijn klas").closest("article") as HTMLElement;
    expect(within(themakaart).getByText("2 doelen gekoppeld")).toBeInTheDocument();
    expect(within(themakaart).queryByText(/gedekt/)).toBeNull();

    expect(screen.getByText(/past bij het begin van het schooljaar/)).toBeInTheDocument();
  });

  it("shows a stale placement in a non-dismissible notice instead of dropping it", async () => {
    stubFetch(
      maakJaarplan([
        {
          id: "p2",
          themaId: "t2",
          themaNaam: "Feesten in december",
          blokNiveau: "Themaperiode",
          // A date that is no longer the start of any derived block.
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
          status: "Aanvaard",
          aiMotivatie: null,
          vergrendeld: true,
          doelcodes: ["MUZ-L3-02"],
          duurWeken: 4,
        },
      ]),
    );
    renderKalender();

    // A labelled `region`, not an `alert`, since E3-07 (see `TeHerzien`): the notice now contains interactive
    // controls and a nested alert, and nesting live regions has undefined announcement behaviour. The
    // announcement moved to an sr-only `role="status"` line, asserted separately below.
    const melding = await screen.findByRole("region", {
      name: t("kalender.herzienTitelEnkelvoud"),
    });

    // The count sentence is still announced, just by a small live region instead of the whole notice.
    //
    // `getAllByRole`, not `getByRole` (E4-02). Every Themakaart now carries its own sr-only `role="status"` line for
    // the accept/reject decision, so the notice contains several live regions and a singular query is ambiguous.
    // Asserted as "some live region in this notice announces the count" on purpose: that is what the test means, and
    // it does not break again the next time a card gains or loses a region. Taking `[0]` would have passed today and
    // pinned the render order of two unrelated components.
    expect(
      within(melding)
        .getAllByRole("status")
        .map((regio) => regio.textContent),
    ).toContain(t("kalender.herzienTitelEnkelvoud"));

    // The thema is named, not merely counted — a teacher must see which plan item needs attention.
    expect(melding).toHaveTextContent("Feesten in december");
    // Correct Dutch for a count of one: "1 thema STAAT", not "1 thema's STAAN". Asserted against the
    // catalogue rather than a literal, which is the convention elsewhere in the suite and the reason a
    // later copy edit should not be able to fail this test: what matters is that the SINGULAR entry is
    // chosen, not which words it currently contains.
    expect(melding).toHaveTextContent(t("kalender.herzienTitelEnkelvoud"));
    expect(melding).not.toHaveTextContent(t("kalender.herzienTitel", { aantal: 1 }));

    // And there is still no way to dismiss it (directie 2026-07-28: "fix later" is not an option offered).
    //
    // E3-07 *does* add a control inside this notice — the inline re-placement the same ruling asks for — so
    // the original "there are no buttons here" assertion could not survive it. What replaces it is stronger
    // rather than weaker: the FULL set of controls is pinned, so a dismiss, close or "later" affordance added
    // as a button changes the set and fails. The link check stays for the same reason it was written: a
    // dismiss control smuggled in as an <a>.
    //
    // "Subthema's" joins the set (2026-08-23): it is not a dismiss/close/later affordance — it opens the
    // class's own subthema's for doelkoppeling, a fact about the KLAS rather than about this placement's
    // staleness, and `Themakaart.tsx` deliberately does not gate it on `isVervallen` (antagonist MAJOR-4).
    expect(
      within(melding)
        .getAllByRole("button")
        .map((control) => control.getAttribute("aria-label") ?? control.textContent),
    ).toEqual([
      t("kalender.aanpassenLabel", { thema: "Feesten in december" }),
      t("kalender.subthemasLabel", { thema: "Feesten in december" }),
    ]);
    expect(within(melding).queryByRole("link")).toBeNull();

    // It must NOT claim a coverage figure: this thema sits in no period, so under Art. V.1 nothing it
    // links to is gedekt — and the notice itself says the plan's dekking is untrustworthy while this holds.
    expect(melding).toHaveTextContent("Dekking onbekend");
    expect(melding).not.toHaveTextContent("1 doel gekoppeld");
  });

  it("shows the error state when the jaarplan cannot be loaded, not an endless spinner", async () => {
    // Regression: `rooster` is chained behind the schooljaarId the jaarplan returns, so while that id is
    // unknown the rooster query is DISABLED — and a disabled TanStack Query v5 query reports
    // `isPending === true`. With the pending guard placed before the error guard, a failed jaarplan fetch
    // showed "Jaarplan laden…" forever and the error copy was dead code. The realistic trigger is the only
    // way into this screen today: a teacher pastes a klas-id that does not exist and gets a 404.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );
    renderKalender();

    expect(await screen.findByText("Het jaarplan kon niet geladen worden.")).toBeInTheDocument();
    expect(screen.queryByText("Jaarplan laden…")).toBeNull();
  });

  it("keeps the board reachable by keyboard, since it scrolls sideways", async () => {
    stubFetch(maakJaarplan([maakPlaatsing({ id: "a", themaNaam: "Water" })]));
    renderKalender();
    await screen.findByText("Water");

    // The board is a horizontal scroll region with no focusable children yet (cards are inert until
    // E3-07), so without a tab stop a keyboard user cannot scroll the year sideways at all. This is what
    // axe's `scrollable-region-focusable` rule asks for, and jsdom cannot see overflow so axe will not
    // catch its removal here.
    expect(periodes()).toHaveAttribute("tabindex", "0");
  });

  it("does not count a rejected thema toward 'te vol', but still shows it", async () => {
    // Regression (E3-02 code review): a geweigerd placement survives regeneration and occupies its slot for
    // idempotency, but nothing is taught in that period because of it. Counting it pushed a period over the
    // te-vol threshold on the strength of a thema the teacher had thrown out.
    stubFetch(
      maakJaarplan([
        maakPlaatsing({ id: "a", themaNaam: "Water" }),
        maakPlaatsing({ id: "b", themaNaam: "Wonen" }),
        maakPlaatsing({ id: "c", themaNaam: "Weggegooid", status: "Geweigerd" }),
      ]),
    );
    renderKalender();

    await screen.findByText("Water");

    // Three placements in the block, but only two are planned — below the threshold of 3.
    // Scoped to the period list: "Te vol" also appears in the year spine's legend, which explains what the
    // colour means and is present regardless of whether any period is actually flagged.
    expect(within(periodes()).queryByText(/Te vol/)).toBeNull();

    // The rejected one is still visible: a teacher should see what they rejected, struck through by its badge.
    expect(screen.getByText("Weggegooid")).toBeInTheDocument();
    expect(screen.getByText("Geweigerd")).toBeInTheDocument();
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("reports the spreading measurement after a generation run, with no verdict attached", async () => {
    const resultaat: Generatieresultaat = {
      isGeslaagd: true,
      // E4-05: a whole-plan run, so nothing is out of scope and no period is named.
      buitenPeriode: [],
      geregenereerdePeriode: null,
      fout: null,
      // E3-03's outlook is asserted in Vooruitzichtoverzicht.test.tsx; null here renders no dekking block, which
      // keeps these assertions about the spreading report alone.
      vooruitzicht: null,
      jaarplan: null,
      aantalNieuw: 3,
      aantalBehouden: 1,
      aantalVervangen: 2,
      onbekendeThemas: ["Ruimtevaart"],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
      // E3-04 added this to the run report. `null` is the FAILURE shape; a successful run with no parameters
      // returns ParameterRapport.Geen, i.e. an object of empty lists (see the Geen-shaped case in
      // Generatieparameters.test.tsx). Either renders nothing, which is why this fixture is still valid.
      parameters: null,
      spreiding: {
        aantalBlokken: 2,
        aantalGebruikteBlokken: 1,
        blokken: [],
        legeBlokOrdinalen: [2],
        overbelasteBlokOrdinalen: [1],
        minsteDoelenInEenBlok: 11,
        meesteDoelenInEenBlok: 11,
      },
    };
    stubFetch(maakJaarplan([]), resultaat);
    renderKalender();

    fireEvent.click(await screen.findByRole("button", { name: "Jaarplan genereren…" }));

    expect(await screen.findByText("3 thema's voorgesteld.")).toBeInTheDocument();

    // FR-5.2's three measurements are surfaced.
    expect(screen.getByText("1 van 2 themaperiodes gebruikt.")).toBeInTheDocument();
    expect(screen.getByText("Nog leeg: themaperiode 2.")).toBeInTheDocument();   // singular ordinal
    // Named "te vol" here as well as on the board (E3-09): after the owner's ruling of 2026-07-31 these are one
    // signal, and this report used to call it "Te weinig weken" while the board called it "Te vol". Two names for one
    // problem reads as two problems.
    expect(
      screen.getByText(/Te vol, te weinig weken voor de geplande thema's: themaperiode 1\./),
    ).toBeInTheDocument();

    // Locked/decided placements survived, and the model's miss is named rather than swallowed (Art. IV.4).
    // Grammatical singular. The previous revision pinned "1 bestaande plaatsingen bleven staan", so the test
    // was actively protecting the bug — fixing the copy would have looked like a regression.
    expect(screen.getByText(/1 bestaande plaatsing bleef staan/)).toBeInTheDocument();

    // A run that discarded the previous proposal must say so; see the aantalVervangen assertions below.
    // "verdwenen" since E4-04: the report is E3-02's, but it describes the same event as the disclosure three lines
    // above it on the same card, and "vervangen" is false whenever the run places nothing back. On an empty answer a
    // teacher read "De AI stelde geen enkel thema voor." directly above "2 eerdere voorstellen zijn vervangen."
    expect(screen.getByText("2 eerdere voorstellen zijn verdwenen.")).toBeInTheDocument();
    expect(screen.getByText(/Ruimtevaart/)).toBeInTheDocument();

    // And it explicitly disclaims a judgement: no threshold is defined anywhere, so the tool must not imply one.
    expect(screen.getByText(/Wat een goede spreiding is, beslist de school/)).toBeInTheDocument();
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("toont de dekkingscijfers meteen na een geslaagde generatie, niet de verouderingsmelding", async () => {
    // **The regression test for the defect fix round 1 introduced** (antagonist round 2). The panel withholds its
    // measurements when the plan has changed since the run, compared by signature against `jaarplan.data`. But
    // `useGenereerJaarplan` only INVALIDATED that query, and TanStack keeps the previous data for the whole refetch —
    // so on the ordinary happy path the comparison ran against the PRE-generation plan, the signatures differed, and
    // the teacher who had just pressed Genereren and changed nothing was told "je hebt het jaarplan aangepast" while
    // every figure was hidden.
    //
    // The fix writes the response's own plan into the cache first, which is `usePlanMutatie`'s existing rule. This
    // test drives the real hook through the real component, so it fails if that write is ever removed.
    const naPlan = maakJaarplan([maakPlaatsing({ id: "p-nieuw" })]);
    const resultaat: Generatieresultaat = {
      isGeslaagd: true,
      // E4-05: a whole-plan run, so nothing is out of scope and no period is named.
      buitenPeriode: [],
      geregenereerdePeriode: null,
      fout: null,
      jaarplan: naPlan,
      aantalNieuw: 1,
      aantalBehouden: 0,
      aantalVervangen: 0,
      onbekendeThemas: [],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
      parameters: null,
      spreiding: null,
      vooruitzicht: {
        bereik: "EigenJaarFase",
        gemetenJaarFasen: ["L3"],
        isTerugvalNaarHeelCurriculum: false,
        aantalBuitenBereik: 0,
        isBetrouwbaar: true,
        aantalOnopgelosteVervallenPlaatsingen: 0,
        aantalGedekt: 0,
        aantalMogelijkGedekt: 4,
        aantalLeerplandoelen: 9,
        aantalOnbereikbaar: 5,
      },
    };

    // **The refetch is held open, and that is what makes this test discriminating.** The defect lives in exactly the
    // window between "the run succeeded" and "the invalidated query has come back": TanStack keeps the previous data
    // for that whole window, so a comparison against `jaarplan.data` sees the PRE-generation plan. Let the refetch
    // resolve immediately, as an ordinary stub does, and `findByText` simply waits the window out — the first version
    // of this test did exactly that and passed with the fix REMOVED, which is the tautology this comment exists to
    // stop coming back.
    //
    // So the post-run GET blocks until the test releases it. With the fix the figures are on screen before that
    // happens, because the response's own plan was written into the cache at success. Without it, they cannot be:
    // the panel shows the stale notice for as long as the refetch is held.
    let isGegenereerd = false;
    let laatRefetchDoor: () => void = () => {};
    const refetchGeblokkeerd = new Promise<void>((resolve) => {
      laatRefetchDoor = resolve;
    });

    stubFetch(maakJaarplan([]), resultaat);
    const gestubdeFetch = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const origineel = gestubdeFetch.getMockImplementation()!;
    gestubdeFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.includes("/generatie")) {
        isGegenereerd = true;
        return new Response(JSON.stringify(resultaat), { status: 200 });
      }
      if (isGegenereerd && url.includes("/jaarplan") && !url.includes("/parameters")) {
        await refetchGeblokkeerd;

        return new Response(JSON.stringify(naPlan), { status: 200 });
      }

      return origineel(input, init);
    });

    renderKalender();

    fireEvent.click(await screen.findByRole("button", { name: "Jaarplan genereren…" }));

    expect(await screen.findByText("Nu gedekt: 0 van 9.")).toBeInTheDocument();
    expect(screen.getByText("Als je alle voorstellen aanvaardt: 4 van 9.")).toBeInTheDocument();
    expect(screen.getByText("Ook dan nog niet gedekt: 5.")).toBeInTheDocument();
    expect(screen.queryByText(/kloppen niet meer/)).not.toBeInTheDocument();

    // Released so the refetch can finish inside the test rather than after it, which would leave a pending promise
    // updating state on an unmounted tree.
    laatRefetchDoor();
    await screen.findByText("Nu gedekt: 0 van 9.");
  });

  /**
   * The **derivation** of `verouderingsreden`, as opposed to its presentation (antagonist round 4).
   *
   * `Spreidingsoverzicht.test.tsx` pins what the panel renders for a given `verouderd` prop. That is the easy half.
   * The half that has produced a MAJOR in two consecutive rounds is the ternary in this component that decides the
   * prop's value, and until round 4 the only test touching it asserted the notice's **absence** on the happy path.
   * These three drive the real hooks and the real fetches.
   */
  function maakVooruitzicht(gemetenJaarFasen: string[]) {
    return {
      bereik: "EigenJaarFase" as const,
      gemetenJaarFasen,
      isTerugvalNaarHeelCurriculum: false,
      aantalBuitenBereik: 0,
      isBetrouwbaar: true,
      aantalOnopgelosteVervallenPlaatsingen: 0,
      aantalGedekt: 0,
      aantalMogelijkGedekt: 4,
      aantalLeerplandoelen: 9,
      aantalOnbereikbaar: 5,
    };
  }

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("meldt verouderde metingen wanneer een AL MANUELE plaatsing naar een andere periode verhuist", async () => {
    // **Round 3's MAJOR 1, end to end.** The signature used to be blind to `blokStart` on the argument that a move
    // sets the status to `Manueel` — which is a no-op for a placement that is already `Manueel`, i.e. every kept hand
    // placement. The panel then went on printing this run's spreading and dekking over a board that had moved.
    // Nothing but position differs between the two plans here, so this test fails the moment `blokStart` leaves the
    // signature again.
    const naPlan = maakJaarplan([
      maakPlaatsing({ id: "p1", status: "Manueel", blokStart: "2026-09-01", blokOrdinaal: 1 }),
    ]);
    const verplaatst = maakJaarplan([
      maakPlaatsing({ id: "p1", status: "Manueel", blokStart: "2026-11-09", blokOrdinaal: 2 }),
    ]);
    const resultaat: Generatieresultaat = {
      isGeslaagd: true,
      // E4-05: a whole-plan run, so nothing is out of scope and no period is named.
      buitenPeriode: [],
      geregenereerdePeriode: null,
      fout: null,
      jaarplan: naPlan,
      aantalNieuw: 1,
      aantalBehouden: 0,
      aantalVervangen: 0,
      onbekendeThemas: [],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
      parameters: null,
      spreiding: null,
      vooruitzicht: maakVooruitzicht(["L3"]),
    };

    let isGegenereerd = false;
    stubFetch(maakJaarplan([]), resultaat);
    const gestubdeFetch = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const origineel = gestubdeFetch.getMockImplementation()!;
    gestubdeFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.includes("/generatie")) {
        isGegenereerd = true;
        return new Response(JSON.stringify(resultaat), { status: 200 });
      }
      // The refetch answers the MOVED plan, which is what a colleague's edit or a drag looks like from here.
      if (isGegenereerd && url.includes("/jaarplan") && !url.includes("/parameters")) {
        return new Response(JSON.stringify(verplaatst), { status: 200 });
      }

      return origineel(input, init);
    });

    renderKalender();
    fireEvent.click(await screen.findByRole("button", { name: "Jaarplan genereren…" }));

    expect(
      await screen.findByText(/Je hebt het jaarplan aangepast na deze generatie/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Nu gedekt/)).not.toBeInTheDocument();
  });

  // Skipped: the kleuterjaar-chooser (Jaarfasekiezer) was removed from this screen for the 2026-08-21 demo.
  it.skip("meldt een ander gemeten jaar wanneer de leerkracht de kleuterjaarkiezer na de run verzet", async () => {
    // The second reason, and it needs its own sentence: "je hebt het jaarplan aangepast" is false here. The plan is
    // untouched; the DENOMINATOR moved, which is the two-denominator state in a second guise.
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const resultaat: Generatieresultaat = {
      isGeslaagd: true,
      // E4-05: a whole-plan run, so nothing is out of scope and no period is named.
      buitenPeriode: [],
      geregenereerdePeriode: null,
      fout: null,
      jaarplan: plan,
      aantalNieuw: 1,
      aantalBehouden: 0,
      aantalVervangen: 0,
      onbekendeThemas: [],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
      parameters: null,
      spreiding: null,
      vooruitzicht: maakVooruitzicht(["JK", "K2", "K3"]),
    };

    stubFetch(plan, resultaat, {
      ...DEKKING_NIETS_ONTBREEKT,
      gemetenJaarFasen: ["JK", "K2", "K3"],
      beschikbareJaarFasen: ["JK", "K2", "K3"],
      aantalGedekt: 4,
      aantalLeerplandoelen: 45,
    });

    renderKalender();
    // `hergenereer`, not `genereer`: this fixture holds a placement, so from E4-04 the trigger names itself a
    // regeneration (FR-8.1). The run this test drives and everything it asserts are unchanged.
    await drukHergenereer();
    expect(await screen.findByText("Nu gedekt: 0 van 9.")).toBeInTheDocument();

    // Narrow to one kleuterjaar AFTER the run. The plan does not change; what the figures are over does.
    //
    // `findByRole`, not `getByRole`, and the reason is worth recording: a successful run DROPS the live dekking cache
    // (E4-01), and the chooser's second gate USED TO read `aantalLeerplandoelen` off that query rather than off the
    // latch, so the control really did disappear for the length of the refetch and came back. *Since E9-06 latched that
    // gate too it no longer does, and `findByRole` is kept here only because the FIGURE below still arrives late.* The
    // latch two blocks up in the component was added to stop
    // exactly that flicker for the codes; the gate defeats it for the figure. Self-healing, pre-existing and outside
    // this story, but a test that used `getByRole` here would fail intermittently and look like a flake.
    const kiezer = await screen.findByRole("group", { name: t("dekking.jaarFaseLabel") });
    fireEvent.click(within(kiezer).getByRole("button", { name: "K3" }));

    expect(await screen.findByText(/Je meet nu tegen een ander jaar/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Je hebt het jaarplan aangepast na deze generatie/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Nu gedekt/)).not.toBeInTheDocument();
  });

  // Skipped: the kleuterjaar-chooser (Jaarfasekiezer) was removed from this screen for the 2026-08-21 demo.
  it.skip("meldt GEEN ander gemeten jaar zolang de tool niet weet welke jaren deze klas heeft", async () => {
    // The round-3 guard, and the reason it exists. `beschikbareJaarFasen` is latched from the first /dekking answer,
    // so it is `[]` until that lands — and permanently `[]` if the call keeps failing. Comparing `[]` against a
    // server that reported `["L3"]` mismatches, so the panel told a teacher they had changed the measured year while
    // they had changed nothing and had no chooser on screen to change it with, and suppressed the whole report.
    // When the current scope is unknown, "not stale" is the honest answer.
    const plan = maakJaarplan([maakPlaatsing({ id: "p1" })]);
    const resultaat: Generatieresultaat = {
      isGeslaagd: true,
      // E4-05: a whole-plan run, so nothing is out of scope and no period is named.
      buitenPeriode: [],
      geregenereerdePeriode: null,
      fout: null,
      jaarplan: plan,
      aantalNieuw: 1,
      aantalBehouden: 0,
      aantalVervangen: 0,
      onbekendeThemas: [],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
      parameters: null,
      spreiding: null,
      vooruitzicht: maakVooruitzicht(["L3"]),
    };

    // A coverage answer that names no available jaar/fasen at all, so the latch never fills.
    stubFetch(plan, resultaat, { ...DEKKING_NIETS_ONTBREEKT, beschikbareJaarFasen: [] });

    renderKalender();
    // `hergenereer`, not `genereer`: this fixture holds a placement, so from E4-04 the trigger names itself a
    // regeneration (FR-8.1). The run this test drives and everything it asserts are unchanged.
    await drukHergenereer();

    expect(await screen.findByText("Nu gedekt: 0 van 9.")).toBeInTheDocument();
    expect(screen.queryByText(/Je meet nu tegen een ander jaar/)).not.toBeInTheDocument();
    expect(screen.queryByText(/kloppen niet meer/)).not.toBeInTheDocument();
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("shows Dutch copy on a 422 and never echoes the English diagnostic", async () => {
    stubFetch(maakJaarplan([]), 422);
    renderKalender();

    fireEvent.click(await screen.findByRole("button", { name: "Jaarplan genereren…" }));

    const melding = await screen.findByRole("alert");
    expect(melding).toHaveTextContent("De AI gaf geen bruikbaar antwoord");
    // It must also reassure that nothing changed -- Art. IV.5 persists nothing on a bad response.
    expect(melding).toHaveTextContent("niets gewijzigd");

    // The backend's English operator diagnostic must not reach the teacher.
    expect(screen.queryByText(/Malformed JSON/)).toBeNull();
    expect(screen.queryByText(/Invalid AI response/)).toBeNull();
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("distinguishes an unconfigured tool from a bad AI answer", async () => {
    // With no AzureAI:ApiKey the client throws and this surfaces as a 500. Telling the teacher "de AI gaf geen
    // bruikbaar antwoord" would blame the model for a configuration fault and invite a pointless retry loop.
    stubFetch(maakJaarplan([]), 500);
    renderKalender();

    fireEvent.click(await screen.findByRole("button", { name: "Jaarplan genereren…" }));

    const melding = await screen.findByRole("alert");
    expect(melding).toHaveTextContent("nu niet beschikbaar");
    expect(melding).toHaveTextContent("niets gewijzigd");
    expect(melding).not.toHaveTextContent("geen bruikbaar antwoord");
  });

  /**
   * The spreiding report in the **singular**, which is the plural guard's first real catch (antagonist round 2).
   *
   * `kalender.spreidingBlokken` read *"{gebruikt} van {totaal} themaperiodes gebruikt"* and had no singular, so a year
   * deriving one themaperiode printed *"1 van 1 themaperiodes gebruikt"*. It is pre-existing — E3-02 authored it — and it
   * escaped `catalogus.test.ts` for as long as that guard found counts by placeholder NAME. The fix round added the
   * singular and rendered it through `tAantal`; **this test is what stops the call site regressing**, because the guard
   * only proves a singular EXISTS, never that anything calls it, so reverting to `t(...)` would leave the suite green.
   */
  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("uses the singular when the year derives a single themaperiode", async () => {
    const resultaat: Generatieresultaat = {
      isGeslaagd: true,
      // E4-05: a whole-plan run, so nothing is out of scope and no period is named.
      buitenPeriode: [],
      geregenereerdePeriode: null,
      fout: null,
      // E3-03's outlook is asserted in Vooruitzichtoverzicht.test.tsx; null here renders no dekking block, which
      // keeps these assertions about the spreading report alone.
      vooruitzicht: null,
      jaarplan: null,
      aantalNieuw: 1,
      aantalBehouden: 0,
      aantalVervangen: 0,
      onbekendeThemas: [],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
      parameters: null,
      spreiding: {
        aantalBlokken: 1,
        aantalGebruikteBlokken: 1,
        blokken: [],
        legeBlokOrdinalen: [],
        overbelasteBlokOrdinalen: [],
        minsteDoelenInEenBlok: 2,
        meesteDoelenInEenBlok: 2,
      },
    };
    stubFetch(maakJaarplan([]), resultaat);
    renderKalender();

    fireEvent.click(await screen.findByRole("button", { name: "Jaarplan genereren…" }));

    expect(await screen.findByText("1 van 1 themaperiode gebruikt.")).toBeInTheDocument();
    // And the ungrammatical form is not on screen.
    expect(screen.queryByText(/themaperiodes gebruikt/)).toBeNull();
  });

  it("has no axe violations on a POPULATED plan", async () => {
    // Populated deliberately. An earlier revision ran axe over `maakJaarplan([])` — an empty ribbon with
    // no card, no badge, no lock and no alert, i.e. none of the components most likely to carry a
    // violation. This renders a te-vol period, a locked accepted card, a motivation and the stale alert.
    stubFetch(
      maakJaarplan([
        maakPlaatsing({ id: "a", themaNaam: "Water", doelcodes: ["A-1", "A-2"] }),
        maakPlaatsing({ id: "b", themaNaam: "Wonen", status: "Aanvaard", vergrendeld: true }),
        maakPlaatsing({ id: "c", themaNaam: "Gezond eten", status: "Manueel" }),
        maakPlaatsing({
          id: "d",
          themaNaam: "Feesten in december",
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
        }),
      ]),
    );
    const { container } = renderKalender();

    await screen.findByText("Water");
    // Premises for this test's reach: the te-vol flag and the stale notice are actually on screen.
    expect(within(periodes()).getByText(/Te vol/)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: t("kalender.herzienTitelEnkelvoud") }),
    ).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * E3-07: moving a thema between periods (FR-6.2), taking one out of a period (FR-7), and reversing a
 * rejection.
 *
 * Driven through the **accessible** route rather than a synthetic drag. `jsdom` gives every element a
 * zero-sized bounding rect, and dnd-kit resolves a drop by measuring rectangles, so a simulated drop lands
 * nowhere: a green "drag test" here would prove only that the harness ran. The period picker performs the same
 * mutation through the same hook against the same endpoint, so what these tests pin is the contract the drop
 * shares with it — which request goes out, with which body, and what the teacher sees when it is refused. The
 * gesture itself is verified in a browser, and that is stated rather than implied.
 */
/**
 * One thema's card, so a query cannot pick up a control belonging to a different card.
 *
 * Hoisted to module scope by E4-02, together with {@link aanpassen} and {@link stubBewerking}: the decision-surface
 * tests below need the same three helpers, and a second copy of a fetch stub is a second place for the routing
 * order to drift.
 */
function kaart(themaNaam: string): HTMLElement {
  const article = screen.getByText(themaNaam).closest("article");
  if (!article) {
    throw new Error(`No card found for "${themaNaam}".`);
  }

  return article as HTMLElement;
}

/** The "Aanpassen" disclosure on one card. */
function aanpassen(themaNaam: string) {
  return within(kaart(themaNaam)).getByRole("button", {
    name: t("kalender.aanpassenLabel", { thema: themaNaam }),
  });
}

/**
 * Serves the reads and records every write, answering each write with `naPlan` so the board re-renders from
 * the response, exactly as it does against the real API.
 */
/**
 * A stub for the placement writes.
 *
 * **`dekking` is optional and, when omitted, deliberately NOT routed.** Most tests here are about the write and its
 * effect on the board, and leaving the coverage reads to 404 keeps them out of the assertions. Pass it when the test is
 * about something that depends on the figure -- the kleuterjaar chooser, for instance, which only exists for a class
 * with more than one code to choose between.
 */
function stubBewerking(
  plan: Jaarplan,
  naPlan: Jaarplan = plan,
  mislukStatus?: number,
  dekking?: Record<string, unknown>,
  dekkingVertraging = 0,
) {
  const verzoeken: { method: string; url: string; body: unknown }[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method !== "GET") {
        verzoeken.push({
          method,
          url,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        if (mislukStatus !== undefined) {
          return new Response(
            JSON.stringify({ title: "Ongeldige aanvraag", detail: "geen periodegrens" }),
            { status: mislukStatus },
          );
        }

        return new Response(JSON.stringify(naPlan), { status: 200 });
      }

      if (url.includes("/api/themas")) {
        return new Response(JSON.stringify([{ id: "t0", naam: "Herfst" }]), { status: 200 });
      }
      // Routed before /jaarplan, whose URL it extends. See the note in the stub above.
      if (url.includes("/jaarplan/parameters")) {
        return new Response(
          JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }),
          { status: 200 },
        );
      }
      // Only when the test asked for it, and the longer path first: `/dekking/voortgang` extends `/dekking`.
      //
      // `dekkingVertraging` makes the refetch window WIDE enough to observe. Without it the stub answers within the same
      // microtask queue, so the interval in which a coverage read has been cleared and not yet answered is too short for
      // any assertion to land inside -- which is exactly why the chooser flicker went unpinned. Same device E4-01 used
      // in the browser, where it slowed the dekking read by three seconds to make the stale window look-at-able.
      if (dekking !== undefined && url.includes("/dekking")) {
        if (dekkingVertraging > 0) {
          await new Promise((klaar) => setTimeout(klaar, dekkingVertraging));
        }

        return new Response(
          JSON.stringify(url.includes("/dekking/voortgang") ? voortgangUit(dekking) : dekking),
          { status: 200 },
        );
      }
      if (url.includes("/rooster")) {
        return new Response(JSON.stringify(rooster), { status: 200 });
      }
      if (url.includes("/jaarplan")) {
        return new Response(JSON.stringify(plan), { status: 200 });
      }

      return new Response("unexpected request", { status: 404 });
    }),
  );

  return verzoeken;
}

describe("Jaarplankalender — verplaatsen en verwijderen (E3-07)", () => {
  it("moves a thema to the chosen period and keys the request on the block START DATE", async () => {
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const verzoeken = stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    // Period 2 is offered; period 1, the one it already sits in, is not — that move is a no-op server-side,
    // and offering it invites a click that does nothing.
    const keuze = within(kaart("Water")).getByLabelText(t("kalender.verplaatsNaar"));
    expect(within(keuze).getByRole("option", { name: /Themaperiode 2/ })).toBeInTheDocument();
    expect(within(keuze).queryByRole("option", { name: /Themaperiode 1/ })).toBeNull();

    fireEvent.change(keuze, { target: { value: "2026-11-09" } });
    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.verplaatsen") }));

    await waitFor(() => expect(verzoeken).toHaveLength(1));

    // **The load-bearing assertion of this story.** A placement keys on the block's start date, never on its
    // ordinal (ADR-0020 §3): the ordinal is a display position that re-points when the school edits a
    // vakantie, so sending one would silently relocate the thema later. Deep equality rather than a property
    // check, so an `ordinaal` added to this payload in future fails here instead of passing quietly.
    expect(verzoeken[0].method).toBe("PUT");
    expect(verzoeken[0].url).toMatch(/\/jaarplan\/plaatsingen\/p1\/blok$/);
    expect(verzoeken[0].body).toEqual({ blokStart: "2026-11-09" });
  });

  it("offers every period for a stale placement, because it sits in none", async () => {
    const plan = maakJaarplan([
      maakPlaatsing({
        id: "p9",
        themaNaam: "Feesten in december",
        blokStart: "2026-12-01",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Aanvaard",
      }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Feesten in december");
    fireEvent.click(aanpassen("Feesten in december"));

    const keuze = screen.getByLabelText(t("kalender.verplaatsNaar"));
    expect(within(keuze).getByRole("option", { name: /Themaperiode 1/ })).toBeInTheDocument();
    expect(within(keuze).getByRole("option", { name: /Themaperiode 2/ })).toBeInTheDocument();

    // Nothing is pre-selected. Clause 1 of the directie ruling is that the application never chooses a period
    // for a stale placement, and a default here would be exactly that guess, made by the UI.
    expect((keuze as HTMLSelectElement).value).toBe("");
  });

  it("removes an untouched AI proposal on one click, with no confirmation", async () => {
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const verzoeken = stubBewerking(plan, maakJaarplan([]));
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));
    fireEvent.click(
      within(kaart("Water")).getByRole("button", { name: t("kalender.uitPeriodeHalen") }),
    );

    // Straight to the DELETE: a standing proposal costs nothing to discard, because regeneration can propose
    // it again. The confirmation is reserved for work that cannot be recovered.
    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(verzoeken[0].method).toBe("DELETE");
    expect(verzoeken[0].url).toMatch(/\/jaarplan\/plaatsingen\/p1$/);
  });

  it.each([
    ["an accepted", { status: "Aanvaard" as const, vergrendeld: false }],
    ["a locked", { status: "Voorgesteld" as const, vergrendeld: true }],
  ])(
    "makes removing %s placement confirm first, naming the thema and the period",
    async (_soort, eigenschappen) => {
      const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water", ...eigenschappen })]);
      const verzoeken = stubBewerking(plan, maakJaarplan([]));
      renderKalender();

      await screen.findByText("Water");
      fireEvent.click(aanpassen("Water"));
      fireEvent.click(
        within(kaart("Water")).getByRole("button", { name: t("kalender.uitPeriodeHalen") }),
      );

      // Nothing has gone yet. This confirmation is the ONLY protection for decided or locked teacher work in
      // a codebase with no soft delete and no audit trail, so that it fires at all is the assertion.
      expect(verzoeken).toHaveLength(0);

      // The question names BOTH the thema and the period: specificity is what makes an endpoint that ignores
      // status and lock safe to expose, per the E3-01 audit that assigned this obligation.
      expect(
        within(kaart("Water")).getByText(
          t("kalender.verwijderVraag", { thema: "Water", ordinaal: 1 }),
        ),
      ).toBeInTheDocument();

      // Cancelling is genuinely non-destructive, and the guarded control comes back rather than vanishing.
      fireEvent.click(
        within(kaart("Water")).getByRole("button", { name: t("kalender.annuleren") }),
      );
      expect(verzoeken).toHaveLength(0);

      // Confirming does delete.
      fireEvent.click(
        within(kaart("Water")).getByRole("button", { name: t("kalender.uitPeriodeHalen") }),
      );
      fireEvent.click(
        within(kaart("Water")).getByRole("button", { name: t("kalender.verwijderBevestig") }),
      );

      await waitFor(() => expect(verzoeken).toHaveLength(1));
      expect(verzoeken[0].method).toBe("DELETE");
    },
  );

  it("refuses to move a REJECTED placement, because that would grant it dekking", async () => {
    // The story built an explicit, explained control for reversing a rejection — and a drag did the same
    // transition silently. It is the one transition here with an Art. V.1 consequence: only aanvaard/manueel
    // placements count as placed, so a sideways nudge would flip a thema from "not taught" to "taught" in the
    // figure an onderwijsinspectie is shown. Caught by the E3-07 antagonist audit.
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Geweigerd" }),
    ]);
    const verzoeken = stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    // No picker at all, and the reason is on screen rather than left to a failed attempt.
    expect(within(kaart("Water")).queryByLabelText(t("kalender.verplaatsNaar"))).toBeNull();
    expect(
      within(kaart("Water")).getByText(t("kalender.weigeringEerstTerugdraaien")),
    ).toBeInTheDocument();

    // No drag grip either: a grip whose every drop is refused is a control that does nothing.
    expect(kaart("Water").querySelector('span[role="presentation"]')).toBeNull();

    // The explained route out is still offered, and it is the only thing that fires a request.
    fireEvent.click(
      within(kaart("Water")).getByRole("button", { name: t("kalender.weigeringTerugdraaien") }),
    );
    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(verzoeken[0].url).toMatch(/\/status$/);
  });

  it("discloses that a move is not reversible, before the move", async () => {
    // The first version justified leaving a move unconfirmed on the grounds it was reversible. It is not:
    // moving back restores the date only, while the AI motivation and any `Aanvaard` decision are gone.
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    expect(within(kaart("Water")).getByText(t("kalender.verplaatsGevolg"))).toBeInTheDocument();
  });

  it("does not warn about losing something a card has nothing to lose", async () => {
    // A warning that does not apply is how teachers learn to ignore warnings: an already-manual placement with
    // no motivation loses nothing a move could take.
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Manueel", aiMotivatie: null }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    expect(within(kaart("Water")).queryByText(t("kalender.verplaatsGevolg"))).toBeNull();
    // The picker is still there — this is about the warning, not the action.
    expect(within(kaart("Water")).getByLabelText(t("kalender.verplaatsNaar"))).toBeInTheDocument();
  });

  it("names the stored date when confirming the delete of a STALE placement", async () => {
    // The unique index is (JaarplanId, ThemaId, BlokNiveau, BlokStart), so the same thema can be stale at two
    // vanished dates. Without the date both cards would raise a byte-identical question for two different
    // unrecoverable deletions — the exact failure the "name the thema and the period" clause guards against.
    const plan = maakJaarplan([
      maakPlaatsing({
        id: "p1",
        themaNaam: "Feesten",
        blokStart: "2026-12-01",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Aanvaard",
      }),
      maakPlaatsing({
        id: "p2",
        themaNaam: "Feesten",
        blokStart: "2027-01-11",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Aanvaard",
      }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await waitFor(() => expect(screen.getAllByText("Feesten")).toHaveLength(2));

    const kaarten = screen.getAllByText("Feesten").map((h) => h.closest("article") as HTMLElement);
    for (const kaartEl of kaarten) {
      fireEvent.click(
        within(kaartEl).getByRole("button", {
          name: t("kalender.aanpassenLabel", { thema: "Feesten" }),
        }),
      );
      fireEvent.click(
        within(kaartEl).getByRole("button", { name: t("kalender.uitJaarplanHalen") }),
      );
    }

    const vragen = kaarten.map(
      (kaartEl) =>
        [...kaartEl.querySelectorAll("p")].find((p) => p.getAttribute("role") === "alert")
          ?.textContent ?? "",
    );

    // Both name a date, and the two questions differ — which is the whole point.
    expect(vragen[0]).toContain("1 dec");
    expect(vragen[1]).toContain("11 jan");
    expect(vragen[0]).not.toEqual(vragen[1]);
  });

  it("tells an unavailable tool apart from a refused move", async () => {
    // A 500 with "kies een periode uit dit jaarplan" sends the teacher round a loop that cannot succeed. The
    // generation panel already makes this split; the move path was making the mistake that panel warns about.
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    stubBewerking(plan, plan, 500);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));
    fireEvent.change(within(kaart("Water")).getByLabelText(t("kalender.verplaatsNaar")), {
      target: { value: "2026-11-09" },
    });
    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.verplaatsen") }));

    expect(await screen.findByText(t("kalender.verplaatsOnbeschikbaar"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.verplaatsMislukt"))).toBeNull();
  });

  it("lets a teacher reverse a rejection", async () => {
    // E3-01 discovered that `Geweigerd` makes a placement non-replaceable, so a rejection survived every
    // regeneration with no undo: reject a thema in a period, change your mind, stuck. E3-07 owns the way back.
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Geweigerd" })]);
    const naPlan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Manueel" })]);
    const verzoeken = stubBewerking(plan, naPlan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));
    fireEvent.click(
      within(kaart("Water")).getByRole("button", { name: t("kalender.weigeringTerugdraaien") }),
    );

    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(verzoeken[0].method).toBe("PUT");
    expect(verzoeken[0].url).toMatch(/\/plaatsingen\/p1\/status$/);

    // `Manueel`, not `Aanvaard`: the thema is in this period because the teacher put it back there. And never
    // `Voorgesteld`, which the server refuses with a 400 because only the AI produces it.
    expect(verzoeken[0].body).toEqual({ status: "Manueel" });
  });

  it("has no axe violations with an edit panel OPEN and its confirmation showing", async () => {
    // The panel and the confirm question are the only parts of this feature that are not on screen at rest,
    // so the existing axe pass over the board says nothing about them — exactly the gap that let two
    // violations through in E3-06. Note what axe here can and cannot see: it checks the select's label
    // association, the disclosure's aria-expanded/aria-controls pairing and the alert's role, but `jsdom`
    // cannot evaluate colour, so nothing here covers contrast. That is measured in a browser.
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard", vergrendeld: true }),
      maakPlaatsing({ id: "p2", themaNaam: "Wonen", status: "Geweigerd" }),
    ]);
    stubBewerking(plan);
    const { container } = renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));
    fireEvent.click(aanpassen("Wonen"));

    // Put the guarded card into its confirmation state, so the question is in the tree too.
    fireEvent.click(
      within(kaart("Water")).getByRole("button", { name: t("kalender.uitPeriodeHalen") }),
    );

    // Premises, so this cannot pass by rendering nothing new.
    expect(within(kaart("Water")).getByRole("button", { name: t("kalender.verwijderBevestig") }))
      .toBeInTheDocument();
    expect(
      within(kaart("Wonen")).getByRole("button", { name: t("kalender.weigeringTerugdraaien") }),
    ).toBeInTheDocument();
    // E4-06's control is in the tree too: "Water" is locked, so the panel offers "Losmaken".
    expect(
      within(kaart("Water")).getByRole("button", { name: t("kalender.ontgrendelen") }),
    ).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("locks an AI proposal and unlocks it again, keying the request on the placement", async () => {
    // E4-06 / FR-8.4. Before this the `vergrendeld` flag could only ever be false in a real app: `api.ts` never
    // called the endpoint, so the "Vast" badge was unreachable state and the story had no invocation surface.
    const vrij = maakPlaatsing({ id: "p1", themaNaam: "Water" });
    const vast = maakPlaatsing({ id: "p1", themaNaam: "Water", vergrendeld: true });

    const verzoeken = stubBewerking(maakJaarplan([vrij]), maakJaarplan([vast]));
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    // Not locked yet, so the card carries no badge and the panel offers the lock.
    expect(within(kaart("Water")).queryByText(t("kalender.vergrendeld"))).toBeNull();
    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.vergrendelen") }));

    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(verzoeken[0].method).toBe("PUT");
    expect(verzoeken[0].url).toMatch(/\/jaarplan\/plaatsingen\/p1\/vergrendeling$/);
    expect(verzoeken[0].body).toEqual({ vergrendeld: true });

    // The board re-renders from the server's returned plan, so the state a teacher sees is the persisted one and
    // never an optimistic guess: the badge appears and the control becomes its own inverse.
    expect(await within(kaart("Water")).findByText(t("kalender.vergrendeld"))).toBeInTheDocument();
    const losmaken = within(kaart("Water")).getByRole("button", { name: t("kalender.ontgrendelen") });
    expect(within(kaart("Water")).queryByRole("button", { name: t("kalender.vergrendelen") })).toBeNull();

    // And back: the round trip is what makes the state producible AND undoable, so no teacher can strand a card.
    fireEvent.click(losmaken);
    await waitFor(() => expect(verzoeken).toHaveLength(2));
    expect(verzoeken[1].body).toEqual({ vergrendeld: false });
  });

  it("does not offer a lock on a placement that already survives a regeneration", async () => {
    // **The design decision of this story.** `IsVervangbaar` is `Voorgesteld && !vergrendeld`, so an accepted or
    // manual placement survives a run with no lock at all — a "Vastzetten" button there would change nothing
    // observable, which is the E3-06 control-that-does-nothing in a new coat. The compensating obligation is that
    // the panel must then SAY the thema survives, because the inverse silence is the worse lie: an accepted card
    // with no "Vast" badge otherwise reads as disposable and invites pointless locking.
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
      maakPlaatsing({ id: "p2", themaNaam: "Wonen", status: "Manueel", aiMotivatie: null }),
    ]);
    const verzoeken = stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");

    for (const thema of ["Water", "Wonen"]) {
      fireEvent.click(aanpassen(thema));
      expect(
        within(kaart(thema)).queryByRole("button", { name: t("kalender.vergrendelen") }),
      ).toBeNull();
      expect(within(kaart(thema)).getByText(t("kalender.vergrendelNietNodig"))).toBeInTheDocument();
    }

    // Nothing was sent: this is an absence of a control, not a control that quietly fails.
    expect(verzoeken).toHaveLength(0);
  });

  it("still lets a locked placement be unlocked after it has been accepted", async () => {
    // Reachable in practice: lock a proposal, then accept it. If the control were gated purely on `Voorgesteld`
    // the lock would become permanent, and a state a teacher produced and cannot undo is worse than an inert one.
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard", vergrendeld: true }),
    ]);
    const verzoeken = stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.ontgrendelen") }));
    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(verzoeken[0].body).toEqual({ vergrendeld: false });
  });

  it.each([["Aanvaard"] as const, ["Manueel"] as const])(
    "tells a %s AND locked card that the lock is redundant and that losmaken will not free it",
    async (status) => {
      // **The false-claim finding of the round-1 audit.** The section decided *whether* to render on
      // `(status, vergrendeld)` but *which sentence* on `vergrendeld` alone, so every locked non-`Voorgesteld`
      // card read "een hergeneratie laat het staan, DUS het staat vast" and invited a "Losmaken" that frees
      // nothing: `IsVervangbaar` needs `Voorgesteld`, so unlocking a decided placement leaves it unreplaceable,
      // and the panel then flipped to `vergrendelNietNodig`, contradicting the sentence that invited the click.
      //
      // Reachable in two clicks and not a contrived state: lock a proposal, then move it. `VerplaatsNaar` sets
      // `Manueel` and deliberately keeps the lock.
      const plan = maakJaarplan([
        maakPlaatsing({ id: "p1", themaNaam: "Water", status, vergrendeld: true }),
      ]);
      stubBewerking(plan);
      renderKalender();

      await screen.findByText("Water");
      fireEvent.click(aanpassen("Water"));

      const paneel = within(kaart("Water"));

      // The copy asserted, not just the request: that is what the round-1 test omitted.
      expect(paneel.getByText(t("kalender.vergrendelUitlegBeslistVast"))).toBeInTheDocument();
      expect(paneel.queryByText(t("kalender.vergrendelUitlegVast"))).toBeNull();
      expect(paneel.queryByText(t("kalender.vergrendelUitlegVrij"))).toBeNull();
      expect(paneel.queryByText(t("kalender.vergrendelNietNodig"))).toBeNull();

      // No dekking sentence here: it says this thema "staat nog als AI-voorstel", and this placement is not one
      // any more.
      expect(paneel.queryByText(t("kalender.vergrendelDekking"))).toBeNull();

      // And the control is still there, so the lock stays undoable.
      expect(paneel.getByRole("button", { name: t("kalender.ontgrendelen") })).toBeInTheDocument();

      // Not the rejected card's sentence: that one says the *weigering* is doing the work, which would be false
      // about a thema the teacher accepted or moved.
      expect(paneel.queryByText(t("kalender.vergrendelUitlegGeweigerdVast"))).toBeNull();
    },
  );

  it.each([[false], [true]])(
    "tells a REJECTED and locked card that the weigering does the work, not the lock (isVervallen=%s)",
    async (isVervallen) => {
      // **The MAJOR of the round-2 audit.** A rejected + locked card fell into the `!isVoorstel` branch and got
      // `vergrendelUitlegBeslistVast`, which opens "Je hebt dit thema zelf beslist, dus … het blijft staan" — and
      // what the teacher decided about this thema was *no*. The second half of that sentence is true, which is
      // exactly what made it a true-looking sentence about the opposite decision. When stale it got
      // `vergrendelUitlegVervallen` instead, whose "kies eerst een periode" pointed at a picker that is
      // suppressed for a rejected card.
      //
      // *That description of reachability is now out of date, and the update is the point (E4-02).* It read: "not
      // reachable from the UI today (nothing here sets `Geweigerd`), and two clicks away the moment E4-01/E4-02 ship
      // a reject control." E4-02 shipped it. `Geweigerd` is now one press on the card face, so this state is a
      // teacher-reachable state rather than an API-only one — which is what makes the parameterised case below
      // worth having rather than defensive.
      const plan = maakJaarplan([
        maakPlaatsing({
          id: "p1",
          themaNaam: "Water",
          status: "Geweigerd",
          vergrendeld: true,
          ...(isVervallen ? { blokEind: null, blokOrdinaal: null, isVervallen: true } : {}),
        }),
      ]);
      const verzoeken = stubBewerking(plan);
      renderKalender();

      await screen.findByText("Water");
      fireEvent.click(aanpassen("Water"));

      const paneel = within(kaart("Water"));

      expect(paneel.getByText(t("kalender.vergrendelUitlegGeweigerdVast"))).toBeInTheDocument();
      // None of the four sentences that describe a different decision, in either the stale or the placed case.
      expect(paneel.queryByText(t("kalender.vergrendelUitlegBeslistVast"))).toBeNull();
      expect(paneel.queryByText(t("kalender.vergrendelUitlegVervallen"))).toBeNull();
      expect(paneel.queryByText(t("kalender.vergrendelUitlegVast"))).toBeNull();
      expect(paneel.queryByText(t("kalender.vergrendelNietNodig"))).toBeNull();
      expect(paneel.queryByText(t("kalender.vergrendelDekking"))).toBeNull();

      // The regeneration fact for a rejected placement is stated once, in the weigering section, and the lock
      // sentence does not repeat it (owner ruling, 2026-07-31).
      //
      // **Parameterised over the split E4-02 made (re-audit, fix round 2).** This assertion used to name
      // `weigeringUitleg` for both cases, and that is exactly what the re-audit caught: that string closes with
      // "het thema komt dan als jouw eigen keuze in deze themaperiode", which is false when the card is stale,
      // because un-rejecting yields `Manueel` with `isVervallen` still true. So this test was pinning the defect
      // for the stale case. It now asserts whichever variant is true of the state under test, and that the other
      // one is absent, so neither variant can quietly take over the other's card.
      const weigeringZin = isVervallen
        ? "kalender.weigeringUitlegVervallen"
        : "kalender.weigeringUitleg";
      const andereZin = isVervallen
        ? "kalender.weigeringUitleg"
        : "kalender.weigeringUitlegVervallen";
      expect(paneel.getByText(t(weigeringZin))).toBeInTheDocument();
      expect(paneel.queryByText(t(andereZin))).toBeNull();
      expect(t(weigeringZin)).toContain("hergeneratie van het hele jaarplan");
      expect(t(weigeringZin)).toContain("hier");
      expect(t("kalender.vergrendelUitlegGeweigerdVast")).not.toContain("hergener");

      // But it still has to be SCOPED, and this is the only assertion that says so. Idempotence is per
      // `(thema, niveau, blokStart)`, so a weigering keeps the thema out of the AI's reach **here** and not
      // everywhere: the AI may still propose it in another period. Because the sentence deliberately avoids the
      // word "hergener", `catalogus.test.ts`'s family guard cannot see it — it is exempt by construction — so
      // without this line the scoping was pinned by nothing at all and deleting "hier" left the suite green.
      // Added 2026-08-03 after the closing audit found the comment in `catalogus.test.ts` claiming this very
      // assertion already existed. It did not.
      expect(t("kalender.vergrendelUitlegGeweigerdVast")).toContain("hier");

      // A lock must always be undoable, whatever the status.
      fireEvent.click(paneel.getByRole("button", { name: t("kalender.ontgrendelen") }));
      await waitFor(() => expect(verzoeken).toHaveLength(1));
      expect(verzoeken[0].body).toEqual({ vergrendeld: false });
    },
  );

  it("distinguishes keeping a thema in place from making it count for the dekking", async () => {
    // Owner ruling, 2026-07-31: a locked `Voorgesteld` placement counts for **nothing** in the dekking, where only
    // aanvaard/manueel count as placed, so the lock nudge does not ship without that distinction beside it.
    //
    // *Why the ruling was needed has since expired, and the assertion has not (E4-02).* At the time the kalender had
    // no accept control, so locking was the only keep-action on the screen and the nudge had nothing to be
    // distinguished from except a status the screen could not set. There is now an "Aanvaarden" button on the card
    // face, and `vergrendelDekking` was reworded to point at it. The test still earns its place: the two sentences
    // must stay distinct precisely *because* both actions are now reachable, which is when a teacher can actually
    // confuse them.
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water" }),
      maakPlaatsing({ id: "p2", themaNaam: "Wonen", vergrendeld: true }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");

    // Both halves of the proposal state carry it: before locking (where it qualifies the nudge) and after
    // (where the thema is safe from the AI but still does not count).
    for (const thema of ["Water", "Wonen"]) {
      fireEvent.click(aanpassen(thema));
      expect(within(kaart(thema)).getByText(t("kalender.vergrendelDekking"))).toBeInTheDocument();
    }

    // And the claim about regeneration is scoped to the path that exists. E4-05 adds a second discard path and
    // E4-07's preserve/overwrite rule is still an open directie question, so an unqualified "een hergeneratie"
    // would be a promise about code nobody has written.
    //
    // These are the two sentences *this* test renders. The **class** is pinned in `i18n/catalogus.test.ts`, over
    // every `kalender.vergrendel*` value that mentions a hergeneratie: round 1 qualified the four sentences the
    // audit had quoted and left `vergrendeldUitleg` ("Blijft staan bij hergenereren", the badge's own tooltip)
    // unqualified, which is the same fix-the-noticed-instance pattern `catalogus.test.ts` was written against.
    expect(t("kalender.vergrendelUitlegVrij")).toContain("hele jaarplan");
    expect(t("kalender.vergrendelUitlegVast")).toContain("hele jaarplan");
  });

  it("offers no lock nudge on a STALE card, because re-placement is the only remedy", async () => {
    // A stale placement points at a date that is no longer a period boundary, which is why the plan's dekking is
    // flagged unreliable. Locking one pins it there: the "te herzien" state would then survive every
    // regeneration, where before this story a stale proposal was self-healing (a run simply discards it).
    const plan = maakJaarplan([
      maakPlaatsing({
        id: "p1",
        themaNaam: "Water",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
      }),
    ]);
    const verzoeken = stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    const paneel = within(kaart("Water"));

    // The one remedy is the period picker, and the panel says so at the top.
    expect(paneel.getByText(t("kalender.herplaatsKies"))).toBeInTheDocument();
    expect(paneel.queryByRole("button", { name: t("kalender.vergrendelen") })).toBeNull();
    expect(paneel.queryByText(t("kalender.vergrendelUitlegVrij"))).toBeNull();
    expect(paneel.queryByText(t("kalender.vergrendelDekking"))).toBeNull();
    // Nor the "you already decided" sentence, which would be a second thing to read and not the remedy.
    expect(paneel.queryByText(t("kalender.vergrendelNietNodig"))).toBeNull();
    expect(verzoeken).toHaveLength(0);
  });

  it("keeps a STALE card's existing lock undoable, and points at the period instead", async () => {
    // The state exists in the wild: lock a card, then the school edits a vakantie under it. Suppressing the
    // whole section here would strand the lock, so the control stays and only the sentence changes.
    const plan = maakJaarplan([
      maakPlaatsing({
        id: "p1",
        themaNaam: "Water",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        vergrendeld: true,
      }),
    ]);
    const verzoeken = stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    const paneel = within(kaart("Water"));
    expect(paneel.getByText(t("kalender.vergrendelUitlegVervallen"))).toBeInTheDocument();
    expect(paneel.queryByText(t("kalender.vergrendelUitlegVast"))).toBeNull();

    fireEvent.click(paneel.getByRole("button", { name: t("kalender.ontgrendelen") }));
    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(verzoeken[0].body).toEqual({ vergrendeld: false });
  });

  it("announces a SUCCESSFUL lock to assistive tech, not only a failure", async () => {
    // WCAG 2.2 SC 4.1.3. The failure path has always had `role="alert"`; the success was silent, so a
    // screen-reader user got a label that flipped and a badge appearing somewhere above with no announcement.
    // `aria-pressed` was rejected on purpose (beside a flipping label it announces backwards), which left
    // nothing in its place until this round.
    const vrij = maakPlaatsing({ id: "p1", themaNaam: "Water" });
    const vast = maakPlaatsing({ id: "p1", themaNaam: "Water", vergrendeld: true });

    const verzoeken = stubBewerking(maakJaarplan([vrij]), maakJaarplan([vast]));
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    // Nothing announced before the teacher acts: a live region primed with text would have announced on open.
    const regio = () =>
      within(kaart("Water"))
        .getAllByRole("status")
        .map((element) => element.textContent);
    expect(regio()).not.toContain(t("kalender.vergrendelVastgezet", { thema: "Water" }));

    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.vergrendelen") }));
    await waitFor(() => expect(verzoeken).toHaveLength(1));

    // The persisted state, named, so the announcement is intelligible out of the card's visual context.
    await waitFor(() =>
      expect(regio()).toContain(t("kalender.vergrendelVastgezet", { thema: "Water" })),
    );
  });

  it("announces UNLOCKING a decided card, the case where the section it sat in disappears", async () => {
    // Found in a browser, not by a test: the first version of the live region sat inside the lock section, and
    // unlocking a decided placement removes that whole section (the sentence becomes "Vastzetten hoeft hier
    // niet"), so the region unmounted in the same render that should have announced. The announcement was simply
    // absent — silently, which is how an accessibility regression normally ships.
    const vast = maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Manueel", vergrendeld: true });
    const vrij = maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Manueel" });

    const verzoeken = stubBewerking(maakJaarplan([vast]), maakJaarplan([vrij]));
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));
    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.ontgrendelen") }));
    await waitFor(() => expect(verzoeken).toHaveLength(1));

    // The section really is gone, so this cannot pass by the section having survived.
    await waitFor(() =>
      expect(within(kaart("Water")).getByText(t("kalender.vergrendelNietNodig"))).toBeInTheDocument(),
    );
    expect(
      within(kaart("Water")).queryByRole("button", { name: t("kalender.ontgrendelen") }),
    ).toBeNull();

    expect(
      within(kaart("Water"))
        .getAllByRole("status")
        .map((element) => element.textContent),
    ).toContain(t("kalender.vergrendelLosgemaakt", { thema: "Water" }));
  });

  it("gives the unrecoverable control a different weight from the reversible one beside it", async () => {
    // Owner ruling, 2026-07-31. "Losmaken" and "Uit deze periode halen" were both `variant="outline"`, stacked
    // and separated at 390px by a hairline: one reversible, one a DELETE with no confirmation on the card E4-06
    // made the common case. Asserted as "the two do not look the same" rather than on a hue, so the finding is
    // pinned while the palette stays the design system's to choose.
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    const paneel = within(kaart("Water"));
    const slot = paneel.getByRole("button", { name: t("kalender.vergrendelen") });
    const weg = paneel.getByRole("button", { name: t("kalender.uitPeriodeHalen") });

    expect(weg.className).not.toBe(slot.className);
    // Not colour alone (Art. XII): the border is a solid rule where the neutral button uses the pale `input`
    // token, so the difference survives without colour perception. Contrast is measured in a browser, not here.
    expect(weg.className).toContain("border-attentie-ink");
    expect(slot.className).not.toContain("attentie");
  });

  it("tells a stale card apart from a broken tool when the lock fails", async () => {
    // Branched on `ApiError.status`, not on `isError` (the E3-07 precedent and its audit finding). A 404 means this
    // browser is looking at a card that is gone, which reloading fixes; a 500 means the tool is broken, and telling
    // the teacher to reload would send them round a loop that cannot succeed. Art. II.3: the server's own string
    // never reaches them either way.
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);

    stubBewerking(plan, plan, 404);
    const eerste = renderKalender();
    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));
    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.vergrendelen") }));

    expect(await screen.findByText(t("kalender.vergrendelVerdwenen"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.vergrendelMislukt"))).toBeNull();
    expect(screen.queryByText(/geen periodegrens/)).toBeNull();
    eerste.unmount();

    stubBewerking(plan, plan, 500);
    renderKalender();
    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));
    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.vergrendelen") }));

    expect(await screen.findByText(t("kalender.vergrendelMislukt"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.vergrendelVerdwenen"))).toBeNull();
  });

  it("reports a refused move in Dutch and never echoes the backend message", async () => {
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    stubBewerking(plan, plan, 400);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));
    fireEvent.change(within(kaart("Water")).getByLabelText(t("kalender.verplaatsNaar")), {
      target: { value: "2026-11-09" },
    });
    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.verplaatsen") }));

    expect(await screen.findByText(t("kalender.verplaatsMislukt"))).toBeInTheDocument();

    // The refusal's `detail` is Dutch and server-authored, and `api.ts`'s rule is that no server string
    // reaches a teacher — the copy comes from nl.json. That is also what keeps the open Art. II.3 ruling free
    // of UI rework, which the backlog entry says gets more expensive with every screen that breaks it.
    expect(screen.queryByText(/geen periodegrens/)).toBeNull();
    expect(screen.queryByText(/Ongeldige aanvraag/)).toBeNull();

    // The card has not moved: the board renders what the server last returned, never an optimistic guess.
    expect(within(kaart("Water")).getByText("Water")).toBeInTheDocument();
  });
});

/**
 * E3-08: switching the zoom between the two ratified tiers (FR-6.3, Art. IX.3).
 *
 * What is pinned here is not "a toggle toggles". It is the four things the finer tier could easily get wrong, each
 * of which would misinform a teacher about their own plan:
 * 1. **one grid, one truth** — the tier is a `/rooster` argument, and the spine, the board's accessible name and
 *    every column heading come from that single answer, so the two views on this screen cannot disagree about which
 *    period an ordinal means;
 * 2. **the tiers are cached apart** — without the tier in the query key they share one entry, and a switch renders
 *    the other grain's blocks for a moment;
 * 3. **a thema is drawn once, where the data says it is** — a placement keys on a *themaperiode* start and nothing
 *    records which weeks inside it the thema occupies, so it appears in the parent's first sub-block only and the
 *    parent's other sub-blocks are honestly empty;
 * 4. **a healthy plan is not declared stale** — the coincidence that a themaperiode and its first subthemaperiode
 *    share a start date is what keeps the non-dismissible "Te herzien" panel shut here, and a coincidence is exactly
 *    the kind of thing to assert rather than to reason about.
 */
describe("Jaarplankalender — zoomniveaus (E3-08, FR-6.3)", () => {
  /**
   * The same two themaperiodes, subdivided the way `GeconfigureerdePlanningsblokIndeling` subdivides them: each
   * coarse block is split into `round(dagen / 14)` near-equal parts, so **the first part of a parent starts on the
   * parent's own start date**. That property is what test 4 rests on, so the fixture has to have it.
   */
  const fijnRooster: Planningsrooster = {
    ...rooster,
    niveau: "Subthemaperiode",
    blokken: [
      { ordinaal: 1, start: "2026-09-01", eind: "2026-09-16", ouderOrdinaal: 1, aantalOpenDagen: 16, aantalOpenWeekdagen: 11 },
      { ordinaal: 2, start: "2026-09-17", eind: "2026-10-02", ouderOrdinaal: 1, aantalOpenDagen: 16, aantalOpenWeekdagen: 11 },
      { ordinaal: 3, start: "2026-10-03", eind: "2026-10-17", ouderOrdinaal: 1, aantalOpenDagen: 15, aantalOpenWeekdagen: 11 },
      { ordinaal: 4, start: "2026-10-18", eind: "2026-11-01", ouderOrdinaal: 1, aantalOpenDagen: 15, aantalOpenWeekdagen: 11 },
      { ordinaal: 5, start: "2026-11-09", eind: "2026-11-22", ouderOrdinaal: 2, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
      { ordinaal: 6, start: "2026-11-23", eind: "2026-12-06", ouderOrdinaal: 2, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
      { ordinaal: 7, start: "2026-12-07", eind: "2026-12-20", ouderOrdinaal: 2, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
    ],
  };

  /**
   * Serves the grid the request asks for, and records every rooster URL so the *request* can be asserted too.
   *
   * `faalRooster` decides per request whether `/rooster` answers a 500 instead of a grid, which is how the
   * failed-fetch tests below reproduce a broken tier without touching anything else on the screen. A function rather
   * than a flag, so a test can let a retry succeed.
   */
  function stubZoom(
    jaarplan: Jaarplan,
    faalRooster?: (url: string) => boolean,
    /**
     * The class's KEPT generation settings. Defaults to none; a test that needs the summary to say something about a
     * stored preference passes one, which is the only way to reach the claim MAJOR-A was about.
     */
    instellingen: Generatieparameters = { gewensteStartthemas: [], vasteMomenten: [] },
    /**
     * What a request that is *not* `?niveau=Subthemaperiode` answers with. Overridable so one test can make the server
     * answer a tier this app does not know: `Planningsrooster.niveau` is a plain `string` on purpose (it is what the
     * server said, not what this app hopes), and the degrade for an unrecognised value is a real branch.
     */
    grofRooster: Planningsrooster = rooster,
  ) {
    const roosterUrls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify([{ id: "t0", naam: "Herfst" }]), { status: 200 });
        }
        // Routed before /jaarplan, whose URL it extends. See the note on the stub at the top of this file.
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify(instellingen), { status: 200 });
        }
        // As in the main stub: unrouted, the E3-09 knelpunt line would render its failure state on every zoom test.
        if (url.includes("/dekking")) {
          return new Response(JSON.stringify(DEKKING_NIETS_ONTBREEKT), { status: 200 });
        }
        if (url.includes("/rooster")) {
          roosterUrls.push(url);

          if (faalRooster?.(url)) {
            return new Response("kapot", { status: 500 });
          }

          return new Response(
            JSON.stringify(url.includes("niveau=Subthemaperiode") ? fijnRooster : grofRooster),
            { status: 200 },
          );
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(jaarplan), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );

    return roosterUrls;
  }

  const knop = (sleutel: "kalender.weergaveGrof" | "kalender.weergaveFijn") =>
    within(screen.getByRole("group", { name: t("kalender.weergaveLabel") })).getByRole("button", {
      name: t(sleutel),
    });

  /** The board at whichever tier it is currently drawing. */
  const bord = () =>
    screen.getByRole("list", {
      name: new RegExp(`^(${t("kalender.ribbonLabel")}|${t("kalender.ribbonLabelFijn")})$`),
    });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("asks the API for the chosen tier and draws the whole screen from that one answer", async () => {
    const roosterUrls = stubZoom(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");
    // The tier is sent explicitly on the FIRST request too, rather than left to the endpoint's default. That
    // default is what once made the parameter form correct by coincidence.
    expect(roosterUrls).toHaveLength(1);
    expect(roosterUrls[0]).toContain("niveau=Themaperiode");

    // Three carriers of state, so it never rests on colour (Art. XII): pressed, weight, fill. Only the first is
    // assertable in jsdom; the fill is measured in a browser and recorded in the worklog.
    expect(knop("kalender.weergaveGrof")).toHaveAttribute("aria-pressed", "true");
    expect(knop("kalender.weergaveFijn")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(knop("kalender.weergaveFijn"));

    await waitFor(() => expect(roosterUrls).toHaveLength(2));
    expect(roosterUrls[1]).toContain("niveau=Subthemaperiode");

    // The board's accessible NAME follows the tier. Hard-coded to the coarse one, it told a screen-reader user they
    // were in a list of themaperiodes while every column in it was a subthemaperiode.
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("list", { name: t("kalender.ribbonLabel") })).toBeNull();

    // Every column says which themaperiode it belongs to, from `ouderOrdinaal`.
    expect(within(bord()).getByText(t("kalender.subperiode", { ordinaal: 1 }))).toBeInTheDocument();
    expect(
      within(bord()).getAllByText(t("kalender.binnenThemaperiode", { ordinaal: 1 })),
    ).toHaveLength(4);
    expect(within(bord()).queryByText(t("kalender.periode", { ordinaal: 1 }))).toBeNull();

    // The spine zooms with the board rather than staying pinned to the year: its sr-only ordinals name the tier on
    // screen. Two views with two ordinal spaces is the defect the E3-02/E3-06 review had to fix twice.
    expect(
      screen.getByText(`${t("kalender.subperiode", { ordinaal: 7 })}:`, { exact: false }),
    ).toBeInTheDocument();

    // And so does the strip's own title, which is the FIRST thing a screen-reader user hears about it. Pinned in fix
    // round 4: the round-2 fix that made this sentence tier-specific was measured in a browser and never asserted, so
    // swapping the two keys left the whole suite green. Found by mutating the table this round introduced.
    expect(screen.getByText(t("spine.titelFijn"))).toBeInTheDocument();
    expect(screen.queryByText(t("spine.titel"))).toBeNull();

    expect(knop("kalender.weergaveFijn")).toHaveAttribute("aria-pressed", "true");
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("caches the two tiers apart, so switching back is instant and never shows the wrong grain", async () => {
    const roosterUrls = stubZoom(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    fireEvent.click(knop("kalender.weergaveGrof"));

    // Asserted with NO await: the coarse grid must already be on screen the moment the click is handled, because it
    // is still in the cache under its own key. Keyed on the school year alone, the two tiers share one entry and the
    // fine grid would be what is rendered here — under the coarse label, which is the flicker of stale data of the
    // wrong grain this key change exists to prevent.
    expect(screen.getByRole("list", { name: t("kalender.ribbonLabel") })).toBeInTheDocument();
    expect(within(bord()).getByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    expect(within(bord()).queryByText(t("kalender.binnenThemaperiode", { ordinaal: 1 }))).toBeNull();
    // The strip's title comes back with it (fix round 4), so neither tier's copy can be left behind by the other's.
    expect(screen.getByText(t("spine.titel"))).toBeInTheDocument();
    expect(screen.queryByText(t("spine.titelFijn"))).toBeNull();

    // And no full-screen loading line at any point: the whole subtree tearing down is what would drop the teacher's
    // unsent parameter edits (pinned from the form's side in Generatieparameters.test.tsx).
    expect(screen.queryByText(t("kalender.laden"))).toBeNull();

    // The finer grid was derived ONCE. Going back to the coarse tier does not throw it away, so a teacher toggling
    // between the two is not re-deriving the whole year on every press.
    expect(roosterUrls.filter((url) => url.includes("niveau=Subthemaperiode"))).toHaveLength(1);
  });

  it("draws a thema once, at the start of its themaperiode, and leaves the rest of that period empty", async () => {
    stubZoom(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    // Once, not four times across its parent's sub-blocks, and with no "runs through here" continuation: which weeks
    // inside a themaperiode a thema occupies is not modelled anywhere, so drawing it twice would assert an extent the
    // data does not contain.
    expect(within(bord()).getAllByText("Water")).toHaveLength(1);
    expect(
      within(bord())
        .getByText("Water")
        .closest("li")!
        .parentElement!.closest("li")!,
    ).toHaveTextContent(t("kalender.subperiode", { ordinaal: 1 }));

    // Six sub-columns hold no card, and they do NOT all say the same thing (fix round 1, finding 10). The three
    // siblings of the filled themaperiode belong to a period the class is teaching a thema in, so "Nog niets gepland"
    // there would be false about the plan; the three that make up the genuinely empty themaperiode 2 keep it. The
    // reason a thema appears in only one of its parent's columns is stated ONCE above the board.
    expect(within(bord()).getAllByText(t("kalender.subperiodeIngepland"))).toHaveLength(3);
    expect(within(bord()).getAllByText(t("kalender.legeperiode"))).toHaveLength(3);
    expect(screen.getAllByText(t("kalender.fijnUitleg"))).toHaveLength(1);

    // The two counts above are SYMMETRIC (3 and 3), so on their own they survive swapping the two keys — which is
    // precisely the defect finding 10 was about, returning. So each sentence is also tied to a column: a sibling of
    // the FILLED themaperiode must carry the membership sentence, and a column of the genuinely empty themaperiode 2
    // must carry "Nog niets gepland". Added at landing after the round-5 audit found this pair surviving the same
    // mutation `SPINETITEL` had just been fixed for — the counts were a measurement of quantity, not of meaning.
    const kolom = (ordinaal: number) =>
      within(bord()).getByText(t("kalender.subperiode", { ordinaal })).closest("li")!;

    // The fixture nests sub-columns 1-4 under themaperiode 1 and 5-7 under themaperiode 2, and "Water" sits in
    // sub-column 1. So 2 is a sibling of a FILLED period and 5 belongs to the genuinely empty one.
    expect(kolom(2)).toHaveTextContent(t("kalender.subperiodeIngepland"));
    expect(kolom(2)).not.toHaveTextContent(t("kalender.legeperiode"));

    expect(kolom(5)).toHaveTextContent(t("kalender.legeperiode"));
    expect(kolom(5)).not.toHaveTextContent(t("kalender.subperiodeIngepland"));
  });

  it("does not declare a healthy plan te herzien at the finer tier", async () => {
    // The placement keys on themaperiode 1's start. At the fine tier that date is also the start of the parent's
    // FIRST sub-block, so it still resolves — but that is a coincidence of the nesting rather than a guarantee, and
    // if it ever stopped holding, this screen would tell a teacher their whole plan was stale in a notice the
    // directie ruling of 2026-07-28 makes non-dismissible. Hence an assertion rather than an argument.
    stubZoom(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    expect(
      screen.queryByRole("region", { name: t("kalender.herzienTitelEnkelvoud") }),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: new RegExp(t("kalender.herzienUitleg")) })).toBeNull();
    // The card is on the board, not in a notice.
    expect(within(bord()).getByText("Water")).toBeInTheDocument();
  });

  it("offers no move affordance at the finer tier, and says in visible text where moving works", async () => {
    stubZoom(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");
    const kaartVan = () => screen.getByText("Water").closest("article") as HTMLElement;

    // The premise: at the coarse tier the grip IS there, so its absence below means something.
    expect(within(kaartVan()).queryByText("⠿")).not.toBeNull();

    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    // No grip. `VerplaatsPlaatsingAsync` resolves a target against the GENERATION tier's blocks, so a
    // subthemaperiode start that is not also a themaperiode start is always a 400.
    expect(within(kaartVan()).queryByText("⠿")).toBeNull();

    // And no period picker in the panel. Absent, not disabled with a tooltip: the sentence above the board says
    // where moving works (the E3-06 rule), and the rest of the panel still works.
    fireEvent.click(
      within(kaartVan()).getByRole("button", { name: t("kalender.aanpassenLabel", { thema: "Water" }) }),
    );
    expect(within(kaartVan()).queryByLabelText(t("kalender.verplaatsNaar"))).toBeNull();
    expect(
      within(kaartVan()).getByRole("button", { name: t("kalender.uitPeriodeHalen") }),
    ).toBeInTheDocument();

    expect(screen.getByText(t("kalender.fijnUitleg"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.sleepUitleg"))).toBeNull();
  });

  /**
   * Fix round 1, finding 2: **a failed grid fetch must not take the screen down with it.**
   *
   * `placeholderData: keepPreviousData` is gated on `status === 'pending'`, so when the newly-keyed fine-tier query
   * *errors* the placeholder is dropped and `rooster.data` is undefined. The early return then replaced the spine, the
   * board, the plan, the generation card **and the zoom control itself** with one sentence: the teacher pressed a
   * button and their year plan vanished with nothing left to press, recoverable only by reloading. Reproduced in a
   * browser against a 500 for `?niveau=Subthemaperiode` before being fixed here.
   */
  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("keeps the plan and a way forward when the chosen tier fails to load", async () => {
    stubZoom(
      maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]),
      (url) => url.includes("niveau=Subthemaperiode"),
    );
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(knop("kalender.weergaveFijn"));

    const melding = await screen.findByText(t("kalender.roosterFoutWeergave"));

    // Nothing was lost: the plan, the board, the generation card and the control are all still there, at the tier that
    // did load. This is the assertion the story lacked — the old branch failed all four.
    expect(within(bord()).getByText("Water")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: t("kalender.ribbonLabel") })).toBeInTheDocument();
    // `hergenereer`, not `genereer`: this fixture has a placement, so from E4-04 the trigger names itself a
    // regeneration. What this line asserts is unchanged — that the card survived the failed tier.
    expect(screen.getByRole("button", { name: t("kalender.hergenereer") })).toBeInTheDocument();
    expect(knop("kalender.weergaveGrof")).toBeInTheDocument();

    // A real next step, and not "herlaad de pagina": the query client has already retried three times before this
    // notice appears, so the remedy it names must not be the one already exhausted (the E3-04 audit's ruling).
    const opnieuw = screen.getByRole("button", { name: t("kalender.roosterOpnieuw") });
    expect(melding.textContent).not.toContain("herlaad");

    // The button is a SIBLING of the live region, never a child: a live region wrapping a control re-announces its
    // whole contents on every interaction, and pressing this one changes its own label.
    expect(melding).toHaveAttribute("role", "alert");
    expect(melding.contains(opnieuw)).toBe(false);

    // And the other option is a way out too: pressing it leaves the failing tier behind entirely.
    fireEvent.click(knop("kalender.weergaveGrof"));
    await waitFor(() => expect(screen.queryByText(t("kalender.roosterFoutWeergave"))).toBeNull());
    expect(within(bord()).getByText("Water")).toBeInTheDocument();
  });

  it("offers a retry and the other tier when the first grid fetch fails, and recovers on the retry", async () => {
    // The one case where there is genuinely nothing to draw: the first load failed, so no cached grid exists to stand
    // on. The screen may then be a single sentence, but it must still carry a live control — E3-04 fix round 4's rule.
    let faal = true;
    stubZoom(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]), () => faal);
    renderKalender();

    expect(await screen.findByText(t("kalender.roosterFout"))).toBeInTheDocument();
    expect(knop("kalender.weergaveGrof")).toBeInTheDocument();

    faal = false;
    fireEvent.click(screen.getByRole("button", { name: t("kalender.roosterOpnieuw") }));

    // The retry actually recovers, rather than merely looking busy. Note `refetch()` on an errored query holding no
    // data puts TanStack back to `pending`, which is why the notice is not keyed on `isError` alone.
    await waitFor(() => expect(screen.getByText("Water")).toBeInTheDocument());
    expect(screen.queryByText(t("kalender.roosterFout"))).toBeNull();
  });

  /**
   * Fix round 2, MAJOR-A: **the GENERATION tier's grid can fail on its own, and then the screen may not state the
   * settings as if it had one.**
   *
   * Round 1 moved the stranded check onto a second `/rooster` query so it would stop depending on the zoom. What it did
   * not do is read that query's failure: `blokken={generatieRooster.data?.blokken ?? []}` and `niveau={… ?? ""}` turned
   * "the grid is missing" into the same silent tier mismatch as "the server answered another tier", `vervallen` emptied,
   * and `aantalStartthemas` counted the stranded entry as valid again — the exact claim finding 1 was about, with
   * generation still enabled and nothing on screen saying a grid was missing.
   *
   * The route is the one the new copy recommends: `kalender.roosterFout` ends "kies hierboven de andere weergave", so a
   * failed first load of the coarse tier sends the teacher to the fine one, which is where the lie lived. Hence the
   * asymmetric fault — only `niveau=Themaperiode` fails — which neither of the round-1 failure tests exercises.
   */
  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("refuses to state the settings, and to generate, when the generation tier's grid is the one that failed", async () => {
    stubZoom(
      maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]),
      (url) => url.includes("niveau=Themaperiode"),
      // Stranded on purpose: 5 October is not the start of any themaperiode in `rooster`. At the coarse tier this reads
      // "(1 zonder themaperiode)"; the defect was that it read "(1 startthema)" here.
      { gewensteStartthemas: [{ blokStart: "2026-10-05", themaNaam: "Water" }], vasteMomenten: [] },
    );
    renderKalender();

    // The coarse tier is where the app opens, and it fails: the full-page notice, with the control kept.
    expect(await screen.findByText(t("kalender.roosterFout"))).toBeInTheDocument();
    // The page identity survives the failure (fix round 2): a teacher who pressed something is not left on a screen
    // that no longer says which class it is about.
    expect(screen.getByRole("heading", { name: t("kalender.titel") })).toBeInTheDocument();
    expect(screen.getByText(/L3 derde leerjaar/)).toBeInTheDocument();

    // Now do exactly what that notice suggests.
    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    // The plan is back on screen, which is the point of the fallback — and the settings are NOT claimed.
    expect(within(bord()).getByText("Water")).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: new RegExp(t("parameters.titel")) });
    // The SUMMARY, not the whole trigger: the label itself is "Vooraf instellen: startthema's en vaste momenten", so a
    // document-wide check for "startthema" would pass for the wrong reason.
    const samenvatting = () => /\(([^)]*)\)/.exec(trigger.textContent ?? "")?.[1] ?? "";
    expect(samenvatting()).toBe("themaperiodes onbekend");
    expect(samenvatting()).not.toContain("startthema");

    // THE regression, stated as the run: a teacher cannot consent to a run whose parameters the screen cannot state.
    expect(screen.getByRole("button", { name: t("kalender.hergenereer") })).toBeDisabled();

    // And the state is visible, with the one control that can end it. Not silent, and not a tooltip.
    expect(screen.getByText(t("kalender.generatieRoosterFout"))).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: t("kalender.roosterOpnieuw") }).length,
    ).toBeGreaterThan(0);

    // The panel says which of the two reasons it is, and does NOT send the teacher to the view that is failing —
    // `anderNiveau` would be a loop between a view that lies and a view that refuses.
    fireEvent.click(trigger);
    const startthemas = screen.getByRole("group", { name: t("parameters.startthemasTitel") });
    expect(within(startthemas).getByText(t("parameters.periodesNietGeladen"))).toBeInTheDocument();
    expect(within(startthemas).queryByText(t("parameters.anderNiveau"))).toBeNull();
    expect(within(startthemas).queryByRole("combobox")).toBeNull();
  });

  /**
   * Fix round 2, MINOR-F: **the degrade for a tier this app cannot recognise may not instruct.**
   *
   * `bordNiveau` falls back to the coarse labels for an unrecognised `grid.niveau` — the columns have to be called
   * something — while moving demands strict equality with the generation tier. So the board said "Verplaatsen doe je in
   * de weergave Themaperiodes" while labelling itself as being on Themaperiodes: an instruction impossible to follow,
   * pointing at the view you are looking at. Not reachable from today's API, which is exactly why it needs a test rather
   * than an argument.
   *
   * **Fix round 3, MINOR-1, adds the second half.** This fixture also puts `periodestaat` in `nietGelezen` (the
   * generation-tier request answers "Kwartaal" too), which is the state that *disabled the generate button while
   * nothing on screen said the run was refused*: the notice beside the button was wired on `nietGeladen` only. The
   * refusal and its explanation now share one condition, and this test asserts both halves, having previously asserted
   * neither while driving straight through the branch.
   */
  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("says nothing was changed, rather than where to go, when the tier is one it cannot recognise", async () => {
    stubZoom(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]), undefined, undefined, {
      ...rooster,
      niveau: "Kwartaal",
    });
    renderKalender();

    await screen.findByText("Water");

    expect(screen.getByText(t("kalender.roosterNiveauOnbekend"))).toBeInTheDocument();
    // Neither of the two sentences that name a view to switch to.
    expect(screen.queryByText(t("kalender.fijnUitleg"))).toBeNull();
    expect(screen.queryByText(t("kalender.sleepUitleg"))).toBeNull();
    // And moving is genuinely withheld, not merely described as unavailable.
    expect(within(screen.getByText("Water").closest("article")!).queryByText("⠿")).toBeNull();

    // The run is refused, AND the refusal is stated beside the button that carries it — outside the collapse, so it
    // does not depend on a disclosure that is closed by default.
    expect(screen.getByRole("button", { name: t("kalender.hergenereer") })).toBeDisabled();
    expect(screen.getByText(t("kalender.generatieRoosterNiveauOnbekend"))).toBeInTheDocument();

    // With NO retry anywhere on the screen: this request succeeded and answered something unreadable, so pressing
    // "Opnieuw proberen" would deterministically produce the same answer. A notice that prescribes the step already
    // exhausted is what the E3-04 audit rejected.
    expect(screen.queryByRole("button", { name: t("kalender.roosterOpnieuw") })).toBeNull();
  });

  /**
   * Fix round 2, MAJOR-B: **an errored background refetch keeps its data, so the notice must not claim the other tier
   * is on screen.**
   *
   * Verified in `@tanstack/query-core` 5.101.2 (`build/modern/query.js`): the error action sets `status: "error"` while
   * leaving `data` in place ("flag existing data as invalidated if we get a background error"). The app builds its
   * client with no overrides, so `staleTime: 0` + `refetchOnWindowFocus` reaches this on any alt-tab during an API
   * blip. Round 1 passed `terugval` as a hard-coded `true` wherever the board rendered, so the alert announced
   * "Je ziet nog de themaperiodes" over nineteen subthemaperiode columns: both clauses false, and a regression in
   * honesty on the version that merely blanked the screen.
   */
  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("does not claim the other tier is showing when a refresh of the current one failed", async () => {
    let faal = false;
    stubZoom(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]), () => faal);
    const { queryClient } = renderKalender();

    await screen.findByText("Water");
    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    // The fine tier now holds data. Refetching it while the fault is armed is the state no click can reach: the query
    // goes to `isError` and keeps its data. The key mirrors `roosterKey` in `useJaarplan.ts`, which is module-private
    // there (and that file is being changed by a parallel story, so it is deliberately not exported for this).
    faal = true;
    void queryClient.refetchQueries({
      queryKey: ["planningsrooster", SCHOOLJAAR_ID, "Subthemaperiode"],
    });

    const melding = await screen.findByText(t("kalender.roosterVerversenMislukt"));

    // Nothing was lost: the tier the teacher chose is still drawn, with its cards. So nothing may say otherwise.
    expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument();
    expect(within(bord()).getByText("Water")).toBeInTheDocument();
    // The two sentences that name the OTHER tier, or claim there is nothing to draw, are absent.
    expect(screen.queryByText(t("kalender.roosterFoutWeergave"))).toBeNull();
    expect(screen.queryByText(t("kalender.roosterFout"))).toBeNull();

    // Quiet: a failed refresh that cost nothing does not interrupt a screen reader mid-task. It keeps the retry,
    // because a grid that could not be refreshed is exactly what hides a beheerder's vakantie edit (E3-04).
    expect(melding).not.toHaveAttribute("role", "alert");
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(screen.getByRole("button", { name: t("kalender.roosterOpnieuw") })).toBeInTheDocument();

    // And the generation tier's grid is untouched, so the run is not refused: this failure cost the teacher nothing,
    // which is the whole reason it gets a different sentence.
    expect(screen.getByRole("button", { name: t("kalender.hergenereer") })).toBeEnabled();
  });

  /**
   * Fix round 1, finding 8: `kalender.herplaatsAnderNiveau` was the one new branch with no test at all, and the
   * test-runner could not reach it in a browser (making a placement stale needs a direct DB write). So it is pinned
   * here, on a fixture.
   */
  it("tells a stale placement's panel where re-placing works, and keeps the notice non-dismissible", async () => {
    stubZoom(
      maakJaarplan([
        maakPlaatsing({
          id: "p9",
          themaNaam: "Feesten in december",
          // Not the start of any block at either tier: the vakantiedata changed after this was placed.
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
          status: "Aanvaard",
          aiMotivatie: null,
        }),
      ]),
    );
    renderKalender();

    const kaart = () => screen.getByText("Feesten in december").closest("article") as HTMLElement;
    const paneel = () =>
      fireEvent.click(
        within(kaart()).getByRole("button", {
          name: t("kalender.aanpassenLabel", { thema: "Feesten in december" }),
        }),
      );

    // The premise at the coarse tier: a picker, and the instruction that points at it.
    await screen.findByRole("region", { name: t("kalender.herzienTitelEnkelvoud") });
    paneel();
    expect(within(kaart()).getByLabelText(t("kalender.verplaatsNaar"))).toBeInTheDocument();
    expect(within(kaart()).getByText(t("kalender.herplaatsKies"))).toBeInTheDocument();
    paneel();

    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    // At the fine tier the panel has no picker, so the instruction must not point at one: copy that describes an
    // absent control is the "control that does nothing" defect turned inside out.
    const melding = screen.getByRole("region", { name: t("kalender.herzienTitelEnkelvoud") });
    paneel();
    expect(within(kaart()).queryByLabelText(t("kalender.verplaatsNaar"))).toBeNull();
    expect(within(kaart()).getByText(t("kalender.herplaatsAnderNiveau"))).toBeInTheDocument();
    expect(within(kaart()).queryByText(t("kalender.herplaatsKies"))).toBeNull();
    // It names the view the teacher must switch to, in the words that view's own button carries.
    expect(t("kalender.herplaatsAnderNiveau")).toContain(t("kalender.weergaveGrof"));

    // Still not dismissible, at this tier either: the full set of controls in the notice is the card's own disclosure
    // plus what its open panel offers, and nothing that closes, hides or defers the notice itself.
    //
    // "Subthema's" joins the set (2026-08-23, antagonist MAJOR-4) for the same reason the coarse-tier test
    // gives: it is a fact about the klas, not about this placement's staleness, and is deliberately not gated
    // on `isVervallen`.
    expect(
      within(melding)
        .getAllByRole("button")
        .map((control) => control.getAttribute("aria-label") ?? control.textContent),
    ).toEqual([
      t("kalender.aanpassenLabel", { thema: "Feesten in december" }),
      t("kalender.uitJaarplanHalen"),
      t("kalender.subthemasLabel", { thema: "Feesten in december" }),
    ]);
    expect(within(melding).queryByRole("link")).toBeNull();
  });

  /**
   * Fix round 3, the owner-ruled fix: **a rejected card is never promised a period picker, in any view.**
   *
   * Its picker is withheld by the *rejection* (`doelen` is empty for a `Geweigerd` placement, because the server
   * refuses a move that would silently grant dekking), not by the tier. Round 2's copy conditioned the sentence on the
   * tier alone, so the fine tier said *"Een themaperiode kiezen voor dit thema kan in de weergave Themaperiodes"* about
   * a card that gets no picker there either: a local contradiction turned into a cross-view instruction that cannot be
   * kept. The test-runner measured exactly this state in a browser, having had to create it with a direct DB write
   * (nothing in the UI sets `Geweigerd`) — which is why it is pinned here on a fixture.
   *
   * At the coarse tier the same fixture also removes E3-07's own version of the contradiction, where the sentence
   * pointed at a picker that is absent from the panel it is printed in.
   */
  it("never promises a REJECTED stale card a period picker, at either tier", async () => {
    stubZoom(
      maakJaarplan([
        maakPlaatsing({
          id: "p8",
          themaNaam: "Zomer en vakantie",
          // Not a block boundary at either tier, and rejected: the intersection the browser check reproduced.
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
          status: "Geweigerd",
          aiMotivatie: null,
        }),
      ]),
    );
    renderKalender();

    const kaart = () => screen.getByText("Zomer en vakantie").closest("article") as HTMLElement;
    const paneel = () =>
      fireEvent.click(
        within(kaart()).getByRole("button", {
          name: t("kalender.aanpassenLabel", { thema: "Zomer en vakantie" }),
        }),
      );

    await screen.findByRole("region", { name: t("kalender.herzienTitelEnkelvoud") });
    paneel();

    // Coarse tier: no picker (the rejection withholds it), so neither re-placement sentence may appear.
    expect(within(kaart()).queryByLabelText(t("kalender.verplaatsNaar"))).toBeNull();
    expect(within(kaart()).queryByText(t("kalender.herplaatsKies"))).toBeNull();
    expect(within(kaart()).queryByText(t("kalender.herplaatsAnderNiveau"))).toBeNull();

    // What it says instead is true here, and its corrective control is on this same screen.
    // *The stale variant since the E3-07 reopening (2026-08-04):* this fixture is `isVervallen`, and the shared
    // sentence promised it "een andere themaperiode" — a period it does not have. See the dedicated test below.
    expect(
      within(kaart()).getByText(t("kalender.weigeringEerstTerugdraaienVervallen")),
    ).toBeInTheDocument();
    expect(
      within(kaart()).getByRole("button", { name: t("kalender.weigeringTerugdraaien") }),
    ).toBeInTheDocument();
    paneel();

    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );
    paneel();

    // THE regression: the fine tier must not send this card to a view that withholds its picker for the same reason.
    expect(within(kaart()).queryByText(t("kalender.herplaatsAnderNiveau"))).toBeNull();
    expect(within(kaart()).queryByText(t("kalender.herplaatsKies"))).toBeNull();
    expect(within(kaart()).queryByText(t("kalender.herplaatsNiveauOnbekend"))).toBeNull();
    expect(within(kaart()).queryByLabelText(t("kalender.verplaatsNaar"))).toBeNull();

    // And the one sentence it does get, plus its control, survive the zoom: neither names a block, so the tier cannot
    // take them away. That is what makes silence about re-placing safe rather than a dead end.
    expect(
      within(kaart()).getByText(t("kalender.weigeringEerstTerugdraaienVervallen")),
    ).toBeInTheDocument();
    expect(
      within(kaart()).getByRole("button", { name: t("kalender.weigeringTerugdraaien") }),
    ).toBeInTheDocument();
  });

  /**
   * Fix round 4, the owner's ruling on QUESTION-A: **both steps of the remedy are named, at both tiers.**
   *
   * The remedy on a stale rejected card is two moves — reverse the rejection, *then* give the thema a themaperiode —
   * and round 3 named only the first, leaving *"eerst"* to imply the rest. The defence was that naming the second step
   * requires naming a view, which would make the sentence tier-dependent again. The audit disproved it: a clause that
   * says what becomes possible, without saying where, is true at every tier, and the *where* is already carried once
   * above the board by `sleepUitleg` / `fijnUitleg` rather than repeated per card.
   *
   * **Asserted against the sentence's content, not only through `t()`.** A `getByText(t("…"))` check follows `nl.json`
   * wherever it goes, so deleting the clause would leave the round-3 assertions green while the card went back to
   * naming one step of two. The regex is what makes this a pin.
   */
  it("names the second step of the remedy on a rejected stale card, at either tier", async () => {
    const tweedeStap = /daarna[^.]*themaperiode/i;

    stubZoom(
      maakJaarplan([
        maakPlaatsing({
          id: "p9",
          themaNaam: "Zomer en vakantie",
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
          status: "Geweigerd",
          aiMotivatie: null,
        }),
      ]),
    );
    renderKalender();

    const kaart = () => screen.getByText("Zomer en vakantie").closest("article") as HTMLElement;
    const paneel = () =>
      fireEvent.click(
        within(kaart()).getByRole("button", {
          name: t("kalender.aanpassenLabel", { thema: "Zomer en vakantie" }),
        }),
      );

    // The catalogue itself: one string carrying both steps, and naming neither view, so it cannot become the
    // cross-view instruction that round 3 had to remove.
    //
    // *Re-aimed at the stale variant by the E3-07 reopening (2026-08-04).* This card is `isVervallen`, so it now
    // renders `weigeringEerstTerugdraaienVervallen`; asserting the catalogue property against the non-stale key
    // would have kept passing while saying nothing about the sentence this card shows. Both keys are checked, so
    // the property is pinned for both states rather than moved from one to the other.
    for (const sleutel of [
      "kalender.weigeringEerstTerugdraaien",
      "kalender.weigeringEerstTerugdraaienVervallen",
    ] as const) {
      expect(t(sleutel)).toMatch(tweedeStap);
      expect(t(sleutel)).not.toContain(t("kalender.weergaveGrof"));
      expect(t(sleutel)).not.toContain(t("kalender.weergaveFijn"));
    }

    await screen.findByRole("region", { name: t("kalender.herzienTitelEnkelvoud") });
    paneel();
    expect(within(kaart()).getByText(tweedeStap)).toBeInTheDocument();
    paneel();

    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );
    paneel();

    // Same sentence at the finer grain: it names no block, so the tier cannot make it false. What is still absent is
    // any re-placement instruction (the round-3 fix) — the second step is stated as what follows the reversal, not as
    // a control this panel offers now.
    expect(within(kaart()).getByText(tweedeStap)).toBeInTheDocument();
    expect(within(kaart()).queryByText(t("kalender.herplaatsAnderNiveau"))).toBeNull();
    expect(within(kaart()).queryByText(t("kalender.herplaatsKies"))).toBeNull();
    expect(within(kaart()).queryByLabelText(t("kalender.verplaatsNaar"))).toBeNull();
  });

  /**
   * **The E3-07 reopening, 2026-08-04: a rejected card may not presuppose a period it does not have.**
   *
   * Found in a browser on `1dfe9b8`, on the state E4-02 made routine (press *Weigeren* on a stale card, which
   * `kalender.beslisVervallen` recommends). The panel closed with *"Daarna kan je het thema een **andere**
   * themaperiode geven"* while the paragraph directly beneath it read *"dit thema staat in **geen enkele
   * periode**"*. *Andere* presupposes exactly what the next sentence denies.
   *
   * **What this pins is the contradiction, not a word.** Asserting `t(key)` against `t(key)` would be the
   * tautology E4-02 was caught writing; asserting the absence of *andere* alone would pass on a card that had
   * stopped mentioning periods altogether. So the assertion is the **conjunction**: the stale card must still
   * carry the "geen enkele periode" clause *and* must not carry the presupposition, and the non-stale card must
   * still carry the informative variant.
   *
   * **Three assertion designs were needed, and the two that failed are the useful record (antagonist rounds 1–3,
   * 2026-08-04).** This docblock twice claimed a reword reintroducing the promise would fail here, and twice it
   * would not:
   *
   * 1. `/andere themaperiode/i` against the rendered text is a contiguous **bigram**, so *"een andere, vrije
   *    themaperiode"* walked through it with 315 passed. (`toContain("geen enkele periode")` does not catch it
   *    either: that clause comes from `weigeringUitlegVervallen`, which this fix never touches.)
   * 2. A five-item **denylist** on the key then fell to *"een volgende themaperiode"* and *"weer een
   *    themaperiode"*, both with 315 passed. A denylist enumerates the offenders someone thought of; the comment
   *    above it claimed no quantifier could get through. **That gap is the recurring defect in this test, not the
   *    copy** — the product string has been correct since the first commit.
   *
   * 3. The **relation** that replaced the denylist was defeated in turn, by rewording the **non-stale** string and
   *    propagating it exactly as the relation demands: *"nog een andere themaperiode"* → *"nog een
   *    themaperiode"*. It constrains the stale string as a function of the other, so it forbids the two drifting
   *    apart and says nothing about what they drift into. It was also a **net regression**, since the denylist
   *    had caught two of those attacks outright.
   *
   * **So what is asserted now is a conjunction, and its coverage is stated rather than claimed:** the relation
   * catches the two strings diverging, and the denylist catches the listed quantifiers however they arrived.
   * **Neither is universal and together they are not either** — a Dutch quantifier outside the list, reworded into
   * the non-stale string and propagated, would still get through. That is the honest boundary. Three rounds of
   * this docblock asserted a universal and three mutations defeated it; the lesson is that a guard of this shape
   * has a boundary, and the comment above it is where the boundary belongs.
   */
  it("does not promise a rejected stale card another themaperiode, and keeps the promise where it is true", async () => {
    const presuppositie = /andere themaperiode/i;

    // **The catalogue property, asserted as a RELATION between the two strings rather than as a list of banned
    // words.** Two assertion designs were defeated before this one: a bigram against the rendered text (*"een
    // andere, vrije themaperiode"*) and then a five-item denylist (*"een volgende themaperiode"*, *"weer een
    // themaperiode"*). Both failed the same way — they enumerated the offenders someone had thought of, under a
    // comment claiming no quantifier could get through. A denylist cannot carry a universal claim.
    //
    // What holds instead: the stale variant **is** the non-stale sentence with exactly the token `andere `
    // removed. Any quantifier added to the stale string breaks the equality whatever word it uses, and any reword
    // of the non-stale string forces the stale one to follow, so the two cannot drift apart silently.
    //
    // *The cost, stated because it is real:* a future story that wants the two sentences to diverge genuinely has
    // to change this assertion. That is the intended behaviour, not friction — divergence here is a decision, and
    // this is what stops it happening by accident.
    expect(t("kalender.weigeringEerstTerugdraaienVervallen")).toBe(
      t("kalender.weigeringEerstTerugdraaien").replace(" andere ", " "),
    );
    // …and the non-stale variant really does carry the quantifier the relation removes, so the equality above
    // cannot be satisfied by both strings simply becoming identical.
    expect(t("kalender.weigeringEerstTerugdraaien")).toMatch(/\bandere\b/i);

    // **The denylist is kept BESIDE the relation, not replaced by it** (antagonist, round 4). The relation
    // constrains the stale string entirely as a function of the non-stale one, so it forbids the two DRIFTING
    // APART but not a quantifier reworded into the non-stale sentence and propagated exactly as the relation
    // demands: *"nog een andere themaperiode"* → *"nog een themaperiode"* satisfies every assertion above.
    // Worse, the relation's failure message actively tells a developer to apply that replacement. So the two
    // guard different axes and are a conjunction: the relation catches drift, this catches known quantifiers
    // however they arrived.
    for (const kwantor of [
      /\bandere\b/i,
      /\bnog een\b/i,
      /\btweede\b/i,
      /\bopnieuw\b/i,
      /\bvrije\b/i,
      /\bweer\b/i,
      /\bvolgende\b/i,
    ]) {
      expect(t("kalender.weigeringEerstTerugdraaienVervallen")).not.toMatch(kwantor);
    }

    const paneelTekst = async (status: "Geweigerd", vervallen: boolean) => {
      stubZoom(
        maakJaarplan([
          maakPlaatsing({
            id: vervallen ? "pv1" : "pv2",
            themaNaam: "Verkeer",
            // **The non-stale start must be a REAL block start of `rooster`** (`2026-09-01` or `2026-11-09`).
            // It was `2026-10-02`, which is neither, so `vervallenPlaatsingen`'s client fallback
            // (`!starts.has(blokStart)`) swept the "card that really is in a period" into the Te herzien notice,
            // and the assertion below then pinned that a card in NO period is promised "een andere themaperiode":
            // the very presupposition this story was reopened over. The fixture was also self-inconsistent, with
            // `blokOrdinaal: 2` beside block 1's end date. Found by the antagonist, 2026-08-04.
            blokStart: vervallen ? "2026-12-01" : "2026-09-01",
            blokEind: vervallen ? null : "2026-11-01",
            blokOrdinaal: vervallen ? null : 1,
            isVervallen: vervallen,
            status,
            aiMotivatie: null,
          }),
        ]),
      );
      const { unmount } = renderKalender();
      const kaart = () => screen.getByText("Verkeer").closest("article") as HTMLElement;
      await screen.findByText("Verkeer");
      fireEvent.click(
        within(kaart()).getByRole("button", {
          name: t("kalender.aanpassenLabel", { thema: "Verkeer" }),
        }),
      );
      const tekst = kaart().textContent ?? "";
      // Pins what each fixture MEANS, rather than trusting a date to stay in step with a stub 2000 lines away.
      // `c27f31f`, the commit that first added this test, set a `blokStart` matching no block, so the "card in a
      // period" was in the Te herzien notice and nobody noticed for a full round, after which the fix was lost for a
      // second (see the worklog): three mutations all aimed at the
      // code and none at the setup. (Named by commit rather than "round 1", because this file uses that phrase for
      // the AUDIT rounds while the worklog uses it for the FIX rounds, and the two do not line up.)
      const herzien = screen.queryByRole("region", { name: t("kalender.herzienTitelEnkelvoud") });
      const inHerzien = herzien !== null && herzien.contains(kaart());
      return { tekst, inHerzien, unmount };
    };

    // The stale card: it says it is in no period, so it may not offer "another" one.
    const stale = await paneelTekst("Geweigerd", true);
    expect(stale.inHerzien).toBe(true);
    expect(stale.tekst).toContain("geen enkele periode");
    expect(stale.tekst).not.toMatch(presuppositie);
    stale.unmount();

    // The card that really is in a period keeps the more informative sentence. Repairing the correct half to fix
    // the broken one is the mistake this project has recorded on itself; this assertion is what forbids it.
    const inPeriode = await paneelTekst("Geweigerd", false);
    expect(inPeriode.inHerzien).toBe(false);
    expect(inPeriode.tekst).toMatch(presuppositie);
    expect(inPeriode.tekst).not.toContain("geen enkele periode");
    inPeriode.unmount();
  });

  /**
   * Fix round 3, MINOR-2 (second half): **the unrecognised-tier degrade may not name a view here either.**
   *
   * `herplaatsAnderNiveau` was false for *every* card in that degrade, rejected or not: moving is withheld because the
   * tier is unreadable, while `bordNiveau` falls back to labelling the board *Themaperiodes*, so the sentence pointed at
   * the view the teacher was already on. The surviving third instance of the round-2 finding, now with its own sentence
   * like the other two.
   */
  it("does not name a view for a stale card when the tier is one it cannot recognise", async () => {
    stubZoom(
      maakJaarplan([
        maakPlaatsing({
          id: "p7",
          themaNaam: "Feesten in december",
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
          status: "Manueel",
          aiMotivatie: null,
        }),
      ]),
      undefined,
      undefined,
      { ...rooster, niveau: "Kwartaal" },
    );
    renderKalender();

    const kaart = () => screen.getByText("Feesten in december").closest("article") as HTMLElement;

    await screen.findByRole("region", { name: t("kalender.herzienTitelEnkelvoud") });
    fireEvent.click(
      within(kaart()).getByRole("button", {
        name: t("kalender.aanpassenLabel", { thema: "Feesten in december" }),
      }),
    );

    expect(within(kaart()).getByText(t("kalender.herplaatsNiveauOnbekend"))).toBeInTheDocument();
    // Neither sentence that names a view, and no picker to point at anyway.
    expect(within(kaart()).queryByText(t("kalender.herplaatsAnderNiveau"))).toBeNull();
    expect(within(kaart()).queryByText(t("kalender.herplaatsKies"))).toBeNull();
    expect(within(kaart()).queryByLabelText(t("kalender.verplaatsNaar"))).toBeNull();
    // Not a view name in sight: the app does not know which of its two views these columns belong to.
    expect(t("kalender.herplaatsNiveauOnbekend")).not.toContain(t("kalender.weergaveGrof"));
    expect(t("kalender.herplaatsNiveauOnbekend")).not.toContain(t("kalender.weergaveFijn"));
  });

  /**
   * The combination nothing had looked at, added at landing after the round-5 audit named it.
   *
   * The second-step clause was gated at the coarse and fine tiers, and the unrecognised-tier degrade was gated with a
   * **`Manueel`** card. So `Geweigerd × stale × niveauOnbekend` — the state in which the clause is least obviously
   * defensible, because the board above it says the tool cannot read this view at all — had no test, and the browser
   * pass that did visit it ran on `56f647e`, *before* the clause existed. The audit's judgement was that the clause is
   * honest-but-unqualified there (it states what becomes possible after the reversal and promises no control), and that
   * the missing pin was the actual gap. This is that pin.
   */
  it("still names the second step on a rejected stale card when the tier is unrecognisable", async () => {
    stubZoom(
      maakJaarplan([
        maakPlaatsing({
          id: "p10",
          themaNaam: "Zomer en vakantie",
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
          status: "Geweigerd",
          aiMotivatie: null,
        }),
      ]),
      undefined,
      undefined,
      { ...rooster, niveau: "Kwartaal" },
    );
    renderKalender();

    const kaart = () => screen.getByText("Zomer en vakantie").closest("article") as HTMLElement;

    await screen.findByRole("region", { name: t("kalender.herzienTitelEnkelvoud") });
    fireEvent.click(
      within(kaart()).getByRole("button", {
        name: t("kalender.aanpassenLabel", { thema: "Zomer en vakantie" }),
      }),
    );

    // The remedy still states both of its steps, and the remedy control is still here.
    expect(within(kaart()).getByText(/daarna[^.]*themaperiode/i)).toBeInTheDocument();
    expect(within(kaart()).getByRole("button", { name: t("kalender.weigeringTerugdraaien") })).toBeInTheDocument();

    // And a rejected card still gets NONE of the three re-placement sentences, this tier included — the rejection
    // withholds them, not the tier, which is the whole point of fix round 3.
    expect(within(kaart()).queryByText(t("kalender.herplaatsNiveauOnbekend"))).toBeNull();
    expect(within(kaart()).queryByText(t("kalender.herplaatsAnderNiveau"))).toBeNull();
    expect(within(kaart()).queryByText(t("kalender.herplaatsKies"))).toBeNull();
    expect(within(kaart()).queryByLabelText(t("kalender.verplaatsNaar"))).toBeNull();
  });

  /**
   * Fix round 3, the control case: **the sentence that DOES name a view must keep naming it.**
   *
   * A `Manueel` stale card at the fine tier is the state where `herplaatsAnderNiveau` is true and useful, and it is the
   * one the test-runner verified in a browser alongside the rejected card. Pinned so the two fixes above cannot be
   * "achieved" by suppressing the sentence everywhere, which would leave a teacher with a stale card and no route.
   */
  it("keeps pointing a re-placeable stale card at the view where the picker really is", async () => {
    stubZoom(
      maakJaarplan([
        maakPlaatsing({
          id: "p6",
          themaNaam: "Licht en donker",
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
          status: "Manueel",
          aiMotivatie: null,
        }),
      ]),
    );
    renderKalender();

    const kaart = () => screen.getByText("Licht en donker").closest("article") as HTMLElement;
    const paneel = () =>
      fireEvent.click(
        within(kaart()).getByRole("button", {
          name: t("kalender.aanpassenLabel", { thema: "Licht en donker" }),
        }),
      );

    await screen.findByRole("region", { name: t("kalender.herzienTitelEnkelvoud") });

    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );
    paneel();

    expect(within(kaart()).getByText(t("kalender.herplaatsAnderNiveau"))).toBeInTheDocument();
    expect(within(kaart()).queryByText(t("kalender.herplaatsNiveauOnbekend"))).toBeNull();
    paneel();

    // The promise is keepable, which is the whole difference from the two states above: press the option it names and
    // the picker is there, offering every themaperiode of the year (a stale card sits in none, so none is excluded).
    fireEvent.click(knop("kalender.weergaveGrof"));
    paneel();
    expect(within(kaart()).getByText(t("kalender.herplaatsKies"))).toBeInTheDocument();
    expect(
      within(within(kaart()).getByLabelText(t("kalender.verplaatsNaar"))).getAllByRole("option"),
    ).toHaveLength(rooster.blokken.length + 1);
  });

  it("has no axe violations at the finer tier", async () => {
    stubZoom(
      maakJaarplan([
        maakPlaatsing({ id: "a", themaNaam: "Water", doelcodes: ["A-1", "A-2"] }),
        maakPlaatsing({ id: "b", themaNaam: "Wonen", status: "Aanvaard", vergrendeld: true }),
      ]),
    );
    const { container } = renderKalender();

    await screen.findByText("Water");
    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  /**
   * E3-09's claim, verified on E3-08's harness because this is where a real fine grid exists.
   *
   * Te vol belongs to the themaperiode tier (owner ruling, 2026-07-31): applied to a fortnight, a thema's whole 4 to 6
   * weeks against the ~2 a sub-block offers flags every filled sub-column, which signals nothing and invites the
   * reading that *this* fortnight is overbooked. So the mark disappears from the columns and the sentence above the
   * board names the periods instead. Both halves matter: losing the mark without gaining the sentence would make
   * zooming in hide a knelpunt.
   */
  it("summarises te vol above the board at the finer zoom instead of marking sub-columns", async () => {
    // 12 weeks of thema's in themaperiode 2, which offers 6. At the fine tier that period is sub-columns 5, 6 and 7.
    const teVol = maakJaarplan([
      maakPlaatsing({
        id: "v1",
        themaNaam: "Licht en donker",
        blokStart: "2026-11-09",
        blokEind: "2026-12-20",
        blokOrdinaal: 2,
        duurWeken: 6,
      }),
      maakPlaatsing({
        id: "v2",
        themaNaam: "Feesten",
        blokStart: "2026-11-09",
        blokEind: "2026-12-20",
        blokOrdinaal: 2,
        duurWeken: 6,
      }),
    ]);
    stubZoom(teVol);
    renderKalender();

    await screen.findByText("Licht en donker");
    // Flagged per column at the coarse tier, which is the state the switch is about to change.
    expect(screen.getByText(t("kalender.teVol", { nodig: 12, beschikbaar: 6 }))).toBeInTheDocument();

    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    // Named above the board, so zooming in does not make the knelpunt disappear.
    expect(
      screen.getByText(t("kalender.teVolEldersEnkelvoud", { ordinalen: "2" })),
    ).toBeInTheDocument();

    // And not inherited by any sub-column: the per-column flag is gone entirely, rather than repeated across the
    // three sub-columns of themaperiode 2.
    expect(screen.queryByText(t("kalender.teVol", { nodig: 12, beschikbaar: 6 }))).toBeNull();
    expect(screen.queryByText(/Te vol: \d+ weken thema/)).toBeNull();
  });

  /**
   * Round-2 audit, MAJOR 1 (E4-01): the copy the owner ruled into that story was first put in
   * `kalender.beslisUitleg`, which renders on **every** tier because a decision is available on every tier. Moving is
   * not: at `Subthemaperiode` the card has no grip and the panel no picker, and at an unrecognised tier nothing can be
   * moved at all. So the sentence instructed a gesture the screen was simultaneously saying was unavailable, in one
   * case one paragraph apart.
   *
   * The clause now lives in `kalender.sleepUitleg`, the `kan` entry of `BORDUITLEG`. **This test pins the property
   * rather than the location**, so moving the clause back would fail it even if the key names stayed put: what may
   * not happen is a promise that a verplaatsing makes a thema count, on a tier where a verplaatsing is refused.
   *
   * *Kept beside E3-09's test above rather than merged with it (merge of `origin/main`, 2026-08-05).* Both stories
   * appended a test at this spot and git wove them into one hybrid that asserted neither claim. They share only the
   * zoom gesture; the claims are independent, so both survive.
   */
  it("promises the count-by-moving consequence only on the tier where moving works", async () => {
    // The distinctive tail of the clause, so this test does not depend on which key carries it.
    const gevolg = /telt het vanaf dan mee voor de dekking/;

    stubZoom(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();
    await screen.findByText("Water");

    // The premise: at the generation tier the promise is on screen, beside a card that really can be dragged.
    expect(screen.getByText(gevolg)).toBeInTheDocument();

    fireEvent.click(knop("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    // Gone with the affordance. The decision explanation stays, because deciding still works here: that asymmetry is
    // the whole reason the clause had to move out of it.
    expect(screen.queryByText(gevolg)).toBeNull();
    expect(screen.getByText(t("kalender.beslisUitleg"))).toBeInTheDocument();
    expect(screen.getByText(t("kalender.fijnUitleg"))).toBeInTheDocument();
  });
});

/**
 * E4-02 — the decision surface the kalender never had (FR-7.1, Art. IV.1/IV.2).
 *
 * Before this story `Themakaart` could send exactly one status, `Manueel`, from the un-reject button, so **neither
 * `Aanvaard` nor `Geweigerd` was reachable**: the server, the endpoint, `api.ts`, the hook and the status badge all
 * existed and no control drove them. The consequence was not cosmetic. Only `Aanvaard`/`Manueel` count as placed
 * (Art. V.1, and E5-01 now implements it), so a freshly generated jaarplan reported 0% dekking and the only route to
 * a figure was dragging every card, which sets `Manueel` as a side effect of moving it somewhere it need not go.
 *
 * Driven through the fetch boundary like every other test here, so a decision travels the real hook, the real
 * `PUT`, and the real cache write that re-renders the board. Asserting the request alone would prove the button is
 * wired and prove nothing about what the teacher then sees, which is the gap E5-01's audit called out.
 */
describe("Jaarplankalender — aanvaarden en weigeren (E4-02, FR-7.1)", () => {
  /** The decision buttons on one card, queried by their per-thema accessible name. */
  function beslissing(themaNaam: string) {
    const binnen = within(kaart(themaNaam));

    return {
      aanvaarden: binnen.queryByRole("button", {
        name: t("kalender.aanvaardenLabel", { thema: themaNaam }),
      }),
      weigeren: binnen.queryByRole("button", {
        name: t("kalender.weigerenLabel", { thema: themaNaam }),
      }),
    };
  }

  it("accepts a proposal, sends Aanvaard, and shows the new status on the card", async () => {
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const naPlan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
    ]);
    const verzoeken = stubBewerking(plan, naPlan);
    renderKalender();

    await screen.findByText("Water");

    // The decision is on the card FACE, reachable without opening "Aanpassen". That is the point of the story:
    // reviewing a dozen proposals must not mean opening a dozen disclosures.
    fireEvent.click(beslissing("Water").aanvaarden!);

    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(verzoeken[0].method).toBe("PUT");
    expect(verzoeken[0].url).toMatch(/\/jaarplan\/plaatsingen\/p1\/status$/);
    expect(verzoeken[0].body).toEqual({ status: "Aanvaard" });

    // And the board reports the decision back, from the server's response rather than an optimistic guess.
    expect(
      await within(kaart("Water")).findByText(t("suggestieStatus.aanvaard")),
    ).toBeInTheDocument();
    // The decision is made, so the card stops asking for one.
    await waitFor(() => expect(beslissing("Water").aanvaarden).toBeNull());
    expect(beslissing("Water").weigeren).toBeNull();
  });

  it("rejects a proposal and sends Geweigerd", async () => {
    const plan = maakJaarplan([maakPlaatsing({ id: "p2", themaNaam: "Wonen" })]);
    const naPlan = maakJaarplan([
      maakPlaatsing({ id: "p2", themaNaam: "Wonen", status: "Geweigerd" }),
    ]);
    const verzoeken = stubBewerking(plan, naPlan);
    renderKalender();

    await screen.findByText("Wonen");
    fireEvent.click(beslissing("Wonen").weigeren!);

    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(verzoeken[0].body).toEqual({ status: "Geweigerd" });

    // `Geweigerd` was unreachable before this story, which made the whole rejected-card branch
    // (`weigeringUitleg`, the suppressed period picker, the un-reject button) code for a state no teacher could
    // produce. This assertion is what connects the two halves.
    expect(
      await within(kaart("Wonen")).findByText(t("suggestieStatus.geweigerd")),
    ).toBeInTheDocument();
    fireEvent.click(aanpassen("Wonen"));
    expect(
      within(kaart("Wonen")).getByRole("button", { name: t("kalender.weigeringTerugdraaien") }),
    ).toBeInTheDocument();
  });

  it("announces the decision to a screen reader, from a region the decision does not unmount", async () => {
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const naPlan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
    ]);
    stubBewerking(plan, naPlan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(beslissing("Water").aanvaarden!);

    // WCAG 2.2 SC 4.1.3. The badge changing text is silent, and the buttons that caused the change unmount in the
    // same render, so the live region has to live outside them — E4-06 shipped this exact fix inside the lock
    // section, found it silent in the one case that mattered, and moved it out. Pinned here so it cannot regress by
    // someone tidying the region into the block it reports on.
    await waitFor(() =>
      expect(
        within(kaart("Water"))
          .getAllByRole("status")
          .map((regio) => regio.textContent),
      ).toContain(t("kalender.beslisAanvaard", { thema: "Water" })),
    );
  });

  it("offers no decision on a placement the teacher already decided", async () => {
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
      maakPlaatsing({ id: "p2", themaNaam: "Wonen", status: "Manueel", aiMotivatie: null }),
      maakPlaatsing({ id: "p3", themaNaam: "Weer", status: "Geweigerd" }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");

    for (const thema of ["Water", "Wonen", "Weer"]) {
      expect(beslissing(thema).aanvaarden, `${thema} still offers Aanvaarden`).toBeNull();
      expect(beslissing(thema).weigeren, `${thema} still offers Weigeren`).toBeNull();
    }
  });

  it("lets a STALE proposal be rejected but not accepted, and says why", async () => {
    const plan = maakJaarplan([
      maakPlaatsing({
        id: "p9",
        themaNaam: "Feesten in december",
        blokStart: "2026-12-01",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Voorgesteld",
      }),
    ]);
    // `naPlan` matters: with the default the PUT returns the UNCHANGED plan, so the `Geweigerd x stale` screen this
    // button creates would never be rendered by any test — which is how the re-audit's weigeringUitleg MAJOR got
    // through. This describe block's own rule: asserting the request alone proves the button is wired and proves
    // nothing about what the teacher then sees.
    const naPlan = maakJaarplan([
      maakPlaatsing({
        id: "p9",
        themaNaam: "Feesten in december",
        blokStart: "2026-12-01",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Geweigerd",
      }),
    ]);
    const verzoeken = stubBewerking(plan, naPlan);
    renderKalender();

    await screen.findByText("Feesten in december");

    // **Accepting is withheld**, on the reasoning E4-06 established for the lock: it would produce a card labelled
    // "Aanvaard" that covers nothing and STILL withholds the whole dekking figure, since E5-01 withholds it while any
    // unresolved stale placement exists. A decision that resolves nothing, dressed as one that did.
    expect(beslissing("Feesten in december").aanvaarden).toBeNull();

    // **Rejecting is offered, and this story's first version wrongly withheld it too** by carrying the accept
    // argument across to a case it does not describe. `DekkingService` counts `IsVervallen && !IsGeweigerd` as
    // unresolved, so a weigering is precisely what RESOLVES a stale proposal and restores the withheld figure. Without
    // it, saying "no" to a stale proposal had two routes and both were wrong: re-placing sets `Manueel`, which makes
    // the thema COUNT, and "Uit het jaarplan halen" is unrecoverable.
    const weigeren = beslissing("Feesten in december").weigeren;
    expect(weigeren).not.toBeNull();
    fireEvent.click(weigeren!);
    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(verzoeken[0].body).toEqual({ status: "Geweigerd" });

    // What the teacher then sees, which is the half the first version of this test skipped.
    expect(
      await within(kaart("Feesten in december")).findByText(t("suggestieStatus.geweigerd")),
    ).toBeInTheDocument();
  });

  it("explains on the stale card itself why it offers no aanvaarden", async () => {
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water" }),
      maakPlaatsing({
        id: "p9",
        themaNaam: "Feesten in december",
        blokStart: "2026-12-01",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Voorgesteld",
      }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Feesten in december");

    // A missing button with no sentence is a silent omission, and the line above the board would otherwise be telling
    // this teacher to do something this card does not let them do. Scoped to the stale card and absent from the
    // healthy one, because a sentence that is true of one state and false of its neighbour is the defect class that
    // dominated E4-06's three audit rounds. Same treatment `vergrendelUitlegVervallen` already gives the lock.
    expect(
      within(kaart("Feesten in december")).getByText(t("kalender.beslisVervallen")),
    ).toBeInTheDocument();
    expect(
      within(kaart("Water")).queryByText(t("kalender.beslisVervallen")),
    ).toBeNull();
  });

  it("states the dekking rule once above the board, not on every card", async () => {
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water" }),
      maakPlaatsing({ id: "p2", themaNaam: "Wonen" }),
      maakPlaatsing({ id: "p3", themaNaam: "Weer" }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");

    // Pinned because the audit could delete this sentence and leave all 304 tests green (it is the one string
    // carrying the Art. V.1 claim to a teacher, and the dead-key guard in `catalogus.test.ts` covers only `doelen.*`).
    // Asserted as "exactly once, and outside the cards", which is the property that makes it worth having: three
    // proposals must not produce three copies of it.
    const overal = screen.getAllByText(t("kalender.beslisUitleg"));
    expect(overal).toHaveLength(1);
    expect(overal[0].closest("article")).toBeNull();
  });

  it("announces a rejection and an un-rejection, not only an acceptance", async () => {
    // The acceptance branch is covered above. These two were NOT, and the audit proved it by mutation: swapping
    // `beslisGeweigerd` for `beslisManueel`, and deleting both branches outright, each left the suite green — while
    // the worklog claimed the un-reject announcement as a delivered SC 4.1.3 fix. A claim no test can falsify is the
    // defect class this file's own E3-08 comment warns about.
    const voorstel = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const geweigerd = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Geweigerd" }),
    ]);
    const verzoeken = stubBewerking(voorstel, geweigerd);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(beslissing("Water").weigeren!);

    await waitFor(() =>
      expect(
        within(kaart("Water"))
          .getAllByRole("status")
          .map((regio) => regio.textContent),
      ).toContain(t("kalender.beslisGeweigerd", { thema: "Water" })),
    );
    // Distinct from the un-rejection sentence, which is the mutation that survived.
    expect(
      within(kaart("Water"))
        .getAllByRole("status")
        .map((regio) => regio.textContent),
    ).not.toContain(t("kalender.beslisManueel", { thema: "Water" }));
    expect(verzoeken[0].body).toEqual({ status: "Geweigerd" });
  });

  it("announces an un-rejection from the panel's own button", async () => {
    const geweigerd = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Geweigerd" }),
    ]);
    const manueel = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Manueel" }),
    ]);
    stubBewerking(geweigerd, manueel);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));
    fireEvent.click(
      within(kaart("Water")).getByRole("button", { name: t("kalender.weigeringTerugdraaien") }),
    );

    // The announcement E4-02 added to a control it did not otherwise change: before this story the un-reject was
    // silent to a screen reader, and the badge flipping from "Geweigerd" to "Manueel" announces nothing.
    await waitFor(() =>
      expect(
        within(kaart("Water"))
          .getAllByRole("status")
          .map((regio) => regio.textContent),
      ).toContain(t("kalender.beslisManueel", { thema: "Water" })),
    );
  });

  it("tells the teacher to reload when the placement is gone, rather than to try again", async () => {
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const verzoeken = stubBewerking(plan, plan, 404);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(beslissing("Water").aanvaarden!);

    await waitFor(() => expect(verzoeken).toHaveLength(1));

    // A 404 means this browser is looking at a stale board and reloading fixes it; "probeer het opnieuw" would send
    // the teacher round a loop that cannot succeed. Two audits (E3-07 on the move path, E4-06 on the lock) have
    // already required this split of a control in this card, so the third one is built with it rather than after it.
    expect(await screen.findByText(t("kalender.statusVerdwenen"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.statusMislukt"))).toBeNull();
    // And no server string reaches the teacher (Art. II.3, the `api.ts` rule).
    expect(screen.queryByText(/Ongeldige aanvraag/)).toBeNull();
  });

  /**
   * Serves the reads but leaves the write **open**, so the in-flight window can be asserted instead of raced.
   *
   * Returned as a helper because the test below runs it in both directions, and that is not symmetry for its own
   * sake: the first version clicked "Weigeren" only, and a mutation that dropped the `variables` guard from the
   * **Aanvaarden** branch left the whole suite green. A test that pins one direction of a two-way rule is half a
   * test, and this one advertised itself as "never both".
   */
  function stubOpenWrite(plan: Jaarplan) {
    let laatDoor: (() => void) | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if ((init?.method ?? "GET") !== "GET") {
          await new Promise<void>((resolve) => {
            laatDoor = resolve;
          });

          return new Response(JSON.stringify(plan), { status: 200 });
        }

        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify([{ id: "t0", naam: "Herfst" }]), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(
            JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }),
            { status: 200 },
          );
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify(rooster), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(plan), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );

    return () => laatDoor?.();
  }

  it.each([
    { geklikt: "aanvaarden", ander: "weigeren", anderLabel: "kalender.weigeren" },
    { geklikt: "weigeren", ander: "aanvaarden", anderLabel: "kalender.aanvaarden" },
  ] as const)(
    "says only the clicked decision is busy when $geklikt is pressed, never both",
    async ({ geklikt, ander, anderLabel }) => {
      const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
      const laatDoor = stubOpenWrite(plan);

      renderKalender();
      await screen.findByText("Water");
      fireEvent.click(beslissing("Water")[geklikt]!);

      // `isPending` alone would put "Bezig…" on BOTH buttons, which tells the teacher the tool is doing something it
      // is not. The label is keyed on the mutation's in-flight `variables`, so it names the request that exists.
      // This is the mistake E4-06 fixed on the lock toggle, arriving one story later in a new control.
      await waitFor(() =>
        expect(beslissing("Water")[geklikt]).toHaveTextContent(t("kalender.bezig")),
      );
      expect(beslissing("Water")[ander]).toHaveTextContent(t(anderLabel));
      // Both are disabled while a write is open, which is a different claim from both being busy.
      expect(beslissing("Water")[ander]).toBeDisabled();

      laatDoor();
    },
  );

  it("tells a rejected STALE card that reversing it does not give it a period", async () => {
    // The re-audit's sharpest finding, and it is this story's own doing. `weigeringUitleg` (E4-06) closes with "het
    // thema komt dan als jouw eigen keuze in deze themaperiode" — true inside a real period, false here, because
    // un-rejecting yields `Manueel` with `isVervallen` still true. Before E4-02 that state needed a rejection AND a
    // vakantie edit; now "Weigeren" is on the stale card and `beslisVervallen` recommends it, so the false promise
    // became the advertised destination. It also contradicted `weigeringEerstTerugdraaien` on the same card.
    const plan = maakJaarplan([
      maakPlaatsing({
        id: "p9",
        themaNaam: "Feesten in december",
        blokStart: "2026-12-01",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Geweigerd",
      }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Feesten in december");
    fireEvent.click(aanpassen("Feesten in december"));

    const paneel = within(kaart("Feesten in december"));
    expect(paneel.getByText(t("kalender.weigeringUitlegVervallen"))).toBeInTheDocument();
    expect(paneel.queryByText(t("kalender.weigeringUitleg"))).toBeNull();
    // The scoping E4-06 made load-bearing survives the split: idempotence is per (thema, niveau, blokStart), so the
    // AI may still propose this thema elsewhere, and both variants must keep saying "hier".
    expect(t("kalender.weigeringUitlegVervallen")).toContain("hier");
    expect(t("kalender.weigeringUitlegVervallen")).toContain("hergeneratie van het hele jaarplan");

    // **The property this split exists for, asserted on the content rather than on which key renders where.**
    // Everything above is either a `t(key)`-versus-`t(key)` check (which variant is on which card) or a property
    // INHERITED from E4-06, so re-introducing the false promise into this string left the whole suite green when the
    // round-3 auditor tried it. Third round running that a fix's defining property turned out to be unfalsifiable,
    // so it is pinned negatively AND positively: the sentence must not promise the card a period it does not have,
    // and it must say it has none. Both halves matter — a rewrite that merely drops the phrase would satisfy the
    // first line alone while telling the teacher nothing.
    expect(t("kalender.weigeringUitlegVervallen")).not.toContain("in deze themaperiode");
    expect(t("kalender.weigeringUitlegVervallen")).toContain("geen periode");
    // And the variant for a card that DOES have its period still makes exactly that promise, so this pair cannot be
    // satisfied by flattening the two strings into one cautious sentence.
    expect(t("kalender.weigeringUitleg")).toContain("in deze themaperiode");
  });

  it("keeps the E4-06 wording for a rejected card that still has its period", async () => {
    // The other half of the split, so neither variant can quietly take over the other's state.
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Geweigerd" }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    const paneel = within(kaart("Water"));
    expect(paneel.getByText(t("kalender.weigeringUitleg"))).toBeInTheDocument();
    expect(paneel.queryByText(t("kalender.weigeringUitlegVervallen"))).toBeNull();
  });

  it("does not promise the dekking condition on a stale proposal's lock section", async () => {
    // Mutation M9 in the re-audit: dropping `!isVervallen` from this paragraph's guard left all 308 tests green.
    // The reword made losing it worse than it used to be — "Aanvaard het thema als het moet meetellen" names a
    // button that is NOT on a stale card, where the old conditional phrasing would merely have been vague.
    const plan = maakJaarplan([
      maakPlaatsing({
        id: "p9",
        themaNaam: "Feesten in december",
        blokStart: "2026-12-01",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Voorgesteld",
        vergrendeld: true,
      }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Feesten in december");
    fireEvent.click(aanpassen("Feesten in december"));

    const paneel = within(kaart("Feesten in december"));
    // Locked, so the lock section renders and the sentence's siblings are on screen; the dekking line must not be.
    expect(paneel.getByText(t("kalender.vergrendelUitlegVervallen"))).toBeInTheDocument();
    expect(paneel.queryByText(t("kalender.vergrendelDekking"))).toBeNull();
    // And it IS shown on the state it was written for, so this test cannot pass by the paragraph never rendering.
    expect(beslissing("Feesten in december").aanvaarden).toBeNull();
  });

  it("reports a failed decision on a stale card too, not only on a healthy one", async () => {
    // Mutation M10 in the re-audit: re-gating the face error on `magAanvaarden` left all 308 tests green, so a failed
    // weigering on a stale card would have failed **silently** — no alert, no reload advice. The third thing the
    // split flags gate had no test on the state the split created.
    const plan = maakJaarplan([
      maakPlaatsing({
        id: "p9",
        themaNaam: "Feesten in december",
        blokStart: "2026-12-01",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Voorgesteld",
      }),
    ]);
    const verzoeken = stubBewerking(plan, plan, 404);
    renderKalender();

    await screen.findByText("Feesten in december");
    fireEvent.click(beslissing("Feesten in december").weigeren!);

    await waitFor(() => expect(verzoeken).toHaveLength(1));
    expect(
      await within(kaart("Feesten in december")).findByText(t("kalender.statusVerdwenen")),
    ).toBeInTheDocument();
  });

  it("drops the decision explanation once every proposal has been decided", async () => {
    // Re-audit residue of MAJOR-2: removing the quantifier fixed the stale card, not a board with nothing left to
    // decide. The design deliberately empties the board as the teacher works, so on a fully decided plan the
    // sentence described controls that were nowhere on screen.
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
      maakPlaatsing({ id: "p2", themaNaam: "Wonen", status: "Geweigerd" }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Water");

    expect(screen.queryByText(t("kalender.beslisUitleg"))).toBeNull();
    // Not vacuous: the cards are on screen, they just have nothing outstanding.
    expect(beslissing("Water").aanvaarden).toBeNull();
    expect(beslissing("Wonen").weigeren).toBeNull();
  });

  it("keeps the decision explanation while a STALE proposal is the only thing outstanding", async () => {
    // The counterpart, and the reason `openBeslissingen` counts the plan rather than the grid: a stale proposal sits
    // in no block, and it is still a decision the teacher owes.
    const plan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
      maakPlaatsing({
        id: "p9",
        themaNaam: "Feesten in december",
        blokStart: "2026-12-01",
        blokEind: null,
        blokOrdinaal: null,
        isVervallen: true,
        status: "Voorgesteld",
      }),
    ]);
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Feesten in december");
    expect(screen.getAllByText(t("kalender.beslisUitleg"))).toHaveLength(1);
  });
});

describe("Jaarplankalender — een thema met de hand plannen (E4-03, FR-7.2)", () => {
  const BIBLIOTHEEK = [
    { id: "t-herfst", naam: "Herfst" },
    { id: "t-water", naam: "Water" },
  ];

  /**
   * The board plus the school's thema-bibliotheek, recording every hand-placement POST so the *request* can be
   * asserted rather than only its effect.
   *
   * Its own stub rather than another parameter on `stubFetch`: that helper is shared by 72 tests here and its branch
   * order is load-bearing, with three comments in it recording what a mis-ordered branch cost.
   */
  function stubPlaatsen(
    jaarplan: Jaarplan,
    themas: { id: string; naam: string }[] = BIBLIOTHEEK,
    antwoord: Jaarplan | number = jaarplan,
  ) {
    const posts: { url: string; body: unknown }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        // Before the plain `/jaarplan` branch, which this URL extends — the mistake this file's comments record.
        if (init?.method === "POST" && url.includes("/jaarplan/plaatsingen")) {
          posts.push({ url, body: JSON.parse(String(init.body)) });

          return typeof antwoord === "number"
            ? new Response(JSON.stringify({ title: "Ongeldige aanvraag", detail: "…" }), {
                status: antwoord,
              })
            : new Response(JSON.stringify(antwoord), { status: 200 });
        }
        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify(themas), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), {
            status: 200,
          });
        }
        if (url.includes("/rooster")) {
          const fijn = url.includes("niveau=Subthemaperiode");

          return new Response(
            JSON.stringify(
              fijn
                ? {
                    ...rooster,
                    niveau: "Subthemaperiode",
                    blokken: [
                      {
                        ordinaal: 1,
                        start: "2026-09-01",
                        eind: "2026-09-16",
                        ouderOrdinaal: 1,
                        aantalOpenDagen: 16, aantalOpenWeekdagen: 11,
                      },
                    ],
                  }
                : rooster,
            ),
            { status: 200 },
          );
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(jaarplan), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );

    return posts;
  }

  /** One period's trigger, found by the accessible name that distinguishes it from its siblings. */
  const toevoegknop = (ordinaal: number) =>
    screen.getByRole("button", { name: t("kalender.plaatsToevoegenLabel", { ordinaal }) });

  /** Opens the picker of one period and returns its select. */
  async function openKiezer(ordinaal: number) {
    fireEvent.click(toevoegknop(ordinaal));

    return screen.findByLabelText(t("kalender.plaatsKies"));
  }

  /**
   * <b>The story's own criterion: a plan built from nothing, with no generation run.</b> An empty jaarplan is exactly
   * the state a class is in before anyone presses generate, and until E4-03 the board offered it no action at all.
   * The <i>request</i> is asserted and not just the effect, because the thing that must never regress is what gets
   * sent: the period's <b>start date</b>, never its ordinal (ADR-0020 §3).
   */
  it("plans a thema into an empty plan and keys the request on the block START DATE", async () => {
    const posts = stubPlaatsen(maakJaarplan([]));
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    expect(toevoegknop(1)).toBeInTheDocument();
    expect(toevoegknop(2)).toBeInTheDocument();

    const keuze = await openKiezer(2);
    fireEvent.change(keuze, { target: { value: "t-water" } });
    fireEvent.click(screen.getByRole("button", { name: t("kalender.plaatsen") }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].url).toContain(`/api/klassen/${KLAS_ID}/jaarplan/plaatsingen`);
    // Period 2 starts on 2026-11-09. The ordinal is a display position that shifts when the school edits a vakantie,
    // so sending "2" would reintroduce the silent relocation the date key exists to prevent.
    expect(posts[0].body).toEqual({ themaId: "t-water", blokStart: "2026-11-09" });
  });

  /**
   * The annotation that is the reason this is not a plain list of names: it tells the teacher where a thema already
   * sits in the year <b>before</b> they plan it a second time by accident.
   */
  it("says which other period a thema is already in, and withholds the one already here", async () => {
    stubPlaatsen(
      maakJaarplan([
        maakPlaatsing({ id: "p1", themaId: "t-herfst", themaNaam: "Herfst", blokStart: "2026-09-01" }),
      ]),
    );
    renderKalender();

    await screen.findByText("Herfst");

    const keuze = await openKiezer(2);
    expect(
      within(keuze).getByRole("option", {
        name: t("kalender.plaatsThemaKeuzeElders", { naam: "Herfst", ordinaal: 1 }),
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t("kalender.annuleren") }));

    // In period 1, where it already sits, it is offered as a DISABLED option that says so. Fix round 1 changed this
    // from omitting it: a teacher looking at that thema's card in this very column found it simply absent from the
    // picker, with nothing explaining why. The server refuses it with a 400, so it must not be selectable either.
    const keuzeHier = await openKiezer(1);
    const alHier = within(keuzeHier).getByRole("option", {
      name: t("kalender.plaatsThemaKeuzeHier", { naam: "Herfst" }),
    });
    expect(alHier).toBeDisabled();
    expect(within(keuzeHier).getByRole("option", { name: "Water" })).toBeEnabled();
  });

  /**
   * <b>Status-blind, matching the server's own duplicate guard.</b> `Jaarplan.IsAlGeplaatst` matches on
   * `(themaId, niveau, blokStart)` and on no status, so a <b>rejected</b> card still occupies the slot. Reaching for
   * `geplandeIn` here — which drops `Geweigerd`, and which every other count on this board uses — would offer an
   * option that can only answer 400, while telling the teacher a period is free that visibly holds a card.
   */
  it("treats a REJECTED placement as still occupying the period", async () => {
    stubPlaatsen(
      maakJaarplan([
        maakPlaatsing({
          id: "p1",
          themaId: "t-herfst",
          themaNaam: "Herfst",
          blokStart: "2026-09-01",
          status: "Geweigerd",
        }),
      ]),
    );
    renderKalender();

    await screen.findByText("Herfst");
    const keuze = await openKiezer(1);

    expect(
      within(keuze).getByRole("option", {
        name: t("kalender.plaatsThemaKeuzeHier", { naam: "Herfst" }),
      }),
    ).toBeDisabled();
  });

  /** A school with no thema's gets a sentence naming where thema's come from, not an empty picker. */
  it("says where thema's come from when the school has none", async () => {
    stubPlaatsen(maakJaarplan([]), []);
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    fireEvent.click(toevoegknop(1));

    expect(await screen.findByText(t("kalender.plaatsGeenThemas"))).toBeInTheDocument();
    // No dead control: there is nothing to submit, so nothing offers to (the E3-06 rule).
    expect(screen.queryByRole("button", { name: t("kalender.plaatsen") })).toBeNull();
  });

  /** Every thema already here is not a failure and not an empty list: it is a state with its own sentence. */
  it("says so when this period already holds every thema the school has", async () => {
    stubPlaatsen(
      maakJaarplan([
        maakPlaatsing({ id: "p1", themaId: "t-herfst", themaNaam: "Herfst", blokStart: "2026-09-01" }),
        maakPlaatsing({ id: "p2", themaId: "t-water", themaNaam: "Water", blokStart: "2026-09-01" }),
      ]),
    );
    renderKalender();

    await screen.findByText("Herfst");
    fireEvent.click(toevoegknop(1));

    expect(await screen.findByText(t("kalender.plaatsAllesAlHier"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("kalender.plaatsen") })).toBeNull();
  });

  /**
   * A refused placement gets the sentence that tells the teacher to look again; it also keeps the panel open, so
   * they read why instead of watching the control disappear.
   */
  it("keeps the picker open and explains a refused placement", async () => {
    stubPlaatsen(maakJaarplan([]), undefined, 400);
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    fireEvent.change(await openKiezer(1), { target: { value: "t-water" } });
    fireEvent.click(screen.getByRole("button", { name: t("kalender.plaatsen") }));

    expect(await screen.findByText(t("kalender.plaatsMislukt"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("kalender.plaatsen") })).toBeInTheDocument();
  });

  /**
   * A broken tool gets a different sentence, which is the split the move path had to learn the hard way: branching
   * on `isError` alone told a teacher to look again when the tool was down, a retry that cannot succeed.
   */
  it("tells an unavailable tool apart from a refused placement", async () => {
    stubPlaatsen(maakJaarplan([]), undefined, 503);
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    fireEvent.change(await openKiezer(1), { target: { value: "t-water" } });
    fireEvent.click(screen.getByRole("button", { name: t("kalender.plaatsen") }));

    expect(await screen.findByText(t("kalender.plaatsOnbeschikbaar"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.plaatsMislukt"))).toBeNull();
  });

  /**
   * At the fine tier the control is <b>absent</b>, not disabled, and the board says where it works instead (the
   * E3-06 rule). Deliberately the same `verplaatsstaat` the move affordance uses: a placement keys on a
   * themaperiode start, so planning into a fortnight would record five weeks.
   */
  it("withholds hand-planning at the finer tier and says where it works", async () => {
    stubPlaatsen(maakJaarplan([]));
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.plaatsAnderNiveau"))).toBeNull();

    fireEvent.click(
      within(screen.getByRole("group", { name: t("kalender.weergaveLabel") })).getByRole("button", {
        name: t("kalender.weergaveFijn"),
      }),
    );

    expect(await screen.findByText(t("kalender.plaatsAnderNiveau"))).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("kalender.plaatsToevoegenLabel", { ordinaal: 1 }) }),
    ).toBeNull();
  });

  /**
   * SC 2.5.3 (Label in Name): the accessible name must <i>contain</i> the visible label, or speech control cannot
   * address the button. Asserted explicitly because <b>a jsdom axe run cannot fail on this</b> — axe returns
   * `label-content-name-mismatch` as *incomplete* and `toHaveNoViolations` reads only violations, which is exactly
   * where two of E1-14's WCAG defects sat.
   */
  it("keeps the visible label inside each period's accessible name", async () => {
    stubPlaatsen(maakJaarplan([]));
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();

    for (const ordinaal of [1, 2]) {
      expect(toevoegknop(ordinaal).textContent).toContain(t("kalender.plaatsToevoegen"));
      expect(t("kalender.plaatsToevoegenLabel", { ordinaal })).toContain(
        t("kalender.plaatsToevoegen"),
      );
    }
  });

  /**
   * <b>Focus comes back to the trigger when the picker closes.</b>
   *
   * This test exists because the first version shipped a defect no test could see and a browser found in one probe:
   * `sluit()` called `trigger.current?.focus()` directly, and `setOpen(false)` is batched, so at that moment the
   * trigger was still unmounted and the ref was null. Focus fell to `<body>` and a keyboard user pressing
   * "Annuleren" lost their place on a board that scrolls sideways, while the code comment claimed the opposite.
   *
   * Asserted on both exits, because both go through the same path: cancelling, and a successful placement.
   */
  it("returns focus to the trigger when the picker closes", async () => {
    stubPlaatsen(maakJaarplan([]));
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();

    // Cancelling.
    await openKiezer(2);
    fireEvent.click(screen.getByRole("button", { name: t("kalender.annuleren") }));
    await waitFor(() => expect(document.activeElement).toBe(toevoegknop(2)));

    // And a successful placement, which closes through the same function.
    fireEvent.change(await openKiezer(2), { target: { value: "t-water" } });
    fireEvent.click(screen.getByRole("button", { name: t("kalender.plaatsen") }));
    await waitFor(() => expect(document.activeElement).toBe(toevoegknop(2)));
  });

  /**
   * <b>Focus moves INTO the panel when it opens, not only back out when it closes.</b>
   *
   * The trigger is unmounted while the panel is open, so opening has the same hazard as closing: without a move,
   * focus stays on a detached node and a keyboard user is stranded. The close direction was found in a browser and
   * fixed; this direction was carried entirely by React's `autoFocus` with nothing pinning it, and `autoFocus` is the
   * only occurrence of that prop in the codebase with no lint rule guarding it. Raised by the fix-round-1 audit as
   * exactly the gap the story's headline finding should have taught me to close on both sides.
   */
  it("moves focus into the picker when it opens", async () => {
    stubPlaatsen(maakJaarplan([]));
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    const keuze = await openKiezer(2);

    await waitFor(() => expect(document.activeElement).toBe(keuze));
  });

  /**
   * A thema deleted while this picker held a cached list is a <b>404</b>, and the teacher can fix it by reloading.
   * The first version answered it with "meld dit aan de beheerder", advice nobody can act on for a recoverable
   * situation; `Themakaart` already had the right precedent. Three branches now, so this test and the two beside it
   * pin all three.
   */
  it("tells a deleted thema apart from a refused placement and a broken tool", async () => {
    stubPlaatsen(maakJaarplan([]), undefined, 404);
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    fireEvent.change(await openKiezer(1), { target: { value: "t-water" } });
    fireEvent.click(screen.getByRole("button", { name: t("kalender.plaatsen") }));

    expect(await screen.findByText(t("kalender.plaatsThemaVerdwenen"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.plaatsMislukt"))).toBeNull();
    expect(screen.queryByText(t("kalender.plaatsOnbeschikbaar"))).toBeNull();
  });

  /**
   * A failed library load offers a real retry, because the sentence tells the teacher to try again and the E3-06 rule
   * forbids an instruction pointing at nothing. Reuses the board's own `roosterOpnieuw` copy rather than a new string.
   */
  it("offers a retry when the thema list fails to load", async () => {
    let faal = true;
    const posts: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "POST") {
          posts.push(url);
          return new Response(JSON.stringify(maakJaarplan([])), { status: 200 });
        }
        if (url.includes("/api/themas")) {
          if (faal) {
            faal = false;
            return new Response("boom", { status: 500 });
          }
          return new Response(JSON.stringify(BIBLIOTHEEK), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), {
            status: 200,
          });
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify(rooster), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(maakJaarplan([])), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );
    renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    fireEvent.click(toevoegknop(1));

    expect(await screen.findByText(t("kalender.plaatsThemasFout"))).toBeInTheDocument();

    // The retry is a control, not just an instruction, and pressing it recovers into a usable picker.
    fireEvent.click(screen.getByRole("button", { name: t("kalender.roosterOpnieuw") }));

    expect(await screen.findByLabelText(t("kalender.plaatsKies"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.plaatsThemasFout"))).toBeNull();
  });

  /**
   * The third <code>Verplaatsstaat</code>: a tier the app does not recognise. `Planningsrooster.niveau` is a plain
   * `string` on purpose (it is what the server said, not what this app hopes), so an unknown value is a real branch
   * and it gets its own sentence rather than borrowing the fine tier's, which would send the teacher to a view they
   * may already be on. Added in fix round 1 after the test-runner reported this `PLAATSUITLEG` entry as the one
   * unexercised branch — coverage rather than a suspected defect, which is exactly why it is cheap to close.
   */
  it("says hand-planning is unavailable when the tier is unrecognised, without naming another view", async () => {
    stubPlaatsen(maakJaarplan([]));
    // The server answers a tier this app has no name for. `stubPlaatsen` serves `rooster` for anything that is not
    // the fine tier, so overriding its `niveau` is enough.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify(BIBLIOTHEEK), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), {
            status: 200,
          });
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify({ ...rooster, niveau: "Kwartaal" }), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(maakJaarplan([])), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );
    renderKalender();

    expect(await screen.findByText(t("kalender.plaatsNiveauOnbekend"))).toBeInTheDocument();
    // Not the fine tier's sentence, which names "de weergave Themaperiodes" and would be an instruction the teacher
    // cannot act on here.
    expect(screen.queryByText(t("kalender.plaatsAnderNiveau"))).toBeNull();
    // And no control, since there is no tier to plan into.
    expect(
      screen.queryByRole("button", { name: t("kalender.plaatsToevoegenLabel", { ordinaal: 1 }) }),
    ).toBeNull();
  });

  /** The picker itself, with the panel open, has to survive an axe structure check like every other panel here. */
  it("has no axe violations with the picker OPEN", async () => {
    stubPlaatsen(maakJaarplan([]));
    const { container } = renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    await openKiezer(1);

    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * Knelpunt-signalering (E3-09, FR-6.4): the three things the board must not let a teacher miss.
 *
 * They are deliberately not one uniform banner. A period the teacher has overbooked is a judgement they may accept; a
 * placement pointing at a date that no longer exists is not, and must stay until a human resolves it (directie
 * 2026-07-28); and curriculum the plan never teaches is a coverage fact rather than a calendar fault. So each is
 * asserted on its own terms, including the ones about what a signal does NOT claim.
 */
describe("Jaarplankalender — knelpunt-signalering (E3-09, FR-6.4)", () => {
  /** Two 6-week thema's in period 2, which offers 6 weeks: 12 needed, 6 available. */
  function teVolPlaatsingen() {
    return [
      maakPlaatsing({
        id: "v1",
        themaNaam: "Licht en donker",
        blokStart: "2026-11-09",
        blokEind: "2026-12-20",
        blokOrdinaal: 2,
        duurWeken: 6,
      }),
      maakPlaatsing({
        id: "v2",
        themaNaam: "Feesten",
        blokStart: "2026-11-09",
        blokEind: "2026-12-20",
        blokOrdinaal: 2,
        duurWeken: 6,
      }),
    ];
  }

  it("flags an over-full period in weeks, with an icon and words rather than colour alone", async () => {
    stubFetch(maakJaarplan(teVolPlaatsingen()));
    renderKalender();

    await screen.findByText("Licht en donker");

    // The two figures the teacher can act on, not a count of thema's: 12 weeks of thema's in a 6-week period.
    expect(screen.getByText(t("kalender.teVol", { nodig: 12, beschikbaar: 6 }))).toBeInTheDocument();

    // The old count-based wording is gone, not merely unused: "Te vol: 2 thema's" was the pre-ruling claim.
    expect(screen.queryByText(/Te vol: \d+ thema/)).toBeNull();

    // The explanation is given ONCE above the board, and it no longer calls the rule provisional.
    expect(screen.getByText(t("kalender.teVolUitleg"))).toBeInTheDocument();
    expect(screen.queryByText(/voorlopige drempel/)).toBeNull();
  });

  /**
   * The plural fix, pinned (antagonist MAJOR, fix round 1).
   *
   * `beschikbareWeken` reaches 1 on the short block a long mid-year closure leaves behind, and the te-vol sentence then
   * read *"in 1 weken"*. `catalogus.test.ts` could not see it: that guard found counts by placeholder NAME and this
   * string interpolates `{beschikbaar}`. The guard now finds them by the noun that follows, and this test asserts the
   * rendered sentence rather than the catalogue, because the catalogue can hold a correct singular that nothing calls.
   */
  it("says '1 week' rather than '1 weken' on a period of a single week", async () => {
    // A rooster whose second block offers 7 open days = exactly 1 week, with 4 weeks of thema placed in it.
    const kortRooster = {
      ...rooster,
      blokken: [
        rooster.blokken[0],
        { ...rooster.blokken[1], aantalOpenDagen: 7, aantalOpenWeekdagen: 5 },
      ],
    };
    const plan = maakJaarplan(
      [
        maakPlaatsing({
          id: "k1",
          themaNaam: "Kort blok",
          blokStart: "2026-11-09",
          blokEind: "2026-12-20",
          blokOrdinaal: 2,
          duurWeken: 4,
        }),
      ],
      [
        {
          ordinaal: 2,
          start: "2026-11-09",
          aantalThemas: 1,
          aantalDoelen: 0,
          benodigdeWeken: 4,
          beschikbareWeken: 1,
          isOverbelast: true,
        },
      ],
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), {
            status: 200,
          });
        }
        if (url.includes("/dekking")) {
          return new Response(JSON.stringify(DEKKING_NIETS_ONTBREEKT), { status: 200 });
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify(kortRooster), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(plan), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );
    renderKalender();

    await screen.findByText("Kort blok");

    expect(
      screen.getByText(t("kalender.teVolEenWeek", { nodig: 4 })),
    ).toBeInTheDocument();
    // And the ungrammatical form is nowhere on screen, including in the period heading. Written without a
    // word-boundary escape deliberately: an earlier revision of this line reached the file carrying two literal
    // BACKSPACE bytes where the escapes were meant to be. `no-control-regex` caught it; had it not, the assertion
    // would have matched nothing and passed forever, which is the failure mode this whole test exists against.
    expect(screen.queryByText(/(^|\s)1 weken(\s|$)/)).toBeNull();
    // The heading itself uses the singular noun too.
    expect(screen.getByText(t("kalender.wekenEnkelvoud"))).toBeInTheDocument();
  });

  it("does not flag a period that needs exactly the weeks it has", async () => {
    // 6 weeks of thema's in period 2's 6 available weeks. The boundary the ruling settles: over means strictly more.
    stubFetch(maakJaarplan([teVolPlaatsingen()[0]]));
    renderKalender();

    await screen.findByText("Licht en donker");

    expect(screen.queryByText(/Te vol/)).toBeNull();
    expect(screen.queryByText(t("kalender.teVolUitleg"))).toBeNull();
  });

  it("ignores a rejected thema when deciding whether a period is over-full", async () => {
    // 12 weeks placed, but one of the two is rejected: nothing is taught in this period on its account, so 6 remain
    // and the period is not te vol. The card itself stays visible, since a teacher must see what they threw out.
    const [eerste, tweede] = teVolPlaatsingen();
    stubFetch(maakJaarplan([eerste, { ...tweede, status: "Geweigerd" }]));
    renderKalender();

    await screen.findByText("Feesten");

    expect(screen.queryByText(/Te vol/)).toBeNull();
  });

  /**
   * The year strip's te-vol marker: **one glyph, and the same one the board uses** (E3-09, Art. XII).
   *
   * Untested until now, which is why the strip could carry `!` while the column carried `▲` for as long as it did. The
   * glyph is the strip's only non-colour carrier of the state — a 40px segment has no room for a sentence — so it is
   * exactly the kind of detail Art. XII's "never colour alone" depends on and exactly the kind a passing suite was
   * silent about.
   */
  // Skipped: the Jaarspine periode-balk was removed from this screen for the 2026-08-21 demo.
  it.skip("marks te vol on the year strip with the same glyph the board uses, plus a word for screen readers", async () => {
    stubFetch(maakJaarplan(teVolPlaatsingen()));
    renderKalender();

    await screen.findByText("Licht en donker");

    // The strip is the region above the board; its te-vol segment carries the glyph and an sr-only word.
    const merktekens = screen.getAllByText("▲", { exact: false });
    expect(merktekens.length).toBeGreaterThan(0);

    // The word rides along invisibly, so a screen reader does not announce a bare glyph.
    expect(screen.getByText(t("spine.teVol"))).toBeInTheDocument();

    // And the old glyph is gone entirely: two glyphs for one signal read as two problems.
    expect(screen.queryByText("!", { exact: true })).toBeNull();
  });

  it("states the coverage fraction on the board, and links to the overview", async () => {
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]), undefined, {
      ...DEKKING_NIETS_ONTBREEKT,
      aantalGedekt: 3,
      aantalLeerplandoelen: 11,
    });
    renderKalender();

    await screen.findByText("Water");

    // E9-06 replaced the gap SENTENCE with the fraction (owner ruling 2026-08-19). The quantity a teacher acts on is
    // the same; what changed is that the figure now states its own denominator instead of only the remainder.
    expect(
      await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 11 })),
    ).toBeInTheDocument();

    // A real route, not a dead control (the E3-06 rule): the list lives on the dekkingsoverzicht, which E5-02 built.
    expect(screen.getByRole("link", { name: t("dekking.voortgangLink") })).toHaveAttribute(
      "href",
      "/dekking",
    );
  });

  it("names the increment separately when placements are standing, and never sums the two", async () => {
    // The quantity E9-06 exists for and the one the old sentence could not report: what accepting the standing
    // placements would add. 3 covered now, 7 if everything standing were accepted, so the increment is FOUR.
    stubFetch(
      maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]),
      undefined,
      { ...DEKKING_NIETS_ONTBREEKT, aantalGedekt: 3, aantalLeerplandoelen: 11 },
      7,
    );
    renderKalender();

    await screen.findByText("Water");

    expect(await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 11 }))).toBeInTheDocument();
    expect(
      screen.getByText(t("dekking.voortgangTeAanvaarden", { aantal: 4 })),
    ).toBeInTheDocument();

    // Art. IV.1: the ceiling is not coverage, so 7 must never appear as the covered figure. An unanswered proposal
    // presented as taught is the one thing the whole accept/reject flow exists to prevent.
    expect(screen.queryByText(t("dekking.cijfer", { gedekt: 7, aantal: 11 }))).toBeNull();
  });

  it("uses the singular for an increment of exactly one placement", async () => {
    stubFetch(
      maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]),
      undefined,
      { ...DEKKING_NIETS_ONTBREEKT, aantalGedekt: 7, aantalLeerplandoelen: 9 },
      8,
    );
    renderKalender();

    expect(
      await screen.findByText(t("dekking.voortgangTeAanvaardenEnkelvoud")),
    ).toBeInTheDocument();
  });

  it("says nothing about an increment when no placement is standing", async () => {
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");

    // The old assertion here checked that the GAP SENTENCE stayed away when everything was covered. That sentence is
    // gone and the fraction is unconditional now, so what is worth pinning is the other half of the same rule: a plan
    // with nothing outstanding carries no sentence about nothing.
    expect(await screen.findByText(t("dekking.cijfer", { gedekt: 8, aantal: 8 }))).toBeInTheDocument();
    expect(screen.queryByText(/als je de voorgestelde plaatsing/)).toBeNull();
  });

  it("withholds the gap count while dekking itself is untrustworthy", async () => {
    // An unresolved stale placement makes the server withhold `aantalGedekt` (directie 2026-07-28, point 4). A plan
    // that cannot report dekking cannot report a gap in it either, and the Te herzien notice is already saying what
    // has to happen first. Neither the count NOR the "could not be checked" line belongs here: nothing failed.
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]), undefined, {
      ...DEKKING_NIETS_ONTBREEKT,
      isBetrouwbaar: false,
      aantalOnopgelosteVervallenPlaatsingen: 1,
      aantalGedekt: null,
    });
    renderKalender();

    await screen.findByText("Water");

    // Nothing at all: not the fraction, not the withheld headline, and not an error. `ingehoudenElders` is passed on
    // this mount precisely because the Te herzien notice above already counts these placements and offers the fix, and
    // two statements of one fact a few hundred pixels apart is the E4-06 defect.
    expect(screen.queryByText(new RegExp(t("dekking.cijfer", { gedekt: 8, aantal: 8 })))).toBeNull();
    expect(screen.queryByText(t("dekking.cijferIngehouden"))).toBeNull();
    expect(screen.queryByText(t("dekking.fout"))).toBeNull();
  });

  it("says the gap could not be checked rather than implying there is none", async () => {
    // Silence on a failed read would read as "nothing is missing", which is the one direction this signal must never
    // fail in, and the direction a 500 or a dropped connection fails in by default.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/dekking")) {
          return new Response("nope", { status: 500 });
        }
        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), {
            status: 200,
          });
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify(rooster), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(
            JSON.stringify(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })])),
            { status: 200 },
          );
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );
    renderKalender();

    expect(await screen.findByText(t("dekking.fout"))).toBeInTheDocument();
  });

  /**
   * The kleuterjaar chooser on the kalender (owner ruling, 2026-08-05, on the antagonist's QUESTION).
   *
   * `Klas.Leerjaar` is one ordinal: `0` says "a kleutergroep" and cannot say which kleuterjaar, so the server derives
   * `JK + K2 + K3` and a derde kleuterklas is measured against roughly three times the doelen it teaches. E5-02 gave
   * `/dekking` this control; E3-09 put the resulting figure on the anchor screen without it. These four tests are the
   * ruling: the control appears exactly when there is something to choose, it changes what is measured, it carries the
   * narrowing into the link, and the case where nothing can be chosen says so instead of showing a bare number.
   */
  const KLEUTERDEKKING = {
    ...DEKKING_NIETS_ONTBREEKT,
    klasNaam: "K3 derde kleuterklas",
    gemetenJaarFasen: ["JK", "K2", "K3"],
    beschikbareJaarFasen: ["JK", "K2", "K3"],
    aantalGedekt: 4,
    aantalLeerplandoelen: 45,
  };

  /** Records every dekking URL, so the assertions can be about the REQUEST and not only about the screen. */
  function stubMetDekking(antwoordVoor: (jaarFase: string | null) => unknown) {
    const urls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/dekking")) {
          urls.push(url);
          const match = /[?&]jaarFase=([^&]*)/.exec(url);
          const antwoord = antwoordVoor(match ? decodeURIComponent(match[1]) : null);

          // Both reads answer from ONE per-jaarFase fixture, so the bar and the chooser cannot disagree about what a
          // narrowing measured. Matched on the longer path first, since `/dekking/voortgang` extends `/dekking`.
          return new Response(
            JSON.stringify(
              url.includes("/dekking/voortgang")
                ? voortgangUit(antwoord as Record<string, unknown>)
                : antwoord,
            ),
            { status: 200 },
          );
        }
        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), {
            status: 200,
          });
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify(rooster), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(
            JSON.stringify(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })])),
            { status: 200 },
          );
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );

    return urls;
  }

  // Skipped: the kleuterjaar-chooser (Jaarfasekiezer) was removed from this screen for the 2026-08-21 demo.
  it.skip("offers the kleuterjaar choice when the class has more than one, and narrows what is measured", async () => {
    const urls = stubMetDekking((jaarFase) =>
      jaarFase === "K3"
        ? { ...KLEUTERDEKKING, gemetenJaarFasen: ["K3"], aantalGedekt: 4, aantalLeerplandoelen: 15 }
        : KLEUTERDEKKING,
    );
    renderKalender();

    // Unnarrowed: measured against all three kleuterjaren, so the denominator is 45.
    expect(
      await screen.findByText(t("dekking.cijfer", { gedekt: 4, aantal: 45 })),
    ).toBeInTheDocument();

    const groep = screen.getByRole("group", { name: t("dekking.jaarFaseLabel") });
    expect(within(groep).getByRole("button", { name: "K3" })).toBeInTheDocument();
    // The explanation is the kalender's own, not the dekkingsoverzicht's: "dit overzicht" would point at the board,
    // which this control does not touch.
    expect(screen.getByText(t("kalender.jaarFaseUitleg"))).toBeInTheDocument();
    expect(screen.queryByText(t("dekking.jaarFaseUitleg"))).toBeNull();

    fireEvent.click(within(groep).getByRole("button", { name: "K3" }));

    // Narrowed: 4 of 15. The DENOMINATOR moved, which is the whole point — a narrowing that only refiltered the rows
    // would leave the figure unchanged and the control would be decoration. Reading the denominator straight off the
    // screen is a stronger assertion than the old remainder was: 41 and 11 were both consistent with a filter.
    expect(
      await screen.findByText(t("dekking.cijfer", { gedekt: 4, aantal: 15 })),
    ).toBeInTheDocument();

    // And it reached the server as a scope argument rather than being applied in the browser.
    expect(urls.some((url) => url.includes("jaarFase=K3"))).toBe(true);
  });

  // Skipped: the kleuterjaar-chooser (Jaarfasekiezer) was removed from this screen for the 2026-08-21 demo.
  it.skip("carries the narrowing into the link, so the two screens cannot report different numbers", async () => {
    stubMetDekking((jaarFase) =>
      jaarFase === "K3"
        ? { ...KLEUTERDEKKING, gemetenJaarFasen: ["K3"], aantalGedekt: 4, aantalLeerplandoelen: 15 }
        : KLEUTERDEKKING,
    );
    renderKalender();

    await screen.findByText(t("dekking.cijfer", { gedekt: 4, aantal: 45 }));
    // Unnarrowed the link is bare, which is `/dekking`'s own default.
    expect(screen.getByRole("link", { name: t("dekking.voortgangLink") })).toHaveAttribute(
      "href",
      "/dekking",
    );

    fireEvent.click(
      within(screen.getByRole("group", { name: t("dekking.jaarFaseLabel") })).getByRole("button", {
        name: "K3",
      }),
    );
    await screen.findByText(t("dekking.cijfer", { gedekt: 4, aantal: 15 }));

    expect(screen.getByRole("link", { name: t("dekking.voortgangLink") })).toHaveAttribute(
      "href",
      "/dekking?jaarFase=K3",
    );
  });

  it("offers no chooser when there is no figure for it to govern", async () => {
    // A kleutergroep on a database holding no kleuter goals: `0 van 0`, so the sentence below does not render and a
    // chooser over it would be a control that changes nothing. Found by pointing the running app at a real kleuterklas
    // instead of at the L3 demo class, and it is the ORDINARY state until E1-12 loads real curriculum.
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]), undefined, {
      ...KLEUTERDEKKING,
      aantalGedekt: 0,
      aantalLeerplandoelen: 0,
    });
    renderKalender();

    await screen.findByText("Water");

    expect(screen.queryByRole("group", { name: t("dekking.jaarFaseLabel") })).toBeNull();
    expect(screen.queryByText(/nog niet gedekt door dit jaarplan/)).toBeNull();
  });

  // Skipped: the kleuterjaar-chooser (Jaarfasekiezer) was removed from this screen for the 2026-08-21 demo.
  it.skip("keeps the chooser once narrowed, even if the chosen year turns out to hold no goals", async () => {
    // The trap version of the test above: if the control vanished on the state it produced, there would be no way back
    // to "Alle drie" and the teacher would be stuck measuring an empty year.
    stubMetDekking((jaarFase) =>
      jaarFase === "JK"
        ? { ...KLEUTERDEKKING, gemetenJaarFasen: ["JK"], aantalGedekt: 0, aantalLeerplandoelen: 0 }
        : KLEUTERDEKKING,
    );
    renderKalender();

    await screen.findByText(t("dekking.cijfer", { gedekt: 4, aantal: 45 }));
    const groep = screen.getByRole("group", { name: t("dekking.jaarFaseLabel") });
    fireEvent.click(within(groep).getByRole("button", { name: "JK" }));

    // The FRACTION is gone, because there is nothing to measure in JK, and what stands in its place says so rather
    // than falling silent. `0 van 0` would satisfy "everything covered" and draw a full bar, which is the one reading
    // this state must never have — so `bepaalVoortgangsbalk` gates it before any figure.
    expect(await screen.findByText(t("dekking.nietMeetbaar"))).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(t("dekking.cijfer", { gedekt: 4, aantal: 45 }))).toBeNull(),
    );
    // ...and the way back is still on screen, with "Alle drie" selectable.
    const nogSteeds = screen.getByRole("group", { name: t("dekking.jaarFaseLabel") });
    expect(within(nogSteeds).getByRole("button", { name: "JK" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(within(nogSteeds).getByRole("button", { name: t("dekking.jaarFaseAlle") }));
    expect(
      await screen.findByText(t("dekking.cijfer", { gedekt: 4, aantal: 45 })),
    ).toBeInTheDocument();
  });

  it("shows no chooser for a class with a single jaar/fase", async () => {
    // Every L1 to L6 class. One button that cannot change anything is the control-that-does-nothing this repo bans.
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]), undefined, {
      ...DEKKING_NIETS_ONTBREEKT,
      aantalGedekt: 3,
      aantalLeerplandoelen: 11,
    });
    renderKalender();

    await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 11 }));

    expect(screen.queryByRole("group", { name: t("dekking.jaarFaseLabel") })).toBeNull();
    expect(screen.queryByText(t("kalender.jaarFaseUitleg"))).toBeNull();
  });

  it("says the figure is measured against the whole curriculum when the class's own year is unknown", async () => {
    // The open graadklas case: `Leerjaar` maps to no jaar/fase, so the server widens the scope and declares it. Without
    // this sentence the teacher reads a number several times too large with no way to tell, which is the same defect as
    // the audit's first MAJOR.
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]), undefined, {
      ...DEKKING_NIETS_ONTBREEKT,
      bereik: "HeelCurriculum",
      gemetenJaarFasen: [],
      beschikbareJaarFasen: [],
      isTerugvalNaarHeelCurriculum: true,
      aantalGedekt: 4,
      aantalLeerplandoelen: 212,
    });
    renderKalender();

    expect(await screen.findByText(t("kalender.dekkingTerugval"))).toBeInTheDocument();
    // Nothing to choose, so no chooser either.
    expect(screen.queryByRole("group", { name: t("dekking.jaarFaseLabel") })).toBeNull();
  });

  it("has no axe violations with all three knelpunten on screen at once", async () => {
    stubFetch(
      maakJaarplan([
        ...teVolPlaatsingen(),
        maakPlaatsing({
          id: "v3",
          themaNaam: "Vervallen thema",
          blokStart: "2026-12-01",
          blokEind: null,
          blokOrdinaal: null,
          isVervallen: true,
        }),
      ]),
      undefined,
      { ...DEKKING_NIETS_ONTBREEKT, aantalGedekt: 3, aantalLeerplandoelen: 11 },
    );
    const { container } = renderKalender();

    await screen.findByText("Licht en donker");
    await screen.findByText(t("dekking.cijfer", { gedekt: 3, aantal: 11 }));

    // The axe run now covers the progress bar too, which is the point of leaving it in this test rather than giving the
    // bar its own: the three knelpunten share a stacking context and this is the only place they are all on screen.
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * E4-01 (FR-6.5, FR-7, Art. V.1): an edit must not leave a coverage figure computed before it in the cache.
 *
 * The server half of this story is proven where it belongs, over HTTP against real PostgreSQL
 * (`DekkingNaBewerkingTests`): dekking is recomputed on every read, so there is nothing to invalidate behind the
 * API. **The whole remaining risk is on the client**, and it is invisible to every test that only checks what the
 * kalender renders: the dekkingsoverzicht is another route, so while a teacher edits here its query is inactive and
 * TanStack keeps the last answer. Left in place, that answer is what `/dekking` paints on arrival.
 */
describe("Jaarplankalender — de dekking volgt de bewerking (E4-01, FR-6.5/FR-7)", () => {
  const EIGEN_SCOPE = [...dekkingKlasKey(KLAS_ID), "EigenJaarFase", null] as const;
  const HEEL_CURRICULUM = [...dekkingKlasKey(KLAS_ID), "HeelCurriculum", null] as const;
  const ANDERE_KLAS = [...dekkingKlasKey("33333333-3333-3333-3333-333333333333"), "EigenJaarFase", null] as const;

  /** The figures a teacher had already looked at, in the two scopes the overview can be left in. */
  function zetDekkingInCache(queryClient: QueryClient) {
    queryClient.setQueryData(EIGEN_SCOPE, { aantalGedekt: 0, aantalLeerplandoelen: 2 });
    queryClient.setQueryData(HEEL_CURRICULUM, { aantalGedekt: 0, aantalLeerplandoelen: 40 });
    queryClient.setQueryData(ANDERE_KLAS, { aantalGedekt: 3, aantalLeerplandoelen: 12 });
  }

  const VOOR_BEWERKING = { aantalGedekt: 0, aantalLeerplandoelen: 2 };

  /**
   * Seeds the pre-edit figure **after** the mount fetch has resolved, and returns it.
   *
   * **Why this exists, and it is a correction to my own fix** (audit MAJOR, mutation-proven). `zetDekkingInCache` writes
   * immediately after `renderKalender()`. That is fine under `stubBewerking`, which does not route `/dekking`, so the
   * seeded value is the only one there. It is **not** fine under `stubFetch`, which *does* route it: the mount refetch
   * overwrites the seed before the button is ever pressed, so an assertion that the seed is gone afterwards passes
   * whether or not the edit cleared anything. The generation test was exactly that shape, and deleting
   * `vergeetDekking` from `useGenereerJaarplan` left the `EIGEN_SCOPE` assertion green -- the same call site E4-01's
   * round-1 audit filed for being pinned by nothing.
   *
   * Waiting for the mount's own answer first, then seeding over it, makes the seed the value the cache actually holds
   * at the moment of the press, so its disappearance is evidence again.
   */
  async function zaaiNaEersteAntwoord(queryClient: QueryClient) {
    await waitFor(() => expect(queryClient.getQueryData(EIGEN_SCOPE)).toBeDefined());
    zetDekkingInCache(queryClient);
    expect(queryClient.getQueryData(EIGEN_SCOPE)).toEqual(VOOR_BEWERKING);
  }

  /**
   * E4-01's promise, asserted as the promise rather than as one mechanism's side effect.
   *
   * **Rewritten by E9-06 (2026-08-19), and the reason is worth more than the assertion.** These three tests used to
   * assert `getQueryData(EIGEN_SCOPE)` was `undefined`, which pinned `removeQueries` **literally** rather than pinning
   * what a teacher is owed. When the dekking family switched to `resetQueries` — so that a coverage figure sitting on
   * the same screen as the write actually moves — an entry with a mounted observer is cleared *and refetched*, so it is
   * `undefined` only for the length of that request.
   *
   * **One of the three was already passing by a race and nobody could have known.** `waitFor(…toBeUndefined())`
   * succeeds on the first poll that catches the gap, so two of these tests kept passing while the third failed, purely
   * on whether the refetch had resolved yet. A test that can be true or false depending on request timing was reporting
   * on cache mechanics, not on behaviour.
   *
   * What E4-01 actually promised is that **the figure computed before the edit is never what the cache hands out
   * after it.** That holds under both mechanisms and cannot pass by a race: the pre-edit value is a distinct object, so
   * either it is gone or it has been replaced by a fresh answer, and both are correct.
   */
  async function verwachtGeenVoorBewerkingsCijfer(queryClient: QueryClient, key: readonly unknown[]) {
    await waitFor(() => expect(queryClient.getQueryData(key)).not.toEqual(VOOR_BEWERKING));
  }

  it("drops every cached figure for this class when a proposal is accepted", async () => {
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const naPlan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
    ]);
    stubBewerking(plan, naPlan);
    const { queryClient } = renderKalender();
    zetDekkingInCache(queryClient);

    await screen.findByText("Water");
    fireEvent.click(
      within(kaart("Water")).getByRole("button", {
        name: t("kalender.aanvaardenLabel", { thema: "Water" }),
      }),
    );

    // Both scopes, not just the default one: the acceptance changed the numerator of every denominator, and a
    // teacher who had switched to the whole curriculum would otherwise come back to the stale one of the two.
    await verwachtGeenVoorBewerkingsCijfer(queryClient, EIGEN_SCOPE);
    // The whole-curriculum entry has no observer, so nothing refetches it and it stays empty outright.
    expect(queryClient.getQueryData(HEEL_CURRICULUM)).toBeUndefined();

    // And the removal is scoped: another class's figure is not affected by an edit to this plan, and the plan the
    // board is rendering survives — it was written from the server's response, not thrown away with the dekking.
    expect(queryClient.getQueryData(ANDERE_KLAS)).toBeDefined();
    expect(queryClient.getQueryData(["jaarplan", KLAS_ID])).toBeDefined();
  });

  it("drops the figure on a move too, because the moved placement starts counting", async () => {
    // A second edit through a second control, deliberately: the rule lives in the hook the five placement mutations
    // share, and a test that only ever pressed "Aanvaarden" would pass just as well with the call wired into that
    // one handler. A move is also the case with the most surprising figure change — the placement becomes `manueel`,
    // which counts for dekking, so a drag raises the coverage figure without any decision being recorded.
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    stubBewerking(plan);
    const { queryClient } = renderKalender();
    zetDekkingInCache(queryClient);

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    const keuze = within(kaart("Water")).getByLabelText(t("kalender.verplaatsNaar"));
    fireEvent.change(keuze, { target: { value: "2026-11-09" } });
    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.verplaatsen") }));

    await verwachtGeenVoorBewerkingsCijfer(queryClient, EIGEN_SCOPE);
    expect(queryClient.getQueryData(ANDERE_KLAS)).toEqual({ aantalGedekt: 3, aantalLeerplandoelen: 12 });
  });

  it("keeps the figure when the edit was refused, because the plan did not change", async () => {
    // The other direction, and the one an over-eager `onSettled` would get wrong: a 400 means nothing was persisted,
    // so throwing the figure away would send the teacher back to a loading state to be told the same number. The
    // rule is that the cache follows the PLAN, not the gesture.
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    stubBewerking(plan, plan, 400);
    const { queryClient } = renderKalender();
    zetDekkingInCache(queryClient);

    await screen.findByText("Water");
    fireEvent.click(aanpassen("Water"));

    const keuze = within(kaart("Water")).getByLabelText(t("kalender.verplaatsNaar"));
    fireEvent.change(keuze, { target: { value: "2026-11-09" } });
    fireEvent.click(within(kaart("Water")).getByRole("button", { name: t("kalender.verplaatsen") }));

    // Wait for the failure to be on screen, so this is not asserting on a request that had not finished yet.
    expect(await within(kaart("Water")).findByText(t("kalender.verplaatsMislukt"))).toBeInTheDocument();
    // Asserted on the VALUE, not on "defined": a refetch would also leave it defined, so the old assertion could not
    // tell "the figure was correctly kept" from "the figure was thrown away and fetched again".
    expect(queryClient.getQueryData(EIGEN_SCOPE)).toEqual(VOOR_BEWERKING);
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("drops the figure after a generation run, which replaces the placements it was computed from", async () => {
    // Antagonist round 1 [MINOR]: this branch of the change was pinned by nothing. Deleting the call in
    // `useGenereerJaarplan` left all 439 tests green, and the mutation check in the worklog only ever covered the
    // shared placement hook, which is a claim about one of two call sites presented as a claim about both.
    const resultaat: Generatieresultaat = {
      isGeslaagd: true,
      // E4-05: a whole-plan run, so nothing is out of scope and no period is named.
      buitenPeriode: [],
      geregenereerdePeriode: null,
      fout: null,
      // E3-03's outlook is asserted in Vooruitzichtoverzicht.test.tsx; null here renders no dekking block, which
      // keeps these assertions about the spreading report alone.
      vooruitzicht: null,
      jaarplan: null,
      aantalNieuw: 2,
      aantalBehouden: 0,
      aantalVervangen: 1,
      onbekendeThemas: [],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
      parameters: null,
      spreiding: null,
    };
    stubFetch(maakJaarplan([]), resultaat);
    const { queryClient } = renderKalender();
    // Seeded AFTER the mount fetch, or the assertion below is vacuous: `stubFetch` routes `/dekking`, so a seed written
    // before the mount is overwritten by the mount itself. See `zaaiNaEersteAntwoord`.
    await zaaiNaEersteAntwoord(queryClient);

    fireEvent.click(await screen.findByRole("button", { name: "Jaarplan genereren…" }));

    // A run discards every replaceable placement and proposes new ones, so the figure it produced describes a plan
    // that no longer exists. `aantalVervangen: 1` above is that case in the fixture rather than only in prose.
    await verwachtGeenVoorBewerkingsCijfer(queryClient, EIGEN_SCOPE);
    expect(queryClient.getQueryData(HEEL_CURRICULUM)).toBeUndefined();
    // Scoped: another class's figure is untouched, asserted on its VALUE so "defined" cannot be satisfied by a refetch
    // that overwrote it.
    expect(queryClient.getQueryData(ANDERE_KLAS)).toEqual({ aantalGedekt: 3, aantalLeerplandoelen: 12 });
  });

  // Skipped: the kleuterjaar-chooser (Jaarfasekiezer) was removed from this screen for the 2026-08-21 demo.
  it.skip("keeps the kleuterjaar chooser on screen across an edit, instead of blinking out with the refetch", async () => {
    /*
      **The one behavioural guard E9-06 added to this screen, and nothing pinned it** (audit MAJOR, mutation-proven:
      reverting the latch left all 695 tests green).

      The chooser's second gate asks whether there is a figure for it to govern. That answer lives on a query which every
      placement edit now clears and refetches, so read straight off `dekking.data` the control vanishes for the length of
      the request and comes back -- from under the cursor that just clicked it, on a board that scrolls sideways. The
      latch holds the fact that this class HAS doelen to measure, which cannot become false by refetching.

      **The flicker itself is older than E9-06 and that matters for who owns it:** `main`'s own test comment records the
      chooser disappearing across a generation run under `removeQueries`, calling it self-healing and pre-existing. What
      E9-06 changed is that a reset makes it happen on every accept, reject and drag rather than only on a run, which is
      what turned a documented curiosity into something worth fixing.

      Asserted with `getByRole` inside `waitFor`, deliberately: `findByRole` would wait for the control to come BACK and
      pass on exactly the blink this test exists to forbid.
    */
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const naPlan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
    ]);
    // A kleutergroep, because the chooser only exists for a class with more than one code to choose between.
    stubBewerking(
      plan,
      naPlan,
      undefined,
      {
        ...DEKKING_NIETS_ONTBREEKT,
        gemetenJaarFasen: ["JK", "K2", "K3"],
        beschikbareJaarFasen: ["JK", "K2", "K3"],
        aantalGedekt: 4,
        aantalLeerplandoelen: 45,
      },
      // Wide enough to assert inside. Without it the refetch resolves in the same microtask queue and the window this
      // test is about does not exist to observe -- which is how the guard shipped unpinned.
      150,
    );
    renderKalender();

    await screen.findByText("Water");
    const kiezer = () => screen.queryByRole("group", { name: t("dekking.jaarFaseLabel") });
    await waitFor(() => expect(kiezer()).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.click(
      within(kaart("Water")).getByRole("button", {
        name: t("kalender.aanvaardenLabel", { thema: "Water" }),
      }),
    );

    // INSIDE the refetch window: the figures are cleared and not yet answered, which is the only moment the unlatched
    // expression evaluates to `undefined ?? 0` and hides the control.
    expect(
      await within(kaart("Water")).findByText(t("suggestieStatus.aanvaard"), undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();
    expect(kiezer()).toBeInTheDocument();

    // And still there once the answer lands, so the assertion above cannot pass by having run too late.
    await waitFor(() => expect(kiezer()).toBeInTheDocument(), { timeout: 3000 });
  });

  it("gives the dekkingsoverzicht its own loading line after an edit, never the figure from before it", async () => {
    /**
     * Antagonist round 1 [MINOR]: the three tests above assert the **cache**, which is a mechanism, not a promise.
     * What the story promises a teacher is this screen's behaviour, so this test asserts that instead: edit on the
     * kalender, then arrive at the overview on the **same** `QueryClient` — which is what client-side navigation
     * through the nav does — and read what is on it while the fresh figure is still in flight.
     *
     * The pre-edit figure is a realistic `Dekking` from E5-02's own fixtures, so it is a total the screen really
     * would render.
     *
     * **It waits on the card rather than on the cache, and that is what makes it discriminate** (round-2 audit,
     * MINOR 6). The first version waited for `getQueryData` to be `undefined` before unmounting, so under
     * `invalidateQueries` it timed out *there* and died before `DekkingPagina` was ever mounted: it failed for the
     * right reason at the wrong line, and the two assertions that describe the promise never ran. Waiting for the
     * persisted status on the card instead means the edit is complete either way, so the strategy is judged by what
     * the overview then paints: with a removal, its own loading line; with an invalidation, the pre-edit total.
     */
    const plan = maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]);
    const naPlan = maakJaarplan([
      maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
    ]);
    stubBewerking(plan, naPlan);
    const { queryClient, unmount } = renderKalender();

    const voorBewerking = maakDekking();
    queryClient.setQueryData(EIGEN_SCOPE, voorBewerking);
    // Built the way the summary builds it, so this asserts the absence of the string a teacher would actually
    // have read rather than the absence of a plausible-looking one.
    const oudTotaal = tAantal(
      voorBewerking.aantalLeerplandoelen,
      "dekking.cijferEnkelvoud",
      "dekking.cijfer",
      { gedekt: voorBewerking.aantalGedekt! },
    );

    await screen.findByText("Water");
    fireEvent.click(
      within(kaart("Water")).getByRole("button", {
        name: t("kalender.aanvaardenLabel", { thema: "Water" }),
      }),
    );
    // The server's answer is on the card, so the edit has landed and `onSuccess` has run. Deliberately NOT a wait on
    // the dekking cache: that would be the assertion this test exists to replace, and it would stop the test before
    // the screen this test is about.
    expect(await within(kaart("Water")).findByText(t("suggestieStatus.aanvaard"))).toBeInTheDocument();

    // Leaving the kalender the way a teacher does: the screen goes, the client stays.
    unmount();

    // The overview's own read never resolves inside this test, which is the three-second window the browser pass
    // had to slow the network down to observe at all. Everything the screen shows here, it shows in that window.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/dekking?klas=${KLAS_ID}`]}>
          <DekkingPagina />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(t("dekking.laden"));
    expect(screen.queryByText(oudTotaal)).toBeNull();
  });
});

/**
 * E4-04 (FR-8.1): *"De leerkracht kan het volledige jaarplan opnieuw laten genereren."*
 *
 * **Nothing about the run itself is new, and that is the story.** The endpoint has always been repeatable, has always
 * discarded exactly the untouched proposals (`Voorgesteld && !vergrendeld`) and has always reported what it replaced
 * and kept — `JaarplanPersistentieTests` proves the discard down to the table on real PostgreSQL. What did not exist
 * was any way for a teacher to know that *before* pressing: the button read "Jaarplan genereren…" on the second press
 * exactly as on the first, and the only statement about the replacement was `Spreidingsoverzicht`'s past tense,
 * afterwards. A teacher reviewing proposals over an afternoon, pressing again to see the remaining periods filled,
 * would have lost the untouched ones with no warning anywhere on the screen.
 *
 * So these tests are about the disclosure, and the one design decision worth pinning is what it keys on: **whether the
 * class has a plan at all**, never whether a *replaceable* placement exists. The second question is
 * `Themaplaatsing.IsVervangbaar`, which belongs to the server; answering it here would be the second implementation of
 * one rule that E3-09 spent a story deleting from this screen. The copy is therefore a rule and not a prediction, and
 * the last test below is what stops a later author "improving" it into one.
 */
// Skipped: TOON_HERGENEREREN hides the whole-plan generation card for the 2026-08-21 demo; unskip when the
// owner brings regeneration back.
describe.skip("Jaarplankalender — het hele jaarplan opnieuw genereren (E4-04, FR-8.1)", () => {
  it("offers a plain first run, and says nothing about replacing, while the class has no plan", async () => {
    stubFetch(maakJaarplan([]));
    renderKalender();

    expect(
      await screen.findByRole("button", { name: t("kalender.genereer") }),
    ).toBeInTheDocument();
    expect(screen.getByText(t("kalender.genereerUitleg"))).toBeInTheDocument();

    // The regeneration copy must not appear here: there is nothing to replace, and a warning about losing work on a
    // screen where none exists is the noise this project's design rules cut first.
    expect(screen.queryByRole("button", { name: t("kalender.hergenereer") })).toBeNull();
    expect(screen.queryByText(t("kalender.hergenereerUitleg"))).toBeNull();
    // And no confirmation to reach it through either (E9-08): with no plan there is nothing to replace, so the press
    // runs directly and the disclosure does not exist in any state of this screen.
    expect(screen.queryByRole("button", { name: t("kalender.hergenereerBevestig") })).toBeNull();
  });

  it("names itself a regeneration, and states both halves of the rule, once a plan exists", async () => {
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");

    expect(screen.getByRole("button", { name: t("kalender.hergenereer") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("kalender.genereer") })).toBeNull();

    // Keyed on the facts rather than on the whole string, so a rewrite that keeps them survives and one that drops
    // any of them fails. **What is lost**, **what is kept** and **what arrives** are separate assertions on purpose:
    // E4-06 shipped three rounds of lock copy that got one half right at a time.
    const uitleg = await opentHergeneratieUitleg();
    // "verdwijnen", not "worden vervangen" (antagonist round-1 MAJOR-1). The discard is unconditional on a valid parse
    // and happens before anything is placed, so an empty, fully-skipped or fully-blocked answer deletes the undecided
    // proposals and puts nothing back. Wording the certain half as a swap understated exactly the risk this sentence
    // exists to disclose, and it was strictly stronger than `vergrendelUitlegVrij`'s own "kan het vervangen".
    //
    // **"De overige", not a second list of conditions** (round-2 MAJOR). The first fix qualified the verb as
    // "AI-voorstellen waarover je nog niets beslist hebt, verdwijnen", which is false for a **locked** proposal —
    // undecided by definition, since `vergrendelUitlegVrij` tells the teacher to lock precisely "zonder er nu al over
    // te beslissen", and kept by `IsVervangbaar`. The paragraph then contradicted itself two clauses later, where
    // "vastgezet" appears in the survivor list. Defining the losers as the **complement** of the survivors makes the
    // two halves incapable of disagreeing, which a second list of exclusions could not.
    expect(uitleg).toHaveTextContent(/De overige AI-voorstellen verdwijnen/);
    expect(uitleg).toHaveTextContent(/minder of geen voorstelt/);
    expect(uitleg).toHaveTextContent(/blijft staan/);
    expect(uitleg).not.toHaveTextContent(/worden vervangen/);

    // The survivor list is asserted term by term, because the round-2 MAJOR was a survivor the sentence promised in
    // one clause and deleted in another. "vastgezet" is the one that finding turned on.
    for (const overlever of ["aanvaard", "geweigerd", "zelf geplaatst", "verplaatst", "vastgezet"]) {
      expect(uitleg, `${overlever} is not named as surviving`).toHaveTextContent(
        new RegExp(overlever),
      );
    }
    // And it says WHICH regeneration, because E4-05 adds a second one. Pinned here as well as in the catalogue
    // guard: the guard proves the string is qualified, this proves the qualified string is the one that renders.
    expect(uitleg).toHaveTextContent(/hele jaarplan/);

    // The first-run sentence is replaced, not supplemented. Two paragraphs of prose beside one button is the wall
    // this screen keeps cutting, and the assertion is here because "add a second <p>" is the obvious wrong fix.
    expect(screen.queryByText(t("kalender.genereerUitleg"))).toBeNull();
  });

  it("runs from a plan that already has placements, and reports what the server replaced and kept", async () => {
    const resultaat: Generatieresultaat = {
      isGeslaagd: true,
      // E4-05: a whole-plan run, so nothing is out of scope and no period is named.
      buitenPeriode: [],
      geregenereerdePeriode: null,
      fout: null,
      jaarplan: null,
      aantalNieuw: 2,
      aantalBehouden: 1,
      aantalVervangen: 1,
      // E3-03 made this required. `null` is a legal shape (the failure case, and a run whose coverage could not be
      // measured), and this test asserts nothing about coverage, so the honest fixture is the empty one rather than
      // an invented figure. Caught by `pnpm build` (`tsc -b`) and NOT by `pnpm lint` (`tsc --noEmit`), which is
      // E7-17 showing its face on a real merge: the lint gate type-checks nothing here.
      vooruitzicht: null,
      onbekendeThemas: [],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
      parameters: null,
      spreiding: {
        aantalBlokken: 2,
        aantalGebruikteBlokken: 2,
        blokken: [],
        legeBlokOrdinalen: [],
        overbelasteBlokOrdinalen: [],
        minsteDoelenInEenBlok: 1,
        meesteDoelenInEenBlok: 3,
      },
    };
    stubFetch(
      maakJaarplan([
        maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
        maakPlaatsing({ id: "p2", themaNaam: "Wonen" }),
      ]),
      resultaat,
    );
    renderKalender();

    await screen.findByText("Water");
    await drukHergenereer();

    // The same endpoint and the same report as a first run; E4-04 changed neither, and E9-08 changed only how many
    // presses reach it. Both figures come from the
    // server's own `AantalBehouden`/`AantalVervangen` and are asserted in the singular, which is where this file's
    // plural defects have always surfaced.
    expect(await screen.findByText("2 thema's voorgesteld.")).toBeInTheDocument();
    expect(screen.getByText(/1 eerder voorstel is verdwenen/)).toBeInTheDocument();
    expect(screen.getByText(/1 bestaande plaatsing bleef staan/)).toBeInTheDocument();
  });

  it("keeps the human-in-the-loop statement on a plan where every card is already decided", async () => {
    // **The state the first version of this story was wrong about (antagonist MAJOR-2).** Replacing `genereerUitleg`
    // rather than supplementing it was justified by the board's `beslisUitleg` carrying "jij beslist" instead — but
    // that sentence is gated on `openBeslissingen > 0` (deliberately, by E4-02's re-audit), so on a fully decided plan
    // BOTH were absent. That is the likeliest state to regenerate from: a teacher who has worked through every card
    // and wants the empty periods filled. Nothing then told them the arrivals are proposals they still decide on
    // (Art. IV.1/IV.2). The clause now lives in the regeneration string itself, which no other component can gate.
    stubFetch(
      maakJaarplan([
        maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
        maakPlaatsing({ id: "p2", themaNaam: "Wonen", status: "Geweigerd" }),
      ]),
    );
    renderKalender();

    await screen.findByText("Water");

    // The precondition, asserted rather than assumed: this really is the state where the board's own explanation is
    // gone. Without this line the test would still pass if `beslisUitleg` started rendering again, and would then be
    // proving nothing about the case it was written for.
    expect(screen.queryByText(t("kalender.beslisUitleg"))).toBeNull();

    const uitleg = await opentHergeneratieUitleg();
    expect(uitleg).toHaveTextContent(/Voorgesteld/);
    expect(uitleg).toHaveTextContent(/jij beslist/);
  });

  it("discloses the rule from a plan in which nothing is replaceable, rather than predicting the outcome", async () => {
    // Every placement here is decided or locked, so this run would replace **nothing**. The disclosure still stands,
    // and that is the decision under test rather than an accident: predicting "1 voorstel wordt vervangen" would put
    // `IsVervangbaar` in the client beside the server's copy of it (the E3-09 defect), and counting what will change
    // is E4-07's pre-apply diff, not this story's. The sentence is true here too, vacuously in its first half.
    stubFetch(
      maakJaarplan([
        maakPlaatsing({ id: "p1", themaNaam: "Water", status: "Aanvaard" }),
        maakPlaatsing({ id: "p2", themaNaam: "Wonen", status: "Manueel" }),
        maakPlaatsing({ id: "p3", themaNaam: "Winter", vergrendeld: true }),
      ]),
    );
    renderKalender();

    await screen.findByText("Water");

    expect(screen.getByRole("button", { name: t("kalender.hergenereer") })).toBeInTheDocument();
    const uitleg = await opentHergeneratieUitleg();

    // **This fixture holds a LOCKED, UNDECIDED proposal, and that is what the round-2 MAJOR turned on** (`p3`). It is
    // an AI proposal the teacher has decided nothing about — `kalender.vergrendelUitlegVrij` tells them to lock
    // exactly "zonder er nu al over te beslissen" — and `IsVervangbaar` keeps it. So a sentence phrased as
    // "AI-voorstellen waarover je nog niets beslist hebt, verdwijnen" is false here, and this test rendered that
    // fixture while asserting only that *some* sentence appeared, which is why it could not see it.
    //
    // The order assertion is the real pin. "De overige" only names the right set if the survivors are listed BEFORE
    // it: reversed, the sentence would say the undecided proposals disappear and then, too late, that locked ones
    // stay. A rewrite that keeps both clauses but swaps them re-creates the contradiction, and only this line fails.
    const tekst = uitleg.textContent ?? "";
    expect(tekst).toContain("vastgezet hebt, blijft staan");
    expect(tekst.indexOf("blijft staan")).toBeLessThan(tekst.indexOf("De overige"));
  });
});

/**
 * E4-05 (FR-8.2, owner rulings 2026-08-06): regenerating **one period**, and the "bezet" column state that
 * withholds three affordances at once.
 *
 * The whole point of testing this here rather than trusting the server suite is the gap this repo has now paid for
 * six times: the endpoint, the hook and the copy can all exist while nothing puts a control on screen. So every test
 * below starts from a rendered board and either presses something or asserts that there is nothing to press.
 */
describe("Jaarplankalender — één periode opnieuw genereren (E4-05, FR-8.2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * A **three**-period year, needed because finding C's fix gates the card's picker on a *selectable* period: with the
   * two-period fixture and one of them bezet, the picker correctly disappears, so a test about what the picker OFFERS
   * has nowhere to stand. Three periods give one blocked and one free.
   */
  const drieRooster: Planningsrooster = {
    ...rooster,
    blokken: [
      ...rooster.blokken,
      { ordinaal: 3, start: "2027-01-04", eind: "2027-02-14", ouderOrdinaal: null, aantalOpenDagen: 30, aantalOpenWeekdagen: 21 },
    ],
  };

  /**
   * The same year subdivided, with the property this section's tier test rests on: **each parent's first sub-block
   * starts on the parent's own start date**, which is exactly why `bezetteperiodes.has(blok.start)` was true at the
   * fine tier while the marker was withheld there. Sub-block 5 starts on the blocked themaperiode's start date.
   */
  const fijnereRooster: Planningsrooster = {
    ...rooster,
    niveau: "Subthemaperiode",
    blokken: [
      { ordinaal: 1, start: "2026-09-01", eind: "2026-09-16", ouderOrdinaal: 1, aantalOpenDagen: 16, aantalOpenWeekdagen: 11 },
      { ordinaal: 2, start: "2026-09-17", eind: "2026-10-02", ouderOrdinaal: 1, aantalOpenDagen: 16, aantalOpenWeekdagen: 11 },
      { ordinaal: 3, start: "2026-10-03", eind: "2026-11-01", ouderOrdinaal: 1, aantalOpenDagen: 30, aantalOpenWeekdagen: 21 },
      { ordinaal: 4, start: "2026-11-09", eind: "2026-11-22", ouderOrdinaal: 2, aantalOpenDagen: 14, aantalOpenWeekdagen: 10 },
      { ordinaal: 5, start: "2026-11-23", eind: "2026-12-20", ouderOrdinaal: 2, aantalOpenDagen: 28, aantalOpenWeekdagen: 20 },
    ],
  };

  /** The per-period trigger of one column, by the accessible name that distinguishes it from its siblings. */
  const hergenereerknop = (ordinaal: number) =>
    screen.getByRole("button", { name: t("kalender.periodeHergenereerLabel", { ordinaal }) });

  /**
   * Presses one column's regeneration through its confirmation (E9-08).
   *
   * The trigger opens a confirmation carrying the sentence about what that period loses; the answer is found by its
   * VISIBLE text, because the confirming button deliberately carries no `aria-label` (SC 2.5.3 — its own sentence is its
   * accessible name, and only one confirmation is open at a time so there is nothing to disambiguate).
   */
  const drukHergenereerknop = (ordinaal: number) => {
    fireEvent.click(hergenereerknop(ordinaal));
    fireEvent.click(screen.getByRole("button", { name: t("kalender.periodeHergenereerBevestig") }));
  };

  const zoekHergenereerknop = (ordinaal: number) =>
    screen.queryByRole("button", { name: t("kalender.periodeHergenereerLabel", { ordinaal }) });

  const zoekToevoegknop = (ordinaal: number) =>
    screen.queryByRole("button", { name: t("kalender.plaatsToevoegenLabel", { ordinaal }) });

  /**
   * Like the file's shared stub, but it tells the two POST routes apart and records what was posted.
   *
   * A separate stub rather than an extra branch in the shared one, because "/periodes/…/generatie" *contains*
   * "/generatie": routed by the existing check both buttons would look identical to the test, which is exactly the
   * confusion these tests exist to rule out.
   */
  function stubMetPeriodegeneratie(
    jaarplan: Jaarplan,
    antwoord: Generatieresultaat | number,
    grofRooster: Planningsrooster = rooster,
  ): { urls: string[] } {
    const urls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (init?.method === "POST" && url.includes("/periodes/")) {
          urls.push(url);

          if (typeof antwoord === "number") {
            return new Response(
              JSON.stringify({ title: "Periode is bezet", detail: "SERVERDETAIL-NIET-TONEN" }),
              { status: antwoord },
            );
          }

          return new Response(JSON.stringify(antwoord), { status: 200 });
        }

        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify([{ id: "t0", naam: "Herfst" }]), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), {
            status: 200,
          });
        }
        // Longer path first: `/dekking/voortgang` extends `/dekking`, and falling through hands the progress bar a
        // payload with no ceiling, which it reads as a withheld figure and renders as nothing.
        if (url.includes("/dekking/voortgang")) {
          return new Response(JSON.stringify(voortgangUit(DEKKING_NIETS_ONTBREEKT)), { status: 200 });
        }
        if (url.includes("/dekking")) {
          return new Response(JSON.stringify(DEKKING_NIETS_ONTBREEKT), { status: 200 });
        }
        if (url.includes("/rooster")) {
          // Serves the tier that was ASKED for. A stub that always answers the coarse grid makes a zoom switch a
          // no-op, and a tier-gated assertion then passes for the wrong reason.
          return new Response(
            JSON.stringify(url.includes("niveau=Subthemaperiode") ? fijnereRooster : grofRooster),
            { status: 200 },
          );
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(jaarplan), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );

    return { urls };
  }

  /** A run report for one period, with the counts the server scopes to it. */
  function periodeResultaat(
    plan: Jaarplan,
    blokStart: string,
    extra: Partial<Generatieresultaat> = {},
  ): Generatieresultaat {
    return {
      isGeslaagd: true,
      fout: null,
      jaarplan: plan,
      aantalNieuw: 1,
      aantalBehouden: 0,
      aantalVervangen: 1,
      onbekendeThemas: [],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
      buitenPeriode: [],
      geregenereerdePeriode: blokStart,
      spreiding: null,
      parameters: null,
      vooruitzicht: null,
      ...extra,
    };
  }

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("geeft elke themaperiode een eigen knop en stuurt de startdatum van precies die periode", async () => {
    const plan = maakJaarplan([]);
    const doel = rooster.blokken[1];
    const { urls } = stubMetPeriodegeneratie(plan, periodeResultaat(plan, doel.start));

    renderKalender();
    await waitFor(() => expect(hergenereerknop(1)).toBeInTheDocument());

    // Every period offers it, so a teacher can regenerate whichever one they are looking at.
    for (const blok of rooster.blokken) {
      expect(hergenereerknop(blok.ordinaal)).toBeInTheDocument();
    }

    drukHergenereerknop(doel.ordinaal);

    // The DATE is what travels, never the ordinal: an ordinal shifts when the school edits its vakanties.
    await waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0]).toContain("/periodes/" + doel.start + "/generatie");
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("zegt in het rapport welke periode opnieuw gegenereerd is, en dat de rest ongemoeid bleef", async () => {
    const plan = maakJaarplan([]);
    const doel = rooster.blokken[1];
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, doel.start));

    renderKalender();
    await waitFor(() => expect(hergenereerknop(doel.ordinaal)).toBeInTheDocument());

    drukHergenereerknop(doel.ordinaal);

    // Without this line the scoped counts sit in the card whose own button says "Hele jaarplan opnieuw genereren".
    await waitFor(() =>
      expect(
        screen.getByText(t("kalender.periodeRapportKop", { ordinaal: doel.ordinaal })),
      ).toBeInTheDocument(),
    );
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("noemt een voorstel voor een andere periode apart, niet als overgeslagen", async () => {
    const plan = maakJaarplan([]);
    const doel = rooster.blokken[0];
    stubMetPeriodegeneratie(
      plan,
      periodeResultaat(plan, doel.start, {
        aantalNieuw: 0,
        aantalVervangen: 0,
        buitenPeriode: [{ themaNaam: "Water", blokStart: rooster.blokken[1].start }],
      }),
    );

    renderKalender();
    await waitFor(() => expect(hergenereerknop(doel.ordinaal)).toBeInTheDocument());

    drukHergenereerknop(doel.ordinaal);

    // Rendered in Dutch, naming the PERIOD rather than echoing an ISO date: the payload is structured since fix
    // round 1 and the label is composed by the screen that has the grid (Art. II.3).
    const verwacht = t("kalender.periodeBuitenPeriodeItem", {
      thema: "Water",
      ordinaal: rooster.blokken[1].ordinaal,
    });
    await waitFor(() =>
      expect(
        screen.getByText(t("kalender.periodeBuitenPeriode", { details: verwacht })),
      ).toBeInTheDocument(),
    );

    // No ISO date reaches the teacher anywhere in that sentence.
    expect(screen.queryByText(new RegExp(rooster.blokken[1].start))).toBeNull();

    // NOT under "Overgeslagen", which is the list of the model's actual misses. The thema exists and the date is a
    // real boundary; the only thing wrong with it is that the teacher asked about a different period.
    expect(
      screen.queryByText(t("kalender.genereerOvergeslagen", { details: verwacht })),
    ).toBeNull();
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("zegt in de kolom zelf waarom een periodehergeneratie geweigerd is", async () => {
    const plan = maakJaarplan([]);
    // The fixture year has two periods; the second is the one that is not also the default target elsewhere.
    const doel = rooster.blokken[1];
    stubMetPeriodegeneratie(plan, 409);

    renderKalender();
    await waitFor(() => expect(hergenereerknop(doel.ordinaal)).toBeInTheDocument());

    drukHergenereerknop(doel.ordinaal);

    // In the column the teacher pressed, because the board scrolls sideways and a notice at the top of the page can
    // be off screen entirely. And it is nl.json copy keyed on the STATUS: the server's own detail is never echoed.
    const melding = await screen.findByRole("alert");
    expect(melding.textContent).toContain(t("kalender.periodeBezetGeweigerd"));
    expect(melding.textContent).not.toContain("SERVERDETAIL-NIET-TONEN");

    // Only the pressed column reports it; the others are untouched.
    expect(screen.getAllByText(t("kalender.periodeBezetGeweigerd"))).toHaveLength(1);
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("houdt knop, kiezer en dropzone weg uit een bezette periode en noemt het vaste moment", async () => {
    const bezet = rooster.blokken[1];
    const plan: Jaarplan = {
      ...maakJaarplan([]),
      geblokkeerdePeriodes: [{ blokStart: bezet.start, momentNaam: "Oudercontact" }],
    };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, bezet.start));

    renderKalender();
    await waitFor(() => expect(hergenereerknop(1)).toBeInTheDocument());

    // The marker names the teacher's own commitment, in the word the settings form used ("bezet").
    expect(
      screen.getByText(t("kalender.periodeBezet", { moment: "Oudercontact" })),
    ).toBeInTheDocument();

    // All three affordances are withheld in that period, and in that period only.
    expect(zoekHergenereerknop(bezet.ordinaal)).toBeNull();
    expect(zoekToevoegknop(bezet.ordinaal)).toBeNull();
    expect(zoekHergenereerknop(1)).toBeInTheDocument();
    expect(zoekToevoegknop(1)).toBeInTheDocument();

    // The empty well says why nothing comes in, instead of inviting a teacher to plan there.
    expect(
      screen.getByText(t("kalender.periodeBezetLeeg", { moment: "Oudercontact" })),
    ).toBeInTheDocument();

    // And the board explains the three consequences once, rather than in every blocked column.
    expect(screen.getByText(t("kalender.bezetteperiodesUitleg"))).toBeInTheDocument();
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("zegt niets over bezette periodes zolang er geen enkele bezet is", async () => {
    const plan = maakJaarplan([]);
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, rooster.blokken[0].start));

    renderKalender();
    await waitFor(() => expect(hergenereerknop(1)).toBeInTheDocument());

    expect(screen.queryByText(t("kalender.bezetteperiodesUitleg"))).toBeNull();
    expect(screen.queryByText(/^Bezet:/)).toBeNull();
  });

  it("laat een thema dat al in een bezette periode stond gewoon staan", async () => {
    // The non-retroactive half of the ruling, which is the one a marker reading "bezet" could easily contradict:
    // the teacher planned this thema first and registered the moment afterwards.
    const bezet = rooster.blokken[1];
    const plaatsing = maakPlaatsing({ id: "bezet-1", blokStart: bezet.start, themaNaam: "Herfst" });
    const plan: Jaarplan = {
      ...maakJaarplan([plaatsing]),
      geblokkeerdePeriodes: [{ blokStart: bezet.start, momentNaam: "Oudercontact" }],
    };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, bezet.start));

    renderKalender();
    await waitFor(() => expect(screen.getByText("Herfst")).toBeInTheDocument());

    // The card is there, and the well's "nothing comes in here" sentence is NOT: the period is not empty.
    expect(
      screen.getByText(t("kalender.periodeBezet", { moment: "Oudercontact" })),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(t("kalender.periodeBezetLeeg", { moment: "Oudercontact" })),
    ).toBeNull();
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("laat maar één periode tegelijk lopen en laat alleen die periode zich bezig noemen", async () => {
    // Found in the browser pass rather than by a test, which is why it has one now: a second press while the first
    // request was still open moved the "Bezig" label to the new column and left the first looking idle mid-run.
    const plan = maakJaarplan([]);
    const doel = rooster.blokken[0];
    // A holder rather than a bare `let`: TypeScript cannot see the assignment inside the fetch callback and narrows
    // the variable to `null`, so `laatBinnen?.()` is "not callable".
    const houd: { open: (() => void) | null } = { open: null };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (init?.method === "POST" && url.includes("/periodes/")) {
          // Held open on purpose: the state under test only exists while a request is in flight.
          await new Promise<void>((resolve) => {
            houd.open = resolve;
          });

          return new Response(JSON.stringify(periodeResultaat(plan, doel.start)), { status: 200 });
        }

        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify([{ id: "t0", naam: "Herfst" }]), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), {
            status: 200,
          });
        }
        if (url.includes("/dekking")) {
          return new Response(JSON.stringify(DEKKING_NIETS_ONTBREEKT), { status: 200 });
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify(rooster), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(plan), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );

    renderKalender();
    await waitFor(() => expect(hergenereerknop(1)).toBeInTheDocument());

    drukHergenereerknop(doel.ordinaal);

    // The pressed column says so, and it is the ONLY one that does.
    await waitFor(() =>
      expect(hergenereerknop(doel.ordinaal).textContent).toContain(t("kalender.genereerBezig")),
    );
    const ander = hergenereerknop(2);
    expect(ander.textContent).toContain(t("kalender.periodeHergenereer"));

    // And no second run can be started underneath it, which is what kept the label honest.
    expect(ander).toBeDisabled();
    expect(hergenereerknop(doel.ordinaal)).toBeDisabled();

    houd.open?.();
    await waitFor(() => expect(hergenereerknop(2)).toBeEnabled());
  });

  it("biedt een bezette periode niet aan in de verplaatskiezer van een kaart, en zegt waarom", async () => {
    // **The SC 2.5.7 route** (antagonist round 1, MAJOR). The board withholds the drop target for a blocked period,
    // but dragging may not be the only way in: this picker is the pointer-and-keyboard alternative. Left un-narrowed
    // it was the one route that still offered a target the server refuses with a 409.
    const bezet = drieRooster.blokken[1];
    const plaatsing = maakPlaatsing({ id: "kaart-1", blokStart: drieRooster.blokken[0].start });
    const plan: Jaarplan = {
      ...maakJaarplan([plaatsing]),
      geblokkeerdePeriodes: [{ blokStart: bezet.start, momentNaam: "Oudercontact" }],
    };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, bezet.start), drieRooster);

    renderKalender();
    await waitFor(() => expect(screen.getByText("Thema")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: t("kalender.aanpassenLabel", { thema: "Thema" }) }));

    const keuze = await screen.findByRole("combobox", { name: t("kalender.verplaatsNaar") });
    const optie = within(keuze).getByRole("option", {
      name: t("kalender.periodeKeuzeBezet", {
        ordinaal: bezet.ordinaal,
        periode: formatteerPeriode(bezet.start, bezet.eind),
        moment: "Oudercontact",
      }),
    });

    // Present and disabled, not silently removed: a shorter list would send a teacher hunting for a period that is
    // plainly on the board, and the option itself carries the reason in visible text (the E3-06 rule).
    expect(optie).toBeDisabled();
  });

  it("vertelt bij een 409 niet dat de tool stuk is, op geen van de twee handmatige routes", async () => {
    // Before fix round 1 both fell through to "Meld dit aan de beheerder van de tool" — the tool blaming itself, and
    // sending the teacher to escalate, for a rule it had just applied on the strength of their own setting.
    const bezet = rooster.blokken[1];
    const plaatsing = maakPlaatsing({ id: "kaart-2", blokStart: rooster.blokken[0].start });
    const plan: Jaarplan = {
      ...maakJaarplan([plaatsing]),
      // Deliberately EMPTY, so the picker still offers the period and the request really reaches the server: this
      // test is about the answer to a 409, which a page whose picker already disabled the option cannot produce.
      geblokkeerdePeriodes: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (init?.method === "PUT" && url.includes("/blok")) {
          return new Response(
            JSON.stringify({ title: "Periode is bezet", detail: "SERVERDETAIL-NIET-TONEN" }),
            { status: 409 },
          );
        }
        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify([{ id: "t0", naam: "Herfst" }]), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), { status: 200 });
        }
        if (url.includes("/dekking")) {
          return new Response(JSON.stringify(DEKKING_NIETS_ONTBREEKT), { status: 200 });
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify(rooster), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(plan), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );

    renderKalender();
    await waitFor(() => expect(screen.getByText("Thema")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: t("kalender.aanpassenLabel", { thema: "Thema" }) }));
    const keuze = await screen.findByRole("combobox", { name: t("kalender.verplaatsNaar") });
    fireEvent.change(keuze, { target: { value: bezet.start } });
    fireEvent.click(screen.getByRole("button", { name: t("kalender.verplaatsen") }));

    const melding = await screen.findByText(t("kalender.verplaatsBezet"));
    expect(melding).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.verplaatsOnbeschikbaar"))).toBeNull();
    expect(screen.queryByText(/SERVERDETAIL-NIET-TONEN/)).toBeNull();
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("legt bezet niet uit op de fijne weergave, waar geen kolom de markering draagt", async () => {
    // The tier gate (antagonist round 1, MINOR): a themaperiode's own start date is ALSO the start of its first
    // subthemaperiode, so the naive check was true at the fine tier while the marker is deliberately withheld there.
    // The board then explained something no column was showing.
    const bezet = rooster.blokken[1];
    const plan: Jaarplan = {
      ...maakJaarplan([]),
      geblokkeerdePeriodes: [{ blokStart: bezet.start, momentNaam: "Oudercontact" }],
    };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, bezet.start));

    renderKalender();
    await waitFor(() => expect(hergenereerknop(1)).toBeInTheDocument());
    expect(screen.getByText(t("kalender.bezetteperiodesUitleg"))).toBeInTheDocument();

    // The zoom is a group of two buttons, not a select: pressing one acts at once rather than submitting a choice.
    fireEvent.click(
      within(screen.getByRole("group", { name: t("kalender.weergaveLabel") })).getByRole("button", {
        name: t("kalender.weergaveFijn"),
      }),
    );

    await waitFor(() =>
      expect(screen.queryByText(t("kalender.periodeBezet", { moment: "Oudercontact" }))).toBeNull(),
    );

    // No marker anywhere, so no explanation of one either. Both halves, because either alone would pass on a board
    // that simply failed to render.
    expect(screen.queryByText(t("kalender.bezetteperiodesUitleg"))).toBeNull();
  });

  it("belooft de periodeknop niet wanneer elke periode bezet is", async () => {
    // `periodeHergenereerUitleg` says "met de knop onderaan die periode", so it may only render where such a button
    // exists (antagonist round 1, MINOR). With every derived themaperiode blocked, none does.
    const plan: Jaarplan = {
      ...maakJaarplan([]),
      geblokkeerdePeriodes: rooster.blokken.map((blok) => ({
        blokStart: blok.start,
        momentNaam: "Oudercontact",
      })),
    };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, rooster.blokken[0].start));

    renderKalender();
    await waitFor(() =>
      expect(screen.getAllByText(t("kalender.periodeBezet", { moment: "Oudercontact" }))).toHaveLength(
        rooster.blokken.length,
      ),
    );

    expect(zoekHergenereerknop(1)).toBeNull();
    expect(screen.queryByText(t("kalender.periodeHergenereerUitleg"))).toBeNull();

    // The bezet explanation DOES still render: those markers are on screen and need explaining.
    expect(screen.getByText(t("kalender.bezetteperiodesUitleg"))).toBeInTheDocument();
  });

  it("vertelt ook bij handmatig plaatsen niet dat de tool stuk is bij een 409", async () => {
    // The second manual route's own 409 branch (antagonist round 1, MAJOR, second half). Reached from a stale page:
    // the column withholds the picker for a period it knows is blocked, so the plan here reports none.
    const doel = rooster.blokken[0];
    const plan: Jaarplan = { ...maakJaarplan([]), geblokkeerdePeriodes: [] };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (init?.method === "POST" && url.includes("/plaatsingen")) {
          return new Response(
            JSON.stringify({ title: "Periode is bezet", detail: "SERVERDETAIL-NIET-TONEN" }),
            { status: 409 },
          );
        }
        if (url.includes("/api/themas")) {
          return new Response(JSON.stringify([{ id: "t0", naam: "Herfst" }]), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify({ gewensteStartthemas: [], vasteMomenten: [] }), { status: 200 });
        }
        if (url.includes("/dekking")) {
          return new Response(JSON.stringify(DEKKING_NIETS_ONTBREEKT), { status: 200 });
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify(rooster), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify(plan), { status: 200 });
        }

        return new Response("unexpected request", { status: 404 });
      }),
    );

    renderKalender();
    await waitFor(() =>
      expect(zoekToevoegknop(doel.ordinaal)).toBeInTheDocument(),
    );

    fireEvent.click(zoekToevoegknop(doel.ordinaal)!);
    const keuze = await screen.findByRole("combobox", { name: t("kalender.plaatsKies") });
    fireEvent.change(keuze, { target: { value: "t0" } });
    fireEvent.click(screen.getByRole("button", { name: t("kalender.plaatsen") }));

    expect(await screen.findByText(t("kalender.plaatsBezet"))).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.plaatsOnbeschikbaar"))).toBeNull();
    expect(screen.queryByText(/SERVERDETAIL-NIET-TONEN/)).toBeNull();
  });

  it("belooft geen keuze wanneer elke andere periode bezet is, en zegt wat er dan wel kan", async () => {
    // Finding C (antagonist round 2), and it is the same standard as MINOR 8 one round earlier: since a bezet period is
    // KEPT in the list and disabled, "the list is not empty" stopped meaning "there is somewhere to move this". The
    // panel used to render "Kies hieronder een themaperiode…" over a placeholder and one unselectable option.
    const plaatsing = maakPlaatsing({ id: "kaart-3", blokStart: rooster.blokken[0].start });
    const plan: Jaarplan = {
      ...maakJaarplan([plaatsing]),
      // The only other period of this two-period year.
      geblokkeerdePeriodes: [{ blokStart: rooster.blokken[1].start, momentNaam: "Oudercontact" }],
    };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, rooster.blokken[1].start));

    renderKalender();
    await waitFor(() => expect(screen.getByText("Thema")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: t("kalender.aanpassenLabel", { thema: "Thema" }) }));

    // No picker, and the sentence that says why. The `herplaatsKies` assertion that used to sit here has moved to the
    // stale-card test below: it renders only for `isVervallen`, so asserting its absence on a card that HAS a period
    // passed whether or not the fix existed — a vacuous assertion standing in for the claim it appeared to check
    // (antagonist round 3, MINOR).
    expect(await screen.findByText(t("kalender.verplaatsGeenVrijePeriode"))).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: t("kalender.verplaatsNaar") })).toBeNull();
  });

  it("houdt de bezette periode ook weg uit de kiezer van een vervallen kaart", async () => {
    // Finding D (antagonist round 2). The wiring was right, but every other test drove a card inside a period column,
    // so the assertion existed for the route I had called *less* likely. A stale placement sits in no period at all,
    // so its picker offers every one of them — which is why the prop doc calls this the likeliest route in.
    const vervallen = maakPlaatsing({
      id: "kaart-4",
      // A date that starts no block of the current grid: the definition of stale.
      blokStart: "2026-08-15",
      blokEind: null,
      blokOrdinaal: null,
      isVervallen: true,
    });
    const bezet = drieRooster.blokken[1];
    const plan: Jaarplan = {
      ...maakJaarplan([vervallen]),
      geblokkeerdePeriodes: [{ blokStart: bezet.start, momentNaam: "Oudercontact" }],
    };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, bezet.start), drieRooster);

    renderKalender();

    // Inside the "Te herzien" notice, not on the board: a stale placement has no column.
    const melding = await screen.findByRole("region", { name: new RegExp(t("kalender.herzienTitelEnkelvoud")) });
    fireEvent.click(
      within(melding).getByRole("button", { name: t("kalender.aanpassenLabel", { thema: "Thema" }) }),
    );

    const keuze = await within(melding).findByRole("combobox", { name: t("kalender.verplaatsNaar") });
    const optie = within(keuze).getByRole("option", {
      name: t("kalender.periodeKeuzeBezet", {
        ordinaal: bezet.ordinaal,
        periode: formatteerPeriode(bezet.start, bezet.eind),
        moment: "Oudercontact",
      }),
    });

    expect(optie).toBeDisabled();
  });

  it("belooft een vervallen kaart geen kiezer en geen sleep wanneer elke periode bezet is", async () => {
    // **The MAJOR of antagonist round 3.** Round 2 gated the picker and added a sentence, and left the instruction
    // that actually promises a picker gated on staleness alone. So this state read "Kies hieronder een themaperiode …
    // of versleep de kaart" over no picker, onto a board whose every column is a disabled droppable — both halves
    // false, which is the same defect class as the state an owner ruling reopened E3-07 over (there: a stale REJECTED card, where the picker is withheld by the rejection; here: a stale card with every period bezet).
    const vervallen = maakPlaatsing({
      id: "kaart-5",
      blokStart: "2026-08-15",
      blokEind: null,
      blokOrdinaal: null,
      isVervallen: true,
    });
    const plan: Jaarplan = {
      ...maakJaarplan([vervallen]),
      geblokkeerdePeriodes: rooster.blokken.map((blok) => ({
        blokStart: blok.start,
        momentNaam: "Oudercontact",
      })),
    };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, rooster.blokken[0].start));

    renderKalender();
    const melding = await screen.findByRole("region", {
      name: new RegExp(t("kalender.herzienTitelEnkelvoud")),
    });
    fireEvent.click(
      within(melding).getByRole("button", { name: t("kalender.aanpassenLabel", { thema: "Thema" }) }),
    );

    // The sentence that IS true here, and it does not say "nergens anders": this card is in no period, so there is no
    // "andere" to speak of — the construction three earlier strings in that file were repaired for.
    expect(
      await within(melding).findByText(t("kalender.verplaatsGeenVrijePeriodeVervallen")),
    ).toBeInTheDocument();
    expect(within(melding).queryByText(t("kalender.verplaatsGeenVrijePeriode"))).toBeNull();

    // And neither half of the instruction is promised: no picker, and no "kies hieronder / versleep de kaart".
    expect(within(melding).queryByRole("combobox", { name: t("kalender.verplaatsNaar") })).toBeNull();
    expect(within(melding).queryByText(t("kalender.herplaatsKies"))).toBeNull();
  });

  it("blijft een vervallen kaart wel zeggen waar verplaatsen werkt op de fijne weergave", async () => {
    // The other side of the same gate, and the reason it is not applied to all three branches: `herplaatsAnderNiveau`
    // does not promise a picker, it says where re-placing DOES work. Withholding it would take away the only way
    // forward — the E3-06 rule pointing the other way. At the fine tier `doelen` is empty, so a naive gate on
    // `kiesbareDoelen` alone would have suppressed exactly this sentence.
    const vervallen = maakPlaatsing({
      id: "kaart-6",
      blokStart: "2026-08-15",
      blokEind: null,
      blokOrdinaal: null,
      isVervallen: true,
    });
    const plan: Jaarplan = { ...maakJaarplan([vervallen]), geblokkeerdePeriodes: [] };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, rooster.blokken[0].start));

    renderKalender();
    await waitFor(() =>
      expect(screen.getByRole("group", { name: t("kalender.weergaveLabel") })).toBeInTheDocument(),
    );
    fireEvent.click(
      within(screen.getByRole("group", { name: t("kalender.weergaveLabel") })).getByRole("button", {
        name: t("kalender.weergaveFijn"),
      }),
    );

    const melding = await screen.findByRole("region", {
      name: new RegExp(t("kalender.herzienTitelEnkelvoud")),
    });
    fireEvent.click(
      within(melding).getByRole("button", { name: t("kalender.aanpassenLabel", { thema: "Thema" }) }),
    );

    expect(
      await within(melding).findByText(t("kalender.herplaatsAnderNiveau")),
    ).toBeInTheDocument();
  });

  // Skipped: TOON_HERGENEREREN hides this UI for the 2026-08-21 demo; unskip when the owner brings regeneration back.
  it.skip("heeft geen axe-schendingen met een bezette periode op het bord", async () => {
    const bezet = rooster.blokken[1];
    const plan: Jaarplan = {
      ...maakJaarplan([]),
      geblokkeerdePeriodes: [{ blokStart: bezet.start, momentNaam: "Oudercontact" }],
    };
    stubMetPeriodegeneratie(plan, periodeResultaat(plan, bezet.start));

    const { container } = renderKalender();
    await waitFor(() => expect(hergenereerknop(1)).toBeInTheDocument());
    // Awaited before axe runs, because the progress bar (E9-06) resolves on its own request: without this the axe
    // assertion measured the board with the bar still absent, and React reported the late render as an unwrapped
    // act(). A settled screen is also the only one worth running axe against.
    await screen.findByText(t("dekking.cijfer", { gedekt: 8, aantal: 8 }));

    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * E9-08 (CR1): the consequence copy lives at the press, not permanently above the board.
 *
 * **These tests are the story's acceptance criterion turned into assertions**, and they are written to fail in both
 * directions. A screen that kept the paragraph at rest fails the first pair; a screen that moved it somewhere the
 * teacher never sees fails the second; and a confirmation that fires the run on the wrong press fails the third. That
 * last one matters most, because the failure mode of adding a confirmation step is a destructive action that now runs
 * from a button labelled "Annuleren".
 */
// Skipped: TOON_HERGENEREREN hides the (re)generation buttons and confirmations for the 2026-08-21 demo;
// unskip when the owner brings regeneration back.
describe.skip("Jaarplankalender — de gevolgtekst staat bij de druk, niet boven het bord (E9-08, CR1)", () => {
  it("houdt de hergeneratie-uitleg van het bord tot de leerkracht drukt", async () => {
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");

    // At rest: the trigger is there and the 330-character warning is not. This is the whole of CR1 for this paragraph.
    expect(screen.getByRole("button", { name: t("kalender.hergenereer") })).toBeInTheDocument();
    expect(screen.queryByText(t("kalender.hergenereerUitleg"))).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t("kalender.hergenereer") }));

    // And it reaches the teacher before they commit, announced rather than merely present.
    const uitleg = screen.getByText(t("kalender.hergenereerUitleg"));
    expect(uitleg).toBeInTheDocument();
    expect(uitleg).toHaveAttribute("role", "alert");
  });

  it("houdt de periode-gevolgtekst van het bord en zet ze in de kolom die je drukt", async () => {
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");

    // The three consequence sentences are nowhere on a resting board.
    expect(screen.queryByText(t("kalender.periodeHergenereerGevolg"))).toBeNull();

    const knoppen = screen.getAllByRole("button", {
      name: new RegExp(t("kalender.periodeHergenereer")),
    });
    fireEvent.click(knoppen[0]);

    const gevolg = screen.getByText(t("kalender.periodeHergenereerGevolg"));
    expect(gevolg).toHaveAttribute("role", "alert");

    // ONE confirmation, not seven: the sentence says "deze periode", so a shared one would be false in six columns.
    expect(screen.getAllByText(t("kalender.periodeHergenereerGevolg"))).toHaveLength(1);
  });

  it("houdt de focus bij de bevestiging en geeft ze terug bij annuleren", async () => {
    /*
      **Pinned because the audit found it missing, and because the epic entry claimed the opposite.** That entry said
      these confirmations "do not trap focus or lose it"; they do not trap it, and they did lose it. The trigger is
      *replaced* by the confirmation, so a keyboard user who opened it landed on `<body>` and lost their place on a board
      that scrolls sideways.

      `Themakiezer` measured exactly this in a browser and records that no test caught it. This is that test, for the
      other two places the pattern now lives.
    */
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");
    const trigger = screen.getByRole("button", { name: t("kalender.hergenereer") });
    fireEvent.click(trigger);

    // Onto the answer, not the cancel: the teacher pressed a button meaning "yes", so the affirmative is where they are.
    const bevestig = screen.getByRole("button", { name: t("kalender.hergenereerBevestig") });
    await waitFor(() => expect(bevestig).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: t("kalender.annuleren") }));

    // And back to the trigger, which by then is a NEWLY mounted element — hence the fresh query rather than `trigger`.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: t("kalender.hergenereer") })).toHaveFocus(),
    );
    expect(document.body).not.toHaveFocus();
  });

  it("houdt de focus bij de periodebevestiging en geeft ze terug aan de kolom", async () => {
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    renderKalender();

    await screen.findByText("Water");
    const knoppen = screen.getAllByRole("button", {
      name: new RegExp(t("kalender.periodeHergenereer")),
    });
    fireEvent.click(knoppen[0]);

    const bevestig = screen.getByRole("button", { name: t("kalender.periodeHergenereerBevestig") });
    await waitFor(() => expect(bevestig).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: t("kalender.annuleren") }));

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: new RegExp(t("kalender.periodeHergenereer")) })[0],
      ).toHaveFocus(),
    );
  });

  it("draait niets wanneer de leerkracht de bevestiging annuleert", async () => {
    // The failure mode of adding a confirmation is a destructive run that happens anyway. Asserted on the REQUESTS,
    // because a screen that returned to rest while having already fired would look identical.
    stubFetch(maakJaarplan([maakPlaatsing({ id: "p1", themaNaam: "Water" })]));
    const gestubdeFetch = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    renderKalender();

    await screen.findByText("Water");
    fireEvent.click(screen.getByRole("button", { name: t("kalender.hergenereer") }));
    fireEvent.click(screen.getByRole("button", { name: t("kalender.annuleren") }));

    // Back to rest, warning gone, and nothing was generated.
    expect(screen.queryByText(t("kalender.hergenereerUitleg"))).toBeNull();
    expect(screen.getByRole("button", { name: t("kalender.hergenereer") })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        gestubdeFetch.mock.calls.filter(([input]) => String(input).includes("/generatie")),
      ).toHaveLength(0),
    );
  });
});
