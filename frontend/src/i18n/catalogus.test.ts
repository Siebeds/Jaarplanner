import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import catalogus from "./nl.json";

/**
 * Guards on the Dutch copy that a type cannot express.
 *
 * These exist because every rule below has already been broken at least once somewhere in this
 * repository, and none of the breakages failed a test: a stale key renders as itself, an em dash
 * renders fine, and a Dutch sentence hard-coded in a component looks identical on screen to one
 * that came from the catalogue. The only thing that catches them is a guard that reads the source.
 */

// Resolved from the run root rather than from `import.meta.url`: Vitest transforms modules and
// hands them a non-file URL, so neither `fileURLToPath` nor `.pathname` gives a usable path here.
const SRC = join(process.cwd(), "src");

function bronbestanden(): string[] {
  const gevonden: string[] = [];
  const loop = (map: string) => {
    for (const item of readdirSync(map, { withFileTypes: true })) {
      const pad = join(map, item.name);
      if (item.isDirectory()) loop(pad);
      else if (/\.tsx?$/.test(item.name) && !item.name.endsWith(".test.ts") && !item.name.endsWith(".test.tsx")) {
        gevonden.push(pad);
      }
    }
  };
  loop(SRC);
  return gevonden;
}

function bladeren(knoop: unknown, pad: string[] = []): [string, string][] {
  if (typeof knoop === "string") return [[pad.join("."), knoop]];
  if (typeof knoop !== "object" || knoop === null) return [];
  return Object.entries(knoop as Record<string, unknown>).flatMap(([sleutel, waarde]) =>
    bladeren(waarde, [...pad, sleutel]),
  );
}

const SLEUTELS = bladeren(catalogus);
const BESTANDEN = bronbestanden();
const BRON = BESTANDEN.map((pad) => readFileSync(pad, "utf8")).join("\n");

describe("de Nederlandse catalogus", () => {
  it("bevat geen em dash", () => {
    // Owner instruction, 2026-07-29. An em dash is not deleted but designed away: split the clause
    // or use a colon. En dashes in date ranges are allowed and are a different character.
    const fout = SLEUTELS.filter(([, waarde]) => waarde.includes("—"));
    expect(fout.map(([sleutel]) => sleutel)).toEqual([]);
  });

  it("bevat geen dubbele spaties of spaties aan de randen", () => {
    const fout = SLEUTELS.filter(([, waarde]) => waarde !== waarde.trim() || waarde.includes("  "));
    expect(fout.map(([sleutel]) => sleutel)).toEqual([]);
  });

  it("heeft geen dode sleutels", () => {
    // A key nothing references is a key nobody maintains, and it is the one that goes stale.
    // Doelsoort, status and herkomst keys are reached through a template literal, so they are
    // matched on their last segment instead of the whole path.
    const viaSjabloon = /^(doelsoort|status|herkomst|activiteitsoort|activiteitkleur)\./;
    const dood = SLEUTELS.filter(([sleutel]) => {
      if (viaSjabloon.test(sleutel)) {
        const groep = sleutel.split(".")[0];
        return !BRON.includes(`\`${groep}.\${`);
      }
      return !BRON.includes(`"${sleutel}"`);
    });
    expect(dood.map(([sleutel]) => sleutel)).toEqual([]);
  });
});

describe("de Op.stap-import en het minimumdoelenregister (E1-22)", () => {
  it("zeggen niet dat de doelen uit een bestand komen", () => {
    // E1-12 and E1-21 made that false: both kinds of goal come from KOV's API now. The register said the minimumdoelen
    // came "uit het decretale bestand" and the leerplandoelen from "de Op.stap-bestanden". Only the Excel upload's own
    // keys (importeren.opstap) may still speak of a file.
    const fout = SLEUTELS.filter(
      ([sleutel, waarde]) =>
        (sleutel.startsWith("doelen.") || sleutel.startsWith("importeren.kov.")) && /bestand/i.test(waarde),
    );
    expect(fout.map(([sleutel]) => sleutel)).toEqual([]);
  });

  it("stellen een minimumdoel zonder ingeladen leerplandoel nooit voor als iets wat de leerkrachten lieten liggen", () => {
    // The E5-03 rule on a branch whose condition proves one thing: no loaded leerplandoel refers to it. Whether it is
    // covered, missing or waiting for a teacher is not in that condition, and the six of ADR-0032 decision 5 cannot be
    // covered by anyone under the G-only scope.
    const gatwoorden = /\b(gedekt|dekking|ontbreekt|ontbreken|mist|missen|gat|vergeten|koppel\w*)\b/i;
    // Extended in fix round 1 to the reasons per minimumdoel (owner ruling 2026-09-13 "Reden tonen") and the goal-set
    // names they are built from; extended by TB-010 to the tree's row without a goal, the group without an ordering, and
    // the whole minimumdoel detail, whose no-goal branch speaks about the same condition. (The note that a minimumdoel
    // can appear more than once went with the ordering that caused it.)
    const fout = SLEUTELS.filter(
      ([sleutel, waarde]) =>
        /^(doelen\.(zonderLeerplandoel|geenLeerplandoel|zonderOrdening|reden|doelset)|minimumdoel\.)/.test(sleutel) &&
        gatwoorden.test(waarde),
    );
    expect(SLEUTELS.filter(([sleutel]) => /^doelen\.reden/.test(sleutel)).length).toBe(3);
    expect(fout.map(([sleutel]) => sleutel)).toEqual([]);
  });

  it("hebben bij elk meervoud een enkelvoud", () => {
    // "1 leerplandoelen staan niet meer in Op.stap" is the plural bug this repo has shipped before. Every counted
    // sentence of this story is a pair `…Een` / `…Meer`, chosen by count at the call site.
    const meervouden = SLEUTELS.map(([sleutel]) => sleutel).filter((sleutel) =>
      /^(importeren\.kov|doelen)\..*Meer$/.test(sleutel),
    );
    const zonderEnkelvoud = meervouden.filter(
      (sleutel) => !SLEUTELS.some(([ander]) => ander === sleutel.replace(/Meer$/, "Een")),
    );
    expect(meervouden.length).toBeGreaterThan(0);
    expect(zonderEnkelvoud).toEqual([]);
  });
});

describe("het gebruikersbeheer (E6-04)", () => {
  it("zegt bij een leeftijd zonder hoofdleerkracht niet dat alleen de directie er iets mag, met de leeftijd in de zin zelf", () => {
    // The E5-03 rule. The sentence shows when a listed jaarfase has no appointment that counts anywhere. ADR-0030 (c)
    // says only that directie then does BY HAND what a hoofdleerkracht would. It is not "alone": themabeheer still creates
    // subthema's and subdoelen through the wizard at any leeftijd and edits what its run made (I25), the FR-1 import writes
    // subdoel links, and the leerkrachten of that leeftijd edit the shared activiteiten and the streefwoordenschat. Two
    // rounds claimed too much ("past alleen de directie de subthema's aan", then "beheert alleen de directie de subthema's
    // en subdoelen"), so any "alleen" is refused here. It also names its own referent: the first version pointed back with
    // "die leeftijd" at a list that did not say which (antagonist, slice 2 rounds 1 and 2).
    const zin = catalogus.gebruikers.zonderHoofdleerkracht;
    expect(zin).toMatch(/leeftijd zonder hoofdleerkracht/);
    expect(zin).not.toMatch(/\balleen\b|\bdie leeftijd\b|activiteit/i);
  });
});

describe("de componenten", () => {
  it("renderen geen Nederlandse tekst die niet uit de catalogus komt", () => {
    // JSX text between two tags. Anything that came from the catalogue arrives inside braces, so
    // a bare run of letters here is a literal somebody typed into a component.
    //
    // Only .tsx: in a .ts file the same pattern matches a generic call such as `apiFetch<T>(...)`,
    // where the ">" and the "<" belong to two different expressions. Measured rather than reasoned,
    // because the first version of this guard reported four of exactly that.
    const jsxTekst = />\s*([A-Za-zÀ-ÿ][^<>{}\n]{3,}?)\s*</g;
    const overtredingen: string[] = [];

    for (const pad of BESTANDEN.filter((bestand) => bestand.endsWith(".tsx"))) {
      const inhoud = readFileSync(pad, "utf8");
      for (const [, tekst] of inhoud.matchAll(jsxTekst)) {
        if (/^[A-Za-z]+(\.[a-z]+)+$/.test(tekst)) continue; // a dotted identifier, not a sentence
        // The surrounding \s* is allowed to cross a newline while the captured text is not, so a
        // JSX expression that opens on one line and returns an element on the next gets caught as
        // "text": `{(id) =>` / `klassen.length === 0 ? (` / `<p ...`. Dutch copy contains no "=" and
        // never ends on an opening bracket, so those two exclusions cost the guard nothing.
        if (tekst.includes("=") || tekst.endsWith("(")) continue;
        overtredingen.push(`${relative(SRC, pad)}: ${tekst}`);
      }
    }

    expect(overtredingen).toEqual([]);
  });

  it("gebruiken geen letterlijke tekst in aria-label, placeholder, title of alt", () => {
    // These four attributes are read out loud or shown on hover, so a literal here is user-facing
    // copy that escaped the catalogue exactly like a visible sentence would.
    const attribuut = /\b(aria-label|placeholder|title|alt)="([^"]{2,})"/g;
    const overtredingen: string[] = [];

    for (const pad of BESTANDEN) {
      const inhoud = readFileSync(pad, "utf8");
      for (const [, naam, waarde] of inhoud.matchAll(attribuut)) {
        overtredingen.push(`${relative(SRC, pad)}: ${naam}="${waarde}"`);
      }
    }

    expect(overtredingen).toEqual([]);
  });

  it("bevatten geen em dash in de bron", () => {
    const fout = BESTANDEN.filter((pad) => readFileSync(pad, "utf8").includes("—"));
    expect(fout.map((pad) => relative(SRC, pad))).toEqual([]);
  });
});
