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
 * **Tokens rather than literals, unlike the six in `activiteiten/kleuren.ts`.** Those are literals on purpose,
 * because they mean whatever the teacher decided and nothing the application reads. This ground means *algemene
 * fiche*, which is the application's own vocabulary, so it belongs beside the other semantic colours in `index.css`,
 * where the guard in `state/weergave.test.ts` sees that it has a dark value. That file also holds why it sits a step
 * below `vlak-diep`, which as the fiche's ground measured only 1.09:1 against a colourless activiteit.
 *
 * **Never colour alone** (Art. XII): everywhere this wash is worn, `IcoonFiche` stands beside the name, and in the
 * agenda the block also says "algemene fiche" under it wherever it has the room. On a block narrowed by a neighbour
 * the name is the first thing clipped, and the icon is what survives (TB-060).
 */
export const FICHEVLAK = "border-fiche-lijn bg-fiche-vlak";

/**
 * The same paper for a fiche that recurs, half as deep and without its edge (FB-091).
 *
 * A daily onthaal drew five identical heavy blocks in the week, and the routine a teacher already knows by heart was
 * the loudest thing on the grid. A recurring fiche stands back: a wash half-way between the fiche's ground and the
 * card, no drawn border, and a name that is not set in weight. What it is stays said by `IcoonFiche`, the arrows that
 * mean "this comes back", and by the "algemene fiche" line wherever the block has the room. A fiche planned once keeps
 * `FICHEVLAK`. Both grounds mix tokens, so the dark theme follows without a value of its own.
 */
export const FICHEVLAK_STIL =
  "border-transparent bg-[color-mix(in_srgb,var(--color-fiche-vlak)_50%,var(--color-kaart))]";
