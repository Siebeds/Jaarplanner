import { useQuery } from "@tanstack/react-query";
import { get, naarQuery } from "./api";
import type {
  KlasWeergave,
  LeerplandoelDetail,
  LeerplandoelFacetten,
  LeerplandoelFilterQuery,
  LeerplandoelenPagina,
  MinimumdoelFacetten,
  MinimumdoelFilterQuery,
  MinimumdoelenPagina,
  SchooljaarSamenvatting,
} from "./types";

/**
 * Server state for the curriculum screens.
 *
 * Query keys mirror the request exactly, so two components asking the same question share one
 * request and a filter change is a new key rather than a manual invalidation.
 */

export const doelenSleutels = {
  facetten: (filter: LeerplandoelFilterQuery) => ["leerplandoel-facetten", filter] as const,
  lijst: (filter: LeerplandoelFilterQuery) => ["leerplandoelen", filter] as const,
  detail: (code: string) => ["leerplandoel", code] as const,
};

export const minimumdoelSleutels = {
  facetten: (filter: MinimumdoelFilterQuery) => ["minimumdoel-facetten", filter] as const,
  lijst: (filter: MinimumdoelFilterQuery) => ["minimumdoelen", filter] as const,
};

function doelenQuery(filter: LeerplandoelFilterQuery): string {
  return naarQuery({
    zoek: filter.zoek,
    discipline: filter.discipline,
    domein: filter.domein,
    // The backend refuses a subdomein without its domein (subdomein names are not globally unique,
    // Art. VII.0), so never send one on its own: that would be a 400 the teacher cannot act on.
    subdomein: filter.domein ? filter.subdomein : undefined,
    doelsoort: filter.doelsoort,
    jaarFase: filter.jaarFase,
    overslaan: filter.overslaan,
    aantal: filter.aantal,
  });
}

function minimumdoelQuery(filter: MinimumdoelFilterQuery): string {
  return naarQuery({
    zoek: filter.zoek,
    discipline: filter.discipline,
    domein: filter.domein,
    subdomein: filter.domein ? filter.subdomein : undefined,
    jaarFase: filter.jaarFase,
    overslaan: filter.overslaan,
    aantal: filter.aantal,
  });
}

/**
 * The filter vocabulary for the current filter.
 *
 * Also the source of the browse tree, and the reason this hook is called per level rather than
 * once: the response's `domeinen` is a FLAT list scoped by whatever filter was sent, not a list
 * nested under `disciplines`. Asking once without a discipline and rendering the result under every
 * discipline is what the previous frontend did, and it put Muziek and Getallen under Nederlands
 * with school-wide counts. Every level asks for its own scope instead.
 */
export function useLeerplandoelFacetten(filter: LeerplandoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: doelenSleutels.facetten(filter),
    queryFn: () => get<LeerplandoelFacetten>(`/api/leerplandoelen/facetten${doelenQuery(filter)}`),
    enabled: opties?.enabled ?? true,
  });
}

export function useLeerplandoelen(filter: LeerplandoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: doelenSleutels.lijst(filter),
    queryFn: () => get<LeerplandoelenPagina>(`/api/leerplandoelen${doelenQuery(filter)}`),
    enabled: opties?.enabled ?? true,
  });
}

export function useLeerplandoel(code: string | null) {
  return useQuery({
    queryKey: doelenSleutels.detail(code ?? ""),
    queryFn: () => get<LeerplandoelDetail>(`/api/leerplandoelen/${encodeURIComponent(code!)}`),
    enabled: code !== null && code.length > 0,
  });
}

export function useMinimumdoelFacetten(filter: MinimumdoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: minimumdoelSleutels.facetten(filter),
    queryFn: () => get<MinimumdoelFacetten>(`/api/minimumdoelen/facetten${minimumdoelQuery(filter)}`),
    enabled: opties?.enabled ?? true,
  });
}

export function useMinimumdoelen(filter: MinimumdoelFilterQuery, opties?: { enabled?: boolean }) {
  return useQuery({
    queryKey: minimumdoelSleutels.lijst(filter),
    queryFn: () => get<MinimumdoelenPagina>(`/api/minimumdoelen${minimumdoelQuery(filter)}`),
    enabled: opties?.enabled ?? true,
  });
}

// --- Selection context ---

export function useSchooljaren() {
  return useQuery({
    queryKey: ["schooljaren"],
    queryFn: () => get<SchooljaarSamenvatting[]>("/api/schooljaren"),
    staleTime: 5 * 60_000,
  });
}

export function useKlassen(schooljaarId: string | null) {
  return useQuery({
    queryKey: ["klassen", schooljaarId],
    queryFn: () =>
      schooljaarId
        ? get<KlasWeergave[]>(`/api/schooljaren/${schooljaarId}/klassen`)
        : get<KlasWeergave[]>("/api/klassen"),
    staleTime: 5 * 60_000,
  });
}
