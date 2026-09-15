import type { Vertaalsleutel } from "../../i18n";
import { useRechten } from "../../lib/rechten";

/**
 * The parts of the Ontwikkelingsrapport destination, each at its own address (FB-002): the children of a klas, and the
 * one K3 set of rapportdoelen and sterrenschaal. The same shape as Instellingen's parts, one list for the switch and the
 * routes.
 *
 * **Only the children are behind the report's right** (R17). The set and the scale are no pupil data, and a directie or
 * a K3 hoofdleerkracht without a klas must be able to view them, also by address (FB-002 AC5), so those two parts are
 * shown to everyone who reaches the destination.
 */
export const RAPPORTDELEN = [
  { deel: "kinderen", labelSleutel: "ontwikkelingsrapport.kinderen", metKinderen: true },
  { deel: "rapportdoelen", labelSleutel: "ontwikkelingsrapport.rapportdoelen", metKinderen: false },
  { deel: "sterrenschaal", labelSleutel: "ontwikkelingsrapport.sterrenschaal", metKinderen: false },
] as const satisfies readonly { deel: string; labelSleutel: Vertaalsleutel; metKinderen: boolean }[];

export type Rapportdeel = (typeof RAPPORTDELEN)[number]["deel"];

export function rapportpad(deel: Rapportdeel): string {
  return `/ontwikkelingsrapport/${deel}`;
}

/** The parts this person may open, in order. The children only for whoever may read a report (D18). */
export function useZichtbareRapportdelen() {
  const { mag } = useRechten();
  return RAPPORTDELEN.filter((onderdeel) => !onderdeel.metKinderen || mag.ontwikkelingsrapportZien);
}
