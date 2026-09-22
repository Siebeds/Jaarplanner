import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "../../lib/api";

/**
 * What Chuck reads (FB-071, ADR-0059, ADR-0065): the school's setting that shows him at all, and the deurmat of the
 * signed-in gebruiker, which is what his posture and his window are made of.
 */

/** Mirrors `KatinstellingWeergave`. */
export interface Katinstelling {
  isZichtbaar: boolean;
}

/** Mirrors `Signaalsoort`. Aanbodgat never reaches the deurmat: its activiteitvoorstellen do. */
export type Signaalsoort = "MinimumdoelInGevaar" | "SubthemaNietGepland" | "Aanbodgat";

/** Mirrors `Deurmatsignaal`. The sentence is not in it: `zinnen.ts` makes it from `gegevens` and `nl.json`. */
export interface Deurmatsignaal {
  id: string;
  soort: Signaalsoort;
  klasId: string;
  klasnaam: string;
  gegevens: Record<string, unknown>;
  /** Where she can act on it, for the klas in `klasId`: select that klas before following it. */
  verwijzing: string | null;
  aangemaakt: string;
  gezien: boolean;
}

export type Deurmatvoorstelsoort = "Activiteitvoorstel" | "Subdoelvoorstel" | "Subthemavoorstel" | "Minimumdoelsuggestie";

/** Mirrors `Deurmatvoorstel`. */
export interface Deurmatvoorstel {
  soort: Deurmatvoorstelsoort;
  id: string;
  titel: string;
  /** Where it is decided; `null` for one the cat brought, which the window decides itself. */
  verwijzing: string | null;
  aiMotivatie: string;
  /** For one the cat brought: the klas, and when accepting plans it. */
  klasnaam?: string | null;
  datum?: string | null;
  begin?: string | null;
  einde?: string | null;
}

export interface Deurmat {
  signalen: Deurmatsignaal[];
  voorstellen: Deurmatvoorstel[];
}

const INSTELLING = ["kat", "instelling"] as const;
const DEURMAT = ["kat", "deurmat"] as const;

/** Whether the school shows Chuck. Everyone reads it; until it loads he is not drawn. */
export function useKatinstelling() {
  return useQuery({
    queryKey: INSTELLING,
    queryFn: () => get<Katinstelling>("/api/kat/instelling"),
    staleTime: 5 * 60_000,
  });
}

/** Admin turns him on or off for the whole school. */
export function useZetKatinstelling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoer: Katinstelling) => put<Katinstelling>("/api/kat/instelling", invoer),
    onSuccess: (antwoord) => qc.setQueryData(INSTELLING, antwoord),
  });
}

/**
 * The deurmat. Read only while Chuck is shown, refreshed when the window opens and every few minutes: the background
 * job ticks twice a day, so there is nothing to poll for.
 */
export function useDeurmat(ingeschakeld: boolean) {
  return useQuery({
    queryKey: DEURMAT,
    queryFn: () => get<Deurmat>("/api/deurmat"),
    enabled: ingeschakeld,
    staleTime: 60_000,
    refetchInterval: ingeschakeld ? 10 * 60_000 : false,
  });
}

/** Records that she followed a signal. */
export function useSignaalGezien() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (signaalId: string) => post<void>(`/api/deurmat/signalen/${signaalId}/gezien`),
    onSettled: () => void qc.invalidateQueries({ queryKey: DEURMAT }),
  });
}

/** Puts a signal away until the next schooldag (ADR-0059 D4). It leaves the deurmat at once. */
export function useSignaalLater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (signaalId: string) => post<void>(`/api/deurmat/signalen/${signaalId}/later`),
    onMutate: async (signaalId) => {
      await qc.cancelQueries({ queryKey: DEURMAT });
      const vorige = qc.getQueryData<Deurmat>(DEURMAT);
      if (vorige) qc.setQueryData<Deurmat>(DEURMAT, { ...vorige, signalen: vorige.signalen.filter((s) => s.id !== signaalId) });
      return { vorige };
    },
    onError: (_fout, _id, context) => {
      if (context?.vorige) qc.setQueryData(DEURMAT, context.vorige);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: DEURMAT }),
  });
}

/**
 * Accepts or rejects an activiteitvoorstel the cat brought, through the route every activiteitvoorstel is decided by
 * (ADR-0056 D8, ADR-0060 D2). Accepting makes her own activiteit and plans it, so the agenda and the dekking move.
 */
export function useBeslisKatvoorstel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ voorstelId, status }: { voorstelId: string; status: "Aanvaard" | "Geweigerd" }) =>
      put<unknown>(`/api/activiteitvoorstellen/${voorstelId}/beslissing`, { status }),
    onSettled: () => void qc.invalidateQueries({ queryKey: DEURMAT }),
    onSuccess: (_antwoord, { status }) => {
      if (status !== "Aanvaard") return;
      void qc.invalidateQueries({ queryKey: ["dekking"] });
      void qc.invalidateQueries({ queryKey: ["weekplanning"] });
      void qc.invalidateQueries({ queryKey: ["thema"] });
    },
  });
}
