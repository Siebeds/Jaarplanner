import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "../../lib/api";

/**
 * The corners of one classroom, read and written from the one screen that defines them.
 *
 * **Its own feature module rather than `lib/queries.ts` or a file under `instellingen/`.** It began
 * under `instellingen/`, where the only screen that used it lived. The agenda now reads the same
 * hoeken to draw its fiches, so a second screen depends on it, and the two honest homes were the
 * shared query file or a module of its own. A module of its own wins on the repo's own rule to
 * organise by feature: these types and hooks are about hoeken, not about queries in general.
 *
 * **Nothing here invalidates `dekking`, unlike the klas mutations.** A hoek carries no
 * doelkoppelingen (owner ruling, 2026-08-30), so no corner can move a coverage figure. Invalidating
 * it anyway would refetch every dekking on screen to prove a number that cannot have changed.
 */

/**
 * A corner as the beheerscherm reads it. Mirrors `HoekWeergave` on the server, less its count of placements: a hoek is
 * no longer placed in the agenda (ADR-0044), and no screen reads the rows an earlier agenda left.
 */
export interface HoekWeergave {
  id: string;
  klasId: string;
  naam: string;
  omschrijving: string | null;
  /** How many verrijkingen were written for it, over every subthemaperiode: what deleting it takes along (FB-020). */
  aantalVerrijkingen: number;
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
 * Deletes a corner with its verrijkingen, and with any placement an earlier agenda left, which no screen shows any more
 * (ADR-0044). A refusal the server does send is surfaced verbatim by the screen that asked.
 */
export function useVerwijderHoek(klasId: string | null) {
  const ververs = useHoekVerversing(klasId);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (hoekId: string) => del(`/api/hoeken/${hoekId}`),
    onSuccess: () => {
      ververs();
      // Its verrijkingen went with it (FB-020).
      void qc.invalidateQueries({ queryKey: ["hoekverrijkingen"] });
    },
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

/* ------------------------------------------------------------------------------------------------
   WHAT IS IN THE CORNER WHILE A SUBTHEMA RUNS (FB-020, ADR-0041; FB-038, ADR-0044)

   One text per hoek and per subthemaperiode: a window the klas's plan stores for a subthema. Read and
   written in the agenda's side panel, a sheet per hoek; never a block in the grid.
   ------------------------------------------------------------------------------------------------ */

/** The longest text one verrijking may hold. The server refuses anything longer, with the same number. */
export const MAXIMALE_VERRIJKING = 2000;

/** What one hoek holds for one subthemaperiode. */
export interface HoekverrijkingWeergave {
  id: string;
  hoekId: string;
  tekst: string;
}

/** One stored subthemaperiode of the klas, with what each hoek holds while it runs. Mirrors the server's record. */
export interface SubthemaperiodeVerrijkingen {
  subthemaperiodeId: string;
  subthemaId: string;
  subthemaNaam: string;
  van: string;
  tot: string;
  /** One per hoek that has one; empty is the ordinary state of a new window. */
  verrijkingen: HoekverrijkingWeergave[];
}

/**
 * What the sheet saves. A window's id when the klas stores one; otherwise the subthema and the days the agenda draws it
 * on, and the server stores that window first (owner, 2026-09-15). A blank text removes that hoek's verrijking.
 */
export type HoekverrijkingenInvoer = {
  verrijkingen: { hoekId: string; tekst: string }[];
} & (
  | { subthemaperiodeId: string }
  | { subthemaperiodeId: null; subthemaId: string; van: string; tot: string }
);

/**
 * The stored subthemaperiodes of the klas touching a range, each with its verrijkingen.
 *
 * Keyed on the range like the weekplanning, so the agenda's reads over the same range share one request.
 */
export function useHoekverrijkingen(klasId: string | null, van: string, tot: string) {
  return useQuery({
    queryKey: ["hoekverrijkingen", klasId, van, tot] as const,
    queryFn: () => get<SubthemaperiodeVerrijkingen[]>(`/api/klassen/${klasId}/hoekverrijkingen?van=${van}&tot=${tot}`),
    enabled: klasId !== null && van.length > 0 && tot.length > 0,
  });
}

/**
 * Writes the verrijkingen of one subthemaperiode, for every hoek named in the request.
 *
 * **It invalidates the weekplanning too**, because a save for a subthema the agenda drew from its activiteiten alone
 * stores the window first, and from then on the weekplanning names that window.
 */
export function useBewaarHoekverrijkingen(klasId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (invoer: HoekverrijkingenInvoer) =>
      put<SubthemaperiodeVerrijkingen>(`/api/klassen/${klasId}/hoekverrijkingen`, invoer),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hoekverrijkingen"] });
      void qc.invalidateQueries({ queryKey: ["weekplanning"] });
      // The corners' own counts, which the delete confirmation in Instellingen reads.
      void qc.invalidateQueries({ queryKey: sleutel(klasId) });
    },
  });
}

/** How many verrijkingen deleting a subthema would take along, over every klas. Disabled until one is chosen. */
export function useAantalHoekverrijkingen(subthemaId: string | null) {
  return useQuery({
    queryKey: ["hoekverrijkingen", "aantal", subthemaId] as const,
    queryFn: () => get<{ aantal: number }>(`/api/subthemas/${subthemaId}/hoekverrijkingen/aantal`),
    enabled: subthemaId !== null,
  });
}
