import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BREED, useMediaQuery } from "./scherm";
import { zetSchermbreedte } from "../test/setup";

/**
 * That `zetSchermbreedte` actually reaches `useMediaQuery`, in both directions.
 *
 * Without this, the test harness's own default is the only thing anyone has ever seen it answer,
 * and a screen written against the wide branch would be asserted by nobody. This is the demo the
 * stub's doc comment points at: two lines, and the wide branch stops being theoretical.
 */
describe("useMediaQuery in tests", () => {
  it("leest een telefoonbreedte", () => {
    zetSchermbreedte(false);
    expect(renderHook(() => useMediaQuery(BREED)).result.current).toBe(false);
  });

  it("leest een breed scherm", () => {
    zetSchermbreedte(true);
    expect(renderHook(() => useMediaQuery(BREED)).result.current).toBe(true);
  });

  it("laat een andere query met rust", () => {
    zetSchermbreedte(true);
    expect(renderHook(() => useMediaQuery("(prefers-color-scheme: dark)")).result.current).toBe(false);
  });
});

describe("useMediaQuery en herteken (TB-071)", () => {
  it("schrijft zich één keer in op de mediaquery, niet bij elke render opnieuw", () => {
    const echt = window.matchMedia;
    const inschrijvingen = vi.fn();
    window.matchMedia = (query: string) => ({ ...echt(query), addEventListener: inschrijvingen }) as MediaQueryList;
    try {
      const { rerender } = renderHook(() => useMediaQuery(BREED));
      rerender();
      rerender();
      expect(inschrijvingen).toHaveBeenCalledTimes(1);
    } finally {
      window.matchMedia = echt;
    }
  });
});
