import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { t } from "../../../i18n";
import { ApiError } from "../../../lib/api";
import type { Planningsblok, Themaplaatsing } from "../types";
import { Weekpaneel } from "./Weekpaneel";
import type { Weekplanning } from "./types";

/**
 * E9-04: one themaperiode, week by week — the screen the directie asked for (CR2, FR-6.2/FR-7.2).
 *
 * These are organised around the four things that would make the screen dishonest rather than merely ugly: a weekend
 * that swallows a placement, a closed day that offers a control, a period whose thema is missing without saying so, and
 * a failed read that reads as a lost plan.
 */

const BLOK: Planningsblok = {
  ordinaal: 2,
  // 2026-09-07 is a Monday; five weeks to 2026-10-11.
  start: "2026-09-07",
  eind: "2026-10-11",
  ouderOrdinaal: null,
  aantalOpenDagen: 35,
  aantalOpenWeekdagen: 25,
};

const PLAATSING: Themaplaatsing = {
  id: "p1",
  themaId: "thema-1",
  themaNaam: "Herfst",
  blokNiveau: "Themaperiode",
  blokStart: BLOK.start,
  blokEind: BLOK.eind,
  blokOrdinaal: 2,
  isVervallen: false,
  status: "Aanvaard",
  aiMotivatie: null,
  vergrendeld: false,
  doelcodes: ["NAT-K3-01"],
  duurWeken: 5,
};

function dag(datum: string, extra: Partial<Weekplanning["dagen"][number]> = {}) {
  return { datum, isLesdag: true, sluitingsnaam: null, activiteiten: [], ...extra };
}

const geplandeActiviteit = {
  plaatsingId: "ap1",
  activiteitId: "a1",
  activiteitNaam: "Bladeren zoeken",
  activiteitType: "Waarneming",
  subthemaId: "s1",
  subthemaNaam: "Herfstbladeren",
  themaId: "thema-1",
  themaNaam: "Herfst",
  volgorde: 0,
  status: "Manueel" as const,
  doelcodes: ["NAT-K3-01"],
  valtBuitenThemaperiode: false,
};

const WEEK: Weekplanning = {
  klasId: "klas-1",
  klasNaam: "K3",
  schooljaarId: "sj-1",
  schooljaarNaam: "2026-2027",
  van: "2026-09-07",
  tot: "2026-09-13",
  dagen: [
    dag("2026-09-07"),
    dag("2026-09-08"),
    dag("2026-09-09"),
    dag("2026-09-10"),
    dag("2026-09-11"),
    dag("2026-09-12"),
    dag("2026-09-13"),
  ],
};

const haalWeekplanning = vi.fn();
const planActiviteit = vi.fn();
const verwijderActiviteitplaatsing = vi.fn();

vi.mock("./api", () => ({
  haalWeekplanning: (...args: unknown[]) => haalWeekplanning(...args),
  planActiviteit: (...args: unknown[]) => planActiviteit(...args),
  verplaatsActiviteit: vi.fn(),
  verwijderActiviteitplaatsing: (...args: unknown[]) => verwijderActiviteitplaatsing(...args),
}));

const haalThemaVoorKlas = vi.fn();
vi.mock("../../themas/api", () => ({
  haalThemaVoorKlas: (...args: unknown[]) => haalThemaVoorKlas(...args),
}));

/**
 * The picker's disclosure button for the first drawn day (Monday 2026-09-07).
 *
 * Named through the catalogue rather than by a regex over its sentence. Three call sites used
 * `/Activiteit inplannen op/` — a hand-written prefix of `weekplanning.planAria` — which is the practice this same
 * change set removed from the remove-button test, with an explanation, and then reintroduced twice beside it.
 */
const planKnop = () =>
  screen.getByRole("button", {
    name: t("weekplanning.planAria", { dag: "maandag", datum: "7 september" }),
  });

function renderPaneel(overrides: Partial<Parameters<typeof Weekpaneel>[0]> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Weekpaneel
        klasId="klas-1"
        blok={BLOK}
        schooljaarStart="2026-09-01"
        schooljaarEind="2027-06-30"
        plaatsingen={[PLAATSING]}
        onTerug={() => {}}
        {...overrides}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  haalWeekplanning.mockResolvedValue(WEEK);
  planActiviteit.mockResolvedValue(WEEK);
  verwijderActiviteitplaatsing.mockResolvedValue(WEEK);
  haalThemaVoorKlas.mockResolvedValue({
    id: "thema-1",
    naam: "Herfst",
    subthemas: [
      {
        id: "s1",
        naam: "Herfstbladeren",
        activiteiten: [{ id: "a1", naam: "Bladeren zoeken" }],
      },
    ],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Weekpaneel", () => {
  it("names the period, its span and both of its length figures", async () => {
    renderPaneel();

    expect(await screen.findByRole("heading", { name: /Periode 2/ })).toBeInTheDocument();
    // Weeks from open days, school days from weekdays. Never the other way round (E9-02).
    expect(screen.getByText(/5 weken/)).toBeInTheDocument();
    expect(screen.getByText(/25 schooldagen/)).toBeInTheDocument();
  });

  /**
   * The period's subject. Unconditional and not behind the uitleg switch: without it the day rows are a calendar with no
   * subject, and the picker offers activiteiten whose provenance would be unexplained.
   */
  it("names the thema's placed in this period", async () => {
    renderPaneel();

    expect(await screen.findByText(/Herfst/)).toBeInTheDocument();
  });

  /**
   * **A period with no thema says so and points at the fix.** That is the E3-06 rule rather than help: an empty screen
   * is an invitation to act, and the alternative is a week of blank rows a teacher cannot explain.
   */
  it("says a period without a thema is empty and where to fix it", async () => {
    renderPaneel({ plaatsingen: [] });

    expect(await screen.findByText(t("weekplanning.geenThema"))).toBeInTheDocument();
  });

  /**
   * **Weekdays always, weekend only when occupied.** The server cannot help — `IsLesdag` excludes only closures, so a
   * Saturday inside the year arrives as a teaching day — and two permanently empty columns spend a seventh of the screen
   * on days nobody teaches.
   */
  it("hides an empty weekend", async () => {
    renderPaneel();

    await screen.findByText(/ma 7 sep/);

    expect(screen.queryByText(/za 12 sep/)).not.toBeInTheDocument();
    expect(screen.queryByText(/zo 13 sep/)).not.toBeInTheDocument();
  });

  /**
   * **But never hides one that holds something.** A placement on a Saturday is reachable through the API, and a hidden
   * row would make a teacher's own work invisible — which is worse than a wasted column.
   */
  it("shows a weekend day that holds an activiteit", async () => {
    haalWeekplanning.mockResolvedValue({
      ...WEEK,
      dagen: WEEK.dagen.map((d) =>
        d.datum === "2026-09-12" ? { ...d, activiteiten: [geplandeActiviteit] } : d,
      ),
    });

    renderPaneel();

    expect(await screen.findByText(/za 12 sep/)).toBeInTheDocument();
    expect(screen.getByText("Bladeren zoeken")).toBeInTheDocument();
  });

  /**
   * **A closed day states its closure and offers no control.** The name is the school's own, which is the fact that makes
   * the missing button make sense (the E3-06 rule). The server would refuse the placement anyway, so this is the screen
   * agreeing with it rather than provoking a 400.
   */
  it("names the closure on a closed day and withholds the plan control", async () => {
    haalWeekplanning.mockResolvedValue({
      ...WEEK,
      dagen: WEEK.dagen.map((d) =>
        d.datum === "2026-09-09" ? { ...d, isLesdag: false, sluitingsnaam: "Pedagogische studiedag" } : d,
      ),
    });

    renderPaneel();

    expect(await screen.findByText(/Pedagogische studiedag/)).toBeInTheDocument();
    // Four open weekdays keep their control; the closed one does not.
    expect(screen.getAllByRole("button", { name: /Activiteit inplannen op/ })).toHaveLength(4);
  });

  it("plans an activiteit on a day through the picker", async () => {
    const gebruiker = userEvent.setup();
    renderPaneel();

    await screen.findByText(/ma 7 sep/);
    await gebruiker.click(planKnop());

    await gebruiker.click(await screen.findByRole("button", { name: /Bladeren zoeken/ }));

    await waitFor(() =>
      expect(planActiviteit).toHaveBeenCalledWith("klas-1", {
        activiteitId: "a1",
        datum: "2026-09-07",
        volgorde: 0,
      }),
    );
  });

  /**
   * Offering an activiteit already on that day would produce the duplicate the server refuses with a 400, so the picker
   * filters it out rather than provoking the refusal.
   *
   * **This test used to assert `planGeenKeuze` here, and that is how the false sentence stayed invisible.** A passing
   * test encoded *"Deze klas heeft nog geen activiteiten in de thema's van deze periode"* for a class whose activiteit
   * was on screen one line above. Corrected 2026-08-20 on the audit's finding: the filter is still the subject, the
   * expectation was the defect. See `says the activiteiten are already on this day rather than that none exist` for the
   * dedicated case.
   */
  it("does not offer an activiteit already on that day", async () => {
    const gebruiker = userEvent.setup();
    haalWeekplanning.mockResolvedValue({
      ...WEEK,
      dagen: WEEK.dagen.map((d) =>
        d.datum === "2026-09-07" ? { ...d, activiteiten: [geplandeActiviteit] } : d,
      ),
    });

    renderPaneel();
    await screen.findByText("Bladeren zoeken");
    await gebruiker.click(planKnop());

    expect(await screen.findByText(t("weekplanning.planAlGepland"))).toBeInTheDocument();
  });

  it("takes an activiteit off its day", async () => {
    const gebruiker = userEvent.setup();
    haalWeekplanning.mockResolvedValue({
      ...WEEK,
      dagen: WEEK.dagen.map((d) =>
        d.datum === "2026-09-07" ? { ...d, activiteiten: [geplandeActiviteit] } : d,
      ),
    });

    renderPaneel();

    // Named through the catalogue rather than by a hand-written regex over the sentence. The regex version broke the
    // moment SC 2.5.3 reworded this name (2026-08-20) — and a test that pins the wording of an accessible name will
    // fight every legitimate rewording while proving nothing the catalogue guard does not already prove.
    await gebruiker.click(
      await screen.findByRole("button", {
        name: t("weekplanning.verwijderAria", {
          activiteit: "Bladeren zoeken",
          dag: "maandag",
          datum: "7 september",
        }),
      }),
    );

    await waitFor(() => expect(verwijderActiviteitplaatsing).toHaveBeenCalledWith("klas-1", "ap1"));
  });

  /**
   * **Reported, never refused** (ADR-0023). A teacher who front-loads an activiteit is not making a mistake, so the
   * mismatch is a marker with a word beside it rather than a rejection — and never colour alone (Art. XII).
   */
  it("marks an activiteit that falls outside its thema's period", async () => {
    haalWeekplanning.mockResolvedValue({
      ...WEEK,
      dagen: WEEK.dagen.map((d) =>
        d.datum === "2026-09-07"
          ? { ...d, activiteiten: [{ ...geplandeActiviteit, valtBuitenThemaperiode: true }] }
          : d,
      ),
    });

    renderPaneel();

    expect(await screen.findByText(t("weekplanning.valtBuitenPeriode"))).toBeInTheDocument();
  });

  /**
   * A failed read is a degrade: unconditional, and it **says nothing changed**, because a failed fetch must not read as
   * a lost plan.
   */
  it("says nothing changed when the week cannot be loaded", async () => {
    haalWeekplanning.mockRejectedValue(new Error("stuk"));

    renderPaneel();

    const melding = await screen.findByRole("alert");
    expect(melding).toHaveTextContent(/Er is niets gewijzigd/);
    expect(screen.getByRole("button", { name: t("weekplanning.opnieuw") })).toBeInTheDocument();
  });

  it("steps between the weeks of the period", async () => {
    const gebruiker = userEvent.setup();
    renderPaneel();

    await screen.findByText(/ma 7 sep/);
    // The first week of the period, so there is nowhere earlier to go.
    expect(screen.getByRole("button", { name: /Vorige week/ })).toBeDisabled();

    await gebruiker.click(screen.getByRole("button", { name: /Volgende week/ }));

    await waitFor(() =>
      expect(haalWeekplanning).toHaveBeenCalledWith("klas-1", "2026-09-14", "2026-09-20"),
    );
  });

  it("jumps to a week from the mini calendar", async () => {
    const gebruiker = userEvent.setup();
    renderPaneel();

    await screen.findByText(/ma 7 sep/);
    await gebruiker.click(screen.getByRole("button", { name: /21 september 2026/ }));

    await waitFor(() =>
      expect(haalWeekplanning).toHaveBeenCalledWith("klas-1", "2026-09-21", "2026-09-27"),
    );
  });

  /** Days outside the school year are not offerable, and the reason is spoken rather than left to the disabled state. */
  it("refuses a mini-calendar day outside the school year", async () => {
    renderPaneel();

    await screen.findByText(/ma 7 sep/);
    const buiten = screen.getByRole("button", { name: /31 augustus 2026, Valt buiten dit schooljaar/ });

    expect(buiten).toBeDisabled();
  });

  /**
   * **A refused edit says what the server said** (the 2026-08-20 audit's first frontend MAJOR).
   *
   * The three mutations had no error surface at all, so a 400 rendered *nothing*: the card did not appear and the screen
   * looked like it had swallowed the click. `OngeldigeDagplanningFout` exists to be read — four Dutch sentences that
   * name the day and the closure — and every one of them was discarded.
   */
  it("shows the server's own Dutch refusal when a placement is rejected", async () => {
    const gebruiker = userEvent.setup();
    planActiviteit.mockRejectedValue(
      new ApiError(
        400,
        "Bad Request",
        "Op 2 november 2026 is de school gesloten (Herfstvakantie). Kies een andere dag.",
      ),
    );

    renderPaneel();
    await screen.findByText(/ma 7 sep/);
    await gebruiker.click(planKnop());
    await gebruiker.click(await screen.findByRole("button", { name: /Bladeren zoeken/ }));

    const melding = await screen.findByRole("alert");
    expect(melding).toHaveTextContent("Op 2 november 2026 is de school gesloten (Herfstvakantie).");
  });

  /**
   * **A status other than 400 gets our own sentence, never the body.** Those bodies are English operator diagnostics or
   * absent altogether, and rendering one puts a developer artefact on a teacher's screen — the defect E1-14 round 4
   * found. Also pins the dismissal: the notice is the teacher's to close, not a timer's.
   */
  it("maps a non-400 failure to its own copy and lets the teacher dismiss it", async () => {
    const gebruiker = userEvent.setup();
    verwijderActiviteitplaatsing.mockRejectedValue(
      new ApiError(500, "Server Error", "Object reference not set to an instance of an object."),
    );
    haalWeekplanning.mockResolvedValue({
      ...WEEK,
      dagen: WEEK.dagen.map((d) =>
        d.datum === "2026-09-07" ? { ...d, activiteiten: [geplandeActiviteit] } : d,
      ),
    });

    renderPaneel();
    await gebruiker.click(
      await screen.findByRole("button", {
        name: t("weekplanning.verwijderAria", {
          activiteit: "Bladeren zoeken",
          dag: "maandag",
          datum: "7 september",
        }),
      }),
    );

    const melding = await screen.findByRole("alert");
    expect(melding).toHaveTextContent(t("weekplanning.wijzigOnbeschikbaar"));
    // The English server text must not reach the screen.
    expect(melding).not.toHaveTextContent("Object reference");

    await gebruiker.click(screen.getByRole("button", { name: t("weekplanning.wijzigFoutSluiten") }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  /**
   * **A failed picker read must not claim the class has no activiteiten** (the audit's second frontend MAJOR, and the
   * E5-03 rule verbatim: a conditional sentence may assert only what its own render condition guarantees).
   *
   * `useQueries` leaves `data` undefined on failure, so the empty-set branch caught the failure case too and told the
   * teacher to go and create content that may already exist.
   */
  it("distinguishes a failed thema read from a class with no activiteiten", async () => {
    const gebruiker = userEvent.setup();
    haalThemaVoorKlas.mockRejectedValue(new ApiError(503, "Service Unavailable"));

    renderPaneel();
    await screen.findByText(/ma 7 sep/);
    await gebruiker.click(planKnop());

    expect(await screen.findByText(t("weekplanning.planFout"))).toBeInTheDocument();

    // The assertion that matters is the ABSENCE of the false claim, and it is checked after the degrade has arrived —
    // asserting it while the read is still in flight would pass with the whole guard deleted (the E9-06 lesson: if you
    // assert an absence, wait for the answer first).
    expect(screen.queryByText(t("weekplanning.planGeenKeuze"))).not.toBeInTheDocument();
  });

  /**
   * **The month grid follows the week view** (the audit's fourth frontend MAJOR).
   *
   * `useState`'s initialiser runs once, so stepping the week — the primary navigation of this screen — left the grid on
   * the first month. Week 3 of October rendered under a September header and, because no cell fell inside the shown
   * week, **not one gridcell carried `aria-selected="true"`**.
   *
   * Asserted on `aria-selected` rather than on the header text, because that attribute is the thing a screen reader
   * reads and the thing that vanished. Reverting the sync leaves zero selected cells and this test red.
   */
  it("moves the mini calendar to the month of the week the teacher stepped to", async () => {
    const gebruiker = userEvent.setup();
    renderPaneel();

    await screen.findByText(/ma 7 sep/);
    expect(screen.getByText("september 2026")).toBeInTheDocument();

    // 2026-09-07 + 4 weeks = 2026-10-05, which is in the period (it runs to 2026-10-11) and in another month.
    for (let stap = 0; stap < 4; stap += 1) {
      await gebruiker.click(screen.getByRole("button", { name: t("weekplanning.volgendeWeek") }));
    }

    expect(await screen.findByText("oktober 2026")).toBeInTheDocument();

    const geselecteerd = screen
      .getAllByRole("gridcell")
      .filter((cel) => cel.getAttribute("aria-selected") === "true");

    // A Monday-anchored week is seven days, and all seven of 5–11 October are drawn in the October grid.
    expect(geselecteerd).toHaveLength(7);
  });

  /**
   * The one honest state that stays: the teacher stepped the MONTH away from the shown week, so nothing is selected.
   * Said in words, because a grid with no highlight is otherwise indistinguishable from the defect above.
   */
  it("says so when the month is browsed away from the shown week", async () => {
    const gebruiker = userEvent.setup();
    renderPaneel();

    await screen.findByText(/ma 7 sep/);
    expect(screen.queryByText(t("minikalender.andereMaand"))).not.toBeInTheDocument();

    await gebruiker.click(screen.getByRole("button", { name: t("minikalender.volgendeMaand") }));
    await gebruiker.click(screen.getByRole("button", { name: t("minikalender.volgendeMaand") }));

    expect(await screen.findByText(t("minikalender.andereMaand"))).toBeInTheDocument();
    expect(
      screen.getAllByRole("gridcell").filter((cel) => cel.getAttribute("aria-selected") === "true"),
    ).toHaveLength(0);

    // And it is a way back, not just a notice (the E3-06 rule).
    await gebruiker.click(screen.getByRole("button", { name: t("minikalender.terugNaarWeek") }));
    expect(await screen.findByText("september 2026")).toBeInTheDocument();
  });

  /**
   * **A failed read of one thema must not hide the activiteiten of another** (audit round 2).
   *
   * `useQueries` runs one query per placed thema, so failure is partial. The first fix for the false-empty claim fired
   * on `some(isError)`, said "deze thema's" in the plural, and **threw the loaded choices away** — so one flaky request
   * made working data unreachable. The retry already refetched only the errored queries, which is what showed the copy
   * and the render had not followed the mechanism.
   */
  it("keeps the choices that loaded when one thema's read fails", async () => {
    const gebruiker = userEvent.setup();
    haalThemaVoorKlas.mockImplementation((themaId: string) =>
      themaId === "thema-2"
        ? Promise.reject(new ApiError(503, "Service Unavailable"))
        : Promise.resolve({
            id: "thema-1",
            naam: "Herfst",
            subthemas: [
              { id: "s1", naam: "Herfstbladeren", activiteiten: [{ id: "a1", naam: "Bladeren zoeken" }] },
            ],
          }),
    );

    renderPaneel({
      plaatsingen: [PLAATSING, { ...PLAATSING, id: "p2", themaId: "thema-2", themaNaam: "Water" }],
    });
    await screen.findByText(/ma 7 sep/);
    await gebruiker.click(planKnop());

    // The choice that loaded is still offered...
    expect(await screen.findByRole("button", { name: /Bladeren zoeken/ })).toBeInTheDocument();
    // ...beside a notice that claims only what happened, and never the plural "all of them failed".
    expect(screen.getByText(t("weekplanning.planFoutGedeeltelijk"))).toBeInTheDocument();
    expect(screen.queryByText(t("weekplanning.planFout"))).not.toBeInTheDocument();
  });

  /**
   * **`keuzes.length === 0` has three causes and only one of them is "this class has no activiteiten"** (audit round 2).
   *
   * The choices are filtered by what is already on the day, so a day holding the period's only activiteit empties the
   * picker while the content plainly exists. The comment added in round 1 asserted this branch was "reached only when
   * every read succeeded and still returned nothing", which made a pre-existing false sentence into a claimed
   * invariant. Now it is its own case.
   */
  it("says the activiteiten are already on this day rather than that none exist", async () => {
    const gebruiker = userEvent.setup();
    haalWeekplanning.mockResolvedValue({
      ...WEEK,
      dagen: WEEK.dagen.map((d) =>
        d.datum === "2026-09-07" ? { ...d, activiteiten: [geplandeActiviteit] } : d,
      ),
    });

    renderPaneel();
    await screen.findByText("Bladeren zoeken");
    await gebruiker.click(planKnop());

    expect(await screen.findByText(t("weekplanning.planAlGepland"))).toBeInTheDocument();
    expect(screen.queryByText(t("weekplanning.planGeenKeuze"))).not.toBeInTheDocument();
  });

  /**
   * **"Melding sluiten" must close the notice, not reveal the older one** (audit round 2).
   *
   * A mutation's `error` survives until its own next call, so two refused edits leave two mutations in error. Resetting
   * only the newest re-rendered the notice with the *previous* sentence — about a different day and an action the
   * teacher had moved on from, which is exactly what the newest-wins lookup exists to prevent. Two failures are the
   * only state that shows it, and round 1's test had one.
   */
  it("closes the notice even when two edits are in error", async () => {
    const gebruiker = userEvent.setup();
    planActiviteit.mockRejectedValue(
      new ApiError(400, "Bad Request", "Op 7 september 2026 is de school gesloten (Testdag). Kies een andere dag."),
    );
    verwijderActiviteitplaatsing.mockRejectedValue(new ApiError(500, "Server Error"));
    haalWeekplanning.mockResolvedValue({
      ...WEEK,
      dagen: WEEK.dagen.map((d) =>
        d.datum === "2026-09-07" ? { ...d, activiteiten: [geplandeActiviteit] } : d,
      ),
    });

    // A SECOND activiteit, because the day already holds `a1` and the picker filters out what is on it — so without
    // this there is nothing to plan and the first of the two failures cannot be provoked.
    haalThemaVoorKlas.mockResolvedValue({
      id: "thema-1",
      naam: "Herfst",
      subthemas: [
        {
          id: "s1",
          naam: "Herfstbladeren",
          activiteiten: [
            { id: "a1", naam: "Bladeren zoeken" },
            { id: "a2", naam: "Kastanjes rapen" },
          ],
        },
      ],
    });

    renderPaneel();
    await screen.findByText(/ma 7 sep/);

    // First failure: the plan.
    await gebruiker.click(planKnop());
    await gebruiker.click(await screen.findByRole("button", { name: /Kastanjes rapen/ }));
    await screen.findByText(/Op 7 september 2026 is de school gesloten/);

    // Second failure: the removal. Now both mutations are in error.
    await gebruiker.click(
      screen.getByRole("button", {
        name: t("weekplanning.verwijderAria", {
          activiteit: "Bladeren zoeken",
          dag: "maandag",
          datum: "7 september",
        }),
      }),
    );
    await screen.findByText(t("weekplanning.wijzigOnbeschikbaar"));

    await gebruiker.click(screen.getByRole("button", { name: t("weekplanning.wijzigFoutSluiten") }));

    // Gone, not replaced by the older sentence.
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.queryByText(/Op 7 september 2026 is de school gesloten/)).not.toBeInTheDocument();
  });

  /**
   * A 404 is the ordinary concurrent case — another session removed the placement — and *"probeer het opnieuw"* cannot
   * succeed on it, so it gets its own sentence. Round 1 folded it into a message that also promised "Er is niets
   * veranderd", which no non-400 branch can promise: all three service methods save and *then* project, so a failure
   * after the commit is reachable.
   */
  it("tells the teacher a vanished placement is gone rather than to retry", async () => {
    const gebruiker = userEvent.setup();
    verwijderActiviteitplaatsing.mockRejectedValue(new ApiError(404, "Not Found"));
    haalWeekplanning.mockResolvedValue({
      ...WEEK,
      dagen: WEEK.dagen.map((d) =>
        d.datum === "2026-09-07" ? { ...d, activiteiten: [geplandeActiviteit] } : d,
      ),
    });

    renderPaneel();
    await gebruiker.click(
      await screen.findByRole("button", {
        name: t("weekplanning.verwijderAria", {
          activiteit: "Bladeren zoeken",
          dag: "maandag",
          datum: "7 september",
        }),
      }),
    );

    expect(await screen.findByText(t("weekplanning.wijzigVerdwenen"))).toBeInTheDocument();
    // Nothing was written, so there is nothing to reload and the control must not be offered.
    expect(screen.queryByRole("button", { name: t("weekplanning.wijzigHerlaad") })).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = renderPaneel();
    await screen.findByText(/ma 7 sep/);

    expect(await axe(container)).toHaveNoViolations();
  });

  /**
   * The three surfaces this change set added were all outside the axe pass above, which renders the default state only
   * (audit round 2). Driven into the tree here: the mutation-error notice with its two controls, the picker degrade with
   * its retry, and the mini calendar's browsed-away notice.
   *
   * *Still not a substitute for the browser pass.* jsdom cannot evaluate colour, so the notice's
   * `text-suggestie-geweigerd` on `bg-suggestie-geweigerd/5` is unmeasured here — that combination is pre-existing
   * precedent on this screen and elsewhere, but a green axe run says nothing about it (`CLAUDE.md`).
   */
  it("has no axe violations with the error notice and both degrades on screen", async () => {
    const gebruiker = userEvent.setup();
    planActiviteit.mockRejectedValue(new ApiError(500, "Server Error"));
    haalThemaVoorKlas.mockRejectedValue(new ApiError(503, "Service Unavailable"));

    const { container } = renderPaneel();
    await screen.findByText(/ma 7 sep/);

    // The picker degrade.
    await gebruiker.click(planKnop());
    await screen.findByText(t("weekplanning.planFout"));

    // The mini calendar browsed away from the shown week.
    await gebruiker.click(screen.getByRole("button", { name: t("minikalender.volgendeMaand") }));
    await gebruiker.click(screen.getByRole("button", { name: t("minikalender.volgendeMaand") }));
    await screen.findByText(t("minikalender.andereMaand"));

    expect(await axe(container)).toHaveNoViolations();
  });
});
