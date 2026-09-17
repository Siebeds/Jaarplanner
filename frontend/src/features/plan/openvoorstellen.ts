import type { Themaplaatsing } from "../../lib/types";

/** The thema runs a generation would replace: open proposals that are not locked, a split thema counted once. */
export function aantalOpenThemas(plaatsingen: Themaplaatsing[]): number {
  const open = plaatsingen.filter((p) => p.status === "Voorgesteld" && !p.vergrendeld);
  return new Set(open.map((p) => (p.reeks ? `${p.themaId}|${p.reeks.reeksVan}` : p.id))).size;
}
