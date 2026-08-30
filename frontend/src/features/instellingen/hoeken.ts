import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "../../lib/api";

/**
 * The corners of one classroom, read and written from the one screen that defines them.
 *
 * **Local to this feature rather than in `lib/queries.ts`.** That file is shared with every other
 * screen; these four are used here and nowhere else, and the same argument the klas mutations make
 * applies. The agenda will need to READ hoeken later, and when it does the read moves to the shared
 * file rather than being copied into a second one.
 *
 * **Nothing here invalidates `dekking`, unlike the klas mutations.** A hoek carries no
 * doelkoppelingen (owner ruling, 2026-08-30), so no corner can move a coverage figure. Invalidating
 * it anyway would refetch every dekking on screen to prove a number that cannot have changed.
 */

/** A corner as the beheerscherm reads it. Mirrors `HoekWeergave` on the server. */
export interface HoekWeergave {
  id: string;
  klasId: string;
  naam: string;
  omschrijving: string | null;
  /** How often this corner is currently placed on the agenda. Zero for one that is only defined. */
  aantalPlaatsingen: number;
}

/** What a teacher states about a corner. */
export interface HoekInvoer {
  naam: string;
  omschrijving: string | null;
}

/** What taking over another class's corners did: the ones created, and the names already present. */
export interface HoekOvername {
  overgenomen: HoekWeergave[];
  overgeslagen: string[];
}

const sleutel = (klasId: string | null) => ["hoeken", klasId] as const;

/** The corners of one class. Disabled until a class is chosen: there is no school-wide list to fall back on. */
export function useHoeken(klasId: string | null) {
  return useQuery({
    queryKey: sleutel(klasId),
    queryFn: () => get<HoekWeergave[]>(`/api/klassen/${klasId}/hoeken`),
    enabled: klasId !== null,
  });
}

function useHoekVerversing(klasId: string | null) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: sleutel(klasId) });
}

export function useMaakHoek(klasId: string | null) {
  const ververs = useHoekVerversing(klasId);

  return useMutation({
    mutationFn: (invoer: HoekInvoer) => post<HoekWeergave>(`/api/klassen/${klasId}/hoeken`, invoer),
    onSuccess: ververs,
  });
}

/** `PUT` replaces the whole hoek, so the form always sends both fields, never a patch. */
export function useWijzigHoek(klasId: string | null) {
  const ververs = useHoekVerversing(klasId);

  return useMutation({
    mutationFn: ({ hoekId, invoer }: { hoekId: string; invoer: HoekInvoer }) =>
      put<HoekWeergave>(`/api/hoeken/${hoekId}`, invoer),
    onSuccess: ververs,
  });
}

/**
 * Deleting is refused by the server while the corner still stands in the agenda, with the count in
 * the message. That refusal is surfaced verbatim rather than pre-empted here: the count this screen
 * holds is the one it fetched, and the only count that may block a delete is the one the server sees
 * at the moment of the delete.
 */
export function useVerwijderHoek(klasId: string | null) {
  const ververs = useHoekVerversing(klasId);

  return useMutation({
    mutationFn: (hoekId: string) => del(`/api/hoeken/${hoekId}`),
    onSuccess: ververs,
  });
}

/**
 * Copies another class's corners into this one. A copy, never a share: the new rows belong to this
 * class from the moment they exist, so renaming one here touches nothing in the class it came from.
 */
export function useNeemHoekenOver(klasId: string | null) {
  const ververs = useHoekVerversing(klasId);

  return useMutation({
    mutationFn: (vanKlasId: string) =>
      post<HoekOvername>(`/api/klassen/${klasId}/hoeken/overnemen`, { vanKlasId }),
    onSuccess: ververs,
  });
}
