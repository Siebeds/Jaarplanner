/**
 * Wire types for the week view inside a themaperiode (E9-04, FR-6.2/FR-7.2) — the shape of
 * `GET /api/klassen/{klasId}/jaarplan/weekplanning`.
 *
 * These mirror the backend read models (`Weekplanningweergave` / `Dagweergave` / `GeplandeActiviteitWeergave`) exactly,
 * and nothing here is derived or renamed, so a drift between the two is a compile error at the call site rather than a
 * wrong picture.
 *
 * Dates arrive as ISO `yyyy-MM-dd` strings (C# `DateOnly`) and are kept as strings, like the kalender's own types:
 * every use is comparison or display, both correct on ISO strings, and parsing to `Date` would introduce a timezone a
 * school year does not have.
 *
 * **The server reports days, never weeks** — see [ADR-0023](../../../../../docs/adr/0023-activiteit-day-placement.md).
 * A week is a grouping this client draws (`groepeerInWeken`), and there is deliberately no week or block key anywhere
 * in this file: an activiteit is placed on a calendar date, and `Planningsblokniveau` gained no member for it.
 */

import type { Plaatsingstatus } from "../types";

/** One stretch of days with what is scheduled on them. */
export interface Weekplanning {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  /**
   * First day of the range, inclusive — **as answered, not as asked**.
   *
   * The server clamps the range to the school year rather than refusing it, so the week containing the first or last
   * school day is renderable. A screen that echoed the requested range instead of this one would draw days the answer
   * does not contain.
   */
  van: string;
  /** Last day of the range, inclusive; clamped like {@link van}. */
  tot: string;
  /** Every day in the range in chronological order, **open and closed alike**. */
  dagen: Dag[];
}

/** One day of the range. */
export interface Dag {
  datum: string;
  /**
   * Whether the school is open.
   *
   * **This counts a weekend as open**, because nothing in the backend model represents a weekend
   * (`Schooljaar.IsLesdag` excludes only closures). So a Saturday inside the school year arrives as `true`, and
   * deciding whether to draw Saturday and Sunday at all is this client's job — see `WEEKDAGEN` in `weekIndeling`.
   * Do not read this as "a teaching day a teacher would recognise".
   */
  isLesdag: boolean;
  /**
   * The school's own name for the closure covering this day ("Herfstvakantie"), or null when the day is open.
   *
   * Present so a screen can say *why* a day takes nothing (the E3-06 rule: a withheld control states its reason in
   * visible text) rather than rendering an inert cell a teacher reads as a bug.
   */
  sluitingsnaam: string | null;
  /**
   * What is scheduled, in the teacher's own order. Empty is the normal state and means nothing is planned — never
   * "this day cannot hold anything", which is what {@link isLesdag} says.
   */
  activiteiten: GeplandeActiviteit[];
}

/** One scheduled activiteit, with just enough of its content tree to be recognisable on a day card. */
export interface GeplandeActiviteit {
  /** The placement's own id — what a move or a delete addresses. */
  plaatsingId: string;
  activiteitId: string;
  activiteitNaam: string;
  /** The activiteit type as the API serialises the enum (by name). */
  activiteitType: string;
  subthemaId: string;
  /**
   * The subthema's name.
   *
   * Carried because planning the subthema's of a period is the screen's whole purpose: a day card naming only the
   * activiteit would leave a teacher unable to see whether a fortnight of one subthema had been scheduled.
   */
  subthemaNaam: string;
  themaId: string;
  themaNaam: string;
  volgorde: number;
  status: Plaatsingstatus;
  /**
   * The leerplandoel codes this activiteit carries.
   *
   * **Display only, and never a coverage figure.** Art. V.1 makes a doel gedekt through the *thema's* placement in the
   * plan, so scheduling the activiteit onto a Tuesday changes nothing in dekking. A screen may show these codes; a
   * screen may not count them into a dekkingscijfer — that would let the calendar grant coverage twice for the same
   * content. The coverage bar (E9-06) reads `/dekking`, never this.
   */
  doelcodes: string[];
  /**
   * True when this day lies outside the themaperiode its thema is placed in.
   *
   * **Reported, never refused** (ADR-0023 decision 7): a teacher who front-loads one activiteit is not making a
   * mistake, and refusing it would be the tool inventing a rule the school never stated. `false` when the thema is not
   * placed at all — there is then no period for the day to fall outside of, so a screen must not report a mismatch
   * against nothing.
   */
  valtBuitenThemaperiode: boolean;
}

/** The body of a scheduling request. */
export interface Dagplanning {
  activiteitId: string;
  datum: string;
  /** Position within the day; 0 is "first". */
  volgorde: number;
}

/** The body of a move. */
export interface Dagwijziging {
  datum: string;
  volgorde: number;
}
