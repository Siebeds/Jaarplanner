import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "../../lib/api";

/**
 * The children of one K3 klas (FR-13.1, ADR-0035 §3.1): a voornaam and an achternaam, typed by hand one at a time
 * (R14, R15). There is no other field about a child, here or on the server (Art. VI.7).
 *
 * **Pupil data, so the query cache is the only copy the browser keeps.** Nothing here writes to storage, and signing
 * out clears the query client (`useAfmelden`), and these names with it.
 */
export interface Leerling {
  id: string;
  klasId: string;
  voornaam: string;
  achternaam: string;
}

/** What a teacher types for a child, and all of it. */
export interface LeerlingInvoer {
  voornaam: string;
  achternaam: string;
}

const sleutel = (klasId: string) => ["leerlingen", klasId] as const;

/**
 * The children of `klasId`, in the order the server sorts them (by voornaam).
 *
 * Asked only for a klas the gebruiker may read. Unlike every other read in this app, this one the server refuses for
 * anyone else (R17: no leerkracht reads another klas's children), and a request that is sure to be refused is one not
 * to send.
 */
export function useLeerlingen(klasId: string, magLezen: boolean) {
  return useQuery({
    queryKey: sleutel(klasId),
    queryFn: () => get<Leerling[]>(`/api/klassen/${klasId}/leerlingen`),
    enabled: magLezen,
  });
}

/**
 * The three writes share one refresh. It is returned from `onSuccess`, so a mutation settles only once the list has
 * been read again: the child a teacher just added is on screen by the time the fields are empty and ready for the next.
 */
function useVerversing(klasId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: sleutel(klasId) });
}

export function useMaakLeerling(klasId: string) {
  const ververs = useVerversing(klasId);
  return useMutation({
    mutationFn: (invoer: LeerlingInvoer) => post<Leerling>(`/api/klassen/${klasId}/leerlingen`, invoer),
    onSuccess: ververs,
  });
}

export function useWijzigLeerling(klasId: string) {
  const ververs = useVerversing(klasId);
  return useMutation({
    mutationFn: ({ leerlingId, invoer }: { leerlingId: string; invoer: LeerlingInvoer }) =>
      put<Leerling>(`/api/leerlingen/${leerlingId}`, invoer),
    onSuccess: ververs,
  });
}

/** Deletes the child with every report of theirs (ADR-0035 D8): for a child who leaves, or a parent who asks. */
export function useVerwijderLeerling(klasId: string) {
  const ververs = useVerversing(klasId);
  return useMutation({
    mutationFn: (leerlingId: string) => del(`/api/leerlingen/${leerlingId}`),
    onSuccess: ververs,
  });
}
