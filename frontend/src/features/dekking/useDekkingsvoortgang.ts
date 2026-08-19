import { useQuery } from "@tanstack/react-query";

import { haalDekkingsvoortgang } from "./voortgang";
import { dekkingKlasKey } from "./useDekking";
import type { Dekkingsbereik } from "./types";

/**
 * Server state for the coverage progress bar (E9-06, CR4).
 *
 * **The key is nested INSIDE {@link dekkingKlasKey}, and that is the whole design of this file.**
 *
 * CR4's requirement is that the bar moves *while* a teacher works: as they link doelen to a thema and as they place
 * thema's in the plan. Every one of those writes already clears a dekking cache entry — `useThemas` and
 * `useDoelsuggesties` clear the whole `DEKKING_KEY` subtree because a school-wide link reaches every class's plan,
 * `useJaarplan`'s `vergeetDekking` clears one class's, and `useImport` clears the subtree because an import moves the
 * denominator too. All five go through `vernieuwDekking`/`vernieuwDekkingVanKlas` with a **prefix** and none passes
 * `exact`, so a key that lives under `dekkingKlasKey(klasId)` is cleared by all of them.
 *
 * So this bar inherits its liveness rather than asking for it, and the alternative was tempting and wrong: a
 * `voortgangKey` of its own would have needed a sixth invalidation added to five separate mutation files, and the first
 * writer added after this story would have been the one that forgot. The invalidation this bar needs is hard to forget,
 * because it is the same one the dekkingsoverzicht already cannot work without.
 *
 * **One thing did have to change in those writers, and pretending otherwise would have shipped CR4 broken.** They used
 * `removeQueries`, which clears the entry without notifying observers, so on `/themas` — where nothing else re-renders
 * on a dekking-affecting write — this bar sat perfectly still through exactly the work CR4 exists to make visible. The
 * five now share one helper that uses `resetQueries`. The full measurement, and the correction to the first version of
 * this claim, are on `vernieuwDekking`: the kalender was **not** previously unaffected, so this bar was never "the
 * first consumer mounted beside a write".
 *
 * **Contrast `weekplanning`, which deliberately is its own family.** That one answers a different question over a
 * different range and a day-level edit cannot move a coverage figure at all (Art. V.1). This is the *same*
 * computation over the *same* scope, two fields narrower. Same question means same family.
 *
 * **No `staleTime`, for the reason spelled out on `useDekking`:** dekking is recomputed server-side on every read
 * (Art. V.1), so caching it for minutes would reintroduce exactly the stale figure that "computed, never stored"
 * exists to prevent.
 */
const voortgangKey = (klasId: string, bereik: Dekkingsbereik, jaarFase: string | null) =>
  [...dekkingKlasKey(klasId), "voortgang", bereik, jaarFase] as const;

export function useDekkingsvoortgang(
  klasId: string,
  bereik: Dekkingsbereik,
  jaarFase: string | null,
) {
  return useQuery({
    // `bereik` and `jaarFase` are part of the key for the same reason they are in `useDekking`: narrowing changes the
    // DENOMINATOR, so two narrowings are two computations and caching them together would draw one scope's segments
    // against another's total.
    queryKey: voortgangKey(klasId, bereik, jaarFase),
    queryFn: () => haalDekkingsvoortgang(klasId, bereik, jaarFase ?? undefined),
    // No class chosen means there is nothing to ask about. Without this the bar would fire
    // `/api/klassen//dekking/voortgang` on first paint and render its error state at a teacher who has simply not
    // picked a class yet.
    enabled: Boolean(klasId),
  });
}

export { voortgangKey as dekkingsvoortgangKey };
