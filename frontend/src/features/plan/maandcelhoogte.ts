import type { Agendadag } from "./roosterdagen";
import type { Subthemareeks } from "./subthemareeksen";
import type { Themavak } from "./themavakken";

/**
 * How many band slots a cell draws from `sm` up: the thema band, and at most two subthema slots (one run and the
 * count, once there are three). Mirrors `Themastroken` and `Subthemastroken`, and the cell's own guard outside the
 * school year.
 */
export function aantalBanden(dag: Agendadag, vak: Themavak | undefined, reeksen: readonly Subthemareeks[]): number {
  if (dag.buitenSchooljaar) return 0;
  return (vak ? 1 : 0) + Math.min(reeksen.length, 2);
}

/**
 * THE CELL'S HEIGHT FROM `sm` UP, BY THE MOST BANDS IN ITS ROW (FB-039, ADR-0045).
 *
 * A band slot is 24 pixels, the WCAG 2.2 target size; it used to be a 16 pixel band with a 1 pixel gap. The cell grows
 * by exactly that difference, 7 pixels a slot plus the gap that is gone, so the activiteit chips keep the room they
 * had at 112 pixels. Written out rather than computed, so Tailwind sees every class.
 */
export const CELHOOGTE = ["sm:h-28", "sm:h-[120px]", "sm:h-[127px]", "sm:h-[134px]"] as const;
