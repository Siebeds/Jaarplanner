import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import type { LeerplandoelImportAntwoord, MinimumdoelImportAntwoord } from "./types";

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
 * Whether applying this report writes anything, as the server decides it (`diff.schrijftIets`). Only then is
 * *Doorvoeren* offered: a button that changes nothing is the control the E3-06 rule forbids.
 *
 * Not reconstructed from the buckets here. The first version did that and counted every `verdwenen` entry as a write,
 * while the server re-reported rows it had flagged long ago, so a repeat fetch of an unchanged source offered an apply
 * that set a flag that was already set (E1-22, antagonist round 1 MAJOR). One definition, server-side, is the fix.
 */
export function schrijftMinimumdoelen(antwoord: MinimumdoelImportAntwoord): boolean {
  return antwoord.diff.schrijftIets;
}

/**
 * The same for the leerplandoelen, as the server decides it (`schrijftIets`): a curriculum row, a reason per minimumdoel,
 * or a version other than the last one applied (a first apply included). Not counted: an Op.stap key stored on an
 * Excel-loaded row that is otherwise unchanged.
 */
export function schrijftLeerplandoelen(antwoord: LeerplandoelImportAntwoord): boolean {
  return antwoord.schrijftIets;
}
