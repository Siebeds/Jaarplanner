/**
 * How an algemene fiche is told from an activiteit, in the agenda and in the side panel (FB-077).
 *
 * **Paper, not pigment** (owner, 2026-09-22). The six activiteitkleuren of `activiteiten/kleuren.ts` already lie on
 * this grid as pale washes, and a seventh wash would have to take the only free arc left on the wheel, some 38 degrees
 * from Indigo and from Pruim. Two pastels that close are not two colours a teacher tells apart at a glance, so a fiche
 * takes no hue at all: it takes the paper's own neutral, one plane deeper than anything else on the grid, with a firmer
 * edge. Thema content is what carries colour here; the fixtures of the week are paper.
 *
 * That also survives what a seventh hue would not: greyscale, a colour-blind reader, and the dark palette, where the
 * surfaces keep their lightness ORDER (kaart > vlak > vlak-diep, see `index.css`), so the fiche is the deepest plane
 * in both palettes rather than the lightest in one of them.
 *
 * **Never colour alone** (Art. XII): everywhere this wash is worn, `IcoonFiche` stands beside the name, and in the
 * agenda the block also says "algemene fiche" under it wherever it has the room.
 */
export const FICHEVLAK = "border-lijn-sterk bg-vlak-diep";
