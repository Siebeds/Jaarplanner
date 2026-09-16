import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { t } from "../../i18n";
import { ApiError, get, post, put } from "../../lib/api";
import { geenToegangZin } from "../../lib/rechten";
import { themaSleutels } from "../../lib/queries";
import type {
  ActiviteitvoorstelBesluit,
  ActiviteitvoorstelBeslissing,
  ActiviteitvoorstelResultaat,
  ActiviteitvoorstelWeergave,
} from "../../lib/types";

const sleutel = (subthemaId: string) => ["activiteitvoorstellen", subthemaId] as const;

/** The signed-in gebruiker's open activiteit proposals under one subthema (FB-025, ADR-0052 D2). */
export function useActiviteitvoorstellen(subthemaId: string, ingeschakeld: boolean) {
  return useQuery({
    queryKey: sleutel(subthemaId),
    queryFn: () => get<ActiviteitvoorstelWeergave[]>(`/api/subthemas/${subthemaId}/activiteitvoorstellen`),
    enabled: ingeschakeld,
  });
}

/** Asks the AI for activiteiten; they land as open proposals, nothing is an activiteit yet (Art. IV.1). */
export function useStelActiviteitenVoor(subthemaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<ActiviteitvoorstelResultaat>(`/api/subthemas/${subthemaId}/activiteitvoorstellen/genereer`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: sleutel(subthemaId) }),
  });
}

/**
 * Accepts, possibly changed, or rejects a proposal. An acceptance makes an own activiteit, so every read that lists
 * activiteiten or counts their doelen is refreshed with the proposals.
 */
export function useBeslisActiviteitvoorstel(subthemaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ voorstelId, beslissing }: { voorstelId: string; beslissing: ActiviteitvoorstelBeslissing }) =>
      put<ActiviteitvoorstelBesluit>(`/api/activiteitvoorstellen/${voorstelId}/beslissing`, beslissing),
    onSettled: () => void qc.invalidateQueries({ queryKey: sleutel(subthemaId) }),
    onSuccess: (besluit) => {
      if (besluit.activiteitId === null) return;
      void qc.invalidateQueries({ queryKey: ["thema"] });
      void qc.invalidateQueries({ queryKey: themaSleutels.bibliotheek() });
      void qc.invalidateQueries({ queryKey: ["dekking"] });
      void qc.invalidateQueries({ queryKey: ["leerplandoel"] });
    },
  });
}

/** The sentence for a failed AI request. */
export function vraagFout(fout: unknown): string {
  const geweigerd = geenToegangZin(fout);
  if (geweigerd) return geweigerd;
  if (fout instanceof ApiError && fout.status === 422) return t("activiteitvoorstel.aiOngeldig");
  if (fout instanceof ApiError && fout.status === 400 && fout.detail) return fout.detail;
  return t("activiteitvoorstel.aiMislukt");
}

/** The sentence for a refused decision: the server's own for a stale proposal, else a general one. */
export function beslisFout(fout: unknown): string {
  const geweigerd = geenToegangZin(fout);
  if (geweigerd) return geweigerd;
  if (fout instanceof ApiError && (fout.status === 400 || fout.status === 404) && fout.detail) return fout.detail;
  return t("activiteitvoorstel.beslisMislukt");
}
