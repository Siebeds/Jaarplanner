import { useSyncExternalStore } from "react";

/**
 * One `subscribe` per query, kept outside render. `useSyncExternalStore` resubscribes whenever it receives a new
 * `subscribe` function, so an inline arrow tore down and re-added the media-query listener on every render.
 */
const inschrijvingen = new Map<string, (herteken: () => void) => () => void>();

function inschrijvingVoor(query: string) {
  let inschrijving = inschrijvingen.get(query);
  if (!inschrijving) {
    inschrijving = (herteken) => {
      const lijst = window.matchMedia(query);
      lijst.addEventListener("change", herteken);
      return () => lijst.removeEventListener("change", herteken);
    };
    inschrijvingen.set(query, inschrijving);
  }
  return inschrijving;
}

/**
 * True when the viewport matches `query`.
 *
 * `useSyncExternalStore` rather than an effect plus state: the value is read during render from the
 * browser itself, so the first paint is already correct. The effect version renders the mobile
 * branch once on a desktop and then swaps, which on this app would mount a bottom sheet and
 * immediately replace it with a side panel, moving focus in the process.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    inschrijvingVoor(query),
    () => window.matchMedia(query).matches,
    // Server snapshot. There is no SSR here, but React calls it during hydration warnings, and
    // "not a wide screen" is the safer default: the phone layout works on a desktop, not the other
    // way round.
    () => false,
  );
}

/** The one breakpoint that changes behaviour rather than only spacing: list beside detail. */
export const BREED = "(min-width: 1024px)";
