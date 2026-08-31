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
 * **It IS reset when the teacher leaves the agenda** (owner, 2026-08-31), and the reset lives in
 * `Navigatie` rather than here, because this file cannot see the router. It used to be kept, on the
 * reasoning that only the agenda renders the panel so leaving the screen already hides it. That
 * reasoning was wrong about its own app: `Navigatie` collapses to a rail and `Schil` reserves 296px
 * off this flag alone, so a kept `true` left both of them dressed for a panel that had unmounted.
 */
export const useHoekenpaneel = create<HoekenpaneelState>((set) => ({
  open: false,
  zet: (open) => set({ open }),
  wissel: () => set((s) => ({ open: !s.open })),
}));
