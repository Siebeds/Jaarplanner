/**
 * What marks a drag id as coming from the hoekenpaneel.
 *
 * The agenda's drop handler is given one id and has to know what it was handed: an activiteit already
 * on the grid arrives as a bare plaatsingId, a corner arrives from the panel with no placement at all.
 * The two mean opposite things (move this / start a new one), so the prefix is load-bearing rather
 * than cosmetic.
 *
 * **Its own module, not a second export from `Hoekenpaneel`.** A file that exports both a component
 * and a constant breaks React Fast Refresh for that whole file, so editing the panel would reload the
 * page instead of the component. Two lines in a module of their own cost nothing.
 */
export const FICHE_VOORVOEGSEL = "hoekfiche:";

/** The hoek a drag id refers to, or null when the id is not a fiche at all. */
export function leesFicheId(id: string): string | null {
  return id.startsWith(FICHE_VOORVOEGSEL) ? id.slice(FICHE_VOORVOEGSEL.length) : null;
}
