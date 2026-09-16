import { describe, expect, it } from "vitest";
import { leesWeergave, weergaveZoek, type Weergave } from "./weergave";

describe("leesWeergave", () => {
  it("opent op de werkweek als de URL geen weergave noemt", () => {
    expect(leesWeergave(null)).toBe("werkweek");
  });

  it("volgt een weergave die de URL wel noemt", () => {
    expect(leesWeergave("maand")).toBe("maand");
    expect(leesWeergave("week")).toBe("week");
    expect(leesWeergave("werkweek")).toBe("werkweek");
    expect(leesWeergave("dag")).toBe("dag");
  });

  it("valt terug op de werkweek bij een weergave die het niet kent", () => {
    expect(leesWeergave("jaar")).toBe("werkweek");
    expect(leesWeergave("")).toBe("werkweek");
  });
});

describe("weergaveZoek", () => {
  it("laat de werkweek weg uit de URL, zodat de werkweek het kale adres is", () => {
    expect(weergaveZoek("werkweek")).toBe("");
  });

  it("schrijft de maand, de week en de dag uit", () => {
    expect(weergaveZoek("maand")).toBe("?weergave=maand");
    expect(weergaveZoek("week")).toBe("?weergave=week");
    expect(weergaveZoek("dag")).toBe("?weergave=dag");
  });

  // The pair must agree, or a view the teacher chose would be lost on the next refresh.
  it("leest elke weergave terug zoals ze geschreven werd", () => {
    for (const weergave of ["maand", "week", "werkweek", "dag"] as Weergave[]) {
      expect(leesWeergave(new URLSearchParams(weergaveZoek(weergave)).get("weergave"))).toBe(weergave);
    }
  });
});
