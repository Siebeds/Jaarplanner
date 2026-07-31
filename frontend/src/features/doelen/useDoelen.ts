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

/** Query key for the filter vocabulary — one entry, it does not depend on the filter. */
const facettenKey = ["doelen-facetten"] as const;

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
 * The filter vocabulary and the unfiltered total. Loaded once alongside the list: the list alone cannot tell
 * an empty curriculum from an over-narrow filter, and giving a teacher the wrong one of those two messages
 * sends them looking for a problem that is not there.
 */
export function useDoelenFacetten() {
  return useQuery({
    queryKey: facettenKey,
    queryFn: haalDoelenFacetten,
    // The curriculum only changes on an import, so this does not need refetching while a teacher browses.
    staleTime: 5 * 60 * 1000,
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
