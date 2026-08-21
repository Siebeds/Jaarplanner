import { useMutation, useQueryClient } from "@tanstack/react-query";

import { vernieuwDekking } from "../dekking/useDekking";

import {
  importeerOpstap,
  importeerSchoolcontent,
  voorbeeldOpstap,
  voorbeeldSchoolcontent,
} from "./api";
import type { OpstapInvoer, SchoolcontentInvoer } from "./api";

/**
 * Server state for the two importers (E1-13, ADR-0014).
 *
 * **Four mutations and no queries.** An import has nothing to read: the screen holds no server state of its
 * own, only the outcome of the last thing the reader did. That is why the preview is a *mutation* even though
 * it writes nothing — it is an action with a result, not a resource with a URL, and modelling it as a query
 * would make TanStack free to refetch it (on window focus, on a remount) against a `File` handle whose
 * meaning had moved on.
 *
 * **A commit invalidates everything.** Deliberately blunt: one import can add or update thema's, subthema's,
 * activiteiten, themadoelen and goal-link statuses, and on the curriculum side every leerplandoel. Those feed
 * the doelen register, the thema list, the doelsuggesties, the gap list and the jaarplan's thema picker, so
 * enumerating the affected keys here would be a list to keep in sync with five features. A commit is a rare,
 * deliberate act, so refetching what is mounted costs one round of requests and cannot go stale.
 *
 * **Except the dekking queries, which are DROPPED rather than invalidated (E4-01, round-2 audit MAJOR 2).** An
 * invalidated entry keeps its data, so TanStack paints it on the next mount and refetches behind it: a teacher who had
 * `/dekking` open, imports a file and walks back through the nav would read a figure computed before the import, with
 * no loading state to say so. An import is the write in this app that can move that figure furthest in one action,
 * because it writes both sides of it: counted `DoelKoppeling`s (the numerator) and, on the curriculum side, every
 * leerplandoel (the denominator). Art. V.2 is why the direction matters: an inspectie-facing figure may be missing,
 * never quietly wrong. The blunt invalidation above still covers everything else.
 */

/** Previews a school-content upload (FR-1.3). Writes nothing, so nothing is invalidated. */
export function useVoorbeeldSchoolcontent() {
  return useMutation({
    mutationFn: (invoer: SchoolcontentInvoer) => voorbeeldSchoolcontent(invoer),
  });
}

/** Commits a school-content upload (FR-1.1/1.4). */
export function useImporteerSchoolcontent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoer: SchoolcontentInvoer) => importeerSchoolcontent(invoer),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      vernieuwDekking(queryClient);
    },
  });
}

/** Previews one discipline's Op.stap goal file (FR-2.5's review step). Writes nothing. */
export function useVoorbeeldOpstap() {
  return useMutation({
    mutationFn: (invoer: OpstapInvoer) => voorbeeldOpstap(invoer),
  });
}

/** Commits one discipline's Op.stap goal file (FR-2.1 initial import, FR-2.5 re-import). */
export function useImporteerOpstap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoer: OpstapInvoer) => importeerOpstap(invoer),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      vernieuwDekking(queryClient);
    },
  });
}
