import { createContext, useContext } from "react";

/**
 * The state behind the "Uitleg tonen" switch (E9-01): the context, the hook that reads it, and the persistence.
 *
 * **Split from `uitleg.tsx` for a lint rule, and the split is worth keeping anyway.** `react-refresh/only-export-components`
 * rejects a module that exports both a component and a hook, because Fast Refresh cannot tell what to remount. Putting
 * the non-component half here also means the storage functions are unit-testable without rendering anything.
 *
 * The rule about **which sentences this governs** lives on `Uitleg` in `uitleg.tsx`, next to the component a call site
 * actually reaches for. It is the load-bearing part of this feature; do not re-derive it from here.
 */

/**
 * The persisted key. Namespaced, because `localStorage` is shared across everything on the origin and an unprefixed
 * `"uitleg"` is exactly the name a second app would also pick.
 */
const OPSLAGSLEUTEL = "jaarplanner.uitleg";

/**
 * Reads the stored preference. **Off unless the teacher has switched it on**, per the owner's ruling of 2026-08-19.
 *
 * **Wrapped, because `localStorage` throws rather than returning null in some configurations** — Safari's private
 * browsing is the usual one. A header control that could take the whole app down on mount would be a poor trade for a
 * help toggle, so a failure degrades to the default.
 *
 * Meant to be called from `useState`'s initialiser rather than from an effect, so a teacher who has switched help
 * **on** does not watch the page render without it and then reflow. That flash is the kind of thing only opening the
 * app in a browser catches.
 *
 * The stored value is the word `"aan"` rather than `"true"`: anything else, including a value left by an older or
 * newer version of this app, reads as off, which is the safe direction.
 */
export function leesVoorkeur(): boolean {
  try {
    return window.localStorage.getItem(OPSLAGSLEUTEL) === "aan";
  } catch {
    return false;
  }
}

export function bewaarVoorkeur(aan: boolean): void {
  try {
    window.localStorage.setItem(OPSLAGSLEUTEL, aan ? "aan" : "uit");
  } catch {
    // Ignored on purpose: the preference then lasts for this session only, which is a better outcome than an
    // exception escaping a click handler. Nothing else in the app depends on it having been written.
  }
}

export interface Uitlegcontext {
  /** Whether instructional prose is shown. **False by default.** */
  isAan: boolean;
  schakel: () => void;
}

/**
 * Defaults to off with a no-op toggle, so a component rendered **outside** the provider shows the quiet screen rather
 * than crashing or silently showing everything. Every existing component test mounts a card on its own, and this is
 * what lets those keep passing without each of them wiring up a provider.
 */
export const uitlegContext = createContext<Uitlegcontext>({ isAan: false, schakel: () => {} });

/** The preference, for the switch itself and for the rare call site that cannot use the `Uitleg` wrapper. */
export function useUitleg(): Uitlegcontext {
  return useContext(uitlegContext);
}
