import type { Dagweergave, Subthemaperiode } from "../../lib/types";
import { t } from "../../i18n";
import { datumsTussen, valtBinnen, weekdagIndex } from "../../lib/datum";

/**
 * The stretch of days one subthema runs over, inside one themaperiode.
 *
 * `van`/`tot` are the FIRST and LAST day carrying an activiteit of the subthema, so the range is
 * measured rather than intended: nothing in the model records a subthemaperiode. The server's
 * `Subthemaperiode` tier is a grid of empty two-week slots derived from the school year; it says
 * when a slot is, never which subthema sits in it. What a teacher can see is where the activiteiten
 * landed, and that is what this reports.
 */
export interface Subthemareeks {
  subthemaId: string;
  subthemaNaam: string;
  van: string;
  tot: string;
  /** Days inside the range that actually carry an activiteit of this subthema. */
  aantalDagen: number;
}

/**
 * Every subthema run in `dagen`, split per themaperiode.
 *
 * **The split is on the periode boundary, not on a gap of N days.** A subthema planned in september
 * and again in march is two runs, and joining them would draw a band across half the school year.
 * The obvious alternative is to break a run wherever the gap gets "big enough", which needs a
 * threshold nobody can defend: two weeks of vakantie inside one themaperiode is not a new run, and
 * three teaching days across a periode boundary is. The periode is the unit the plan is built in, so
 * it is the unit a run belongs to.
 *
 * Days outside every periode (between two blocks, which is a legitimate place for an activiteit to
 * sit) group together as their own bucket rather than being dropped.
 *
 * Two activiteiten of one subthema on one day count as one day: `aantalDagen` answers "on how many
 * days does this run touch down", which is what makes a spread run distinguishable from a dense one.
 */
export function subthemareeksen(
  dagen: Dagweergave[],
  blokken: readonly { start: string; eind: string }[],
  /**
   * The windows the teacher marked off, from the server.
   *
   * **Folded in as a widening, never as a replacement.** A run keeps every day it derived from an activiteit and
   * gains the days of the window that covers it, so the two sources cannot contradict each other: an activiteit
   * dragged past the end of its window widens the band instead of sitting outside it, and shortening a window can
   * never hide an activiteit that is already planned. A window with no activiteiten under it yet becomes a run of its
   * own with `aantalDagen` 0, which is the case the whole feature exists for.
   */
  periodes: readonly Subthemaperiode[] = [],
): Subthemareeks[] {
  const reeksen = new Map<string, Subthemareeks>();

  // Sorted rather than trusted. `van`/`tot` are read off the traversal order, and the caller hands
  // over whatever the server sent for a range it clamped itself.
  const oplopend = [...dagen].sort((a, b) => a.datum.localeCompare(b.datum));

  for (const dag of oplopend) {
    if (dag.activiteiten.length === 0) continue;
    const blok = blokken.findIndex((b) => valtBinnen(dag.datum, b.start, b.eind));
    const gezien = new Set<string>();

    for (const activiteit of dag.activiteiten) {
      if (gezien.has(activiteit.subthemaId)) continue;
      gezien.add(activiteit.subthemaId);

      const sleutel = `${blok}|${activiteit.subthemaId}`;
      const lopend = reeksen.get(sleutel);
      if (lopend) {
        lopend.tot = dag.datum;
        lopend.aantalDagen += 1;
      } else {
        reeksen.set(sleutel, {
          subthemaId: activiteit.subthemaId,
          subthemaNaam: activiteit.subthemaNaam,
          van: dag.datum,
          tot: dag.datum,
          aantalDagen: 1,
        });
      }
    }
  }

  for (const periode of periodes) {
    const blok = blokken.findIndex((b) => valtBinnen(periode.van, b.start, b.eind));
    const sleutel = `${blok}|${periode.subthemaId}`;
    const lopend = reeksen.get(sleutel);

    if (lopend) {
      if (periode.van < lopend.van) lopend.van = periode.van;
      if (periode.tot > lopend.tot) lopend.tot = periode.tot;
    } else {
      reeksen.set(sleutel, {
        subthemaId: periode.subthemaId,
        subthemaNaam: periode.subthemaNaam,
        van: periode.van,
        tot: periode.tot,
        // Nothing has touched down in it yet. That is a window waiting for its activiteiten, not an error, and it is
        // why `aantalDagen` is a separate figure from the length of the range.
        aantalDagen: 0,
      });
    }
  }

  // By start, then by name: two runs beginning on the same day would otherwise stack in the order
  // the server happened to list their activiteiten, and swap places on the next fetch.
  return [...reeksen.values()].sort(
    (a, b) => a.van.localeCompare(b.van) || a.subthemaNaam.localeCompare(b.subthemaNaam),
  );
}

/** Every day each run covers, so a calendar cell can ask what is running on it. */
export function reeksenPerDag(reeksen: readonly Subthemareeks[]): Map<string, Subthemareeks[]> {
  const perDag = new Map<string, Subthemareeks[]>();

  for (const reeks of reeksen) {
    for (const datum of datumsTussen(reeks.van, reeks.tot)) {
      const lopend = perDag.get(datum);
      if (lopend) lopend.push(reeks);
      else perDag.set(datum, [reeks]);
    }
  }

  return perDag;
}

/**
 * The subthema clause a day's own button appends to its label.
 *
 * This is what lets the strips be `aria-hidden`: the fact is still announced, once, by the control a
 * screen reader was going to land on anyway. It names EVERY run on the day, including the ones the
 * cell folded into a count, because a count is a space problem and a spoken label has no width.
 */
export function subthemaZin(reeksen: readonly Subthemareeks[]): string {
  if (reeksen.length === 0) return "";
  const namen = reeksen.map((reeks) => reeks.subthemaNaam);

  return `, ${
    namen.length === 1
      ? t("periode.dagSubthema", { naam: namen[0] })
      : t("periode.dagSubthemas", { namen: namen.join(", ") })
  }`;
}

/**
 * Whether this day is where the name gets printed.
 *
 * On the start of every week, and on a day where a run begins. Both views need the same answer and
 * for the same reason: a label repeated on all seven days of a week is the per-cell version of the
 * prose this app cuts first, and the week view proved it by saying one subthema fifteen times on one
 * screen. Monday is the start of a group whichever way the days are laid out, so the rule survives
 * the week view collapsing from seven columns to a stack on a phone, where the label lands at the top
 * of the scroll instead of at the left of the row.
 *
 * **The answer is per DAY, not per run.** A day where one run begins names the others running on it
 * too, and that is the intent rather than a rounding: the day one subthema hands over to the next is
 * exactly the day a teacher needs to read both names, and a bare band beside a labelled one there
 * would leave the outgoing one anonymous.
 */
export function naamOpDezeDag(datum: string, reeksen: readonly Subthemareeks[]): boolean {
  return weekdagIndex(datum) === 0 || reeksen.some((reeks) => reeks.van === datum);
}

/**
 * The subthema a new activiteit on this day most likely belongs to.
 *
 * A default, never a decision: the sheet that uses this shows the choice beside it. What makes a
 * default worth computing is that the alternative is "the first one in the list", which on a Tuesday
 * in the middle of a week offered a thema the teacher had not touched in that period at all.
 *
 * The run COVERING the day if there is one, otherwise the last one that has already finished. Both
 * inside the themaperiode the day falls in, because that is the unit a plan is built in: a subthema
 * from the period before is not what a teacher continuing this week means, and suggesting it would be
 * worse than suggesting nothing.
 *
 * Between two periodes there is no answer and it says so. The screen that asks cannot place an
 * activiteit there either, since no thema is running to own one.
 */
export function voorstelReeks(
  reeksen: readonly Subthemareeks[],
  datum: string,
  blokken: readonly { start: string; eind: string }[],
): Subthemareeks | undefined {
  const blok = blokken.find((b) => valtBinnen(datum, b.start, b.eind));
  if (!blok) return undefined;

  const binnen = reeksen.filter((reeks) => valtBinnen(reeks.van, blok.start, blok.eind));

  // `subthemareeksen` returns them by start, so the last one that has finished is the nearest one
  // behind this day.
  return binnen.find((reeks) => valtBinnen(datum, reeks.van, reeks.tot)) ?? binnen.filter((reeks) => reeks.tot < datum).at(-1);
}
