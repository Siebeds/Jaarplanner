import { describe, expect, it } from "vitest";
import { verdeelDagen } from "./verdeling";

/**
 * The date arithmetic behind the "zo komt het te staan" preview.
 *
 * Worth its own test because a wrong answer here still looks right on screen: five plausible dates
 * with two of them equal is a preview a teacher accepts and a server half refuses, since it takes
 * one activiteit per day per plan.
 */
const DAGEN = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];

describe("verdeelDagen", () => {
  it("zet ze achter elkaar vanaf de eerste dag", () => {
    expect(verdeelDagen(DAGEN, 3, "achterElkaar")).toEqual(["01", "02", "03"]);
  });

  it("laat verspreid op de eerste en de laatste dag uitkomen", () => {
    const uitkomst = verdeelDagen(DAGEN, 4, "verspreid");
    expect(uitkomst[0]).toBe("01");
    expect(uitkomst[uitkomst.length - 1]).toBe("10");
  });

  it("geeft nooit twee activiteiten dezelfde dag", () => {
    for (const aantal of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      for (const verdeling of ["achterElkaar", "verspreid"] as const) {
        const uitkomst = verdeelDagen(DAGEN, aantal, verdeling);
        expect(new Set(uitkomst).size).toBe(uitkomst.length);
      }
    }
  });

  it("houdt de volgorde van de activiteiten aan", () => {
    const uitkomst = verdeelDagen(DAGEN, 5, "verspreid");
    expect([...uitkomst].sort()).toEqual(uitkomst);
  });

  it("geeft er niet meer dan er dagen zijn", () => {
    expect(verdeelDagen(["01", "02"], 5, "verspreid")).toEqual(["01", "02"]);
    expect(verdeelDagen(["01", "02"], 5, "achterElkaar")).toEqual(["01", "02"]);
  });

  it("geeft niets terug zonder dagen of zonder activiteiten", () => {
    expect(verdeelDagen([], 3, "verspreid")).toEqual([]);
    expect(verdeelDagen(DAGEN, 0, "verspreid")).toEqual([]);
  });

  it("zet een enkele activiteit op de eerste dag, ook verspreid", () => {
    expect(verdeelDagen(DAGEN, 1, "verspreid")).toEqual(["01"]);
  });
});
