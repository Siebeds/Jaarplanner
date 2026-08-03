import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  genereerJaarplan,
  haalGeneratieparameters,
  haalJaarplan,
  haalRooster,
  verplaatsPlaatsing,
  verwijderPlaatsing,
  wijzigPlaatsingStatus,
  wijzigPlaatsingVergrendeling,
} from "./api";
import type { Generatieparameters, Jaarplan, Plaatsingstatus } from "./types";

/** Query key for one class's jaarplan. */
const jaarplanKey = (klasId: string) => ["jaarplan", klasId] as const;

/** Query key for the thema names the startthema pickers offer (E3-04). Named here with its siblings. */
export const themanamenKey = ["themanamen"] as const;

/** Query key for one class's kept pre-generation settings (E3-04). */
export const generatieparametersKey = (klasId: string) => ["generatieparameters", klasId] as const;

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
 * Loads the class's kept pre-generation settings (E3-04, FR-5.4), so the form shows what was last used.
 *
 * **Not gated on the panel being open**, unlike the thema picker. The settings are sent with every run and their
 * count appears in the collapsed summary, so a teacher who never opens the panel still needs them loaded: without
 * this they would generate with settings the screen had not mentioned.
 *
 * **`staleTime: Infinity` on purpose.** Nothing but this screen writes these settings, and the mutation below
 * refreshes them, so a refetch on window focus could only overwrite the teacher's half-finished edits with the
 * server's older copy.
 */
export function useGeneratieparameters(klasId: string) {
  return useQuery({
    queryKey: generatieparametersKey(klasId),
    queryFn: () => haalGeneratieparameters(klasId),
    enabled: klasId.length > 0,
    staleTime: Infinity,
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
    onSuccess: (_resultaat, parameters) => {
      void queryClient.invalidateQueries({ queryKey: jaarplanKey(klasId) });

      // The run also SAVED the settings (E3-04 persistence half), so the cached copy is now the stale one. Written
      // rather than invalidated: an invalidation would refetch and could land on the teacher's next keystroke,
      // resetting a field they had already started editing.
      if (parameters) {
        queryClient.setQueryData(generatieparametersKey(klasId), parameters);
      }
    },
  });
}

/**
 * The four placement edits (three from E3-07, the lock from E4-06), all sharing one rule: **the server's returned
 * plan replaces the cached one.**
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

/**
 * Locks or unlocks one placement against (re)generation (E4-06, FR-8.4, Art. IX.3).
 *
 * Its own mutation rather than a flag on the status one, because the two are different decisions with different
 * consequences: a status change records what the teacher thinks of the proposal, while the lock only says whether a
 * later run may replace it. Sharing a hook would also share `isPending`, so a card would report "Bezig…" on the wrong
 * control — E1-16's worst finding was exactly one boolean standing in for several distinct states.
 */
export function useWijzigVergrendeling(klasId: string) {
  return usePlanMutatie(
    klasId,
    ({ plaatsingId, vergrendeld }: { plaatsingId: string; vergrendeld: boolean }) =>
      wijzigPlaatsingVergrendeling(klasId, plaatsingId, vergrendeld),
  );
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
