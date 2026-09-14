import { describe, expect, it } from "vitest";
import { leesWeergave, weergaveZoek, type Weergave } from "./weergave";

describe("leesWeergave", () => {
  it("opent op de week als de URL geen weergave noemt", () => {
    expect(leesWeergave(null)).toBe("week");
  });

  it("volgt een weergave die de URL wel noemt", () => {
    expect(leesWeergave("maand")).toBe("maand");
    expect(leesWeergave("week")).toBe("week");
    expect(leesWeergave("dag")).toBe("dag");
  });

  it("valt terug op de week bij een weergave die het niet kent", () => {
    expect(leesWeergave("jaar")).toBe("week");
    expect(leesWeergave("")).toBe("week");
  });
});

describe("weergaveZoek", () => {
  it("laat de week weg uit de URL, zodat de week het kale adres is", () => {
    expect(weergaveZoek("week")).toBe("");
  });

  it("schrijft de maand en de dag uit", () => {
    expect(weergaveZoek("maand")).toBe("?weergave=maand");
    expect(weergaveZoek("dag")).toBe("?weergave=dag");
  });

  // The pair must agree, or a view the teacher chose would be lost on the next refresh.
  it("leest elke weergave terug zoals ze geschreven werd", () => {
    for (const weergave of ["maand", "week", "dag"] as Weergave[]) {
      expect(leesWeergave(new URLSearchParams(weergaveZoek(weergave)).get("weergave"))).toBe(weergave);
    }
  });
});
