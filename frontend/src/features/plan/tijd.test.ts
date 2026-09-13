import { describe, expect, it } from "vitest";
import { DAGBEGIN, DAGEINDE, HEEL_DE_DAG, alsTijd, kolommen, minuten, rond, toonTijd } from "./tijd";

/**
 * The arithmetic the time grid is drawn from (ADR-0028).
 *
 * These are here because every one of them can be wrong without looking wrong: a block drawn fifteen minutes off, or
 * two overlapping blocks each drawn full width on top of each other, is a plausible-looking calendar that lies about
 * the plan. The layout function in particular is the part a screenshot cannot check.
 */
describe("tijd", () => {
  it("leest en schrijft de tijden zoals de API ze stuurt", () => {
    expect(minuten("13:30:00")).toBe(810);
    expect(minuten("09:05")).toBe(545);
    expect(alsTijd(810)).toBe("13:30:00");
    // Always with seconds, because the server binds TimeOnly and a bare "13:30" is a different contract.
    expect(alsTijd(0)).toBe("00:00:00");
    expect(alsTijd(24 * 60)).toBe("23:59:00");
  });

  it("toont een uur zoals een leerkracht het schrijft, en zoals de server het weigert", () => {
    // The server's refusal says "om 9:00" (Dagnotatie.Formatteer), so the block may not say "09:00".
    expect(toonTijd("09:00:00")).toBe("9:00");
    expect(toonTijd("13:45:00")).toBe("13:45");
    expect(toonTijd(545)).toBe("9:05");
  });

  it("rondt af op een kwartier", () => {
    expect(rond(517)).toBe(510);
    expect(rond(523)).toBe(525);
  });

  it("legt vast dat het etmaal getekend wordt en dat 7u-18u daarbinnen valt", () => {
    // Constants, and the title says so: what the grid DRAWS and OPENS ON is asserted where it is drawn, in
    // `Tijdraster.test.tsx`. What is pinned here is that the two are different things, because confusing them is how
    // an hour outside the school day silently stops being clickable (owner, 2026-09-11).
    expect(HEEL_DE_DAG).toEqual({ van: 0, tot: 24 * 60 });
    expect([DAGBEGIN, DAGEINDE]).toEqual([7 * 60, 18 * 60]);
  });

  describe("kolommen", () => {
    it("laat wat elkaar niet raakt over de volle breedte staan", () => {
      const plekken = kolommen([
        { id: "a", begin: 540, einde: 600 },
        // Starts exactly where the first stops: under it, not beside it.
        { id: "b", begin: 600, einde: 660 },
      ]);

      expect(plekken.get("a")).toEqual({ kolom: 0, kolommen: 1 });
      expect(plekken.get("b")).toEqual({ kolom: 0, kolommen: 1 });
    });

    it("zet wat overlapt naast elkaar", () => {
      const plekken = kolommen([
        { id: "a", begin: 540, einde: 660 },
        { id: "b", begin: 570, einde: 630 },
        { id: "c", begin: 600, einde: 690 },
      ]);

      expect(plekken.get("a")).toEqual({ kolom: 0, kolommen: 3 });
      expect(plekken.get("b")).toEqual({ kolom: 1, kolommen: 3 });
      // c overlaps a, and b has ended by the time it starts, so it takes b's column back.
      expect(plekken.get("c")).toEqual({ kolom: 2, kolommen: 3 });
    });

    it("geeft de breedte terug zodra een groepje afgelopen is", () => {
      const plekken = kolommen([
        { id: "ochtend-1", begin: 540, einde: 600 },
        { id: "ochtend-2", begin: 550, einde: 610 },
        { id: "namiddag", begin: 810, einde: 870 },
      ]);

      expect(plekken.get("ochtend-1")!.kolommen).toBe(2);
      // The afternoon is its own cluster: drawing it half width would make the day look busier than it is.
      expect(plekken.get("namiddag")).toEqual({ kolom: 0, kolommen: 1 });
    });

    it("is stabiel, ongeacht de volgorde waarin de dag binnenkomt", () => {
      const dag = [
        { id: "b", begin: 570, einde: 630 },
        { id: "a", begin: 540, einde: 660 },
      ];

      expect(kolommen(dag).get("a")).toEqual(kolommen([...dag].reverse()).get("a"));
    });
  });
});
