import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "../../lib/api";
import type { Doelsoort } from "../../lib/types";

/**
 * A class's algemene fiches: the recurring activities that belong to no thema, the onthaal and the
 * turnles (owner, 2026-09-11).
 *
 * **Its own feature module, for the reason `hoeken/gegevens.ts` gives.** The settings screen defines
 * the fiches today, and the agenda will read the same list to draw them under the hoekenfiches once
 * its time grid lands, so these types and hooks are about fiches and not about one screen.
 *
 * **Changing a fiche's goals invalidates `dekking`, unlike anything a hoek does.** A planned fiche's
 * goals count for dekking (owner ruling, 2026-09-11), so linking or unlinking one can move a figure
 * on screen. Invalidating it for a fiche that is not planned yet refetches a number that did not
 * change, which is the cheaper mistake than showing one that did.
 */

/** One goal linked to a fiche, with enough of the goal to recognise it. Mirrors `AlgemeneFichedoelWeergave`. */
export interface AlgemeneFichedoel {
  koppelingId: string;
  leerplandoelCode: string;
  doelsoort: Doelsoort;
  jaarFase: string;
  tekst: string;
}

/** A fiche as the settings screen reads it. Mirrors `AlgemeneFicheWeergave` on the server. */
export interface AlgemeneFicheWeergave {
  id: string;
  klasId: string;
  naam: string;
  omschrijving: string | null;
  /** How often it stands in the agenda. Zero means its goals do not count for dekking yet. */
  aantalPlaatsingen: number;
  doelen: AlgemeneFichedoel[];
}

/** What a teacher states about a fiche. */
export interface AlgemeneFicheInvoer {
  naam: string;
  omschrijving: string | null;
}

const sleutel = (klasId: string | null) => ["algemene-fiches", klasId] as const;

/** The fiches of one class. Disabled until a class is chosen: there is no school-wide list. */
export function useAlgemeneFiches(klasId: string | null) {
  return useQuery({
    queryKey: sleutel(klasId),
    queryFn: () => get<AlgemeneFicheWeergave[]>(`/api/klassen/${klasId}/algemene-fiches`),
    enabled: klasId !== null,
  });
}

function useVerversing(klasId: string | null, { ookDekking }: { ookDekking: boolean }) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: sleutel(klasId) });
    if (ookDekking) void qc.invalidateQueries({ queryKey: ["dekking"] });
  };
}

export function useMaakAlgemeneFiche(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: false });

  return useMutation({
    mutationFn: (invoer: AlgemeneFicheInvoer) =>
      post<AlgemeneFicheWeergave>(`/api/klassen/${klasId}/algemene-fiches`, invoer),
    onSuccess: ververs,
  });
}

/** `PUT` replaces the name and description together, so the form always sends both. */
export function useWijzigAlgemeneFiche(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: false });

  return useMutation({
    mutationFn: ({ ficheId, invoer }: { ficheId: string; invoer: AlgemeneFicheInvoer }) =>
      put<AlgemeneFicheWeergave>(`/api/algemene-fiches/${ficheId}`, invoer),
    onSuccess: ververs,
  });
}

/**
 * Refused by the server while the fiche stands in the agenda, with the count in the message. Surfaced
 * verbatim rather than pre-empted: only the count the server sees at the moment of the delete may
 * block it.
 */
export function useVerwijderAlgemeneFiche(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: false });

  return useMutation({
    mutationFn: (ficheId: string) => del(`/api/algemene-fiches/${ficheId}`),
    onSuccess: ververs,
  });
}

/** Links a goal as the teacher's own (`manueel`) link. */
export function useKoppelFicheDoel(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: true });

  return useMutation({
    mutationFn: ({ ficheId, leerplandoelCode }: { ficheId: string; leerplandoelCode: string }) =>
      post<AlgemeneFicheWeergave>(`/api/algemene-fiches/${ficheId}/doelkoppelingen`, { leerplandoelCode }),
    onSuccess: ververs,
  });
}

export function useOntkoppelFicheDoel(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: true });

  return useMutation({
    mutationFn: ({ ficheId, koppelingId }: { ficheId: string; koppelingId: string }) =>
      del<AlgemeneFicheWeergave>(`/api/algemene-fiches/${ficheId}/doelkoppelingen/${koppelingId}`),
    onSuccess: ververs,
  });
}
