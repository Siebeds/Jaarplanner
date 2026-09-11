import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

/**
 * Where the app opens, and where an address it does not know lands (owner, 2026-09-11: the agenda,
 * not Doelen).
 *
 * Rendered through the real route table, because that is the thing that can drift: a test with a
 * route table of its own would pass with `App.tsx` pointing anywhere.
 *
 * The network is stubbed with a promise that never settles, so every screen stays in its loading
 * state and nothing here depends on what an API would answer.
 */
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const openOp = (pad: string) => {
  window.history.replaceState(null, "", pad);
  render(<App />);
};

describe("App", () => {
  it("opent op de agenda en niet op Doelen", async () => {
    openOp("/");
    await waitFor(() => expect(window.location.pathname).toBe("/agenda"));
  });

  it("stuurt een adres dat het niet kent naar de agenda", async () => {
    openOp("/bestaat-niet");
    await waitFor(() => expect(window.location.pathname).toBe("/agenda"));
  });

  it("opent Instellingen op het eerste onderdeel", async () => {
    openOp("/instellingen");
    await waitFor(() => expect(window.location.pathname).toBe("/instellingen/klassen"));
  });
});
