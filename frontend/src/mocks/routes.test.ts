import { describe, expect, it } from "vitest";
import type { JaarplanWeergave, Planningsrooster, ThemaWeergave, Weekplanning } from "../lib/types";
import { KLAS, SCHOOLJAAR, THEMA } from "./inhoud";
import { beantwoord } from "./routes";
import { beginToestand, dagenTussen, weekdag, type Toestand } from "./toestand";

function vraag<T>(s: Toestand, methode: string, pad: string, body?: unknown) {
  const antwoord = beantwoord(s, methode, new URL(pad, "http://localhost"), body);
  return { status: antwoord.status, body: antwoord.body as T };
}

function planning(s: Toestand, van: string, tot: string) {
  return vraag<Weekplanning>(s, "GET", `/api/klassen/${KLAS.id}/jaarplan/weekplanning?van=${van}&tot=${tot}`).body;
}

describe("mock mode (TB-046)", () => {
  it("serves one K3 thema with its minimumdoelen, two subthema's of one week and their activiteiten", () => {
    const thema = vraag<ThemaWeergave>(beginToestand(), "GET", `/api/themas/${THEMA.id}`).body;

    expect(thema.duurWeken).toBe(4);
    expect(thema.minimumdoelen.length).toBeGreaterThanOrEqual(2);
    expect(thema.subthemas).toHaveLength(2);
    for (const sub of thema.subthemas) {
      expect(sub.leeftijd).toBe("K3");
      expect(sub.duurWeken).toBe(1);
      expect(sub.subdoelen.length).toBeGreaterThan(0);
      expect(sub.activiteiten.length).toBeGreaterThan(0);
      const gedragen = new Set(sub.activiteiten.flatMap((a) => a.doelkoppelingen.map((k) => k.leerplandoelCode)));
      for (const subdoel of sub.subdoelen) expect(gedragen).toContain(subdoel.koppeling.leerplandoelCode);
    }
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
        if (woensdag) expect(einde <= "12:00:00").toBe(true);
      }
      // Back to back: every block starts where the one before it ended, apart from the lunch break.
      for (let i = 1; i < tijden.length; i++) {
        expect(tijden[i][0]).toBe(tijden[i - 1][1] === "12:00:00" ? "13:00:00" : tijden[i - 1][1]);
      }
    }
    expect(week.subthemaperiodes.map((p) => [p.van, p.tot])).toEqual([
      ["2026-11-16", "2026-11-20"],
      ["2026-11-23", "2026-11-27"],
    ]);
  });

  it("places the thema in the themaperiode that holds both weeks", () => {
    const s = beginToestand();
    const plan = vraag<JaarplanWeergave>(s, "GET", `/api/klassen/${KLAS.id}/jaarplan`).body;
    const rooster = vraag<Planningsrooster>(s, "GET", `/api/schooljaren/${SCHOOLJAAR.id}/rooster`).body;
    const blok = rooster.blokken.find((b) => b.start === plan.plaatsingen[0].blokStart)!;

    expect(blok.start <= "2026-11-16" && blok.eind >= "2026-11-27").toBe(true);
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
      datum: "2026-11-21",
      begin: "09:00:00",
      einde: "09:50:00",
    });

    expect(antwoord.status).toBe(400);
  });

  it("answers a route it does not know with a 501 that names the route", () => {
    const antwoord = vraag<{ detail: string }>(beginToestand(), "POST", "/api/themas/x/doelsuggesties/genereer", {});

    expect(antwoord.status).toBe(501);
    expect(antwoord.body.detail).toBe("POST /api/themas/x/doelsuggesties/genereer");
  });
});
