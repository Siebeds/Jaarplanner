import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(within(keuze).getByRole("option", { name: /Periode 2/ })).toBeInTheDocument();
    expect(within(keuze).queryByRole("option", { name: /Periode 1/ })).toBeNull();

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
    expect(within(keuze).getByRole("option", { name: /Periode 1/ })).toBeInTheDocument();
    expect(within(keuze).getByRole("option", { name: /Periode 2/ })).toBeInTheDocument();

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
      // Not reachable from the UI today (nothing here sets `Geweigerd`; `wijzigPlaatsingStatus` only ever sends
      // `Manueel`), reachable over the API now, and two clicks away the moment E4-01/E4-02 ship a reject control.
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
      expect(paneel.getByText(t("kalender.weigeringUitleg"))).toBeInTheDocument();
      expect(t("kalender.weigeringUitleg")).toContain("hergeneratie van het hele jaarplan");
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
    // Owner ruling, 2026-07-31. The kalender has no accept control (E4-01/E4-02 owns that), so "Zet het vast om
    // dat te voorkomen" was the only keep-action on the screen — while a locked `Voorgesteld` placement counts
    // for **nothing** in the dekking, where only aanvaard/manueel count as placed. The nudge does not ship
    // without the distinction beside it.
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

  it("offers no decision on a STALE proposal, whose only remedy is re-placement", async () => {
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
    stubBewerking(plan);
    renderKalender();

    await screen.findByText("Feesten in december");

    // The same reasoning E4-06 applied to the lock, applied consistently: a stale card's remedy is re-placement, and
    // accepting one would produce a card labelled "Aanvaard" that covers nothing and STILL withholds the whole
    // dekking figure (E5-01 withholds it while any unresolved stale placement exists). A decision that resolves
    // nothing, dressed as one that did.
    expect(beslissing("Feesten in december").aanvaarden).toBeNull();
    expect(beslissing("Feesten in december").weigeren).toBeNull();
    // The instruction it does get is the re-placement one, which belongs to E3-07 and still points at a picker.
    expect(screen.getByText(t("kalender.herzienUitleg"))).toBeInTheDocument();
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
});
