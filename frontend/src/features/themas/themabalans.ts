import type { ThemaWeergave } from "../../lib/types";
import { beslist } from "./subthemabalans";

/**
 * How many doelen hang on a thema, at which of the three levels, and where the hole is.
 *
 * **This says nothing about dekking and must not be read as if it did.** A doel is *gedekt* when it
 * is linked AND the thema is placed in a plan (Art. V.1), and this screen knows nothing about any
 * plan. What it counts is links. The copy that renders it therefore says "gekoppeld", never
 * "gedekt", and the one figure that carries `attentie` is an activiteit with no link at all, which
 * is the only claim this data supports on its own: an activiteit with zero doelen can never
 * contribute to coverage whatever else happens to it.
 *
 * Summed from the thema the screen already holds rather than fetched. A second endpoint would be a
 * second thing that can disagree with the list rendered next to it.
 */
export interface Themabalans {
  /** The thema's own themadoelen: the minimumdoelen it aims at (Art. IX.2, FB-043). */
  themadoelen: number;
  /** Links on a subthema, one age's derivation of the thema. */
  subdoelen: number;
  /** Links on an individual activiteit. */
  activiteitdoelen: number;
  /** The three above, added up. What a delete of this thema would take with it. */
  totaal: number;
  activiteiten: number;
  /** Activiteiten carrying no doel at all. The gap a teacher is scanning for. */
  activiteitenZonderDoel: number;
}

export function themabalans(thema: ThemaWeergave): Themabalans {
  const themadoelen = thema.minimumdoelen.length;
  let subdoelen = 0;
  let activiteitdoelen = 0;
  let activiteiten = 0;
  let activiteitenZonderDoel = 0;

  for (const subthema of thema.subthemas) {
    subdoelen += subthema.subdoelen.length;
    for (const activiteit of subthema.activiteiten) {
      activiteiten += 1;
      // Decided doelen only: a proposal or a rejected doel is not linked (ADR-0053 D5).
      const gekoppeld = activiteit.doelkoppelingen.filter((k) => beslist(k.status)).length;
      activiteitdoelen += gekoppeld;
      if (gekoppeld === 0) activiteitenZonderDoel += 1;
    }
  }

  return {
    themadoelen,
    subdoelen,
    activiteitdoelen,
    totaal: themadoelen + subdoelen + activiteitdoelen,
    activiteiten,
    activiteitenZonderDoel,
  };
}
