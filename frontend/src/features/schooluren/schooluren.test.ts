import { describe, expect, it } from "vitest";
import type { Schooldaguren } from "./gegevens";
import { Dagnaam, beginVelden, dagnaam, grenstijden, naarInvoer, openingsminuut, urenOp } from "./schooluren";

/** The school's hours as the screens compute with them (FB-023). */
const maandag: Schooldaguren = {
  weekdag: 1,
  begin: "08:30:00",
  einde: "15:30:00",
  middagpauzeBegin: "12:00:00",
  middagpauzeEinde: "13:15:00",
};
const woensdag: Schooldaguren = { weekdag: 3, begin: "08:15:00", einde: "12:00:00", middagpauzeBegin: null, middagpauzeEinde: null };

describe("schooluren", () => {
  it("noemt een weekdag in het Nederlands, in een zin en als kop", () => {
    expect(dagnaam(1)).toBe("maandag");
    expect(Dagnaam(5)).toBe("Vrijdag");
  });

  it("vindt de uren van de weekdag waarop een datum valt", () => {
    // 2026-09-14 is a Monday, 2026-09-16 a Wednesday, 2026-09-15 a Tuesday without hours.
    expect(urenOp([maandag, woensdag], "2026-09-14")).toBe(maandag);
    expect(urenOp([maandag, woensdag], "2026-09-16")).toBe(woensdag);
    expect(urenOp([maandag, woensdag], "2026-09-15")).toBeUndefined();
    expect(urenOp(undefined, "2026-09-14")).toBeUndefined();
  });

  it("opent op het hele uur waarin de vroegste schooldag begint, en telt een gesloten dag niet mee", () => {
    const dagen = [
      { datum: "2026-09-14", isLesdag: true },
      { datum: "2026-09-16", isLesdag: true },
    ];
    expect(openingsminuut([maandag, woensdag], dagen)).toBe(8 * 60);

    // The Wednesday is a closure: it is drawn without hours, so its earlier 8:15 does not decide.
    const vroeg = { ...woensdag, begin: "07:15:00" };
    expect(openingsminuut([maandag, vroeg], [dagen[0], { ...dagen[1], isLesdag: false }])).toBe(8 * 60);
    expect(openingsminuut([maandag, vroeg], dagen)).toBe(7 * 60);

    expect(openingsminuut([], dagen)).toBeUndefined();
    expect(openingsminuut(undefined, dagen)).toBeUndefined();
  });

  it("schrijft de grenzen van de schooldag in de uurkolom, samengevoegd over de dagen en zonder botsingen", () => {
    const dagen = [
      { datum: "2026-09-14", isLesdag: true },
      { datum: "2026-09-16", isLesdag: true },
    ];
    // Monday 8:30, 12:00, 13:15, 15:30; Wednesday 8:15 and 12:00. 8:30 hangs over 8:15's label and is dropped, and
    // the shared 12:00 is written once.
    expect(grenstijden([maandag, woensdag], dagen)).toEqual([495, 720, 795, 930]);

    // A closed day and a weekday without hours add nothing.
    expect(grenstijden([maandag, woensdag], [dagen[0], { ...dagen[1], isLesdag: false }])).toEqual([510, 720, 795, 930]);
    expect(grenstijden([maandag], [{ datum: "2026-09-15", isLesdag: true }])).toEqual([]);
    expect(grenstijden(undefined, dagen)).toEqual([]);
  });

  it("vult het formulier met wat de school heeft, en een lege dag met de pauze aangevinkt", () => {
    const velden = beginVelden([maandag, woensdag]);

    expect(velden[1]).toEqual({ begin: "08:30", einde: "15:30", pauze: true, pauzeBegin: "12:00", pauzeEinde: "13:15" });
    expect(velden[3]).toEqual({ begin: "08:15", einde: "12:00", pauze: false, pauzeBegin: "", pauzeEinde: "" });
    expect(velden[2]).toEqual({ begin: "", einde: "", pauze: true, pauzeBegin: "", pauzeEinde: "" });
  });

  it("stuurt terug wat het formulier toonde, zonder de lege dagen", () => {
    expect(naarInvoer(beginVelden([maandag, woensdag]))).toEqual({ dagen: [maandag, woensdag] });
  });

  it("weigert een halve dag en een halve pauze zelf, met de dag erbij", () => {
    const halveDag = beginVelden([]);
    halveDag[2] = { ...halveDag[2], begin: "08:30" };
    expect(naarInvoer(halveDag)).toEqual({ fout: { weekdag: 2, sleutel: "schooluren.onvolledig" } });

    const halvePauze = beginVelden([]);
    halvePauze[4] = { begin: "08:30", einde: "15:30", pauze: true, pauzeBegin: "12:00", pauzeEinde: "" };
    expect(naarInvoer(halvePauze)).toEqual({ fout: { weekdag: 4, sleutel: "schooluren.pauzeOnvolledig" } });
  });

  it("stuurt geen pauze voor een dag waar ze uitgevinkt is, ook niet als de velden nog iets bevatten", () => {
    const velden = beginVelden([maandag]);
    velden[1] = { ...velden[1], pauze: false };

    expect(naarInvoer(velden)).toEqual({
      dagen: [{ ...maandag, middagpauzeBegin: null, middagpauzeEinde: null }],
    });
  });
});
