/**
 * Pure formatting + layout helpers for the kalender ribbon (E3-06). Kept out of the components so the
 * arithmetic the picture rests on can be tested without rendering anything.
 */

import type { Planningsblok, Planningsonderbreking, Themaplaatsing } from "./types";

/** Dutch day+month, e.g. "1 sep". The trailing period Intl adds to abbreviated months is dropped. */
const dagMaand = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });

/** Formats an ISO `yyyy-MM-dd` as a Dutch day+month. */
export function formatteerDatum(isoDatum: string): string {
  const [jaar, maand, dag] = isoDatum.split("-").map(Number);

  // Constructed in local time from the parts, never `new Date(iso)` — that parses as UTC and can
  // shift a date across midnight for anyone west of Greenwich, silently renaming "1 sep" to "31 aug".
  return dagMaand.format(new Date(jaar, maand - 1, dag)).replace(/\.$/, "");
}

/** Formats a block's span, e.g. "1 sep – 1 okt". */
export function formatteerPeriode(start: string, eind: string): string {
  return `${formatteerDatum(start)} – ${formatteerDatum(eind)}`;
}

/**
 * The block's length in weeks, Dutch-formatted to one decimal ("4,4").
 *
 * Derived from `aantalOpenDagen`, i.e. days the school is not closed. Note this still counts weekends —
 * see the caveat on `PlanningsblokWeergave.AantalOpenDagen`; the resulting figure matches the approved
 * wireframe's own arithmetic (31 days ÷ 7 = "4,4 weken") and is a review question, not a silent choice.
 */
export function formatteerWeken(aantalOpenDagen: number): string {
  return (aantalOpenDagen / 7).toLocaleString("nl-BE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * One entry in the ribbon: either a period or a vakantie gap between two periods.
 *
 * The ribbon is a single ordered sequence rather than two lists, because the gaps only mean anything
 * *between* specific blocks — rendering the two separately and hoping they line up is how a vacation
 * ends up drawn in the wrong place.
 */
export type Ribbonsegment =
  | { soort: "blok"; blok: Planningsblok }
  | { soort: "onderbreking"; onderbreking: Planningsonderbreking };

/**
 * Interleaves blocks and vakanties into one chronological ribbon.
 *
 * A vakantie is emitted only when it genuinely falls **between** two blocks. A vakantie before the
 * first block or after the last one (a year that opens or closes with a closure) is dropped: a gap at
 * the edge of the ribbon reads as a period that failed to render, and there is no teaching time on
 * either side of it to separate.
 */
export function bouwRibbon(
  blokken: readonly Planningsblok[],
  onderbrekingen: readonly Planningsonderbreking[],
): Ribbonsegment[] {
  const segmenten: Ribbonsegment[] = [];

  blokken.forEach((blok, index) => {
    segmenten.push({ soort: "blok", blok });

    const volgende = blokken[index + 1];
    if (!volgende) {
      return;
    }

    for (const onderbreking of onderbrekingen) {
      if (onderbreking.start > blok.eind && onderbreking.eind < volgende.start) {
        segmenten.push({ soort: "onderbreking", onderbreking });
      }
    }
  });

  return segmenten;
}

/**
 * The provisional "te vol" threshold, in thema's per period.
 *
 * **This is a placeholder for review question C, not a decision.** The approved wireframe flags at 3, and
 * question C asks whether "te vol" should count thema's, count goals, or scale with the period's length — a
 * 6-week period is genuinely wider than a 4-week one and can hold more before it looks full. It lives in one
 * place, and the UI says out loud that the threshold is provisional, so the review can change it without
 * hunting for a magic number.
 */
export const VOORLOPIGE_TE_VOL_DREMPEL = 3;

/**
 * The placements that actually occupy teaching time in a period.
 *
 * A rejected thema is still *shown* — a teacher should see what they threw out, and the status chip renders
 * it struck through — but it must not count toward "te vol": nothing is taught in this period on its
 * account. The backend applies the same rule via `Themaplaatsing.IsGepland` (E3-02 code review).
 */
export function geplandeIn(plaatsingen: readonly Themaplaatsing[]): Themaplaatsing[] {
  return plaatsingen.filter((p) => p.status !== "Geweigerd");
}

/**
 * Whether a period counts as over-full.
 *
 * Lives here rather than in the component so the year spine and the period card cannot disagree about
 * which period is flagged — they now read the same predicate.
 */
export function isTeVol(plaatsingen: readonly Themaplaatsing[]): boolean {
  return geplandeIn(plaatsingen).length >= VOORLOPIGE_TE_VOL_DREMPEL;
}

/** The placements sitting in a given block, matched on the block start date they key on. */
export function plaatsingenIn(
  plaatsingen: readonly Themaplaatsing[],
  blok: Planningsblok,
): Themaplaatsing[] {
  return plaatsingen.filter((p) => !p.isVervallen && p.blokStart === blok.start);
}

/**
 * Placements that belong to no current block — the school edited its vakanties and these now point at
 * a date that is not a period boundary.
 *
 * They are collected separately and **must be rendered**, never dropped: a thema that silently
 * disappears from the plan is worse than one flagged as needing attention (directie 2026-07-28). The
 * fallback on `blokStart` catches a placement the server has not flagged but whose date matches no
 * block anyway, so a disagreement between the two views surfaces instead of swallowing a card.
 */
export function vervallenPlaatsingen(
  plaatsingen: readonly Themaplaatsing[],
  blokken: readonly Planningsblok[],
): Themaplaatsing[] {
  const starts = new Set(blokken.map((b) => b.start));

  return plaatsingen.filter((p) => p.isVervallen || !starts.has(p.blokStart));
}
