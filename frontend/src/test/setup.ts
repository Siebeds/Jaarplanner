import "@testing-library/jest-dom/vitest";

/**
 * jsdom has no `window.matchMedia`, and since the agenda became a time grid the app reads it during
 * render (`lib/scherm.ts`, `state/weergave.ts`). Without this, any test that renders a screen
 * through the real route table dies on a `TypeError` that says nothing about what it was testing.
 *
 * It answers "no match" to everything, which is the phone layout: the same default
 * `useMediaQuery` falls back to when there is no browser to ask. A test that wants the wide branch
 * overrides this itself. jsdom has no viewport to derive an honest answer from, so a cleverer stub
 * here would only be guessing in a way a reader could mistake for a real measurement.
 */
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
