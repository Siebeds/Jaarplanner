import { describe, expect, it } from "vitest";

import { bepaalCijfer } from "./dekkingFormat";
import { bepaalVoortgangsbalk, type Dekkingsvoortgang } from "./voortgang";
import type { Dekking, DoelDekking } from "./types";

const voortgang = (overrides: Partial<Dekkingsvoortgang> = {}): Dekkingsvoortgang => ({
  bereik: "EigenJaarFase",
  gemetenJaarFasen: ["K3"],
  isTerugvalNaarHeelCurriculum: false,
  aantalBuitenBereik: 0,
  isBetrouwbaar: true,
  aantalOnopgelosteVervallenPlaatsingen: 0,
  aantalGedekt: 4,
  aantalMogelijkGedekt: 7,
  aantalLeerplandoelen: 10,
  aantalOnbereikbaar: 3,
  ...overrides,
});

describe("bepaalVoortgangsbalk", () => {
  it("reports the increment, not the ceiling, as the second segment", () => {
    const balk = bepaalVoortgangsbalk(voortgang());

    expect(balk).toEqual({
      soort: "balk",
      gedekt: 4,
      // 7 - 4. A bar drawing 7 from zero would paint over the covered part and show one number where there are two.
      teAanvaarden: 3,
      totaal: 10,
      percentageGedekt: 40,
      percentageMogelijk: 70,
    });
  });

  /**
   * **The state a teacher is in for most of the work this bar exists to make visible.** Linking doelen to a thema that
   * is not placed yet moves neither figure (Art. V.1: coverage runs through the thema's placement), so the bar must be
   * able to say "nothing yet" honestly rather than look broken.
   */
  it("draws a real zero when nothing is placed", () => {
    const balk = bepaalVoortgangsbalk(voortgang({ aantalGedekt: 0, aantalMogelijkGedekt: 0 }));

    expect(balk).toMatchObject({ soort: "balk", gedekt: 0, teAanvaarden: 0, percentageGedekt: 0 });
  });

  /**
   * **0 of 0 must never render as success.** An L3 class with only kleuterdoelen imported has an empty scope, which
   * E5-02 recorded as a live case — and `bepaalPercentage(0, 0)` is 0, so without this gate the bar would draw an empty
   * bar labelled 0% as if the teacher had covered nothing, rather than saying it cannot measure yet.
   */
  it("refuses to produce a figure when the denominator is 0", () => {
    const balk = bepaalVoortgangsbalk(
      voortgang({ aantalLeerplandoelen: 0, aantalGedekt: 0, aantalMogelijkGedekt: 0, aantalBuitenBereik: 12 }),
    );

    expect(balk).toEqual({ soort: "nietMeetbaar", aantalBuitenBereik: 12 });
  });

  /**
   * **Both figures are withheld together** (directie 2026-07-28). Asserted on each null independently, because a
   * partial withholding is exactly what would let a screen print a ceiling beside a blank.
   */
  it.each([
    ["both null", { aantalGedekt: null, aantalMogelijkGedekt: null }],
    ["only the covered figure null", { aantalGedekt: null }],
    ["only the ceiling null", { aantalMogelijkGedekt: null }],
  ])("withholds the whole bar when %s", (_naam, velden) => {
    const balk = bepaalVoortgangsbalk(
      voortgang({ isBetrouwbaar: false, aantalOnopgelosteVervallenPlaatsingen: 2, ...velden }),
    );

    expect(balk).toEqual({ soort: "ingehouden", aantalOnopgeloste: 2 });
  });

  /**
   * The denominator gate comes **before** the withholding gate, matching `bepaalCijfer`. Both yield no number, and this
   * is the one a teacher can act on: import the curriculum for this class's jaar.
   */
  it("reports an unmeasurable class even while the figure is withheld", () => {
    const balk = bepaalVoortgangsbalk(
      voortgang({ aantalLeerplandoelen: 0, isBetrouwbaar: false, aantalGedekt: null, aantalMogelijkGedekt: null }),
    );

    expect(balk.soort).toBe("nietMeetbaar");
  });

  it("clamps a negative increment rather than drawing one", () => {
    // Impossible server-side (the ceiling is a superset by construction), but a negative segment would render as a
    // glitch nobody could diagnose.
    const balk = bepaalVoortgangsbalk(voortgang({ aantalGedekt: 5, aantalMogelijkGedekt: 3 }));

    expect(balk).toMatchObject({ soort: "balk", gedekt: 5, teAanvaarden: 0 });
  });

  /**
   * The same clamping the dekkingsoverzicht uses: 0% is reserved for a genuinely empty numerator and 100% for a
   * genuinely complete one, so a bar can never read "alles gedekt" while a doel is not.
   */
  it("never rounds a partial figure to 0% or 100%", () => {
    const bijna = bepaalVoortgangsbalk(
      voortgang({ aantalGedekt: 499, aantalMogelijkGedekt: 499, aantalLeerplandoelen: 500 }),
    );
    const nauwelijks = bepaalVoortgangsbalk(
      voortgang({ aantalGedekt: 1, aantalMogelijkGedekt: 1, aantalLeerplandoelen: 500 }),
    );

    expect(bijna).toMatchObject({ percentageGedekt: 99, percentageMogelijk: 99 });
    expect(nauwelijks).toMatchObject({ percentageGedekt: 1, percentageMogelijk: 1 });
  });
});

/**
 * **The correspondence test, and the reason this file may hold a second gate at all.**
 *
 * `bepaalCijfer` counts rows because E5-03's doelsoort filter narrows the measured set client-side;
 * `bepaalVoortgangsbalk` has no rows and no filter, so the server's totals are the answer. What must never diverge is
 * the **gate order** — which state each returns for the same underlying plan. These assert exactly that, so a change to
 * one that is not mirrored in the other fails here rather than showing a teacher two different verdicts on one screen.
 */
describe("gate order matches bepaalCijfer", () => {
  const doel = (isGedekt: boolean): DoelDekking => ({
    code: "VOR-01",
    doelsoort: "Gemeenschappelijk",
    jaarFase: "K3",
    domein: "Natuur",
    subdomein: "Levende natuur",
    tekst: "Tekst",
    minimumdoelRef: null,
    nietMeerInOpstap: false,
    isGedekt,
    dekkendeThemas: isGedekt ? ["Water"] : [],
    // E5-05 made these two REQUIRED on `DoelDekking` while this branch was building, and the merge that brought them
    // in produced no conflict here — only `tsc -b` caught it, which is the whole point of E7-17's fix to `pnpm lint`.
    // Filled by `types.ts`'s own contract and `testdata.ts`'s convention: `oorzaak` is null exactly when covered, and
    // `kandidaatThemas` is empty both when covered and for `GeenThema`, which has nothing to name. This test is about
    // gate order and asserts nothing about the cause, so the neutral cause is the honest one to use.
    oorzaak: isGedekt ? null : "GeenThema",
    kandidaatThemas: [],
  });

  const dekking = (overrides: Partial<Dekking> = {}): Dekking => ({
    klasId: "k",
    klasNaam: "K3",
    schooljaarId: "s",
    schooljaarNaam: "2026-2027",
    bereik: "EigenJaarFase",
    gemetenJaarFasen: ["K3"],
    beschikbareJaarFasen: ["K3"],
    isTerugvalNaarHeelCurriculum: false,
    aantalBuitenBereik: 0,
    isBetrouwbaar: true,
    aantalOnopgelosteVervallenPlaatsingen: 0,
    aantalGedekt: 1,
    aantalLeerplandoelen: 2,
    doelen: [doel(true), doel(false)],
    ...overrides,
  });

  it.each([
    [
      "an ordinary measurable plan",
      dekking(),
      voortgang({ aantalGedekt: 1, aantalMogelijkGedekt: 1, aantalLeerplandoelen: 2, aantalOnbereikbaar: 1 }),
      "cijfer",
      "balk",
    ],
    [
      "a class with nothing in scope",
      dekking({ aantalLeerplandoelen: 0, doelen: [], aantalGedekt: 0 }),
      voortgang({ aantalLeerplandoelen: 0, aantalGedekt: 0, aantalMogelijkGedekt: 0 }),
      "nietMeetbaar",
      "nietMeetbaar",
    ],
    [
      "a plan with an unresolved stale placement",
      dekking({ isBetrouwbaar: false, aantalGedekt: null, aantalOnopgelosteVervallenPlaatsingen: 1 }),
      voortgang({
        isBetrouwbaar: false,
        aantalGedekt: null,
        aantalMogelijkGedekt: null,
        aantalOnopgelosteVervallenPlaatsingen: 1,
      }),
      "ingehouden",
      "ingehouden",
    ],
  ])("agrees on %s", (_naam, volleDekking, dekkingsvoortgang, cijfersoort, balksoort) => {
    expect(bepaalCijfer(volleDekking, volleDekking.doelen).soort).toBe(cijfersoort);
    expect(bepaalVoortgangsbalk(dekkingsvoortgang).soort).toBe(balksoort);
  });

  /**
   * The one state `bepaalCijfer` has and this does not, recorded so its absence reads as deliberate rather than
   * forgotten: `geenVanDezeSoort` belongs to E5-03's doelsoort filter, and the voortgang endpoint takes no filter.
   */
  it("has no doelsoort state, because it takes no doelsoort filter", () => {
    const alleen = bepaalCijfer(dekking(), []);

    expect(alleen.soort).toBe("geenVanDezeSoort");
    expect(["balk", "nietMeetbaar", "ingehouden"]).not.toContain("geenVanDezeSoort");
  });
});
