import { describe, expect, it } from "vitest";
import { weekInBeeld } from "./weekInBeeld";

/**
 * One case per window the agenda actually builds (`Agendascherm`'s `van`/`tot`). 7 september 2026 is a
 * Monday, so the phone's three-day windows below start on a Monday, a Saturday and a Sunday.
 */
describe("weekInBeeld", () => {
  it("geeft geen week in de maandweergave", () => {
    expect(weekInBeeld("maand", "2026-08-31", "2026-10-04")).toBeNull();
  });

  it("geeft de week van de dag in de dagweergave", () => {
    expect(weekInBeeld("dag", "2026-09-11", "2026-09-11")).toBe(37);
  });

  it("geeft de week van een volle week van maandag tot zondag", () => {
    expect(weekInBeeld("week", "2026-09-07", "2026-09-13")).toBe(37);
  });

  it("geeft de week van een volle week over de jaarwissel", () => {
    expect(weekInBeeld("week", "2026-12-28", "2027-01-03")).toBe(53);
  });

  it("geeft de week van drie dagen die in een week blijven", () => {
    expect(weekInBeeld("week", "2026-09-07", "2026-09-09")).toBe(37);
  });

  it("geeft geen week als drie dagen vanaf een zaterdag een maandag raken", () => {
    expect(weekInBeeld("week", "2026-09-12", "2026-09-14")).toBeNull();
  });

  it("geeft geen week als drie dagen vanaf een zondag een maandag raken", () => {
    expect(weekInBeeld("week", "2026-09-13", "2026-09-15")).toBeNull();
  });
});
