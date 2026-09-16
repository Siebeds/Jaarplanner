import { describe, expect, it } from "vitest";
import { overslagenWeekends, schuifWerkweek, werkweekbereik, werkweekdagen } from "./werkweek";

// Week 37 of 2026: Monday 7 to Sunday 13 September.

describe("werkweekdagen", () => {
  it("toont op een desktop maandag tot vrijdag van de week van de dag", () => {
    expect(werkweekdagen("2026-09-09", 7)).toEqual(["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"]);
  });

  it("toont op een desktop vanaf een zondag de werkdagen van diezelfde week", () => {
    expect(werkweekdagen("2026-09-13", 7)[0]).toBe("2026-09-07");
  });

  it("toont op een telefoon drie werkdagen vanaf de dag, en na vrijdag komt maandag", () => {
    expect(werkweekdagen("2026-09-10", 3)).toEqual(["2026-09-10", "2026-09-11", "2026-09-14"]);
  });

  it("begint op een telefoon vanaf een zaterdag op de maandag erna", () => {
    expect(werkweekdagen("2026-09-12", 3)).toEqual(["2026-09-14", "2026-09-15", "2026-09-16"]);
  });
});

describe("schuifWerkweek", () => {
  it("gaat op een desktop naar de vorige of volgende maandag", () => {
    expect(schuifWerkweek("2026-09-09", 7, 1)).toBe("2026-09-14");
    expect(schuifWerkweek("2026-09-09", 7, -1)).toBe("2026-08-31");
  });

  it("bladert op een telefoon per drie werkdagen, zonder er een over te slaan of te herhalen", () => {
    const gezien: string[] = [];
    let anker = "2026-09-07";
    for (let keer = 0; keer < 4; keer++) {
      gezien.push(...werkweekdagen(anker, 3));
      anker = schuifWerkweek(anker, 3, 1);
    }
    expect(gezien).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09",
      "2026-09-10", "2026-09-11", "2026-09-14",
      "2026-09-15", "2026-09-16", "2026-09-17",
      "2026-09-18", "2026-09-21", "2026-09-22",
    ]);
  });

  it("komt op een telefoon terug waar hij vandaan kwam", () => {
    expect(schuifWerkweek(schuifWerkweek("2026-09-10", 3, 1), 3, -1)).toBe("2026-09-10");
  });
});

describe("werkweekbereik", () => {
  it("leest van de maandag van de eerste tot de zondag van de laatste dag", () => {
    expect(werkweekbereik(["2026-09-10", "2026-09-11", "2026-09-14"])).toEqual(["2026-09-07", "2026-09-20"]);
    expect(werkweekbereik([])).toEqual(["", ""]);
  });
});

describe("overslagenWeekends", () => {
  const op = (lijst: Record<string, number>) => (datum: string) => lijst[datum] ?? 0;

  it("telt wat er op zaterdag en zondag staat, per weekend, activiteiten en fiches apart", () => {
    const weekends = overslagenWeekends(
      "2026-09-07",
      "2026-09-20",
      op({ "2026-09-12": 1, "2026-09-13": 2, "2026-09-10": 5, "2026-09-20": 1 }),
      op({ "2026-09-13": 1 }),
    );
    expect(weekends).toEqual([
      { zaterdag: "2026-09-12", activiteiten: 3, fiches: 1 },
      { zaterdag: "2026-09-19", activiteiten: 1, fiches: 0 },
    ]);
  });

  it("zwijgt over een leeg weekend en over een bereik dat nog niet bekend is", () => {
    expect(overslagenWeekends("2026-09-07", "2026-09-13", op({ "2026-09-09": 1 }), op({}))).toEqual([]);
    expect(overslagenWeekends("", "", op({}), op({}))).toEqual([]);
  });
});
