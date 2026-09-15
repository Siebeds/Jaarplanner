import type { AlgemeneFicheWeergave, AlgemeneFicheplaatsingWeergave } from "../algemene-fiches/gegevens";
import type { Tijddoel } from "./Tijdraster";

/** One of the sentences that say what else goes when a block leaves its day. */
export type Gevolg = "blokmenu.tekstGaatMee" | "blokmenu.laatsteDag" | "blokmenu.enigePeriode";

/**
 * What taking one block off its day costs beyond the block itself (TB-030), as the sentences that say so, in the order
 * they are read. Empty when nothing else goes, and then the block goes at once: the owner asked for a question only when
 * something is lost (2026-09-15).
 *
 * **Each sentence is shown only where its own condition holds** (the catalogue's rule for conditional copy):
 * - the day text, only when this occurrence has one;
 * - the whole period, only when this is its one remaining day, since the server then removes the placement too;
 * - dekking, only on top of that, and only for a fiche with goals whose only placement this is: the case in which the
 *   fiche stops counting (Art. V.1 as amended), the same condition the fiche's own sheet uses.
 *
 * An activiteit loses nothing but itself, as its sheet's bin already assumes. A placement the lists do not hold (a
 * refetch mid-flight) answers nothing extra rather than guess.
 */
export function gevolgVanDag(
  doel: Tijddoel,
  lijsten: {
    fichePlaatsingen: readonly AlgemeneFicheplaatsingWeergave[];
    fiches: readonly AlgemeneFicheWeergave[];
  },
): Gevolg[] {
  if (doel.soort === "activiteit") return [];

  const plaatsing = lijsten.fichePlaatsingen.find((p) => p.id === doel.plaatsingId);
  if (!plaatsing) return [];
  const moment = plaatsing.momenten.find((m) => m.id === doel.momentId);
  const laatste = plaatsing.momenten.length === 1;
  const fiche = lijsten.fiches.find((f) => f.id === plaatsing.algemeneFicheId);

  const gevolgen: Gevolg[] = [];
  if (moment?.tekst) gevolgen.push("blokmenu.tekstGaatMee");
  if (laatste) gevolgen.push("blokmenu.laatsteDag");
  if (laatste && fiche !== undefined && fiche.aantalPlaatsingen === 1 && fiche.doelen.length > 0) {
    gevolgen.push("blokmenu.enigePeriode");
  }
  return gevolgen;
}
