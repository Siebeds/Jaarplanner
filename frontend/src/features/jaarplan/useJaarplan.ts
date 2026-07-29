import { useQuery } from "@tanstack/react-query";

import { haalJaarplan, haalRooster } from "./api";

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
