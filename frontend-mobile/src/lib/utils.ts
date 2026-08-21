import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Formats an ISO (yyyy-MM-dd) date as short Dutch, e.g. "3 sep". */
export function kortDatum(iso: string): string {
  const datum = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return datum.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

export function langDatum(iso: string): string {
  const datum = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return datum.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Local-calendar-day ISO string (yyyy-MM-dd) — avoids `toISOString()`'s UTC shift at day boundaries. */
export function isoDatum(datum: Date): string {
  const jaar = datum.getFullYear();
  const maand = String(datum.getMonth() + 1).padStart(2, "0");
  const dag = String(datum.getDate()).padStart(2, "0");
  return `${jaar}-${maand}-${dag}`;
}
