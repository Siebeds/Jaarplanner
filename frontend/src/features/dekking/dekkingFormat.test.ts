import { describe, expect, it } from "vitest";

import { bepaalCijfer, groepeerPerSubdomein } from "./dekkingFormat";
import { dekking, doel } from "./testdata";

/**
 * The dekkingsoverzicht's two pure rules (E5-02), tested without rendering.
 *
 * Both carry real risk. The first can silently merge two subdomeinen into one tally; the second decides whether a
 * number a directie may show an onderwijsinspectie appears at all.
 */

describe("groepeerPerSubdomein", () => {
  it("keeps the server's order rather than re-sorting", () => {
    // The server documents its ordering as ordinal and host-independent, and an export reads the same field. A
    // client-side sort would quietly disagree with both, so the grouping must be order-preserving.
    const groepen = groepeerPerSubdomein([
      doel({ code: "B-01", domein: "Wiskunde", subdomein: "Getallen" }),
      doel({ code: "A-01", domein: "Natuur", subdomein: "Levende natuur" }),
    ]);

    expect(groepen.map((g) => g.subdomein)).toEqual(["Getallen", "Levende natuur"]);
  });

  it("counts each group's covered doelen from the rows the group itself renders", () => {
    const groepen = groepeerPerSubdomein([
      doel({ code: "A-01", isGedekt: true, dekkendeThemas: ["Herfst"] }),
      doel({ code: "A-02" }),
      doel({ code: "A-03", isGedekt: true, dekkendeThemas: ["Winter"] }),
    ]);

    const groep = groepen[0];
    expect(groep.doelen).toHaveLength(3);
    expect(groep.aantalGedekt).toBe(2);
  });

  it("keeps two subdomeinen apart even when a naive separator would merge them", () => {
    // THE COLLISION. Joined with a space, ("Levende natuur", "Dieren") and ("Levende", "natuur Dieren") produce the
    // same key: two subdomeinen become one group with one tally, and the screen shows a number that belongs to
    // neither. A real curriculum has multi-word domein and subdomein names throughout, so this is not exotic.
    const groepen = groepeerPerSubdomein([
      doel({ code: "A-01", domein: "Levende natuur", subdomein: "Dieren" }),
      doel({ code: "B-01", domein: "Levende", subdomein: "natuur Dieren" }),
    ]);

    expect(groepen).toHaveLength(2);
    expect(groepen.map((g) => g.doelen.length)).toEqual([1, 1]);
  });

  it("groups a doel that appears under one pair only once", () => {
    const groepen = groepeerPerSubdomein([
      doel({ code: "A-01", domein: "Natuur", subdomein: "Levende natuur" }),
      doel({ code: "A-02", domein: "Natuur", subdomein: "Levende natuur" }),
      doel({ code: "A-03", domein: "Natuur", subdomein: "Niet-levende natuur" }),
    ]);

    expect(groepen.map((g) => g.subdomein)).toEqual(["Levende natuur", "Niet-levende natuur"]);
  });

  it("returns nothing for an empty list rather than one empty group", () => {
    expect(groepeerPerSubdomein([])).toEqual([]);
  });
});

describe("bepaalCijfer", () => {
  it("reports a figure when the plan is trustworthy and something is in scope", () => {
    expect(bepaalCijfer(dekking())).toEqual({ soort: "cijfer", gedekt: 1, totaal: 2 });
  });

  it("withholds the figure while a stale placement is unresolved", () => {
    // The directie ruling of 2026-07-28 as a type-level fact: no branch of this function can produce a number in this
    // state, so no component can render one.
    const cijfer = bepaalCijfer(
      dekking({
        isBetrouwbaar: false,
        aantalGedekt: null,
        aantalOnopgelosteVervallenPlaatsingen: 2,
      }),
    );

    expect(cijfer).toEqual({ soort: "ingehouden", aantalOnopgeloste: 2 });
  });

  it("withholds the figure when the flag says trustworthy but the number is missing", () => {
    // The two signals disagree, which a server that omitted the property instead of nulling it would produce. Checked
    // because `undefined !== null`: a `!== null` guard would send this down the figure branch and render
    // "undefined van 2 doelen gedekt". Disagreement resolves towards withholding, never towards printing.
    const cijfer = bepaalCijfer(
      dekking({ isBetrouwbaar: true, aantalGedekt: undefined as unknown as null }),
    );

    expect(cijfer.soort).toBe("ingehouden");
  });

  it("says nothing is measurable when the scope holds no doelen", () => {
    // 0 of 0 satisfies `gedekt === totaal`, so a screen that treated equality as success would congratulate a teacher
    // whose class cannot be measured at all. It gets its own state for exactly that reason.
    const cijfer = bepaalCijfer(
      dekking({ doelen: [], aantalGedekt: 0, aantalLeerplandoelen: 0, aantalBuitenBereik: 7 }),
    );

    expect(cijfer).toEqual({ soort: "nietMeetbaar", aantalBuitenBereik: 7 });
  });

  it("prefers the empty scope over the withheld figure when both hold", () => {
    // Both are true and neither yields a number, so nothing is suppressed by the order; what differs is which sentence
    // a teacher reads, and "no doelen are loaded for this class" is the one they can act on. The unresolved-placement
    // notice is rendered independently of this slot, so the other fact is not lost. Pinned because this is a
    // deliberate choice rather than an accident of the `if` order.
    const cijfer = bepaalCijfer(
      dekking({
        doelen: [],
        aantalLeerplandoelen: 0,
        aantalGedekt: null,
        isBetrouwbaar: false,
        aantalOnopgelosteVervallenPlaatsingen: 1,
        aantalBuitenBereik: 3,
      }),
    );

    expect(cijfer.soort).toBe("nietMeetbaar");
  });
});
