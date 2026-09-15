import "@testing-library/jest-dom/vitest";
import { BREED } from "../lib/scherm";

/**
 * jsdom has no `window.matchMedia`, and since the agenda became a time grid the app reads it during
 * render (`lib/scherm.ts`, `state/weergave.ts`). Without this, any test that renders a screen
 * through the real route table dies on a `TypeError` that says nothing about what it was testing.
 *
 * The default is "no match", which is the phone layout: the same answer `useMediaQuery` falls back
 * to when there is no browser to ask. jsdom has no viewport to derive an honest answer from, so a
 * cleverer default here would only be guessing in a way a reader could mistake for a measurement.
 *
 * **A default is not a test.** A screen that behaves differently above `BREED` has that branch
 * silently unasserted unless a test says which width it means, so use `zetSchermbreedte` below and
 * assert both. Reading this stub as coverage is how the wide branch breaks unnoticed.
 */
let breed = false;

/**
 * Answer `BREED` as a wide screen (`true`) or a phone (`false`) for the rest of the test file.
 *
 * Call it **before** rendering: the stub fires no `change` event, so an already-mounted component
 * keeps the width it was rendered at. And vitest restores module state between files, not between
 * tests in one file, so a test that flips it to `true` leaves it there for its siblings.
 */
export function zetSchermbreedte(isBreed: boolean): void {
  breed = isBreed;
}

window.matchMedia = (query: string): MediaQueryList =>
  ({
    matches: query === BREED ? breed : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

/**
 * jsdom has no `ResizeObserver` either, and Radix's popover measures the element it hangs from with one (FB-018).
 * A stub that never reports is the honest answer for the reason given above: jsdom lays nothing out, so there is no
 * size to report. Where the window sits is the browser pass's to check.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
