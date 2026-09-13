import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import type { LeerplandoelImportAntwoord, MinimumdoelImportAntwoord, OpstapHerimportDiff } from "./types";

/**
 * The two steps of the Op.stap import from KOV's API (E1-22): the state each one is in, how a call is run, and when a
 * report has anything to write. Kept out of the components so they stay components only.
 */

/** One step of the flow: the report in front of the reader, the refusal if there was one, and whether a call is out. */
export interface Staat<T> {
  antwoord: T | null;
  fout: string | null;
  laadt: boolean;
}

export const RUST = { antwoord: null, fout: null, laadt: false } as const;

/**
 * Runs one call and records its answer, or its refusal while keeping the report that was on screen: a refused apply
 * wrote nothing, so the preview it was about is still true. The refusal is the server's Dutch `detail` when there is
 * one (a 409 or 502 says what happened and that nothing changed), else a bare "Niet gelukt", which claims no more.
 */
export async function voer<T>(
  actie: () => Promise<T>,
  zet: (staat: Staat<T>) => void,
  vorige: T | null,
): Promise<T | null> {
  try {
    const antwoord = await actie();
    zet({ antwoord, fout: null, laadt: false });
    return antwoord;
  } catch (e) {
    zet({ antwoord: vorige, fout: e instanceof ApiError && e.detail ? e.detail : t("importeren.mislukt"), laadt: false });
    return null;
  }
}

/**
 * Anything the apply would write. A report whose only entries are unread or out-of-scope rows writes nothing, so it
 * offers no *Doorvoeren*: a button that changes nothing is the control the E3-06 rule forbids.
 */
export function schrijftMinimumdoelen(antwoord: MinimumdoelImportAntwoord): boolean {
  const { diff } = antwoord;
  return !diff.overgeslagen && diff.toegevoegd.length + diff.gewijzigd.length + diff.verdwenen.length > 0;
}

/** Same rule for the leerplandoelen, over every discipline the apply would touch. */
export function schrijftLeerplandoelen(antwoord: LeerplandoelImportAntwoord): boolean {
  return antwoord.disciplines.some(({ diff }) => !diff.overgeslagen && teSchrijven(diff) > 0);
}

function teSchrijven(diff: OpstapHerimportDiff): number {
  return (
    diff.toegevoegd.length +
    diff.gewijzigd.length +
    diff.verdwenen.length +
    diff.verdwenenMaarGekoppeld.length +
    diff.hernummerd.length
  );
}
