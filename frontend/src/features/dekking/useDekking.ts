import { useQuery, type QueryClient } from "@tanstack/react-query";

import { haalDekking } from "./api";
import type { Dekkingsbereik } from "./types";

/**
 * Everything cached about dekking, for **every** class and every scope (E4-01).
 *
 * Two keys are exported rather than one, because the two families of writes have different reach and pretending
 * otherwise would drop either too much or too little:
 *
 * - a **plan** edit (place, move, decide, remove, generate) changes one class's plan, so the kalender drops
 *   {@link dekkingKlasKey};
 * - a **link** edit (a themadoel, an accepted or adjusted doelsuggestie) changes a `DoelKoppeling` on a
 *   school-wide thema, and that thema may sit in any number of classes' plans. `/themas` therefore drops this
 *   whole subtree. Narrowing it to the class the teacher happens to have selected would leave every *other*
 *   class's figure stale, which is the same defect one screen further along;
 * - an **import** writes both sides of the figure at once: counted `DoelKoppeling`s and, on the curriculum side,
 *   the denominator itself. Same subtree, same reason (round-2 audit, MAJOR 2).
 *
 * Owned here and imported by the features that write, so the string `"dekking"` exists in one place, following
 * the precedent in `themas/useThemas.ts`, which reaches for `matching`'s key for the same reason.
 */
export const DEKKING_KEY = ["dekking"] as const;

/** Everything cached about **one** class's dekking, whatever scope or narrowing it was asked under (E4-01). */
export const dekkingKlasKey = (klasId: string) => [...DEKKING_KEY, klasId] as const;

/**
 * Throw away a cached dekking answer **and go get the new one** — the one function every writer should call.
 *
 * **`reset`, not `remove`, and E9-06 is the story that found out why.** Both clear the data, so both satisfy E4-01's
 * requirement that a pre-edit figure is never painted on arrival. They differ on a query that is **mounted** at the
 * moment of the write:
 *
 * - `removeQueries` deletes the cache entry and **does not notify observers**. Measured, not assumed: a mounted
 *   component whose tree is otherwise idle goes on rendering its last result and never refetches. It refetches only if
 *   something *else* re-renders it, which makes a remove a **nondeterministic** refresh for anything on screen.
 * - `resetQueries` clears the data **and refetches every active observer**, so a figure on the same screen as the write
 *   moves, every time.
 *
 * **What that difference actually cost, corrected 2026-08-20 after an audit refuted the first version of this note.**
 * The `/themas` bar was frozen: nothing else on that screen re-renders on a dekking-affecting write, so the remove was
 * never followed by the re-render that would have rebuilt the query, and the figure sat still through exactly the
 * afternoon of linking CR4 exists to make visible. That is the defect, and it is enough on its own.
 *
 * **It is *not* true that the kalender was previously unaffected, and this note used to say so.** That screen's own
 * `useDekking` has been mounted beside the accept/reject/drag controls since E3-09, and every placement mutation calls
 * `setQueryData(jaarplanKey(...))`, which re-renders it -- so remove *plus a guaranteed re-render* already blanked
 * `dekking.data` there for the length of a refetch. `main`'s own test comment records it and calls it *"self-healing,
 * pre-existing and outside this story"*. So `heeftDoelenLatch` fixes an **older** defect that a reset makes routine
 * (every edit rather than only a generation run) rather than one this change introduced. Claiming otherwise credited
 * this story with someone else's bug, which is the kind of self-flattering causality this repo audits hardest.
 *
 * The behaviour E4-01 verified in a browser is unchanged, because the clearing still happens; what is added is the
 * refetch it never needed. *`useThemas` carries a refinement of the same mechanism for its own delete path.*
 *
 * **What it costs, recorded because an audit had to ask and the answer is not free.** Refetching active observers means
 * that on the kalender — which mounts `useDekking` unconditionally, for the jaarfasekiezer and the fallback caveat —
 * every accept, reject, lock and drag now re-reads the **whole in-scope dekking payload**, which is the very thing the
 * `…/dekking/voortgang` endpoint was added to avoid fetching per keystroke. Under `removeQueries` that read waited for
 * the next mount instead.
 *
 * **Accepted rather than optimised away, and here is the reasoning so a later reader can overturn it deliberately.**
 * Narrowing the reset to the voortgang sub-key and merely *invalidating* the heavy one would put the two figures on
 * different clocks: the fraction would move while the caveat that keeps a narrowed denominator honest lagged behind it,
 * which is a correctness problem rather than a performance one, and it is exactly the defect the terugval sentence was
 * fixed for. One clock for one screen is worth one refetch. If the payload ever becomes large enough for this to hurt,
 * the fix is to make `/dekking` paged, not to desynchronise the two reads.
 *
 * Nothing behind the API needs a counterpart: dekking is computed on every read and never stored (Art. V.1). These
 * functions exist purely because the browser is allowed to remember.
 */
export function vernieuwDekking(queryClient: QueryClient) {
  void queryClient.resetQueries({ queryKey: DEKKING_KEY });
}

/**
 * The same, narrowed to one class, for a **plan** edit.
 *
 * A link edit must use {@link vernieuwDekking} instead: a `DoelKoppeling` hangs off a school-wide thema that may sit in
 * any number of classes' plans, so narrowing to the class the teacher happens to have selected would leave every other
 * class's figure stale. See {@link DEKKING_KEY}.
 */
export function vernieuwDekkingVanKlas(queryClient: QueryClient, klasId: string) {
  void queryClient.resetQueries({ queryKey: dekkingKlasKey(klasId) });
}

const dekkingKey = (klasId: string, bereik: Dekkingsbereik, jaarFase: string | null) =>
  [...dekkingKlasKey(klasId), bereik, jaarFase] as const;

/**
 * Server state for the dekkingsoverzicht (E5-02, ADR-0014: TanStack Query owns it).
 *
 * **The scope is part of the query key, not a filter over one cached answer.** Two scopes are two different
 * computations with two different denominators, so caching them under one key would show a teacher L3's rows beside
 * the whole curriculum's total for as long as the stale answer lived. Same reasoning as the kalender's tier
 * (`roosterKey`), and the same mistake is available here.
 *
 * **No `staleTime`, deliberately.** E5-02's acceptance criterion is that the view matches the plan state live, and
 * every accept, reject, drag and vakantie edit changes the answer. Dekking is recomputed server-side on every read
 * (Art. V.1), so a fresh fetch is the whole mechanism: caching it for minutes would reintroduce exactly the stale
 * figure that Art. V.1's "computed, never stored" exists to prevent. Contrast the register's facets, which cache for
 * five minutes because the curriculum only changes on an import.
 *
 * **`staleTime: 0` is not enough on its own**, which is what E4-01 found: it makes a *refetch* happen on the next
 * mount, but TanStack still paints the cached pre-edit answer while that refetch is in flight, and keeps it on
 * screen beside the error if the refetch fails. The writers drop the entry for that reason; see
 * {@link DEKKING_KEY}.
 */
export function useDekking(klasId: string, bereik: Dekkingsbereik, jaarFase: string | null) {
  return useQuery({
    // `jaarFase` is part of the key for the same reason `bereik` is: narrowing changes the DENOMINATOR, so two
    // narrowings are two computations and caching them together would show one scope's rows beside another's total.
    queryKey: dekkingKey(klasId, bereik, jaarFase),
    queryFn: () => haalDekking(klasId, bereik, jaarFase),
    // No class chosen means there is nothing to ask about. Without this the screen would fire
    // `/api/klassen//dekking` on first paint and render its error state at a teacher who has simply not picked a
    // class yet, which is a different message (see DekkingPagina's three-valued selection handling).
    enabled: Boolean(klasId),
  });
}
