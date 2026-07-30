import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { genereerJaarplan, haalJaarplan, haalRooster } from "./api";
import type { Generatieparameters } from "./types";

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
    // The parameters are passed at mutate() time rather than captured here, so the form's current value is what
    // gets sent and a stale closure cannot generate with the previous run's settings (E3-04, FR-5.4).
    mutationFn: (parameters?: Generatieparameters) => genereerJaarplan(klasId, parameters),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jaarplanKey(klasId) });
    },
  });
}
