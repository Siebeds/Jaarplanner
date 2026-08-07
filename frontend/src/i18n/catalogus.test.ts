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
  // The same shape as `doelen.optieMetAantal` and for the same reason: the count sits alone in brackets after the
  // doelsoort label, so "Minimumdoel (1)" is correct. Deliberately the same string shape as the register's doelsoort
  // filter, which is the control this one is modelled on.
  "dekking.doelsoortOptie": "no inflected noun, the number stands alone in brackets",
  // "nog niet gekoppeld" is a participle phrase and does not inflect: "1 nog niet gekoppeld" is correct.
  "ongekoppeld.aantal": "the trailing phrase does not inflect with the count",
  // `kalender.teVol` used to be exempted here, "unreachable at 1 while VOORLOPIGE_TE_VOL_DREMPEL >= 2", and the
  // exemption named the coupling that would break it. E3-09 broke it exactly as predicted: the owner ruled te vol is
  // weeks needed against weeks available (2026-07-31), the constant is gone and the string interpolates no count at
  // all, so this guard no longer has anything to say about it. Removed rather than reworded, because
  // "keeps its exemption lists honest" fails on an entry whose key no longer carries `{aantal}` — which is the guard
  // working. Left as a comment because the coupling note was right and paid off.
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
  // These two carry TWO counts and only the available one can reach 1 in a reachable state, so the singular is named
  // for the case rather than for the convention: `…EenWeek`, not `…Enkelvoud`. See the note at the te-vol render in
  // `Periodekolom.tsx` for why `benodigdeWeken` needs no variant.
  "kalender.teVol": "kalender.teVolEenWeek",
  "kalender.wordtTeVol": "kalender.wordtTeVolEenWeek",
};

/**
 * The Dutch nouns this catalogue inflects after a count, and the singular each takes.
 *
 * **This list exists because the `{aantal}` rule below was structurally blind, and E3-09 proved it twice in one
 * commit.** That rule finds a count by its *placeholder name*, so `kalender.weken` (`"{weken} weken"`) escaped it for
 * as long as it existed, and then `kalender.teVol` (`"{nodig} weken thema's in {beschikbaar} weken"`) escaped it again
 * in the very commit that diagnosed the first escape. Eight instances of this defect in this repo, two of them found
 * by an auditor rather than by this file.
 *
 * So the guard no longer trusts the placeholder's *name*. It looks at what sits **after** a placeholder: any
 * `{whatever}` immediately followed by one of these nouns is a count, whatever it is called.
 *
 * *Why a list of nouns rather than a general rule.* A fully general "placeholder followed by any word" check flags
 * dozens of correct strings (`"{thema} staat nu vast"`, `"Stond op {datum}"`), so it would need a bigger exemption list
 * than the defect is worth, and an exemption list is the thing that rots. A noun list is the maintenance point instead,
 * and it is a **visible** one: adding a plural noun to the product without adding it here is the way the ninth instance
 * gets in. Prefer the shape that needs no entry at all — put the noun before the count, or outside the interpolation.
 */
const GETELDE_ZELFSTANDIGE_NAAMWOORDEN = [
  "weken",
  "dagen",
  "thema's",
  "doelen",
  "leerplandoelen",
  "activiteiten",
  "subthema's",
  "plaatsingen",
  "periodes",
  "themaperiodes",
  "voorstellen",
  "rijen",
  "bestanden",
];

/** Every placeholder in `waarde` that is directly followed by an inflecting noun, e.g. `nodig` in `"{nodig} weken"`. */
function tellendePlaatshouders(waarde: string): string[] {
  const gevonden: string[] = [];

  for (const noun of GETELDE_ZELFSTANDIGE_NAAMWOORDEN) {
    // `{x} weken` and `{x} hele weken`: one optional adjective between the count and its noun.
    const patroon = new RegExp(`\\{(\\w+)\\}\\s+(?:\\w+\\s+)?${noun.replace("'", "'")}\\b`, "g");
    for (const match of waarde.matchAll(patroon)) {
      gevonden.push(match[1]);
    }
  }

  return [...new Set(gevonden)];
}

describe("nl.json — counts always have a singular form", () => {
  it("gives every {aantal} string a singular counterpart, or an explicit reason", () => {
    const ontbreekt: string[] = [];

    for (const [sleutel, waarde] of CATALOGUS) {
      // A count is a placeholder named `aantal`, OR any placeholder sitting directly in front of an inflecting noun.
      // The second test is the one that matters: see GETELDE_ZELFSTANDIGE_NAAMWOORDEN for the two defects that got
      // through while only the first existed.
      const telt = waarde.includes("{aantal}") || tellendePlaatshouders(waarde).length > 0;
      if (!telt || sleutel.endsWith("Enkelvoud") || sleutel.endsWith("EenWeek")) {
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

describe("nl.json — no regeneration promise goes unscoped, in any family", () => {
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

  /**
   * **The scopes a regeneration promise may name (E4-05).**
   *
   * Until this story the assertion above was a literal `toContain("hele jaarplan")`, and that was right for exactly as
   * long as one regeneration path existed: FR-8.1's whole-plan run was the only thing a promise *could* honestly be
   * about, so naming it and naming *a* scope were the same act. E4-05 builds FR-8.2, and with it the first `kalender.*`
   * copy whose scope is one period — for which "hele jaarplan" is not a qualification but a falsehood.
   *
   * So the rule is stated as what it always meant: **a string that talks about generating again must say which
   * regeneration it is talking about.** Two members today, and the list is deliberately an allowlist rather than a
   * loosened pattern: a string that names no scope at all is the defect this guard exists for, and `/periode/` alone
   * would let *"een hergeneratie kan dit thema in een andere periode zetten"* through while it names nothing.
   *
   * *Why the seven inherited strings still contain "hele jaarplan" after this story:* they name **both** paths now
   * ("van het hele jaarplan of van deze periode"), because both preserve exactly the same placements — the per-period
   * discard is `IsVervangbaar` narrowed by position, nothing more. Widening them was not an inference from that: the
   * survival claim is pinned per status by `Periodehergeneratie_laat_beslissingen_in_die_periode_staan` and
   * `Een_weigering_in_de_periode_overleeft_de_periodehergeneratie` in the backend suite. **A promise widened by
   * reasoning alone is how this backlog collected its retractions.**
   *
   * *What this guard still cannot see*, unchanged from the note above: a wording that avoids both stems
   * (*"nog eens door de AI laten doen"*). It narrows the class; it does not close it.
   */
  /**
   * *`themaperiode {ordinaal}` earned its place by this guard failing on E4-05's own aria-label,* which was the guard
   * working rather than being in the way: naming the period is the **most** precise scope statement in the family,
   * since it says not merely which *kind* of regeneration but which period.
   *
   * **That aria-label no longer needs the member, and the member is still load-bearing — for a different string**
   * (antagonist round 2, finding B). Fixing SC 2.5.3 reworded the label to "Deze periode opnieuw genereren… (themaperiode
   * {ordinaal})", which now matches on *"deze periode"*, so this branch looked dead. It is not:
   * `kalender.periodeRapportKop` matches on it alone — and it only entered the family at all once the pattern above
   * learned to read *"gegenereerd"*. Recorded rather than quietly rewritten, because a comment whose stated reason has
   * expired is the defect class this repo has retracted most often, and here the reason changed while the code was right.
   *
   * The placeholder is matched literally, so this branch cannot be satisfied by prose that happens to mention a
   * themaperiode; only a string that interpolates the period's own label qualifies.
   */
  const BEREIK = /hele jaarplan|deze periode|die periode|één periode|themaperiode \{ordinaal\}/;

  /**
   * **The same rule, over the whole `kalender` namespace rather than two prefixes (E4-04).**
   *
   * The two guards above are keyed on the key's *prefix* and on the word `hergener`, and this file already records
   * both blind spots that leaves. E4-04 walked straight into the second one: its own copy says *"opnieuw genereren"*,
   * which is FR-8.1's own wording and contains no `hergener` at all, so the family guard could not have seen the
   * newest member of the class it exists for. And a `grep` for the first blind spot found `kalender.plaatsGevolg`
   * (E4-03) already outside both prefixes, making the qualified claim with nothing pinning it.
   *
   * So this guard is keyed on the **claim** instead of on the key: any `kalender.*` string that talks about running
   * the generation again, in either wording, must say which regeneration it means. E4-05 adds the second discard path
   * and E4-07's preserve/overwrite rule is still an open directie question, so an unqualified promise is a statement
   * about code nobody has written — that reasoning is unchanged, only its reach is.
   *
   * The two guards above are **not** replaced by it: they carry the per-family non-vacuity canaries that caught a
   * rename once already, and a family defined by *content* rather than by key prefix cannot canary the same property.
   * It carries a canary anyway, and the trade-off is deliberate rather than unnoticed (this paragraph is a correction:
   * the first version argued a canary here was impossible and then wrote one three lines below). Rewording **all**
   * `kalender.*` copy away from every trigger phrase would turn a correct tree red — but that is a tripwire worth
   * having, because the same rewrite is how this guard would silently stop guarding anything at all. If you hit it,
   * the fix is to re-point the pattern at the new wording, not to delete the line.
   *
   * *Known limit, stated so the next author does not have to find it the hard way:* the pattern tolerates up to two
   * words between *opnieuw* and *gener*, so it reads *"opnieuw genereren"*, *"opnieuw laten genereren"* (FR-8.1's own
   * phrasing, which the first version missed) and *"opnieuw kunnen laten genereren"*. A wording that avoids both stems
   * (*"nog eens door de AI laten doen"*) is still invisible. This narrows the class; it does not close it.
   */
  it("qualifies every kalender string that talks about generating again, in any wording", () => {
    // Two words of slack, because the requirement itself says "opnieuw **laten** genereren" and the first version of
    // this pattern required adjacency — so the phrasing most likely to be copied out of the FA was the one phrasing
    // that escaped. Bounded rather than open-ended (`.*`) so an unrelated "probeer het opnieuw" three sentences above
    // a "genereren" cannot drag a string into the family and demand a scope clause it does not need.
    //
    // **`(?:ge)?gener` since round 2 of E4-05's audit, and it closed a real hole rather than tidying one.** Dutch puts
    // "ge" in front of the participle, so `\s+gener` could not see *"opnieuw gegenereerd"* — and
    // `kalender.periodeRapportKop` ("Alleen themaperiode 3 is opnieuw **gegenereerd**") is exactly that shape. It was
    // making a regeneration claim outside this family the whole time.
    //
    // *Written `ge?gener` at first, which is `g` + optional `e` + `gener` and therefore matches "gegener" but **not**
    // "gener" — so the "widening" silently dropped three existing members, including `hergenereerUitleg`. The
    // verification script I checked it with carried the same mistake and duly confirmed the claim. It was caught by the
    // named-member assertion below, which I had added for an unrelated reason. **A regex fix verified with the same
    // regex is not verified.**
    const OPNIEUW = /hergener|opnieuw(\s+\S+){0,2}\s+(?:ge)?gener/i;

    const gevonden = [...CATALOGUS].filter(
      ([sleutel, waarde]) => sleutel.startsWith("kalender.") && OPNIEUW.test(waarde),
    );

    // Non-vacuity is safe *here* in a way it is not for the guard above: this list is defined by content over the
    // whole namespace, and the button copy E4-04 added keeps it non-empty independently of the lock family's naming.
    expect(gevonden.length).toBeGreaterThan(0);

    // **Two named members, because both entered the family through a pattern change that could silently be undone**
    // (antagonist round 2, finding B). `periodeRapportKop` says "opnieuw **gegenereerd**", which the pattern could not
    // read until `ge?gener`; narrowing it back would drop the string from the family with every test still green, and
    // it is the ONLY member that names its scope through the `themaperiode {ordinaal}` branch — so that branch would
    // become dead in the same move. Naming them here makes both regressions loud instead of invisible.
    const sleutels = gevonden.map(([sleutel]) => sleutel);
    expect(sleutels).toContain("kalender.periodeRapportKop");
    expect(sleutels).toContain("kalender.hergenereerUitleg");

    for (const [sleutel, waarde] of gevonden) {
      // Lower-cased, unlike the guard above, because this family includes a **button label** where the phrase opens
      // the sentence: "Hele jaarplan opnieuw genereren…". The stricter guard's literal `toContain` would have forced
      // the copy into a worse Dutch word order to satisfy a test, which is the tail wagging the dog.
      expect(
        waarde.toLowerCase(),
        `${sleutel} promises a regeneration without saying which one`,
      ).toMatch(BEREIK);
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

describe("nl.json — de copy over verplaatsen noemt het dekkingsgevolg (E4-01)", () => {
  /**
   * The E4-01 antagonist found a test comment asserting that *"the card discloses it before the drag"* while no string
   * in the product said anything about dekking. The owner ruled the sentence in scope, so this guard exists to keep it
   * from being reworded away.
   *
   * **What this file can and cannot see, stated flatly, because round 1 of this guard got it wrong.** A catalogue test
   * mounts nothing, so it cannot know whether a sentence is *true in the state it renders in* — and that, not a
   * reword, is the failure mode this copy actually had: the first version of the clause sat in `beslisUitleg`, which
   * is tier-independent, and therefore promised a drag on the two tiers where the grip and the picker are both
   * withheld. **That property is pinned in `Jaarplankalender.test.tsx`**, which renders each tier; this file only
   * pins that the two sentences still make their claim at all.
   *
   * It keys on the two **keys** rather than on their wording for the same reason: an assertion quoting five words of
   * the string it checks is a tautology (the E4-02 lesson). `dekking` is the domain word and cannot be paraphrased
   * away without the register changing, so it is the one substring worth keying on.
   */
  it("keeps the dekking consequence on the tier-paired sentence and in the picker panel", () => {
    // `sleepUitleg` is BORDUITLEG's `kan` entry, so it renders only where moving actually works. That pairing is the
    // fix for the defect above, which is why the guard checks THIS key and not the tier-independent one.
    const bord = CATALOGUS.get("kalender.sleepUitleg");
    const paneel = CATALOGUS.get("kalender.verplaatsGevolg");
    const beslis = CATALOGUS.get("kalender.beslisUitleg");

    expect(bord, "kalender.sleepUitleg has been renamed; this guard now checks nothing").toBeDefined();
    expect(paneel, "kalender.verplaatsGevolg has been renamed; this guard now checks nothing").toBeDefined();
    expect(beslis, "kalender.beslisUitleg has been renamed; this guard now checks nothing").toBeDefined();

    expect(bord!.toLowerCase()).toContain("dekking");
    expect(paneel!.toLowerCase()).toContain("dekking");

    // And it must NOT drift back into the tier-independent sentence, where it was false on two of three states. This
    // is the one assertion here that pins a property rather than a presence: `beslisUitleg` may say a proposal does
    // not count, and may not say what makes it count, because it renders where that answer differs per tier.
    expect(beslis!.toLowerCase()).not.toContain("versleep");
    expect(beslis!.toLowerCase()).not.toContain("verplaats");
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

describe("nl.json — no dead keys under themabeheer", () => {
  /**
   * The same guard as the `doelen.*` one above, for the same reason and with the same scope caveat.
   *
   * It earned its place before this story shipped: writing it found `themabeheer.verwachteUitkomstenLabel`,
   * a field the class-scoped list does not render, and `themabeheer.doelGeenCurriculum`, which was **not**
   * dead clutter but a missing behaviour — the goal picker could only say "geen leerplandoel gevonden voor die
   * zoekterm", including at a school with an empty register. That is the E1-16 defect (finding 1) one screen
   * over. So a dead key here is worth treating as a question rather than as tidying: it is either copy nobody
   * needs, or a state nobody built.
   *
   * `activiteitType.*` is deliberately **not** covered: its keys are reached by template
   * (`t(`activiteitType.${...}`)`), so a text scan cannot see them. That union is pinned by the compiler
   * instead, in `Subthemakaart`'s `typeSleutel`.
   */
  it("renders every themabeheer.* key somewhere in the feature", async () => {
    const bestanden = import.meta.glob("../features/themas/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;

    const bron = Object.entries(bestanden)
      .filter(([pad]) => !pad.includes(".test.") && !pad.includes("testdata"))
      .map(([, inhoud]) => inhoud)
      .join("\n");

    const ongebruikt = [...CATALOGUS.keys()]
      .filter((sleutel) => sleutel.startsWith("themabeheer."))
      .map((sleutel) => sleutel.slice("themabeheer.".length))
      .filter((naam) => !bron.includes(`themabeheer.${naam}`));

    expect(ongebruikt).toEqual([]);
  });
});

describe("nl.json — the gaps-only empty state says nothing about coverage", () => {
  /**
   * `dekking.geenOntbrekendeInBeeld` fills one slot: the gaps-only view of the dekkingsoverzicht, with no rows, while
   * the figure is withheld. **Three sentences have occupied it and the first two were false**, each in a different
   * direction, and each was written to answer an audit finding about the one before it.
   *
   * 1. *"Hier staat niets zolang dit overzicht geen cijfer geeft. Los eerst de plaatsingen hierboven op, dan zie je
   *    welke doelen nog ontbreken."* — false twice. `groepen` never consults `isBetrouwbaar`, so gaps DO render in
   *    that state and the list is empty only when there are none; and resolving a placement can never reveal a row,
   *    only cover more doelen.
   * 2. *"… kan je daar niet uit besluiten dat alles gedekt is."* — false the other way. `DekkingService` excludes
   *    stale placements from its covering set (`!p.IsVervallen && TeltVoorDekking(p.Status)`), so staleness only ever
   *    suppresses coverage. The inference it forbade was valid and stable under resolution.
   *
   * **The bind that keeps producing this**, recorded so the fourth author does not rediscover it: the one accurate
   * explanation of the emptiness is *"er ontbreekt niets"*, and that is `gedekt === totaal`, i.e. the figure the
   * directie ruling of 2026-07-28 withholds. So the slot may state the fact and must say nothing about coverage in
   * either direction, including denials.
   *
   * **Why this is a catalogue guard and not a render test, stated precisely because the first version of this note was
   * too sweeping** (antagonist round 5). A render assertion *can* catch a sentence whose **referent** is missing from
   * the screen, and two in `Dekkingsoverzicht.test.tsx` do exactly that: *"keeps the doelsoort control on screen…"* and
   * *"does not say what counts towards a cijfer on a screen that gives no cijfer"*. What it cannot catch is a sentence
   * whose **content** is false, because `getByText(t(key))` compares the screen against the catalogue and editing the
   * catalogue moves the expectation with it — reverting either false version below failed no test in the suite. That
   * class, and only that class, needs a guard that reads the VALUE. Hence this family of describes.
   *
   * **The case law, moved here from `CLAUDE.md` where it was too long and got one example wrong** (antagonist round 5).
   * The standing rule is *a conditional sentence may assert only what its own render condition guarantees*; these are
   * the four sentences on E5-03 that broke it, each reaching past its branch to something a **different** owner
   * controlled:
   * - *"Kies bij Doelsoort een andere soort"* — asserted a **control** rendered by another branch's condition.
   * - *"… tellen mee in dit cijfer"* — presupposed a **figure** another branch owned.
   * - empty-state v1 — asserted that `groepen` consults `isBetrouwbaar`. It does not: `toonbareDoelen` never reads it,
   *   which is why the gaps list renders rows in the withheld state. **Falsified in the frontend, one file away.**
   * - empty-state v2 — asserted an epistemic property of `isGedekt` that `DekkingService` owns, across the API boundary.
   *
   * The last two are listed separately on purpose: `CLAUDE.md` collapsed them into "owned by `DekkingService`", which
   * was true of one of them, and that lost the more useful half — the code a sentence reaches past is as often in the
   * same file tree as across the wire. The rule caught three code comments on this story too, by the same mechanism.
   *
   * **Two limits, stated rather than left to be rediscovered** (the E4-06 lesson, already recorded by the
   * `herzienUitleg` guard above). A keyword guard cannot see a paraphrase: *"hieruit volgt niet dat je klaar bent"*
   * makes the same false claim and passes. And it cannot decide truth at all; it encodes a rule a human derived once
   * from `DekkingService` — in this state, no claims about coverage. The structural half lives in
   * `Dekkingsoverzicht.test.tsx` ("still lists the gaps while the figure is withheld"), which pins the world the
   * sentence describes. Neither half is sufficient alone.
   */
  const SLEUTEL = "dekking.geenOntbrekendeInBeeld";

  it("still exists, so this guard cannot be silently disarmed by a rename", () => {
    expect(
      CATALOGUS.get(SLEUTEL),
      `${SLEUTEL} has been renamed or removed; this guard now checks nothing`,
    ).toBeDefined();
  });

  it("is a single sentence, which is the rule rather than a word list", () => {
    // THE ASSERTION THAT GENERALISES, and the only one here that catches a paraphrase (antagonist round 4). The rule
    // this slot has to obey is "state the fact and stop": both false versions were a true first sentence followed by an
    // explanatory second one, and the explanation was the defect each time. A keyword list can only forbid the wording
    // already seen; this forbids the *shape* that produced all of it, whatever words the next author reaches for.
    // **Splits on a terminator followed by a capital or the end of the string, not on a bare `.`** (antagonist round
    // 5). A bare `.` treats **Op.stap** as a sentence boundary, and that is the product's own name: it occurs 20 times
    // in this catalogue, and `bv.` another 15, both in copy of exactly this register. The failure direction was safe (a
    // build break, never a shipped lie) but the message would have read "expected 1, received 2" on a genuinely single
    // sentence, and a guard that cries wolf on the product's name is a guard someone deletes.
    //
    // Residual, stated rather than left to be found: a second sentence beginning in lowercase evades this. Rare in
    // Dutch prose, and the keyword assertions below cover the wordings we have actually seen.
    const zinnen = CATALOGUS.get(SLEUTEL)!
      .trim()
      .split(/[.!?](?=\s+[A-Z]|$)/)
      .filter((deel) => deel.trim().length > 0);

    expect(
      zinnen,
      `${SLEUTEL} must state the fact and stop; an explanatory second sentence is what made both earlier versions false`,
    ).toHaveLength(1);
  });

  it("makes no claim about coverage, in either direction", () => {
    const zin = CATALOGUS.get(SLEUTEL)!.toLowerCase();

    // Version 2's defect: denying an inference the code makes valid is still a claim about coverage.
    expect(zin).not.toContain("gedekt");
    expect(zin).not.toContain("dekking");

    // **Dutch states coverage by ABSENCE at least as often as by the word `gedekt`** (antagonist round 4), and the
    // guard did not see that: "Er ontbreekt hier niets meer" is `gedekt === totaal` in words and passed every
    // assertion above. That is not a hypothetical phrasing — it is already a substring of `dekking.allesGedekt`, six
    // lines away in this same JSON object, so filling this slot from its neighbour is the likeliest route to a fourth
    // false version.
    expect(zin).not.toContain("ontbreek");
    expect(zin).not.toContain("volledig");
    expect(zin).not.toContain("compleet");
  });

  it("promises no reveal and blames no cause", () => {
    const zin = CATALOGUS.get(SLEUTEL)!.toLowerCase();

    // Version 1's two defects: a temporal promise ("dan zie je") and a causal tie between the emptiness and the
    // withheld figure ("zolang ... geen cijfer"). Rows are not hidden here and resolving cannot produce any.
    //
    // `zolang` and `cijfer` are banned INDEPENDENTLY, not as one pattern (antagonist round 4 corrected the comment
    // that said otherwise). `zolang` can only introduce that causal tie in this slot, so it costs nothing. `cijfer`
    // is mildly broader than the rule needs — it also forecloses a true sentence like "Dit overzicht geeft hier geen
    // cijfer" — and it is kept anyway, because that sentence would only repeat what `cijferIngehouden` already says
    // three lines above it on the same screen.
    expect(zin).not.toMatch(/\bdan zie je\b|\bverschijn/);
    expect(zin).not.toContain("zolang");
    expect(zin).not.toContain("cijfer");
  });
});

describe("nl.json — de exportuitleg belooft het volledige overzicht, niet het gefilterde", () => {
  /**
   * The one sentence in E5-06 that carries an owner ruling, so it gets a guard that reads the **value** rather than
   * the key (the E5-03 rule: a key-existence check cannot see a false sentence).
   *
   * The ruling of 2026-08-06 is that the export is always the full set in scope. The URL half of that is pinned in
   * `Dekkingexport.test.tsx`, which asserts the link carries no `doelsoort` and no `ontbrekend`. That test catches a
   * future story narrowing the document. **It cannot catch the opposite drift**, which is a future story leaving the
   * document alone and rewriting this sentence to promise the filtered view. On a screen with two live filters, a
   * teacher who reads "je krijgt wat je nu ziet" and opens a file with three times the rows has been told something
   * untrue by the control they used.
   *
   * **Two limits, stated rather than left to be rediscovered.** A keyword guard cannot see a paraphrase: *"dit is je
   * huidige lijst"* makes the same false promise and passes. And it cannot decide truth; it encodes a rule a human
   * derived once from the endpoint, which takes no filter parameter at all. The structural half is the URL test.
   */
  const SLEUTEL = "dekking.exportUitleg";

  it("still exists, so this guard cannot be silently disarmed by a rename", () => {
    expect(
      CATALOGUS.get(SLEUTEL),
      `${SLEUTEL} has been renamed or removed; this guard now checks nothing`,
    ).toBeDefined();
  });

  it("claims totality in some wording", () => {
    // The sentence's whole job. Not a fixed phrase, so a rewrite is free to say "allemaal" or "het volledige
    // overzicht" instead, but it may not quietly drop the claim and leave a label that promises nothing.
    expect(CATALOGUS.get(SLEUTEL)!.toLowerCase()).toMatch(/\balle\b|\ballemaal\b|\bvolledige?\b/);
  });

  it("does not promise the view the teacher is currently looking at", () => {
    const zin = CATALOGUS.get(SLEUTEL)!.toLowerCase();

    // The false versions this forecloses, all of which read naturally next to a download link and all of which the
    // endpoint contradicts: "wat je nu ziet", "deze selectie", "dit gefilterde overzicht", "de doelen hierboven".
    expect(zin).not.toMatch(/\bwat je (nu |hier )?ziet\b|\bdeze selectie\b|\bhierboven\b/);
    expect(zin).not.toMatch(/\bdit gefilterde\b|\bdeze lijst\b/);

    // Deliberately NOT banning the word "gefilterd" as such. The honest sentence has to be able to mention filtering
    // in order to say that filtering does not apply, and a guard broad enough to forbid "wat je hier ook filtert"
    // would cry wolf on the correct copy. A guard that fires on the right answer is one somebody deletes.
  });
});

describe("nl.json — de zin over het minimumdoelniveau blijft zeggen dat het er niet in zit", () => {
  /**
   * **Filed by the E5-06 antagonist as an asymmetry, and it is the cheaper half of a real gap.** E5-06 gave
   * `dekking.exportUitleg` a value-reading guard because it carries an owner ruling. The sentence beside it carries
   * something heavier: Art. V.2's honesty about the level the **onderwijsinspectie** actually tests, which does not
   * exist yet (E5-04, blocked on E1-12). That one was asserted only as `t(key)` in `Dekkingsoverzicht.test.tsx`, and
   * E5-03 proved a `t(key)` assertion cannot bite, because it moves with the catalogue: rewrite the value and the test
   * still passes.
   *
   * It now matters in two places rather than one. The export's kopblok carries the same sentence, composed
   * server-side, and `ClosedXmlDekkingExportTests` guards that half on substance. This is the browser half.
   *
   * **The limit, stated rather than left to be found:** like every keyword guard here it cannot see a paraphrase, and
   * it cannot decide truth. It encodes one rule a human derived from `DekkingService`, which computes nothing at
   * minimumdoel level: this screen must not let a reader conclude it does.
   */
  const SLEUTEL = "dekking.alleenLeerplandoelen";

  it("still exists, so this guard cannot be silently disarmed by a rename", () => {
    expect(
      CATALOGUS.get(SLEUTEL),
      `${SLEUTEL} has been renamed or removed; this guard now checks nothing`,
    ).toBeDefined();
  });

  it("names the minimumdoelen and says they are not in it", () => {
    const zin = CATALOGUS.get(SLEUTEL)!.toLowerCase();

    expect(zin).toContain("minimumdoelen");
    // The negation, in any of the wordings this sentence could reasonably take. Without it the sentence could be
    // rewritten into one that merely MENTIONS minimumdoelen, which is how a disclaimer becomes a claim.
    expect(zin).toMatch(/\bniet in\b|\bnog niet\b|\bzit er niet\b|\bontbreek/);
  });

  it("does not claim the overview covers that level", () => {
    const zin = CATALOGUS.get(SLEUTEL)!.toLowerCase();

    // The false versions: any promise that this screen reports minimumdoeldekking, in the present tense.
    expect(zin).not.toMatch(/\bdekking op minimumdoelniveau (staat|zit) (er)?in\b|\book de minimumdoelen\b/);
    expect(zin).not.toMatch(/\bvolledig\b|\bcompleet\b|\binspectieklaar\b/);
  });
});

describe("nl.json — een aria-label bevat het zichtbare label (WCAG 2.2 SC 2.5.3)", () => {
  /**
   * **Label in Name (Level A): the accessible name must contain the visible label**, or speech input cannot reach the
   * control — a user says what they see, and the browser matches what the name says.
   *
   * This guard exists because **axe cannot see it**: SC 2.5.3 is not machine-testable from the DOM alone, so E4-05's
   * browser pass reported "0 violations, 28 rules" while its new button was failing. The convention this codebase
   * already followed was to *append* (`plaatsToevoegen` "Thema toevoegen" → `plaatsToevoegenLabel` "Thema toevoegen aan
   * themaperiode {ordinaal}"); E4-05's first version *substituted* ("Deze periode opnieuw genereren…" → "Themaperiode 3
   * opnieuw genereren"), which is the failure. Pairs are found by the `<key>` / `<key>Label` naming this feature uses,
   * so a new control inherits the check by naming its keys the way its siblings do.
   *
   * A base string carrying its own placeholder is skipped: its rendered text is not the literal, so a literal
   * containment test would be meaningless rather than strict.
   */
  it("keeps every <key>Label a superset of its visible <key>", () => {
    const paren = [...CATALOGUS].filter(
      ([sleutel]) => sleutel.endsWith("Label") && CATALOGUS.has(sleutel.slice(0, -"Label".length)),
    );

    // Non-vacuity: renaming the convention away must fail here rather than silently switch the guard off.
    expect(paren.length).toBeGreaterThan(0);

    for (const [labelSleutel, label] of paren) {
      const zichtbaar = CATALOGUS.get(labelSleutel.slice(0, -"Label".length))!;
      if (zichtbaar.includes("{")) {
        continue;
      }

      // **Case-insensitive**, and that is the standard rather than a loosening: speech-input engines match the
      // spoken text case-insensitively, and this codebase's own convention puts the interpolation first
      // (`aanvaardenLabel` = "{thema} aanvaarden" over the visible "Aanvaarden"). A case-sensitive version of this
      // guard failed on that pair on its first run, i.e. it called the *good* precedent a violation.
      expect(
        label.toLowerCase(),
        `${labelSleutel} does not contain its own visible label "${zichtbaar}" (WCAG 2.2 SC 2.5.3)`,
      ).toContain(zichtbaar.toLowerCase());
    }
  });
});
