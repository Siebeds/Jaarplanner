import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  genereerDoelsuggesties,
  haalDoelsuggesties,
  haalOngekoppeldeDoelen,
  vervangSuggestieDoel,
  wijzigSuggestieStatus,
} from "./api";
import type { Leerdoelselectie, Leerkrachtbeslissing } from "./types";

/** Query key for a thema's doelsuggesties — one cache entry per thema. */
const suggestiesKey = (themaId: string) => ["doelsuggesties", themaId] as const;

/** Query key for the school-wide "ongekoppelde doelen" gap list (E2-06). */
const ongekoppeldeDoelenKey = ["ongekoppelde-doelen"] as const;

/** Loads (and caches) the AI doelsuggesties for a thema; disabled until a thema-id is present. */
export function useDoelsuggesties(themaId: string) {
  return useQuery({
    queryKey: suggestiesKey(themaId),
    queryFn: () => haalDoelsuggesties(themaId),
    enabled: themaId.length > 0,
  });
}

/**
 * Loads (and caches) the "ongekoppelde doelen" gap list (E2-06, FR-4.4): the leerplandoelen not (yet)
 * linked to any thema. The server recomputes it from the current link state, so this query is the single
 * source of truth — it is never derived from local state. It updates as links change because
 * {@link useWijzigSuggestieStatus} invalidates its key after every teacher decision.
 */
export function useOngekoppeldeDoelen() {
  return useQuery({
    queryKey: ongekoppeldeDoelenKey,
    queryFn: () => haalOngekoppeldeDoelen(),
  });
}

/**
 * Mutation that records a teacher decision (accept/reject/adjust) on a suggestion and, on success,
 * invalidates the thema's suggestions so the list reflects the persisted status (Art. IV.2). It also
 * invalidates the "ongekoppelde doelen" gap list: accepting/adjusting a suggestion links its doel (or
 * rejecting one may unlink it), so the gap list must refetch to stay correct (FR-4.4 "updates as links
 * change"). The server is the source of truth in both cases.
 */
export function useWijzigSuggestieStatus(themaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { suggestieId: string; status: Leerkrachtbeslissing }) =>
      wijzigSuggestieStatus(themaId, vars.suggestieId, vars.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suggestiesKey(themaId) });
      void queryClient.invalidateQueries({ queryKey: ongekoppeldeDoelenKey });
    },
  });
}

/**
 * Triggers a match run for a thema (E2-08, FR-4.1) and refreshes the review list from the server.
 *
 * This is the wire the epic was missing: the review list, the accept/reject actions and the gap list all
 * existed, but nothing in the app could make a suggestion for them to show. The mutation's own `data`
 * carries the run report (what was proposed, what was skipped, how many leerplandoelen were searched)
 * while the rendered list comes from the invalidated query — deliberately not an optimistic update,
 * because the server decides what was actually persisted: a fabricated code is skipped, not invented.
 */
export function useGenereerDoelsuggesties(themaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (selectie?: Leerdoelselectie) =>
      genereerDoelsuggesties(themaId, selectie),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suggestiesKey(themaId) });
    },
  });
}

/**
 * Mutation for FR-4.3's "aanpassen": substitutes a different leerplandoel on a suggestion, which makes it
 * the teacher's own `Manueel` link. Invalidates both the thema's suggestions and the gap list, since a
 * `manueel` link counts as coupled (Art. V) and therefore removes its doel from "nog niet gekoppeld".
 */
export function useVervangSuggestieDoel(themaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { suggestieId: string; leerplandoelCode: string }) =>
      vervangSuggestieDoel(themaId, vars.suggestieId, vars.leerplandoelCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suggestiesKey(themaId) });
      void queryClient.invalidateQueries({ queryKey: ongekoppeldeDoelenKey });
    },
  });
}
