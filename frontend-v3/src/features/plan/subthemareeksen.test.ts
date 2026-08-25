import { describe, expect, it } from "vitest";
import { reeksenPerDag, subthemareeksen, voorstelReeks } from "./subthemareeksen";
import type { Dagweergave, GeplandeActiviteit } from "../../lib/types";

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
  volgorde: i,
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
