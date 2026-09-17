import type { Themaplaatsing } from "../../lib/types";

/**
 * The thema's a generation would replace (ADR-0055): a thema run whose parts are all open, unlocked proposals. A split
 * thema counts once, and one of which the teacher accepted a part stays whole, so it does not count.
 */
export function aantalOpenThemas(plaatsingen: Themaplaatsing[]): number {
  const reeksen = new Map<string, Themaplaatsing[]>();
  for (const p of plaatsingen) {
    const sleutel = p.reeks ? `${p.themaId}|${p.reeks.reeksVan}` : p.id;
    reeksen.set(sleutel, [...(reeksen.get(sleutel) ?? []), p]);
  }
  return [...reeksen.values()].filter((delen) => delen.every((p) => p.status === "Voorgesteld" && !p.vergrendeld))
    .length;
}
