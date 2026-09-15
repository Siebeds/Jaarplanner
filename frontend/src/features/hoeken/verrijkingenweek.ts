import { verschuif } from "../../lib/datum";
import type { Subthemareeks } from "../plan/subthemareeksen";
import type { SubthemaperiodeVerrijkingen } from "./gegevens";

/**
 * What the side panel's hoekenfiches need to show and write a verrijking (FB-038, ADR-0044): the subthema runs of the
 * week the agenda stands in, and the klas's stored subthemaperiodes with what each hoek holds in them.
 *
 * **Known or not, never guessed.** "laadt" and "mislukt" carry nothing, so a card cannot say a hoek has no verrijking,
 * nor the sheet that no subthema runs, on the strength of a read that has not answered.
 */
export type Verrijkingenweek =
  | { status: "laadt" | "mislukt" }
  | { status: "klaar"; reeksen: readonly Subthemareeks[]; periodes: readonly SubthemaperiodeVerrijkingen[] };

/**
 * The runs touching the week of `maandag`, each with the stored window a save writes to.
 *
 * A run drawn from its activiteiten alone may still share days with a stored window of the same subthema that began in
 * the previous themaperiode, which the runs do not fold in. The server writes onto that window rather than store a
 * second one (ADR-0041 decision 3), so the run names it too, instead of offering to store a period that exists.
 */
export function reeksenVanWeek(
  reeksen: readonly Subthemareeks[],
  periodes: readonly SubthemaperiodeVerrijkingen[],
  maandag: string,
): Subthemareeks[] {
  const zondag = verschuif(maandag, 6);
  return reeksen
    .filter((reeks) => reeks.van <= zondag && reeks.tot >= maandag)
    .map((reeks) => {
      if (reeks.periodeId) return reeks;
      const venster = periodes.find(
        (periode) => periode.subthemaId === reeks.subthemaId && periode.van <= reeks.tot && periode.tot >= reeks.van,
      );
      return venster ? { ...reeks, periodeId: venster.subthemaperiodeId } : reeks;
    });
}

/** What one hoek holds while one run lasts, or undefined when nothing is written, or the run has no window yet. */
export function verrijkingVan(
  periodes: readonly SubthemaperiodeVerrijkingen[],
  reeks: Subthemareeks,
  hoekId: string,
): string | undefined {
  if (!reeks.periodeId) return undefined;
  return periodes
    .find((periode) => periode.subthemaperiodeId === reeks.periodeId)
    ?.verrijkingen.find((verrijking) => verrijking.hoekId === hoekId)?.tekst;
}

/** A run's key: a subthema can run in two themaperiodes of one year, but never twice from the same day. */
export const reeksSleutel = (reeks: Subthemareeks) => `${reeks.subthemaId}-${reeks.van}`;
