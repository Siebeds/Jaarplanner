import { describe, expect, it } from "vitest";
import { ruilbesluit, type Bezetter } from "./ruilen";
import { t } from "../../i18n";

/**
 * The swap rule, case by case (owner ruling, 2026-08-31).
 *
 * Worth its own file because the rule is the whole decision and the two mutations that carry it out are
 * plumbing. The refusals matter more than the successes here: the owner accepted refusal as the price of
 * a real exchange, so a refusal that stops naming what is in the way is the way this feature gets worse
 * without anything failing.
 */
const hoek = (slot: number, naam = "bouwhoek"): Bezetter => ({
  soort: "hoek",
  plaatsingId: "hp-1",
  momentId: `m-${slot}`,
  naam,
  datum: "2026-09-01",
  slot,
});

const activiteit = (slot: number, naam = "kringgesprek", lengte = 1): Bezetter => ({
  soort: "activiteit",
  plaatsingId: `p-${slot}`,
  naam,
  datum: "2026-09-01",
  slot,
  lengte,
});

describe("ruilbesluit", () => {
  it("verplaatst naar een leeg lesuur", () => {
    expect(ruilbesluit(hoek(1), [], 4)).toEqual({ soort: "verplaats" });
  });

  it("ruilt hoekenwerk met een activiteit van een lesuur", () => {
    const ander = activiteit(4);
    expect(ruilbesluit(hoek(1), [ander], 4)).toEqual({ soort: "ruil", ander });
  });

  it("ruilt twee activiteiten onderling, want het is een regel voor het hele raster", () => {
    const ander = activiteit(4, "voorlezen");
    expect(ruilbesluit(activiteit(1), [ander], 4)).toEqual({ soort: "ruil", ander });
  });

  it("ruilt ook hoekenwerk met hoekenwerk", () => {
    const ander = hoek(4, "boekenhoek");
    expect(ruilbesluit(hoek(1), [ander], 4)).toEqual({ soort: "ruil", ander });
  });

  it("weigert als er meer dan een ding op het doellesuur staat, en noemt het lesuur", () => {
    const besluit = ruilbesluit(hoek(1), [activiteit(4), hoek(4, "boekenhoek")], 4);
    // Lesuur 5, not 4: the slot is zero based and a teacher counts from one.
    expect(besluit).toEqual({ soort: "weiger", melding: t("slepen.ruilTeVol", { nummer: 5 }) });
  });

  it("weigert als het ding op het doellesuur meer dan een lesuur duurt, en noemt DAT ding", () => {
    const besluit = ruilbesluit(hoek(1), [activiteit(4, "kringgesprek", 3)], 4);
    expect(besluit).toEqual({
      soort: "weiger",
      melding: t("slepen.ruilTeLang", { naam: "kringgesprek" }),
    });
  });

  it("weigert als het GESLEEPTE ding meer dan een lesuur duurt, en noemt dat", () => {
    const besluit = ruilbesluit(activiteit(1, "uitstap", 4), [hoek(4, "boekenhoek")], 4);
    expect(besluit).toEqual({ soort: "weiger", melding: t("slepen.ruilTeLang", { naam: "uitstap" }) });
  });

  it("laat een lang ding wel naar een leeg lesuur, want daar valt niets te ruilen", () => {
    expect(ruilbesluit(activiteit(1, "uitstap", 4), [], 4)).toEqual({ soort: "verplaats" });
  });
});
