import { apiFetch } from "../../lib/api";
import { bepaalPercentage } from "./dekkingFormat";
import type { Dekkingsbereik } from "./types";

/**
 * The coverage progress bar's data and arithmetic (E9-06, FR-9.1) — the figures a teacher watches while they link
 * doelen to thema's, on the themabeheer screens and in the jaarplanner.
 *
 * **String-free**: nothing here formats anything a teacher reads, so the whole file is testable without `nl.json`.
 *
 * **It reads `…/dekking/voortgang`, never `…/dekking`.** The full coverage payload is the entire in-scope curriculum,
 * unpaged — thousands of rows to move a bar by one, refetched every time a teacher links a doel. This endpoint answers a
 * handful of integers from the same computation.
 */

/** The wire shape of `GET /api/klassen/{klasId}/dekking/voortgang` — the backend `Dekkingsvooruitzicht`. */
export interface Dekkingsvoortgang {
  /** The scope that was **applied**, which is not always the one that was asked for. */
  bereik: Dekkingsbereik;
  gemetenJaarFasen: string[];
  /** The class's own set could not be derived (the unresolved graadklas case), so the scope was widened. */
  isTerugvalNaarHeelCurriculum: boolean;
  aantalBuitenBereik: number;
  /** False while a stale placement is unresolved, in which case **both** figures below are null. */
  isBetrouwbaar: boolean;
  aantalOnopgelosteVervallenPlaatsingen: number;
  /** Covered today, by what the teacher already accepted or placed; null while the figure is withheld. */
  aantalGedekt: number | null;
  /** Covered if every standing proposal were accepted; null while the figure is withheld. */
  aantalMogelijkGedekt: number | null;
  /** The denominator. Can legitimately be 0, which means "we cannot measure this class yet", never "all covered". */
  aantalLeerplandoelen: number;
  /** In scope and carried by no placed thema: the gap accepting cannot close. Null while the figures are withheld. */
  aantalOnbereikbaar: number | null;
}

export function haalDekkingsvoortgang(
  klasId: string,
  bereik?: Dekkingsbereik,
  jaarFase?: string,
): Promise<Dekkingsvoortgang> {
  const query = new URLSearchParams();
  if (bereik) {
    query.set("bereik", bereik);
  }
  if (jaarFase) {
    query.set("jaarFase", jaarFase);
  }

  const suffix = query.size > 0 ? `?${query}` : "";

  return apiFetch<Dekkingsvoortgang>(`/api/klassen/${klasId}/dekking/voortgang${suffix}`);
}

/**
 * What the bar may draw.
 *
 * **Mirrors `Dekkingscijfer`'s states deliberately, minus `geenVanDezeSoort`**, which belongs to E5-03's doelsoort
 * filter and has no meaning here: this endpoint takes no filter, so "in scope but none of this kind" cannot arise.
 */
export type Voortgangsbalk =
  | {
      soort: "balk";
      /** Covered today. The solid segment, and the only one a screen may call *gedekt*. */
      gedekt: number;
      /**
       * Covered **as well** if every standing proposal were accepted — the increment, not the ceiling.
       *
       * Reported as the difference rather than as the total, because that is what the second segment is: a bar drawing
       * `aantalMogelijkGedekt` from zero would paint over the covered part and show one number where there are two.
       */
      teAanvaarden: number;
      totaal: number;
      /** Whole-number percentage of {@link gedekt} alone, through the same clamped function the overview uses. */
      percentageGedekt: number;
      /** Whole-number percentage of the ceiling. Always >= {@link percentageGedekt}. */
      percentageMogelijk: number;
    }
  | { soort: "nietMeetbaar"; aantalBuitenBereik: number }
  | { soort: "ingehouden"; aantalOnopgeloste: number };

/**
 * Turns the payload into what the bar draws, applying **the same gates in the same order** as
 * `bepaalCijfer` (E5-03), which is the one place the dekkingsoverzicht's figure may be produced.
 *
 * **Why this is a sibling rather than a call to `bepaalCijfer`.** That function counts rows, because E5-03's doelsoort
 * filter narrows the measured set client-side and the count has to follow it. This endpoint ships no rows and takes no
 * filter, so the server's own totals *are* the answer and there is nothing to count. What must never diverge is the
 * gate order, and that is pinned by a test asserting the two agree state-for-state on the same inputs.
 *
 * **The order is not arbitrary and must not be reordered:**
 * 1. **`nietMeetbaar` first.** A denominator of 0 means "we cannot measure this class yet" — an L3 class with only
 *    kleuterdoelen imported, which E5-02 recorded as a live case. **0 of 0 must never render as 100% or as success.**
 * 2. **`ingehouden` next.** A stale placement makes the figures null (directie 2026-07-28). Both are withheld together;
 *    a bar that drew the ceiling beside a blank would read as coverage of zero.
 * 3. Only then a figure.
 *
 * **The two segments are never added together.** `teAanvaarden` is what accepting *would* reach and is not coverage
 * (Art. IV.1) — it counts placements the teacher has not answered, including AI proposals. A screen must label the two
 * separately, and may not present their sum as a third number.
 */
export function bepaalVoortgangsbalk(voortgang: Dekkingsvoortgang): Voortgangsbalk {
  if (voortgang.aantalLeerplandoelen === 0) {
    return { soort: "nietMeetbaar", aantalBuitenBereik: voortgang.aantalBuitenBereik };
  }

  if (
    !voortgang.isBetrouwbaar ||
    typeof voortgang.aantalGedekt !== "number" ||
    typeof voortgang.aantalMogelijkGedekt !== "number"
  ) {
    return {
      soort: "ingehouden",
      aantalOnopgeloste: voortgang.aantalOnopgelosteVervallenPlaatsingen,
    };
  }

  const totaal = voortgang.aantalLeerplandoelen;
  const gedekt = voortgang.aantalGedekt;

  // Clamped at 0 rather than trusted. The ceiling is a superset by construction server-side, so a negative difference
  // is impossible — but a bar with a negative segment would render as a visual glitch nobody could diagnose, and
  // clamping costs nothing. Deliberately NOT clamped upward against `totaal`: if the server ever reported a ceiling
  // above the denominator that is a real defect, and a bar that silently hid it would be the second bug.
  const teAanvaarden = Math.max(0, voortgang.aantalMogelijkGedekt - gedekt);

  return {
    soort: "balk",
    gedekt,
    teAanvaarden,
    totaal,
    percentageGedekt: bepaalPercentage(gedekt, totaal),
    percentageMogelijk: bepaalPercentage(voortgang.aantalMogelijkGedekt, totaal),
  };
}
