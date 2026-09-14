/**
 * The drag ids the algemene fiches put into the agenda, and how to read them back.
 *
 * The agenda's drop handler is given ONE id and has to know what it was handed; `hoeken/sleepids.ts` explains why the
 * prefixes are load-bearing. These two add the fiche's own kinds beside the hoek's:
 *
 * - `algemenefiche:<ficheId>` is a fiche from the panel with no placement yet: ask her the days, weekdays and hours
 * - `fichemoment:<plaatsingId>:<momentId>` is one occurrence of a planned fiche: move that one hour
 *
 * Neither prefix is a prefix of a hoek's (`hoekfiche:`, `hoekmoment:`), so the order in which the handler tests them
 * does not matter.
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
