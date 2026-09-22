import { describe, expect, it } from "vitest";
import type { LeerplandoelDekking, MinimumdoelDekking } from "../../lib/types";
import {
  MAX_THEMAACTIES,
  bepaalActies,
  groepeerPerDiscipline,
  groepeerPerLeergebied,
  percentage,
  sorteerDisciplines,
  telDoelsoorten,
  telStappen,
} from "./overzicht";

const doel = (code: string, delen: Partial<LeerplandoelDekking> = {}): LeerplandoelDekking => ({
  code,
  doelsoort: "Gemeenschappelijk",
  jaarFase: "K3",
  disciplineNummer: "2",
  disciplineNaam: "Wiskunde",
  domein: "Getallen",
  subdomein: "Tellen",
  tekst: `Tekst van ${code}`,
  minimumdoelRef: null,
  nietMeerInOpstap: false,
  isGedekt: false,
  dekkendeThemas: [],
  dekkendeFiches: [],
  oorzaak: "GeenThema",
  kandidaatThemas: [],
  stap: "Geen",
  prognoseBronnen: [],
  ...delen,
});

const gedekt = (code: string, delen: Partial<LeerplandoelDekking> = {}) =>
  doel(code, { isGedekt: true, dekkendeThemas: ["Herfst"], oorzaak: null, stap: "Gedekt", ...delen });

const minimumdoel = (ref: string, delen: Partial<MinimumdoelDekking> = {}): MinimumdoelDekking => ({
  ref,
  leeftijd: "K-",
  nr: "1",
  omschrijving: `Tekst van ${ref}`,
  leergebied: "Wiskunde",
  rubriek: "Getallen",
  subrubriek: null,
  nietMeerInOpstap: false,
  stap: "Geen",
  isGedekt: false,
  prognoseThemas: [],
  dekkendeThemas: [],
  oorzaak: "GeenThema",
  kandidaatThemas: [],
  ...delen,
});

describe("telStappen", () => {
  it("telt gedekt en prognose apart, zodat ze samen nooit meer dan het totaal zijn", () => {
    expect(
      telStappen([gedekt("A"), doel("B", { stap: "Prognose" }), doel("C", { stap: "Prognose" }), doel("D")]),
    ).toEqual({ gedekt: 1, prognose: 2, totaal: 4 });
  });
});

describe("percentage", () => {
  it("rondt af op een heel getal", () => {
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(2, 3)).toBe(67);
  });

  it("zegt nooit 0% of 100% over een breuk die geen van beide is", () => {
    expect(percentage(1, 500)).toBe(1);
    expect(percentage(499, 500)).toBe(99);
  });

  it("zegt wel 0% en 100% wanneer het klopt, en 0% zonder noemer", () => {
    expect(percentage(0, 12)).toBe(0);
    expect(percentage(12, 12)).toBe(100);
    expect(percentage(0, 0)).toBe(0);
  });
});

describe("telDoelsoorten", () => {
  it("telt per doelsoort, in de volgorde van Op.stap, en laat de soorten weg die niet voorkomen", () => {
    expect(
      telDoelsoorten([
        doel("A", { doelsoort: "Verdieping" }),
        doel("B", { doelsoort: "Minimumdoel" }),
        doel("C", { doelsoort: "Verdieping" }),
      ]),
    ).toEqual([
      { doelsoort: "Minimumdoel", aantal: 1 },
      { doelsoort: "Verdieping", aantal: 2 },
    ]);
  });
});

describe("groepeerPerLeergebied", () => {
  it("groepeert de minimumdoelen per leergebied in de volgorde van de server, met de ongeordende apart", () => {
    const groepen = groepeerPerLeergebied([
      minimumdoel("K-2", { leergebied: "Nederlands", isGedekt: true, stap: "Gedekt" }),
      minimumdoel("K-1"),
      minimumdoel("K-3", { leergebied: "Nederlands" }),
      minimumdoel("K-9", { leergebied: null }),
    ]);

    expect(groepen.map((g) => [g.naam, g.doelen.map((d) => d.ref), g.stappen.gedekt, g.stappen.totaal])).toEqual([
      ["Nederlands", ["K-2", "K-3"], 1, 2],
      ["Wiskunde", ["K-1"], 0, 1],
      [null, ["K-9"], 0, 1],
    ]);
  });

  it("maakt van minimumdoelen dezelfde acties als van leerplandoelen", () => {
    const acties = bepaalActies([
      minimumdoel("K-1", { stap: "Prognose", oorzaak: "NietIngepland", kandidaatThemas: ["Herfst"] }),
      minimumdoel("K-2"),
    ]);

    expect(acties.themaacties).toEqual([{ soort: "NietIngepland", thema: "Herfst", aantal: 1 }]);
    expect(acties.aantalZonderThema).toBe(1);
  });
});

describe("groepeerPerDiscipline", () => {
  it("groepeert per discipline en daarin per domein, in de volgorde van de server", () => {
    const groepen = groepeerPerDiscipline([
      doel("W1", { domein: "Getallen" }),
      doel("M1", { disciplineNummer: "6", disciplineNaam: "Muzische vorming", domein: "Beeld" }),
      doel("W2", { domein: "Meten" }),
      doel("W3", { domein: "Getallen" }),
    ]);

    expect(groepen.map((g) => g.naam)).toEqual(["Wiskunde", "Muzische vorming"]);
    expect(groepen[0].domeinen.map((d) => [d.naam, d.doelen.map((x) => x.code)])).toEqual([
      ["Getallen", ["W1", "W3"]],
      ["Meten", ["W2"]],
    ]);
  });

  it("telt de hele discipline en elk domein per stap, zodat de domeinen optellen tot de discipline", () => {
    const [wiskunde] = groepeerPerDiscipline([
      gedekt("W1"),
      doel("W2", { stap: "Prognose" }),
      doel("W3", { domein: "Meten" }),
    ]);

    expect(wiskunde.stappen).toEqual({ gedekt: 1, prognose: 1, totaal: 3 });
    expect(wiskunde.domeinen.map((d) => d.stappen)).toEqual([
      { gedekt: 1, prognose: 1, totaal: 2 },
      { gedekt: 0, prognose: 0, totaal: 1 },
    ]);
  });

  it("toont het nummer wanneer de server geen naam kent", () => {
    const [groep] = groepeerPerDiscipline([doel("X1", { disciplineNummer: "99", disciplineNaam: null })]);
    expect(groep.naam).toBe("99");
  });
});

describe("sorteerDisciplines", () => {
  const groepen = groepeerPerDiscipline([
    gedekt("W1"),
    doel("W2"),
    doel("L1", { disciplineNummer: "10", disciplineNaam: "Frans" }),
    gedekt("V1", { disciplineNummer: "9.1", disciplineNaam: "Veilige en gezonde levensstijl" }),
  ]);

  it("zet de minst gedekte discipline bovenaan", () => {
    expect(sorteerDisciplines(groepen, true).map((g) => g.nummer)).toEqual(["10", "2", "9.1"]);
  });

  it("volgt zonder cijfers de nummering van het leerplan, 2 voor 9.1 voor 10", () => {
    expect(sorteerDisciplines(groepen, false).map((g) => g.nummer)).toEqual(["2", "9.1", "10"]);
  });
});

describe("bepaalActies", () => {
  it("telt per thema hoeveel ontbrekende doelen het zou dekken, het grootste eerst", () => {
    const acties = bepaalActies([
      doel("A", { oorzaak: "NietIngepland", kandidaatThemas: ["Winter"] }),
      doel("B", { oorzaak: "NietIngepland", kandidaatThemas: ["Winter"] }),
      doel("C", { oorzaak: "WachtOpBeslissing", kandidaatThemas: ["Herfst"] }),
      doel("D", { oorzaak: "PlaatsingGeweigerd", kandidaatThemas: ["Lente"] }),
    ]);

    expect(acties.themaacties).toEqual([
      { soort: "NietIngepland", thema: "Winter", aantal: 2 },
      { soort: "WachtOpBeslissing", thema: "Herfst", aantal: 1 },
      { soort: "PlaatsingGeweigerd", thema: "Lente", aantal: 1 },
    ]);
  });

  it("telt een doel dat twee thema's zouden dekken bij allebei", () => {
    const acties = bepaalActies([doel("A", { oorzaak: "NietIngepland", kandidaatThemas: ["Winter", "Sneeuw"] })]);
    expect(acties.themaacties.map((a) => [a.thema, a.aantal])).toEqual([
      ["Sneeuw", 1],
      ["Winter", 1],
    ]);
  });

  it("houdt hetzelfde thema onder twee oorzaken apart", () => {
    const acties = bepaalActies([
      doel("A", { oorzaak: "NietIngepland", kandidaatThemas: ["Winter"] }),
      doel("B", { oorzaak: "WachtOpBeslissing", kandidaatThemas: ["Winter"] }),
    ]);
    expect(acties.themaacties.map((a) => [a.soort, a.aantal])).toEqual([
      ["WachtOpBeslissing", 1],
      ["NietIngepland", 1],
    ]);
  });

  it("toont hoogstens vijf acties en telt de rest", () => {
    const doelen = ["A", "B", "C", "D", "E", "F", "G"].map((thema) => doel(thema, { oorzaak: "NietIngepland", kandidaatThemas: [thema] }));
    const acties = bepaalActies(doelen);
    expect(acties.themaacties).toHaveLength(MAX_THEMAACTIES);
    expect(acties.aantalOverig).toBe(2);
  });

  it("telt onbesliste koppelingen en doelen zonder thema apart, en gedekte doelen niet", () => {
    const acties = bepaalActies([
      doel("A", { oorzaak: "KoppelingNietBeslist", kandidaatThemas: ["Herfst"] }),
      doel("B", { oorzaak: "GeenThema" }),
      doel("C", { oorzaak: "GeenThema" }),
      gedekt("D"),
    ]);

    expect(acties).toEqual({ themaacties: [], aantalOverig: 0, aantalOnbeslist: 1, aantalZonderThema: 2 });
  });

  it("slaat een oorzaak over die deze client niet kent", () => {
    const onbekend = doel("A", { oorzaak: "IetsNieuws" as never, kandidaatThemas: ["Winter"] });
    expect(bepaalActies([onbekend])).toEqual({ themaacties: [], aantalOverig: 0, aantalOnbeslist: 0, aantalZonderThema: 0 });
  });
});
