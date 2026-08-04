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
  // "{aantal} {soort}", where soort is only ever one of the three participles in `import.soort.*`
  // (toegevoegd / bijgewerkt / ongewijzigd). A participle does not inflect with the count, so "1 toegevoegd"
  // and "9 toegevoegd" are both correct. One count string for three kinds, rather than three plus three
  // singulars. NOTE the coupling: interpolating an inflecting noun here would need a singular form.
  "import.telling": "the interpolated word is an uninflected participle, so 1 reads correctly",
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
 * The two prefixes whose copy talks about surviving a (re)generation: `kalender.vergrendel*` /
 * `kalender.vergrendeld*` (the lock, E4-06) and `kalender.weigering*` (the rejection, E4-06 + E4-02).
 *
 * **Kept as separate families on purpose, and that is a correction (E4-02, round-4 audit).** E4-02 first widened one
 * flat filter to cover both, reasoning that both members already satisfied the assertion so it "cost nothing". The
 * per-string assertion was indeed unaffected — but the flat list **disabled the family's non-vacuity canary**. With
 * one combined list, `length > 0` is satisfied by *either* family, so renaming every `vergrendel*` key away and
 * restoring the unscoped lock promise left this file green: no lock string was inspected at all. That canary is not
 * theoretical — the comment below records it catching exactly that rename. Asserting per family is what makes
 * "this family is non-empty" mean anything.
 *
 * *Why `weigering*` belongs in scope at all:* `weigeringUitleg` makes precisely the claim these guards police, and
 * E4-02 added a **second** member (`weigeringUitlegVervallen`) making the same claim, covered only by hand-written
 * `toContain` lines in `Jaarplankalender.test.tsx`. A third variant would have escaped both. E4-05/E4-07 are
 * scheduled to re-read these strings, which is exactly when an unguarded family gets a new member.
 */
const SLOTTEKSTEN = [...CATALOGUS].filter(([sleutel]) =>
  sleutel.startsWith("kalender.vergrendel"),
);

const WEIGERINGTEKSTEN = [...CATALOGUS].filter(([sleutel]) =>
  sleutel.startsWith("kalender.weigering"),
);

/** Both families, for the per-string assertions. Non-vacuity is asserted per family, never over this. */
const HERGENERATIETEKSTEN = [...SLOTTEKSTEN, ...WEIGERINGTEKSTEN];

describe("nl.json — no regeneration promise goes unscoped, in either family", () => {
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
  /**
   * **Known blind spot, recorded rather than left implicit (E4-06 round-2 audit).** This guard triggers on the
   * word `hergener`, so a sentence that makes a scope claim *without* that word is structurally invisible to it.
   * `vergrendelUitlegGeweigerdVast` is exactly that case: it says the weigering keeps the thema out of the AI's
   * reach and deliberately avoids the word, because the weigering section already carries the qualified claim.
   * Its scoping is pinned instead by an explicit `toContain("hier")` in `Jaarplankalender.test.tsx`, beside the
   * assertion that keeps it free of "hergener" — idempotence is per `(thema, niveau, blokStart)`, so the AI may
   * still propose the thema in another period.
   *
   * The lesson worth keeping: a guard keyed on a phrase, plus a sibling that states the same fact while avoiding
   * that phrase, is a guard that cannot see the newest member of the class it was written for. If a future lock
   * string makes a scope claim, either give it the word or pin it over there the same way.
   *
   * *This comment is itself a correction (2026-08-03).* It previously asserted that the `toContain("hier")`
   * assertion already existed. It did not, so deleting "hier" from the string left the whole suite green — a
   * comment claiming coverage that was not there, which is the third instance of that class on this story and
   * the first written while fixing the second. Found by the closing audit; the assertion now exists, so the
   * sentence above is true rather than aspirational.
   */
  it("qualifies every lock or weigering string that mentions a hergeneratie", () => {
    // Non-vacuity, kept for symmetry with the second guard although it is *redundant here*: `gevonden` is a
    // subset of SLOTTEKSTEN, so the assertion below already fails on an empty family. That is not a guess — when
    // a stalled agent renamed the family to `slotvergrendel*`, the line that caught it was the `gevonden.length`
    // one, before this line existed. The second guard is where non-vacuity is genuinely load-bearing.
    // **Per family, not over the union.** See the note on the constants: a combined list makes this line satisfiable
    // by whichever family survives, which is how E4-02 briefly turned the rename canary off.
    expect(SLOTTEKSTEN.length).toBeGreaterThan(0);
    expect(WEIGERINGTEKSTEN.length).toBeGreaterThan(0);

    const gevonden = HERGENERATIETEKSTEN.filter(([, waarde]) => waarde.includes("hergener"));

    // If the phrasing ever changes so that none match, the guard has gone quiet and must be revisited.
    expect(gevonden.length).toBeGreaterThan(0);

    for (const [sleutel, waarde] of gevonden) {
      expect(waarde, `${sleutel} promises a hergeneratie without saying which one`).toContain(
        "hele jaarplan",
      );
    }
  });

  /**
   * The lock copy may not instruct a teacher to *choose a period*. E4-06 round 1 put a second copy of that
   * instruction inside `vergrendelUitlegVervallen`, and on a card that is stale **and** rejected the period picker is
   * suppressed, so the instruction pointed at an affordance that is not there — the E3-06 rule.
   *
   * **Premise corrected in E3-08 fix round 4 (antagonist MINOR-1).** This comment used to justify the guard with
   * *"the instruction belongs to `kalender.herplaatsKies` alone, which stands at the top of the same panel"*, and
   * E3-08 made both halves false. The line at the top of that panel is now one of **three**, paired to the board's
   * state by `HERPLAATSUITLEG`, of which only the coarse tier gets `herplaatsKies`; and on a stale **rejected** card
   * no re-placement line renders at all. So the guard's real reason is stronger than "do not duplicate": in the three
   * states the lock copy can co-occur with, repeating *"kies een periode"* would **contradict** the line above it at
   * the fine tier, **claim a picker that is not in the panel** on a rejected card, or duplicate it at the coarse tier.
   *
   * *Recorded rather than quietly rewritten,* because the merge that falsified this premise corrected it in
   * `Themakaart.tsx` and left this instance untouched — fixed where it was noticed, left where it was not, which is
   * verbatim the pattern this file's own header decries. **The guard itself was and is correct; only its
   * justification lied.**
   */
  it("keeps the 'choose a period' instruction out of the lock and weigering copy", () => {
    // Same non-vacuity guard as above, per family for the same reason a combined list would not do.
    expect(SLOTTEKSTEN.length).toBeGreaterThan(0);
    expect(WEIGERINGTEKSTEN.length).toBeGreaterThan(0);
    expect(CATALOGUS.get("kalender.herplaatsKies")).toContain("Kies");

    // **Extended to the weigering family by E4-02 (round-4 audit), and the reason is the same rule, not symmetry.**
    // E3-08 removed the re-placement line from rejected cards at *both* tiers, and E4-02 then made a stale rejected
    // card reachable in one press. So a weigering string containing "kies een periode" would claim a picker that is
    // suppressed on exactly the card it renders on — the E3-06 rule, in the state this story made routine. It is the
    // defect E3-07 is reopened over, one string family across.
    for (const [sleutel, waarde] of HERGENERATIETEKSTEN) {
      expect(waarde.toLowerCase(), `${sleutel} repeats the re-placement instruction`).not.toMatch(
        /\bkies\b/,
      );
    }
  });
});

describe("nl.json — the stale-placement notice does not overclaim about dekking", () => {
  /**
   * `kalender.herzienUitleg` used to end *"Zolang dit openstaat is de dekking van dit jaarplan onbetrouwbaar"*, which
   * the owner ruling of 2026-08-03 made false: a **rejected** stale placement leaves the figure trustworthy, because
   * `DekkingService` counts `IsVervallen && !IsGeweigerd` and dekking is recomputed on every read, so the state is
   * self-healing. E5-01 assigned the fix to E5-02 and E5-02 is where it landed, because E5-02 is what made the
   * contradiction *visible*: before it, no screen showed a figure to contradict.
   *
   * The notice still lists a rejected stale card, deliberately: that card needs its own explanation (E3-07), and the
   * two counts answer different questions. What changed is only the sentence, which now says what actually unblocks
   * the figure, and says that a weigering counts.
   *
   * **The blind spot, stated rather than left implicit** (the E4-06 lesson: a guard keyed on a phrase cannot see a
   * sibling that states the same thing while avoiding the phrase). This guard keys on the word `onbetrouwbaar`. A
   * reword to *"kan je de dekking niet vertrouwen"* would restore the false claim and pass. The second assertion is
   * what makes that harder: the sentence has to keep naming the weigering as a decision, which a rewrite that
   * reintroduces the unconditional claim would have to actively remove.
   */
  it("does not call the dekking unreliable while a weigering resolves it", () => {
    const uitleg = CATALOGUS.get("kalender.herzienUitleg");

    expect(uitleg, "kalender.herzienUitleg has been renamed; this guard now checks nothing").toBeDefined();
    expect(uitleg!.toLowerCase()).not.toContain("onbetrouwbaar");
    expect(uitleg!.toLowerCase()).toContain("weigeren");
  });
});

describe("nl.json — no dead keys under dekking", () => {
  /**
   * The same guard as the `doelen.*` one below, extended to E5-02's family for the same reason it was written: E1-16
   * shipped three unused keys and one of them, `clusterLabel`, was the field the screen *should* have been rendering,
   * while a test asserting its absence read as coverage of the branch. This family is the one most exposed to that,
   * because several of its keys exist for states a test has to construct deliberately (the withheld figure, the empty
   * scope, the fallback), so a key that is never reached also never shows up as a missing screen.
   *
   * Scoped per family rather than repo-wide for the reason the sibling gives: a repo-wide version needs real usage
   * analysis (some keys are built by template, e.g. `doelsoort.${soort}`), and a guard weakened until it passes
   * teaches nothing.
   */
  it("renders every dekking.* key somewhere in the feature", async () => {
    const bestanden = import.meta.glob("../features/dekking/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;

    const bron = Object.entries(bestanden)
      .filter(([pad]) => !pad.includes(".test.") && !pad.includes("testdata"))
      .map(([, inhoud]) => inhoud)
      .join("\n");

    const ongebruikt = [...CATALOGUS.keys()]
      .filter((sleutel) => sleutel.startsWith("dekking."))
      .filter((sleutel) => !bron.includes(sleutel));

    expect(ongebruikt).toEqual([]);
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
