/**
 * The drag ids the algemene fiches put into the agenda, and how to read them back.
 *
 * The agenda's drop handler is given ONE id and has to know what it was handed, so the prefixes are load-bearing rather
 * than cosmetic. A bare `plaatsingId` is an activiteit already on the grid; these two are the fiche's own kinds:
 *
 * - `algemenefiche:<ficheId>` is a fiche from the panel with no placement yet: ask her the days, weekdays and hours
 * - `fichemoment:<plaatsingId>:<momentId>` is one occurrence of a planned fiche: move that one hour
 *
 * The moment id carries its placement with it because the endpoint that moves it is addressed by both. Neither prefix
 * is a prefix of the activiteit card's (`activiteitkaart:`), so the order in which the handler tests them does not
 * matter.
 *
 * **Its own module, not a second export from a component.** A file that exports both a component and a constant breaks
 * React Fast Refresh for that whole file, so editing the panel would reload the page instead of the component.
 */
export const ALGEMENE_FICHE_VOORVOEGSEL = "algemenefiche:";

/** The fiche a drag id refers to, or null when the id is not an algemene fiche. */
export function leesAlgemeneFicheId(id: string): string | null {
  return id.startsWith(ALGEMENE_FICHE_VOORVOEGSEL) ? id.slice(ALGEMENE_FICHE_VOORVOEGSEL.length) : null;
}

const MOMENT_VOORVOEGSEL = "fichemoment:";

/** The id one occurrence of a planned fiche is dragged under. */
export const fichemomentSleepId = (plaatsingId: string, momentId: string) =>
  `${MOMENT_VOORVOEGSEL}${plaatsingId}:${momentId}`;

/** The placement and the occurrence a drag id refers to, or null when the id is not a fiche moment. */
export function leesFichemomentId(id: string): { plaatsingId: string; momentId: string } | null {
  if (!id.startsWith(MOMENT_VOORVOEGSEL)) return null;
  const rest = id.slice(MOMENT_VOORVOEGSEL.length);
  const streep = rest.indexOf(":");
  if (streep < 0) return null;
  return { plaatsingId: rest.slice(0, streep), momentId: rest.slice(streep + 1) };
}
