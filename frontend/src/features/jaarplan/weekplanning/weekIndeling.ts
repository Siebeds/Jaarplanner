/**
 * The pure date arithmetic behind the week view and its mini calendar (E9-04 / E9-05).
 *
 * **String-free by design.** Nothing here formats anything a teacher reads: every function takes and returns ISO
 * `yyyy-MM-dd` strings or plain numbers, so the whole file is testable without `nl.json` and carries no copy that could
 * drift from the catalogue.
 *
 * **The server sends days; weeks are made here** ([ADR-0023](../../../../../docs/adr/0023-activiteit-day-placement.md)).
 * A week is a display convention, not school data, which is why no week key exists in the wire types and why
 * `Planningsblokniveau` gained no member for it.
 */

import type { Dag } from "./types";

/**
 * Days are parsed by their parts and never with `new Date(iso)`.
 *
 * `new Date("2026-09-07")` parses as **UTC midnight**, which is the previous day's evening anywhere west of Greenwich —
 * so `getDay()` returns the wrong weekday and a Monday silently becomes a Sunday, putting the whole week grid one column
 * out. `kalenderFormat.formatteerDatum` documents the same trap for display; this is its arithmetic counterpart.
 */
function naarDatum(isoDatum: string): Date {
  const [jaar, maand, dag] = isoDatum.split("-").map(Number);

  return new Date(jaar, maand - 1, dag);
}

/**
 * Back to ISO, built from the local parts for the same reason: `toISOString()` converts to UTC first and would shift
 * the date back a day for anyone east of Greenwich. Padded manually rather than via `Intl`, which has no ISO mode.
 */
function naarIso(datum: Date): string {
  const maand = `${datum.getMonth() + 1}`.padStart(2, "0");
  const dag = `${datum.getDate()}`.padStart(2, "0");

  return `${datum.getFullYear()}-${maand}-${dag}`;
}

/**
 * How many days into its week a date sits, Monday being 0.
 *
 * `Date.getDay()` is Sunday-based (Sunday = 0), and a Flemish school week starts on Monday — so a naive `getDay()`
 * would put Sunday at the *start* of its week instead of the end, silently grouping it with the following week.
 */
function dagenNaMaandag(datum: Date): number {
  return (datum.getDay() + 6) % 7;
}

/** Shifts an ISO date by whole days. Negative moves back. */
export function verschuifDagen(isoDatum: string, dagen: number): string {
  const datum = naarDatum(isoDatum);
  datum.setDate(datum.getDate() + dagen);

  return naarIso(datum);
}

/**
 * The Monday–Sunday range containing this date.
 *
 * **Monday is the week start, decided in one place.** Unlike the planningsblok grain — which Art. IX.3 makes ratified
 * configuration behind the E3-05 seam — nobody has asked for the week start to vary, so it is a constant here rather
 * than a setting. The server's `WeekplanningService.Week` makes the same choice; the two must agree, because the client
 * asks for a range and the server clamps it.
 */
export function weekVan(isoDatum: string): { van: string; tot: string } {
  const maandag = verschuifDagen(isoDatum, -dagenNaMaandag(naarDatum(isoDatum)));

  return { van: maandag, tot: verschuifDagen(maandag, 6) };
}

/** Shifts a whole week at a time — what the week view's previous/next controls step by. */
export function verschuifWeken(isoDatum: string, weken: number): string {
  return verschuifDagen(isoDatum, weken * 7);
}

/** True for Saturday and Sunday. */
export function isWeekend(isoDatum: string): boolean {
  return dagenNaMaandag(naarDatum(isoDatum)) >= 5;
}

/** One week of the drill-down: a Monday-anchored run of days as the server reported them. */
export interface Week {
  /** The week's Monday, as an ISO date. Stable identity for a key and for the mini calendar's highlight. */
  maandag: string;
  /**
   * 1-based position **within the requested range**, not within the year or the period.
   *
   * Deliberately not an ISO week number and deliberately not a period-relative ordinal: the range is whatever the
   * caller asked for and the server may have clamped it, so the only honest meaning is "the n-th week of what you are
   * looking at". A screen wanting "week 3 of 5" must derive that from the period it opened, not from this.
   */
  positie: number;
  /** The days of this week that the range actually contained, chronological. */
  dagen: Dag[];
}

/**
 * Groups the server's flat run of days into Monday-anchored weeks.
 *
 * **Partial weeks are kept, not padded and not dropped.** A range clamped to the school year legitimately starts
 * mid-week (1 September is rarely a Monday), and both alternatives are wrong: padding invents days the answer does not
 * contain, which is how a screen ends up offering a drop target for a date the server would refuse, and dropping the
 * partial week hides real teaching days at exactly the two edges of the year a teacher is most likely to check.
 *
 * Grouping is by each day's own Monday rather than by chunking into runs of seven, so a gap in the input (which the
 * current endpoint never produces, but a future filtered read could) cannot shift every later week by a column.
 */
export function groepeerInWeken(dagen: readonly Dag[]): Week[] {
  const perMaandag = new Map<string, Dag[]>();

  for (const dag of dagen) {
    const { van } = weekVan(dag.datum);
    const bestaand = perMaandag.get(van);

    if (bestaand) {
      bestaand.push(dag);
    } else {
      perMaandag.set(van, [dag]);
    }
  }

  return [...perMaandag.entries()]
    // Sorted on the ISO Monday, which sorts correctly as a string, rather than trusting input order.
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([maandag, eigenDagen], index) => ({
      maandag,
      positie: index + 1,
      dagen: [...eigenDagen].sort((a, b) => a.datum.localeCompare(b.datum)),
    }));
}

/**
 * The Mondays of every week a period touches, in order (E9-04).
 *
 * **Anchored on Mondays rather than counted off the period's start**, because a themaperiode rarely begins on one: a
 * period opening on a Wednesday shares its first week with the previous period, and a teacher looking at "week 1" of
 * this period expects to see that Wednesday in its real week rather than in a synthetic seven-day window starting on it.
 *
 * The last entry may be a week the period only partly occupies, for the same reason. Both edges are the school's
 * calendar, not this function's to tidy.
 */
export function wekenInPeriode(start: string, eind: string): string[] {
  const mondays: string[] = [];

  for (let maandag = weekVan(start).van; maandag <= eind; maandag = verschuifWeken(maandag, 1)) {
    mondays.push(maandag);
  }

  return mondays;
}

/** One cell of the mini calendar's month grid (E9-05). */
export interface Maanddag {
  datum: string;
  /** False for the leading/trailing days that belong to a neighbouring month. */
  inDezeMaand: boolean;
}

/**
 * A 6×7 month grid for the mini calendar, Monday-first, including the neighbouring days that fill the corners.
 *
 * **Always six rows.** A month needs five or six depending on where it starts, and a grid that changed height would
 * make the whole week view below it jump every time a teacher stepped a month — the kind of thing this repo's record
 * says only looking in a browser catches. Six rows always fit; the extra row is neighbouring days, which are marked as
 * such rather than blanked so the grid keeps its shape and a teacher can still click into the next month.
 *
 * **It knows nothing about the school year**, deliberately. Which days are offerable is the caller's decision, made
 * against the schooljaar the week view already holds: a generic grid that offered 14 July would be wrong, and a grid
 * that filtered on its own would need a second copy of the closure rules.
 *
 * @param jaar Full year, e.g. 2026.
 * @param maand 1-based month, so callers can pass what they read off an ISO string without an off-by-one.
 */
export function bouwMaandrooster(jaar: number, maand: number): Maanddag[] {
  const eerste = new Date(jaar, maand - 1, 1);
  const start = verschuifDagen(naarIso(eerste), -dagenNaMaandag(eerste));

  return Array.from({ length: 42 }, (_, index) => {
    const datum = verschuifDagen(start, index);

    return {
      datum,
      // Compared on the ISO prefix rather than by re-parsing: `yyyy-MM` is exactly the month identity.
      inDezeMaand: datum.startsWith(`${jaar}-${`${maand}`.padStart(2, "0")}-`),
    };
  });
}

/** The `yyyy-MM` of an ISO date — the mini calendar's month identity, and what its stepper moves. */
export function maandVan(isoDatum: string): { jaar: number; maand: number } {
  const [jaar, maand] = isoDatum.split("-").map(Number);

  return { jaar, maand };
}

/**
 * Steps a month, carrying the year.
 *
 * Written on the parts rather than with `setMonth`, which clamps oddly: `setMonth` on the 31st of a month lands in the
 * *next* month when the target is shorter (31 March minus one month yields 3 March). A month stepper that skipped
 * February would be a genuinely confusing control.
 */
export function verschuifMaand(
  jaar: number,
  maand: number,
  maanden: number,
): { jaar: number; maand: number } {
  const totaal = jaar * 12 + (maand - 1) + maanden;

  return { jaar: Math.floor(totaal / 12), maand: (totaal % 12) + 1 };
}

/**
 * Whether this date falls inside the school year — the caller's gate on what the mini calendar may offer.
 *
 * Bounds included, and compared as ISO strings, which is correct: `yyyy-MM-dd` sorts lexicographically the same way it
 * sorts chronologically, so no parsing is needed and no timezone can intrude.
 */
export function inSchooljaar(isoDatum: string, start: string, eind: string): boolean {
  return isoDatum >= start && isoDatum <= eind;
}
