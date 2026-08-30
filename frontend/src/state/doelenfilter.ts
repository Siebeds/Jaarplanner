import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Doelsoort } from "../lib/types";

export type Doelenbron = "leerplandoelen" | "minimumdoelen";

export interface Doelenfilter {
  doelsoort?: Doelsoort;
  jaarFase?: string;
  domein?: string;
  subdomein?: string;
}

interface DoelenfilterState {
  filter: Doelenfilter;
  /** The applied (debounced) search term, not the keystroke-by-keystroke input. */
  zoek: string;
  bron: Doelenbron;
  /**
   * The class jaar/fase this filter last followed, so returning to the register does not re-apply a
   * preset the teacher has since changed or cleared. `null` means "no single class fase to follow".
   */
  faseVanKlas: string | null;
  stelFilter: (filter: Doelenfilter) => void;
  stelZoek: (zoek: string) => void;
  stelBron: (bron: Doelenbron) => void;
  volgKlasFase: (fase: string | null) => void;
  wisAlles: () => void;
}

/**
 * What the Doelen register is currently narrowed to.
 *
 * It lives outside the screen because the screen unmounts. A teacher who filters down to one
 * subdomein, opens a thema to check something and comes back was handed the unfiltered 2491 doelen
 * again and had to rebuild the filter by hand every time. The register is a naslagwerk you consult
 * *while* doing something else, so leaving it is the normal case, not the exception.
 *
 * SESSION storage, unlike [`useSelectie`](./selectie.ts) which is durable. A klas is a working
 * context that should survive the weekend; a filter is a step in one sitting, and reopening the app
 * on Monday to a register that silently shows 40 of 2491 doelen is the trap this feature is meant
 * to avoid. Closing the tab is the reset. Everything stored here is visible on screen while it
 * applies (the badge count, the doelsoortbalk, the search box), so a restored filter never hides
 * doelen without saying so.
 */
export const useDoelenfilter = create<DoelenfilterState>()(
  persist(
    (set) => ({
      filter: {},
      zoek: "",
      bron: "leerplandoelen",
      faseVanKlas: null,
      stelFilter: (filter) => set({ filter }),
      stelZoek: (zoek) => set({ zoek }),
      stelBron: (bron) => set({ bron }),
      volgKlasFase: (fase) =>
        set((huidig) => ({ faseVanKlas: fase, filter: { ...huidig.filter, jaarFase: fase ?? undefined } })),
      // Deliberately leaves `faseVanKlas` alone: clearing is the teacher saying they want the whole
      // register, and re-applying the class preset a second later would undo exactly that.
      wisAlles: () => set({ filter: {}, zoek: "" }),
    }),
    { name: "jaarplanner-doelenfilter", storage: createJSONStorage(() => sessionStorage) },
  ),
);
