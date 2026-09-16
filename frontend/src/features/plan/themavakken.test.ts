import { describe, expect, it } from "vitest";
import { themablokken, themaIdsOpDag, themavakken, vakOpDag } from "./themavakken";

/**
 * A thema placement is a stretch of days with its own first and last day (ADR-0053), so the agenda looks each day up
 * against the placements themselves. The cases are a real calendar: a thema split around the herfstvakantie is two
 * placements, and a week the teacher left open has no thema.
 */
const PLAATSINGEN = [
  { id: "p-klas", van: "2026-09-01", tot: "2026-09-25", themaId: "t-klas", themaNaam: "Ik en mijn klas", status: "Manueel" },
  { id: "p-herfst-2", van: "2026-11-09", tot: "2026-11-20", themaId: "t-herfst", themaNaam: "Herfst", status: "Manueel" },
  { id: "p-herfst-1", van: "2026-10-19", tot: "2026-10-30", themaId: "t-herfst", themaNaam: "Herfst", status: "Manueel" },
];

const namen = (vak: { themas: readonly { naam: string }[] } | undefined) =>
  (vak?.themas ?? []).map((thema) => thema.naam);

describe("themablokken", () => {
  it("geeft elke plaatsing als stuk dagen, op volgorde van de eerste dag", () => {
    expect(themablokken(PLAATSINGEN).map((blok) => [blok.plaatsingId, blok.start, blok.eind])).toEqual([
      ["p-klas", "2026-09-01", "2026-09-25"],
      ["p-herfst-1", "2026-10-19", "2026-10-30"],
      ["p-herfst-2", "2026-11-09", "2026-11-20"],
    ]);
  });

  it("laat een geweigerd voorstel weg", () => {
    const blokken = themablokken([
      ...PLAATSINGEN,
      { id: "p-water", van: "2026-10-05", tot: "2026-10-16", themaId: "t-water", themaNaam: "Water", status: "Geweigerd" },
    ]);
    expect(blokken.map((blok) => blok.plaatsingId)).not.toContain("p-water");
  });
});

describe("themavakken", () => {
  it("geeft elke plaatsing een vak met haar thema", () => {
    const vakken = themavakken(PLAATSINGEN);
    expect(vakken).toHaveLength(3);
    expect(vakken[1]).toEqual({
      plaatsingId: "p-herfst-1",
      van: "2026-10-19",
      tot: "2026-10-30",
      themas: [{ id: "t-herfst", naam: "Herfst" }],
    });
  });
});

describe("vakOpDag", () => {
  const vakken = themavakken(PLAATSINGEN);

  it("geeft het thema van die dag, ook na een vakantie", () => {
    expect(namen(vakOpDag(vakken, "2026-10-19"))).toEqual(["Herfst"]);
    expect(namen(vakOpDag(vakken, "2026-11-12"))).toEqual(["Herfst"]);
  });

  it("geeft niets in een week zonder thema of in de vakantie", () => {
    expect(vakOpDag(vakken, "2026-10-05")).toBeUndefined();
    expect(vakOpDag(vakken, "2026-11-04")).toBeUndefined();
  });

  it("neemt de grenzen zelf mee", () => {
    expect(vakOpDag(vakken, "2026-09-01")?.plaatsingId).toBe("p-klas");
    expect(vakOpDag(vakken, "2026-09-25")?.plaatsingId).toBe("p-klas");
    expect(vakOpDag(vakken, "2026-09-26")).toBeUndefined();
  });
});

describe("themaIdsOpDag", () => {
  const vakken = themavakken(PLAATSINGEN);

  it("geeft het thema van de dag waarvoor de kiezer opengaat", () => {
    expect(themaIdsOpDag(vakken, "2026-11-12")).toEqual(["t-herfst"]);
  });

  it("geeft een lege lijst op een dag zonder thema", () => {
    expect(themaIdsOpDag(vakken, "2026-10-07")).toEqual([]);
  });
});
