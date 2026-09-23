import { useEffect } from "react";
import { create } from "zustand";

/**
 * Where Chuck may lie besides his basket: the corner of the week strip, on the agenda (FB-071). There is exactly one
 * Chuck on screen, so the basket in the header has to know whether that corner is there, and for which klas: only a
 * goal at risk in that klas puts him on it.
 */
type Katplek = {
  /** The klas whose week strip is on screen, or `null` when no week strip is. */
  hoekKlasId: string | null;
  zetHoek: (klasId: string | null) => void;
};

export const useKatplek = create<Katplek>((set) => ({
  hoekKlasId: null,
  zetHoek: (hoekKlasId) => set({ hoekKlasId }),
}));

/** Announces a week strip for `klasId` while the calling component is mounted. */
export function useMeldHoek(klasId: string | null) {
  const zetHoek = useKatplek((s) => s.zetHoek);
  useEffect(() => {
    zetHoek(klasId);
    return () => zetHoek(null);
  }, [klasId, zetHoek]);
}
