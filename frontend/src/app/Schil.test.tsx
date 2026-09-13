import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Schil } from "./Schil";

/**
 * Which reservation the shell makes, read off the class it chooses.
 *
 * jsdom cannot measure the padding, so this does not prove 296px; the browser pass does that. What it
 * pins is the decision, which is the half that can silently go wrong: `Navigatie` collapsing to its
 * rail on a route where this component still reserves 240 runs the first inches of the page under
 * Instellingen's column.
 */
/*
  The navigation inside the shell reads who is signed in (E6-01), so it needs a query client. The
  network never answers here: the signed-in row draws nothing and the shell is what it was before.
*/
const rendermetPad = (pad: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[pad]}>
        <Routes>
          <Route element={<Schil />}>
            <Route path="*" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Schil", () => {
  it("houdt in Instellingen plaats vrij voor de kolom naast de rail", () => {
    const { container } = rendermetPad("/instellingen/klassen");
    expect(container.firstElementChild).toHaveClass("lg:pl-[18.5rem]");
  });

  it("houdt elders alleen de breedte van de navigatie vrij", () => {
    const { container } = rendermetPad("/doelen");
    expect(container.firstElementChild).toHaveClass("lg:pl-60");
  });
});
