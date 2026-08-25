import { useMutation, useQueryClient } from "@tanstack/react-query";
import { del, post, put } from "../../lib/api";
import { themaSleutels } from "../../lib/queries";
import type { ActiviteitWeergave, SubthemaWeergave, ThemaWeergave } from "../../lib/types";
import type { ActiviteitInvoer } from "../activiteiten/Activiteitformulier";

/**
 * Writing school content: thema, subthema, activiteit, and manual goal links.
 *
 * In its own module rather than in `lib/queries.ts` on purpose. That file holds the reads the whole
 * app shares; these are the writes of one feature, and keeping them here means a screen that only
 * reads thema's cannot accidentally import a delete.
 *
 * **Every mutation invalidates the same keys.** A thema's detail and the bibliotheek list both
 * contain the counts that any of these writes can change, and `thema-voor-klas` feeds the agenda's
 * activity pickers. Invalidating more than strictly necessary is the cheap side of the trade: a
 * stale count on a screen the teacher navigates back to is the expensive one.
 *
 * **`weekplanning` is in that list because an activiteit's NAME is printed on the calendar.** Renaming
 * one from either screen left every card in the agenda reading the old name until something unrelated
 * refetched. The rule belongs to the write rather than to one of its callers, which is why it is here
 * and not in the agenda's sheet.
 *
 * **`dekking` is in it because a manual goal link IS coverage.** `EfDekkingOpslag` counts four layers
 * and one of them is the links on an activiteit, for every thema that is placed in the plan. So
 * linking a doel here moves the figure on the dekkingsoverzicht and the bar above the agenda, and
 * until this line existed neither of them noticed until the teacher reloaded the page. Reported by
 * the project owner, who linked a doel and watched the bar sit still.
 *
 * Not every write in this file can move that number: renaming a thema cannot. Invalidating anyway is
 * the cheap side of the same trade as above, and the alternative is a per-mutation list that the next
 * mutation will be left off.
 */
function useSchoolcontentMutatie<TVariabelen, TAntwoord>(
  uitvoeren: (variabelen: TVariabelen) => Promise<TAntwoord>,
  themaId?: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uitvoeren,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: themaSleutels.bibliotheek() });
      void qc.invalidateQueries({ queryKey: ["thema-voor-klas"] });
      void qc.invalidateQueries({ queryKey: ["weekplanning"] });
      void qc.invalidateQueries({ queryKey: ["dekking"] });
      if (themaId) void qc.invalidateQueries({ queryKey: themaSleutels.detail(themaId) });
    },
  });
}

// --- Thema (school-wide: no klas, no leeftijd, Art. IX.2) --------------------------------------

export interface ThemaInvoer {
  naam: string;
  duurWeken: number;
  invalshoeken: string | null;
  kernwoordenschat: string[];
  rijkeWoordenschat: string[];
}

export function useMaakThema() {
  return useSchoolcontentMutatie<ThemaInvoer, ThemaWeergave>((invoer) =>
    post<ThemaWeergave>("/api/themas", invoer),
  );
}

export function useWijzigThema(themaId: string) {
  return useSchoolcontentMutatie<ThemaInvoer, ThemaWeergave>(
    (invoer) => put<ThemaWeergave>(`/api/themas/${themaId}`, invoer),
    themaId,
  );
}

export function useVerwijderThema() {
  return useSchoolcontentMutatie<string, void>((themaId) => del<void>(`/api/themas/${themaId}`));
}

// --- Subthema (per klas and leeftijd, both required) --------------------------------------------

export interface OnderzoeksvraagInvoer {
  vraag: string;
  probleemstelling: string | null;
}

export interface SubthemaInvoer {
  naam: string;
  duurWeken: number;
  klasId: string;
  leeftijd: string;
  onderzoeksvragen: OnderzoeksvraagInvoer[];
}

export function useMaakSubthema(themaId: string) {
  return useSchoolcontentMutatie<SubthemaInvoer, SubthemaWeergave>(
    (invoer) => post<SubthemaWeergave>(`/api/themas/${themaId}/subthemas`, invoer),
    themaId,
  );
}

export function useWijzigSubthema(themaId: string) {
  return useSchoolcontentMutatie<{ subthemaId: string; invoer: SubthemaInvoer }, SubthemaWeergave>(
    ({ subthemaId, invoer }) => put<SubthemaWeergave>(`/api/subthemas/${subthemaId}`, invoer),
    themaId,
  );
}

export function useVerwijderSubthema(themaId: string) {
  return useSchoolcontentMutatie<string, void>(
    (subthemaId) => del<void>(`/api/subthemas/${subthemaId}`),
    themaId,
  );
}

// --- Activiteit (inherits its subthema's klas and leeftijd) -------------------------------------

// The payload shape lives with the form that produces it, so the two cannot drift.
export type { ActiviteitInvoer } from "../activiteiten/Activiteitformulier";

/**
 * The server answers with the activiteit it just made, so the type says so.
 *
 * It used to say `unknown`, which was true and useless: the agenda creates an activiteit in order to
 * plan it on a day straight after, and it needs the id to do that. Nothing else changes.
 */
export function useMaakActiviteit(themaId: string) {
  return useSchoolcontentMutatie<{ subthemaId: string; invoer: ActiviteitInvoer }, ActiviteitWeergave>(
    ({ subthemaId, invoer }) => post<ActiviteitWeergave>(`/api/subthemas/${subthemaId}/activiteiten`, invoer),
    themaId,
  );
}

export function useWijzigActiviteit(themaId: string) {
  return useSchoolcontentMutatie<{ activiteitId: string; invoer: ActiviteitInvoer }, unknown>(
    ({ activiteitId, invoer }) => put(`/api/activiteiten/${activiteitId}`, invoer),
    themaId,
  );
}

export function useVerwijderActiviteit(themaId: string) {
  return useSchoolcontentMutatie<string, void>(
    (activiteitId) => del<void>(`/api/activiteiten/${activiteitId}`),
    themaId,
  );
}

/** Moves an activiteit to another subthema. It may cross a thema, never a klas (ruling 2026-08-05). */
export function useVerplaatsActiviteit(themaId: string) {
  return useSchoolcontentMutatie<{ activiteitId: string; doelSubthemaId: string }, unknown>(
    ({ activiteitId, doelSubthemaId }) =>
      put(`/api/activiteiten/${activiteitId}/subthema`, { doelSubthemaId }),
    themaId,
  );
}

// --- Manual goal links, at all three levels ----------------------------------------------------

/**
 * A link a teacher made themselves. The body carries only the leerplandoel CODE: the goal itself is
 * read-only reference data (Art. III.5), so there is nothing else about it a client may send.
 *
 * These arrive as `Manueel`, which is a different thing from an accepted AI suggestion and stays
 * visibly different in the list. Nothing here can produce a `Voorgesteld` row.
 */
export function useKoppelThemadoel(themaId: string) {
  return useSchoolcontentMutatie<string, unknown>(
    (leerplandoelCode) => post(`/api/themas/${themaId}/themadoelen`, { leerplandoelCode }),
    themaId,
  );
}

export function useOntkoppelThemadoel(themaId: string) {
  return useSchoolcontentMutatie<string, void>(
    (themadoelId) => del<void>(`/api/themas/${themaId}/themadoelen/${themadoelId}`),
    themaId,
  );
}

export function useKoppelSubdoel(themaId: string) {
  return useSchoolcontentMutatie<{ subthemaId: string; leerplandoelCode: string }, unknown>(
    ({ subthemaId, leerplandoelCode }) =>
      post(`/api/subthemas/${subthemaId}/doelkoppelingen`, { leerplandoelCode }),
    themaId,
  );
}

export function useOntkoppelSubdoel(themaId: string) {
  return useSchoolcontentMutatie<{ subthemaId: string; subdoelId: string }, void>(
    ({ subthemaId, subdoelId }) => del<void>(`/api/subthemas/${subthemaId}/subdoelen/${subdoelId}`),
    themaId,
  );
}

export function useKoppelActiviteitdoel(themaId: string) {
  return useSchoolcontentMutatie<{ activiteitId: string; leerplandoelCode: string }, unknown>(
    ({ activiteitId, leerplandoelCode }) =>
      post(`/api/activiteiten/${activiteitId}/doelkoppelingen`, { leerplandoelCode }),
    themaId,
  );
}

export function useOntkoppelActiviteitdoel(themaId: string) {
  return useSchoolcontentMutatie<{ activiteitId: string; koppelingId: string }, void>(
    ({ activiteitId, koppelingId }) =>
      del<void>(`/api/activiteiten/${activiteitId}/doelkoppelingen/${koppelingId}`),
    themaId,
  );
}
