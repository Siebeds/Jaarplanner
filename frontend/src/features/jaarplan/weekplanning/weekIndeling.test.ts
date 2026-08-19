import { describe, expect, it } from "vitest";

import {
  bouwMaandrooster,
  groepeerInWeken,
  inSchooljaar,
  isWeekend,
  maandVan,
  verschuifDagen,
  verschuifMaand,
  verschuifWeken,
  weekVan,
  wekenInPeriode,
} from "./weekIndeling";
import type { Dag } from "./types";

const dag = (datum: string, isLesdag = true): Dag => ({
  datum,
  isLesdag,
  sluitingsnaam: isLesdag ? null : "Herfstvakantie",
  activiteiten: [],
});

describe("weekVan", () => {
  /**
   * The whole point of the function, and the bug it exists to prevent: `Date.getDay()` is Sunday-based, so a naive
   * implementation puts Sunday at the *start* of its week and groups it with the following one.
   */
  it("anchors every day of one week on the same Monday, Sunday included", () => {
    // 2026-09-07 is a Monday; 2026-09-13 is the Sunday of that same week.
    for (const datum of [
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]) {
      expect(weekVan(datum)).toEqual({ van: "2026-09-07", tot: "2026-09-13" });
    }
  });

  it("puts the next Monday in the next week", () => {
    expect(weekVan("2026-09-14")).toEqual({ van: "2026-09-14", tot: "2026-09-20" });
  });

  /**
   * The other date trap this file documents: `new Date("2026-03-01")` parses as UTC midnight, which is the previous
   * evening west of Greenwich, so the weekday comes out one day early. Crossing a month boundary is where that shows.
   */
  it("crosses a month boundary without shifting a day", () => {
    // 2027-03-01 is a Monday.
    expect(weekVan("2027-02-28")).toEqual({ van: "2027-02-22", tot: "2027-02-28" });
    expect(weekVan("2027-03-01")).toEqual({ van: "2027-03-01", tot: "2027-03-07" });
  });

  it("crosses a year boundary", () => {
    // 2026-12-28 is a Monday, so the week runs into January.
    expect(weekVan("2027-01-01")).toEqual({ van: "2026-12-28", tot: "2027-01-03" });
  });
});

describe("verschuifDagen / verschuifWeken", () => {
  it("steps forward and back across a month boundary", () => {
    expect(verschuifDagen("2026-08-31", 1)).toBe("2026-09-01");
    expect(verschuifDagen("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("handles a leap day", () => {
    expect(verschuifDagen("2028-02-28", 1)).toBe("2028-02-29");
    expect(verschuifDagen("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("steps whole weeks", () => {
    expect(verschuifWeken("2026-09-07", 1)).toBe("2026-09-14");
    expect(verschuifWeken("2026-09-07", -1)).toBe("2026-08-31");
  });
});

describe("isWeekend", () => {
  /**
   * The client has to answer this because the **server cannot**: `Schooljaar.IsLesdag` excludes only closures, so a
   * Saturday inside the school year arrives with `isLesdag: true`. A screen that trusted that flag alone would offer
   * Saturday as a teaching day.
   */
  it("is true for Saturday and Sunday only", () => {
    expect(isWeekend("2026-09-12")).toBe(true); // Saturday
    expect(isWeekend("2026-09-13")).toBe(true); // Sunday
    expect(isWeekend("2026-09-11")).toBe(false); // Friday
    expect(isWeekend("2026-09-07")).toBe(false); // Monday
  });
});

describe("groepeerInWeken", () => {
  it("groups a full fortnight into two Monday-anchored weeks", () => {
    const dagen = Array.from({ length: 14 }, (_, i) => dag(verschuifDagen("2026-09-07", i)));

    const weken = groepeerInWeken(dagen);

    expect(weken).toHaveLength(2);
    expect(weken[0].maandag).toBe("2026-09-07");
    expect(weken[1].maandag).toBe("2026-09-14");
    expect(weken[0].dagen).toHaveLength(7);
    expect(weken.map((w) => w.positie)).toEqual([1, 2]);
  });

  /**
   * **Partial weeks are kept, not padded.** A range clamped to the school year legitimately starts mid-week — 1
   * September 2026 is a Tuesday — and padding would invent days the server's answer does not contain, which is how a
   * screen ends up offering a drop target for a date the server would refuse.
   */
  it("keeps a partial first week without padding it", () => {
    // 2026-09-01 is a Tuesday, so this week has 6 days, not 7.
    const dagen = Array.from({ length: 6 }, (_, i) => dag(verschuifDagen("2026-09-01", i)));

    const weken = groepeerInWeken(dagen);

    expect(weken).toHaveLength(1);
    expect(weken[0].maandag).toBe("2026-08-31");
    expect(weken[0].dagen).toHaveLength(6);
    expect(weken[0].dagen[0].datum).toBe("2026-09-01");
  });

  /**
   * Grouping is by each day's own Monday rather than by chunking into runs of seven, so unordered or gapped input cannot
   * shift every later week by a column.
   */
  it("is independent of input order", () => {
    const dagen = [dag("2026-09-14"), dag("2026-09-08"), dag("2026-09-07"), dag("2026-09-15")];

    const weken = groepeerInWeken(dagen);

    expect(weken.map((w) => w.maandag)).toEqual(["2026-09-07", "2026-09-14"]);
    expect(weken[0].dagen.map((d) => d.datum)).toEqual(["2026-09-07", "2026-09-08"]);
  });

  it("returns nothing for an empty range rather than one empty week", () => {
    expect(groepeerInWeken([])).toEqual([]);
  });

  /** Closed days stay in the grid with their closure, so a short week is explained rather than looking like a bug. */
  it("keeps closed days in their week", () => {
    const dagen = Array.from({ length: 7 }, (_, i) => dag(verschuifDagen("2026-11-02", i), false));

    const weken = groepeerInWeken(dagen);

    expect(weken[0].dagen).toHaveLength(7);
    expect(weken[0].dagen.every((d) => d.sluitingsnaam === "Herfstvakantie")).toBe(true);
  });
});

describe("bouwMaandrooster", () => {
  /**
   * **Always six rows.** A grid that changed height would make the week view below it jump every time a teacher stepped
   * a month — the class of defect this repo's record says only looking in a browser catches.
   */
  it("is always 42 cells, whatever the month's shape", () => {
    for (const [jaar, maand] of [
      [2026, 2],
      [2026, 9],
      [2027, 2],
      [2028, 2],
      [2026, 8],
    ] as const) {
      expect(bouwMaandrooster(jaar, maand)).toHaveLength(42);
    }
  });

  it("starts on the Monday on or before the first of the month", () => {
    // 1 September 2026 is a Tuesday, so the grid opens on Monday 31 August.
    expect(bouwMaandrooster(2026, 9)[0]).toEqual({ datum: "2026-08-31", inDezeMaand: false });
  });

  it("starts on the first itself when that is a Monday", () => {
    // 1 March 2027 is a Monday.
    expect(bouwMaandrooster(2027, 3)[0]).toEqual({ datum: "2027-03-01", inDezeMaand: true });
  });

  /**
   * Neighbouring days are marked rather than blanked, so the grid keeps its shape and a teacher can still click into
   * the next month.
   */
  it("marks days of the neighbouring months", () => {
    const rooster = bouwMaandrooster(2026, 9);
    const eigen = rooster.filter((d) => d.inDezeMaand);

    expect(eigen).toHaveLength(30);
    expect(eigen[0].datum).toBe("2026-09-01");
    expect(eigen[29].datum).toBe("2026-09-30");
    expect(rooster.some((d) => !d.inDezeMaand && d.datum.startsWith("2026-10"))).toBe(true);
  });

  it("is chronological with no gaps", () => {
    const rooster = bouwMaandrooster(2026, 9);

    for (let i = 1; i < rooster.length; i += 1) {
      expect(rooster[i].datum).toBe(verschuifDagen(rooster[i - 1].datum, 1));
    }
  });
});

describe("verschuifMaand", () => {
  it("carries the year in both directions", () => {
    expect(verschuifMaand(2026, 12, 1)).toEqual({ jaar: 2027, maand: 1 });
    expect(verschuifMaand(2027, 1, -1)).toEqual({ jaar: 2026, maand: 12 });
  });

  /**
   * The reason this is arithmetic on the parts rather than `setMonth`: `setMonth` clamps oddly, so stepping back one
   * month from the 31st lands in the *same* month again when the target is shorter. A stepper that skipped February
   * would be a genuinely confusing control.
   */
  it("never skips a short month", () => {
    expect(verschuifMaand(2027, 3, -1)).toEqual({ jaar: 2027, maand: 2 });
    expect(verschuifMaand(2027, 1, 1)).toEqual({ jaar: 2027, maand: 2 });
  });

  it("round-trips with maandVan", () => {
    expect(maandVan("2026-09-07")).toEqual({ jaar: 2026, maand: 9 });
    expect(maandVan("2026-12-31")).toEqual({ jaar: 2026, maand: 12 });
  });
});

describe("inSchooljaar", () => {
  it("includes both bounds", () => {
    expect(inSchooljaar("2026-09-01", "2026-09-01", "2027-06-30")).toBe(true);
    expect(inSchooljaar("2027-06-30", "2026-09-01", "2027-06-30")).toBe(true);
  });

  it("excludes days outside it", () => {
    expect(inSchooljaar("2026-08-31", "2026-09-01", "2027-06-30")).toBe(false);
    expect(inSchooljaar("2027-07-14", "2026-09-01", "2027-06-30")).toBe(false);
  });
});

describe("wekenInPeriode", () => {
  /**
   * A five-week period that starts mid-week touches **six** Mondays, and the first one precedes the period. That is
   * the honest answer: the period's first days really do sit in a week that began earlier, and a teacher looking at it
   * expects to find them there rather than in a synthetic window starting on the period's own first day.
   */
  it("anchors on real Mondays, including one before the period starts", () => {
    // 2026-09-02 is a Wednesday.
    const weken = wekenInPeriode("2026-09-02", "2026-10-04");

    expect(weken[0]).toBe("2026-08-31");
    expect(weken).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
  });

  it("gives one week for a period inside a single week", () => {
    expect(wekenInPeriode("2026-09-08", "2026-09-11")).toEqual(["2026-09-07"]);
  });

  it("starts on the period's own Monday when it begins on one", () => {
    expect(wekenInPeriode("2026-09-07", "2026-09-20")).toEqual(["2026-09-07", "2026-09-14"]);
  });
});
