import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Schil } from "./Schil";

/**
 * Which reservation the shell makes, read off the class it chooses.
 *
 * jsdom cannot measure the padding, so this does not prove 296px; the browser pass does that. What it
 * pins is the decision, which is the half that can silently go wrong: `Navigatie` collapsing to its
 * rail on a route where this component still reserves 240 runs the first inches of the page under
 * Instellingen's column.
 */
const rendermetPad = (pad: string) =>
  render(
    <MemoryRouter initialEntries={[pad]}>
      <Routes>
        <Route element={<Schil />}>
          <Route path="*" element={null} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

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
