/**
 * How an algemene fiche is told from an activiteit, in the agenda and in the side panel (FB-077).
 *
 * **Paper, not pigment** (owner, 2026-09-22). The six activiteitkleuren of `activiteiten/kleuren.ts` already lie on
 * this grid as pale washes, and a seventh wash would have to take the only free arc left on the wheel, some 38 degrees
 * from Indigo and from Pruim. Two pastels that close are not two colours a teacher tells apart at a glance, so a fiche
 * takes no hue at all: it takes the paper's own neutral, one plane deeper than anything else on the grid, with a firmer
 * edge. Thema content is what carries colour here; the fixtures of the week are paper.
 *
 * That also survives what a seventh hue would not: greyscale and a colour-blind reader.
 *
 * **A step deeper than `vlak-diep`, and its dark half written by hand.** `vlak-diep` was the first try and measured
 * 1.09:1 against the ground of an activiteit without a teacher colour: side by side you see it, scattered over a week
 * you do not, and "in één oogopslag" is the whole point of the ticket. These two values sit between `vlak-diep` and
 * `lijn-sterk` instead. They are literals rather than tokens, so, exactly as `activiteiten/kleuren.ts` warns, the guard
 * in `state/weergave.test.ts` cannot see them and the `dark:` half is not generated: it is written out below. Dark
 * keeps the order the surfaces have there (kaart > vlak > vlak-diep, see `index.css`), so the fiche is the deepest
 * plane in both palettes rather than the lightest in one of them.
 *
 * **Never colour alone** (Art. XII): everywhere this wash is worn, `IcoonFiche` stands beside the name, and in the
 * agenda the block also says "algemene fiche" under it wherever it has the room. On a block narrowed by a neighbour
 * the name is the first thing clipped, and the icon is what survives.
 */
export const FICHEVLAK =
  "border-[hsl(220_14%_76%)] bg-[hsl(220_16%_88%)] dark:border-[hsl(220_12%_24%)] dark:bg-[hsl(220_20%_5%)]";
