import type { Dekking, DoelDekking } from "./types";

/**
 * The dekkingsoverzicht's pure derivations (E5-02): what the summary may say, and how the flat list of doelen
 * becomes readable groups. Kept out of the components so the two rules that actually carry risk — never printing a
 * figure the server withheld, and never reading "0 of 0" as success — are unit-testable without rendering anything.
 */

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
    // delimiters, so it cannot. The key is internal; nothing renders it.
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
 * What the summary slot is allowed to say. Three states, and only one of them is a number.
 *
 * - `cijfer` — a trustworthy count of covered doelen out of the doelen in scope.
 * - `nietMeetbaar` — nothing is in scope, so there is no denominator to be a fraction of.
 * - `ingehouden` — the server withheld the figure because a stale placement is unresolved.
 */
export type Dekkingscijfer =
  | { soort: "cijfer"; gedekt: number; totaal: number }
  | { soort: "nietMeetbaar"; aantalBuitenBereik: number }
  | { soort: "ingehouden"; aantalOnopgeloste: number };

/**
 * Decides which of the three the screen may render.
 *
 * **`nietMeetbaar` is checked first, and both orderings are defensible, so the choice is stated.** An empty scope
 * and an unresolved placement can hold at once. Neither yields a number, so nothing is suppressed by picking one;
 * what differs is which sentence a teacher reads, and "for this leerjaar no doelen are loaded" is the one they can
 * act on (it is an import, not a re-placement). Nothing is lost by the order because the unresolved-placement notice
 * is rendered **independently** of this slot, so a plan in both states still says both things.
 *
 * **`typeof gedekt === "number"` rather than `!== null`.** `aantalGedekt` is `null` in the JSON today, but a server
 * that omitted the property instead would make it `undefined`, and `undefined !== null` would send a withheld figure
 * down the `cijfer` branch to render "undefined van 40". The two rules that must never both fail are the flag and the
 * value, so both are checked and disagreement resolves towards withholding.
 */
export function bepaalCijfer(dekking: Dekking): Dekkingscijfer {
  if (dekking.aantalLeerplandoelen === 0) {
    return { soort: "nietMeetbaar", aantalBuitenBereik: dekking.aantalBuitenBereik };
  }

  if (!dekking.isBetrouwbaar || typeof dekking.aantalGedekt !== "number") {
    return {
      soort: "ingehouden",
      aantalOnopgeloste: dekking.aantalOnopgelosteVervallenPlaatsingen,
    };
  }

  return { soort: "cijfer", gedekt: dekking.aantalGedekt, totaal: dekking.aantalLeerplandoelen };
}
