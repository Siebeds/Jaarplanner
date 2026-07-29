import { describe, expect, it } from "vitest";

import {
  bouwRibbon,
  formatteerDatum,
  formatteerPeriode,
  formatteerWeken,
  plaatsingenIn,
  vervallenPlaatsingen,
} from "./kalenderFormat";
import type { Planningsblok, Planningsonderbreking, Themaplaatsing } from "./types";

/**
 * The arithmetic and ordering the ribbon's honesty rests on (E3-06). These are the claims the picture
 * makes about the school year, so they are tested without rendering: a wrong gap position or a dropped
 * stale placement is a lie about the plan, not a cosmetic bug.
 */

function blok(ordinaal: number, start: string, eind: string, aantalLesdagen = 30): Planningsblok {
  return { ordinaal, start, eind, ouderOrdinaal: null, aantalLesdagen };
}

function plaatsing(overrides: Partial<Themaplaatsing> & { id: string }): Themaplaatsing {
  return {
    themaId: "t",
    themaNaam: "Thema",
    blokNiveau: "Themaperiode",
    blokStart: "2026-09-01",
    blokEind: "2026-10-01",
    blokOrdinaal: 1,
    isVervallen: false,
    status: "Voorgesteld",
    aiMotivatie: null,
    vergrendeld: false,
    doelcodes: [],
    ...overrides,
  };
}

describe("formatteerDatum", () => {
  it("formats an ISO date as Dutch day + month without a trailing period", () => {
    expect(formatteerDatum("2026-09-01")).toBe("1 sep");
    expect(formatteerDatum("2026-12-20")).toBe("20 dec");
  });

  it("does not shift the date across midnight (parsed as local, never UTC)", () => {
    // `new Date("2026-09-01")` is UTC midnight and renders as 31 August west of Greenwich.
    expect(formatteerDatum("2026-09-01")).toBe("1 sep");
  });

  it("formats a span", () => {
    expect(formatteerPeriode("2026-09-01", "2026-10-01")).toBe("1 sep – 1 okt");
  });
});

describe("formatteerWeken", () => {
  it("renders weeks to one decimal with a Dutch comma", () => {
    // 31 open days ÷ 7 = 4,4 — the approved wireframe's own figure for 1 sep – 1 okt.
    expect(formatteerWeken(31)).toBe("4,4");
    expect(formatteerWeken(42)).toBe("6,0");
  });
});

describe("bouwRibbon", () => {
  const herfst: Planningsonderbreking = {
    naam: "Herfstvakantie",
    start: "2026-11-02",
    eind: "2026-11-08",
  };

  it("places a vakantie between the two blocks it separates", () => {
    const segmenten = bouwRibbon(
      [blok(1, "2026-09-01", "2026-11-01"), blok(2, "2026-11-09", "2026-12-20")],
      [herfst],
    );

    expect(segmenten.map((s) => s.soort)).toEqual(["blok", "onderbreking", "blok"]);
    expect(segmenten[1]).toMatchObject({ onderbreking: { naam: "Herfstvakantie" } });
  });

  it("drops a vakantie at the edge of the year — a gap with no teaching time on one side", () => {
    const segmenten = bouwRibbon([blok(1, "2026-11-09", "2026-12-20")], [herfst]);

    expect(segmenten.map((s) => s.soort)).toEqual(["blok"]);
  });

  it("keeps blocks in order when there are no vakanties at all", () => {
    const segmenten = bouwRibbon(
      [blok(1, "2026-09-01", "2026-10-01"), blok(2, "2026-10-02", "2026-11-01")],
      [],
    );

    expect(segmenten).toHaveLength(2);
    expect(segmenten.every((s) => s.soort === "blok")).toBe(true);
  });
});

describe("plaatsingenIn", () => {
  it("matches a placement to its block on the start date, not the ordinal", () => {
    const eerste = blok(1, "2026-09-01", "2026-10-01");
    const tweede = blok(2, "2026-10-02", "2026-11-01");
    const plaatsingen = [
      plaatsing({ id: "a", blokStart: "2026-09-01" }),
      plaatsing({ id: "b", blokStart: "2026-10-02" }),
    ];

    expect(plaatsingenIn(plaatsingen, eerste).map((p) => p.id)).toEqual(["a"]);
    expect(plaatsingenIn(plaatsingen, tweede).map((p) => p.id)).toEqual(["b"]);
  });

  it("never puts a stale placement in a block", () => {
    const eerste = blok(1, "2026-09-01", "2026-10-01");
    const plaatsingen = [plaatsing({ id: "a", blokStart: "2026-09-01", isVervallen: true })];

    expect(plaatsingenIn(plaatsingen, eerste)).toEqual([]);
  });
});

describe("vervallenPlaatsingen", () => {
  const blokken = [blok(1, "2026-09-01", "2026-10-01")];

  it("collects a placement the server flagged as stale", () => {
    const plaatsingen = [plaatsing({ id: "a", blokStart: "2026-09-01", isVervallen: true })];

    expect(vervallenPlaatsingen(plaatsingen, blokken).map((p) => p.id)).toEqual(["a"]);
  });

  it("also collects one whose date matches no block, even if the server did not flag it", () => {
    // Otherwise a disagreement between the two views would make a thema vanish from the plan
    // entirely — worse than showing it as needing attention (directie 2026-07-28).
    const plaatsingen = [plaatsing({ id: "a", blokStart: "2026-10-05", isVervallen: false })];

    expect(vervallenPlaatsingen(plaatsingen, blokken).map((p) => p.id)).toEqual(["a"]);
  });

  it("leaves a healthy placement alone", () => {
    const plaatsingen = [plaatsing({ id: "a", blokStart: "2026-09-01" })];

    expect(vervallenPlaatsingen(plaatsingen, blokken)).toEqual([]);
  });

  it("accounts for every placement exactly once, across blocks and the stale list", () => {
    const plaatsingen = [
      plaatsing({ id: "gezond", blokStart: "2026-09-01" }),
      plaatsing({ id: "ziek", blokStart: "2027-01-01" }),
    ];

    const inBlokken = blokken.flatMap((b) => plaatsingenIn(plaatsingen, b));
    const vervallen = vervallenPlaatsingen(plaatsingen, blokken);

    expect([...inBlokken, ...vervallen].map((p) => p.id).sort()).toEqual(["gezond", "ziek"]);
  });
});
