import { t } from "../../i18n";
import { valtBinnen } from "../../lib/datum";

/**
 * Which thema runs on which days, as stretches of days (ADR-0053).
 *
 * **A day is looked up on its own**, never inferred from the anchored day: the month grid shows a whole month, and a
 * thema that ends mid-month must not be printed over the days after it. Same conclusion the subthema strips reached
 * one level down, for the same reason: see `subthemareeksen`.
 *
 * **A placement is declared, not measured.** A subthema run is read off the days its activiteiten landed on; a thema
 * placement carries its own first and last day, so the range here is exact, and no two placements share a day, so a
 * day has at most one thema.
 */
export interface Themavak {
  /** The placement this stretch is. Identity, not display. */
  plaatsingId: string;
  van: string;
  tot: string;
  /**
   * The thema running on these days, id and name together, as a list: the bands print the name, and the activiteit
   * picker asks which thema's a given DAY may offer, which is an id question.
   */
  themas: readonly { id: string; naam: string; icoon?: string | null }[];
}

/** A thema placement as a stretch of days, in the shape the run finders (`subthemareeksen`) take. */
export interface Themablok {
  plaatsingId: string;
  themaId: string;
  themaNaam: string;
  themaIcoon: string | null;
  start: string;
  eind: string;
}

interface Plaatsing {
  id: string;
  van: string;
  tot: string;
  themaId: string;
  themaNaam: string;
  themaIcoon?: string | null;
  status: string;
}

/**
 * Every placement as a stretch of days, chronological.
 *
 * `Geweigerd` placements are left out. A rejected thema is a thema the teacher said no to, and naming it above the
 * days it would have covered is the calendar arguing with a decision that has already been made.
 */
export function themablokken(plaatsingen: readonly Plaatsing[]): Themablok[] {
  return plaatsingen
    .filter((plaatsing) => plaatsing.status !== "Geweigerd")
    .map((plaatsing) => ({
      plaatsingId: plaatsing.id,
      themaId: plaatsing.themaId,
      themaNaam: plaatsing.themaNaam,
      themaIcoon: plaatsing.themaIcoon ?? null,
      start: plaatsing.van,
      eind: plaatsing.tot,
    }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/** One vak per placement, carrying its thema. */
export function themavakken(plaatsingen: readonly Plaatsing[]): Themavak[] {
  return themablokken(plaatsingen).map((blok) => ({
    plaatsingId: blok.plaatsingId,
    van: blok.start,
    tot: blok.eind,
    themas: [{ id: blok.themaId, naam: blok.themaNaam, icoon: blok.themaIcoon }],
  }));
}

/**
 * The vak a day sits in, or undefined when no thema runs that day.
 *
 * A day without a thema is a legitimate place for a day to be: a vacation, or a week the teacher left open. Such a day
 * gets no band, which is the honest answer, and the cell already says why it is empty.
 */
export function vakOpDag(vakken: readonly Themavak[], datum: string): Themavak | undefined {
  return vakken.find((vak) => valtBinnen(datum, vak.van, vak.tot));
}

/**
 * The thema clause a day's own button appends to its label.
 *
 * Same arrangement as `subthemaZin`: the strip is `aria-hidden` and the fact is announced once, by the control a
 * screen reader was going to land on anyway.
 */
export function themaZin(vak: Themavak | undefined): string {
  return vak ? `, ${themaClausule(vak)}` : "";
}

/**
 * A vak's thema's as a spoken clause, every name in full: "thema Herfst". Shared by the grid's day buttons and the
 * agenda caption, so a screen reader hears one sentence for one fact wherever it lands.
 */
export function themaClausule(vak: Themavak): string {
  if (vak.themas.length === 0) return t("periode.dagGeenThema");

  return vak.themas.length === 1
    ? t("periode.dagThema", { naam: vak.themas[0].naam })
    : t("periode.dagThemas", { namen: vak.themas.map((thema) => thema.naam).join(", ") });
}

/**
 * A vak's thema's as a label on screen, where room is short: the first name and a count of the rest. Shared by the
 * band and the agenda caption, so the two cannot name one stretch differently.
 */
export function themaLabel(vak: Themavak): string {
  if (vak.themas.length === 0) return t("periode.geenThema");

  return vak.themas.length === 1
    ? vak.themas[0].naam
    : t("periode.themaMeer", { naam: vak.themas[0].naam, aantal: vak.themas.length - 1 });
}

/**
 * Which thema's a given DAY may offer, as ids: the thema running that day, looked up for that day rather than for the
 * anchored one.
 */
export function themaIdsOpDag(vakken: readonly Themavak[], datum: string): string[] {
  return (vakOpDag(vakken, datum)?.themas ?? []).map((thema) => thema.id);
}
