import type { DoelsoortNaam } from "../../components/doelsoort";
import { LACUNEOORZAKEN, type Dekking, type DoelDekking, type Lacuneoorzaak } from "./types";

/**
 * The dekkingsoverzicht's pure derivations (E5-02, E5-03): what the summary may say, how the flat list of doelen
 * becomes readable groups, and what the doelsoort filter does to both. Kept out of the components so the rules that
 * actually carry risk — never printing a figure the server withheld, never reading "0 of 0" as success, and never
 * rounding a percentage to a number that contradicts its own fraction — are unit-testable without rendering anything.
 */

/**
 * The doelsoort the overview is narrowed to, or `null` for all of them (E5-03, FR-9.2).
 *
 * **This narrowing changes the figure, and that is the story's own acceptance criterion** (*"filtering by MD shows
 * minimumdoel-only coverage"*). It is therefore a different kind of control from the "alleen ontbrekende" toggle
 * beside the list, which hides rows and must leave the figure alone. Two client-side filters over one payload, one
 * of which is a change of subject and one of which is a change of view: see {@link Dekkingskeuze}.
 */
export type Doelsoortkeuze = DoelsoortNaam | null;

/**
 * What the list is filtered by. Split into the two halves deliberately, because they are not the same kind of thing
 * and a single "filter" bag would invite the defect this separation exists to prevent.
 *
 * - `doelsoort` narrows **what is being measured**. The percentage and the counts follow it.
 * - `alleenOntbrekende` narrows **what is being shown**. The percentage and the counts must NOT follow it, or the
 *   screen would report 0% every time a teacher asked to see their gaps.
 */
export interface Dekkingskeuze {
  doelsoort: Doelsoortkeuze;
  alleenOntbrekende: boolean;
}

/**
 * The doelen a given doelsoort narrowing measures over.
 *
 * Separate from {@link toonbareDoelen} because the two answer different questions and the summary must never be
 * computed over the second: `alleenOntbrekende` is a view, not a scope.
 */
export function gemetenDoelen(
  doelen: readonly DoelDekking[],
  doelsoort: Doelsoortkeuze,
): DoelDekking[] {
  return doelsoort === null ? [...doelen] : doelen.filter((doel) => doel.doelsoort === doelsoort);
}

/** The rows the list actually renders: the measured set, minus the covered ones when only gaps are wanted. */
export function toonbareDoelen(
  doelen: readonly DoelDekking[],
  keuze: Dekkingskeuze,
): DoelDekking[] {
  const gemeten = gemetenDoelen(doelen, keuze.doelsoort);

  return keuze.alleenOntbrekende ? gemeten.filter((doel) => !doel.isGedekt) : gemeten;
}

/** One doelsoort the filter may offer, with how many of this class's in-scope doelen carry it. */
export interface Doelsoortoptie {
  doelsoort: DoelsoortNaam;
  aantal: number;
}

/**
 * The doelsoorten actually present in this class's scope, in the order the server sent them.
 *
 * **Derived from the payload rather than from the six-member enum**, for the same reason the register's filters are
 * (`Doelenfilters`): a compiled-in list offers a teacher a doelsoort their curriculum does not contain, and choosing
 * it yields an empty screen that looks like a fault. Which disciplines are loaded is an open Art. XIV decision, so
 * the set genuinely varies per school.
 */
export function beschikbareDoelsoorten(doelen: readonly DoelDekking[]): Doelsoortoptie[] {
  const aantallen = new Map<DoelsoortNaam, number>();

  for (const doel of doelen) {
    aantallen.set(doel.doelsoort, (aantallen.get(doel.doelsoort) ?? 0) + 1);
  }

  return [...aantallen].map(([doelsoort, aantal]) => ({ doelsoort, aantal }));
}

/** One (domein, subdomein) group, with its own tally. */
export interface Dekkingsgroep {
  /** Stable key for React, and the identity the two fields form together (Art. VII.0). */
  sleutel: string;
  domein: string;
  subdomein: string;
  doelen: DoelDekking[];
  aantalGedekt: number;
}

/**
 * The flat doelen list as groups, in the order the server sent them.
 *
 * **Grouped through a `Map` rather than by scanning for consecutive runs.** The server orders by
 * (domein, subdomein, code) ordinally, so every group's rows *are* adjacent today and a run-scan would work. It
 * would also render two identical group headers the day that order changes, which is a silent visual defect rather
 * than an error. A `Map` keyed on both fields yields one group per pair whatever the order, and its insertion order
 * still preserves the server's, so nothing is re-sorted client-side. That matters: the server documents its ordering
 * as ordinal and host-independent, and a client-side `localeCompare` would quietly disagree with the export.
 *
 * The tally is counted here rather than trusted from elsewhere, because a group's own "3 van 8" has to be derived
 * from the same rows the group renders or the two can disagree.
 */
export function groepeerPerSubdomein(doelen: readonly DoelDekking[]): Dekkingsgroep[] {
  const groepen = new Map<string, Dekkingsgroep>();

  for (const doel of doelen) {
    // `JSON.stringify` of the pair, NOT the two names joined by a separator. Any separator that can occur in a real
    // name collides: joined with a space, ("Levende natuur", "Dieren") and ("Levende", "natuur Dieren") produce the
    // same key, silently merging two subdomeinen into one group with one tally. JSON quoting escapes its own
    // delimiters, so it cannot.
    //
    // **It is a Map key and a React key only. It must never reach the DOM as an `id`**, because it contains quotes and
    // whitespace: an earlier version of this comment said "nothing renders it" and `Dekkinggroep` was rendering it into
    // `id`/`aria-labelledby` two files away, which silently cost every group its accessible name (antagonist MINOR-1).
    // A DOM id is passed in separately by the page.
    const sleutel = JSON.stringify([doel.domein, doel.subdomein]);
    const bestaande = groepen.get(sleutel);

    if (bestaande) {
      bestaande.doelen.push(doel);
      bestaande.aantalGedekt += doel.isGedekt ? 1 : 0;
      continue;
    }

    groepen.set(sleutel, {
      sleutel,
      domein: doel.domein,
      subdomein: doel.subdomein,
      doelen: [doel],
      aantalGedekt: doel.isGedekt ? 1 : 0,
    });
  }

  return [...groepen.values()];
}

/**
 * The cause as this client may use it, or `null` when the server sent one it has no case for (E5-05).
 *
 * **A value this screen cannot name renders no cause line at all**, rather than a fallback sentence or the raw value.
 * The alternative is what `?doelsoort=Foo` produced before E5-03's audit: a catalogue key interpolated into Dutch and
 * shown to a teacher (Art. II.3). Saying less is the honest degrade; saying something else is the defect.
 *
 * `null` also arrives legitimately, for every covered doel, and the two are deliberately not distinguished here: the
 * caller's question is "is there a cause line to render", and the answer is no in both cases.
 */
export function leesOorzaak(oorzaak: string | null): Lacuneoorzaak | null {
  return LACUNEOORZAKEN.find((bekend) => bekend === oorzaak) ?? null;
}

/** One gap cause present in the current view, with how many of the shown doelen have it. */
export interface Lacunetelling {
  oorzaak: Lacuneoorzaak;
  aantal: number;
}

/**
 * The gap causes present in a set of doelen, in {@link LACUNEOORZAKEN} order, skipping the ones with nothing in them
 * (E5-05, FR-9).
 *
 * **Counted over whatever the caller passes, and the caller must pass the doelsoort-narrowed gaps.** These counts sit
 * beside a list, and a count that describes a different set from the rows underneath it is the defect E5-02 found in
 * its group tallies: the numbers were right about a set nobody could see.
 *
 * **Covered doelen and unrecognised causes both fall out**, the first because they are not gaps and the second
 * through {@link leesOorzaak}. That means these counts do NOT necessarily add up to the number of gaps shown, and no
 * caller may present them as a breakdown of a total. It is a list of routes with a size each, not a partition.
 *
 * Order comes from the vocabulary rather than from the counts, deliberately. Sorting by size would put the biggest
 * pile first, which on a fresh plan is always "no thema covers this" — the one route a teacher cannot walk today.
 */
export function telLacuneoorzaken(doelen: readonly DoelDekking[]): Lacunetelling[] {
  const aantallen = new Map<Lacuneoorzaak, number>();

  for (const doel of doelen) {
    if (doel.isGedekt) {
      continue;
    }

    const oorzaak = leesOorzaak(doel.oorzaak);

    if (oorzaak !== null) {
      aantallen.set(oorzaak, (aantallen.get(oorzaak) ?? 0) + 1);
    }
  }

  return LACUNEOORZAKEN.filter((oorzaak) => aantallen.has(oorzaak)).map((oorzaak) => ({
    oorzaak,
    aantal: aantallen.get(oorzaak)!,
  }));
}

/**
 * What the summary slot is allowed to say. Three states, and only one of them is a number.
 *
 * - `cijfer` — a trustworthy count of covered doelen out of the doelen in scope.
 * - `nietMeetbaar` — nothing is in scope, so there is no denominator to be a fraction of.
 * - `ingehouden` — the server withheld the figure because a stale placement is unresolved.
 */
export type Dekkingscijfer =
  | { soort: "cijfer"; gedekt: number; totaal: number; percentage: number }
  | { soort: "nietMeetbaar"; aantalBuitenBereik: number }
  | { soort: "geenVanDezeSoort" }
  | { soort: "ingehouden"; aantalOnopgeloste: number };

/**
 * The dekkingspercentage (E5-03, FR-9.2), as a whole number.
 *
 * **The two clamps are the whole of this function and neither is cosmetic.** Plain rounding produces two lies that
 * are precisely the ones an inspectie-facing figure must never tell:
 *
 * - `1` of `500` is `0,2%`, which rounds to **0%** and reads as "nothing is covered" while a doel demonstrably is;
 * - `499` of `500` is `99,8%`, which rounds to **100%** and reads as "everything is covered" while a doel is not.
 *
 * So 0% is reserved for a genuinely empty numerator and 100% for a genuinely complete one, and everything in
 * between is clamped into 1..99. A figure that disagrees with the fraction printed beside it is worse than a
 * coarse figure, and this screen always prints both.
 *
 * Rounds half away from zero (`Math.round`), which for a percentage in 0..100 is ordinary commercial rounding.
 * Whole numbers rather than one decimal, matching the ruling E3-09 applied to week counts for the same reason:
 * a decimal invites a precision this computation does not have.
 */
export function bepaalPercentage(gedekt: number, totaal: number): number {
  if (totaal <= 0 || gedekt <= 0) {
    return 0;
  }

  if (gedekt >= totaal) {
    return 100;
  }

  return Math.min(99, Math.max(1, Math.round((gedekt / totaal) * 100)));
}

/**
 * Decides which of the three the screen may render.
 *
 * **`nietMeetbaar` is checked first, and both orderings are defensible, so the choice is stated.** An empty scope
 * and an unresolved placement can hold at once. Neither yields a number, so nothing is suppressed by picking one;
 * what differs is which sentence a teacher reads, and "for this class no doelen are loaded" is the one they can act
 * on (it is an import, not a re-placement).
 *
 * **The other fact is not lost, and an earlier version of this comment claimed that for a reason that did not
 * exist** (antagonist round 2). It said the unresolved-placement notice "is rendered independently of this slot", and
 * no such notice existed: the summary had exactly three mutually exclusive branches, so in the reachable combined
 * state — an L3 class while only kleuterdoelen are loaded, *plus* a stale placement — the screen said nothing at all
 * about the placement awaiting a decision and withheld the link to go fix it. The comment is now true because
 * `Dekkingsamenvatting` renders that sentence and its link **outside** the three-way slot whenever
 * `aantalOnopgelosteVervallenPlaatsingen > 0`, and the combined state has its own test.
 *
 * **`typeof gedekt === "number"` rather than `!== null`.** `aantalGedekt` is `null` in the JSON today, but a server
 * that omitted the property instead would make it `undefined`, and `undefined !== null` would send a withheld figure
 * down the `cijfer` branch to render "undefined van 40". The two rules that must never both fail are the flag and the
 * value, so both are checked and disagreement resolves towards withholding.
 *
 * **The counts are derived from `gemeten` rather than read from `aantalGedekt` / `aantalLeerplandoelen`, and that is
 * E5-03's one genuinely risky change** (FR-9.2). A doelsoort narrowing is client-side by the server's own design
 * (`DekkingWeergave.Doelen`: *"presentation over this one computation rather than second queries that could drift"*),
 * so under a filter there is no server figure to read and the rows are the only source. Using the rows in **both**
 * cases rather than switching source on whether a filter is active is the deliberate half: one code path, and
 * unfiltered it must reproduce the server's own numbers exactly, because the server computes `AantalGedekt` as
 * `doelen.Count(d => d.IsGedekt)` over this very list (`DekkingService.cs`).
 *
 * **That equality is pinned on the SERVER, and saying so here is a correction** (antagonist round 1, MINOR-1). This
 * comment used to claim a frontend test pinned it. It could not: the fixture factory derives `aantalGedekt` from the
 * same array it hands to `bepaalCijfer`, so the assertion compared a count against itself and would have passed just
 * as happily on an implementation that read `aantalGedekt` instead of counting. The real guard is
 * `DekkingEndpointsTests.Dekking_totalen_komen_overeen_met_de_rijen_die_ze_beschrijven`, an integration assertion
 * against **real PostgreSQL** that the payload's own totals equal a count over its own rows. That is the test that
 * fails if the server ever stops agreeing with itself, which is the only way this browser-side count can go wrong.
 *
 * **What did NOT move is the gate.** `isBetrouwbaar` and the presence of `aantalGedekt` still decide whether any
 * figure may be printed, and they are still the server's. That matters more under a filter than without one: the
 * withheld state leaves `doelen[].isGedekt` fully populated, so counting a subset is a route around the directie
 * ruling of 2026-07-28 that is open to any caller. It is closed here, once, for every caller.
 *
 * @param gemeten The doelen the figure is over: the doelsoort-narrowed set, never the "alleen ontbrekende" one.
 */
export function bepaalCijfer(dekking: Dekking, gemeten: readonly DoelDekking[]): Dekkingscijfer {
  if (dekking.aantalLeerplandoelen === 0) {
    return { soort: "nietMeetbaar", aantalBuitenBereik: dekking.aantalBuitenBereik };
  }

  // Doelen are loaded and in scope, but none of them is of the chosen doelsoort. Its own state, before the
  // withholding check and for the same reason `nietMeetbaar` comes first: neither yields a number, and this is the
  // one a teacher can act on in a single click. Unreachable without a filter, since an empty scope is caught above.
  if (gemeten.length === 0) {
    return { soort: "geenVanDezeSoort" };
  }

  if (!dekking.isBetrouwbaar || typeof dekking.aantalGedekt !== "number") {
    return {
      soort: "ingehouden",
      aantalOnopgeloste: dekking.aantalOnopgelosteVervallenPlaatsingen,
    };
  }

  const gedekt = gemeten.filter((doel) => doel.isGedekt).length;

  return {
    soort: "cijfer",
    gedekt,
    totaal: gemeten.length,
    percentage: bepaalPercentage(gedekt, gemeten.length),
  };
}
