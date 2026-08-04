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
const dekkingKey = (klasId: string, bereik: Dekkingsbereik) => ["dekking", klasId, bereik] as const;

export function useDekking(klasId: string, bereik: Dekkingsbereik) {
  return useQuery({
    queryKey: dekkingKey(klasId, bereik),
    queryFn: () => haalDekking(klasId, bereik),
    // No class chosen means there is nothing to ask about. Without this the screen would fire
    // `/api/klassen//dekking` on first paint and render its error state at a teacher who has simply not picked a
    // class yet, which is a different message (see DekkingPagina's three-valued selection handling).
    enabled: Boolean(klasId),
  });
}
