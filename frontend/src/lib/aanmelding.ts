import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "./api";

/**
 * Who is signed in, and signing out (E6-01, ADR-0031). Kept apart from `queries.ts` because it is
 * not school data: it belongs to the session, and nothing a teacher edits ever invalidates it.
 */

/** The person behind the session, as `GET /api/ik` returns them. */
export interface Ik {
  id: string;
  naam: string;
  email: string;
  isDirectie: boolean;
}

/**
 * The signed-in person. Never stale while the page lives: a session does not change owner, and
 * a person directie removes gets a 401 on their next request, which sends them to the sign-in.
 * No retry: a failure here is either that 401 or a server that is down, and neither improves by
 * asking twice.
 */
export function useIk() {
  return useQuery({
    queryKey: ["ik"],
    queryFn: () => get<Ik>("/api/ik"),
    staleTime: Infinity,
    retry: false,
  });
}

/** The address that starts a sign-in and returns to `terugNaar` afterwards. */
export function aanmeldAdres(terugNaar = "/"): string {
  return `/api/aanmelden?terugNaar=${encodeURIComponent(terugNaar)}`;
}

/**
 * Signs out, then sends the browser where the API says: the Microsoft sign-out, so the Microsoft
 * session ends too and the next teacher at a shared computer is not signed in as this one.
 *
 * The cache is cleared first, so nothing of this person's data is left in memory for the moment
 * before the page goes.
 */
export function useAfmelden() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => post<{ doorsturenNaar: string }>("/api/afmelden"),
    onSuccess: ({ doorsturenNaar }) => {
      queryClient.clear();
      afmeldNavigatie.gaNaar(doorsturenNaar);
    },
  });
}

/** The navigation after a sign-out, replaceable in a test because jsdom cannot navigate. */
export const afmeldNavigatie = {
  gaNaar(adres: string): void {
    window.location.assign(adres);
  },
};
