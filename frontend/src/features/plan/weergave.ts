/** The four ways the agenda shows the school year. */
export type Weergave = "maand" | "week" | "werkweek" | "dag";

/**
 * THE WERKWEEK IS THE DEFAULT (FB-040): it is where a teacher plans, so an address that names no view opens it, and
 * that covers the sidebar's Agenda item and every link into a day from elsewhere. The agenda does not remember the view
 * chosen last time. Anything else in the URL means the default too, rather than an error page over a typo.
 */
export function leesWeergave(waarde: string | null): Weergave {
  return waarde === "maand" || waarde === "week" || waarde === "dag" ? waarde : "werkweek";
}

/**
 * The query string that puts a view in the URL. Empty for the default, so a werkweek carries no parameter, like every
 * link into the agenda from elsewhere.
 */
export function weergaveZoek(weergave: Weergave): string {
  return weergave === "werkweek" ? "" : `?weergave=${weergave}`;
}
