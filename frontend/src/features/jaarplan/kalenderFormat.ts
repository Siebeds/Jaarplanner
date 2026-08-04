/**
 * Pure formatting + layout helpers for the kalender ribbon (E3-06). Kept out of the components so the
 * arithmetic the picture rests on can be tested without rendering anything.
 */

import type { TranslationKey } from "../../i18n";
import type { Planningsblok, Planningsblokniveau, Themaplaatsing, Planningsonderbreking } from "./types";

/**
 * The word for one block at each tier (E3-08 fix round 4, MINOR-4b).
 *
 * **Shared rather than duplicated**, because the two places that need it are the proportional strip's sr-only ordinal
 * and the board column's own heading, and one block being called two things across those two views is the exact defect
 * the E3-02/E3-06 review had to repair twice. A `Record` rather than a ternary per call site: a third
 * `Planningsblokniveau` then fails to compile here instead of silently inheriting *"Themaperiode {n}"* and naming a
 * block after a tier it does not belong to.
 *
 * It lives in this module — otherwise free of copy — for want of a better shared home: both consumers already import
 * from here, and only the *type* of a translation key is imported, so nothing about this file's testability changes.
 */
export const PERIODELABEL: Record<Planningsblokniveau, TranslationKey> = {
  Themaperiode: "kalender.periode",
  Subthemaperiode: "kalender.subperiode",
};

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
 * Which coarse periods each thema already occupies, as a map from thema id to those periods' **ordinals**
 * (E4-03). Feeds the hand-placement picker, which says *"staat al in themaperiode 3"* beside a thema and
 * refuses the one already in the period being planned.
 *
 * **Status is deliberately ignored, and that is the whole correctness of this function.** The obvious thing to
 * reach for here is {@link geplandeIn}, which drops `Geweigerd` — and it would be wrong twice over. The
 * server's duplicate guard is `Jaarplan.IsAlGeplaatst`, which matches on `(themaId, niveau, blokStart)` and
 * looks at no status at all, so a rejected placement still occupies the slot: filtering it out here would offer
 * the teacher an option that can only answer 400. And it would be wrong for the teacher too, since a rejected
 * card is visibly sitting in that period and telling them the period is free contradicts what they can see.
 * The two functions therefore answer different questions on purpose: `geplandeIn` is about *teaching time*,
 * this is about *slot occupancy*.
 *
 * Ordinals rather than start dates because the ordinal is what the teacher reads on the column heading. That
 * makes them display-only, exactly as ADR-0020 §3 requires: nothing derived here is ever sent back to the
 * server, which is keyed on `blokStart` throughout.
 *
 * Two classes of placement are skipped, and **both are matched explicitly rather than left to fall out of the
 * arithmetic** (E4-03 fix round 1, antagonist MINOR): one at another tier, and a stale one whose stored date is no
 * longer any period's start. Neither can be named by an ordinal that exists, and a stale placement's own period is
 * precisely what is unknown.
 *
 * *The tier check is the one that had to be added.* An earlier revision of this comment claimed it while the body
 * read only `blokStart`, so the skip held by luck: it worked only while a fine-tier start happened not to coincide
 * with a coarse one, and **each themaperiode's first sub-block shares its parent's start date** — the very property
 * this story's own backend test documents. So the single input class the claimed filter existed for was exactly the
 * one that slipped through. Unreachable today (nothing writes a `Subthemaperiode` placement), which is why it was a
 * false comment rather than a live defect, and why the fix is one predicate.
 */
export function themaPeriodeOrdinalen(
  plaatsingen: readonly Themaplaatsing[],
  blokken: readonly Planningsblok[],
  niveau: Planningsblokniveau = "Themaperiode",
): ReadonlyMap<string, readonly number[]> {
  // `blokken` is already one tier's grid — it comes from `/rooster?niveau=…` — so there is nothing to filter here,
  // and a first draft of this fix tried to, against a `niveau` field `Planningsblok` does not have.
  const ordinaalPerStart = new Map(blokken.map((blok) => [blok.start, blok.ordinaal]));
  const perThema = new Map<string, number[]>();

  for (const plaatsing of plaatsingen) {
    if (plaatsing.blokNiveau !== niveau) {
      continue;
    }

    const ordinaal = ordinaalPerStart.get(plaatsing.blokStart);
    if (ordinaal === undefined) {
      continue;
    }

    const bestaande = perThema.get(plaatsing.themaId);
    if (bestaande === undefined) {
      perThema.set(plaatsing.themaId, [ordinaal]);
    } else if (!bestaande.includes(ordinaal)) {
      bestaande.push(ordinaal);
    }
  }

  for (const ordinalen of perThema.values()) {
    ordinalen.sort((a, b) => a - b);
  }

  return perThema;
}

/** Dutch enumeration, e.g. "3 en 5" or "1, 3 en 5". The platform's own list grammar, not a hand-rolled join. */
const ordinaalLijst = new Intl.ListFormat("nl-BE", { style: "long", type: "conjunction" });

/** Formats period ordinals as a Dutch list for the picker's "staat al in themaperiode 3 en 5" annotation. */
export function formatteerOrdinalen(ordinalen: readonly number[]): string {
  return ordinaalLijst.format(ordinalen.map(String));
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
 * What a drop should do, decided from the dragged placement and the block it was released over.
 *
 * Extracted from the component so the three branches that matter can be tested without a browser. `jsdom` gives
 * every element a zero-sized rect and dnd-kit resolves drops by measuring rects, so the *gesture* cannot be
 * simulated there — but that is no reason to leave this **logic** unpinned, which is what the E3-07 antagonist
 * audit caught. It is plain data in, plain data out.
 *
 * @param plaatsing the dragged placement, or `undefined` if the draggable carried no payload.
 * @param doelBlokStart the released-over block's start date, or `undefined` when released over nothing.
 * @returns the block start date to move to, or `null` when the drop must change nothing.
 */
export function bepaalVerplaatsing(
  plaatsing: Themaplaatsing | undefined,
  doelBlokStart: string | undefined,
): string | null {
  // Released outside every period. Nothing happens, and above all nothing is guessed — the application never
  // picks a period on the teacher's behalf (directie 2026-07-28).
  if (doelBlokStart === undefined || plaatsing === undefined) {
    return null;
  }

  // Dropped back where it started. A no-op rather than a move, so the gesture cannot cost a standing AI proposal
  // its `Voorgesteld` status and its motivation for nothing.
  if (plaatsing.blokStart === doelBlokStart) {
    return null;
  }

  // A rejected placement is never moved: that would turn the teacher's rejection into `Manueel` and hand the
  // thema dekking it must not have (Art. V.1). The server refuses it too; this stops the request being made.
  if (plaatsing.status === "Geweigerd") {
    return null;
  }

  return doelBlokStart;
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
