/**
 * The drag ids the hoeken feature puts into the agenda, and how to read them back.
 *
 * The agenda's drop handler is given ONE id and has to know what it was handed. Three things can be
 * dragged onto it and they mean three different things:
 *
 * - a bare `plaatsingId` is an activiteit already on the grid: move it
 * - `hoekfiche:<hoekId>` is a corner from the panel with no placement at all: ask her over which days
 * - `hoekmoment:<plaatsingId>:<momentId>` is one appearance of a placed corner: move that one hour
 *
 * The prefixes are therefore load-bearing rather than cosmetic, and the moment id carries its
 * placement with it because the endpoint that moves it is addressed by both.
 *
 * **Its own module, not a second export from a component.** A file that exports both a component and
 * a constant breaks React Fast Refresh for that whole file, so editing the panel would reload the page
 * instead of the component.
 *
 * *This file was `fiche.ts` until 2026-08-31, when the second prefix arrived and the name stopped
 * describing it.*
 */
export const FICHE_VOORVOEGSEL = "hoekfiche:";

/** The hoek a drag id refers to, or null when the id is not a fiche at all. */
export function leesFicheId(id: string): string | null {
  return id.startsWith(FICHE_VOORVOEGSEL) ? id.slice(FICHE_VOORVOEGSEL.length) : null;
}

const MOMENT_VOORVOEGSEL = "hoekmoment:";

/** The id one appearance of a placed hoek is dragged under. */
export const momentSleepId = (plaatsingId: string, momentId: string) =>
  `${MOMENT_VOORVOEGSEL}${plaatsingId}:${momentId}`;

/**
 * The placement and the appearance a drag id refers to, or null when the id is not a moment.
 *
 * Split on the FIRST colon after the prefix rather than on every colon, so a guid that ever grows a
 * colon does not silently produce a third field nobody reads.
 */
export function leesMomentId(id: string): { plaatsingId: string; momentId: string } | null {
  if (!id.startsWith(MOMENT_VOORVOEGSEL)) return null;
  const rest = id.slice(MOMENT_VOORVOEGSEL.length);
  const streep = rest.indexOf(":");
  if (streep < 0) return null;
  return { plaatsingId: rest.slice(0, streep), momentId: rest.slice(streep + 1) };
}
