import { apiFetch } from "../../lib/api";
import type {
  Doelsuggestie,
  Leerkrachtbeslissing,
  OngekoppeldDoel,
} from "./types";

/**
 * The matching feature's API calls (E2-05, FR-4.3). Thin wrappers over {@link apiFetch}; caching and
 * refetch-on-change are TanStack Query's job (see useDoelsuggesties). All mutations are explicit
 * teacher actions — nothing is auto-applied (Art. IV.1/IV.2).
 */

/** Lists the AI doelsuggesties persisted for a thema. */
export function haalDoelsuggesties(themaId: string): Promise<Doelsuggestie[]> {
  return apiFetch<Doelsuggestie[]>(`/api/themas/${themaId}/doelsuggesties`);
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
