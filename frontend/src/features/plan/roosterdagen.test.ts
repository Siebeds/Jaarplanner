import { describe, expect, it } from "vitest";
import { roosterdagen } from "./roosterdagen";
import type { Dagweergave } from "../../lib/types";

/**
 * The bug this guards is the one the owner found: a week before the school year rendered a single
 * column for 1 september under a heading that said 24 to 30 august, because the server clamps the
 * range it is given and the grid was built from its answer instead of from the dates asked for.
 */
const dag = (datum: string, aantal = 0): Dagweergave => ({
  datum,
  isLesdag: true,
  sluitingsnaam: null,
  activiteiten: Array.from({ length: aantal }, (_, i) => ({
    plaatsingId: `${datum}-${i}`,
    activiteitId: "a",
    activiteitNaam: "Activiteit",
    activiteitType: "Spel",
    subthemaId: "s",
    subthemaNaam: "Sub",
    themaId: "t",
    themaNaam: "Thema",
    volgorde: i,
    status: "Aanvaard",
    kleur: null,
    doelcodes: [],
    valtBuitenThemaperiode: false,
  })),
});

const WEEK = ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"];

describe("roosterdagen", () => {
  it("geeft altijd de gevraagde dagen terug, in de gevraagde volgorde", () => {
    const uit = roosterdagen(WEEK, [], "2026-09-01", "2027-06-30");
    expect(uit.map((d) => d.datum)).toEqual(WEEK);
  });

  it("laat een dag die de server niet gaf niet vervangen door een dag die hij wel gaf", () => {
    // Precies wat de server doet: hij klemt 24-30 augustus naar 1 september.
    const uit = roosterdagen(WEEK, [dag("2026-09-01", 3)], "2026-09-01", "2027-06-30");
    expect(uit.map((d) => d.datum)).toEqual(WEEK);
    expect(uit.flatMap((d) => d.activiteiten)).toEqual([]);
  });

  it("merkt een dag buiten het schooljaar en laat er niets op plannen", () => {
    const uit = roosterdagen(WEEK, [], "2026-09-01", "2027-06-30");
    expect(uit.every((d) => d.buitenSchooljaar)).toBe(true);
    expect(uit.every((d) => !d.isLesdag)).toBe(true);
  });

  it("houdt de dagen die de server wel gaf ongemoeid", () => {
    const geleverd = [dag("2026-09-01", 2), dag("2026-09-02")];
    const uit = roosterdagen(["2026-09-01", "2026-09-02"], geleverd, "2026-09-01", "2027-06-30");
    expect(uit[0].activiteiten).toHaveLength(2);
    expect(uit.every((d) => d.isLesdag && !d.buitenSchooljaar)).toBe(true);
  });

  it("noemt niets buiten het schooljaar zolang het schooljaar niet geladen is", () => {
    const uit = roosterdagen(WEEK, [], "", "");
    expect(uit.every((d) => !d.buitenSchooljaar)).toBe(true);
  });
});
