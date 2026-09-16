import { describe, expect, it } from "vitest";
import type { ActiviteitWeergave, KoppelingStatus, SubthemaWeergave } from "../../lib/types";
import { subthemabalans } from "./subthemabalans";

const koppeling = (code: string, status: KoppelingStatus = "Manueel") => ({
  id: `k-${code}-${status}`,
  leerplandoelCode: code,
  status,
  aiMotivatie: null,
});

function activiteit(id: string, ...koppelingen: ReturnType<typeof koppeling>[]): ActiviteitWeergave {
  return {
    id,
    naam: `Activiteit ${id}`,
    activiteitType: "Spel",
    hoek: null,
    verwachteUitkomsten: null,
    onderzoeksvraagId: null,
    kleur: null,
    doelkoppelingen: koppelingen,
    makerId: null,
  } as ActiviteitWeergave;
}

function subthema(subdoelen: ReturnType<typeof koppeling>[], activiteiten: ActiviteitWeergave[]): SubthemaWeergave {
  return {
    id: "s-1",
    themaId: "t-1",
    naam: "Bladeren",
    duurWeken: 2,
    leeftijd: "K3",
    onderzoeksvragen: [],
    subdoelen: subdoelen.map((k, i) => ({ id: `sd-${i + 1}`, leeftijd: "K3", koppeling: k })),
    activiteiten,
  };
}

describe("subthemabalans (FB-010)", () => {
  it("telt de eigen activiteit van een gebruiker niet mee (ADR-0049 D9)", () => {
    const eigen = { ...activiteit("2", koppeling("B"), koppeling("Z")), eigenaarId: "ander" };
    const balans = subthemabalans(subthema([koppeling("A"), koppeling("B")], [activiteit("1", koppeling("A")), eigen]));

    expect(balans.subdoelenInActiviteit).toBe(1);
    expect(balans.dragersPerSubdoel.get("sd-2")).toEqual([]);
    expect(balans.andereDoelen).toEqual([]);
  });

  it("telt welke subdoelen een activiteit hebben, en welke nog niet", () => {
    const balans = subthemabalans(
      subthema([koppeling("A"), koppeling("B"), koppeling("C")], [activiteit("1", koppeling("A")), activiteit("2", koppeling("B"))]),
    );

    expect(balans.subdoelenInActiviteit).toBe(2);
    expect(balans.dragersPerSubdoel.get("sd-1")).toEqual([{ id: "1", naam: "Activiteit 1" }]);
    expect(balans.dragersPerSubdoel.get("sd-3")).toEqual([]);
  });

  it("noemt elke activiteit die hetzelfde subdoel draagt", () => {
    const balans = subthemabalans(subthema([koppeling("A")], [activiteit("1", koppeling("A")), activiteit("2", koppeling("A"))]));

    expect(balans.dragersPerSubdoel.get("sd-1")?.map((d) => d.id)).toEqual(["1", "2"]);
  });

  it("zet een doel van een activiteit dat geen subdoel is apart, met zijn activiteiten, geordend op code", () => {
    const balans = subthemabalans(
      subthema([koppeling("A")], [activiteit("1", koppeling("A"), koppeling("Z.10")), activiteit("2", koppeling("Z.9"), koppeling("Z.10"))]),
    );

    expect(balans.andereDoelen.map((d) => d.koppeling.leerplandoelCode)).toEqual(["Z.9", "Z.10"]);
    expect(balans.andereDoelen[1].dragers.map((d) => d.id)).toEqual(["1", "2"]);
  });

  it("laat een voorgestelde of geweigerde koppeling op een activiteit niet meetellen", () => {
    const balans = subthemabalans(
      subthema([koppeling("A")], [activiteit("1", koppeling("A", "Voorgesteld"), koppeling("X", "Geweigerd"))]),
    );

    expect(balans.subdoelenInActiviteit).toBe(0);
    expect(balans.dragersPerSubdoel.get("sd-1")).toEqual([]);
    expect(balans.andereDoelen).toEqual([]);
  });

  it("telt elk subdoel dat de lijst toont, ook een dat nog niet beslist is", () => {
    const balans = subthemabalans(
      subthema([koppeling("A"), koppeling("B", "Voorgesteld")], [activiteit("1", koppeling("B"))]),
    );

    expect(balans.subdoelenInActiviteit).toBe(1);
    // Its dragers are listed, and the activiteit's doel is not "another" doel: it is on the subthema's list.
    expect(balans.dragersPerSubdoel.get("sd-2")).toEqual([{ id: "1", naam: "Activiteit 1" }]);
    expect(balans.andereDoelen).toEqual([]);
  });
});
