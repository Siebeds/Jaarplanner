import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KLAS_PARAM, useSelectie } from "../../app/useSelectie";
import { t } from "../../i18n";
import nl from "../../i18n/nl.json";
import { JaarplanPagina } from "./JaarplanPagina";
import { Jaarplankalender } from "./Jaarplankalender";
import type {
  Generatieparameters,
  Generatieresultaat,
  Jaarplan,
  Parameterrapport,
  Planningsrooster,
} from "./types";

/**
 * Pins E3-04's UI (FR-5.4) through the real kalender, the real TanStack Query chain and the real nl.json copy, with
 * only `fetch` faked — so what is asserted is the request a teacher's clicks actually produce and the Dutch a teacher
 * actually reads.
 *
 * The load-bearing assertions are the four that encode a decision rather than a rendering:
 * 1. the form **loads the kept settings** and sends them, so a plain run uses the settings last saved (owner ruling
 *    2026-07-30) — and an untouched form sends them back unchanged rather than an empty object;
 * 2. a preference names its period by **date**, not by array position, and a gap between periods is expressible;
 * 3. a kept preference whose period **no longer exists** is named on screen, still sent, and removable — never
 *    silently dropped and never moved (directie 2026-07-28);
 * 4. a vast moment with no answer to "mag er een thema bij?" is **not sent**, and the screen says so.
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

const leegPlan: Jaarplan = {
  klasId: KLAS_ID,
  klasNaam: "L3 derde leerjaar",
  schooljaarId: SCHOOLJAAR_ID,
  schooljaarNaam: "2026-2027",
  blokindeling: rooster.blokindeling,
  plaatsingen: [],
};

const geenInstellingen: Generatieparameters = { gewensteStartthemas: [], vasteMomenten: [] };

const leegRapport: Parameterrapport = {
  onbekendeStartthemas: [],
  gehonoreerdeStartthemas: [],
  nietGehonoreerdeStartthemas: [],
  tegenstrijdigeStartthemas: [],
  vervallenStartthemas: [],
  geweigerdDoorVastMoment: [],
  toegepasteVasteMomenten: [],
  onplaatsbareVasteMomenten: [],
  heeftAandachtspunten: false,
};

function resultaat(parameters: Parameterrapport | null): Generatieresultaat {
  return {
    isGeslaagd: true,
    fout: null,
    jaarplan: leegPlan,
    aantalNieuw: 1,
    aantalBehouden: 0,
    aantalVervangen: 0,
    onbekendeThemas: [],
    onbekendeBlokken: [],
    duplicaten: [],
    afgewezen: [],
    spreiding: null,
    parameters,
  };
}

/**
 * Captures the POST bodies so the assertions can be about the request, not only about the screen.
 *
 * `instellingen` is what `GET …/jaarplan/parameters` returns — the class's **kept** settings. It is routed before the
 * plain `/jaarplan` branch, because the plan URL is a prefix of it.
 */
function stubFetch(
  generatie: Generatieresultaat,
  opties: {
    themas?: string[];
    /** `"fout"` fails the settings GET; `"hangt"` never answers it, which is the pending state. */
    instellingen?: Generatieparameters | "fout" | "hangt";
    /**
     * With `instellingen: "fout"`, consulted on **every** settings GET: return settings to make that call succeed,
     * `null` to keep failing, or `"hangt"` to leave that one call in flight forever — which is how a test observes the
     * retry while it is running rather than only after it has landed.
     *
     * A "second call succeeds" version of this was wrong and worth recording: the kalender and the form share one query
     * key but mount at different times (the form only exists once the plan and the grid have resolved), and an errored
     * query is **stale**, so the form's own observer refetches on mount. The failure therefore heals itself on call two
     * without anybody pressing anything, which would have made a retry test pass without a retry.
     */
    instellingenHerstel?: () => Generatieparameters | "hangt" | null;
    /** Overrides the grid, so a test can hand the form another tier's periods (E3-08's zoom). */
    rooster?: Planningsrooster;
    /**
     * Served when the request asks for `?niveau=Subthemaperiode` (E3-08).
     *
     * Present so a test can drive the **real** zoom control rather than pre-loading the form with another tier's
     * grid: the tier is a request argument, and the property under test is what survives the switch.
     */
    fijnRooster?: Planningsrooster;
  } = {},
) {
  const {
    themas = ["Herfst", "Water"],
    instellingen = geenInstellingen,
    instellingenHerstel,
    rooster: grid = rooster,
    fijnRooster,
  } = opties;
  const posts: (string | undefined)[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === "POST" && url.includes("/generatie")) {
        posts.push(init.body === undefined ? undefined : String(init.body));
        return new Response(JSON.stringify(generatie), { status: 200 });
      }
      if (url.includes("/jaarplan/parameters")) {
        if (instellingen === "hangt") {
          // Never resolves: the query stays pending, which is the transient state the collapsed summary used to
          // describe as "(niets ingesteld)".
          return new Promise<Response>(() => {});
        }
        if (instellingen === "fout") {
          const herstel = instellingenHerstel?.() ?? null;

          if (herstel === "hangt") {
            return new Promise<Response>(() => {});
          }

          return herstel === null
            ? new Response("nope", { status: 500 })
            : new Response(JSON.stringify(herstel), { status: 200 });
        }

        return new Response(JSON.stringify(instellingen), { status: 200 });
      }
      if (url.includes("/api/themas")) {
        return new Response(
          JSON.stringify(themas.map((naam, i) => ({ id: `t${i}`, naam }))),
          { status: 200 },
        );
      }
      if (url.includes("/rooster")) {
        const antwoord =
          fijnRooster && url.includes("niveau=Subthemaperiode") ? fijnRooster : grid;

        return new Response(JSON.stringify(antwoord), { status: 200 });
      }
      if (url.includes("/jaarplan")) {
        return new Response(JSON.stringify(leegPlan), { status: 200 });
      }

      throw new Error(`onverwachte fetch: ${url}`);
    }),
  );

  return posts;
}

function renderKalender() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <Jaarplankalender klasId={KLAS_ID} />
    </QueryClientProvider>,
  );
}

/** Opens the collapsed parameter form. */
async function openForm() {
  const knop = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
  fireEvent.click(knop);
  return knop;
}

/**
 * Presses "Jaarplan genereren".
 *
 * It waits for the button to be **enabled**, because generation is now refused while the kept settings are unknown: a
 * helper that clicked regardless would silently do nothing and leave a test asserting an empty `posts` array for the
 * wrong reason.
 */
async function genereer() {
  const knop = screen.getByRole("button", { name: t("kalender.genereer") });
  await waitFor(() => expect(knop).toBeEnabled());
  fireEvent.click(knop);
}

/** The startthema select for one period, addressed by the period label the row carries. */
function periodeKeuze(ordinaal: number) {
  const rijen = screen
    .getByRole("group", { name: t("parameters.startthemasTitel") })
    .querySelectorAll("label");
  const rij = [...rijen].find((label) =>
    label.textContent?.startsWith(t("parameters.periodeLabel", { ordinaal })),
  );

  if (!rij) {
    throw new Error(`geen rij voor periode ${ordinaal}`);
  }

  return rij.querySelector("select")!;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Generatieparameters — the form (E3-04, FR-5.4)", () => {
  it("sends the kept settings back unchanged when the teacher touches nothing", async () => {
    const posts = stubFetch(resultaat(leegRapport), {
      instellingen: {
        gewensteStartthemas: [{ blokStart: "2026-11-09", themaNaam: "Water" }],
        vasteMomenten: [{ naam: "Schoolfeest", datum: "2026-09-15", blokkeertPlaatsing: true }],
      },
    });
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });

    // Wait until the loaded settings have reached the trigger's summary, i.e. the form has spoken.
    const knop = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
    await waitFor(() => expect(knop.textContent).toContain("1 startthema"));

    await genereer();

    await waitFor(() => expect(posts).toHaveLength(1));
    // The run carries the KEPT settings. Before persistence this sent no body at all; now sending the loaded state is
    // what lets a teacher clear a setting, because an omitted body makes the server reuse what it has stored.
    expect(JSON.parse(posts[0]!)).toEqual({
      gewensteStartthemas: [{ blokStart: "2026-11-09", themaNaam: "Water" }],
      vasteMomenten: [{ naam: "Schoolfeest", datum: "2026-09-15", blokkeertPlaatsing: true }],
    });
  });

  it("shows the kept settings in the form instead of starting empty", async () => {
    stubFetch(resultaat(leegRapport), {
      instellingen: {
        gewensteStartthemas: [{ blokStart: "2026-11-09", themaNaam: "Water" }],
        vasteMomenten: [{ naam: "Schoolfeest", datum: "2026-09-15", blokkeertPlaatsing: true }],
      },
    });
    renderKalender();
    await openForm();

    // The preference sits in the period it was saved for, not in the first one.
    await waitFor(() => expect(periodeKeuze(2)).toHaveValue("Water"));
    expect(periodeKeuze(1)).toHaveValue("");

    // And the vast moment comes back with its answer, so nothing has to be re-decided.
    expect(screen.getByLabelText(t("parameters.momentNaam"))).toHaveValue("Schoolfeest");
    expect(screen.getByLabelText(t("parameters.momentDatum"))).toHaveValue("2026-09-15");
    expect(screen.getByRole("radio", { name: t("parameters.momentGeenThema") })).toBeChecked();
  });

  /**
   * The MAJOR both gates found, and the reason this test **never opens the disclosure**.
   *
   * With the settings GET failing, `instellingen.data` is undefined, so the trigger read *"(niets ingesteld)"* while
   * `genereerJaarplan` sent no body at all — and by this story's own contract a bodyless run applies whatever the
   * server has stored. A teacher with a saved blocking vast moment therefore read the exact opposite of what was about
   * to happen. The mitigation had been placed *inside* the collapse, which is where the first version of this defect
   * hid; the previous version of this test called `openForm()` first, which is why it could not catch it.
   */
  it("does not claim nothing is set when the kept settings failed to load, while collapsed", async () => {
    const posts = stubFetch(resultaat(leegRapport), { instellingen: "fout" });
    renderKalender();

    const knop = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
    expect(knop).toHaveAttribute("aria-expanded", "false");

    // Stated without opening anything.
    expect(await screen.findByText(t("parameters.instellingenFout"))).toBeInTheDocument();

    // And the summary says the settings are unknown rather than absent.
    await waitFor(() => expect(knop.textContent).toContain(t("parameters.samenvattingOnbekend")));
    expect(knop.textContent).not.toContain(t("parameters.samenvattingLeeg"));

    // The run is refused, not sent blind: pressing generate posts nothing at all.
    const genereerKnop = screen.getByRole("button", { name: t("kalender.genereer") });
    expect(genereerKnop).toBeDisabled();
    fireEvent.click(genereerKnop);
    await waitFor(() => expect(posts).toEqual([]));
  });

  /**
   * The refusal gates the **form**, not only the button.
   *
   * With the settings unknown a live field is not merely useless behind an action that cannot fire: submitting a body
   * *replaces* the kept settings, so setting one startthema in a form that failed to load would silently delete a
   * stored blocking vast moment the teacher never saw.
   */
  it("refuses edits too while the kept settings are unknown, not just the run", async () => {
    stubFetch(resultaat(leegRapport), { instellingen: "fout" });
    renderKalender();

    await screen.findByText(t("parameters.instellingenFout"));
    await openForm();

    await waitFor(() => expect(periodeKeuze(1)).toBeDisabled());
    expect(periodeKeuze(2)).toBeDisabled();
    expect(screen.getByRole("button", { name: t("parameters.momentToevoegen") })).toBeDisabled();
  });

  /**
   * And the failure state has a way forward.
   *
   * The copy used to say *"herlaad de pagina en probeer opnieuw"*, which is what the query client's own three retries
   * had already done before this notice could appear, and it lacked the escalation sentence its sibling
   * `kalender.genereerOnbeschikbaar` ends with. Both are asserted here, so the copy cannot drift back.
   */
  it("offers a retry out of the failure instead of prescribing a reload", async () => {
    let hersteld = false;
    let pogingen = 0;
    stubFetch(resultaat(leegRapport), {
      instellingen: "fout",
      instellingenHerstel: () => {
        pogingen += 1;

        return hersteld
          ? { gewensteStartthemas: [{ blokStart: "2026-11-09", themaNaam: "Water" }], vasteMomenten: [] }
          : null;
      },
    });
    renderKalender();

    await screen.findByText(t("parameters.instellingenFout"));
    expect(t("parameters.instellingenFout")).not.toMatch(/herlaad/i);
    expect(t("parameters.instellingenFout")).toMatch(/beheerder/i);

    // The server recovers, and only the click may notice: `pogingen` proves the fetch came from the button and not
    // from an automatic refetch that happened to land after the switch was flipped.
    const voorDeKlik = pogingen;
    hersteld = true;
    fireEvent.click(screen.getByRole("button", { name: t("parameters.instellingenOpnieuw") }));

    // The notice goes, the kept setting arrives, and generating is possible again — so the button is the way out of the
    // state and not a second dead control.
    await waitFor(() => expect(screen.queryByText(t("parameters.instellingenFout"))).toBeNull());
    expect(pogingen).toBeGreaterThan(voorDeKlik);

    const knop = screen.getByRole("button", { name: new RegExp(t("parameters.titel")) });
    await waitFor(() => expect(knop.textContent).toContain("1 startthema"));
    expect(screen.getByRole("button", { name: t("kalender.genereer") })).toBeEnabled();
  });

  /**
   * The retry says it is running, instead of vanishing.
   *
   * `refetch()` on an errored query that holds no data returns TanStack to `pending`: the `fetch` reducer clears
   * `status` and `error` whenever `data === undefined`. Keying the notice on `isError` alone therefore unmounted the
   * whole block the instant the button was pressed — up to ten seconds of nothing where the only live control on the
   * screen had been — and made its own `isFetching` guard unreachable, so the copy for it was dead too. Pinned with a
   * call that never resolves, because a retry that lands immediately cannot show this either way.
   */
  it("keeps the retry on screen and says it is running while it is in flight", async () => {
    let hangt = false;
    stubFetch(resultaat(leegRapport), {
      instellingen: "fout",
      instellingenHerstel: () => (hangt ? "hangt" : null),
    });
    renderKalender();

    await screen.findByText(t("parameters.instellingenFout"));
    hangt = true;
    fireEvent.click(screen.getByRole("button", { name: t("parameters.instellingenOpnieuw") }));

    // Present, not absent: the notice and its control survive the state change that used to unmount them.
    const bezig = await screen.findByRole("button", {
      name: t("parameters.instellingenOpnieuwBezig"),
    });
    expect(bezig).toBeDisabled();
    expect(screen.getByText(t("parameters.instellingenFout"))).toBeInTheDocument();

    // And the settings are still unknown, so the run stays refused and the form stays gated.
    expect(screen.getByRole("button", { name: t("kalender.genereer") })).toBeDisabled();
    await openForm();
    await waitFor(() => expect(periodeKeuze(1)).toBeDisabled());
  });

  // The same false summary showed transiently while the query was in flight, and a fast click still sent no body.
  it("does not claim nothing is set while the kept settings are still loading", async () => {
    const posts = stubFetch(resultaat(leegRapport), { instellingen: "hangt" });
    renderKalender();

    const knop = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
    await waitFor(() => expect(knop.textContent).toContain(t("parameters.samenvattingLaden")));
    expect(knop.textContent).not.toContain(t("parameters.samenvattingLeeg"));

    const genereerKnop = screen.getByRole("button", { name: t("kalender.genereer") });
    expect(genereerKnop).toBeDisabled();
    fireEvent.click(genereerKnop);
    await waitFor(() => expect(posts).toEqual([]));

    // The fields are gated on the same flag, so nothing can be typed into a form whose settings have not arrived —
    // a period select per row, and the one control that would add a new row.
    await openForm();
    await waitFor(() => expect(periodeKeuze(1)).toBeDisabled());
    expect(periodeKeuze(2)).toBeDisabled();
    expect(screen.getByRole("button", { name: t("parameters.momentToevoegen") })).toBeDisabled();
  });

  it("clears a kept setting when the teacher empties it and generates", async () => {
    const posts = stubFetch(resultaat(leegRapport), {
      instellingen: {
        gewensteStartthemas: [{ blokStart: "2026-09-01", themaNaam: "Herfst" }],
        vasteMomenten: [],
      },
    });
    renderKalender();
    await openForm();

    await waitFor(() => expect(periodeKeuze(1)).toHaveValue("Herfst"));
    fireEvent.change(periodeKeuze(1), { target: { value: "" } });

    await genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    // An explicitly empty set, not an omitted body: this is the only way to clear kept settings, since there is no
    // separate "Bewaren" control and an omitted body means "use what is stored".
    expect(JSON.parse(posts[0]!)).toEqual({ gewensteStartthemas: [], vasteMomenten: [] });
  });

  it("starts collapsed and says whether anything is set", async () => {
    stubFetch(resultaat(null));
    renderKalender();

    const knop = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
    expect(knop).toHaveAttribute("aria-expanded", "false");
    expect(knop).toHaveTextContent(t("parameters.samenvattingLeeg"));

    // The startthema rows are not merely hidden, they are absent until opened.
    expect(screen.queryByText(t("parameters.startthemasTitel"))).toBeNull();
  });

  it("counts the summary in grammatical Dutch for one, not \"1 startthema's\"", async () => {
    stubFetch(resultaat(null));
    renderKalender();
    await openForm();

    await waitFor(() => expect(periodeKeuze(1)).toBeInTheDocument());
    fireEvent.change(periodeKeuze(1), { target: { value: "Water" } });

    // Asserted on the parenthesised SUMMARY, not the whole button: the trigger label itself names its content
    // ("startthema's en vaste momenten") for discoverability, so a button-wide match would pass or fail on the label.
    const knop = screen.getByRole("button", { name: new RegExp(t("parameters.titel")) });
    const samenvatting = () => /\(([^)]*)\)/.exec(knop.textContent ?? "")?.[1] ?? "";

    await waitFor(() => expect(samenvatting()).toBe("1 startthema"));
    expect(samenvatting()).not.toContain("startthema's");
    // Zero parts are omitted rather than printed as "0 vaste momenten".
    expect(samenvatting()).not.toContain("moment");
  });

  it("labels each period row with its dates and offers every period at once", async () => {
    stubFetch(resultaat(null));
    renderKalender();
    await openForm();

    // Scoped to the form: the board below also renders "Periode 1" as its own column heading.
    const startthemas = screen.getByRole("group", { name: t("parameters.startthemasTitel") });

    // Every period is a live row from the start. The earlier version showed one row that grew, because the contract
    // was positional and a gap would have shifted every later choice one period earlier. With a date key there is no
    // gap rule left to enforce, so there is nothing to hide and no disabled control to explain.
    await waitFor(() => expect(within(startthemas).getAllByRole("combobox")).toHaveLength(2));

    // Dates in Dutch day+month, never the ISO the server sent.
    expect(
      within(startthemas).getByText(t("parameters.periodeLabel", { ordinaal: 1 })),
    ).toBeInTheDocument();
    expect(within(startthemas).getByText("1 sep – 1 nov")).toBeInTheDocument();
    expect(within(startthemas).getByText("9 nov – 20 dec")).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-01/)).toBeNull();
  });

  it("sends each preference with the period it targets, and a gap is allowed", async () => {
    const posts = stubFetch(resultaat(leegRapport));
    renderKalender();
    await openForm();

    // Only the SECOND period, leaving the first without a preference. Under the positional contract this was
    // inexpressible: the request would have read as "period 1 = Water" and the clear-cascade existed to prevent it.
    await waitFor(() => expect(periodeKeuze(2)).toBeInTheDocument());
    fireEvent.change(periodeKeuze(2), { target: { value: "Water" } });

    await genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!)).toEqual({
      gewensteStartthemas: [{ blokStart: "2026-11-09", themaNaam: "Water" }],
      vasteMomenten: [],
    });
  });

  it("leaves the other periods alone when one is cleared", async () => {
    const posts = stubFetch(resultaat(leegRapport));
    renderKalender();
    await openForm();

    await waitFor(() => expect(periodeKeuze(1)).toBeInTheDocument());
    fireEvent.change(periodeKeuze(1), { target: { value: "Herfst" } });
    fireEvent.change(periodeKeuze(2), { target: { value: "Water" } });

    // Clearing period 1 used to clear period 2 as well, because the request was positional and a gap would have
    // silently promoted every later choice. It must not any more: each entry names its own period.
    fireEvent.change(periodeKeuze(1), { target: { value: "" } });

    expect(periodeKeuze(2)).toHaveValue("Water");
    await genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!).gewensteStartthemas).toEqual([
      { blokStart: "2026-11-09", themaNaam: "Water" },
    ]);
  });

  it("does not send a vast moment until the blocking question is answered, and says so on screen", async () => {
    const posts = stubFetch(resultaat(leegRapport));
    renderKalender();
    await openForm();

    fireEvent.click(await screen.findByRole("button", { name: t("parameters.momentToevoegen") }));
    fireEvent.change(screen.getByLabelText(t("parameters.momentNaam")), {
      target: { value: "Schoolfeest" },
    });
    fireEvent.change(screen.getByLabelText(t("parameters.momentDatum")), {
      target: { value: "2026-09-15" },
    });

    // Named and dated but unanswered: the screen must not let this look like an instruction that was taken.
    expect(screen.getByText(new RegExp(t("parameters.momentOnbeslist")))).toBeInTheDocument();

    await genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!).vasteMomenten).toEqual([]);

    // Answering it makes it a real instruction.
    fireEvent.click(screen.getByRole("radio", { name: t("parameters.momentGeenThema") }));
    expect(screen.queryByText(new RegExp(t("parameters.momentOnbeslist")))).toBeNull();

    await genereer();
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(JSON.parse(posts[1]!).vasteMomenten).toEqual([
      { naam: "Schoolfeest", datum: "2026-09-15", blokkeertPlaatsing: true },
    ]);
  });

  // The defect this pins: the summary counted any named+dated moment, ignoring the blocking question, so a teacher
  // who left it unanswered, COLLAPSED the panel and generated saw "(1 vast moment)" while the run sent nothing and
  // the report said nothing. The warning that explains it lives inside the panel, which is closed by default — so the
  // one surface that could have told them asserted the opposite.
  it("does not claim an unfinished moment is set, and names it as unfinished while collapsed", async () => {
    const posts = stubFetch(resultaat(leegRapport));
    renderKalender();
    const knop = await openForm();
    const samenvatting = () => /\(([^)]*)\)/.exec(knop.textContent ?? "")?.[1] ?? "";

    fireEvent.click(await screen.findByRole("button", { name: t("parameters.momentToevoegen") }));
    fireEvent.change(screen.getByLabelText(t("parameters.momentNaam")), {
      target: { value: "Schoolfeest" },
    });
    fireEvent.change(screen.getByLabelText(t("parameters.momentDatum")), {
      target: { value: "2026-09-15" },
    });

    // Collapse it, which is how the defect hid.
    fireEvent.click(knop);
    expect(knop).toHaveAttribute("aria-expanded", "false");

    await waitFor(() => expect(samenvatting()).toBe("1 nog onvolledig"));
    // Emphatically NOT "1 vast moment": nothing will be sent.
    expect(samenvatting()).not.toContain("vast moment");

    fireEvent.click(screen.getByRole("button", { name: t("kalender.genereer") }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!).vasteMomenten).toEqual([]);
  });

  it("offers no pre-selected answer to the blocking question", async () => {
    stubFetch(resultaat(null));
    renderKalender();
    await openForm();

    fireEvent.click(await screen.findByRole("button", { name: t("parameters.momentToevoegen") }));

    // Neither radio is checked: the server rejects a missing value, and defaulting to "mag wel" would produce a run
    // identical to one with no parameters at all.
    expect(screen.getByRole("radio", { name: t("parameters.momentMagThema") })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: t("parameters.momentGeenThema") })).not.toBeChecked();
  });

  it("says so when the school has no thema's yet, instead of an empty picker", async () => {
    stubFetch(resultaat(null), { themas: [] });
    renderKalender();
    await openForm();

    expect(await screen.findByText(t("parameters.geenThemas"))).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("Generatieparameters — a kept setting whose period is gone (E3-04)", () => {
  /** Kept for a date that is no longer a period boundary, i.e. after a beheerder edited the vakantiedata. */
  const gestrand: Generatieparameters = {
    gewensteStartthemas: [{ blokStart: "2026-10-05", themaNaam: "Water" }],
    vasteMomenten: [],
  };

  it("names it even while the panel is collapsed, and keeps sending it", async () => {
    const posts = stubFetch(resultaat(leegRapport), { instellingen: gestrand });
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });

    // Visible WITHOUT opening the panel: it is being sent, and the teacher is the only one who can resolve it.
    //
    // A labelled `region` carrying an sr-only `status`, which is the treatment its sibling `TeHerzien` was changed to
    // in E3-07: it holds a "Weghalen" button per entry, and a live region wrapping controls re-announces its whole
    // contents on every interaction. Non-dismissible either way, asserted below.
    const melding = await screen.findByRole("region", {
      name: t("parameters.vervallenTitelEnkelvoud"),
    });
    expect(within(melding).getByRole("status")).toHaveTextContent(
      t("parameters.vervallenTitelEnkelvoud"),
    );
    expect(
      within(melding).getByText(t("parameters.vervallenRegel", { thema: "Water", datum: "5 okt" })),
    ).toBeInTheDocument();

    // The only control in it is the resolution the notice offers. A dismiss, close or "later" affordance added as a
    // button or a link changes this set and fails (directie 2026-07-28: "fix later" is not on offer).
    expect(
      within(melding)
        .getAllByRole("button")
        .map((control) => control.textContent),
    ).toEqual([t("parameters.vervallenVerwijder")]);
    expect(within(melding).queryByRole("link")).toBeNull();

    // Never the server's ISO date.
    expect(screen.queryByText(/2026-10-05/)).toBeNull();

    // Kept in the request rather than quietly dropped: reverting the vakantie edit restores it, and the run's report
    // repeats the same fact (directie 2026-07-28 — never silently drop, never silently move).
    await genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!).gewensteStartthemas).toEqual([
      { blokStart: "2026-10-05", themaNaam: "Water" },
    ]);
  });

  // The summary counted a stranded preference twice: `aantalStartthemas` included it AND `vervallen.length` added its
  // own clause, so one kept setting read as "(1 startthema, 1 zonder periode)" — two settings where there is one.
  it("counts a stranded preference once, in the clause that explains it", async () => {
    stubFetch(resultaat(leegRapport), { instellingen: gestrand });
    renderKalender();

    const knop = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
    const samenvatting = () => /\(([^)]*)\)/.exec(knop.textContent ?? "")?.[1] ?? "";

    await waitFor(() => expect(samenvatting()).toBe("1 zonder periode"));
    expect(samenvatting()).not.toContain("startthema");
  });

  it("is never assigned to a neighbouring period by the form", async () => {
    stubFetch(resultaat(leegRapport), { instellingen: gestrand });
    renderKalender();
    await openForm();

    // The nearest real periods stay empty: the application does not guess where a stranded setting belongs.
    await waitFor(() => expect(periodeKeuze(1)).toBeInTheDocument());
    expect(periodeKeuze(1)).toHaveValue("");
    expect(periodeKeuze(2)).toHaveValue("");
  });

  it("can be removed, which is the resolution route the notice offers", async () => {
    const posts = stubFetch(resultaat(leegRapport), { instellingen: gestrand });
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });

    fireEvent.click(
      await screen.findByRole("button", { name: t("parameters.vervallenVerwijder") }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: t("parameters.vervallenTitelEnkelvoud") }),
      ).toBeNull(),
    );

    await genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!).gewensteStartthemas).toEqual([]);
  });
});

/**
 * The tier coupling, pinned **before** E3-08 lands rather than after.
 *
 * A kept setting keys on the *generation* tier's block start dates (`JaarplanGeneratieService.GeneratieNiveau =
 * Themaperiode`). The form used to read whatever grid the kalender handed it, which agreed only because `/rooster`
 * defaults to that tier: the moment E3-08's zoom fetches `Subthemaperiode`, every kept preference would be flagged
 * *"zonder periode"* and every offered row would carry a date the server reports as `vervallenStartthemas`. Nothing
 * asserted the tier, so nothing would have failed.
 */
describe("Generatieparameters — the grid it may read (E3-04)", () => {
  const subthemarooster: Planningsrooster = {
    ...rooster,
    niveau: "Subthemaperiode",
    blokken: [
      { ordinaal: 1, start: "2026-09-01", eind: "2026-09-14", ouderOrdinaal: 1, aantalOpenDagen: 10 },
      { ordinaal: 2, start: "2026-09-15", eind: "2026-09-28", ouderOrdinaal: 1, aantalOpenDagen: 10 },
    ],
  };

  it("does not read another tier's periods as the periods a kept setting names", async () => {
    const posts = stubFetch(resultaat(leegRapport), {
      rooster: subthemarooster,
      instellingen: {
        // Perfectly valid at the generation tier: it is the second themaperiode's start date.
        gewensteStartthemas: [{ blokStart: "2026-11-09", themaNaam: "Water" }],
        vasteMomenten: [],
      },
    });
    renderKalender();

    const knop = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
    const samenvatting = () => /\(([^)]*)\)/.exec(knop.textContent ?? "")?.[1] ?? "";
    await waitFor(() => expect(samenvatting()).toBe("1 startthema"));

    // NOT called stranded: at this tier the form cannot tell, so it claims nothing either way.
    expect(samenvatting()).not.toContain("zonder periode");
    expect(
      screen.queryByRole("region", { name: t("parameters.vervallenTitelEnkelvoud") }),
    ).toBeNull();

    // And it offers no period rows built from the wrong tier's dates: it says where to set them instead.
    fireEvent.click(knop);
    const startthemas = await screen.findByRole("group", {
      name: t("parameters.startthemasTitel"),
    });
    expect(within(startthemas).getByText(t("parameters.anderNiveau"))).toBeInTheDocument();
    expect(within(startthemas).queryByRole("combobox")).toBeNull();

    // The kept setting itself is untouched and still sent, exactly as stored.
    fireEvent.click(screen.getByRole("button", { name: t("kalender.genereer") }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!).gewensteStartthemas).toEqual([
      { blokStart: "2026-11-09", themaNaam: "Water" },
    ]);
  });
});

/**
 * The two obligations E3-04 left to E3-08, now that the other tier is actually reachable.
 *
 * The `anderNiveau` branch had never executed in a browser: `/rooster` always answered `Themaperiode`, so the test
 * above had to *hand* the form another tier's grid to reach it. Here the real control does the switching, which is
 * what makes these assertions about the product rather than about a fixture.
 *
 * The sharpest of them is the first. The kalender holds the teacher's unsent parameter edit in its own state, and the
 * form holds the fields it was typed into. A switch that tore the screen down and rebuilt it would keep the parent's
 * edit and reload the form's fields from the server — the display/request desync E3-04's fix round 4 closed for a
 * failed settings load, re-created by a zoom control.
 */
describe("Generatieparameters — across a zoom switch (E3-08, FR-6.3)", () => {
  /** Subthemaperiodes nested in the two themaperiodes above, each parent's first part sharing its start date. */
  const fijnRooster: Planningsrooster = {
    ...rooster,
    niveau: "Subthemaperiode",
    blokken: [
      { ordinaal: 1, start: "2026-09-01", eind: "2026-09-16", ouderOrdinaal: 1, aantalOpenDagen: 16 },
      { ordinaal: 2, start: "2026-09-17", eind: "2026-10-02", ouderOrdinaal: 1, aantalOpenDagen: 16 },
      { ordinaal: 3, start: "2026-11-09", eind: "2026-11-22", ouderOrdinaal: 2, aantalOpenDagen: 14 },
      { ordinaal: 4, start: "2026-11-23", eind: "2026-12-20", ouderOrdinaal: 2, aantalOpenDagen: 28 },
    ],
  };

  const zoom = (sleutel: "kalender.weergaveGrof" | "kalender.weergaveFijn") =>
    within(screen.getByRole("group", { name: t("kalender.weergaveLabel") })).getByRole("button", {
      name: t(sleutel),
    });

  it("keeps an unsent edit through a switch to the finer tier and back, and still sends it", async () => {
    const posts = stubFetch(resultaat(leegRapport), { fijnRooster });
    renderKalender();

    // Type an edit and do NOT generate. This is the state the switch must not touch.
    await openForm();
    await waitFor(() => expect(periodeKeuze(1)).toBeInTheDocument());
    fireEvent.change(periodeKeuze(1), { target: { value: "Herfst" } });

    const trigger = screen.getByRole("button", { name: new RegExp(t("parameters.titel")) });
    await waitFor(() => expect(trigger.textContent).toContain("1 startthema"));

    fireEvent.click(zoom("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    // Obligation 1: at the fine tier the form renders no period rows and makes no stranded claim, because it cannot
    // tell which periods these blocks are. The panel is still OPEN, which is only possible if it was never remounted.
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const startthemas = screen.getByRole("group", { name: t("parameters.startthemasTitel") });
    expect(within(startthemas).getByText(t("parameters.anderNiveau"))).toBeInTheDocument();
    expect(within(startthemas).queryByRole("combobox")).toBeNull();
    expect(
      screen.queryByRole("region", { name: t("parameters.vervallenTitelEnkelvoud") }),
    ).toBeNull();
    // The summary still counts the edit: it is not "lost while another tier is shown".
    expect(trigger.textContent).toContain("1 startthema");

    fireEvent.click(zoom("kalender.weergaveGrof"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabel") })).toBeInTheDocument(),
    );

    // Back at the generation tier the row is there again with the teacher's own choice still in it, not reloaded from
    // the server's older copy.
    expect(periodeKeuze(1)).toHaveValue("Herfst");
    expect(periodeKeuze(2)).toHaveValue("");

    await genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!)).toEqual({
      gewensteStartthemas: [{ blokStart: "2026-09-01", themaNaam: "Herfst" }],
      vasteMomenten: [],
    });
  });

  it("sends the kept settings unchanged while the finer tier is showing", async () => {
    const posts = stubFetch(resultaat(leegRapport), {
      fijnRooster,
      instellingen: {
        // Valid at the generation tier: themaperiode 2's start date.
        gewensteStartthemas: [{ blokStart: "2026-11-09", themaNaam: "Water" }],
        vasteMomenten: [{ naam: "Schoolfeest", datum: "2026-09-15", blokkeertPlaatsing: true }],
      },
    });
    renderKalender();

    const trigger = await screen.findByRole("button", { name: new RegExp(t("parameters.titel")) });
    await waitFor(() => expect(trigger.textContent).toContain("1 startthema"));

    fireEvent.click(zoom("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    // Generating from the fine view is still allowed, and it must not quietly change what is stored: the run is at the
    // generation tier whatever the board happens to be showing.
    await genereer();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0]!)).toEqual({
      gewensteStartthemas: [{ blokStart: "2026-11-09", themaNaam: "Water" }],
      vasteMomenten: [{ naam: "Schoolfeest", datum: "2026-09-15", blokkeertPlaatsing: true }],
    });
  });

  it("names the control in the copy that tells a teacher where to set a startthema", async () => {
    // Obligation 2. The copy used to name a control that did not exist ("zet de kalender terug op het hele jaar"), then
    // described a state instead ("zolang de kalender het hele schooljaar toont") — which is subtly false, because BOTH
    // tiers show the whole school year. It now names the control and the tier, so this asserts the agreement rather
    // than the sentence: the words in the message have to be the words on the buttons.
    stubFetch(resultaat(leegRapport), { fijnRooster });
    renderKalender();

    await openForm();
    fireEvent.click(zoom("kalender.weergaveFijn"));
    await waitFor(() =>
      expect(screen.getByRole("list", { name: t("kalender.ribbonLabelFijn") })).toBeInTheDocument(),
    );

    const bericht = t("parameters.anderNiveau");
    expect(screen.getByText(bericht)).toBeInTheDocument();
    expect(bericht).toContain(t("kalender.weergaveGrof"));
    expect(bericht).toContain(t("kalender.weergaveLabel").toLowerCase());
    // And it no longer claims the finer view is not the whole school year.
    expect(bericht).not.toContain("hele schooljaar");
  });
});

describe("Generatieparameters — the report (E3-04, FR-5.4)", () => {
  it("names a refused thema in Dutch, keeps the AI motivation, and shows no ISO date", async () => {
    stubFetch(
      resultaat({
        ...leegRapport,
        geweigerdDoorVastMoment: [
          {
            themaNaam: "Herfst",
            blokStart: "2026-09-01",
            momentNaam: "Schoolfeest",
            aiMotivatie: "past bij het begin van het schooljaar",
          },
        ],
        heeftAandachtspunten: true,
      }),
    );
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    await genereer();

    const regel = await screen.findByText(
      t("parameters.rapportGeweigerdRegel", {
        thema: "Herfst",
        datum: "1 sep",
        moment: "Schoolfeest",
      }),
    );
    expect(regel).toBeInTheDocument();

    // The proposal survives its refusal: the teacher can still read what the AI suggested.
    expect(
      screen.getByText(new RegExp("past bij het begin van het schooljaar")),
    ).toBeInTheDocument();

    // And it says what to do about it, because the thema is now planned nowhere — in the singular, since one refusal
    // is the common case and the heading beside it is already singular.
    expect(screen.getByText(t("parameters.rapportGeweigerdWatNuEnkelvoud"))).toBeInTheDocument();
    expect(screen.queryByText(t("parameters.rapportGeweigerdWatNu"))).toBeNull();

    // Never the server's ISO date.
    expect(screen.queryByText(/2026-09-01/)).toBeNull();
  });

  it("tells a teacher's own conflict apart from the model declining", async () => {
    stubFetch(
      resultaat({
        ...leegRapport,
        tegenstrijdigeStartthemas: ["Water"],
        heeftAandachtspunten: true,
      }),
    );
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    await genereer();

    // The conflict copy tells them to change one of their two settings...
    expect(
      await screen.findByText(
        new RegExp(t("parameters.rapportTegenstrijdigEnkelvoud", { themas: "Water" })),
      ),
    ).toBeInTheDocument();

    // ...and must NOT claim the AI ignored them, which would send them to re-run instead.
    expect(
      screen.queryByText(
        new RegExp(t("parameters.rapportNietGehonoreerdEnkelvoud", { themas: "Water" })),
      ),
    ).toBeNull();
  });

  it("reports a kept preference whose period no longer exists, in the singular", async () => {
    stubFetch(
      resultaat({
        ...leegRapport,
        vervallenStartthemas: [{ blokStart: "2026-10-05", themaNaam: "Water" }],
        heeftAandachtspunten: true,
      }),
    );
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    await genereer();

    expect(
      await screen.findByText(
        t("parameters.rapportVervallenEnkelvoud", {
          themas: t("parameters.rapportVervallenItem", { thema: "Water", datum: "5 okt" }),
        }),
      ),
    ).toBeInTheDocument();

    // Not blamed on the model, which would send the teacher to re-run instead of to the beheerder.
    expect(
      screen.queryByText(
        new RegExp(t("parameters.rapportNietGehonoreerdEnkelvoud", { themas: "Water" })),
      ),
    ).toBeNull();
  });

  it("renders nothing when the run used no parameters", async () => {
    stubFetch(resultaat(null));
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    await genereer();

    await waitFor(() =>
      expect(screen.getByText(new RegExp(t("kalender.genereerGeluktEnkelvoud", { aantal: 1 })))).toBeInTheDocument(),
    );
    expect(screen.queryByText(t("parameters.rapportTitel"))).toBeNull();
  });

  // The shape the server ACTUALLY sends for a successful run with no parameters is ParameterRapport.Geen - an object
  // of empty lists - not null. Both must render nothing, and until now every "no parameters" test used the fictional
  // null.
  it("renders nothing for the empty report the server really sends", async () => {
    stubFetch(resultaat(leegRapport));
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    await genereer();

    await waitFor(() =>
      expect(
        screen.getByText(new RegExp(t("kalender.genereerGeluktEnkelvoud", { aantal: 1 }))),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(t("parameters.rapportTitel"))).toBeNull();
  });

  it("names a single unknown thema in the singular", async () => {
    stubFetch(
      resultaat({ ...leegRapport, onbekendeStartthemas: ["Ruimtevaart"], heeftAandachtspunten: true }),
    );
    renderKalender();
    await screen.findByRole("button", { name: t("kalender.genereer") });
    await genereer();

    // This line was the one report entry with no singular sibling, so one unknown thema read
    // "Deze thema's kent de school niet" - the fourth instance of a plural bug this project keeps shipping.
    expect(
      await screen.findByText(
        new RegExp(t("parameters.rapportOnbekendEnkelvoud", { themas: "Ruimtevaart" })),
      ),
    ).toBeInTheDocument();
  });

  it("has no axe violations with the form open, a stranded setting and a report showing", async () => {
    stubFetch(
      resultaat({
        ...leegRapport,
        nietGehonoreerdeStartthemas: ["Water"],
        toegepasteVasteMomenten: [
          { naam: "Schoolfeest", datum: "2026-09-15", blokkeertPlaatsing: true, blokStart: "2026-09-01" },
        ],
        heeftAandachtspunten: true,
      }),
      {
        instellingen: {
          gewensteStartthemas: [{ blokStart: "2026-10-05", themaNaam: "Water" }],
          vasteMomenten: [],
        },
      },
    );
    const { container } = renderKalender();
    await openForm();
    fireEvent.click(await screen.findByRole("button", { name: t("parameters.momentToevoegen") }));
    await genereer();
    await screen.findByText(t("parameters.rapportTitel"));

    // Structure only: jsdom cannot evaluate colour, so this says nothing about contrast (the E3-06 lesson).
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * Switching class, which is the second way a pending edit reaches the wrong run (fix round 3).
 *
 * The kalender keeps the teacher's unsaved parameter edit in component state, and the klas selector lives in the
 * shell **above** the router outlet on the same route — so switching class changes a prop and remounts nothing. Class
 * A's edit would then sit on top of class B's loaded settings, and because a generation body *replaces* the kept
 * settings wholesale, one run would overwrite B's stored settings with A's: a blocking vast moment nobody ever saw,
 * deleted. The gate on unknown settings cannot help, because the desync begins the moment B's settings are *known*.
 *
 * So this renders the real {@link JaarplanPagina} under a router, with a stand-in for the shell's selector as a
 * SIBLING above it: the fix is the `key` on that page, and a test that keyed the component itself would pass without
 * it. Every other test in this file uses one class throughout, which is why none of them could catch this.
 */
describe("Generatieparameters — switching class (E3-04)", () => {
  const KLAS_B = "33333333-3333-3333-3333-333333333333";

  const instellingenA: Generatieparameters = { gewensteStartthemas: [], vasteMomenten: [] };
  const instellingenB: Generatieparameters = {
    gewensteStartthemas: [{ blokStart: "2026-11-09", themaNaam: "Water" }],
    vasteMomenten: [{ naam: "Oudercontact", datum: "2026-12-01", blokkeertPlaatsing: true }],
  };

  /** Per-class stub: the URL carries the class id, so every response and every captured POST is attributable. */
  function stubKlassen(instellingen: Record<string, Generatieparameters>) {
    const posts: { klasId: string; body: string | undefined }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const klasId = /\/api\/klassen\/([^/]+)\//.exec(url)?.[1] ?? "";

        if (init?.method === "POST" && url.includes("/generatie")) {
          posts.push({ klasId, body: init.body === undefined ? undefined : String(init.body) });
          return new Response(JSON.stringify(resultaat(leegRapport)), { status: 200 });
        }
        if (url.includes("/jaarplan/parameters")) {
          return new Response(JSON.stringify(instellingen[klasId]), { status: 200 });
        }
        if (url.includes("/api/themas")) {
          return new Response(
            JSON.stringify([
              { id: "t0", naam: "Herfst" },
              { id: "t1", naam: "Water" },
            ]),
            { status: 200 },
          );
        }
        if (url.includes("/rooster")) {
          return new Response(JSON.stringify(rooster), { status: 200 });
        }
        if (url.includes("/jaarplan")) {
          return new Response(JSON.stringify({ ...leegPlan, klasId }), { status: 200 });
        }

        throw new Error(`onverwachte fetch: ${url}`);
      }),
    );

    return posts;
  }

  /** Stands in for the shell's klas selector: a sibling above the page, on the same route (ADR-0021). */
  function Klaskiezer({ naar }: { naar: string }) {
    const { kiesKlas } = useSelectie();

    return (
      <button type="button" onClick={() => kiesKlas(naar)}>
        wissel van klas
      </button>
    );
  }

  it("does not send one class's pending edit as another class's parameters", async () => {
    const posts = stubKlassen({ [KLAS_ID]: instellingenA, [KLAS_B]: instellingenB });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/jaarplan?${KLAS_PARAM}=${KLAS_ID}`]}>
          <Klaskiezer naar={KLAS_B} />
          <JaarplanPagina />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Under class A: set a startthema and do NOT generate. This edit belongs to A and to nothing else.
    await openForm();
    await waitFor(() => expect(periodeKeuze(1)).toBeInTheDocument());
    fireEvent.change(periodeKeuze(1), { target: { value: "Herfst" } });

    const trigger = screen.getByRole("button", { name: new RegExp(t("parameters.titel")) });
    await waitFor(() => expect(trigger.textContent).toContain("1 startthema"));

    // Two clicks in the header is all it takes.
    fireEvent.click(screen.getByRole("button", { name: "wissel van klas" }));

    // B's settings arrive: one startthema and one vast moment, which is what the screen now describes.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: new RegExp(t("parameters.titel")) }).textContent,
      ).toContain("1 vast moment"),
    );
    // The panel is closed again, because the subtree was remounted rather than re-rendered with a new prop.
    expect(
      screen.getByRole("button", { name: new RegExp(t("parameters.titel")) }),
    ).toHaveAttribute("aria-expanded", "false");

    await genereer();

    // The run is B's, and its body is B's kept settings — not A's "Herfst" in period 1, which would have replaced
    // B's stored settings wholesale and deleted the blocking Oudercontact.
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].klasId).toBe(KLAS_B);
    expect(JSON.parse(posts[0].body!)).toEqual(instellingenB);
  });
});

/**
 * Guards the owner's no-em-dash instruction across the WHOLE catalogue, not just this feature.
 *
 * The first version read `(t as unknown as { catalogus?: unknown }).catalogus ?? {}`, which always resolved to `{}` —
 * so `expect("{}").not.toContain("—")` could never fail — and then queried a `document.body` that `afterEach` had
 * already emptied, which could never fail either. Real coverage was three hard-listed keys out of roughly forty. A
 * test that reads like a catalogue-wide guard and cannot fail is worse than no test, which is this repo's own
 * recorded lesson about a test that pinned wrong copy.
 */
it("uses no em dashes anywhere in the Dutch catalogue", () => {
  expect(JSON.stringify(nl)).not.toContain("—");
});
