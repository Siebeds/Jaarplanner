import { describe, expect, it } from "vitest";
import type { AlgemeneFichedoel, AlgemeneFicheWeergave, AlgemeneFicheplaatsingWeergave } from "../algemene-fiches/gegevens";
import { gevolgVanDag } from "./vanDeDag";

/**
 * What taking one block off its day costs beyond itself (TB-030): the sentences the confirmation says, and none at all
 * when only the block goes, which is when the menu's bin acts without asking.
 */

const DOEL = { koppelingId: "k-1", leerplandoelCode: "LPD-1", jaarFase: "K3", tekst: "Een doel" } as unknown as AlgemeneFichedoel;

function fiche(aantalPlaatsingen: number, doelen: AlgemeneFichedoel[]): AlgemeneFicheWeergave {
  return { id: "f-1", klasId: "klas-1", naam: "turnen", omschrijving: null, aantalPlaatsingen, doelen };
}

function fichePlaatsing(momenten: { id: string; tekst: string | null }[]): AlgemeneFicheplaatsingWeergave {
  return {
    id: "fp-1",
    algemeneFicheId: "f-1",
    ficheNaam: "turnen",
    van: "2026-09-07",
    tot: "2026-09-18",
    momenten: momenten.map((m, i) => ({ ...m, datum: `2026-09-0${7 + i}`, begin: "10:30:00", einde: "11:20:00" })),
  };
}

const FICHE_DOEL = { soort: "fiche", plaatsingId: "fp-1", momentId: "fm-1" } as const;

function lijsten(over: Partial<Parameters<typeof gevolgVanDag>[1]>): Parameters<typeof gevolgVanDag>[1] {
  return { fichePlaatsingen: [], fiches: [], ...over };
}

describe("gevolgVanDag", () => {
  it("vraagt niets voor een activiteit", () => {
    expect(gevolgVanDag({ soort: "activiteit", plaatsingId: "ap-1" }, lijsten({}))).toEqual([]);
  });

  it("vraagt niets voor een fichedag zonder tekst die niet de laatste is", () => {
    const plaatsing = fichePlaatsing([{ id: "fm-1", tekst: null }, { id: "fm-2", tekst: "Kapla" }]);
    expect(gevolgVanDag(FICHE_DOEL, lijsten({ fichePlaatsingen: [plaatsing], fiches: [fiche(1, [DOEL])] }))).toEqual([]);
  });

  it("zegt dat de dagtekst meegaat, alleen voor die ene dag", () => {
    const plaatsing = fichePlaatsing([{ id: "fm-1", tekst: "Kapla" }, { id: "fm-2", tekst: null }]);
    expect(gevolgVanDag(FICHE_DOEL, lijsten({ fichePlaatsingen: [plaatsing], fiches: [fiche(1, [DOEL])] }))).toEqual([
      "blokmenu.tekstGaatMee",
    ]);
  });

  it("zegt de dekking alleen bij de laatste dag van de enige periode van een fiche met doelen", () => {
    const laatste = fichePlaatsing([{ id: "fm-1", tekst: "Kapla" }]);
    expect(gevolgVanDag(FICHE_DOEL, lijsten({ fichePlaatsingen: [laatste], fiches: [fiche(1, [DOEL])] }))).toEqual([
      "blokmenu.tekstGaatMee",
      "blokmenu.laatsteDag",
      "blokmenu.enigePeriode",
    ]);
    // Another period of the fiche still stands in the agenda, so it keeps counting.
    expect(gevolgVanDag(FICHE_DOEL, lijsten({ fichePlaatsingen: [laatste], fiches: [fiche(2, [DOEL])] }))).toEqual([
      "blokmenu.tekstGaatMee",
      "blokmenu.laatsteDag",
    ]);
    // Without goals there is nothing for dekking to lose.
    expect(gevolgVanDag(FICHE_DOEL, lijsten({ fichePlaatsingen: [laatste], fiches: [fiche(1, [])] }))).toEqual([
      "blokmenu.tekstGaatMee",
      "blokmenu.laatsteDag",
    ]);
  });

  it("raadt niet bij een plaatsing die de lijsten niet kennen", () => {
    expect(gevolgVanDag(FICHE_DOEL, lijsten({}))).toEqual([]);
  });
});
