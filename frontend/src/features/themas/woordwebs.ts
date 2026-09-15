import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "../../lib/api";
import type { KoppelingStatus, WoordwebVoorstelResultaat, WoordwebWeergave } from "../../lib/types";

/**
 * The woordwebs of one subthema (FB-036, ADR-0041): everyone's, the signed-in gebruiker's first.
 *
 * Under a key of its own, not under the thema's: a woordweb counts for nothing (no dekking, no count on the thema), so
 * a word added here has nothing else on the page to refresh, and a thema write has nothing here to refresh either.
 */
export const woordwebSleutel = (subthemaId: string) => ["woordwebs", subthemaId] as const;

export function useWoordwebs(subthemaId: string | null) {
  return useQuery({
    queryKey: woordwebSleutel(subthemaId ?? ""),
    queryFn: () => get<WoordwebWeergave[]>(`/api/subthemas/${subthemaId}/woordwebs`),
    enabled: Boolean(subthemaId),
  });
}

function useWoordwebMutatie<TVariabelen, TAntwoord>(
  subthemaId: string,
  uitvoeren: (variabelen: TVariabelen) => Promise<TAntwoord>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uitvoeren,
    onSuccess: () => void qc.invalidateQueries({ queryKey: woordwebSleutel(subthemaId) }),
  });
}

/**
 * Typed words. Without a web of her own yet, the first word goes to the route that creates it for the signed-in
 * gebruiker (D2); after that, to the web by its id.
 */
export function useVoegWoordenToe(subthemaId: string) {
  return useWoordwebMutatie(subthemaId, ({ woordwebId, woorden }: { woordwebId: string | null; woorden: string[] }) =>
    woordwebId
      ? post<WoordwebWeergave>(`/api/woordwebs/${woordwebId}/woorden`, { woorden })
      : post<WoordwebWeergave>(`/api/subthemas/${subthemaId}/woordwebs/eigen/woorden`, { woorden }),
  );
}

export function useVerwijderWoord(subthemaId: string) {
  return useWoordwebMutatie(subthemaId, ({ woordwebId, woordId }: { woordwebId: string; woordId: string }) =>
    del<WoordwebWeergave>(`/api/woordwebs/${woordwebId}/woorden/${woordId}`),
  );
}

/** Accepts or rejects a word the AI proposed. The decision is what is stored (Art. IV.2). */
export function useBeslisWoord(subthemaId: string) {
  return useWoordwebMutatie(
    subthemaId,
    ({ woordwebId, woordId, status }: { woordwebId: string; woordId: string; status: Extract<KoppelingStatus, "Aanvaard" | "Geweigerd"> }) =>
      put<WoordwebWeergave>(`/api/woordwebs/${woordwebId}/woorden/${woordId}/status`, { status }),
  );
}

/** Asks the AI for words; everything it proposes lands as `Voorgesteld` and waits for a decision (Art. IV.1). */
export function useStelWoordenVoor(subthemaId: string) {
  return useWoordwebMutatie(subthemaId, (woordwebId: string) =>
    post<WoordwebVoorstelResultaat>(`/api/woordwebs/${woordwebId}/voorstellen`, {}),
  );
}
