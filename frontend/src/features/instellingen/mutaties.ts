import { useMutation, useQueryClient } from "@tanstack/react-query";
import { del, post, put } from "../../lib/api";
import type { KlasWeergave } from "../../lib/types";

/**
 * Creating, changing and deleting a klas (Art. IX.3), from the one screen that defines them.
 *
 * **The three of them invalidate `dekking` as well as `klassen`, and that is not housekeeping.** A
 * class's jaar/fase IS the denominator of its coverage figure: `Jaarfasen.VoorKlas` is what
 * `Dekkingsbereik` measures against, so recording that a kleutergroep is K3 moves the figure from
 * "of JK, K2 and K3 together" to its own few hundred goals. A stale bar next to a saved value reads
 * as a save that did not take.
 *
 * **Local to this feature rather than added to `lib/queries.ts`.** That file is shared with every
 * other screen and is being edited by another session; a klasbeheer mutation is used here and
 * nowhere else.
 */
/**
 * What a klas is: a name and the age it teaches. Nothing else is stated.
 *
 * **There is no `leerjaar` here, and its absence is the point** (owner, 2026-08-30). The ordinal used to be the
 * field a teacher filled in, with the leeftijd as an extra question that only appeared for a kleutergroep. For
 * L1 to L6 that was the same fact asked twice, and for kleuter the ordinal was the half that could not answer.
 * The server derives it from the leeftijd now.
 */
export interface KlasInvoer {
  naam: string;
  jaarfase: string;
}

function useKlasVerversing() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["klassen"] });
    void qc.invalidateQueries({ queryKey: ["dekking"] });
  };
}

/**
 * A klas is created INSIDE a schooljaar, which is why the year is in the path and not in the body:
 * the server refuses to let a body disagree with the containment (Art. IX.3), and a rename can
 * therefore never quietly move a class onto another year's vakantiestructuur.
 */
export function useMaakKlas(schooljaarId: string | null) {
  const ververs = useKlasVerversing();

  return useMutation({
    mutationFn: (invoer: KlasInvoer) =>
      post<KlasWeergave>(`/api/schooljaren/${schooljaarId}/klassen`, invoer),
    onSuccess: ververs,
  });
}

/** `PUT` replaces the whole klas, so the form always sends all three fields, never a patch. */
export function useWijzigKlasVolledig() {
  const ververs = useKlasVerversing();

  return useMutation({
    mutationFn: ({ klasId, invoer }: { klasId: string; invoer: KlasInvoer }) =>
      put<KlasWeergave>(`/api/klassen/${klasId}`, invoer),
    onSuccess: ververs,
  });
}

/**
 * Deleting is refused by the server while any subthema still hangs on the class, with the blocking
 * count in the message. That refusal is surfaced verbatim rather than pre-empted here: the count the
 * screen holds is the one it fetched, and the only count that may block a delete is the one the
 * server sees at the moment of the delete.
 */
export function useVerwijderKlas() {
  const ververs = useKlasVerversing();

  return useMutation({
    mutationFn: (klasId: string) => del(`/api/klassen/${klasId}`),
    onSuccess: ververs,
  });
}
