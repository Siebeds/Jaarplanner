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
    expect(within(melding).getByRole("status")).toHaveTextContent(
      t("kalender.herzienTitelEnkelvoud"),
    );

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
describe("Jaarplankalender — verplaatsen en verwijderen (E3-07)", () => {
  /** One thema's card, so a query cannot pick up a control belonging to a different card. */
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

    expect(await axe(container)).toHaveNoViolations();
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
   * something — while `kanVerplaatsen` demands strict equality. So the board said "Verplaatsen doe je in de weergave
   * Themaperiodes" while labelling itself as being on Themaperiodes: an instruction impossible to follow, pointing at
   * the view you are looking at. Not reachable from today's API, which is exactly why it needs a test rather than an
   * argument.
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
