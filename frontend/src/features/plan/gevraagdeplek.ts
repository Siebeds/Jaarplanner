/** Where a new placement was asked for: the day, its first minute and, when a stretch was dragged out, its last. */
export type Gevraagdeplek = { datum: string; begin: number; einde?: number };

/**
 * The minute a placement asked for at `plek` ends at, given how long the chosen activiteit runs by default.
 *
 * A stretch the teacher dragged out in the time grid is what she asked for, so it wins (TB-014). Otherwise the
 * activiteit's own default length decides, and she drags the edge from there: a fixed length here would make every
 * activiteit the same one, which is what the length on the activiteit exists to avoid.
 */
export const eindeVan = (plek: Gevraagdeplek, duurInMinuten: number) => plek.einde ?? plek.begin + duurInMinuten;
