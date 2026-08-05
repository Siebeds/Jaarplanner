/**
 * Pure formatting + layout helpers for the kalender ribbon (E3-06). Kept out of the components so the
 * arithmetic the picture rests on can be tested without rendering anything.
 */

import type { TranslationKey } from "../../i18n";
import type {
  Blokspreiding,
  Planningsblok,
  Planningsblokniveau,
  Themaplaatsing,
  Planningsonderbreking,
} from "./types";

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
 * The block's length in **whole** weeks, rounded up: 40 open days reads "6", not "5,7".
 *
 * Derived from `aantalOpenDagen`, i.e. days the school is not closed. Note this still counts weekends — see the caveat
 * on `PlanningsblokWeergave.AantalOpenDagen`.
 *
 * **It rounds because te vol does** (owner ruling, 2026-08-04, on top of the te-vol ruling of 2026-07-31). This used to
 * render one decimal, matching the approved wireframe's arithmetic (31 days ÷ 7 = "4,4 weken"), and E3-09 put a second
 * weeks figure directly beneath it: the te-vol flag compares against `ceil(openDagen / 7)`, so a period of 40 open days
 * showed "5,7 weken" in its heading and "in 6 weken" one line down. Two numbers for one period length, which is the
 * self-contradiction the te-vol ruling exists to prevent, one level up from where that ruling was looking.
 *
 * **What rounding up means, so the figure is not misread as precision.** It is a deliberate leniency, not a
 * measurement: a thema's `DuurWeken` is nominal while a vrije dag costs a seventh of a week, so rounding up is what
 * keeps single free days from making an ordinary period te vol while a vakantie still does (it breaks the period
 * outright). The cost the owner accepted: a period carrying three vrije dagen now labels the same as an unbroken one,
 * and the {@link Jaarspine} still sizes its segments on exact open days, so two segments of visibly different width
 * can share a label. The width stays the honest signal of teaching time; the label is the figure the rule uses.
 *
 * **Returns a number, not a formatted string, and the rename to `wekenInBlok` records that.** It used to hand back
 * "4,4" ready to interpolate; a whole number has to reach `tAantal` as a count, because "1 weken" is grammatical
 * nonsense that a decimal was accidentally hiding.
 */
export function wekenInBlok(aantalOpenDagen: number): number {
  return Math.ceil(aantalOpenDagen / 7);
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
 * How full each period is, by the block start date it keys on.
 *
 * A lookup rather than a computation, and that is the point of E3-09: *te vol* used to be decided here by a
 * provisional threshold that counted thema's, while the server decided the same question by arithmetic on weeks. The
 * two disagreed for months. The rule now has one implementation, `BlokspreidingWeergave.IsOverbelast`, and this
 * module only reads its answer.
 *
 * Keyed on `start` and not on `ordinaal`, like everything else that has to survive a vakantie edit (ADR-0020 §3).
 */
export function belastingPerStart(
  blokken: readonly Blokspreiding[],
): ReadonlyMap<string, Blokspreiding> {
  return new Map(blokken.map((blok) => [blok.start, blok]));
}

/**
 * Whether a period would be te vol carrying `benodigdeWeken` weeks of thema's.
 *
 * **The one sanctioned mirror of the server's `IsOverbelast`.** It exists only because the board has to answer "would
 * this become te vol?" *during* a drag, and a hover cannot round-trip. Everything about the state already on screen
 * reads {@link Blokspreiding.isOverbelast} instead of calling this.
 *
 * That mirror is pinned rather than trusted: a test asserts this function reproduces the server's own verdict for
 * every block of a real payload, so a change to the comparison on either side fails here.
 */
export function isTeVolMet(beschikbareWeken: number, benodigdeWeken: number): boolean {
  return benodigdeWeken > beschikbareWeken;
}

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
 * The weeks a period would carry if the dragged thema were dropped into it.
 *
 * `undefined` when the target has no measured load, which at the coarse tier means the board and the plan disagree
 * about the grid: the caller shows nothing rather than guessing a number.
 */
export function benodigdeWekenNa(
  belasting: Blokspreiding | undefined,
  extraWeken: number,
): number | undefined {
  return belasting === undefined ? undefined : belasting.benodigdeWeken + extraWeken;
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

/**
 * A signature of a plan's placements: their ids with the state that can change what coverage they contribute.
 *
 * **Why coverage needs this at all (E3-03, antagonist round 1).** The generation panel's dekking figures come from the
 * generation response and nothing invalidates them, while `usePlanMutatie` drops the live dekking cache on every
 * placement edit. So the moment a teacher accepts a card, the panel and the live coverage line on the same screen
 * describe two different plans. Comparing this signature of the plan the response carried with the one on screen
 * answers the only question that matters — "do those numbers still describe what I am looking at" — without counting
 * mutations, which would also fire for edits that changed nothing.
 *
 * Status and staleness are in, position is not: a move changes `blokStart`, and it also changes the status to
 * `Manueel`, so the status carries it. `IsVervallen` is in because a placement that stops being stale releases a
 * figure that was being withheld altogether.
 *
 * **`doelcodes` is in too, and leaving it out was a real gap** (antagonist round 2). It is the codes the thema
 * actually carries — themadoelen plus accepted/manual links — so accepting a doelsuggestie on `/themas`, or a
 * colleague doing it in another tab, changes the coverage figure while leaving id, status and staleness identical.
 * The data was already on the object being signed; only the signature was blind to it.
 */
export function plaatsingssignatuur(plaatsingen: readonly Themaplaatsing[]): string {
  return plaatsingen
    .map((p) => `${p.id}:${p.status}:${p.isVervallen ? 1 : 0}:${[...p.doelcodes].sort().join(",")}`)
    .sort()
    .join("|");
}
