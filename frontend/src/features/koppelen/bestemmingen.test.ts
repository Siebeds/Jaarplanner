import { describe, expect, it } from "vitest";
import type { ActiviteitWeergave, SubthemaWeergave, ThemaWeergave } from "../../lib/types";
import { filterBestemmingen, telBestemmingen } from "./bestemmingen";

/**
 * The two questions the destination sheet asks of the school's content, tested without a server or a
 * render: where does this doel already sit, and what survives the search box.
 *
 * Both drive something a teacher acts on. The first hides the link button on a row, so getting it
 * wrong either offers a duplicate the server refuses or hides a link that was never made. The second
 * decides which thema's are on screen at all.
 */

function activiteit(naam: string, codes: string[] = []): ActiviteitWeergave {
  return {
    id: `activiteit-${naam}`,
    naam,
    activiteitType: "Spel",
    hoek: null,
    verwachteUitkomsten: null,
    onderzoeksvraagId: null,
    kleur: null,
    doelkoppelingen: codes.map((code, i) => ({
      id: `koppeling-${naam}-${i}`,
      leerplandoelCode: code,
      status: "Manueel" as const,
      aiMotivatie: null,
    })),
  };
}

function subthema(naam: string, activiteiten: ActiviteitWeergave[], codes: string[] = []): SubthemaWeergave {
  return {
    id: `subthema-${naam}`,
    themaId: "thema-1",
    naam,
    duurWeken: 2,
    leeftijd: "K3",
    onderzoeksvragen: [],
    subdoelen: codes.map((code, i) => ({
      id: `subdoel-${naam}-${i}`,
      leeftijd: "K3",
      koppeling: { id: `k-${naam}-${i}`, leerplandoelCode: code, status: "Manueel" as const, aiMotivatie: null },
    })),
    activiteiten,
  };
}

function thema(naam: string, subthemas: SubthemaWeergave[], codes: string[] = []): ThemaWeergave {
  return {
    id: `thema-${naam}`,
    naam,
    duurWeken: 4,
    invalshoeken: null,
    kernwoordenschat: [],
    rijkeWoordenschat: [],
    heeftVoldoendeThemadoelen: codes.length >= 2,
    themadoelen: codes.map((code, i) => ({
      id: `themadoel-${naam}-${i}`,
      koppeling: { id: `k-${naam}-${i}`, leerplandoelCode: code, status: "Manueel" as const, aiMotivatie: null },
    })),
    subthemas,
  };
}

const HERFST = thema(
  "Herfst en bladeren",
  [
    subthema("Bladeren sorteren", [activiteit("Bladerslinger"), activiteit("Blad tellen", ["WIS-3.14"])]),
    subthema("Kastanjes verzamelen", [activiteit("Kastanjerace")], ["WIS-3.14"]),
  ],
  ["NED-1.1"],
);

const WINTER = thema("Winter", [subthema("Sneeuw", [activiteit("Sneeuwpop bouwen")])]);

describe("filterBestemmingen", () => {
  it("geeft zonder zoekterm elke tak terug", () => {
    const takken = filterBestemmingen([HERFST, WINTER], "WIS-3.14", "");

    expect(takken.map((tak) => tak.thema.naam)).toEqual(["Herfst en bladeren", "Winter"]);
    expect(takken[0].subthemas).toHaveLength(2);
    expect(takken[0].subthemas[0].activiteiten).toHaveLength(2);
  });

  it("markeert waar het doel al gekoppeld is, op alle drie de niveaus", () => {
    const [herfst] = filterBestemmingen([HERFST], "WIS-3.14", "");

    // Not on the thema: its one themadoel is a different code.
    expect(herfst.alGekoppeld).toBe(false);
    expect(herfst.subthemas[0].alGekoppeld).toBe(false);
    expect(herfst.subthemas[0].activiteiten[0].alGekoppeld).toBe(false);
    expect(herfst.subthemas[0].activiteiten[1].alGekoppeld).toBe(true);
    expect(herfst.subthemas[1].alGekoppeld).toBe(true);
  });

  it("markeert een themadoel dat het doel al draagt", () => {
    const [herfst] = filterBestemmingen([HERFST], "NED-1.1", "");
    expect(herfst.alGekoppeld).toBe(true);
  });

  it("meldt een vol thema, zodat de knop niet in een 400 loopt", () => {
    const vol = thema("Vol", [], ["A-1", "A-2", "A-3"]);
    const [tak] = filterBestemmingen([vol], "WIS-3.14", "");
    expect(tak.themaVol).toBe(true);

    const [ruimte] = filterBestemmingen([HERFST], "WIS-3.14", "");
    expect(ruimte.themaVol).toBe(false);
  });

  it("houdt bij een treffer op thema alles eronder overeind", () => {
    const takken = filterBestemmingen([HERFST, WINTER], "WIS-3.14", "herfst");

    expect(takken).toHaveLength(1);
    expect(takken[0].subthemas).toHaveLength(2);
    expect(takken[0].subthemas[0].activiteiten).toHaveLength(2);
  });

  it("houdt bij een treffer op activiteit de twee namen erboven overeind", () => {
    const takken = filterBestemmingen([HERFST, WINTER], "WIS-3.14", "bladerslinger");

    expect(takken).toHaveLength(1);
    expect(takken[0].thema.naam).toBe("Herfst en bladeren");
    expect(takken[0].subthemas).toHaveLength(1);
    expect(takken[0].subthemas[0].subthema.naam).toBe("Bladeren sorteren");
    expect(takken[0].subthemas[0].activiteiten.map((a) => a.activiteit.naam)).toEqual(["Bladerslinger"]);
  });

  it("houdt bij een treffer op subthema al zijn activiteiten overeind", () => {
    const takken = filterBestemmingen([HERFST], "WIS-3.14", "kastanjes");

    expect(takken[0].subthemas).toHaveLength(1);
    expect(takken[0].subthemas[0].activiteiten.map((a) => a.activiteit.naam)).toEqual(["Kastanjerace"]);
  });

  it("laat een thema zonder treffer weg", () => {
    expect(filterBestemmingen([HERFST, WINTER], "WIS-3.14", "sneeuw").map((t) => t.thema.naam)).toEqual(["Winter"]);
    expect(filterBestemmingen([HERFST, WINTER], "WIS-3.14", "bestaat niet")).toEqual([]);
  });

  it("negeert hoofdletters en spaties rond de term", () => {
    expect(filterBestemmingen([HERFST, WINTER], "WIS-3.14", "  HERFST  ")).toHaveLength(1);
  });

  it("laat een thema staan dat zelf matcht maar geen subthema's heeft", () => {
    const leeg = thema("Lente", []);
    const takken = filterBestemmingen([leeg], "WIS-3.14", "lente");

    expect(takken).toHaveLength(1);
    expect(takken[0].subthemas).toEqual([]);
  });
});

describe("telBestemmingen", () => {
  it("telt elk niveau mee", () => {
    // Herfst: 1 thema + 2 subthema's + 3 activiteiten. Winter: 1 + 1 + 1.
    expect(telBestemmingen(filterBestemmingen([HERFST, WINTER], "WIS-3.14", ""))).toBe(9);
  });

  it("telt ook wat al gekoppeld is", () => {
    // The count answers "did the search find anything", so a row the doel already sits on still
    // counts. Otherwise searching for a thema you can see reports zero results.
    const takken = filterBestemmingen([HERFST], "WIS-3.14", "kastanjes");
    expect(telBestemmingen(takken)).toBe(3);
  });

  it("is nul op een lege boom", () => {
    expect(telBestemmingen([])).toBe(0);
  });
});
