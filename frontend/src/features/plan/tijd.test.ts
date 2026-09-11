import { describe, expect, it } from "vitest";
import { DAGBEGIN, DAGEINDE, alsTijd, kolommen, minuten, rasterbereik, rond, toonTijd } from "./tijd";

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

  it("verbreedt het raster voor wat erbuiten valt, in plaats van het af te knippen", () => {
    expect(rasterbereik([])).toEqual({ van: DAGBEGIN, tot: DAGEINDE });

    // A trip leaving at 6:30 pulls the top of the grid to 6:00; a block that fits changes nothing.
    expect(rasterbereik([{ begin: 390, einde: 480 }]).van).toBe(360);
    expect(rasterbereik([{ begin: 600, einde: 650 }])).toEqual({ van: DAGBEGIN, tot: DAGEINDE });
    // Rounded UP to the whole hour: a block ending at 19:05 needs the grid to reach 20:00, or its last five
    // minutes are drawn outside it.
    expect(rasterbereik([{ begin: 1020, einde: 1145 }]).tot).toBe(1200);
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
