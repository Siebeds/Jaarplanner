import { describe, expect, it } from "vitest";
import type { JaarplanWeergave, Planningsrooster, ThemaWeergave, Weekplanning } from "../lib/types";
import { KLAS, LEERPLANDOELEN, MINIMUMDOELEN, SCHOOLJAAR, THEMAS } from "./inhoud";
import { beantwoord } from "./routes";
import { beginToestand, dagenTussen, verschuifDagen, weekdag, type Toestand } from "./toestand";

function vraag<T>(s: Toestand, methode: string, pad: string, body?: unknown) {
  const antwoord = beantwoord(s, methode, new URL(pad, "http://localhost"), body);
  return { status: antwoord.status, body: antwoord.body as T };
}

function planning(s: Toestand, van: string, tot: string) {
  return vraag<Weekplanning>(s, "GET", `/api/klassen/${KLAS.id}/jaarplan/weekplanning?van=${van}&tot=${tot}`).body;
}

function periodesVan(s: Toestand, themaId: string) {
  const plan = vraag<JaarplanWeergave>(s, "GET", `/api/klassen/${KLAS.id}/jaarplan`).body;
  const rooster = vraag<Planningsrooster>(s, "GET", `/api/schooljaren/${SCHOOLJAAR.id}/rooster`).body;
  return plan.plaatsingen
    .filter((p) => p.themaId === themaId)
    .map((p) => rooster.blokken.find((b) => b.start === p.blokStart)!)
    .map((b) => [b.start, b.eind]);
}

describe("mock mode (TB-046, TB-047)", () => {
  it("plans two thema's of four weeks: the first from 16 november, the second the week after it, around the kerstvakantie", () => {
    const s = beginToestand();
    const [eerste, tweede] = THEMAS;

    expect(periodesVan(s, eerste.id)).toEqual([["2026-11-16", "2026-12-11"]]);
    expect(periodesVan(s, tweede.id)).toEqual([
      ["2026-12-14", "2026-12-18"],
      ["2027-01-04", "2027-01-22"],
    ]);
    const plan = vraag<JaarplanWeergave>(s, "GET", `/api/klassen/${KLAS.id}/jaarplan`).body;
    expect(plan.plaatsingen.every((p) => p.duurWeken === 4)).toBe(true);
    expect(plan.blokken.some((b) => b.isOverbelast)).toBe(false);
  });

  it("gives each thema subthema's whose weeks add up to its own, each with a period inside the thema's", () => {
    const s = beginToestand();
    for (const bron of THEMAS) {
      const thema = vraag<ThemaWeergave>(s, "GET", `/api/themas/${bron.id}`).body;
      expect(thema.subthemas.reduce((som, sub) => som + sub.duurWeken, 0)).toBe(thema.duurWeken);

      const perioden = periodesVan(s, thema.id);
      const agenda = planning(s, "2026-11-01", "2027-02-28");
      for (const sub of thema.subthemas) {
        const eigen = agenda.subthemaperiodes.filter((p) => p.subthemaId === sub.id);
        expect(eigen).toHaveLength(1);
        const { van, tot } = eigen[0];
        expect(perioden.some(([start]) => start <= van)).toBe(true);
        expect(perioden.some(([, eind]) => eind >= tot)).toBe(true);
        expect(dagenTussen(van, tot).filter((d) => weekdag(d) === 1)).toHaveLength(sub.duurWeken);
      }
    }
  });

  it("carries every subdoel in at least one activiteit of its subthema", () => {
    const thema = vraag<ThemaWeergave>(beginToestand(), "GET", `/api/themas/${THEMAS[0].id}`).body;
    for (const sub of [...thema.subthemas, ...vraag<ThemaWeergave>(beginToestand(), "GET", `/api/themas/${THEMAS[1].id}`).body.subthemas]) {
      const gedragen = new Set(sub.activiteiten.flatMap((a) => a.doelkoppelingen.map((k) => k.leerplandoelCode)));
      for (const subdoel of sub.subdoelen) expect(gedragen).toContain(subdoel.koppeling.leerplandoelCode);
    }
    expect(MINIMUMDOELEN.length).toBeGreaterThan(3);
    expect(LEERPLANDOELEN.length).toBeGreaterThan(9);
  });

  it("fills 16 to 27 november from 8u30 to 15u30, never in the lunch break, and wednesday only in the morning", () => {
    const week = planning(beginToestand(), "2026-11-16", "2026-11-29");

    for (const datum of dagenTussen("2026-11-16", "2026-11-27")) {
      const dag = week.dagen.find((d) => d.datum === datum)!;
      if (weekdag(datum) > 5) {
        expect(dag.activiteiten).toHaveLength(0);
        continue;
      }
      const tijden = dag.activiteiten.map((a) => [a.begin, a.einde]);
      const woensdag = weekdag(datum) === 3;
      expect(tijden[0]).toEqual(["08:30:00", "09:20:00"]);
      expect(tijden.at(-1)![1]).toBe(woensdag ? "12:00:00" : "15:30:00");
      for (const [begin, einde] of tijden) {
        expect(begin >= "12:00:00" && begin < "13:00:00").toBe(false);
        expect(einde > "12:00:00" && einde <= "13:00:00").toBe(false);
      }
      for (let i = 1; i < tijden.length; i++) {
        expect(tijden[i][0]).toBe(tijden[i - 1][1] === "12:00:00" ? "13:00:00" : tijden[i - 1][1]);
      }
    }
  });

  it("varies the activiteiten: none twice on a day, and never the same set two school days in a row", () => {
    const dagen = planning(beginToestand(), "2026-11-16", "2026-11-27").dagen.filter((d) => d.activiteiten.length > 0);

    let vorige: string | null = null;
    for (const dag of dagen) {
      const ids = dag.activiteiten.map((a) => a.activiteitId);
      expect(new Set(ids).size).toBe(ids.length);
      const reeks = [...ids].sort().join();
      expect(reeks).not.toBe(vorige);
      vorige = reeks;
    }
    expect(dagen.map((d) => d.activiteiten[0].subthemaNaam)).toContain(THEMAS[0].subthemas[1].naam);
  });

  it("keeps a moved activiteit where it was dropped, and a fresh state has it back in place", () => {
    const s = beginToestand();
    const eerste = planning(s, "2026-11-16", "2026-11-16").dagen[0].activiteiten[0];

    const verplaatst = vraag(s, "PUT", `/api/klassen/${KLAS.id}/jaarplan/weekplanning/${eerste.plaatsingId}/dag`, {
      datum: "2026-11-19",
      begin: "13:00:00",
      einde: "13:50:00",
    });

    expect(verplaatst.status).toBe(200);
    expect(planning(s, "2026-11-19", "2026-11-19").dagen[0].activiteiten.map((a) => a.plaatsingId)).toContain(
      eerste.plaatsingId,
    );
    expect(planning(beginToestand(), "2026-11-16", "2026-11-16").dagen[0].activiteiten[0].begin).toBe("08:30:00");
  });

  it("refuses a day without school", () => {
    const s = beginToestand();
    const eerste = planning(s, "2026-11-16", "2026-11-16").dagen[0].activiteiten[0];

    const antwoord = vraag(s, "PUT", `/api/klassen/${KLAS.id}/jaarplan/weekplanning/${eerste.plaatsingId}/dag`, {
      datum: verschuifDagen("2026-11-16", 5),
      begin: "09:00:00",
      einde: "09:50:00",
    });

    expect(antwoord.status).toBe(400);
  });

  it("counts each thema's subthema's, activiteiten and goal links in the library (TB-049)", () => {
    const rijen = vraag<{ id: string; aantalSubthemas: number; aantalActiviteiten: number; aantalDoelkoppelingen: number }[]>(
      beginToestand(),
      "GET",
      "/api/themas/bibliotheek",
    ).body;

    for (const bron of THEMAS) {
      const rij = rijen.find((r) => r.id === bron.id)!;
      const activiteiten = bron.subthemas.flatMap((s) => s.activiteiten);
      expect(rij.aantalSubthemas).toBe(bron.subthemas.length);
      expect(rij.aantalActiviteiten).toBe(activiteiten.length);
      expect(rij.aantalDoelkoppelingen).toBe(
        bron.minimumdoelen.length +
          bron.subthemas.reduce((som, s) => som + s.subdoelen.length, 0) +
          activiteiten.reduce((som, a) => som + a.doelen.length, 0),
      );
    }
  });

  it("answers a route it does not know with a 501 that names the route", () => {
    const antwoord = vraag<{ detail: string }>(beginToestand(), "POST", "/api/themas/x/doelsuggesties/genereer", {});

    expect(antwoord.status).toBe(501);
    expect(antwoord.body.detail).toBe("POST /api/themas/x/doelsuggesties/genereer");
  });
});
