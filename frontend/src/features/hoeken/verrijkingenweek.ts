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
 * What a verrijking is written against: a subthema over some days, and the stored window when there is one. A run the
 * agenda draws has more (its thema, its count of days), but a window read from later in the year has only this.
 */
export type Verrijkingsreeks = Pick<Subthemareeks, "subthemaId" | "subthemaNaam" | "van" | "tot" | "periodeId">;

/**
 * The subthema that comes after the week the agenda stands in (FB-098), for the panel's "Hierna", and the windows its
 * stand is counted from. `reeks` is null when nothing is planned after that week.
 */
export type Volgendsubthema =
  | { status: "laadt" | "mislukt" }
  | { status: "klaar"; reeks: Verrijkingsreeks | null; periodes: readonly SubthemaperiodeVerrijkingen[] };

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
  return reeksen.filter((reeks) => reeks.van <= zondag && reeks.tot >= maandag).map((reeks) => metVenster(reeks, periodes));
}

/**
 * The first subthema that starts after the week of `maandag` (FB-098): among the runs the agenda already draws, which
 * cover the thema placements around that week, and among the klas's stored windows later in the school year.
 *
 * **A later run drawn from its activiteiten alone, with no stored window, is not seen** unless its placement is one the
 * agenda already read: finding it would take the whole rest of the year's weekplanning. A subthema planned in the
 * agenda is a stored window, so this is the rare case of activiteiten dragged in without one.
 *
 * A stored window that shares days with a run of the same subthema is that run, not a second candidate.
 */
export function volgendeReeks(
  reeksen: readonly Subthemareeks[],
  later: readonly SubthemaperiodeVerrijkingen[],
  alle: readonly SubthemaperiodeVerrijkingen[],
  maandag: string,
): Verrijkingsreeks | null {
  const zondag = verschuif(maandag, 6);
  const kandidaten: Verrijkingsreeks[] = [
    ...reeksen.filter((reeks) => reeks.van > zondag).map((reeks) => metVenster(reeks, alle)),
    ...later
      .filter(
        (periode) =>
          periode.van > zondag &&
          !reeksen.some(
            (reeks) => reeks.subthemaId === periode.subthemaId && reeks.van <= periode.tot && reeks.tot >= periode.van,
          ),
      )
      .map((periode) => ({
        subthemaId: periode.subthemaId,
        subthemaNaam: periode.subthemaNaam,
        van: periode.van,
        tot: periode.tot,
        periodeId: periode.subthemaperiodeId,
      })),
  ];
  // By start, then by name, as the runs themselves are ordered.
  kandidaten.sort((a, b) => a.van.localeCompare(b.van) || a.subthemaNaam.localeCompare(b.subthemaNaam));
  return kandidaten[0] ?? null;
}

function metVenster<T extends Verrijkingsreeks>(reeks: T, periodes: readonly SubthemaperiodeVerrijkingen[]): T {
  if (reeks.periodeId) return reeks;
  const venster = periodes.find(
    (periode) => periode.subthemaId === reeks.subthemaId && periode.van <= reeks.tot && periode.tot >= reeks.van,
  );
  return venster ? { ...reeks, periodeId: venster.subthemaperiodeId } : reeks;
}

/** What one hoek holds while one run lasts, or undefined when nothing is written, or the run has no window yet. */
export function verrijkingVan(
  periodes: readonly SubthemaperiodeVerrijkingen[],
  reeks: Verrijkingsreeks,
  hoekId: string,
): string | undefined {
  if (!reeks.periodeId) return undefined;
  return periodes
    .find((periode) => periode.subthemaperiodeId === reeks.periodeId)
    ?.verrijkingen.find((verrijking) => verrijking.hoekId === hoekId)?.tekst;
}

/** How many of `hoekIds` hold a verrijking while `reeks` runs: the panel's "1 van 6" (FB-098). */
export function aantalVerrijkt(
  periodes: readonly SubthemaperiodeVerrijkingen[],
  reeks: Verrijkingsreeks,
  hoekIds: readonly string[],
): number {
  return hoekIds.filter((hoekId) => (verrijkingVan(periodes, reeks, hoekId) ?? "").trim().length > 0).length;
}

/** A run's key: a subthema can run in two themaperiodes of one year, but never twice from the same day. */
export const reeksSleutel = (reeks: Verrijkingsreeks) => `${reeks.subthemaId}-${reeks.van}`;
