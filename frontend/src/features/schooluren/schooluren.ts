import type { Vertaalsleutel } from "../../i18n";
import { weekdagIndex } from "../../lib/datum";
import { minuten } from "../plan/tijd";
import type { Schooldaguren, Schooluren } from "./gegevens";

/**
 * What the screens need to know about the school's hours (FB-023, ADR-0038), kept free of React so it can be tested
 * on its own.
 */

/** The weekdays that can have hours, in ISO numbering: Monday to Friday. */
export const WEEKDAGEN = [1, 2, 3, 4, 5] as const;

// 1 January 2024 was a Monday, so day `n` of that month is ISO weekday `n`. `Intl` says the name in Dutch, the way
// `lib/datum.ts` says every other date, so no weekday name is written out in the code.
const WEEKDAGNAAM = new Intl.DateTimeFormat("nl-BE", { weekday: "long", timeZone: "UTC" });

/** `maandag`, for inside a sentence. */
export function dagnaam(weekdag: number): string {
  return WEEKDAGNAAM.format(new Date(Date.UTC(2024, 0, weekdag)));
}

/** `Maandag`, for a row heading. */
export function Dagnaam(weekdag: number): string {
  const naam = dagnaam(weekdag);
  return naam.charAt(0).toUpperCase() + naam.slice(1);
}

/** The hours of the weekday this ISO date falls on, or undefined when that weekday has none. */
export function urenOp(uren: readonly Schooldaguren[] | undefined, isoDatum: string): Schooldaguren | undefined {
  const weekdag = weekdagIndex(isoDatum) + 1;
  return uren?.find((dag) => dag.weekdag === weekdag);
}

/**
 * Where the time grid should open: the whole hour in which the earliest school day among these days begins, so a day
 * starting at 8:30 opens at 8:00 with its first half hour shaded above the start. Only teaching days count, because a
 * closed day is drawn without hours. Undefined when none of the days has hours, and the grid keeps its own default.
 */
export function openingsminuut(
  uren: readonly Schooldaguren[] | undefined,
  dagen: readonly { datum: string; isLesdag: boolean }[],
): number | undefined {
  const begins = dagen
    .filter((dag) => dag.isLesdag)
    .map((dag) => urenOp(uren, dag.datum))
    .filter((dag): dag is Schooldaguren => dag !== undefined)
    .map((dag) => minuten(dag.begin));

  if (begins.length === 0) return undefined;
  return Math.floor(Math.min(...begins) / 60) * 60;
}

/**
 * The minutes a label in the hour gutter takes up below its line, and so how close two gutter labels may come (FB-058).
 * A `text-micro` line hangs about seventeen pixels, which is eighteen minutes at `PX_PER_MINUUT`.
 */
export const GOOTLABEL_MINUTEN = 18;

/**
 * The times the hour gutter writes where the school day starts, pauses and ends, for the teaching days on screen
 * (FB-058): the tinted stretches carry no words of their own, so these say where each one begins and ends.
 *
 * One gutter serves every column, so the times of all visible days are merged and deduplicated. A time that would
 * hang over another label is dropped: two words on top of each other say nothing, and the tint still shows that day's
 * edge. **The school day's begin and end win over a middagpauze** when two collide, since they are what a teacher
 * plans around; among equals the earlier time wins.
 */
export function grenstijden(
  uren: readonly Schooldaguren[] | undefined,
  dagen: readonly { datum: string; isLesdag: boolean }[],
): number[] {
  const schooldag = new Set<number>();
  const pauze = new Set<number>();
  for (const dag of dagen) {
    if (!dag.isLesdag) continue;
    const eigen = urenOp(uren, dag.datum);
    if (!eigen) continue;
    schooldag.add(minuten(eigen.begin));
    schooldag.add(minuten(eigen.einde));
    for (const tijd of [eigen.middagpauzeBegin, eigen.middagpauzeEinde]) {
      if (tijd) pauze.add(minuten(tijd));
    }
  }

  const oplopend = (tijden: Set<number>) => [...tijden].sort((a, b) => a - b);
  const uit: number[] = [];
  for (const minuut of [...oplopend(schooldag), ...oplopend(pauze)]) {
    if (uit.every((andere) => Math.abs(minuut - andere) >= GOOTLABEL_MINUTEN)) uit.push(minuut);
  }
  return uit.sort((a, b) => a - b);
}

/** One weekday as the form holds it: `HH:mm` or empty, as a time field gives it. */
export interface Dagvelden {
  begin: string;
  einde: string;
  /** Whether this day has a middagpauze. Unticked hides the two fields and sends none. */
  pauze: boolean;
  pauzeBegin: string;
  pauzeEinde: string;
}

/** A field the form can refuse before asking the server: a half-filled day or half-filled pause. */
export interface Veldfout {
  weekdag: number;
  sleutel: Extract<Vertaalsleutel, "schooluren.onvolledig" | "schooluren.pauzeOnvolledig">;
}

const hhmm = (tijd: string | null) => (tijd ?? "").slice(0, 5);

/**
 * The form's starting values: what the school has, and for a weekday without hours two empty fields with the pause
 * ticked, because most days have one and a Wednesday is the exception admin unticks.
 */
export function beginVelden(uren: readonly Schooldaguren[]): Record<number, Dagvelden> {
  return Object.fromEntries(
    WEEKDAGEN.map((weekdag) => {
      const dag = uren.find((d) => d.weekdag === weekdag);
      return [
        weekdag,
        {
          begin: hhmm(dag?.begin ?? null),
          einde: hhmm(dag?.einde ?? null),
          pauze: dag === undefined || dag.middagpauzeBegin !== null,
          pauzeBegin: hhmm(dag?.middagpauzeBegin ?? null),
          pauzeEinde: hhmm(dag?.middagpauzeEinde ?? null),
        },
      ];
    }),
  );
}

/**
 * What the form sends, or the first field it can refuse by itself.
 *
 * **Only completeness is checked here.** Whether an end lies after its start and whether the pause falls inside the
 * day are the server's rules, and its Dutch sentence names the weekday; checking them twice would give one rule two
 * wordings that could drift apart. A day with both fields empty has no hours and is left out.
 */
export function naarInvoer(velden: Record<number, Dagvelden>): Schooluren | { fout: Veldfout } {
  const dagen: Schooldaguren[] = [];

  for (const weekdag of WEEKDAGEN) {
    const dag = velden[weekdag];
    if (dag.begin === "" && dag.einde === "") continue;
    if (dag.begin === "" || dag.einde === "") return { fout: { weekdag, sleutel: "schooluren.onvolledig" } };

    const metPauze = dag.pauze;
    if (metPauze && (dag.pauzeBegin === "" || dag.pauzeEinde === "")) {
      return { fout: { weekdag, sleutel: "schooluren.pauzeOnvolledig" } };
    }

    dagen.push({
      weekdag,
      begin: `${dag.begin}:00`,
      einde: `${dag.einde}:00`,
      middagpauzeBegin: metPauze ? `${dag.pauzeBegin}:00` : null,
      middagpauzeEinde: metPauze ? `${dag.pauzeEinde}:00` : null,
    });
  }

  return { dagen };
}
