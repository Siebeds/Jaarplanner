import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import {
  genereerJaarplan,
  haalGeneratieparameters,
  haalJaarplan,
  haalRooster,
  haalThemanamen,
  verplaatsPlaatsing,
  verwijderPlaatsing,
  voegPlaatsingToe,
  wijzigPlaatsingStatus,
  wijzigPlaatsingVergrendeling,
} from "./api";
import { dekkingKlasKey } from "../dekking/useDekking";
import type {
  Generatieparameters,
  Jaarplan,
  Plaatsingstatus,
  Planningsblokniveau,
} from "./types";

/** Query key for one class's jaarplan. */
const jaarplanKey = (klasId: string) => ["jaarplan", klasId] as const;

/** Query key for the thema names the startthema pickers offer (E3-04). Named here with its siblings. */
export const themanamenKey = ["themanamen"] as const;

/** Query key for one class's kept pre-generation settings (E3-04). */
export const generatieparametersKey = (klasId: string) => ["generatieparameters", klasId] as const;

/**
 * Query key for one school year's derived block grid, **per tier** (E3-08).
 *
 * The tier is part of the key because it is part of the answer: `/rooster?niveau=…` re-derives the whole grid, so
 * the two tiers are two different responses. Keyed on the school year alone, they would share one cache entry and
 * overwrite each other: switching the zoom would render the *other* grain's blocks for a moment, and switching back
 * would always refetch instead of being instant. Which is also how the story's own criterion is met — "level
 * switching works without losing state" is exactly both tiers staying cached.
 */
const roosterKey = (schooljaarId: string, niveau: Planningsblokniveau) =>
  ["planningsrooster", schooljaarId, niveau] as const;

/**
 * Forgets everything cached about this class's dekking, because the plan it was computed from has just changed
 * (E4-01, FR-6.5/FR-7, Art. V.1).
 *
 * **Removed rather than invalidated, and the difference is the whole point.** An invalidation would only mark the
 * entry stale and leave the pre-edit answer in the cache.
 *
 * *The original reasoning here added "the dekkingsoverzicht is a different route, so while a teacher edits the kalender
 * that query has no observer", and **E3-09 made that half false** (merge, 2026-08-05): the kalender now runs its own
 * `useDekking` for the knelpunt line that states how many leerplandoelen the plan does not yet cover. The **choice is
 * unchanged and is now load-bearing on two screens instead of one**, but the consequence is new and visible: a plan
 * edit drops an **active** query, so that line briefly disappears and returns with the new figure rather than showing
 * the old one. That is the same trade this function was written to make, applied where a teacher can actually watch it,
 * and it is why the kalender latches `beschikbareJaarFasen` instead of reading it off the current answer.* TanStack would then paint that answer the moment the teacher opens
 * `/dekking` and refetch behind it, so for the length of one request the screen would show a coverage figure computed
 * *before* the edit, with no loading state to say so. For a figure a directie may put in front of an inspectie that
 * is the one failure this screen must not have, and if the refetch then fails the stale number stays on screen beside
 * the error. Removing it means the page has nothing to paint and shows its own "laden" line instead.
 *
 * It is also the choice the screen already made for itself: `DekkingPagina` deliberately renders `isPending` on a
 * scope switch rather than keeping the previous figures, because a total computed over another denominator is worse
 * than a pause. A total computed over another *plan* is the same mistake with the same cost.
 *
 * The server needs no counterpart: dekking is computed on every read and never stored (Art. V.1), so there is nothing
 * to invalidate behind the API. This function exists purely because the browser is allowed to remember.
 */
function vergeetDekking(queryClient: QueryClient, klasId: string) {
  queryClient.removeQueries({ queryKey: dekkingKlasKey(klasId) });
}

/** Loads a class's jaarplan; disabled until a class id is present. */
export function useJaarplan(klasId: string) {
  return useQuery({
    queryKey: jaarplanKey(klasId),
    queryFn: () => haalJaarplan(klasId),
    enabled: klasId.length > 0,
  });
}

/**
 * Loads the school year's block grid at one tier (E3-08, FR-6.3).
 *
 * The school year id comes from the jaarplan response rather than being asked of the caller, so this
 * query is chained behind it and stays disabled until that id is known. The grid is **derived**
 * server-side on every read, so it always reflects the current vakantiestructuur — which is exactly
 * why a placement can turn out stale (`isVervallen`) rather than the two views quietly disagreeing.
 *
 * **`keepPreviousData` is load-bearing, not a nicety.** The kalender returns a single "Jaarplan laden…" line while
 * this query is pending, so a tier switch with no placeholder would tear the whole screen down and back up — which
 * unmounts `Generatieparametersformulier` and therefore drops the teacher's unsent parameter edits, exactly the
 * state the story says must survive a switch. With the previous grid held on screen for the one request, nothing
 * unmounts; the board simply changes grain when the answer lands. The first load has no previous data, so it still
 * shows the loading line.
 */
export function usePlanningsrooster(
  schooljaarId: string | undefined,
  niveau: Planningsblokniveau,
) {
  return useQuery({
    queryKey: roosterKey(schooljaarId ?? "", niveau),
    queryFn: () => haalRooster(schooljaarId!, niveau),
    enabled: Boolean(schooljaarId),
    placeholderData: keepPreviousData,
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

      // A run replaces the replaceable placements, so whatever dekking was last computed for this class describes a
      // plan that no longer exists.
      vergeetDekking(queryClient, klasId);

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
 * Loads the school's thema-bibliotheek, gated on a caller actually needing it (E4-03).
 *
 * Shared with `Generatieparametersformulier`'s startthema picker through {@link themanamenKey}, so the two hold one
 * cache entry rather than two copies of the same list. `enabled` is the caller's, because both consumers are behind a
 * disclosure: fetching this on every load of the anchor screen, for panels most teachers never open, would spend a
 * request on nothing.
 */
export function useThemanamen(enabled: boolean) {
  return useQuery({
    queryKey: themanamenKey,
    queryFn: haalThemanamen,
    enabled,
  });
}

/**
 * The five placement edits (three from E3-07, the lock from E4-06, the hand-placement from E4-03), all sharing one
 * rule: **the server's returned plan replaces the cached one.**
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

      // Every one of the five edits can change the figure: a hand-placement and an acceptance raise it, a removal
      // lowers it, a move raises it (the placement becomes `manueel`, which counts), and resolving a stale placement
      // releases a figure that was being withheld altogether. The lock is the one that cannot, and it shares this
      // path deliberately: a hook that dropped the cache for four of five edits would be a rule nobody could state.
      vergeetDekking(queryClient, klasId);
    },
  });
}

/**
 * Puts a thema in a period by hand, with no AI involved (E4-03, FR-7.2), persisted immediately (FR-7).
 *
 * Shares {@link usePlanMutatie}, so the server's returned plan replaces the cached one and the new card appears in
 * the column in the same render the picker closes. Not optimistic, for the reason given there: the plan the server
 * answers with is the only one that exists, and a card shown before it agrees is a guess.
 */
export function useVoegPlaatsingToe(klasId: string) {
  return usePlanMutatie(klasId, ({ themaId, blokStart }: { themaId: string; blokStart: string }) =>
    voegPlaatsingToe(klasId, themaId, blokStart),
  );
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

/**
 * Records a teacher decision on one placement (Art. IV.2).
 *
 * E3-07 called it for exactly one status, `Manueel`, to reverse a rejection, which left `Aanvaard` and `Geweigerd`
 * unreachable and the kalender without any decision surface at all. **E4-02** sends all three; see the note on
 * {@link Themakaart}. The hook is instantiated once per card and shared with its panel, because one placement has
 * one status.
 */
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
