import { apiFetch } from "../../lib/api";
import type {
  Doelsuggestie,
  Doelsuggestiegeneratie,
  Leerdoelselectie,
  Leerkrachtbeslissing,
  OngekoppeldDoel,
} from "./types";

/**
 * The matching feature's API calls (E2-05/E2-08, FR-4.1/4.3). Thin wrappers over {@link apiFetch};
 * caching and refetch-on-change are TanStack Query's job (see useDoelsuggesties). All mutations are
 * explicit teacher actions — nothing is auto-applied (Art. IV.1/IV.2).
 */

/** Lists the AI doelsuggesties persisted for a thema. */
export function haalDoelsuggesties(themaId: string): Promise<Doelsuggestie[]> {
  return apiFetch<Doelsuggestie[]>(`/api/themas/${themaId}/doelsuggesties`);
}

/**
 * Asks the AI which leerplandoelen fit this thema (E2-08, FR-4.1) and returns the run's outcome.
 *
 * Every suggestion lands as `Voorgesteld` with its motivation — advisory, never applied (Art. IV.1/IV.2) —
 * and a code already linked to the thema is skipped, so re-running is safe. `selectie` bounds which
 * leerplandoelen the model may choose from; omitting it searches everything that is loaded.
 *
 * A malformed AI response yields **422 with nothing persisted** (Art. IV.5), which surfaces here as an
 * `ApiError`. Its body is an English operator diagnostic and is never shown to a teacher: the UI branches
 * on the status and renders its own Dutch copy from `nl.json`.
 */
export function genereerDoelsuggesties(
  themaId: string,
  selectie?: Leerdoelselectie,
): Promise<Doelsuggestiegeneratie> {
  return apiFetch<Doelsuggestiegeneratie>(
    `/api/themas/${themaId}/doelsuggesties/genereer`,
    {
      method: "POST",
      body: JSON.stringify({ selectie: selectie ?? null }),
    },
  );
}

/** Lists the leerplandoelen not (yet) linked to any thema (E2-06, FR-4.4). */
export function haalOngekoppeldeDoelen(): Promise<OngekoppeldDoel[]> {
  return apiFetch<OngekoppeldDoel[]>(`/api/leerplandoelen/ongekoppeld`);
}

/** Records the teacher's decision on one suggestion; returns the updated suggestion. */
export function wijzigSuggestieStatus(
  themaId: string,
  suggestieId: string,
  status: Leerkrachtbeslissing,
): Promise<Doelsuggestie> {
  return apiFetch<Doelsuggestie>(
    `/api/themas/${themaId}/doelsuggesties/${suggestieId}/status`,
    {
      method: "PUT",
      body: JSON.stringify({ status }),
    },
  );
}

/**
 * FR-4.3's "aanpassen" (E2-08): couples a **different** leerplandoel in place of the suggested one. The
 * suggestion becomes `Manueel` — the teacher's own choice — and the AI motivation goes with the code it
 * described. A code the loaded Op.stap set does not carry, or one already linked to this thema, is
 * refused with a 400.
 */
export function vervangSuggestieDoel(
  themaId: string,
  suggestieId: string,
  leerplandoelCode: string,
): Promise<Doelsuggestie> {
  return apiFetch<Doelsuggestie>(
    `/api/themas/${themaId}/doelsuggesties/${suggestieId}/leerplandoel`,
    {
      method: "PUT",
      body: JSON.stringify({ leerplandoelCode }),
    },
  );
}
