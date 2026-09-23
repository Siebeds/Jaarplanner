import type { Dekkingsvoortgang } from "../../lib/types";
import type { Deurmat, Deurmatsignaal, Deurmatvoorstel } from "./gegevens";
import { alleMinimumdoelenInPrognose, bepaalHouding } from "./houding";

/** FB-071: Chuck's posture is his status, read from the deurmat and the dekking and nothing else. */

function signaal(delen: Partial<Deurmatsignaal>): Deurmatsignaal {
  return {
    id: "s1",
    soort: "MinimumdoelInGevaar",
    klasId: "klas-a",
    klasnaam: "K3 A",
    gegevens: { doelRef: "K-1.1" },
    verwijzing: "/dekking",
    aangemaakt: "2026-11-16T07:00:00+01:00",
    gezien: false,
    ...delen,
  };
}

const voorstel: Deurmatvoorstel = {
  soort: "Subthemavoorstel",
  id: "v1",
  titel: "Bladeren",
  verwijzing: "/themas/t1",
  aiMotivatie: "Omdat.",
};

function voortgang(delen: Partial<Dekkingsvoortgang>): Dekkingsvoortgang {
  return {
    bereik: "EigenJaarFase",
    gemetenJaarFasen: ["K3"],
    isTerugvalNaarHeelCurriculum: false,
    aantalBuitenBereik: 0,
    isBetrouwbaar: true,
    aantalOnopgelosteVervallenPlaatsingen: 0,
    aantalGedekt: 10,
    aantalLeerplandoelen: 20,
    aantalMinimumdoelenGedekt: 4,
    aantalMinimumdoelenMogelijkGedekt: 5,
    aantalMinimumdoelen: 6,
    aantalMinimumdoelenInPrognose: 2,
    ...delen,
  };
}

const leeg: Deurmat = { signalen: [], voorstellen: [] };

describe("bepaalHouding", () => {
  it("sleeps with nothing on the deurmat and goals outside the prognose", () => {
    expect(bepaalHouding(leeg, voortgang({ aantalMinimumdoelenInPrognose: 1 })).soort).toBe("slaapt");
    expect(bepaalHouding(undefined, undefined).soort).toBe("slaapt");
  });

  it("has something ready when a proposal or a signal that is no risk waits", () => {
    const houding = bepaalHouding({ signalen: [], voorstellen: [voorstel] }, undefined);
    expect(houding).toEqual({ soort: "klaar", gevaar: null, aantal: 1 });
  });

  it("warns about a goal at risk before anything else, and counts everything on the deurmat", () => {
    const gevaar = signaal({});
    const houding = bepaalHouding({ signalen: [gevaar], voorstellen: [voorstel] }, voortgang({}));
    expect(houding).toEqual({ soort: "gevaar", gevaar, aantal: 2 });
  });

  it("speaks about a minimumdoel at risk before a subthema not planned", () => {
    const subthema = signaal({ id: "s0", soort: "SubthemaNietGepland" });
    const minimumdoel = signaal({ id: "s1" });
    expect(bepaalHouding({ signalen: [subthema, minimumdoel], voorstellen: [] }, undefined).gevaar).toBe(minimumdoel);
  });

  it("speaks about the klas on screen first", () => {
    const elders = signaal({ id: "s1", klasId: "klas-b" });
    const hier = signaal({ id: "s2", klasId: "klas-a" });
    expect(bepaalHouding({ signalen: [elders, hier], voorstellen: [] }, undefined, "klas-a").gevaar).toBe(hier);
    expect(bepaalHouding({ signalen: [elders, hier], voorstellen: [] }, undefined, "klas-c").gevaar).toBe(elders);
  });

  it("purrs only with nothing waiting and every minimumdoel gedekt or in the prognose", () => {
    expect(bepaalHouding(leeg, voortgang({})).soort).toBe("spint");
    expect(bepaalHouding({ signalen: [], voorstellen: [voorstel] }, voortgang({})).soort).toBe("klaar");
  });
});

describe("alleMinimumdoelenInPrognose", () => {
  it("never answers yes on a withheld, missing or empty figure", () => {
    expect(alleMinimumdoelenInPrognose(undefined)).toBe(false);
    expect(alleMinimumdoelenInPrognose(voortgang({ isBetrouwbaar: false }))).toBe(false);
    expect(alleMinimumdoelenInPrognose(voortgang({ aantalMinimumdoelenGedekt: null }))).toBe(false);
    expect(alleMinimumdoelenInPrognose(voortgang({ aantalMinimumdoelenInPrognose: undefined }))).toBe(false);
    expect(
      alleMinimumdoelenInPrognose(
        voortgang({ aantalMinimumdoelen: 0, aantalMinimumdoelenGedekt: 0, aantalMinimumdoelenInPrognose: 0 }),
      ),
    ).toBe(false);
  });

  it("does not count proposals the teacher has not decided (the ceiling is not the prognose)", () => {
    // Five could be gedekt if she accepted every proposal, but only four are gedekt and one is in the prognose.
    expect(alleMinimumdoelenInPrognose(voortgang({ aantalMinimumdoelenInPrognose: 1 }))).toBe(false);
  });
});
