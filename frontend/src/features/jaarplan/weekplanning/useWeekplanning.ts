import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  haalWeekplanning,
  planActiviteit,
  verplaatsActiviteit,
  verwijderActiviteitplaatsing,
} from "./api";
import type { Dagplanning, Dagwijziging, Weekplanning } from "./types";

/**
 * Server state for the week view inside a themaperiode (E9-04, FR-6.2/FR-7.2).
 *
 * **Deliberately its own query family, not part of `jaarplanKey`.** The two answer different questions over different
 * ranges: the jaarplan is one class's whole year of thema placements, this is one week of days. Sharing a key would mean
 * a scheduling edit invalidating the year board and a thema move refetching every open week.
 */

/** Query-key root, so a whole class's weeks can be dropped in one call. */
const WEEKPLANNING_KEY = ["weekplanning"] as const;

/** Query key for every week of one class. */
export const weekplanningKlasKey = (klasId: string) => [...WEEKPLANNING_KEY, klasId] as const;

/**
 * Query key for one range of one class.
 *
 * **The range is part of the key because it is part of the answer.** `/weekplanning?van=…&tot=…` returns exactly the
 * days asked for (clamped), so two ranges are two different responses; keyed on the class alone they would share one
 * cache entry and overwrite each other, and stepping back a week would always refetch instead of being instant. Same
 * reasoning as `roosterKey`'s tier in `useJaarplan`.
 */
const weekplanningKey = (klasId: string, van: string, tot: string) =>
  [...weekplanningKlasKey(klasId), van, tot] as const;

/**
 * One range of days with what is scheduled on them.
 *
 * `keepPreviousData` so stepping to the next week keeps the current grid on screen while the new one loads, instead of
 * collapsing to a spinner and back — the grid is the whole screen here, and a teacher stepping through five weeks would
 * otherwise watch it disappear five times.
 *
 * `enabled` is derived rather than asked for: with no class or no range there is nothing to fetch, and passing an empty
 * key would cache a response under a meaningless one.
 */
export function useWeekplanning(klasId: string | undefined, van: string, tot: string) {
  return useQuery({
    queryKey: weekplanningKey(klasId ?? "", van, tot),
    queryFn: () => haalWeekplanning(klasId!, van, tot),
    enabled: Boolean(klasId) && Boolean(van) && Boolean(tot),
    placeholderData: keepPreviousData,
  });
}

/**
 * The three scheduling edits, all sharing one rule: **the server's returned week replaces the cached one, and every
 * other cached week of this class is invalidated.**
 *
 * The first half is the kalender's own rule (`usePlanMutatie`): each endpoint answers with the whole affected week, so
 * the cache is written directly rather than refetched. That matters for a drag — an invalidation leaves a render in
 * which the card has been dropped but the grid still shows it on its old day, which reads as the drop having failed.
 *
 * **The second half is this feature's own, and it is not redundant.** A move can cross a week boundary, so the response
 * describes the *target* week while the *source* week is now stale and still cached under a different key. Writing only
 * the response would leave a teacher stepping back one week to an activiteit that is no longer there. Invalidating the
 * whole class rather than computing which two weeks changed is the cheap correct answer: at most a handful of weeks are
 * ever cached, and a rule nobody has to reason about cannot be got wrong.
 *
 * **Deliberately not optimistic**, for the reason E3-07 recorded: a placement can be refused (a closed day, a day
 * outside the school year, a duplicate, another class's activiteit), and this project's rule is that the application
 * never guesses where something went. Showing the card on the new day before the server agrees would be exactly that
 * guess.
 *
 * **No dekking cache is dropped here, and that absence is deliberate.** Art. V.1 makes a doel gedekt through the
 * *thema's* placement in the plan, so scheduling an activiteit onto a Tuesday cannot move a coverage figure — unlike
 * every one of the kalender's five placement edits, which all can and which therefore call `vergeetDekking`. Adding it
 * here would imply a relationship that does not exist, and would quietly suggest to the next reader that day-level
 * planning earns coverage.
 */
function useWeekMutatie<TArgs>(klasId: string, muteer: (args: TArgs) => Promise<Weekplanning>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: muteer,
    onSuccess: (week) => {
      queryClient.setQueryData(weekplanningKey(klasId, week.van, week.tot), week);
      void queryClient.invalidateQueries({ queryKey: weekplanningKlasKey(klasId) });
    },
  });
}

/** Schedules an activiteit onto a day (FR-7.2), persisted immediately (FR-6.5). */
export function usePlanActiviteit(klasId: string) {
  return useWeekMutatie<Dagplanning>(klasId, (planning) => planActiviteit(klasId, planning));
}

/** Moves a scheduled activiteit to another day or position (FR-6.2). Reversible; no confirmation belongs on it. */
export function useVerplaatsActiviteit(klasId: string) {
  return useWeekMutatie<{ plaatsingId: string; wijziging: Dagwijziging }>(klasId, ({ plaatsingId, wijziging }) =>
    verplaatsActiviteit(klasId, plaatsingId, wijziging),
  );
}

/**
 * Takes an activiteit off its day (FR-7.2).
 *
 * **Also the remediation three delete guards name** — an activiteit, a subthema and a thema all refuse deletion while
 * their activiteiten sit in the weekplanning, and all three messages send the teacher here.
 */
export function useVerwijderActiviteitplaatsing(klasId: string) {
  return useWeekMutatie<string>(klasId, (plaatsingId) =>
    verwijderActiviteitplaatsing(klasId, plaatsingId),
  );
}
