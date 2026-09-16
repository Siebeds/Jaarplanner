import type { Dagweergave, Subthemaperiode } from "../../lib/types";
import { t } from "../../i18n";
import { datumsTussen, maandagVan, valtBinnen, verschuif, weekdagIndex } from "../../lib/datum";

/**
 * The stretch of days one subthema runs over, inside one thema placement.
 *
 * `van`/`tot` are the FIRST and LAST day carrying an activiteit of the subthema, widened by the window the teacher
 * marked off for it, when there is one. What a teacher can see is where the activiteiten landed, and that is what
 * this reports.
 */
export interface Subthemareeks {
  subthemaId: string;
  subthemaNaam: string;
  /** The thema the subthema belongs to: its page is where the subthema's own chapter lives (FB-037). */
  themaId: string;
  themaNaam: string;
  van: string;
  tot: string;
  /** Days inside the range that actually carry an activiteit of this subthema. */
  aantalDagen: number;
  /**
   * The stored window folded into this run, the first one the server listed (it lists them by start), or absent when
   * the run is drawn from its activiteiten alone. A hoekverrijking is written against it (FB-020); where it is absent,
   * saving one stores the window first.
   */
  periodeId?: string;
}

/**
 * Every subthema run in `dagen`, split per thema placement (`blokken`, ADR-0053).
 *
 * **The split is on the placement boundary, not on a gap of N days.** A subthema planned in september
 * and again in march is two runs, and joining them would draw a band across half the school year.
 * The obvious alternative is to break a run wherever the gap gets "big enough", which needs a
 * threshold nobody can defend. The thema placement is the unit the plan is built in, so it is the unit a
 * run belongs to; a thema split around a vacation is two placements, and a run splits with it.
 *
 * Days outside every placement (a day without a thema, which is a legitimate place for an activiteit to
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
          themaId: activiteit.themaId,
          themaNaam: activiteit.themaNaam,
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
      lopend.periodeId ??= periode.id;
    } else {
      reeksen.set(sleutel, {
        subthemaId: periode.subthemaId,
        subthemaNaam: periode.subthemaNaam,
        themaId: periode.themaId,
        themaNaam: periode.themaNaam,
        van: periode.van,
        tot: periode.tot,
        // Nothing has touched down in it yet. That is a window waiting for its activiteiten, not an error, and it is
        // why `aantalDagen` is a separate figure from the length of the range.
        aantalDagen: 0,
        periodeId: periode.id,
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
 * The range the subthema runs are read over: the days on screen and the whole week of the anchored day, widened to
 * every thema placement they touch.
 *
 * **Whole placements**, because a run is measured over its placement: measured over the visible month, a run that began in
 * the last week of september would be reported as starting on 1 october (see `subthemareeksen`).
 *
 * **And the whole week of the anchored day** (FB-017), because the activiteiten list speaks about that week. A day
 * view, or a phone's three days, loads less than a week, and a day outside every placement loads only itself, so a run
 * later that week would go unread and the list would say that nothing runs (antagonist FB-017, round 2).
 */
export function reeksbereik(
  van: string,
  tot: string,
  anker: string,
  blokken: readonly { start: string; eind: string }[],
): [string, string] {
  if (van.length === 0) return ["", ""];
  const maandag = maandagVan(anker);
  const zondag = verschuif(maandag, 6);
  const begin = van < maandag ? van : maandag;
  const einde = tot > zondag ? tot : zondag;
  const raken = blokken.filter((blok) => blok.start <= einde && blok.eind >= begin);
  return [
    [begin, ...raken.map((blok) => blok.start)].reduce((a, b) => (a < b ? a : b)),
    [einde, ...raken.map((blok) => blok.eind)].reduce((a, b) => (a > b ? a : b)),
  ];
}

/**
 * The subthema's whose runs touch the week that starts on `maandag`, once each, in the order they start (FB-017).
 *
 * What the agenda's activiteiten list opens on. From the runs the calendar draws, so the list cannot open on a
 * subthema the strips beside it do not show, and a run that started the Friday before still counts: it is running.
 */
export function subthemasInWeek(reeksen: readonly Subthemareeks[], maandag: string): string[] {
  const zondag = verschuif(maandag, 6);
  const ids = reeksen.filter((reeks) => reeks.van <= zondag && reeks.tot >= maandag).map((reeks) => reeks.subthemaId);
  return [...new Set(ids)];
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
 * inside the thema placement the day falls in, because that is the unit a plan is built in: a subthema
 * from the thema before is not what a teacher continuing this week means, and suggesting it would be
 * worse than suggesting nothing.
 *
 * On a day without a thema there is no answer and it says so. The screen that asks cannot place an
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
