import { create } from "zustand";

/** Which list the agenda's side panel shows: the hoekenfiches, or the algemene fiches. */
export type Paneelsoort = "hoeken" | "algemeen";

interface HoekenpaneelState {
  open: boolean;
  /**
   * Which list the panel shows. Kept while the panel is closed, so the column that slides out still has its content
   * to animate, and so a panel that is reopened opens on the list she was using.
   */
  soort: Paneelsoort;
  zet: (open: boolean) => void;
  /**
   * What a switch does: open the panel on this list, or close it when this list is already the one showing. Pressing
   * the other switch while the panel is open swaps the list without closing it first.
   */
  kies: (soort: Paneelsoort) => void;
}

/**
 * Whether the agenda's side panel is open, and which list it shows.
 *
 * **It is a store and not component state because three parts of the app change shape together**
 * (owner, 2026-08-30): the navigation collapses to an icon rail, the panel takes the space the
 * labels were using, and the main region's inline padding follows. Those three live in
 * `Navigatie`, `Agendascherm` and `Schil`, which have no common parent below the router, so the
 * alternative was threading a boolean and a setter through the shell into every screen.
 *
 * **Two lists, one column** (owner, 2026-09-14: "ik wil twee secties in het meest linkse side bar, hoekenfiches en
 * algemene fiches, niet gegroepeerd als fiches"). Each has its own switch, and both open the same 240px column,
 * because the navigation, the rail and `Schil`'s reservation only ever need to know whether a column stands there.
 * That is why `open` stays a boolean and the list is a second field rather than `open` becoming the list.
 *
 * **Deliberately NOT persisted**, unlike the doelenfilter beside it. A filter is a step in a sitting
 * that a teacher would have to rebuild; an open panel is a thing she can see and close in one click,
 * and an app that reopens on a half-covered navigation is worse than one that opens plainly.
 *
 * **It IS reset when the teacher leaves the agenda** (owner, 2026-08-31), and the reset lives in
 * `Navigatie` rather than here, because this file cannot see the router.
 */
export const useHoekenpaneel = create<HoekenpaneelState>((set) => ({
  open: false,
  soort: "hoeken",
  zet: (open) => set({ open }),
  kies: (soort) => set((s) => (s.open && s.soort === soort ? { open: false } : { open: true, soort })),
}));
