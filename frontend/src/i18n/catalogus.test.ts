import { describe, expect, it } from "vitest";

import nl from "./nl.json";

/**
 * Catalogue-wide invariants for `nl.json`, so a new string cannot reintroduce an old defect.
 *
 * This file exists because of the **plural bug**: a count interpolated into a plural sentence, giving
 * "1 doelen". It has now shipped **five times** in this repo, twice inside the commit that announced fixing it,
 * and the fifth was E1-16's paging button. `tAantal` exists precisely so a call site cannot reintroduce it, and
 * each previous fix was applied to the one instance that had been noticed. This guard is aimed at the class:
 * it fails on any *new* `{aantal}` string that has no singular counterpart, whether or not anyone remembers to
 * write a test for the screen that renders it.
 *
 * The sibling catalogue-wide guard against em dashes (Art. II.5) lives in
 * `features/jaarplan/Generatieparameters.test.tsx`; it is left where it is rather than moved here, because
 * moving a passing guard is a good way to lose one.
 */

/** Every leaf of the catalogue as a dot path plus its Dutch value. */
function* bladeren(node: object, pad = ""): Generator<[string, string]> {
  for (const [sleutel, waarde] of Object.entries(node)) {
    const volledig = pad ? `${pad}.${sleutel}` : sleutel;
    if (typeof waarde === "string") {
      yield [volledig, waarde];
    } else if (waarde && typeof waarde === "object") {
      yield* bladeren(waarde as object, volledig);
    }
  }
}

const CATALOGUS = new Map(bladeren(nl));

/**
 * Count strings that do **not** need a singular counterpart, each with the reason.
 *
 * An entry here is a claim that the string is grammatical at `aantal === 1`, and it has to stay a claim someone
 * can check. "It is pre-existing" is not a reason; every line below says why the Dutch works.
 */
const GEEN_ENKELVOUD_NODIG: Record<string, string> = {
  // A bare parenthesised numeral with no noun to inflect: "Wiskunde (1)" is correct.
  "doelen.optieMetAantal": "no inflected noun, the number stands alone in brackets",
  // "nog niet gekoppeld" is a participle phrase and does not inflect: "1 nog niet gekoppeld" is correct.
  "ongekoppeld.aantal": "the trailing phrase does not inflect with the count",
  // Unreachable at 1: `isTeVol` requires `>= VOORLOPIGE_TE_VOL_DREMPEL`, which is 3. NOTE the coupling: that
  // constant is named "voorlopige" for a reason, and lowering it to 1 would make this string ungrammatical.
  // Whoever changes it owns adding the singular.
  "kalender.teVol": "unreachable at 1 while VOORLOPIGE_TE_VOL_DREMPEL >= 2",
};

/**
 * Singular counterparts that do not follow the `<key>Enkelvoud` convention. Kept as an explicit map rather
 * than a looser pattern, so the guard cannot be satisfied by an unrelated neighbouring key.
 */
const AFWIJKEND_ENKELVOUD: Record<string, string> = {
  "kalender.doelenGekoppeld": "kalender.eenDoelGekoppeld",
};

describe("nl.json — counts always have a singular form", () => {
  it("gives every {aantal} string a singular counterpart, or an explicit reason", () => {
    const ontbreekt: string[] = [];

    for (const [sleutel, waarde] of CATALOGUS) {
      if (!waarde.includes("{aantal}") || sleutel.endsWith("Enkelvoud")) {
        continue;
      }

      if (sleutel in GEEN_ENKELVOUD_NODIG) {
        continue;
      }

      const enkelvoud = AFWIJKEND_ENKELVOUD[sleutel] ?? `${sleutel}Enkelvoud`;
      if (!CATALOGUS.has(enkelvoud)) {
        ontbreekt.push(
          `${sleutel} ("${waarde}") has no singular: add "${enkelvoud}" and render it through tAantal, ` +
            "or add an entry to GEEN_ENKELVOUD_NODIG explaining why the Dutch is correct at 1",
        );
      }
    }

    expect(ontbreekt).toEqual([]);
  });

  /** The exemption lists must not rot into a list of keys that no longer exist. */
  it("keeps its exemption lists honest", () => {
    for (const sleutel of Object.keys(GEEN_ENKELVOUD_NODIG)) {
      expect(CATALOGUS.has(sleutel), `${sleutel} is exempted but no longer in the catalogue`).toBe(true);
      expect(
        CATALOGUS.get(sleutel)!.includes("{aantal}"),
        `${sleutel} is exempted but no longer interpolates a count`,
      ).toBe(true);
    }

    for (const [sleutel, enkelvoud] of Object.entries(AFWIJKEND_ENKELVOUD)) {
      expect(CATALOGUS.has(sleutel), `${sleutel} is mapped but no longer in the catalogue`).toBe(true);
      expect(CATALOGUS.has(enkelvoud), `${enkelvoud} is mapped as a singular but does not exist`).toBe(true);
    }
  });
});

/**
 * Every string the kalender uses to talk about the lock, i.e. `kalender.vergrendel*` and `kalender.vergrendeld*`.
 * Collected by prefix rather than listed, which is the whole point of the two guards below.
 */
const SLOTTEKSTEN = [...CATALOGUS].filter(([sleutel]) => sleutel.startsWith("kalender.vergrendel"));

describe("nl.json — the lock copy makes no unscoped promise about regeneration", () => {
  /**
   * E4-06 promises that a locked thema survives *a regeneration*. Only one regeneration path exists today
   * (`JaarplanGeneratieService`, which discards exactly `Voorgesteld && !vergrendeld`). **E4-05** adds a second
   * discard path and **E4-07's** preserve/overwrite rule is still an open directie question, so an unqualified
   * "bij hergenereren" is a promise about code nobody has written.
   *
   * Aimed at the class on purpose. The E4-06 round-1 fix qualified the four sentences the audit had quoted and
   * left `vergrendeldUitleg` — "Blijft staan bij hergenereren", the tooltip on the "Vast" badge — untouched,
   * which is exactly the pattern this file's header describes: *each previous fix was applied to the one instance
   * that had been noticed.*
   */
  it("qualifies every lock string that mentions a hergeneratie", () => {
    const gevonden = SLOTTEKSTEN.filter(([, waarde]) => waarde.includes("hergener"));

    // If the phrasing ever changes so that none match, the guard has gone quiet and must be revisited.
    expect(gevonden.length).toBeGreaterThan(0);

    for (const [sleutel, waarde] of gevonden) {
      expect(waarde, `${sleutel} promises a hergeneratie without saying which one`).toContain(
        "hele jaarplan",
      );
    }
  });

  /**
   * The re-placement instruction belongs to `kalender.herplaatsKies` alone (E3-07's), which stands at the top of
   * the same panel. E4-06 round 1 added a second copy of it inside `vergrendelUitlegVervallen`, and on a card
   * that is stale **and** rejected the period picker is suppressed, so the instruction pointed at an affordance
   * that is not there — the E3-06 rule.
   */
  it("leaves the 'choose a period' instruction to kalender.herplaatsKies alone", () => {
    expect(CATALOGUS.get("kalender.herplaatsKies")).toContain("Kies");

    for (const [sleutel, waarde] of SLOTTEKSTEN) {
      expect(waarde.toLowerCase(), `${sleutel} repeats the re-placement instruction`).not.toMatch(
        /\bkies\b/,
      );
    }
  });
});

describe("nl.json — no dead keys under doelen", () => {
  /**
   * Three keys shipped unused in E1-16 (`taxonomieLabel`, `sluiten`, `clusterLabel`), and one of them,
   * `clusterLabel`, was the field the detail should have been rendering (antagonist findings 7 and 9). A dead
   * key is not merely clutter here: a test asserted the absence of `clusterLabel` on screen and read as
   * coverage of the nullable-cluster branch, when the app never rendered it either way.
   *
   * Scoped to `doelen.*` on purpose. A repo-wide version would need a real usage analysis (keys are also built
   * by template, e.g. `doelsoort.${soort}`), and a guard that has to be weakened to pass teaches nothing.
   */
  it("renders every doelen.* key somewhere in the feature", async () => {
    const bestanden = import.meta.glob("../features/doelen/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;

    const bron = Object.entries(bestanden)
      .filter(([pad]) => !pad.includes(".test."))
      .map(([, inhoud]) => inhoud)
      .join("\n");

    const ongebruikt = [...CATALOGUS.keys()]
      .filter((sleutel) => sleutel.startsWith("doelen."))
      .map((sleutel) => sleutel.slice("doelen.".length))
      // `t("doelen.x")` or, for a key reached through a lookup table, the bare name in a record literal.
      .filter((naam) => !bron.includes(`doelen.${naam}`));

    expect(ongebruikt).toEqual([]);
  });
});
