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
    const viaSjabloon = /^(doelsoort|status|herkomst)\./;
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
