import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { haalDoelsuggesties, wijzigSuggestieStatus } from "./api";
import type { Leerkrachtbeslissing } from "./types";

/** Query key for a thema's doelsuggesties — one cache entry per thema. */
const suggestiesKey = (themaId: string) => ["doelsuggesties", themaId] as const;

/** Loads (and caches) the AI doelsuggesties for a thema; disabled until a thema-id is present. */
export function useDoelsuggesties(themaId: string) {
  return useQuery({
    queryKey: suggestiesKey(themaId),
    queryFn: () => haalDoelsuggesties(themaId),
    enabled: themaId.length > 0,
  });
}

/**
 * Mutation that records a teacher decision (accept/reject/adjust) on a suggestion and, on success,
 * invalidates the thema's suggestions so the list reflects the persisted status (Art. IV.2). This is
 * what makes the change survive across the app — the server is the source of truth.
 */
export function useWijzigSuggestieStatus(themaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { suggestieId: string; status: Leerkrachtbeslissing }) =>
      wijzigSuggestieStatus(themaId, vars.suggestieId, vars.status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: suggestiesKey(themaId) }),
  });
}
