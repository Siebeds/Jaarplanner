import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "../../lib/api";
import type { ActiviteitWeergave } from "../../lib/types";
import type { ActiviteitInvoer } from "../activiteiten/Activiteitformulier";

/**
 * The writes the Doelen register makes: link one doel to a thema, a subthema, an activiteit, or an
 * activiteit that does not exist yet.
 *
 * Separate from `features/themas/mutaties.ts` for one concrete reason rather than tidiness. Every
 * hook there is built by `useSchoolcontentMutatie(fn, themaId)` and binds its cache invalidation to
 * ONE thema, which is right for a screen that has a thema open and wrong here: this sheet writes to
 * whichever thema the teacher scrolled to, and a hook cannot be re-created per row. So these
 * invalidate the whole `thema` family instead of one member of it.
 *
 * **They also invalidate the leerplandoel detail, which the thema screen's versions do not.** That
 * query feeds the "Gebruikt in" section the teacher is looking at while they link, since the sheet opens
 * on top of it. Without this line the link lands, the tree updates, and the list underneath still
 * says the doel is used nowhere, which reads as a failed save.
 */
function useKoppelmutatie<TVariabelen, TAntwoord>(
  uitvoeren: (variabelen: TVariabelen) => Promise<TAntwoord>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uitvoeren,
    onSuccess: () => {
      // Same families as the thema screen's writes: the bibliotheek counts, the per-class trees this
      // sheet reads, the activiteit names printed on the agenda, and the coverage figure, which a
      // manual link moves by definition. `thema-bibliotheek` is listed separately because a key
      // matches on whole array elements, so `["thema"]` is not a prefix of it.
      void qc.invalidateQueries({ queryKey: ["thema"] });
      void qc.invalidateQueries({ queryKey: ["thema-bibliotheek"] });
      void qc.invalidateQueries({ queryKey: ["thema-voor-klas"] });
      void qc.invalidateQueries({ queryKey: ["weekplanning"] });
      void qc.invalidateQueries({ queryKey: ["dekking"] });
      void qc.invalidateQueries({ queryKey: ["leerplandoel"] });
    },
  });
}

/** Links the doel to a thema as a school-wide themadoel. Refused by the domain beyond three. */
export function useKoppelDoelAanThema() {
  return useKoppelmutatie<{ themaId: string; leerplandoelCode: string }, unknown>(
    ({ themaId, leerplandoelCode }) => post(`/api/themas/${themaId}/themadoelen`, { leerplandoelCode }),
  );
}

/** Links the doel to a subthema, as a subdoel at that subthema's own leeftijd. */
export function useKoppelDoelAanSubthema() {
  return useKoppelmutatie<{ subthemaId: string; leerplandoelCode: string }, unknown>(
    ({ subthemaId, leerplandoelCode }) =>
      post(`/api/subthemas/${subthemaId}/doelkoppelingen`, { leerplandoelCode }),
  );
}

/** Links the doel to an activiteit that already exists. */
export function useKoppelDoelAanActiviteit() {
  return useKoppelmutatie<{ activiteitId: string; leerplandoelCode: string }, unknown>(
    ({ activiteitId, leerplandoelCode }) =>
      post(`/api/activiteiten/${activiteitId}/doelkoppelingen`, { leerplandoelCode }),
  );
}

/**
 * Creates an activiteit under a subthema with the doel already linked to it.
 *
 * One request, not two. `ActiviteitCreatie.LeerplandoelCodes` links inside the same `SaveChanges` as
 * the insert, so a teacher can never end up with a nameless new activiteit that failed to get its
 * doel, which is the whole point of starting from the doel rather than from the thema.
 */
export function useMaakActiviteitMetDoel() {
  return useKoppelmutatie<{ subthemaId: string; invoer: ActiviteitInvoer }, ActiviteitWeergave>(
    ({ subthemaId, invoer }) => post<ActiviteitWeergave>(`/api/subthemas/${subthemaId}/activiteiten`, invoer),
  );
}
