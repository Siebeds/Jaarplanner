import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { t } from "../../i18n";
import { Jaarplankalender } from "./Jaarplankalender";
import type { Generatieresultaat, Jaarplan, Planningsrooster } from "./types";

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
    { ordinaal: 1, start: "2026-09-01", eind: "2026-11-01", ouderOrdinaal: null, aantalOpenDagen: 62 },
    { ordinaal: 2, start: "2026-11-09", eind: "2026-12-20", ouderOrdinaal: null, aantalOpenDagen: 42 },
  ],
  onderbrekingen: [{ naam: "Herfstvakantie", start: "2026-11-02", eind: "2026-11-08" }],
};

function maakJaarplan(plaatsingen: Jaarplan["plaatsingen"]): Jaarplan {
  return {
    klasId: KLAS_ID,
    klasNaam: "L3 derde leerjaar",
    schooljaarId: SCHOOLJAAR_ID,
    schooljaarNaam: "2026-2027",
    blokindeling: rooster.blokindeling,
    plaatsingen,
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
    ...overrides,
  };
}

/**
 * Routes the GETs the kalender makes; everything else is a test bug, so it 404s loudly.
 *
 * `generatie` optionally controls the POST: a run result for success, or an HTTP status number to simulate a
 * failure. The order of the checks matters — the generation URL also contains "/jaarplan".
 */
function stubFetch(jaarplan: Jaarplan, generatie?: Generatieresultaat | number) {
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
 * The list of period cards.
 *
 * Needed because the year spine repeats two of the card labels by design — it carries a legend so its
 * colours never stand alone (Art. XII) — so a document-wide text query for "Te vol" is ambiguous and would
 * pass for the wrong reason.
 */
function periodes() {
  return screen.getByRole("list", { name: t("kalender.ribbonLabel") });
}

function renderKalender() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <Jaarplankalender klasId={KLAS_ID} />
    </QueryClientProvider>,
  );
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
        },
      ]),
    );
    renderKalender();

    expect(await screen.findByText("Ik en mijn klas")).toBeInTheDocument();

    // Both periods render — including period 2, which holds nothing.
    expect(screen.getByText("Periode 1")).toBeInTheDocument();
    expect(screen.getByText("Periode 2")).toBeInTheDocument();
    expect(screen.getByText("Nog niets gepland")).toBeInTheDocument();

    // The vakantie is drawn between them.
    expect(screen.getByText("Herfstvakantie")).toBeInTheDocument();

    // Proportional width comes from teaching days, shown as weeks: 62/7 = 8,9 and 42/7 = 6,0.
    expect(screen.getByText("8,9 weken")).toBeInTheDocument();
    expect(screen.getByText("6,0 weken")).toBeInTheDocument();

    // The count says GEKOPPELD, not "gedekt": doelcodes are links, and Art. V.1 makes a doel gedekt only
    // once its thema is placed. Asserting the exact word is the point — "gedekt" here would be a false
    // coverage claim in the product whose purpose is provable coverage.
    expect(screen.getByText("2 doelen gekoppeld")).toBeInTheDocument();
    expect(screen.queryByText(/gedekt/)).toBeNull();

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
        },
      ]),
    );
    renderKalender();

    const melding = await screen.findByRole("alert");

    // The thema is named, not merely counted — a teacher must see which plan item needs attention.
    expect(melding).toHaveTextContent("Feesten in december");
    // Correct Dutch for a count of one: "1 thema STAAT", not "1 thema's STAAN". Asserted against the
    // catalogue rather than a literal, which is the convention elsewhere in the suite and the reason a
    // later copy edit should not be able to fail this test: what matters is that the SINGULAR entry is
    // chosen, not which words it currently contains.
    expect(melding).toHaveTextContent(t("kalender.herzienTitelEnkelvoud"));
    expect(melding).not.toHaveTextContent(t("kalender.herzienTitel", { aantal: 1 }));

    // And there is no way to dismiss it (directie 2026-07-28: "fix later" is not an option offered).
    // Checked for links as well as buttons: with no buttons anywhere in the feature, asserting only
    // `queryByRole("button")` would pass vacuously and would not catch a dismiss control added as an <a>.
    expect(within(melding).queryByRole("button")).toBeNull();
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

  it("reports the spreading measurement after a generation run, with no verdict attached", async () => {
    const resultaat: Generatieresultaat = {
      isGeslaagd: true,
      fout: null,
      jaarplan: null,
      aantalNieuw: 3,
      aantalBehouden: 1,
      aantalVervangen: 2,
      onbekendeThemas: ["Ruimtevaart"],
      onbekendeBlokken: [],
      duplicaten: [],
      afgewezen: [],
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
    expect(screen.getByText("1 van 2 periodes gebruikt.")).toBeInTheDocument();
    expect(screen.getByText("Nog leeg: periode 2.")).toBeInTheDocument();   // singular ordinal
    expect(
      screen.getByText(/Te weinig weken voor de geplande thema's: periode 1\./),
    ).toBeInTheDocument();

    // Locked/decided placements survived, and the model's miss is named rather than swallowed (Art. IV.4).
    // Grammatical singular. The previous revision pinned "1 bestaande plaatsingen bleven staan", so the test
    // was actively protecting the bug — fixing the copy would have looked like a regression.
    expect(screen.getByText(/1 bestaande plaatsing bleef staan/)).toBeInTheDocument();

    // A run that discarded the previous proposal must say so; see the aantalVervangen assertions below.
    expect(screen.getByText("2 eerdere voorstellen zijn vervangen.")).toBeInTheDocument();
    expect(screen.getByText(/Ruimtevaart/)).toBeInTheDocument();

    // And it explicitly disclaims a judgement: no threshold is defined anywhere, so the tool must not imply one.
    expect(screen.getByText(/Wat een goede spreiding is, beslist de school/)).toBeInTheDocument();
  });

  it("shows Dutch copy on a 422 and never echoes the English diagnostic", async () => {
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

  it("distinguishes an unconfigured tool from a bad AI answer", async () => {
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
    // Premises for this test's reach: the te-vol flag and the stale alert are actually on screen.
    expect(within(periodes()).getByText(/Te vol/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
