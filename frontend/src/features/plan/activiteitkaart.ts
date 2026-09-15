/**
 * The drag id an activiteit card in the side panel carries, and how to read it back (FB-017).
 *
 * `hoeken/sleepids.ts` explains why the agenda's drop handler needs a prefix: it is handed ONE id and has to know what
 * it was handed. A planned activiteit is dragged under its bare `plaatsingId`, so a card that has no placement yet needs
 * a prefix of its own. Not a prefix of any other kind's (`hoekfiche:`, `hoekmoment:`, `algemenefiche:`,
 * `fichemoment:`), so the order in which the handler tests them does not matter.
 */
export const ACTIVITEIT_VOORVOEGSEL = "activiteitkaart:";

/** The activiteit a drag id refers to, or null when the id is not an activiteit card. */
export function leesActiviteitkaartId(id: string): string | null {
  return id.startsWith(ACTIVITEIT_VOORVOEGSEL) ? id.slice(ACTIVITEIT_VOORVOEGSEL.length) : null;
}

/**
 * What a card hands the agenda with its drag, through dnd-kit's `data`.
 *
 * The agenda does not load the panel's list, so it cannot look the name or the length up the way it does for a block
 * already in the grid. The card knows both, and a drop needs both: the name for the overlay and the announcement, the
 * length to give the new block an end.
 */
export interface Activiteitkaartdata {
  naam: string;
  /** The activiteit's default length, in minutes. */
  duur: number;
}

/**
 * What a dropped card plans without asking, or null when the drop named no hour (FB-017).
 *
 * A drop on an hour of the time grid is the whole answer: that hour, with the activiteit's own length. A month cell
 * and a keyboard drop name only a day, and the agenda then opens the sheet on it rather than inventing an hour.
 */
export function kaartLanding(kaart: Activiteitkaartdata, doelBegin: number | null): { begin: number; einde: number } | null {
  return doelBegin === null ? null : { begin: doelBegin, einde: doelBegin + kaart.duur };
}
