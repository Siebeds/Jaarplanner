import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { PAGINA_GROOTTE, haalDoelDetail, haalDoelen, haalDoelenFacetten } from "./api";
import type { Doelenfilter } from "./types";

/**
 * Server state for the Doelen register (E1-16, ADR-0014: TanStack Query owns it).
 *
 * The register is paged with {@link useInfiniteQuery} rather than by re-requesting a growing page: "meer
 * laden" must fetch the *next* 50 rows, not re-fetch 50 + 50. Growing an `aantal` parameter instead would
 * re-download everything already on screen every time, which is exactly the volume mistake the story warns
 * against, only moved one layer up.
 */

/** Query key for one filtered register view; the filter is part of the key so each view caches separately. */
const doelenKey = (filter: Doelenfilter) => ["doelen", filter] as const;

/**
 * Query key for the filter vocabulary. It **does** depend on the filter now: the option counts are scoped to it
 * (see {@link useDoelenFacetten}), so a single cache entry would serve one filter's numbers to another.
 */
const facettenKey = (filter: Doelenfilter) => ["doelen-facetten", filter] as const;

/** Query key for one doel's detail. */
const doelKey = (code: string) => ["doel", code] as const;

/**
 * The filtered, paged register. `fetchNextPage` loads the next 50 rows; `hasNextPage` is derived from the
 * server's total, so the action disappears exactly when the last row is on screen.
 */
export function useDoelen(filter: Doelenfilter) {
  return useInfiniteQuery({
    queryKey: doelenKey(filter),
    queryFn: ({ pageParam }) => haalDoelen(filter, pageParam),
    initialPageParam: 0,
    getNextPageParam: (laatste, _paginas, laatsteOffset) => {
      const geladen = laatsteOffset + laatste.regels.length;
      return geladen < laatste.totaal ? geladen : undefined;
    },
  });
}

/**
 * The filter vocabulary, its filter-scoped counts, and the unfiltered total. Loaded alongside the list: the
 * list alone cannot tell an empty curriculum from an over-narrow filter, and giving a teacher the wrong one of
 * those two messages sends them looking for a problem that is not there.
 *
 * `placeholderData` keeps the **previous** filter's vocabulary on screen while the next one loads, so changing a
 * filter does not blank the controls a teacher is in the middle of using. It is also what keeps
 * `totaalAantalDoelen` continuously available: without it, every filter change made the register momentarily
 * unable to say whether any curriculum is loaded, which is exactly the state that used to render as "nothing
 * imported" (antagonist finding 1). The four-state derivation in `DoelenPagina` handles the genuine
 * first-load case; this makes sure that case happens once rather than on every keystroke.
 */
export function useDoelenFacetten(filter: Doelenfilter) {
  return useQuery({
    queryKey: facettenKey(filter),
    queryFn: () => haalDoelenFacetten(filter),
    // The curriculum only changes on an import, so a given filter's facets do not need refetching while a
    // teacher browses.
    staleTime: 5 * 60 * 1000,
    placeholderData: (vorige) => vorige,
  });
}

/** One doel in full; disabled until a code is selected. A 404 surfaces as an error the pane names honestly. */
export function useDoelDetail(code: string | undefined) {
  return useQuery({
    queryKey: doelKey(code ?? ""),
    queryFn: () => haalDoelDetail(code!),
    enabled: Boolean(code),
    // A mistyped deep link is a 404, and retrying it three times only delays the honest answer.
    retry: false,
  });
}

export { PAGINA_GROOTTE };
