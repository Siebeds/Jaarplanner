import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  haalDoelsuggesties,
  haalOngekoppeldeDoelen,
  wijzigSuggestieStatus,
} from "./api";
import type { Leerkrachtbeslissing } from "./types";

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
