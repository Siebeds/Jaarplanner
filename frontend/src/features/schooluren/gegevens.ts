import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, put } from "../../lib/api";

/**
 * The school's hours per weekday (FB-023, ADR-0038), read by the agenda and by Instellingen, written by directie.
 *
 * **A feature module of its own**, like `hoeken/gegevens.ts`, because two screens depend on it and neither owns it:
 * Instellingen sets the hours, the agenda draws them.
 *
 * **Nothing here invalidates `dekking`.** An hour of the school day links no goal, so no coverage figure can move.
 */

/** One weekday's hours. Mirrors `SchooldagurenWeergave` on the server. */
export interface Schooldaguren {
  /** ISO: 1 is Monday, 5 is Friday. The weekend never has hours. */
  weekdag: number;
  /** `HH:mm:ss`, as the server sends a TimeOnly. */
  begin: string;
  einde: string;
  /** Both set, or both null on a day without one (a Wednesday with no afternoon). */
  middagpauzeBegin: string | null;
  middagpauzeEinde: string | null;
}

/** The weekdays that have hours, Monday first. A weekday without hours is absent. */
export interface Schooluren {
  dagen: Schooldaguren[];
}

const SLEUTEL = ["schooluren"] as const;

/** One set for the school (owner, 2026-09-15), so no klas or schooljaar in the key. */
export function useSchooluren() {
  return useQuery({
    queryKey: SLEUTEL,
    queryFn: () => get<Schooluren>("/api/schooluren"),
  });
}

/**
 * Replaces the whole set: a weekday left out has no hours afterwards. The answer is written straight into the cache,
 * so an agenda open in the background draws the new hours without a second request.
 */
export function useBewaarSchooluren() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (invoer: Schooluren) => put<Schooluren>("/api/schooluren", invoer),
    onSuccess: (antwoord) => qc.setQueryData(SLEUTEL, antwoord),
  });
}
