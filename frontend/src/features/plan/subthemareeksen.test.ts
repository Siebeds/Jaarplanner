import { describe, expect, it } from "vitest";
import {
  reeksbereik,
  reeksenPerDag,
  subthemareeksen,
  subthemasInWeek,
  voorstelReeks,
  type Subthemareeks,
} from "./subthemareeksen";
import type { Dagweergave, GeplandeActiviteit, Subthemaperiode } from "../../lib/types";

/**
 * A run is DERIVED, and that is exactly why it needs a test: a band drawn across a calendar looks
 * equally convincing whether or not it covers the days it claims. Nothing in the model records a
 * subthemaperiode, so a wrong first day is a wrong sentence to the teacher who trusts it.
 */
const activiteit = (subthemaId: string, i: number): GeplandeActiviteit => ({
  plaatsingId: `${subthemaId}-${i}`,
  activiteitId: `a${i}`,
  activiteitNaam: `Activiteit ${i}`,
  activiteitType: "Spel",
  subthemaId,
  subthemaNaam: subthemaId === "s1" ? "de speelhoek" : "dieren in de herfst",
  themaId: "t",
  themaNaam: "Ik en mijn klas",
  begin: `0${9 + i}:00:00`,
  einde: `0${9 + i}:50:00`,
  status: "Aanvaard",
  kleur: null,
  doelcodes: [],
  valtBuitenThemaperiode: false,
});

const dag = (datum: string, ...subthemaIds: string[]): Dagweergave => ({
  datum,
  isLesdag: true,
  sluitingsnaam: null,
  activiteiten: subthemaIds.map((id, i) => activiteit(id, i)),
});

const september = [{ start: "2026-09-01", eind: "2026-10-01" }];
const tweePeriodes = [
  { start: "2026-09-01", eind: "2026-10-01" },
  { start: "2026-10-02", eind: "2026-11-06" },
];

describe("subthemareeksen", () => {
  it("spant van de eerste tot de laatste dag met een activiteit", () => {
    const reeksen = subthemareeksen(
      [dag("2026-09-01", "s1"), dag("2026-09-02"), dag("2026-09-04", "s1")],
      september,
    );

    expect(reeksen).toHaveLength(1);
    expect(reeksen[0]).toMatchObject({ subthemaNaam: "de speelhoek", van: "2026-09-01", tot: "2026-09-04", aantalDagen: 2 });
  });

  it("houdt twee subthema's apart", () => {
    const reeksen = subthemareeksen([dag("2026-09-01", "s1"), dag("2026-09-08", "s2")], september);

    expect(reeksen.map((r) => [r.subthemaId, r.van, r.tot])).toEqual([
      ["s1", "2026-09-01", "2026-09-01"],
      ["s2", "2026-09-08", "2026-09-08"],
    ]);
  });

  it("breekt de reeks op de periodegrens", () => {
    // The same subthema, planned in september and again in october. One run from 1 september to 5
    // october would draw a band over the whole month between, and over a period it never ran in.
    const reeksen = subthemareeksen([dag("2026-09-01", "s1"), dag("2026-10-05", "s1")], tweePeriodes);

    expect(reeksen).toHaveLength(2);
    expect(reeksen.map((r) => r.van)).toEqual(["2026-09-01", "2026-10-05"]);
  });

  it("telt twee activiteiten op dezelfde dag als één dag", () => {
    const reeksen = subthemareeksen([dag("2026-09-01", "s1", "s1")], september);

    expect(reeksen).toHaveLength(1);
    expect(reeksen[0].aantalDagen).toBe(1);
  });

  it("leest de grenzen niet uit de volgorde van het serverantwoord", () => {
    const reeksen = subthemareeksen([dag("2026-09-10", "s1"), dag("2026-09-03", "s1")], september);

    expect(reeksen[0]).toMatchObject({ van: "2026-09-03", tot: "2026-09-10" });
  });

  it("groepeert dagen buiten elke periode samen", () => {
    // Between two blocks is a legitimate place for an activiteit to sit, so those days get their own
    // bucket rather than being dropped or folded into the period beside them.
    const reeksen = subthemareeksen(
      [dag("2026-09-30", "s1"), dag("2026-11-09", "s1"), dag("2026-11-12", "s1")],
      tweePeriodes,
    );

    expect(reeksen).toHaveLength(2);
    expect(reeksen[1]).toMatchObject({ van: "2026-11-09", tot: "2026-11-12", aantalDagen: 2 });
  });

  it("geeft niets terug voor dagen zonder activiteit", () => {
    expect(subthemareeksen([dag("2026-09-01"), dag("2026-09-02")], september)).toEqual([]);
  });
});

describe("reeksenPerDag", () => {
  it("vult ook de dagen tussen de eerste en de laatste", () => {
    const perDag = reeksenPerDag(subthemareeksen([dag("2026-09-01", "s1"), dag("2026-09-03", "s1")], september));

    expect([...perDag.keys()]).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(perDag.get("2026-09-02")?.[0].subthemaNaam).toBe("de speelhoek");
  });

  it("zet twee overlappende reeksen op dezelfde dag", () => {
    const perDag = reeksenPerDag(
      subthemareeksen([dag("2026-09-01", "s1"), dag("2026-09-03", "s1", "s2"), dag("2026-09-04", "s2")], september),
    );

    expect(perDag.get("2026-09-03")).toHaveLength(2);
    expect(perDag.get("2026-09-04")).toHaveLength(1);
  });
});

describe("voorstelReeks", () => {
  const reeksen = subthemareeksen(
    [dag("2026-09-01", "s1"), dag("2026-09-03", "s1"), dag("2026-09-14", "s2"), dag("2026-10-05", "s1")],
    tweePeriodes,
  );

  it("neemt de reeks die over deze dag loopt", () => {
    expect(voorstelReeks(reeksen, "2026-09-02", tweePeriodes)?.subthemaId).toBe("s1");
  });

  it("neemt de laatst afgelopen reeks op een dag waar niets loopt", () => {
    // 8 september: de speelhoek ran until the 3rd and the next subthema starts on the 14th. A teacher
    // adding something on the 8th almost always means the one they were working in.
    expect(voorstelReeks(reeksen, "2026-09-08", tweePeriodes)?.subthemaId).toBe("s1");
  });

  it("kijkt niet over de periodegrens", () => {
    // 3 october falls in the second periode, where nothing had run yet. Proposing september's
    // subthema would suggest a period the teacher is not planning here.
    expect(voorstelReeks(reeksen, "2026-10-03", tweePeriodes)).toBeUndefined();
  });

  it("stelt niets voor tussen twee periodes", () => {
    expect(voorstelReeks(reeksen, "2026-11-08", tweePeriodes)).toBeUndefined();
  });
});

describe("subthemareeksen met bewaarde vensters", () => {
  const venster = (subthemaId: string, van: string, tot: string): Subthemaperiode => ({
    subthemaId,
    subthemaNaam: subthemaId === "s1" ? "de speelhoek" : "dieren in de herfst",
    themaId: "t",
    themaNaam: "Ik en mijn klas",
    van,
    tot,
  });

  it("toont het hele venster ook als er maar een activiteit in staat", () => {
    // The reported defect: five days marked off, one activiteit ready, and the band covered one day.
    const reeksen = subthemareeksen([dag("2027-03-01", "s1")], september, [venster("s1", "2027-03-01", "2027-03-05")]);

    expect(reeksen).toHaveLength(1);
    expect(reeksen[0]).toMatchObject({ van: "2027-03-01", tot: "2027-03-05", aantalDagen: 1 });
  });

  it("toont een venster waar nog geen enkele activiteit in staat", () => {
    const reeksen = subthemareeksen([], september, [venster("s1", "2027-03-01", "2027-03-05")]);

    expect(reeksen).toHaveLength(1);
    expect(reeksen[0]).toMatchObject({ subthemaNaam: "de speelhoek", van: "2027-03-01", tot: "2027-03-05", aantalDagen: 0 });
  });

  it("verbreedt naar de activiteit die buiten het venster ligt in plaats van hem te verbergen", () => {
    // The union, in the direction that matters: an activiteit dragged past the end of its window widens the band.
    // Hiding it would put a card on a day the band says the subthema does not run.
    const reeksen = subthemareeksen(
      [dag("2026-09-02", "s1"), dag("2026-09-20", "s1")],
      september,
      [venster("s1", "2026-09-01", "2026-09-05")],
    );

    expect(reeksen[0]).toMatchObject({ van: "2026-09-01", tot: "2026-09-20" });
  });

  it("laat een venster in een andere periode los staan", () => {
    const reeksen = subthemareeksen(
      [dag("2026-09-02", "s1")],
      tweePeriodes,
      [venster("s1", "2026-10-05", "2026-10-09")],
    );

    expect(reeksen).toHaveLength(2);
    expect(reeksen.map((r) => r.van)).toEqual(["2026-09-02", "2026-10-05"]);
  });

  it("verandert niets zonder vensters", () => {
    const zonder = subthemareeksen([dag("2026-09-01", "s1"), dag("2026-09-03", "s1")], september);
    const leeg = subthemareeksen([dag("2026-09-01", "s1"), dag("2026-09-03", "s1")], september, []);

    expect(leeg).toEqual(zonder);
  });
});

describe("subthemasInWeek (FB-017)", () => {
  const reeks = (subthemaId: string, van: string, tot: string): Subthemareeks => ({
    subthemaId,
    subthemaNaam: subthemaId,
    van,
    tot,
    aantalDagen: 1,
  });
  const reeksen = [
    reeks("vorige", "2026-09-01", "2026-09-11"),
    reeks("over-het-weekend", "2026-09-11", "2026-09-15"),
    reeks("deze", "2026-09-16", "2026-09-25"),
    reeks("volgende", "2026-09-21", "2026-10-02"),
    reeks("deze", "2026-10-05", "2026-10-09"),
  ];

  it("geeft de subthema's die in die week lopen, ook een die de vrijdag ervoor begon", () => {
    expect(subthemasInWeek(reeksen, "2026-09-14")).toEqual(["over-het-weekend", "deze"]);
  });

  it("noemt een subthema dat in die week twee keer loopt maar één keer", () => {
    expect(subthemasInWeek([...reeksen, reeks("deze", "2026-09-14", "2026-09-14")], "2026-09-14")).toEqual([
      "over-het-weekend",
      "deze",
    ]);
  });

  it("geeft niets voor een week zonder lopend subthema", () => {
    expect(subthemasInWeek(reeksen, "2026-11-09")).toEqual([]);
  });
});

describe("reeksbereik", () => {
  const blokken = [
    { start: "2026-09-01", eind: "2026-09-11" },
    { start: "2026-09-16", eind: "2026-10-23" },
  ];

  it("leest een week over de hele themaperiodes die ze raakt", () => {
    expect(reeksbereik("2026-09-21", "2026-09-27", "2026-09-22", blokken)).toEqual(["2026-09-16", "2026-10-23"]);
  });

  it("leest in de dagweergave de hele week, ook een dag buiten elke periode (FB-017)", () => {
    // Monday the 14th sits between two periodes. The day alone would load only itself, and a subthema starting on
    // Wednesday the 16th, in the same week, would go unread.
    expect(reeksbereik("2026-09-14", "2026-09-14", "2026-09-14", blokken)).toEqual(["2026-09-14", "2026-10-23"]);
  });

  it("leest niets zolang het bereik op het scherm niet bekend is", () => {
    expect(reeksbereik("", "", "2026-09-14", blokken)).toEqual(["", ""]);
  });
});
