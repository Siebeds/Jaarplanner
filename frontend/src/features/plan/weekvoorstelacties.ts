import { useMutation, useQueryClient } from "@tanstack/react-query";
import { t } from "../../i18n";
import { ApiError, post, put } from "../../lib/api";
import { geenToegangZin } from "../../lib/rechten";
import type { Weekplanning, WeekvoorstelResultaat } from "../../lib/types";

/**
 * The weekvoorstel (FB-027, ADR-0067): the AI picks the week's activiteiten, the tool fits them in as open proposals.
 * Every mutation here changes blocks in the agenda and, once one is accepted, the dekking, so all three refresh both
 * families, as `useDagacties` does.
 */
export function useWeekvoorstel(klasId: string | null) {
  const client = useQueryClient();
  const ververs = () => {
    void client.invalidateQueries({ queryKey: ["weekplanning"] });
    void client.invalidateQueries({ queryKey: ["dekking"] });
  };

  const stelVoor = useMutation({
    mutationFn: (datum: string) =>
      post<WeekvoorstelResultaat>(`/api/klassen/${klasId}/jaarplan/weekvoorstel`, { datum }),
    onSuccess: ververs,
  });

  const beslis = useMutation({
    mutationFn: ({ plaatsingId, aanvaard }: { plaatsingId: string; aanvaard: boolean }) =>
      put<Weekplanning>(`/api/klassen/${klasId}/jaarplan/weekplanning/${plaatsingId}/beslissing`, { aanvaard }),
    onSettled: ververs,
  });

  const aanvaardAlles = useMutation({
    mutationFn: ({ van, tot }: { van: string; tot: string }) =>
      post<Weekplanning>(`/api/klassen/${klasId}/jaarplan/weekvoorstel/aanvaard`, { van, tot }),
    onSettled: ververs,
  });

  return { stelVoor, beslis, aanvaardAlles };
}

/** The sentence for a failed request: the server's own Dutch for "nothing to ask", else a general one. */
export function weekvoorstelFout(fout: unknown): string {
  const geweigerd = geenToegangZin(fout);
  if (geweigerd) return geweigerd;
  if (fout instanceof ApiError && fout.status === 422) return t("weekvoorstel.aiOngeldig");
  if (fout instanceof ApiError && fout.status === 400 && fout.detail) return fout.detail;
  return t("weekvoorstel.aiMislukt");
}

/** The sentence for a refused decision: the server's own for a stale or a colleague's proposal, else a general one. */
export function weekbeslisFout(fout: unknown): string {
  const geweigerd = geenToegangZin(fout);
  if (geweigerd) return geweigerd;
  if (fout instanceof ApiError && (fout.status === 400 || fout.status === 404) && fout.detail) return fout.detail;
  return t("weekvoorstel.beslisMislukt");
}
