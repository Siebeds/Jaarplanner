import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DEKKING_KEY } from "../dekking/useDekking";
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

/**
 * Query key for the school-wide "ongekoppelde doelen" gap list (E2-06).
 *
 * **Exported because a second feature has to invalidate it (E1-14).** Linking a leerplandoel by hand from the
 * beheer screens changes this list exactly as accepting a suggestion does, so the beheer mutations invalidate
 * it too. Sharing the constant rather than repeating the string is deliberate: two literals that must match
 * are two literals that will stop matching, and the failure is silent — a stale gap list still renders.
 */
export const ONGEKOPPELDE_DOELEN_KEY = ["ongekoppelde-doelen"] as const;

/** Local alias, so the call sites below read as they did before the key was exported. */
const ongekoppeldeDoelenKey = ONGEKOPPELDE_DOELEN_KEY;

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
 *
 * **It also drops the dekking cache (E4-01).** An accepted or adjusted suggestion is a counted `DoelKoppeling`
 * (Art. V.1), so this decision moves the coverage figure of every class whose plan holds this thema. The whole
 * `["dekking"]` subtree goes, not one class's: a thema is school-wide. Dropped rather than invalidated because an
 * invalidated entry is still painted while its refetch runs, so `/dekking` would open on a figure from before the
 * decision; see {@link DEKKING_KEY}.
 */
export function useWijzigSuggestieStatus(themaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { suggestieId: string; status: Leerkrachtbeslissing }) =>
      wijzigSuggestieStatus(themaId, vars.suggestieId, vars.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suggestiesKey(themaId) });
      void queryClient.invalidateQueries({ queryKey: ongekoppeldeDoelenKey });
      queryClient.removeQueries({ queryKey: DEKKING_KEY });
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
 *
 * It drops the dekking cache for the same reason as {@link useWijzigSuggestieStatus}, and here the figure moves
 * **twice**: the substituted doel stops being covered by this thema and the new one starts.
 */
export function useVervangSuggestieDoel(themaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { suggestieId: string; leerplandoelCode: string }) =>
      vervangSuggestieDoel(themaId, vars.suggestieId, vars.leerplandoelCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: suggestiesKey(themaId) });
      void queryClient.invalidateQueries({ queryKey: ongekoppeldeDoelenKey });
      queryClient.removeQueries({ queryKey: DEKKING_KEY });
    },
  });
}
