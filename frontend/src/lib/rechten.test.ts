import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import type { Ik } from "./aanmelding";
import { RECHTENMATRIX, ZONDER_DIRECTIE, geenToegangZin, magVoor, staatToe, type Rechtbron, type Rij } from "./rechten";
import { t } from "../i18n";

/**
 * The frontend's copy of the ADR-0030 §3 matrix, checked against §3 itself (E6-02 slice 4).
 *
 * **The same table the server's `RechtenmatrixTests` holds**, relation for relation, so a row that drifts between the
 * two files fails one of the two suites: each row × each relation held alone, towards content of K3 and the klas the
 * leerkracht teaches. The two activiteit rows depend on the maker and the links and have their own cases below, as
 * they do on the server.
 */

const IK = "a0000000-0000-4000-8000-000000000001";
const ANDERE_PERSOON = "b0000000-0000-4000-8000-000000000002";
const EIGEN_KLAS = "c0000000-0000-4000-8000-000000000003";
const ANDERE_KLAS = "d0000000-0000-4000-8000-000000000004";
const LEEFTIJD = "K3";

function ik(delen: Partial<Ik>): Ik {
  return {
    id: IK,
    naam: "Test",
    email: "test@school.be",
    isDirectie: false,
    heeftThemabeheer: false,
    heeftLeerlingzorg: false,
    hoofdleerkrachtLeeftijden: [],
    leerkrachtLeeftijden: [],
    eigenKlasIds: [],
    rapportklasIds: [],
    lopendeRapportklasIds: [],
    ...delen,
  };
}

/** The relations of §3, each held alone. The server's `Relaties`, with the same names. */
const RELATIES: Record<string, Ik> = {
  Directie: ik({ isDirectie: true }),
  TB: ik({ heeftThemabeheer: true }),
  HL: ik({ hoofdleerkrachtLeeftijden: [LEEFTIJD] }),
  "HL andere leeftijd": ik({ hoofdleerkrachtLeeftijden: ["L1"] }),
  "LK leeftijd": ik({ leerkrachtLeeftijden: [LEEFTIJD] }),
  "LK andere leeftijd": ik({ leerkrachtLeeftijden: ["L1"] }),
  "LK eigen": ik({ eigenKlasIds: [EIGEN_KLAS] }),
  // "LK eigen" for the ontwikkelingsrapport (ADR-0030 footnote ⁶): the klas grants K3, during its schooljaar or after it.
  "LK rapport": ik({ rapportklasIds: [EIGEN_KLAS], lopendeRapportklasIds: [EIGEN_KLAS] }),
  "LK rapport voorbij": ik({ rapportklasIds: [EIGEN_KLAS] }),
  // FB-008 (ADR-0035 R18): the right directie gave, and nothing else.
  Leerlingzorg: ik({ heeftLeerlingzorg: true }),
  Ander: ik({}),
};

/** §3 as data: the relations that pass each row. The server's `Verwacht`, row for row. */
type Activiteitrij = "ActiviteitVerwijderen" | "ActiviteitVerplaatsen" | "EigenActiviteitLezen" | "EigenActiviteitGebruiken";
const ACTIVITEITRIJEN: Activiteitrij[] = [
  "ActiviteitVerwijderen",
  "ActiviteitVerplaatsen",
  "EigenActiviteitLezen",
  "EigenActiviteitGebruiken",
];

const VERWACHT: Record<Exclude<Rij, Activiteitrij>, string[]> = {
  Curriculumbeheer: ["Directie"],
  Beheer: ["Directie"],
  MenselijkeBeslissingenVerwijderen: ["Directie"],
  ThemaBewerken: ["Directie", "TB"],
  // Without a Themabron only directie, and the frontend never has one (I26): see `RECHTENMATRIX.ThemaVerwijderen`.
  ThemaVerwijderen: ["Directie"],
  SchoolcontentImporteren: ["Directie", "TB"],
  ThemaOpbouw: ["Directie", "TB"],
  Wizardinhoud: ["Directie", "TB"],
  DoelsuggestiesMaken: ["Directie", "TB"],
  DoelsuggestiesBeoordelen: ["Directie", "TB"],
  SubthemaBeheren: ["Directie", "HL"],
  SubdoelenBeheren: ["Directie", "HL"],
  DoelenKoppelen: ["Directie", "HL"],
  StreefwoordenschatAanpassen: ["Directie", "HL", "LK leeftijd"],
  GedeeldeActiviteitBewerken: ["Directie", "HL", "LK leeftijd"],
  // ADR-0049 D1, D2: a shared one is created by HL, an own one by a leerkracht of that leeftijd.
  GedeeldeActiviteitMaken: ["Directie", "HL"],
  EigenActiviteitMaken: ["Directie", "LK leeftijd"],
  KlasplanningBewerken: ["Directie", "LK eigen"],
  // FB-013 (ADR-0040 Z1-Z5): a K3 klas is read by its own leerkracht, the leerkrachten and hoofdleerkrachten of K3,
  // themabeheer and directie. Not by another leeftijd, and not by a gebruiker without a right.
  KlasplanningBekijken: ["Directie", "TB", "HL", "LK leeftijd", "LK eigen"],
  // R17: "LK eigen" on a klas's planning reads no report; only the report's own relation does (footnote ⁶, R26).
  // R18: Leerlingzorg reads every klas's reports, and passes no other row.
  OntwikkelingsrapportLezen: ["Directie", "LK rapport", "LK rapport voorbij", "Leerlingzorg"],
  LeerlingenBeheren: ["Directie", "LK rapport"],
  RapportInvullen: ["Directie", "LK rapport"],
  // R31: not directie, the one row it does not pass. D4: a K3 leerkracht only while the schooljaar runs.
  RapportsetBewerken: ["LK rapport"],
  // FB-036 (ADR-0043): on someone else's woordweb only directie; her own web is its own case below.
  WoordwebBewerken: ["Directie"],
  // FB-057 (ADR-0050 P4): the hoofdleerkracht of the leeftijd, and directie; not themabeheer alone.
  SubdoelplaatsingVragen: ["Directie", "HL"],
  SubdoelplaatsingBeslissen: ["Directie", "HL"],
  // FB-025 (ADR-0056 A3): on someone else's proposal only directie; the asker's own is its own case below.
  ActiviteitvoorstelBeslissen: ["Directie"],
};

/** The resource each row is asked about, as the server's `BronVoor` builds it. */
function bronVoor(rij: Rij): Rechtbron | undefined {
  if (rij === "WoordwebBewerken") return { soort: "woordweb", eigenaarId: ANDERE_PERSOON };
  if (rij === "ActiviteitvoorstelBeslissen") return { soort: "activiteitvoorstel", leeftijd: LEEFTIJD, aanvragerId: ANDERE_PERSOON };
  if (rij === "KlasplanningBekijken") return { soort: "klasinzage", klasId: EIGEN_KLAS, leeftijden: [LEEFTIJD] };
  if (rij === "KlasplanningBewerken") return { soort: "klas", klasId: EIGEN_KLAS };
  if (rij === "OntwikkelingsrapportLezen" || rij === "LeerlingenBeheren" || rij === "RapportInvullen") {
    return { soort: "rapportklas", klasId: EIGEN_KLAS };
  }
  const kolommen = RECHTENMATRIX[rij];
  return kolommen.some((kolom) => kolom === "Hoofdleerkracht" || kolom === "LeerkrachtLeeftijd")
    ? { soort: "leeftijd", leeftijd: LEEFTIJD }
    : undefined;
}

const activiteit = (makerId: string | null, heeftDoelkoppelingen: boolean, eigenaarId: string | null = null): Rechtbron => ({
  soort: "activiteit",
  leeftijd: LEEFTIJD,
  makerId,
  heeftDoelkoppelingen,
  eigenaarId,
});

describe("de rechtenmatrix van de frontend", () => {
  const gevallen = Object.entries(VERWACHT).flatMap(([rij, toegelaten]) =>
    Object.keys(RELATIES).map((relatie) => [rij as Rij, relatie, toegelaten.includes(relatie)] as const),
  );

  it.each(gevallen)("%s voor %s: %s", (rij, relatie, verwacht) => {
    expect(staatToe(RELATIES[relatie], rij, bronVoor(rij))).toBe(verwacht);
  });

  it("heeft een verwachting voor elke rij, en elke rij van de server", () => {
    const rijen = Object.keys(RECHTENMATRIX).sort();
    expect([...Object.keys(VERWACHT), ...ACTIVITEITRIJEN].sort()).toEqual(rijen);
    // The server's `Rechtenmatrix.Rijen`, by policy name: twenty since FB-001's two report rows, 21 with FB-002's set
    // row, 22 with FB-013's read row, 23 with FB-003's filling-in row, 24 with FB-036's woordweb row, 28 with FB-015's four own-activiteit rows,
    // 30 with FB-057's two subdoelplaatsing rows, 31 with FB-025's activiteitvoorstel row.
    expect(rijen).toHaveLength(31);
  });

  it("laat wie een activiteitvoorstel vroeg het beslissen zolang ze die leeftijd heeft, en andermans alleen directie (ADR-0056)", () => {
    const eigen = { leeftijd: LEEFTIJD, aanvragerId: IK };
    expect(magVoor(RELATIES["LK leeftijd"]).activiteitvoorstelBeslissen(eigen)).toBe(true);
    expect(magVoor(RELATIES.HL).activiteitvoorstelBeslissen(eigen)).toBe(false);
    expect(magVoor(RELATIES.Ander).activiteitvoorstelBeslissen(eigen)).toBe(false);
    expect(magVoor(RELATIES["LK leeftijd"]).activiteitvoorstelBeslissen({ ...eigen, aanvragerId: ANDERE_PERSOON })).toBe(false);
    expect(magVoor(RELATIES.Directie).activiteitvoorstelBeslissen({ ...eigen, aanvragerId: ANDERE_PERSOON })).toBe(true);
    expect(staatToe(RELATIES.Ander, "WoordwebBewerken", { soort: "activiteitvoorstel", leeftijd: LEEFTIJD, aanvragerId: IK })).toBe(false);
  });

  it("laat de eigenaar haar eigen woordweb wijzigen welk recht ze ook heeft, en andermans alleen directie (ADR-0043)", () => {
    const eigen: Rechtbron = { soort: "woordweb", eigenaarId: IK };
    for (const relatie of Object.values(RELATIES)) expect(staatToe(relatie, "WoordwebBewerken", eigen)).toBe(true);
    // The woordweb resource opens no other row.
    expect(staatToe(RELATIES.Ander, "SubthemaBeheren", eigen)).toBe(false);
    expect(magVoor(RELATIES.Ander).woordwebBewerken(IK)).toBe(true);
    expect(magVoor(RELATIES.TB).woordwebBewerken(ANDERE_PERSOON)).toBe(false);
    expect(magVoor(RELATIES.Directie).woordwebBewerken(ANDERE_PERSOON)).toBe(true);
    expect(magVoor(undefined).woordwebBewerken(IK)).toBe(false);
  });

  it("geeft een leerkracht de kinderen van een andere K3-klas niet, en de klasplanning geen rapport (R17)", () => {
    const rapportklas = (klasId: string): Rechtbron => ({ soort: "rapportklas", klasId });
    expect(staatToe(RELATIES["LK rapport"], "OntwikkelingsrapportLezen", rapportklas(ANDERE_KLAS))).toBe(false);
    expect(staatToe(RELATIES["LK rapport"], "LeerlingenBeheren", rapportklas(ANDERE_KLAS))).toBe(false);
    // The planning resource of the same klas is a different resource: it fails closed on a report row.
    expect(staatToe(RELATIES["LK rapport"], "OntwikkelingsrapportLezen", { soort: "klas", klasId: EIGEN_KLAS })).toBe(
      false,
    );
  });

  it("laat directie elke rij toe, met of zonder bron, behalve de K3-set (R31)", () => {
    for (const rij of Object.keys(RECHTENMATRIX) as Rij[]) {
      if (ZONDER_DIRECTIE.has(rij)) continue;
      expect(staatToe(RELATIES.Directie, rij)).toBe(true);
      expect(staatToe(RELATIES.Directie, rij, activiteit(null, true))).toBe(true);
    }
    expect([...ZONDER_DIRECTIE]).toEqual(["RapportsetBewerken"]);
    expect(staatToe(RELATIES.Directie, "RapportsetBewerken")).toBe(false);
    expect(magVoor(RELATIES.Directie).rapportsetBewerken).toBe(false);
    // Not even with a running K3 klas of its own (owner, 2026-09-15, "Nooit wie directie heeft"); the same klas makes a
    // plain gebruiker pass, so the refusal comes from the directie right.
    expect(staatToe(ik({ isDirectie: true, rapportklasIds: [EIGEN_KLAS], lopendeRapportklasIds: [EIGEN_KLAS] }), "RapportsetBewerken")).toBe(false);
    expect(staatToe(ik({ rapportklasIds: [EIGEN_KLAS], lopendeRapportklasIds: [EIGEN_KLAS] }), "RapportsetBewerken")).toBe(true);
  });

  it("faalt dicht zonder of met de verkeerde bron, en voor niemand", () => {
    expect(staatToe(RELATIES.HL, "SubthemaBeheren")).toBe(false);
    expect(staatToe(RELATIES.HL, "SubthemaBeheren", { soort: "klas", klasId: EIGEN_KLAS })).toBe(false);
    expect(staatToe(RELATIES["LK eigen"], "KlasplanningBewerken", { soort: "klas", klasId: ANDERE_KLAS })).toBe(false);
    expect(staatToe(undefined, "Beheer")).toBe(false);
    expect(staatToe(undefined, "ThemaBewerken")).toBe(false);
  });

  it("geeft de unie van alle kolommen: themabeheer en een klas samen", () => {
    const beide = ik({ heeftThemabeheer: true, leerkrachtLeeftijden: [LEEFTIJD], eigenKlasIds: [EIGEN_KLAS] });
    expect(staatToe(beide, "ThemaBewerken")).toBe(true);
    expect(staatToe(beide, "GedeeldeActiviteitBewerken", { soort: "leeftijd", leeftijd: LEEFTIJD })).toBe(true);
    expect(staatToe(beide, "KlasplanningBewerken", { soort: "klas", klasId: EIGEN_KLAS })).toBe(true);
    // A column that does not apply takes nothing away, and grants nothing either.
    expect(staatToe(beide, "SubthemaBeheren", { soort: "leeftijd", leeftijd: LEEFTIJD })).toBe(false);
  });

  describe("een activiteit verwijderen (R25, R26, R33)", () => {
    const verwijderen = (wie: Ik, bron: Rechtbron) => staatToe(wie, "ActiviteitVerwijderen", bron);

    it("mag de maker zonder koppelingen, wat die verder ook heeft", () => {
      expect(verwijderen(RELATIES.Ander, activiteit(IK, false))).toBe(true);
      expect(verwijderen(RELATIES.TB, activiteit(IK, false))).toBe(true);
      expect(verwijderen(RELATIES["LK andere leeftijd"], activiteit(IK, false))).toBe(true);
    });

    it("mag de maker niet meer zodra er een doel aan hangt", () => {
      expect(verwijderen(RELATIES.Ander, activiteit(IK, true))).toBe(false);
      expect(verwijderen(RELATIES["LK leeftijd"], activiteit(IK, true))).toBe(false);
    });

    it("mag een collega van dezelfde leeftijd niet, ook niet zonder maker", () => {
      expect(verwijderen(RELATIES["LK leeftijd"], activiteit(ANDERE_PERSOON, false))).toBe(false);
      expect(verwijderen(RELATIES["LK leeftijd"], activiteit(null, false))).toBe(false);
    });

    it("mag de hoofdleerkracht van die leeftijd altijd", () => {
      expect(verwijderen(RELATIES.HL, activiteit(ANDERE_PERSOON, true))).toBe(true);
      expect(verwijderen(RELATIES.HL, activiteit(null, false))).toBe(true);
      expect(verwijderen(RELATIES["HL andere leeftijd"], activiteit(null, true))).toBe(false);
    });

    it("leest de maker uit de payload: makerId en doelkoppelingen", () => {
      const mag = magVoor(RELATIES.Ander);
      expect(mag.activiteitVerwijderen({ leeftijd: LEEFTIJD, makerId: IK, doelkoppelingen: [] })).toBe(true);
      expect(mag.activiteitVerwijderen({ leeftijd: LEEFTIJD, makerId: IK, doelkoppelingen: [{}] })).toBe(false);
      // No `makerId` in the payload reads as no maker, the safe direction.
      expect(mag.activiteitVerwijderen({ leeftijd: LEEFTIJD, doelkoppelingen: [] })).toBe(false);
    });
  });

  describe("een eigen activiteit (ADR-0049)", () => {
    const eigen = (eigenaar: string, metDoelen = false) => activiteit(eigenaar, metDoelen, eigenaar);
    const bewerkingen: Rij[] = ["GedeeldeActiviteitBewerken", "ActiviteitVerwijderen", "DoelenKoppelen", "ActiviteitVerplaatsen"];

    it("bewerkt, koppelt, verplaatst en verwijdert alleen de eigenaar en de directie, ook met doelen", () => {
      const alles = ik({ heeftThemabeheer: true, hoofdleerkrachtLeeftijden: [LEEFTIJD], leerkrachtLeeftijden: [LEEFTIJD] });
      for (const rij of bewerkingen) {
        expect(staatToe(alles, rij, eigen(ANDERE_PERSOON))).toBe(false);
        expect(staatToe(RELATIES.Directie, rij, eigen(ANDERE_PERSOON))).toBe(true);
        expect(staatToe(RELATIES.Ander, rij, eigen(IK, true))).toBe(true);
      }
    });

    it.each([
      ["Directie", true],
      ["HL", true],
      ["LK leeftijd", true],
      ["TB", false],
      ["HL andere leeftijd", false],
      ["LK andere leeftijd", false],
      ["LK eigen", false],
      ["Ander", false],
    ] as const)("lezen: %s %s", (relatie, mag) => {
      expect(staatToe(RELATIES[relatie], "EigenActiviteitLezen", eigen(ANDERE_PERSOON))).toBe(mag);
    });

    it.each([
      ["Directie", true],
      ["LK leeftijd", true],
      ["HL", false],
      ["TB", false],
      ["LK andere leeftijd", false],
      ["Ander", false],
    ] as const)("gebruiken: %s %s", (relatie, mag) => {
      expect(staatToe(RELATIES[relatie], "EigenActiviteitGebruiken", eigen(ANDERE_PERSOON))).toBe(mag);
    });

    it("biedt gebruiken niet aan op een eigen of een gedeelde activiteit", () => {
      const mag = magVoor(RELATIES["LK leeftijd"]);
      expect(mag.activiteitGebruiken({ leeftijd: LEEFTIJD, eigenaarId: ANDERE_PERSOON, doelkoppelingen: [] })).toBe(true);
      expect(mag.activiteitGebruiken({ leeftijd: LEEFTIJD, eigenaarId: IK, doelkoppelingen: [] })).toBe(false);
      expect(mag.activiteitGebruiken({ leeftijd: LEEFTIJD, eigenaarId: null, doelkoppelingen: [] })).toBe(false);
    });

    it("laat een leerkracht een eigen activiteit maken en een hoofdleerkracht ook een gedeelde", () => {
      const lk = magVoor(RELATIES["LK leeftijd"]);
      expect([lk.activiteitMaken(LEEFTIJD), lk.eigenActiviteitMaken(LEEFTIJD), lk.gedeeldeActiviteitMaken(LEEFTIJD)]).toEqual([true, true, false]);
      const hl = magVoor(RELATIES.HL);
      expect([hl.activiteitMaken(LEEFTIJD), hl.eigenActiviteitMaken(LEEFTIJD), hl.gedeeldeActiviteitMaken(LEEFTIJD)]).toEqual([true, false, true]);
      expect(magVoor(RELATIES.Ander).activiteitMaken(LEEFTIJD)).toBe(false);
    });

    it("opent geen woordweb, en een woordweb opent geen eigen activiteit", () => {
      expect(staatToe(RELATIES.Ander, "WoordwebBewerken", eigen(IK))).toBe(false);
      for (const rij of bewerkingen) {
        expect(staatToe(RELATIES.Ander, rij, { soort: "woordweb", eigenaarId: IK })).toBe(false);
      }
    });
  });

  describe("een activiteit verplaatsen (R19, R23; I19)", () => {
    const verplaatsen = (wie: Ik, bron: Rechtbron) => staatToe(wie, "ActiviteitVerplaatsen", bron);

    it("mag een leerkracht van die leeftijd zonder koppelingen, en niet met", () => {
      expect(verplaatsen(RELATIES["LK leeftijd"], activiteit(null, false))).toBe(true);
      expect(verplaatsen(RELATIES["LK andere leeftijd"], activiteit(null, false))).toBe(false);
      expect(verplaatsen(RELATIES["LK leeftijd"], activiteit(null, true))).toBe(false);
    });

    it("mag de hoofdleerkracht ook met koppelingen", () => {
      expect(verplaatsen(RELATIES.HL, activiteit(null, true))).toBe(true);
    });

    it("geeft de maker geen verplaatsrecht", () => {
      expect(verplaatsen(RELATIES.Ander, activiteit(IK, false))).toBe(false);
      expect(verplaatsen(RELATIES.TB, activiteit(IK, false))).toBe(false);
      expect(verplaatsen(RELATIES["LK eigen"], activiteit(IK, false))).toBe(false);
    });
  });
});

/*
  The server's I26 unit cases, as far as the frontend's resource reaches: themabeheer on a thema holding nothing
  (`Themabron` with no one else's content and no linked leeftijd) passes, on one holding content it does not, directie
  passes both, nobody else passes either, and without a resource the column fails closed.
*/
describe("een thema verwijderen (I26)", () => {
  const leeg: Rechtbron = { soort: "thema", leeg: true };
  const vol: Rechtbron = { soort: "thema", leeg: false };

  it("mag themabeheer een leeg thema, en geen thema met inhoud", () => {
    expect(staatToe(RELATIES.TB, "ThemaVerwijderen", leeg)).toBe(true);
    expect(staatToe(RELATIES.TB, "ThemaVerwijderen", vol)).toBe(false);
  });

  it("mag directie elk thema", () => {
    expect(staatToe(RELATIES.Directie, "ThemaVerwijderen", vol)).toBe(true);
  });

  it.each(["HL", "HL andere leeftijd", "LK leeftijd", "LK andere leeftijd", "LK eigen", "Ander"])(
    "mag %s ook een leeg thema niet",
    (relatie) => {
      expect(staatToe(RELATIES[relatie], "ThemaVerwijderen", leeg)).toBe(false);
    },
  );

  it("faalt dicht zonder bron of met een bron van een andere soort", () => {
    expect(staatToe(RELATIES.TB, "ThemaVerwijderen")).toBe(false);
    expect(staatToe(RELATIES.TB, "ThemaVerwijderen", { soort: "leeftijd", leeftijd: LEEFTIJD })).toBe(false);
  });
});

describe("de antwoorden die de schermen vragen", () => {
  it("geeft niemand iets zolang /api/ik niet geantwoord heeft", () => {
    const mag = magVoor(undefined);
    expect(Object.values(mag).filter((waarde) => waarde === true)).toEqual([]);
    expect(mag.klasplanningBewerken(null)).toBe(false);
    expect(mag.klasplanningBewerken(EIGEN_KLAS)).toBe(false);
    expect(mag.subthemaBeheren(LEEFTIJD)).toBe(false);
  });

  it("verplaatst een subthema alleen met het recht op beide leeftijden (I13)", () => {
    const beide = magVoor(ik({ hoofdleerkrachtLeeftijden: ["K3", "K2"] }));
    const een = magVoor(ik({ hoofdleerkrachtLeeftijden: ["K3"] }));
    expect(beide.subthemaHerschikken("K3", "K2")).toBe(true);
    expect(een.subthemaHerschikken("K3", "K2")).toBe(false);
    expect(een.subthemaHerschikken("K2", "K3")).toBe(false);
    expect(een.subthemaHerschikken("K3", "K3")).toBe(true);
    expect(magVoor(RELATIES.Directie).subthemaHerschikken("K3", "L6")).toBe(true);
  });

  it("biedt een subthema toevoegen aan wie op minstens één leeftijd hoofdleerkracht is, of directie", () => {
    expect(magVoor(RELATIES.HL).subthemaToevoegen).toBe(true);
    expect(magVoor(RELATIES.Directie).subthemaToevoegen).toBe(true);
    expect(magVoor(RELATIES.TB).subthemaToevoegen).toBe(false);
    expect(magVoor(RELATIES["LK leeftijd"]).subthemaToevoegen).toBe(false);
  });

  it("biedt 'koppel dit doel' aan wie in de boom van deze leeftijden iets mag koppelen (F1)", () => {
    // The thema level needs no leeftijd, so directie and themabeheer are offered it whatever the klas.
    expect(magVoor(RELATIES.Directie).doelKoppelenVoor([])).toBe(true);
    expect(magVoor(RELATIES.TB).doelKoppelenVoor(["L1"])).toBe(true);
    // A hoofdleerkracht only where the sheet lists their own leeftijd: an L1 klas shows no K3 subthema.
    expect(magVoor(RELATIES.HL).doelKoppelenVoor([LEEFTIJD])).toBe(true);
    expect(magVoor(RELATIES.HL).doelKoppelenVoor(["L1"])).toBe(false);
    expect(magVoor(RELATIES.HL).doelKoppelenVoor(["JK", "K2", LEEFTIJD])).toBe(true);
    // Making activiteiten is not linking goals (R19).
    expect(magVoor(RELATIES["LK leeftijd"]).doelKoppelenVoor([LEEFTIJD])).toBe(false);
    expect(magVoor(RELATIES["LK eigen"]).doelKoppelenVoor([LEEFTIJD])).toBe(false);
    expect(magVoor(RELATIES.Ander).doelKoppelenVoor([LEEFTIJD])).toBe(false);
  });

  it("laat directie een klas plannen ook zonder gekozen klas, en een leerkracht alleen de eigen", () => {
    expect(magVoor(RELATIES.Directie).klasplanningBewerken(null)).toBe(true);
    expect(magVoor(RELATIES["LK eigen"]).klasplanningBewerken(EIGEN_KLAS)).toBe(true);
    expect(magVoor(RELATIES["LK eigen"]).klasplanningBewerken(ANDERE_KLAS)).toBe(false);
    expect(magVoor(RELATIES["LK eigen"]).klasplanningBewerken(null)).toBe(false);
    // A leeftijd right is not a planning right (I21 vs R22): a hoofdleerkracht plans no klas.
    expect(magVoor(RELATIES.HL).klasplanningBewerken(EIGEN_KLAS)).toBe(false);
  });

  it("geeft themabeheer het verwijderen van een thema alleen als het leeg is (I26)", () => {
    const tb = magVoor(RELATIES.TB);
    expect(tb.themaBewerken).toBe(true);
    expect(tb.themaVerwijderen({ subthemas: [{}] })).toBe(false);
    expect(tb.themaVerwijderen({ subthemas: [] })).toBe(true);
    expect(magVoor(RELATIES.Directie).themaVerwijderen({ subthemas: [{}] })).toBe(true);
    expect(tb.menselijkeBeslissingenVerwijderen).toBe(false);
    expect(tb.curriculumbeheer).toBe(false);
    expect(tb.schoolcontentImporteren).toBe(true);
  });
});

describe("een klas inkijken (FB-013, ADR-0040)", () => {
  const inzage = (klasId: string, leeftijden: string[]): Rechtbron => ({ soort: "klasinzage", klasId, leeftijden });

  it("leest geen klas van een andere jaarfase, behalve voor themabeheer en directie", () => {
    const k2 = inzage(ANDERE_KLAS, ["K2"]);
    for (const relatie of ["HL", "LK leeftijd", "LK eigen", "Ander"]) {
      expect(staatToe(RELATIES[relatie], "KlasplanningBekijken", k2)).toBe(false);
    }
    expect(staatToe(RELATIES.TB, "KlasplanningBekijken", k2)).toBe(true);
    expect(staatToe(RELATIES.Directie, "KlasplanningBekijken", k2)).toBe(true);
  });

  it("leest de eigen klas ook als ze voor geen leeftijd staat, en een klas zonder leeftijd verder niet", () => {
    expect(staatToe(RELATIES["LK eigen"], "KlasplanningBekijken", inzage(EIGEN_KLAS, []))).toBe(true);
    expect(staatToe(RELATIES["LK leeftijd"], "KlasplanningBekijken", inzage(ANDERE_KLAS, []))).toBe(false);
  });

  it("opent met een leesbron geen schrijfrij", () => {
    const alles = ik({ hoofdleerkrachtLeeftijden: [LEEFTIJD], leerkrachtLeeftijden: [LEEFTIJD], eigenKlasIds: [EIGEN_KLAS] });
    const bron = inzage(EIGEN_KLAS, [LEEFTIJD]);
    expect(staatToe(alles, "KlasplanningBewerken", bron)).toBe(false);
    expect(staatToe(alles, "SubthemaBeheren", bron)).toBe(false);
    expect(staatToe(alles, "KlasplanningBekijken", { soort: "klas", klasId: EIGEN_KLAS })).toBe(false);
  });

  it("zegt dat iemand alle klassen inkijkt alleen voor directie en themabeheer", () => {
    expect(magVoor(RELATIES.Directie).alleKlassenInzien).toBe(true);
    expect(magVoor(RELATIES.TB).alleKlassenInzien).toBe(true);
    for (const relatie of ["HL", "LK leeftijd", "LK eigen", "Ander"]) {
      expect(magVoor(RELATIES[relatie]).alleKlassenInzien).toBe(false);
    }
  });

  it("zegt dat iemand geen enkele klas inkijkt alleen zonder enige relatie, en niet voor /api/ik antwoordt", () => {
    expect(magVoor(RELATIES.Ander).geenKlasInzien).toBe(true);
    for (const relatie of ["Directie", "TB", "HL", "LK leeftijd", "LK eigen"]) {
      expect(magVoor(RELATIES[relatie]).geenKlasInzien).toBe(false);
    }
    expect(magVoor(undefined).geenKlasInzien).toBe(false);
  });

  it("crasht niet op een /api/ik-antwoord zonder de lijsten", () => {
    const zonderLijsten = { id: IK, naam: "Test", email: "test@school.be", isDirectie: false } as unknown as Ik;
    expect(() => magVoor(zonderLijsten)).not.toThrow();
    expect(magVoor(zonderLijsten).alleKlassenInzien).toBe(false);
  });
});

describe("het ontwikkelingsrapport (FB-001, ADR-0035 D18, R26)", () => {
  it("biedt de bestemming aan directie en aan een leerkracht van een K3-klas, ook na het schooljaar", () => {
    expect(magVoor(RELATIES.Directie).ontwikkelingsrapportZien).toBe(true);
    expect(magVoor(RELATIES["LK rapport"]).ontwikkelingsrapportZien).toBe(true);
    expect(magVoor(RELATIES["LK rapport voorbij"]).ontwikkelingsrapportZien).toBe(true);
  });

  it("biedt ze niemand anders aan: geen klasplanning, geen themabeheer, geen hoofdleerkracht van K3", () => {
    for (const relatie of ["LK eigen", "TB", "HL", "LK leeftijd", "Ander"]) {
      expect(magVoor(RELATIES[relatie]).ontwikkelingsrapportZien).toBe(false);
    }
    expect(magVoor(undefined).ontwikkelingsrapportZien).toBe(false);
  });

  it("zegt 'alleen nog lezen' alleen voor de leerkracht van wie het schooljaar voorbij is, nooit voor directie", () => {
    expect(magVoor(RELATIES["LK rapport voorbij"]).rapportAlleenNogLezen(EIGEN_KLAS)).toBe(true);
    expect(magVoor(RELATIES["LK rapport"]).rapportAlleenNogLezen(EIGEN_KLAS)).toBe(false);
    expect(magVoor(RELATIES.Directie).rapportAlleenNogLezen(EIGEN_KLAS)).toBe(false);
    // Someone who cannot read the klas at all is not "reading only".
    expect(magVoor(RELATIES["LK rapport voorbij"]).rapportAlleenNogLezen(ANDERE_KLAS)).toBe(false);
  });

  it("biedt de bestemming ook een hoofdleerkracht van K3 aan, en geen hoofdleerkracht van een andere leeftijd", () => {
    expect(magVoor(RELATIES.HL).ontwikkelingsrapportTab).toBe(true);
    expect(magVoor(RELATIES.HL).ontwikkelingsrapportZien).toBe(false);
    expect(magVoor(RELATIES["HL andere leeftijd"]).ontwikkelingsrapportTab).toBe(false);
    expect(magVoor(RELATIES["LK rapport voorbij"]).ontwikkelingsrapportTab).toBe(true);
    expect(magVoor(RELATIES.Directie).ontwikkelingsrapportTab).toBe(true);
    expect(magVoor(RELATIES.TB).ontwikkelingsrapportTab).toBe(false);
    expect(magVoor(undefined).ontwikkelingsrapportTab).toBe(false);
  });

  it("faalt dicht op een /api/ik-antwoord zonder de twee lijsten", () => {
    const oud = { ...RELATIES["LK eigen"] } as Partial<Ik>;
    delete oud.rapportklasIds;
    delete oud.lopendeRapportklasIds;
    const mag = magVoor(oud as Ik);
    expect(mag.ontwikkelingsrapportZien).toBe(false);
    expect(mag.ontwikkelingsrapportLezen(EIGEN_KLAS)).toBe(false);
  });
});

describe("Leerlingzorg (FB-008, ADR-0035 R18)", () => {
  const zorg = magVoor(RELATIES.Leerlingzorg);

  it("biedt de bestemming aan, en leest de rapporten van elke klas", () => {
    expect(zorg.ontwikkelingsrapportTab).toBe(true);
    expect(zorg.ontwikkelingsrapportZien).toBe(true);
    expect(zorg.ontwikkelingsrapportLezen(EIGEN_KLAS)).toBe(true);
    expect(zorg.ontwikkelingsrapportLezen(ANDERE_KLAS)).toBe(true);
    expect(zorg.alleRapportklassenLezen).toBe(true);
  });

  it("wijzigt niets, en zegt niet dat het schooljaar voorbij is: dat is niet de reden", () => {
    expect(zorg.leerlingenBeheren(EIGEN_KLAS)).toBe(false);
    expect(zorg.rapportInvullen(EIGEN_KLAS)).toBe(false);
    expect(zorg.rapportsetBewerken).toBe(false);
    expect(zorg.rapportAlleenNogLezen(EIGEN_KLAS)).toBe(false);
    expect(zorg.klasplanningBewerken(EIGEN_KLAS)).toBe(false);
    expect(zorg.alleKlassenInzien).toBe(false);
  });

  it("laat een leerkracht met Leerlingzorg de eigen klas invullen, en een andere alleen lezen", () => {
    const beide = magVoor(ik({ ...RELATIES["LK rapport"], heeftLeerlingzorg: true }));
    expect(beide.rapportInvullen(EIGEN_KLAS)).toBe(true);
    expect(beide.rapportInvullen(ANDERE_KLAS)).toBe(false);
    expect(beide.ontwikkelingsrapportLezen(ANDERE_KLAS)).toBe(true);
    expect(beide.rapportAlleenNogLezen(ANDERE_KLAS)).toBe(false);
  });

  it("zegt 'alleen nog lezen' nog wel aan wie de klas zelf gaf, ook met Leerlingzorg", () => {
    expect(magVoor(ik({ ...RELATIES["LK rapport voorbij"], heeftLeerlingzorg: true })).rapportAlleenNogLezen(EIGEN_KLAS)).toBe(
      true,
    );
  });

  it("geeft themabeheer geen rapport en niet de hele lijst (R18)", () => {
    expect(magVoor(RELATIES.TB).alleRapportklassenLezen).toBe(false);
    expect(magVoor(RELATIES["LK rapport"]).alleRapportklassenLezen).toBe(false);
    expect(magVoor(RELATIES.Directie).alleRapportklassenLezen).toBe(true);
  });

  it("faalt dicht op een /api/ik-antwoord zonder het veld", () => {
    const oud = { ...RELATIES.Ander } as Partial<Ik>;
    delete oud.heeftLeerlingzorg;
    expect(magVoor(oud as Ik).ontwikkelingsrapportZien).toBe(false);
    expect(staatToe(oud as Ik, "OntwikkelingsrapportLezen", { soort: "rapportklas", klasId: EIGEN_KLAS })).toBe(false);
  });
});

describe("een weigering van de server", () => {
  it("toont de Nederlandse zin van de server, of die van de catalogus", () => {
    expect(geenToegangZin(new ApiError(403, "x", "Je hebt geen toegang tot deze actie."))).toBe(
      "Je hebt geen toegang tot deze actie.",
    );
    expect(geenToegangZin(new ApiError(403, "x"))).toBe(t("rechten.geenToegang"));
  });

  it("zegt niets over een andere fout", () => {
    expect(geenToegangZin(new ApiError(400, "x", "Iets anders."))).toBeNull();
    expect(geenToegangZin(new Error("netwerk"))).toBeNull();
    expect(geenToegangZin(undefined)).toBeNull();
  });
});
