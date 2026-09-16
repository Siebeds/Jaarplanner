import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { t, type Vertaalsleutel } from "../../i18n";
import { ApiError, get, post, put } from "../../lib/api";
import { geenToegangZin } from "../../lib/rechten";
import { themaSleutels } from "../../lib/queries";
import type {
  KoppelingStatus,
  SubdoelplaatsingOverzicht,
  SubdoelplaatsingResultaat,
  SubthemavoorstelBeslissing,
} from "../../lib/types";

/**
 * The subdoelplaatsing of one thema (FB-057, ADR-0050): per leeftijd the open count and the open proposals.
 *
 * Under the thema's own key, so every write that refreshes the thema (a subthema made or deleted, a subdoel linked by
 * hand) refreshes the open count too, and it can never lag the chapters beside it.
 */
export function useSubdoelplaatsing(themaId: string | undefined) {
  return useQuery({
    queryKey: [...themaSleutels.detail(themaId ?? ""), "subdoelplaatsing"] as const,
    queryFn: () => get<SubdoelplaatsingOverzicht>(`/api/themas/${themaId}/subdoelplaatsing`),
    enabled: Boolean(themaId),
  });
}

/**
 * A write here changes the thema (a decision writes a subdoel or a subthema), and through it the doelen per leeftijd, a
 * doel's "Gebruikt in" and the dekking. A proposal alone changes none of them, but the refresh is cheap and one rule is
 * easier to trust than two.
 */
function usePlaatsingMutatie<TVariabelen, TAntwoord>(
  themaId: string,
  uitvoeren: (variabelen: TVariabelen) => Promise<TAntwoord>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uitvoeren,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: themaSleutels.detail(themaId) });
      void qc.invalidateQueries({ queryKey: ["dekking"] });
      void qc.invalidateQueries({ queryKey: ["leerplandoel"] });
    },
  });
}

/** Asks the AI where the open doelen of one leeftijd go; everything lands as `Voorgesteld` (Art. IV.1). */
export function useStelPlaatsingenVoor(themaId: string) {
  return usePlaatsingMutatie(themaId, (leeftijd: string) =>
    post<SubdoelplaatsingResultaat>(
      `/api/themas/${themaId}/subdoelplaatsing/${encodeURIComponent(leeftijd)}/genereer`,
    ),
  );
}

/** Accepts or rejects a doel proposed for an existing subthema. */
export function useBeslisSubdoelvoorstel(themaId: string) {
  return usePlaatsingMutatie(
    themaId,
    ({ voorstelId, status }: { voorstelId: string; status: Extract<KoppelingStatus, "Aanvaard" | "Geweigerd"> }) =>
      put<void>(`/api/subdoelvoorstellen/${voorstelId}/status`, { status }),
  );
}

/** Accepts, possibly changed, or rejects a proposed new subthema with its doelen. */
export function useBeslisSubthemavoorstel(themaId: string) {
  return usePlaatsingMutatie(
    themaId,
    ({ voorstelId, beslissing }: { voorstelId: string; beslissing: SubthemavoorstelBeslissing }) =>
      put<void>(`/api/subthemavoorstellen/${voorstelId}/beslissing`, beslissing),
  );
}

/** The sentence for a refused decision: the server's own for a stale proposal, else a general one. */
export function beslisFout(fout: unknown): string {
  const geweigerd = geenToegangZin(fout);
  if (geweigerd) return geweigerd;
  if (fout instanceof ApiError && (fout.status === 400 || fout.status === 404) && fout.detail) return fout.detail;
  return t("plaatsing.beslisMislukt");
}

/** The sentence for a failed AI request; `mislukt` is the general one, which names what was asked. */
export function aiFout(fout: unknown, mislukt: Vertaalsleutel = "plaatsing.aiMislukt"): string {
  const geweigerd = geenToegangZin(fout);
  if (geweigerd) return geweigerd;
  if (fout instanceof ApiError && fout.status === 422) return t("plaatsing.aiOngeldig");
  if (fout instanceof ApiError && fout.status === 400 && fout.detail) return fout.detail;
  return t(mislukt);
}
