import { describe, expect, it } from "vitest";

import {
  bepaalCijfer,
  bepaalPercentage,
  beschikbareDoelsoorten,
  gemetenDoelen,
  groepeerPerSubdomein,
  toonbareDoelen,
} from "./dekkingFormat";
import { dekking, doel } from "./testdata";

/**
 * The dekkingsoverzicht's pure rules (E5-02, E5-03), tested without rendering.
 *
 * All of them carry real risk. Grouping can silently merge two subdomeinen into one tally; `bepaalCijfer` decides
 * whether a number a directie may show an onderwijsinspectie appears at all; `bepaalPercentage` decides whether that
 * number contradicts the fraction printed beside it; and the two filters decide which of them follows a narrowing.
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
    const antwoord = dekking();

    expect(bepaalCijfer(antwoord, antwoord.doelen)).toEqual({
      soort: "cijfer",
      gedekt: 1,
      totaal: 2,
      percentage: 50,
    });
  });

  it("reproduces the server's own totals exactly when nothing is filtered", () => {
    // THE EQUALITY E5-03 NOW DEPENDS ON. The counts moved from `aantalGedekt` / `aantalLeerplandoelen` to a client-side
    // count over the rows, because under a doelsoort filter there is no server figure to read. That is only safe while
    // the server computes its total the same way, which it does (`DekkingService` counts `doelen.Count(d => d.IsGedekt)`
    // over this very list). Pinned here so a server that ever stopped agreeing with its own rows fails a test rather
    // than letting the browser quietly become the authority on coverage.
    const antwoord = dekking({
      doelen: [
        doel({ code: "A-01", isGedekt: true, dekkendeThemas: ["Herfst"] }),
        doel({ code: "A-02", isGedekt: true, dekkendeThemas: ["Winter"] }),
        doel({ code: "A-03" }),
        doel({ code: "A-04" }),
        doel({ code: "A-05" }),
      ],
    });
    const cijfer = bepaalCijfer(antwoord, antwoord.doelen);

    expect(cijfer).toMatchObject({ gedekt: antwoord.aantalGedekt, totaal: antwoord.aantalLeerplandoelen });
  });

  it("counts only the measured doelen when a doelsoort narrowing is active", () => {
    // The story's acceptance criterion: filtering by MD shows minimumdoel-only coverage. Two of the five doelen are
    // minimumdoelen and one of those is covered, so the figure is 1 of 2 rather than the unfiltered 3 of 5.
    const antwoord = dekking({
      doelen: [
        doel({ code: "MD-01", doelsoort: "Minimumdoel", isGedekt: true, dekkendeThemas: ["Herfst"] }),
        doel({ code: "MD-02", doelsoort: "Minimumdoel" }),
        doel({ code: "G-01", isGedekt: true, dekkendeThemas: ["Herfst"] }),
        doel({ code: "G-02", isGedekt: true, dekkendeThemas: ["Winter"] }),
        doel({ code: "G-03" }),
      ],
    });

    const cijfer = bepaalCijfer(antwoord, gemetenDoelen(antwoord.doelen, "Minimumdoel"));

    expect(cijfer).toEqual({ soort: "cijfer", gedekt: 1, totaal: 2, percentage: 50 });
  });

  it("still withholds the figure under a filter while a stale placement is unresolved", () => {
    // THE ROUTE AROUND THE RULING, closed. The server nulls `aantalGedekt` in this state, but every row still carries
    // its own `isGedekt`, so a client-side count over a filtered subset can reconstruct precisely the total the
    // directie ruling of 2026-07-28 withholds. The gate is the server's flag, not the presence of countable rows.
    const antwoord = dekking({
      doelen: [
        doel({ code: "MD-01", doelsoort: "Minimumdoel", isGedekt: true, dekkendeThemas: ["Herfst"] }),
        doel({ code: "MD-02", doelsoort: "Minimumdoel" }),
      ],
      isBetrouwbaar: false,
      aantalGedekt: null,
      aantalOnopgelosteVervallenPlaatsingen: 2,
    });

    const cijfer = bepaalCijfer(antwoord, gemetenDoelen(antwoord.doelen, "Minimumdoel"));

    expect(cijfer).toEqual({ soort: "ingehouden", aantalOnopgeloste: 2 });
  });

  it("withholds the figure while a stale placement is unresolved", () => {
    // The directie ruling of 2026-07-28 as a type-level fact: no branch of this function can produce a number in this
    // state, so no component can render one.
    const antwoord = dekking({
      isBetrouwbaar: false,
      aantalGedekt: null,
      aantalOnopgelosteVervallenPlaatsingen: 2,
    });

    expect(bepaalCijfer(antwoord, antwoord.doelen)).toEqual({
      soort: "ingehouden",
      aantalOnopgeloste: 2,
    });
  });

  it("withholds the figure when the flag says trustworthy but the number is missing", () => {
    // The two signals disagree, which a server that omitted the property instead of nulling it would produce. Checked
    // because `undefined !== null`: a `!== null` guard would send this down the figure branch and render
    // "undefined van 2 doelen gedekt". Disagreement resolves towards withholding, never towards printing.
    const antwoord = dekking({ isBetrouwbaar: true, aantalGedekt: undefined as unknown as null });

    expect(bepaalCijfer(antwoord, antwoord.doelen).soort).toBe("ingehouden");
  });

  it("says nothing is measurable when the scope holds no doelen", () => {
    // 0 of 0 satisfies `gedekt === totaal`, so a screen that treated equality as success would congratulate a teacher
    // whose class cannot be measured at all. It gets its own state for exactly that reason.
    const antwoord = dekking({
      doelen: [],
      aantalGedekt: 0,
      aantalLeerplandoelen: 0,
      aantalBuitenBereik: 7,
    });

    expect(bepaalCijfer(antwoord, [])).toEqual({ soort: "nietMeetbaar", aantalBuitenBereik: 7 });
  });

  it("distinguishes an empty filter result from an empty scope", () => {
    // Doelen ARE loaded and in scope; none is of the chosen soort. Reported separately because the remedy differs and
    // the wrong one wastes a teacher's afternoon: `nietMeetbaar` sends them to Inladen, this sends them to the filter.
    const antwoord = dekking();

    expect(bepaalCijfer(antwoord, gemetenDoelen(antwoord.doelen, "Minimumdoel"))).toEqual({
      soort: "geenVanDezeSoort",
    });
  });

  it("prefers the empty scope over the withheld figure when both hold", () => {
    // Both are true and neither yields a number, so nothing is suppressed by the order; what differs is which sentence
    // a teacher reads, and "no doelen are loaded for this class" is the one they can act on. The unresolved-placement
    // notice is rendered independently of this slot, so the other fact is not lost. Pinned because this is a
    // deliberate choice rather than an accident of the `if` order.
    const antwoord = dekking({
      doelen: [],
      aantalLeerplandoelen: 0,
      aantalGedekt: null,
      isBetrouwbaar: false,
      aantalOnopgelosteVervallenPlaatsingen: 1,
      aantalBuitenBereik: 3,
    });

    expect(bepaalCijfer(antwoord, []).soort).toBe("nietMeetbaar");
  });
});

describe("bepaalPercentage", () => {
  it("rounds an ordinary fraction to a whole number", () => {
    expect(bepaalPercentage(1, 2)).toBe(50);
    expect(bepaalPercentage(1, 3)).toBe(33);
    expect(bepaalPercentage(2, 3)).toBe(67);
  });

  it("never rounds a non-zero numerator down to 0%", () => {
    // 1 of 500 is 0,2%, which plain rounding turns into "0%" beside a fraction that says one doel IS covered. On a
    // screen whose subject is proving coverage, a figure that contradicts its own evidence is the worst kind of wrong.
    expect(bepaalPercentage(1, 500)).toBe(1);
  });

  it("never rounds an incomplete numerator up to 100%", () => {
    // The dangerous direction: 499 of 500 is 99,8% and reads as "everything is covered" to a directie preparing for an
    // inspectie, while a doel demonstrably is not. 100% is reserved for a genuinely complete set.
    expect(bepaalPercentage(499, 500)).toBe(99);
  });

  it("reports 0% and 100% only when they are literally true", () => {
    expect(bepaalPercentage(0, 40)).toBe(0);
    expect(bepaalPercentage(40, 40)).toBe(100);
  });

  it("answers 0 rather than dividing by zero on an empty denominator", () => {
    // Unreachable through `bepaalCijfer`, which catches an empty measured set before it gets here. Pinned anyway
    // because the alternative return value is NaN, and "NaN%" would reach the screen intact.
    expect(bepaalPercentage(0, 0)).toBe(0);
  });
});

describe("gemetenDoelen and toonbareDoelen", () => {
  const doelen = [
    doel({ code: "MD-01", doelsoort: "Minimumdoel", isGedekt: true, dekkendeThemas: ["Herfst"] }),
    doel({ code: "MD-02", doelsoort: "Minimumdoel" }),
    doel({ code: "G-01", isGedekt: true, dekkendeThemas: ["Winter"] }),
    doel({ code: "G-02" }),
  ];

  it("measures over the doelsoort narrowing only", () => {
    expect(gemetenDoelen(doelen, "Minimumdoel").map((d) => d.code)).toEqual(["MD-01", "MD-02"]);
    expect(gemetenDoelen(doelen, null)).toHaveLength(4);
  });

  it("shows only the gaps when asked, within the measured set", () => {
    const getoond = toonbareDoelen(doelen, { doelsoort: "Minimumdoel", alleenOntbrekende: true });

    expect(getoond.map((d) => d.code)).toEqual(["MD-02"]);
  });

  it("keeps the gaps-only view out of the measured set", () => {
    // THE DISTINCTION THE WHOLE SPLIT EXISTS FOR. `alleenOntbrekende` is a view, not a scope: if the figure were
    // computed over it, pressing "Alleen ontbrekende" would report 0% every single time, because every row it leaves
    // standing is by definition uncovered.
    const gemeten = gemetenDoelen(doelen, null);
    const antwoord = dekking({ doelen });

    expect(toonbareDoelen(doelen, { doelsoort: null, alleenOntbrekende: true })).toHaveLength(2);
    expect(bepaalCijfer(antwoord, gemeten)).toMatchObject({ gedekt: 2, totaal: 4, percentage: 50 });
  });

  it("preserves the server's order rather than re-sorting", () => {
    expect(toonbareDoelen(doelen, { doelsoort: null, alleenOntbrekende: false }).map((d) => d.code)).toEqual([
      "MD-01",
      "MD-02",
      "G-01",
      "G-02",
    ]);
  });
});

describe("beschikbareDoelsoorten", () => {
  it("offers only the doelsoorten the scope actually holds, with counts", () => {
    // Derived from the payload rather than the six-member enum: offering a doelsoort this curriculum does not contain
    // produces an empty screen that reads as a fault, and which disciplines a school loads is an open Art. XIV
    // decision, so the set genuinely varies per school.
    const opties = beschikbareDoelsoorten([
      doel({ code: "MD-01", doelsoort: "Minimumdoel" }),
      doel({ code: "G-01", doelsoort: "Gemeenschappelijk" }),
      doel({ code: "MD-02", doelsoort: "Minimumdoel" }),
    ]);

    expect(opties).toEqual([
      { doelsoort: "Minimumdoel", aantal: 2 },
      { doelsoort: "Gemeenschappelijk", aantal: 1 },
    ]);
  });

  it("returns nothing for an empty scope", () => {
    expect(beschikbareDoelsoorten([])).toEqual([]);
  });
});
