import { MutationCache, QueryClient } from "@tanstack/react-query";
import { isGeenToegang } from "./rechten";

/**
 * The app's one query client, built here so a test can build the same one.
 *
 * **A refused write refetches what is on screen** (E6-02 slice 4). The frontend hides every control a gebruiker's
 * rights do not grant (`lib/rechten.ts`), so a 403 means the screen was out of date: rights changed while the page was
 * open (`/api/ik` never goes stale on its own), or the resource did, such as a goal linked to the activiteit a maker
 * was about to delete. Refetching every active query, `ik` included, is what takes the stale control away. A 403 is
 * rare by construction, so the cost of refetching everything is paid rarely, and a list of keys to refetch would be
 * one more thing to keep in step. What the teacher READS about the refusal is each screen's own error treatment, in
 * Dutch (`geenToegangZin`).
 */
export function maakQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onError: (fout) => {
        if (isGeenToegang(fout)) void client.invalidateQueries();
      },
    }),
    defaultOptions: {
      queries: {
        // Reference data changes when someone runs an import, not while a teacher browses. Plan and
        // dekking are refetched by their own mutations rather than by a shorter stale time.
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
  return client;
}
