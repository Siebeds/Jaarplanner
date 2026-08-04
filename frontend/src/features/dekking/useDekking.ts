import { useQuery } from "@tanstack/react-query";

import { haalDekking } from "./api";
import type { Dekkingsbereik } from "./types";

/**
 * Server state for the dekkingsoverzicht (E5-02, ADR-0014: TanStack Query owns it).
 *
 * **The scope is part of the query key, not a filter over one cached answer.** Two scopes are two different
 * computations with two different denominators, so caching them under one key would show a teacher L3's rows beside
 * the whole curriculum's total for as long as the stale answer lived. Same reasoning as the kalender's tier
 * (`roosterKey`), and the same mistake is available here.
 *
 * **No `staleTime`, deliberately.** E5-02's acceptance criterion is that the view matches the plan state live, and
 * every accept, reject, drag and vakantie edit changes the answer. Dekking is recomputed server-side on every read
 * (Art. V.1), so a fresh fetch is the whole mechanism: caching it for minutes would reintroduce exactly the stale
 * figure that Art. V.1's "computed, never stored" exists to prevent. Contrast the register's facets, which cache for
 * five minutes because the curriculum only changes on an import.
 */
/**
 * Everything cached about one class's dekking, whatever scope or narrowing it was asked under (E4-01).
 *
 * Exported because a **plan edit invalidates every one of those answers at once**: a placement that appears, moves,
 * is decided on or is removed changes the numerator of each scope the teacher happens to have opened. The kalender's
 * mutations therefore drop this whole subtree rather than enumerating `(bereik, jaarFase)` pairs they cannot know.
 * Owned here and imported there, so the string `"dekking"` exists once, following the precedent in
 * `themas/useThemas.ts`, which reaches for `matching`'s key for the same reason.
 */
export const dekkingKlasKey = (klasId: string) => ["dekking", klasId] as const;

const dekkingKey = (klasId: string, bereik: Dekkingsbereik, jaarFase: string | null) =>
  [...dekkingKlasKey(klasId), bereik, jaarFase] as const;

export function useDekking(klasId: string, bereik: Dekkingsbereik, jaarFase: string | null) {
  return useQuery({
    // `jaarFase` is part of the key for the same reason `bereik` is: narrowing changes the DENOMINATOR, so two
    // narrowings are two computations and caching them together would show one scope's rows beside another's total.
    queryKey: dekkingKey(klasId, bereik, jaarFase),
    queryFn: () => haalDekking(klasId, bereik, jaarFase),
    // No class chosen means there is nothing to ask about. Without this the screen would fire
    // `/api/klassen//dekking` on first paint and render its error state at a teacher who has simply not picked a
    // class yet, which is a different message (see DekkingPagina's three-valued selection handling).
    enabled: Boolean(klasId),
  });
}
