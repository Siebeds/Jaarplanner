import type { DoelsoortNaam } from "../../components/doelsoort";

/**
 * The dekkingsoverzicht's wire types (E5-02, FR-9.1) — the shape of `GET /api/klassen/{klasId}/dekking`.
 *
 * Coverage is **computed on every read and never stored** (Art. V.1), so there is nothing to invalidate and no
 * mutation in this feature: the screen is a pure projection of the plan plus the link state. That is what makes
 * "the view matches the plan state live" a property of the fetch rather than of a cache-busting scheme.
 */

/** Which leerplandoelen a class is measured against (owner ruling 2026-08-04). */
export const DEKKINGSBEREIKEN = ["EigenJaarFase", "HeelCurriculum"] as const;

/**
 * The scope, as the API serialises the backend `Dekkingsbereik` enum (by name).
 *
 * Derived from the array rather than written twice, so the switch cannot offer an option the type does not know
 * about, and adding a third scope errors here instead of silently rendering no button (the defect E3-08's fix round 4
 * found in the zoom control's hand-written option list).
 */
export type Dekkingsbereik = (typeof DEKKINGSBEREIKEN)[number];

/**
 * Why a leerplandoel is **not** covered, as the API serialises the backend `Lacuneoorzaak` enum (E5-05, FR-9).
 *
 * Ordered cheapest-route-first, matching the server's own ordering, because the aggregated routes above the list are
 * rendered in this order: a teacher should meet the two-click fix before the one that needs new content.
 *
 * Derived from the array rather than written twice, like `DEKKINGSBEREIKEN` above and for the same reason: a cause
 * added on the server errors here instead of silently rendering nothing. Written without a count on purpose, because
 * the count was "four" until 2026-08-19 and the sentence outlived it.
 */
export const LACUNEOORZAKEN = [
  "WachtOpBeslissing",
  "PlaatsingGeweigerd",
  "NietIngepland",
  "KoppelingNietBeslist",
  "GeenThema",
] as const;

export type Lacuneoorzaak = (typeof LACUNEOORZAKEN)[number];

/** One leerplandoel and whether this class's plan covers it. */
export interface DoelDekking {
  /** The stable Op.stap code (Art. III.5). */
  code: string;
  /** The doelsoort as the API serialises it; map with `doelsoortBadgeSoort` for the badge/token. */
  doelsoort: DoelsoortNaam;
  jaarFase: string;
  domein: string;
  /** Unique only together with `domein` (Art. VII.0), which is why the grouping keys on both. */
  subdomein: string;
  tekst: string;
  /** The concordance key to the decreed eindterm, or null. Not rendered here: minimumdoel level is E5-04. */
  minimumdoelRef: string | null;
  /** A re-import found this goal gone from Op.stap while school content still referenced it (Art. III.4). */
  nietMeerInOpstap: boolean;
  isGedekt: boolean;
  /**
   * The thema's that cover it, alphabetically; empty exactly when `isGedekt` is false.
   *
   * This is the evidence half of Art. V: a screen that claims coverage has to be able to say *through what*.
   */
  dekkendeThemas: string[];
  /**
   * Why it is not covered, or null exactly when it is (E5-05).
   *
   * Typed as the union rather than `string`, and read through `leesOorzaak` rather than trusted: a value this client
   * has no case for renders no cause line at all, which says less rather than something wrong. That is the same
   * failure direction `leesDoelsoort` takes on the URL, and for the sharper reason — the alternative here is a
   * catalogue key rendered verbatim to a teacher (Art. II.3), which is exactly what `?doelsoort=Foo` once did.
   */
  oorzaak: Lacuneoorzaak | null;
  /**
   * The thema's that justify `oorzaak`, alphabetically: the ones to act on.
   *
   * Empty when the doel is covered, and empty for `GeenThema`, which has nothing to name. It lists only the thema's
   * belonging to the reported cause, not every thema linked to the goal, so the names and the sentence they sit in
   * always describe the same action.
   */
  kandidaatThemas: string[];
}

/** One class's computed coverage. */
export interface Dekking {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  /** The scope that was **applied**, which is not always the one that was asked for. */
  bereik: Dekkingsbereik;
  /** The jaar/fase codes measured against; empty for the whole curriculum. */
  gemetenJaarFasen: string[];
  /**
   * The codes this class *could* be measured against, before any narrowing; empty for the whole curriculum.
   *
   * Distinct from `gemetenJaarFasen` because a kleutergroep must be able to narrow and, having narrowed, must still know
   * what it narrowed from: after choosing K3 the measured list is `["K3"]`, and a screen with only that could no longer
   * offer JK and K2 as the alternatives. More than one member is also the condition the chooser renders on.
   */
  beschikbareJaarFasen: string[];
  /** The class's own jaar/fase was asked for and could not be derived, so the scope was widened. */
  isTerugvalNaarHeelCurriculum: boolean;
  /** How many loaded doelen fall outside `bereik`; 0 for the whole curriculum. */
  aantalBuitenBereik: number;
  /**
   * Whether the summary figure may be shown at all.
   *
   * `false` while a stale placement is unresolved: a thema whose period no longer exists is not demonstrably
   * taught, so the plan cannot report trustworthy dekking (directie 2026-07-28). The screen must then show no
   * number, and `aantalGedekt` is null so it physically cannot.
   */
  isBetrouwbaar: boolean;
  /**
   * How many stale placements still need a human decision.
   *
   * **Deliberately not the same number as the kalender's stale-placement count**, which includes rejected ones. A
   * plan with one stale *rejected* placement reports 0 here while that calendar notice is still up, because
   * rejecting a stale proposal resolves it for dekking (owner ruling 2026-08-03). Any screen showing both has to
   * reconcile them in words.
   */
  aantalOnopgelosteVervallenPlaatsingen: number;
  /** How many doelen are covered, or null while the figure is withheld. */
  aantalGedekt: number | null;
  /** The denominator: how many doelen are in scope. Can be 0 while the school has a curriculum loaded. */
  aantalLeerplandoelen: number;
  /** Every in-scope doel, ordered by (domein, subdomein, code) — ordinal, server-side. */
  doelen: DoelDekking[];
}
