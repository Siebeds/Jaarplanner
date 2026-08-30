import { create } from "zustand";

interface HoekenpaneelState {
  open: boolean;
  zet: (open: boolean) => void;
  wissel: () => void;
}

/**
 * Whether the agenda's hoekenpaneel is open.
 *
 * **It is a store and not component state because three parts of the app change shape together**
 * (owner, 2026-08-30): the navigation collapses to an icon rail, the panel takes the space the
 * labels were using, and the main region's inline padding follows. Those three live in
 * `Navigatie`, `Agendascherm` and `Schil`, which have no common parent below the router, so the
 * alternative was threading a boolean and a setter through the shell into every screen.
 *
 * **Deliberately NOT persisted**, unlike the doelenfilter beside it. A filter is a step in a sitting
 * that a teacher would have to rebuild; an open panel is a thing she can see and close in one click,
 * and an app that reopens on a half-covered navigation is worse than one that opens plainly.
 *
 * **It is not reset on navigation either, and that is on purpose:** only the agenda renders the
 * panel, so leaving the screen already hides it, and coming back to a panel she left open is the
 * behaviour she asked for by opening it.
 */
export const useHoekenpaneel = create<HoekenpaneelState>((set) => ({
  open: false,
  zet: (open) => set({ open }),
  wissel: () => set((s) => ({ open: !s.open })),
}));
