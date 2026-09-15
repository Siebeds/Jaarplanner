import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "../../lib/api";
import type { Doelsoort } from "../../lib/types";

/**
 * The one K3 set of rapportdoelen and the one sterrenschaal (FB-002, ADR-0035 R3 to R7): school-wide, with no schooljaar,
 * edited by the K3 leerkrachten and viewed by everyone else. None of it is pupil data, which is why every read here is
 * open to any signed-in gebruiker, unlike the children of a klas.
 */

export interface Gradatie {
  id: string;
  label: string;
  /** One of the server's fixed colours (`GET /api/gradaties/kleuren`). */
  kleur: string;
  volgorde: number;
}

export interface GradatieInvoer {
  label: string;
  kleur: string;
}

/** A decided K3 subdoel, as a rapportdoel bundles it (D11, D12: the server filters at read time). */
export interface Rapportsubdoel {
  id: string;
  leerplandoelCode: string;
  leerplandoelTekst: string;
  doelsoort: Doelsoort;
  themaNaam: string;
  subthemaNaam: string;
}

export interface Rapportdoel {
  id: string;
  titel: string;
  volgorde: number;
  subdoelen: Rapportsubdoel[];
}

export interface RapportdoelInvoer {
  titel: string;
  subdoelIds: string[];
}

export function useGradaties() {
  return useQuery({ queryKey: ["gradaties"], queryFn: () => get<Gradatie[]>("/api/gradaties") });
}

/** The fixed palette, in the server's order. It does not change while the app runs. */
export function useSterkleuren() {
  return useQuery({
    queryKey: ["sterkleuren"],
    queryFn: () => get<string[]>("/api/gradaties/kleuren"),
    staleTime: Infinity,
  });
}

export function useRapportdoelen() {
  return useQuery({ queryKey: ["rapportdoelen"], queryFn: () => get<Rapportdoel[]>("/api/rapportdoelen") });
}

/** Every decided K3 subdoel, for the picker. Only asked while the picker is open. */
export function useKandidaatsubdoelen(ingeschakeld: boolean) {
  return useQuery({
    queryKey: ["rapportdoelkandidaten"],
    queryFn: () => get<Rapportsubdoel[]>("/api/rapportdoelen/kandidaten"),
    enabled: ingeschakeld,
  });
}

/**
 * Each write refreshes its list, returned from the callback so the mutation settles once the list is read again. A
 * reorder refreshes on failure too (`onSettled`): the rows on screen may then be in an order the server refused.
 */
function useVerversing(sleutel: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [sleutel] });
}

export function useMaakGradatie() {
  const ververs = useVerversing("gradaties");
  return useMutation({
    mutationFn: (invoer: GradatieInvoer) => post<Gradatie>("/api/gradaties", invoer),
    onSuccess: ververs,
  });
}

export function useWijzigGradatie() {
  const ververs = useVerversing("gradaties");
  return useMutation({
    mutationFn: ({ id, invoer }: { id: string; invoer: GradatieInvoer }) => put<Gradatie>(`/api/gradaties/${id}`, invoer),
    onSuccess: ververs,
  });
}

export function useVerwijderGradatie() {
  const ververs = useVerversing("gradaties");
  return useMutation({ mutationFn: (id: string) => del(`/api/gradaties/${id}`), onSuccess: ververs });
}

export function useOrdenGradaties() {
  const ververs = useVerversing("gradaties");
  return useMutation({ mutationFn: (ids: string[]) => put("/api/gradaties/volgorde", { ids }), onSettled: ververs });
}

export function useMaakRapportdoel() {
  const ververs = useVerversing("rapportdoelen");
  return useMutation({
    mutationFn: (invoer: RapportdoelInvoer) => post<Rapportdoel>("/api/rapportdoelen", invoer),
    onSuccess: ververs,
  });
}

export function useWijzigRapportdoel() {
  const ververs = useVerversing("rapportdoelen");
  return useMutation({
    mutationFn: ({ id, invoer }: { id: string; invoer: RapportdoelInvoer }) =>
      put<Rapportdoel>(`/api/rapportdoelen/${id}`, invoer),
    onSuccess: ververs,
  });
}

export function useVerwijderRapportdoel() {
  const ververs = useVerversing("rapportdoelen");
  return useMutation({ mutationFn: (id: string) => del(`/api/rapportdoelen/${id}`), onSuccess: ververs });
}

export function useOrdenRapportdoelen() {
  const ververs = useVerversing("rapportdoelen");
  return useMutation({ mutationFn: (ids: string[]) => put("/api/rapportdoelen/volgorde", { ids }), onSettled: ververs });
}

/** The ids in their new order after moving the one at `index` one place up or down, or null when it cannot move. */
export function verschoven(ids: readonly string[], index: number, richting: -1 | 1): string[] | null {
  const doel = index + richting;
  if (doel < 0 || doel >= ids.length) return null;
  const nieuw = [...ids];
  [nieuw[index], nieuw[doel]] = [nieuw[doel], nieuw[index]];
  return nieuw;
}
