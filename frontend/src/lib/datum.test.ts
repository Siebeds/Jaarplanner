import { describe, expect, it } from "vitest";
import { weeknummer } from "./datum";

/**
 * ISO weeks, checked at the turn of the year, which is the only place the rule is visible: the week
 * belongs to the year its Thursday falls in, so a date in December can sit in week 1 and a date in
 * January in week 53.
 */
describe("weeknummer", () => {
  it("telt een gewone week", () => {
    expect(weeknummer("2026-09-28")).toBe(40);
    expect(weeknummer("2026-10-04")).toBe(40);
    expect(weeknummer("2026-11-09")).toBe(46);
  });

  it("laat de donderdag beslissen aan de jaarwissel", () => {
    expect(weeknummer("2026-12-31")).toBe(53);
    expect(weeknummer("2027-01-01")).toBe(53);
    expect(weeknummer("2027-01-04")).toBe(1);
    expect(weeknummer("2024-12-30")).toBe(1);
  });
});
