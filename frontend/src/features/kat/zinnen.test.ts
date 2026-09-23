import type { Deurmatsignaal, Deurmatvoorstel } from "./gegevens";
import { gevaarzin, katvoorstelMoment, signaalzin, voorstelzin } from "./zinnen";

/** FB-071: the sentences live in nl.json; the server sends only what fills them (FB-069, FB-070). */

function signaal(soort: Deurmatsignaal["soort"], gegevens: Record<string, unknown>): Deurmatsignaal {
  return {
    id: "s1",
    soort,
    klasId: "k",
    klasnaam: "K3 De Uilen",
    gegevens,
    verwijzing: null,
    aangemaakt: "2026-11-16T07:00:00+01:00",
    gezien: false,
  };
}

describe("signaalzin", () => {
  const gevaar = (vrijeLesweken: number, themaLesweken = 4) =>
    signaalzin(signaal("MinimumdoelInGevaar", { doelRef: "K-2.1.81", thema: "Herfst", themaLesweken, vrijeLesweken }));

  it("names the goal, the shortest thema that carries it, and the lesweken left", () => {
    expect(gevaar(3)).toBe(
      "Minimumdoel K-2.1.81 raakt niet meer gedekt. Het kortste thema dat het draagt, Herfst, duurt 4 lesweken, en er zijn nog 3 lesweken vrij.",
    );
  });

  it("says one leesweek, and none, in words that fit", () => {
    expect(gevaar(1)).toContain("er is nog 1 lesweek vrij.");
    expect(gevaar(0)).toContain("er is geen lesweek meer vrij.");
    expect(gevaar(0, 1)).toContain("duurt 1 lesweek,");
  });

  it("lists the leerplandoelen a subthema would leave uncovered", () => {
    expect(
      signaalzin(signaal("SubthemaNietGepland", { subthema: "Bladeren", thema: "Herfst", doelen: ["A-1", "A-2"], aantalDoelen: 2 })),
    ).toBe("Plaats subthema Bladeren. Thema Herfst loopt bijna af, en zonder dit subthema blijven 2 leerplandoelen ongedekt: A-1, A-2.");
    expect(
      signaalzin(signaal("SubthemaNietGepland", { subthema: "Bladeren", thema: "Herfst", doelen: ["A-1"], aantalDoelen: 1 })),
    ).toContain("blijft 1 leerplandoel ongedekt: A-1.");
  });
});

describe("what Chuck says", () => {
  it("names the goal and the klas in his balloon", () => {
    expect(gevaarzin(signaal("MinimumdoelInGevaar", { doelRef: "K-2.1.81" }))).toBe(
      "Minimumdoel K-2.1.81 komt in gevaar in K3 De Uilen.",
    );
    expect(gevaarzin(signaal("SubthemaNietGepland", { subthema: "Bladeren" }))).toBe(
      "In K3 De Uilen staat subthema Bladeren nog niet in de agenda.",
    );
  });
});

describe("a proposal on the deurmat", () => {
  const katvoorstel: Deurmatvoorstel = {
    soort: "Activiteitvoorstel",
    id: "v1",
    titel: "Kastanjes tellen",
    verwijzing: null,
    aiMotivatie: "Omdat.",
    klasnaam: "K3 De Uilen",
    datum: "2026-11-19",
    begin: "10:15:00",
    einde: "11:00:00",
  };

  it("says for which klas and when accepting plans one the cat brought", () => {
    expect(katvoorstelMoment(katvoorstel)).toBe("Voor K3 De Uilen, 19 nov van 10.15 tot 11.00");
  });

  it("says nothing of a moment for any other proposal", () => {
    expect(katvoorstelMoment({ ...katvoorstel, klasnaam: null })).toBeNull();
    expect(voorstelzin({ ...katvoorstel, soort: "Subthemavoorstel" })).toBe("Nieuw subthema: Kastanjes tellen");
  });
});
