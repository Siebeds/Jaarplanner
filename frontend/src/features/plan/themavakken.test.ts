import { describe, expect, it } from "vitest";
import { themaIdsOpDag, themavakken, vakOpDag } from "./themavakken";

/**
 * The bug these pin, in one sentence: the agenda described the themaperiode of ONE anchored day over
 * a grid showing a whole month, and on this school year's periods that anchor is systematically one
 * period behind.
 *
 * So the cases below are the real calendar, not invented dates. The periods end on the 1st, which is
 * exactly what made a month-paging anchor land outside the month it was describing.
 */
const BLOKKEN = [
  { start: "2026-09-01", eind: "2026-10-01" },
  { start: "2026-10-02", eind: "2026-11-01" },
  { start: "2026-11-09", eind: "2026-12-20" },
];

const PLAATSINGEN = [
  { blokStart: "2026-09-01", themaId: "t-klas", themaNaam: "Ik en mijn klas", status: "Manueel" },
  { blokStart: "2026-11-09", themaId: "t-schoon", themaNaam: "TR Schoon", status: "Manueel" },
];

const namen = (vak: { themas: readonly { naam: string }[] } | undefined) =>
  (vak?.themas ?? []).map((thema) => thema.naam);

describe("themavakken", () => {
  it("geeft elke periode een vak, ook een periode zonder thema", () => {
    const vakken = themavakken(BLOKKEN, PLAATSINGEN);
    expect(vakken).toHaveLength(3);
    expect(vakken[1]).toMatchObject({ van: "2026-10-02", tot: "2026-11-01", themas: [] });
  });

  it("laat een geweigerd thema weg", () => {
    const vakken = themavakken(BLOKKEN, [
      ...PLAATSINGEN,
      { blokStart: "2026-10-02", themaId: "t-water", themaNaam: "Water", status: "Geweigerd" },
    ]);
    expect(vakken[1].themas).toEqual([]);
  });

  it("noemt hetzelfde thema niet twee keer", () => {
    const vakken = themavakken(BLOKKEN, [
      ...PLAATSINGEN,
      { blokStart: "2026-11-09", themaId: "t-schoon", themaNaam: "TR Schoon", status: "Voorgesteld" },
    ]);
    expect(namen(vakken[2])).toEqual(["TR Schoon"]);
  });
});

describe("vakOpDag", () => {
  const vakken = themavakken(BLOKKEN, PLAATSINGEN);

  it("geeft voor een dag in november het thema van NOVEMBER, niet dat van de vorige periode", () => {
    // The whole point. Under the old derivation a november grid anchored on 1 november reported the
    // period 2 okt - 1 nov, which holds no thema, and the thema chip vanished.
    expect(namen(vakOpDag(vakken, "2026-11-15"))).toEqual(["TR Schoon"]);
    expect(namen(vakOpDag(vakken, "2026-11-09"))).toEqual(["TR Schoon"]);
  });

  it("kent 1 november nog aan de vorige periode toe, want daar hoort die dag echt", () => {
    // Not a workaround: 1 november IS the last day of that period. The fault was never this
    // assignment, it was describing a whole month with it.
    expect(vakOpDag(vakken, "2026-11-01")).toMatchObject({ van: "2026-10-02", themas: [] });
  });

  it("geeft niets voor een dag tussen twee periodes", () => {
    expect(vakOpDag(vakken, "2026-11-05")).toBeUndefined();
  });

  it("geeft niets buiten het schooljaar", () => {
    expect(vakOpDag(vakken, "2026-08-20")).toBeUndefined();
    expect(vakOpDag(vakken, "2027-08-20")).toBeUndefined();
  });

  it("neemt de grenzen zelf mee", () => {
    expect(vakOpDag(vakken, "2026-09-01")?.van).toBe("2026-09-01");
    expect(vakOpDag(vakken, "2026-10-01")?.van).toBe("2026-09-01");
    expect(vakOpDag(vakken, "2026-10-02")?.van).toBe("2026-10-02");
  });
});

describe("themaIdsOpDag", () => {
  const vakken = themavakken(BLOKKEN, PLAATSINGEN);

  it("geeft de thema's van de dag waarvoor de kiezer opengaat, niet van de ankerdag", () => {
    // The picker opened for 12 november used to ask the anchored day's period. With the anchor on
    // 1 november that period holds nothing, so the plus offered an empty list on a day whose own
    // period holds TR Schoon: an activiteit a teacher could see planned but not add.
    expect(themaIdsOpDag(vakken, "2026-11-12")).toEqual(["t-schoon"]);
    expect(themaIdsOpDag(vakken, "2026-11-01")).toEqual([]);
  });

  it("geeft een lege lijst tussen twee periodes", () => {
    expect(themaIdsOpDag(vakken, "2026-11-05")).toEqual([]);
  });
});
