/** The three ways the agenda shows the school year. */
export type Weergave = "maand" | "week" | "dag";

/**
 * THE WEEK IS THE DEFAULT (owner, 2026-09-14, TB-012): it is where a teacher plans, so an address that
 * names no view opens it, and that covers the sidebar's Agenda item and every link into a day from
 * elsewhere. Anything else in the URL means the default too, rather than an error page over a typo.
 */
export function leesWeergave(waarde: string | null): Weergave {
  return waarde === "maand" || waarde === "dag" ? waarde : "week";
}

/**
 * The query string that puts a view in the URL. Empty for the default, so the address of a week is the
 * bare one: the same address the sidebar and every other screen link to.
 */
export function weergaveZoek(weergave: Weergave): string {
  return weergave === "week" ? "" : `?weergave=${weergave}`;
}
