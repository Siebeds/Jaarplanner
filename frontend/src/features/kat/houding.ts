import type { Dekkingsvoortgang } from "../../lib/types";
import type { Deurmat, Deurmatsignaal } from "./gegevens";

/**
 * Chuck's posture is his status (ADR-0059 K5, FB-071). It is derived from the deurmat and the dekking, never kept as
 * state of its own, so it cannot say something the signal layer no longer says.
 *
 * - `gevaar`: a goal of a klas is at risk (FB-069). He lies on the corner of the week strip, or, on a screen without
 *   one, in his basket with his ears up; either way he says which goal.
 * - `klaar`: something is waiting for her on the deurmat. Ears up, and he says so.
 * - `spint`: nothing is waiting, and every minimumdoel of the klas is gedekt or in the dekkingsprognose.
 * - `slaapt`: none of the above.
 */
export type Houdingsoort = "slaapt" | "klaar" | "gevaar" | "spint";

export type Houding = {
  soort: Houdingsoort;
  /** The signal he speaks about while `gevaar`: a goal at risk before a subthema not planned. */
  gevaar: Deurmatsignaal | null;
  /** Everything on the deurmat, which is what the window lists. */
  aantal: number;
};

const GEVAAR_VOLGORDE = ["MinimumdoelInGevaar", "SubthemaNietGepland"] as const;

/** Every minimumdoel of the klas is gedekt or in the prognose. Never on a withheld or an empty figure. */
export function alleMinimumdoelenInPrognose(voortgang: Dekkingsvoortgang | undefined): boolean {
  if (!voortgang || !voortgang.isBetrouwbaar || voortgang.aantalMinimumdoelen === 0) return false;
  const gedekt = voortgang.aantalMinimumdoelenGedekt;
  const inPrognose = voortgang.aantalMinimumdoelenInPrognose;
  if (gedekt == null || inPrognose == null) return false;
  return gedekt + inPrognose === voortgang.aantalMinimumdoelen;
}

/**
 * @param voorkeurKlasId The klas on screen. Of several goals at risk he speaks about one in that klas first, so the
 *   week strip he lies on is the one his sentence is about.
 */
export function bepaalHouding(
  deurmat: Deurmat | undefined,
  voortgang: Dekkingsvoortgang | undefined,
  voorkeurKlasId: string | null = null,
): Houding {
  const signalen = deurmat?.signalen ?? [];
  const aantal = signalen.length + (deurmat?.voorstellen.length ?? 0);

  const gevaren = GEVAAR_VOLGORDE.flatMap((soort) => signalen.filter((s) => s.soort === soort));
  const gevaar = gevaren.find((s) => s.klasId === voorkeurKlasId) ?? gevaren[0];
  if (gevaar) return { soort: "gevaar", gevaar, aantal };
  if (aantal > 0) return { soort: "klaar", gevaar: null, aantal };
  if (alleMinimumdoelenInPrognose(voortgang)) return { soort: "spint", gevaar: null, aantal };
  return { soort: "slaapt", gevaar: null, aantal };
}

/** The CSS class of a posture on the drawing (`chuck.css`). */
export function houdingklasse(soort: Houdingsoort) {
  return `houding-${soort}`;
}
