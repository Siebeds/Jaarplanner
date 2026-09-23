import { describe, expect, it } from "vitest";
import type { Subthemareeks } from "./subthemareeksen";
import type { Themavak } from "./themavakken";
import { subthemabalken, themabalken } from "./weekbalkindeling";

/** The bars of the week grid's header (FB-090): one per unbroken stretch of columns, not one per day. */
const WEEK = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"];
const lesdagen = (datums = WEEK) => datums.map((datum) => ({ datum, isLesdag: true, buitenSchooljaar: false }));

const vak = (plaatsingId: string, van: string, tot: string): Themavak => ({
  plaatsingId,
  van,
  tot,
  themas: [{ id: `t-${plaatsingId}`, naam: plaatsingId }],
});

const reeks = (subthemaId: string, van: string, tot: string): Subthemareeks => ({
  subthemaId,
  subthemaNaam: subthemaId,
  themaId: "t1",
  themaNaam: "t1",
  van,
  tot,
  aantalDagen: 1,
});

/** The per-day map `reeksenPerDag` builds, for the days of `WEEK` a run covers. */
function perDag(...reeksen: Subthemareeks[]): Map<string, Subthemareeks[]> {
  const kaart = new Map<string, Subthemareeks[]>();
  for (const datum of WEEK) {
    const op = reeksen.filter((r) => r.van <= datum && r.tot >= datum);
    if (op.length > 0) kaart.set(datum, op);
  }
  return kaart;
}

describe("themabalken", () => {
  it("maakt van een thema dat de hele week loopt één balk, met een pijltje aan elke kant", () => {
    const balken = themabalken(lesdagen(), [vak("herfst", "2026-09-07", "2026-09-25")]);

    expect(balken).toHaveLength(1);
    expect(balken[0]).toMatchObject({ van: 0, tot: 4, begint: false, doorVoor: true, doorNa: true });
  });

  it("stopt de balk waar een thema eindigt en begint een nieuwe waar het volgende start", () => {
    const balken = themabalken(lesdagen(), [
      vak("herfst", "2026-09-07", "2026-09-16"),
      vak("dieren", "2026-09-17", "2026-10-02"),
    ]);

    expect(balken.map((b) => [b.item.plaatsingId, b.van, b.tot])).toEqual([
      ["herfst", 0, 2],
      ["dieren", 3, 4],
    ]);
    // The first ends on its last column; the second begins on its first, where the accent tick goes.
    expect(balken[0]).toMatchObject({ doorVoor: true, doorNa: false, begint: false });
    expect(balken[1]).toMatchObject({ doorVoor: false, doorNa: true, begint: true });
  });

  it("breekt op een gesloten dag, en noemt de twee helften allebei doorlopend", () => {
    const dagen = lesdagen().map((dag, i) => (i === 2 ? { ...dag, isLesdag: false } : dag));
    const balken = themabalken(dagen, [vak("herfst", "2026-09-07", "2026-09-25")]);

    expect(balken.map((b) => [b.van, b.tot, b.doorVoor, b.doorNa])).toEqual([
      [0, 1, true, true],
      [3, 4, true, true],
    ]);
  });

  it("tekent niets op een dag zonder thema of buiten het schooljaar", () => {
    const dagen = lesdagen().map((dag, i) => (i === 4 ? { ...dag, buitenSchooljaar: true } : dag));
    const balken = themabalken(dagen, [vak("herfst", "2026-09-15", "2026-09-30")]);

    expect(balken.map((b) => [b.van, b.tot])).toEqual([[1, 3]]);
    expect(balken[0].begint).toBe(true);
  });
});

describe("subthemabalken", () => {
  it("zet twee runs op één dag onder elkaar, en houdt elke run in zijn rij over de hele week", () => {
    const oud = reeks("de speelhoek", "2026-09-07", "2026-09-16");
    const nieuw = reeks("de herfstwandeling", "2026-09-16", "2026-09-25");
    const { rijen, teveel } = subthemabalken(lesdagen(), perDag(oud, nieuw));

    expect(rijen.map((rij) => rij.map((b) => [b.item.subthemaId, b.van, b.tot]))).toEqual([
      [["de speelhoek", 0, 2]],
      [["de herfstwandeling", 2, 4]],
    ]);
    expect(rijen[1][0]).toMatchObject({ begint: true, doorVoor: false, doorNa: true });
    expect(teveel.every((n) => n === 0)).toBe(true);
  });

  it("hergebruikt een rij zodra de run erin voorbij is", () => {
    const eerste = reeks("a", "2026-09-14", "2026-09-15");
    const tweede = reeks("b", "2026-09-17", "2026-09-18");
    const { rijen } = subthemabalken(lesdagen(), perDag(eerste, tweede));

    expect(rijen).toHaveLength(1);
    expect(rijen[0].map((b) => b.item.subthemaId)).toEqual(["a", "b"]);
  });

  it("telt een derde run op dezelfde dag in plaats van hem te tekenen", () => {
    const { rijen, teveel } = subthemabalken(
      lesdagen(),
      perDag(reeks("a", "2026-09-14", "2026-09-18"), reeks("b", "2026-09-14", "2026-09-18"), reeks("c", "2026-09-16", "2026-09-16")),
    );

    expect(rijen).toHaveLength(2);
    expect(teveel).toEqual([0, 0, 1, 0, 0]);
  });
});
