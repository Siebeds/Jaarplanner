/**
 * Dates arrive from the backend as plain `yyyy-MM-dd` (a C# `DateOnly`), never with a time or a
 * zone. They are parsed and formatted as such: `new Date("2026-09-01")` is UTC midnight, which in a
 * timezone behind UTC renders as 31 August. Splitting the string avoids the whole class of bug.
 */
const MAAND_KORT = new Intl.DateTimeFormat("nl-BE", { month: "short" });
const DAG_MAAND = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });

function lokaleDatum(isoDatum: string): Date {
  const [jaar, maand, dag] = isoDatum.split("-").map(Number);
  return new Date(jaar, maand - 1, dag);
}

/** "1 sep" */
export function dagMaand(isoDatum: string): string {
  return DAG_MAAND.format(lokaleDatum(isoDatum));
}

/** "sep" */
export function maandKort(isoDatum: string): string {
  return MAAND_KORT.format(lokaleDatum(isoDatum));
}

/** "1 sep - 12 okt", with an en dash, which is what a date range takes. */
export function periode(vanIso: string, totIso: string | null): string {
  return totIso ? `${dagMaand(vanIso)} – ${dagMaand(totIso)}` : dagMaand(vanIso);
}

/** Whole days between two dates, both ends included. Used to size the year strip. */
export function dagenTussen(vanIso: string, totIso: string): number {
  const dag = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((lokaleDatum(totIso).getTime() - lokaleDatum(vanIso).getTime()) / dag) + 1);
}
