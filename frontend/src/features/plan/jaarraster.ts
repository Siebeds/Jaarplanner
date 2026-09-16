import type { Lesweek, Planningsonderbreking, Themaplaatsing } from "../../lib/types";
import { maandagVan, maandJaar, verschuif, weekdagIndex } from "../../lib/datum";

/*
 * The grid the year timeline (`Jaartijdlijn`) is drawn on, apart from the component so it can be tested on its own:
 * which track a date lands in is the one thing there that can be wrong without looking wrong.
 */

export interface Weekkolomdata {
  soort: "week";
  maandag: string;
  heeftThema: boolean;
  spoor: number;
}

export interface Gatkolom {
  soort: "gat";
  van: string;
  tot: string;
  naam: string;
  spoor: number;
}

/** The part of the same thema that follows this one across a vacation, if any. */
export function volgendDeel(plaatsing: Themaplaatsing, plaatsingen: Themaplaatsing[]): Themaplaatsing | undefined {
  const reeks = plaatsing.reeks;
  if (!reeks || reeks.deel >= reeks.aantalDelen) return undefined;
  return plaatsingen.find(
    (p) => p.reeks?.reeksVan === reeks.reeksVan && p.themaId === plaatsing.themaId && p.reeks.deel === reeks.deel + 1,
  );
}

export function dagenVerschil(vanIso: string, totIso: string): number {
  const [j1, m1, d1] = vanIso.split("-").map(Number);
  const [j2, m2, d2] = totIso.split("-").map(Number);
  return Math.round((Date.UTC(j2, m2 - 1, d2) - Date.UTC(j1, m1 - 1, d1)) / 86_400_000);
}

/**
 * The grid the timeline is drawn on: its columns, the CSS tracks they take, the month labels, and where a date lands.
 */
export function bouwRaster(lesweken: Lesweek[], onderbrekingen: Planningsonderbreking[]) {
  const kolommen: (Weekkolomdata | Gatkolom)[] = [];
  const sporen: string[] = [];
  let spoor = 1;

  lesweken.forEach((week, index) => {
    const vorige = lesweken[index - 1];
    if (vorige && dagenVerschil(vorige.maandag, week.maandag) > 7) {
      const van = verschuif(vorige.maandag, 7);
      const tot = verschuif(week.maandag, -1);
      const namen = onderbrekingen.filter((o) => o.start <= tot && o.eind >= van).map((o) => o.naam);
      kolommen.push({ soort: "gat", van, tot, naam: [...new Set(namen)].join(" · "), spoor });
      sporen.push("2.25rem");
      spoor += 1;
    }
    kolommen.push({ soort: "week", maandag: week.maandag, heeftThema: week.heeftThema, spoor });
    sporen.push("repeat(5, 1rem)");
    spoor += 5;
  });

  const laatsteSpoor = spoor - 1;
  const weekPerMaandag = new Map(
    kolommen.filter((k): k is Weekkolomdata => k.soort === "week").map((k) => [k.maandag, k]),
  );
  const gaten = kolommen.filter((k): k is Gatkolom => k.soort === "gat");
  const eersteMaandag = lesweken[0]?.maandag ?? "";

  /** The track a date is drawn in. A weekend day takes the Friday; a day in a vacation takes the gap. */
  function spoorVan(datum: string): number {
    const week = weekPerMaandag.get(maandagVan(datum));
    if (week) return week.spoor + Math.min(weekdagIndex(datum), 4);
    const gat = gaten.find((g) => datum >= g.van && datum <= g.tot);
    if (gat) return gat.spoor;
    return datum < eersteMaandag ? 1 : laatsteSpoor;
  }

  // A month is named on the first week whose Wednesday falls in it: most of that week's days are the month's, so a week
  // from 31 August is September's and a week from 28 September is still September's.
  const maanden: { maandag: string; naam: string; spoor: number }[] = [];
  let vorigeMaand = "";
  for (const kolom of kolommen) {
    if (kolom.soort !== "week") continue;
    const woensdag = verschuif(kolom.maandag, 2);
    const maand = woensdag.slice(0, 7);
    if (maand !== vorigeMaand) {
      maanden.push({ maandag: kolom.maandag, naam: maandJaar(woensdag).split(" ")[0], spoor: kolom.spoor });
      vorigeMaand = maand;
    }
  }

  return { kolommen, sporen: sporen.join(" "), maanden, spoorVan };
}
