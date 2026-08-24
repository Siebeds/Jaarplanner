/**
 * The lesuren a school day is divided into.
 *
 * **A slot, not a clock time, and the placement already knew that.** `Activiteitplaatsing.Volgorde`
 * has always been an ordinal within a day; this file only gives that ordinal a number a teacher
 * recognises. Nothing about an activiteit stores a time, which is why moving one to another hour is a
 * single number and not date arithmetic.
 *
 * **No clock times, on the owner's instruction (2026-08-24).** They were shown beside each row and
 * they were a guess: nothing in the model stores when a school's third lesuur starts, so the times
 * were a default dressed up as a fact. The numbering is what a teacher plans in, so the numbering is
 * all that is drawn.
 *
 * **`Volgorde` is 0-based and a teacher counts from one.** Slot 0 is "lesuur 1". Every placement made
 * before the grid existed was written with the default 0, so it shows up in the first lesuur rather
 * than nowhere.
 */
export interface Lesuur {
  /** The value that goes into `volgorde`. */
  slot: number;
  /** What a teacher calls it: 1..7. */
  nummer: number;
  /** True for the first slot after the noon break, so the grid can draw that break once. */
  naMiddag: boolean;
}

/**
 * Seven lesuren, four before the break and three after.
 *
 * A count rather than a setting, for now. When a school's own division becomes configurable it plugs
 * in here and nothing else changes; until then there is deliberately no control that pretends to
 * save it.
 */
export const LESUREN: Lesuur[] = [
  { slot: 0, nummer: 1, naMiddag: false },
  { slot: 1, nummer: 2, naMiddag: false },
  { slot: 2, nummer: 3, naMiddag: false },
  { slot: 3, nummer: 4, naMiddag: false },
  { slot: 4, nummer: 5, naMiddag: true },
  { slot: 5, nummer: 6, naMiddag: false },
  { slot: 6, nummer: 7, naMiddag: false },
];

/** The highest slot the grid draws. A placement beyond it still exists and is shown separately. */
export const LAATSTE_SLOT = LESUREN[LESUREN.length - 1].slot;

/** The longest span the length picker offers. Beyond this a teacher is describing a day, not an hour. */
export const MAX_LENGTE = 4;

/**
 * The id a lesuur drop target answers to: the day and the slot, joined.
 *
 * A composite id rather than two droppables, because dnd-kit hands back one identifier and the drop
 * has to know both halves. The month and week views keep using a bare date, so the agenda's drop
 * handler tells them apart by asking whether the id parses as a slot at all.
 */
export const slotId = (datum: string, slot: number) => `${datum}#${slot}`;

/** Splits a drop id back into its day and its lesuur. Null for a bare date, which is not an error. */
export function leesSlotId(id: string): { datum: string; slot: number } | null {
  const streep = id.indexOf("#");
  if (streep < 0) return null;
  const slot = Number.parseInt(id.slice(streep + 1), 10);
  return Number.isFinite(slot) ? { datum: id.slice(0, streep), slot } : null;
}
