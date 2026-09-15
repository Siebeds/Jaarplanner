import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import type { Ik } from "./aanmelding";
import { RECHTENMATRIX, geenToegangZin, magVoor, staatToe, type Rechtbron, type Rij } from "./rechten";
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
  Ander: ik({}),
};

/** §3 as data: the relations that pass each row. The server's `Verwacht`, row for row. */
const VERWACHT: Record<Exclude<Rij, "ActiviteitVerwijderen" | "ActiviteitVerplaatsen">, string[]> = {
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
  KlasplanningBewerken: ["Directie", "LK eigen"],
  // R17: "LK eigen" on a klas's planning reads no report; only the report's own relation does (footnote ⁶, R26).
  OntwikkelingsrapportLezen: ["Directie", "LK rapport", "LK rapport voorbij"],
  LeerlingenBeheren: ["Directie", "LK rapport"],
};

/** The resource each row is asked about, as the server's `BronVoor` builds it. */
function bronVoor(rij: Rij): Rechtbron | undefined {
  if (rij === "KlasplanningBewerken") return { soort: "klas", klasId: EIGEN_KLAS };
  if (rij === "OntwikkelingsrapportLezen" || rij === "LeerlingenBeheren") return { soort: "rapportklas", klasId: EIGEN_KLAS };
  const kolommen = RECHTENMATRIX[rij];
  return kolommen.some((kolom) => kolom === "Hoofdleerkracht" || kolom === "LeerkrachtLeeftijd")
    ? { soort: "leeftijd", leeftijd: LEEFTIJD }
    : undefined;
}

const activiteit = (makerId: string | null, heeftDoelkoppelingen: boolean): Rechtbron => ({
  soort: "activiteit",
  leeftijd: LEEFTIJD,
  makerId,
  heeftDoelkoppelingen,
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
    expect([...Object.keys(VERWACHT), "ActiviteitVerwijderen", "ActiviteitVerplaatsen"].sort()).toEqual(rijen);
    // The server's `Rechtenmatrix.Rijen`, by policy name: twenty rows since FB-001 added the two report rows.
    expect(rijen).toHaveLength(20);
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

  it("laat directie elke rij toe, met of zonder bron", () => {
    for (const rij of Object.keys(RECHTENMATRIX) as Rij[]) {
      expect(staatToe(RELATIES.Directie, rij)).toBe(true);
      expect(staatToe(RELATIES.Directie, rij, activiteit(null, true))).toBe(true);
    }
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

  it("faalt dicht op een /api/ik-antwoord zonder de twee lijsten", () => {
    const oud = { ...RELATIES["LK eigen"] } as Partial<Ik>;
    delete oud.rapportklasIds;
    delete oud.lopendeRapportklasIds;
    const mag = magVoor(oud as Ik);
    expect(mag.ontwikkelingsrapportZien).toBe(false);
    expect(mag.ontwikkelingsrapportLezen(EIGEN_KLAS)).toBe(false);
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
