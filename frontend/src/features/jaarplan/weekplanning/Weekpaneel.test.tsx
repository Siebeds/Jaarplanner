import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { t } from "../../../i18n";
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
    await gebruiker.click(screen.getAllByRole("button", { name: /Activiteit inplannen op/ })[0]);

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
    await gebruiker.click(screen.getAllByRole("button", { name: /Activiteit inplannen op/ })[0]);

    expect(await screen.findByText(t("weekplanning.planGeenKeuze"))).toBeInTheDocument();
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
    await gebruiker.click(await screen.findByRole("button", { name: /van maandag 7 september halen/ }));

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

  it("has no axe violations", async () => {
    const { container } = renderPaneel();
    await screen.findByText(/ma 7 sep/);

    expect(await axe(container)).toHaveNoViolations();
  });
});
