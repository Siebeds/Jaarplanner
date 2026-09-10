import { t } from "../../i18n";

/**
 * Something standing at one day and one lesuur, whichever kind of thing it is.
 *
 * The rule below has to treat a placed activiteit and one appearance of a placed hoek as the same
 * species, because the owner ruled ONE rule for the whole lesurenraster (2026-08-31). The distinction
 * survives only where it has to: in which endpoint moves it.
 */
export type Bezetter =
  | {
      soort: "activiteit";
      plaatsingId: string;
      naam: string;
      datum: string;
      slot: number;
      /** How many lesuren it takes. An exchange is only defined for something that takes exactly one. */
      lengte: number;
    }
  | { soort: "hoek"; plaatsingId: string; momentId: string; naam: string; datum: string; slot: number };

/** How many lesuren a bezetter takes. An appearance of a hoek is always exactly one hour. */
export const lengteVan = (wat: Bezetter) => (wat.soort === "activiteit" ? wat.lengte : 1);

/** What a drop onto a lesuur should do. */
export type Ruilbesluit =
  | { soort: "verplaats" }
  | { soort: "ruil"; ander: Bezetter }
  /** Nothing is sent and the teacher is told why, in a sentence she can act on. */
  | { soort: "weiger"; melding: string };

/**
 * THE SWAP RULE (owner ruling, 2026-08-31).
 *
 * Drop something on an hour holding exactly one thing and the two exchange hours. Drop it on an empty
 * hour and it simply moves. The owner chose this over "both share the hour" and accepted the price
 * that comes with it: where an exchange is not defined, the drop is **refused in words** rather than
 * guessed at, because guessing would move something the teacher did not touch to an hour she did not
 * name.
 *
 * Two things make an exchange undefined, and both are refused:
 *
 * - **The hour holds more than one thing.** There is no single partner to send back.
 * - **Either side takes more than one lesuur.** The other would have to fit in a gap of one hour that
 *   is not one hour wide. The refusal names WHICH one, or a teacher looking at a one-hour corner and a
 *   three-hour kringgesprek cannot tell which of them is in the way.
 *
 * *A pure function on purpose.* The decision is the part worth testing and the part a later reader has
 * to trust; the two mutations that carry it out are plumbing. It also means the rule is stated once,
 * for hoekenwerk and activiteiten alike, which is what "one rule for the whole grid" has to mean in
 * code and not only in a comment.
 *
 * @param gesleept What she picked up.
 * @param anderen Everything already standing at the target day and hour. Never contains `gesleept`:
 *   a drop onto its own hour is a no-op the caller returns on before asking.
 * @param doelSlot The target lesuur, zero based, so the refusal can name it the way she does.
 */
export function ruilbesluit(
  gesleept: Bezetter,
  anderen: readonly Bezetter[],
  doelSlot: number,
): Ruilbesluit {
  if (anderen.length === 0) {
    return { soort: "verplaats" };
  }

  if (anderen.length > 1) {
    return { soort: "weiger", melding: t("slepen.ruilTeVol", { nummer: doelSlot + 1 }) };
  }

  const ander = anderen[0];
  const teLang = lengteVan(gesleept) > 1 ? gesleept : lengteVan(ander) > 1 ? ander : null;
  if (teLang !== null) {
    return { soort: "weiger", melding: t("slepen.ruilTeLang", { naam: teLang.naam }) };
  }

  return { soort: "ruil", ander };
}
