import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  genereerJaarplan,
  haalJaarplan,
  haalRooster,
  verplaatsPlaatsing,
  verwijderPlaatsing,
  wijzigPlaatsingStatus,
} from "./api";
import type { Jaarplan, Plaatsingstatus } from "./types";

/** Query key for one class's jaarplan. */
const jaarplanKey = (klasId: string) => ["jaarplan", klasId] as const;

/** Query key for one school year's derived block grid. */
const roosterKey = (schooljaarId: string) => ["planningsrooster", schooljaarId] as const;

/** Loads a class's jaarplan; disabled until a class id is present. */
export function useJaarplan(klasId: string) {
  return useQuery({
    queryKey: jaarplanKey(klasId),
    queryFn: () => haalJaarplan(klasId),
    enabled: klasId.length > 0,
  });
}

/**
 * Loads the school year's block grid.
 *
 * The school year id comes from the jaarplan response rather than being asked of the caller, so this
 * query is chained behind it and stays disabled until that id is known. The grid is **derived**
 * server-side on every read, so it always reflects the current vakantiestructuur — which is exactly
 * why a placement can turn out stale (`isVervallen`) rather than the two views quietly disagreeing.
 */
export function usePlanningsrooster(schooljaarId: string | undefined) {
  return useQuery({
    queryKey: roosterKey(schooljaarId ?? ""),
    queryFn: () => haalRooster(schooljaarId!),
    enabled: Boolean(schooljaarId),
  });
}

/**
 * Triggers a generation run for a class (FR-5.1) and refreshes the plan from the server on success.
 *
 * The mutation's own `data` carries the run report — how many placements were added, what was skipped, and the
 * spreading measurement (E3-02) — while the rendered plan comes from the invalidated query. Deliberately not
 * an optimistic update: the server decides what was actually persisted (a returned thema the school does not
 * own is skipped, not invented), so guessing locally could show a teacher a placement that does not exist.
 */
export function useGenereerJaarplan(klasId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => genereerJaarplan(klasId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jaarplanKey(klasId) });
    },
  });
}

/**
 * The three E3-07 edits, all sharing one rule: **the server's returned plan replaces the cached one.**
 *
 * Each endpoint answers with the whole updated jaarplan, so the cache is written directly rather than
 * invalidated-and-refetched. That matters for a drag: an invalidation leaves a render in which the card has
 * been dropped but the board still shows it in its old column, which reads as the drop having failed.
 *
 * **Deliberately not optimistic.** A move can be refused (a date that is no longer a period boundary, a thema
 * already in the target period), and this project's rule is that the application never guesses where a thema
 * went. Showing the card in the new column before the server agrees would be exactly that guess, and if the
 * call then failed the teacher would have watched a move that did not happen.
 */
function usePlanMutatie<TArgs>(klasId: string, muteer: (args: TArgs) => Promise<Jaarplan>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: muteer,
    onSuccess: (plan) => {
      queryClient.setQueryData(jaarplanKey(klasId), plan);
    },
  });
}

/** Moves one placement to the period starting on `blokStart` (FR-6.2), persisted immediately (FR-6.5). */
export function useVerplaatsPlaatsing(klasId: string) {
  return usePlanMutatie(klasId, ({ plaatsingId, blokStart }: { plaatsingId: string; blokStart: string }) =>
    verplaatsPlaatsing(klasId, plaatsingId, blokStart),
  );
}

/** Takes one thema out of its period (FR-7). Unrecoverable, so the UI confirms first. */
export function useVerwijderPlaatsing(klasId: string) {
  return usePlanMutatie(klasId, (plaatsingId: string) => verwijderPlaatsing(klasId, plaatsingId));
}

/** Records a teacher decision on one placement; E3-07 uses it to reverse a rejection (Art. IV.2). */
export function useWijzigPlaatsingStatus(klasId: string) {
  return usePlanMutatie(
    klasId,
    ({
      plaatsingId,
      status,
    }: {
      plaatsingId: string;
      status: Exclude<Plaatsingstatus, "Voorgesteld">;
    }) => wijzigPlaatsingStatus(klasId, plaatsingId, status),
  );
}
