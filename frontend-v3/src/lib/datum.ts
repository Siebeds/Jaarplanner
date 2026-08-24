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

/** ISO `yyyy-MM-dd` for a local Date, without going through UTC. */
export function isoVan(datum: Date): string {
  const maand = String(datum.getMonth() + 1).padStart(2, "0");
  const dag = String(datum.getDate()).padStart(2, "0");
  return `${datum.getFullYear()}-${maand}-${dag}`;
}

export function verschuif(isoDatum: string, dagen: number): string {
  const d = lokaleDatum(isoDatum);
  d.setDate(d.getDate() + dagen);
  return isoVan(d);
}

/** Monday of the week `isoDatum` falls in. Belgian school weeks start on Monday. */
export function maandagVan(isoDatum: string): string {
  const d = lokaleDatum(isoDatum);
  const verschil = (d.getDay() + 6) % 7; // Sunday is 0 in JS, and it is the last school day here
  d.setDate(d.getDate() - verschil);
  return isoVan(d);
}

export function eersteVanMaand(isoDatum: string): string {
  const d = lokaleDatum(isoDatum);
  return isoVan(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function laatsteVanMaand(isoDatum: string): string {
  const d = lokaleDatum(isoDatum);
  return isoVan(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function verschuifMaanden(isoDatum: string, maanden: number): string {
  const d = lokaleDatum(isoDatum);
  return isoVan(new Date(d.getFullYear(), d.getMonth() + maanden, 1));
}

/** "november 2026" */
const MAAND_JAAR = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });
export function maandJaar(isoDatum: string): string {
  return MAAND_JAAR.format(lokaleDatum(isoDatum));
}

/** "maandag 9 november" */
const VOLLE_DAG = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long" });
export function volleDag(isoDatum: string): string {
  return VOLLE_DAG.format(lokaleDatum(isoDatum));
}

/** "ma", "di", ... for the column heads of a month grid. */
const WEEKDAG_KORT = new Intl.DateTimeFormat("nl-BE", { weekday: "short" });
export function weekdagKort(isoDatum: string): string {
  return WEEKDAG_KORT.format(lokaleDatum(isoDatum));
}

/** Just the day number, for a cell in a month grid. */
export function dagNummer(isoDatum: string): number {
  return lokaleDatum(isoDatum).getDate();
}

export function maandVan(isoDatum: string): number {
  return lokaleDatum(isoDatum).getMonth();
}

/** Every date from `van` to `tot`, both ends included. */
export function datumsTussen(vanIso: string, totIso: string): string[] {
  const uit: string[] = [];
  for (let d = vanIso; d <= totIso; d = verschuif(d, 1)) uit.push(d);
  return uit;
}

export function valtBinnen(isoDatum: string, vanIso: string, totIso: string): boolean {
  return isoDatum >= vanIso && isoDatum <= totIso;
}
