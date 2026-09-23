import type { Subthemareeks } from "./subthemareeksen";
import { vakOpDag, type Themavak } from "./themavakken";

/**
 * One continuous bar across the columns of the week grid (FB-090): a thema, or a subthema, over the teaching days it
 * covers side by side on screen.
 *
 * **One bar per unbroken stretch of columns, not one per day.** Drawn per day, a thema that ran all week was five grey
 * pieces with its name on the first and blank bars after it, which the owner read as blocks still loading. A bar
 * breaks only where the thing itself begins or ends, and on a column that draws no bars at all (a closed day, the
 * weekend, a day outside the school year), so a Friday is never joined to the Monday after it.
 */
export interface Weekbalk<T> {
  item: T;
  /** The first and last column it covers, as indexes into the days on screen, inclusive. */
  van: number;
  tot: number;
  /** It begins on its first column: the accent tick. */
  begint: boolean;
  /** It ran before its first column or goes on after its last one: the small arrow on that side. */
  doorVoor: boolean;
  doorNa: boolean;
}

interface Kolom {
  datum: string;
  isLesdag: boolean;
  buitenSchooljaar: boolean;
}

/** Only a teaching day inside the school year draws bars, as the per-day strips did. */
const draagtBalken = (dag: Kolom) => dag.isLesdag && !dag.buitenSchooljaar;

/** The thema bars: one per placement per unbroken stretch of teaching days. At most one runs on a day (ADR-0053). */
export function themabalken(dagen: readonly Kolom[], vakken: readonly Themavak[]): Weekbalk<Themavak>[] {
  const balken: Weekbalk<Themavak>[] = [];
  let lopend: Weekbalk<Themavak> | undefined;

  dagen.forEach((dag, i) => {
    const vak = draagtBalken(dag) ? vakOpDag(vakken, dag.datum) : undefined;
    if (vak && lopend && lopend.item.plaatsingId === vak.plaatsingId && lopend.tot === i - 1) {
      lopend.tot = i;
      lopend.doorNa = vak.tot > dag.datum;
      return;
    }
    lopend = vak
      ? { item: vak, van: i, tot: i, begint: vak.van === dag.datum, doorVoor: vak.van < dag.datum, doorNa: vak.tot > dag.datum }
      : undefined;
    if (lopend) balken.push(lopend);
  });

  return balken;
}

/** How many subthema rows the band keeps. A third run on one day is counted, not drawn: see `subthemabalken`. */
export const SUBTHEMARIJEN = 2;

export interface Subthemabalken {
  /** Per row, top to bottom, the bars in it. */
  rijen: Weekbalk<Subthemareeks>[][];
  /** Per column, how many runs on that day found no row: the day heading names them all regardless. */
  teveel: number[];
}

/**
 * The subthema bars, laid out in rows so two runs on one day sit one above the other.
 *
 * **A bar keeps its row for its whole stretch**, which is what makes it one bar: each goes in the first row that is
 * free over all of its columns, taken in order of start. A run that finds no free row among the `SUBTHEMARIJEN` is
 * counted per day instead of drawn, as the per-day strips folded a third run into "+1": a header that spends its height
 * on strips has stopped being a heading.
 */
export function subthemabalken(
  dagen: readonly Kolom[],
  perDag: ReadonlyMap<string, readonly Subthemareeks[]>,
): Subthemabalken {
  const balken: Weekbalk<Subthemareeks>[] = [];
  const open = new Map<Subthemareeks, Weekbalk<Subthemareeks>>();

  dagen.forEach((dag, i) => {
    const reeksen = draagtBalken(dag) ? (perDag.get(dag.datum) ?? []) : [];
    for (const reeks of reeksen) {
      const lopend = open.get(reeks);
      if (lopend && lopend.tot === i - 1) {
        lopend.tot = i;
        lopend.doorNa = reeks.tot > dag.datum;
        continue;
      }
      const balk = { item: reeks, van: i, tot: i, begint: reeks.van === dag.datum, doorVoor: reeks.van < dag.datum, doorNa: reeks.tot > dag.datum };
      open.set(reeks, balk);
      balken.push(balk);
    }
  });

  // By first column, then as `subthemareeksen` orders them (by start, then name), so the rows do not swap on a refetch.
  balken.sort((a, b) => a.van - b.van || a.item.van.localeCompare(b.item.van) || a.item.subthemaNaam.localeCompare(b.item.subthemaNaam));

  const rijen: Weekbalk<Subthemareeks>[][] = Array.from({ length: SUBTHEMARIJEN }, () => []);
  const teveel = dagen.map(() => 0);
  for (const balk of balken) {
    const rij = rijen.find((bezet) => bezet.every((ander) => ander.tot < balk.van || ander.van > balk.tot));
    if (rij) rij.push(balk);
    else for (let i = balk.van; i <= balk.tot; i++) teveel[i] += 1;
  }

  return { rijen: rijen.filter((rij) => rij.length > 0), teveel };
}
