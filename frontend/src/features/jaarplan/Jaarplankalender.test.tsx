import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { t } from "../../i18n";
import { Jaarplankalender } from "./Jaarplankalender";
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

/**
 * Renders the screen with its own query client.
 *
 * The client is **returned** so a test can drive TanStack directly. One state this screen has to get right is only
 * reachable that way: a query that is `isError` while still holding data, which is what an errored *background*
 * refetch produces (`refetchQueries` on a key whose fetch then fails). Nothing in the component tree can be clicked
 * to reach it.
 */
function renderKalender() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <Jaarplankalender klasId={KLAS_ID} />
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
    expect(
      within(melding)
        .getAllByRole("button")
        .map((control) => control.getAttribute("aria-label") ?? control.textContent),
    ).toEqual([t("kalender.aanpassenLabel", { thema: "Feesten in december" })]);
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
    expect(
      screen.getByText(/Te weinig weken voor de geplande thema's: themaperiode 1\./),
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
function stubBewerking(plan: Jaarplan, naPlan: Jaarplan = plan, mislukStatus?: number) {
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
      { ordinaal: 1, start: "2026-09-01", eind: "2026-09-16", ouderOrdinaal: 1, aantalOpenDagen: 16 },
      { ordinaal: 2, start: "2026-09-17", eind: "2026-10-02", ouderOrdinaal: 1, aantalOpenDagen: 16 },
      { ordinaal: 3, start: "2026-10-03", eind: "2026-10-17", ouderOrdinaal: 1, aantalOpenDagen: 15 },
      { ordinaal: 4, start: "2026-10-18", eind: "2026-11-01", ouderOrdinaal: 1, aantalOpenDagen: 15 },
      { ordinaal: 5, start: "2026-11-09", eind: "2026-11-22", ouderOrdinaal: 2, aantalOpenDagen: 14 },
      { ordinaal: 6, start: "2026-11-23", eind: "2026-12-06", ouderOrdinaal: 2, aantalOpenDagen: 14 },
      { ordinaal: 7, start: "2026-12-07", eind: "2026-12-20", ouderOrdinaal: 2, aantalOpenDagen: 14 },
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

  it("asks the API for the chosen tier and draws the whole screen from that one answer", async () => {
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

  it("caches the two tiers apart, so switching back is instant and never shows the wrong grain", async () => {
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
  it("keeps the plan and a way forward when the chosen tier fails to load", async () => {
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
    expect(screen.getByRole("button", { name: t("kalender.genereer") })).toBeInTheDocument();
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
  it("refuses to state the settings, and to generate, when the generation tier's grid is the one that failed", async () => {
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
    expect(screen.getByRole("button", { name: t("kalender.genereer") })).toBeDisabled();

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
  it("says nothing was changed, rather than where to go, when the tier is one it cannot recognise", async () => {
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
    expect(screen.getByRole("button", { name: t("kalender.genereer") })).toBeDisabled();
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
  it("does not claim the other tier is showing when a refresh of the current one failed", async () => {
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
    expect(screen.getByRole("button", { name: t("kalender.genereer") })).toBeEnabled();
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
    expect(
      within(melding)
        .getAllByRole("button")
        .map((control) => control.getAttribute("aria-label") ?? control.textContent),
    ).toEqual([
      t("kalender.aanpassenLabel", { thema: "Feesten in december" }),
      t("kalender.uitJaarplanHalen"),
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
                        aantalOpenDagen: 16,
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

    // In period 1, where it already sits, it is not an option at all: the server refuses that with a 400, so
    // offering it would be a control that can only fail.
    const keuzeHier = await openKiezer(1);
    expect(within(keuzeHier).queryByRole("option", { name: /Herfst/ })).toBeNull();
    expect(within(keuzeHier).getByRole("option", { name: "Water" })).toBeInTheDocument();
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

    expect(within(keuze).queryByRole("option", { name: /Herfst/ })).toBeNull();
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

  /** The picker itself, with the panel open, has to survive an axe structure check like every other panel here. */
  it("has no axe violations with the picker OPEN", async () => {
    stubPlaatsen(maakJaarplan([]));
    const { container } = renderKalender();

    expect(await screen.findByText(t("kalender.periode", { ordinaal: 1 }))).toBeInTheDocument();
    await openKiezer(1);

    expect(await axe(container)).toHaveNoViolations();
  });
});
