import { apiFetch } from "../../lib/api";
import type { Dekking, Dekkingsbereik } from "./types";

/**
 * The dekkingsoverzicht's one API call (E5-02, FR-9.1). Read-only by construction: dekking is computed, never
 * stored (Art. V.1), so this feature has nothing to write.
 */

/**
 * One class's coverage, measured against `bereik`.
 *
 * **The scope is always passed explicitly, never left to the endpoint's default.** The endpoint does default to
 * `EigenJaarFase`, and relying on that is how the generation parameter form ended up correct by coincidence
 * (E3-08's note on `haalRooster`). It matters more here than there: the scope is part of what the answer *means*,
 * because the same class has two legitimate denominators, so a request that does not state it produces a figure the
 * screen cannot label.
 */
export function haalDekking(klasId: string, bereik: Dekkingsbereik): Promise<Dekking> {
  return apiFetch<Dekking>(
    `/api/klassen/${klasId}/dekking?bereik=${encodeURIComponent(bereik)}`,
  );
}
