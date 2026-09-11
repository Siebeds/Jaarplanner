import { useMatch } from "react-router-dom";
import { useHoekenpaneel } from "../state/hoekenpaneel";

/**
 * Whether a second column stands beside the navigation from `lg`.
 *
 * When one does, `Navigatie` collapses to its 56px rail and `Schil` reserves 56 + 240 instead of 240.
 * Two things put a column there: the agenda's hoekenpaneel while it is open, and Instellingen, which
 * lists its parts in a column of its own for as long as the teacher is in there (owner, 2026-09-11).
 *
 * **Asked here, once, because the two components must agree.** A rail beside a column the shell did
 * not reserve runs the first inches of every screen underneath it, and the reverse leaves 240px of
 * empty ground between the navigation and the page.
 *
 * Both hooks are called on every render and only then combined, so the second one is never skipped.
 */
export function useZijkolom(): boolean {
  const paneelOpen = useHoekenpaneel((s) => s.open);
  const opInstellingen = useMatch("/instellingen/*") !== null;
  return paneelOpen || opInstellingen;
}
