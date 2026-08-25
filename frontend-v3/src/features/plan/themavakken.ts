import { t } from "../../i18n";
import { valtBinnen } from "../../lib/datum";

/**
 * Which thema a themaperiode holds, as a stretch of days.
 *
 * **This exists because the agenda used to answer that question about ONE DAY and print the answer
 * over a whole month.** The period chip and the thema chip were both derived from `blok`, the
 * themaperiode containing the anchored day, while the grid renders every day of the month. Paging a
 * month keeps the day of the month, and this school year's periods end on the 1st (1 sep - 1 okt,
 * 2 okt - 1 nov, 9 nov - 20 dec), so a teacher who opened on 1 september and pressed the next arrow
 * twice stood on 1 november: the last day of a period that owns not one visible day. October showed
 * september's thema as a fact, and November showed no thema at all because that period holds none.
 *
 * A themaperiode is a property of days, so it is reported per day. Same conclusion the subthema
 * strips reached one level down, for the same reason: see `subthemareeksen`.
 *
 * **Unlike a subthema run, this is not measured, it is declared.** A subthema run is read off the
 * days its activiteiten landed on, because nothing in the model records it. A themaperiode is a row
 * in the rooster and a placement points at it by `blokStart`, so the range here is exact and a period
 * with nothing planned in it is still a period. That distinction is the whole reason this is a
 * separate module rather than a second call into the run finder.
 */
export interface Themavak {
  /** The period's own start, which is what a placement keys on. Identity, not display. */
  blokStart: string;
  van: string;
  tot: string;
  /**
   * Every thema placed in this period, id and name together.
   *
   * Empty is a real answer: the period is planned, nothing is in it. Both fields travel because both
   * are needed and deriving one from the other twice is how they drift: the bands print the name, and
   * the activiteit picker asks which thema's a given DAY may offer, which is an id question.
   */
  themas: readonly { id: string; naam: string }[];
}

interface Plaatsing {
  blokStart: string;
  themaId: string;
  themaNaam: string;
  status: string;
}

/**
 * One vak per themaperiode, carrying the thema's placed in it.
 *
 * `Geweigerd` placements are left out. A rejected thema is a thema the teacher said no to, and
 * naming it above the days it would have covered is the calendar arguing with a decision that has
 * already been made.
 */
export function themavakken(
  blokken: readonly { start: string; eind: string }[],
  plaatsingen: readonly Plaatsing[],
): Themavak[] {
  return blokken.map((blok) => {
    const inBlok = plaatsingen.filter(
      (plaatsing) => plaatsing.blokStart === blok.start && plaatsing.status !== "Geweigerd",
    );

    // Deduped on the id, not on the name: two placements of one thema in one period is one thema,
    // and two thema's that happen to share a name are two.
    const perId = new Map(inBlok.map((plaatsing) => [plaatsing.themaId, plaatsing.themaNaam]));

    return {
      blokStart: blok.start,
      van: blok.start,
      tot: blok.eind,
      themas: [...perId].map(([id, naam]) => ({ id, naam })),
    };
  });
}

/**
 * The vak a day sits in, or undefined between two periods.
 *
 * Between two periods is a legitimate place for a day to be: this school year has a gap from 2 to 8
 * november and the herfstvakantie sits in it. Such a day gets no band, which is the honest answer,
 * and the cell already says why it is empty.
 */
export function vakOpDag(vakken: readonly Themavak[], datum: string): Themavak | undefined {
  return vakken.find((vak) => valtBinnen(datum, vak.van, vak.tot));
}

/**
 * The thema clause a day's own button appends to its label.
 *
 * Same arrangement as `subthemaZin`: the strip is `aria-hidden` and the fact is announced once, by
 * the control a screen reader was going to land on anyway. It speaks the empty case too, because
 * "this period has no thema yet" is the state a teacher most needs to hear and the one a silent
 * label would hide.
 */
export function themaZin(vak: Themavak | undefined): string {
  if (!vak) return "";
  if (vak.themas.length === 0) return `, ${t("periode.dagGeenThema")}`;

  return `, ${
    vak.themas.length === 1
      ? t("periode.dagThema", { naam: vak.themas[0].naam })
      : t("periode.dagThemas", { namen: vak.themas.map((thema) => thema.naam).join(", ") })
  }`;
}

/**
 * Which thema's a given DAY may offer, as ids.
 *
 * The activiteit picker used to ask this of the anchored day's period while being opened for a
 * different day entirely, so pressing the plus on 12 november offered the thema's of the period that
 * ended on 1 november: none, and the picker said "in deze periode staat nog geen thema gepland" over
 * a day whose period held one. Same root cause as the bands, and the reason this lives here.
 */
export function themaIdsOpDag(vakken: readonly Themavak[], datum: string): string[] {
  return (vakOpDag(vakken, datum)?.themas ?? []).map((thema) => thema.id);
}
