import { describe, expect, it } from "vitest";

import {
  PERIODELABEL,
  bepaalVerplaatsing,
  bouwRibbon,
  formatteerDatum,
  formatteerPeriode,
  formatteerWeken,
  plaatsingenIn,
  vervallenPlaatsingen,
} from "./kalenderFormat";
import { PLANNINGSBLOKNIVEAUS, leesNiveau } from "./types";
import type { Planningsblok, Planningsonderbreking, Themaplaatsing } from "./types";

/**
 * The arithmetic and ordering the ribbon's honesty rests on (E3-06). These are the claims the picture
 * makes about the school year, so they are tested without rendering: a wrong gap position or a dropped
 * stale placement is a lie about the plan, not a cosmetic bug.
 */

function blok(ordinaal: number, start: string, eind: string, aantalOpenDagen = 30): Planningsblok {
  return { ordinaal, start, eind, ouderOrdinaal: null, aantalOpenDagen };
}

function plaatsing(overrides: Partial<Themaplaatsing> & { id: string }): Themaplaatsing {
  return {
    themaId: "t",
    themaNaam: "Thema",
    blokNiveau: "Themaperiode",
    blokStart: "2026-09-01",
    blokEind: "2026-10-01",
    blokOrdinaal: 1,
    isVervallen: false,
    status: "Voorgesteld",
    aiMotivatie: null,
    vergrendeld: false,
    doelcodes: [],
    ...overrides,
  };
}

describe("formatteerDatum", () => {
  it("formats an ISO date as Dutch day + month without a trailing period", () => {
    expect(formatteerDatum("2026-09-01")).toBe("1 sep");
    expect(formatteerDatum("2026-12-20")).toBe("20 dec");
  });

  // NOTE: there is deliberately no test here for "does not shift across midnight". An earlier revision
  // had one, asserting `formatteerDatum("2026-09-01") === "1 sep"` — byte-identical to the assertion
  // above it. `new Date("2026-09-01")` parses as UTC midnight, which still formats as "1 sep" in both UTC
  // (CI) and Europe/Brussels (dev), so the test could not fail on either machine even if the
  // implementation regressed to the unsafe form. It only distinguishes the two west of Greenwich. A test
  // that cannot fail is worse than no test: it reports coverage it does not have. Pinning this properly
  // needs the process timezone set (e.g. TZ=America/New_York), which belongs in the vitest config rather
  // than in an assertion that quietly passes.

  it("formats a span", () => {
    expect(formatteerPeriode("2026-09-01", "2026-10-01")).toBe("1 sep – 1 okt");
  });
});

describe("formatteerWeken", () => {
  it("renders weeks to one decimal with a Dutch comma", () => {
    // 31 open days ÷ 7 = 4,4 — the approved wireframe's own figure for 1 sep – 1 okt.
    expect(formatteerWeken(31)).toBe("4,4");
    expect(formatteerWeken(42)).toBe("6,0");
  });
});

describe("bouwRibbon", () => {
  const herfst: Planningsonderbreking = {
    naam: "Herfstvakantie",
    start: "2026-11-02",
    eind: "2026-11-08",
  };

  it("places a vakantie between the two blocks it separates", () => {
    const segmenten = bouwRibbon(
      [blok(1, "2026-09-01", "2026-11-01"), blok(2, "2026-11-09", "2026-12-20")],
      [herfst],
    );

    expect(segmenten.map((s) => s.soort)).toEqual(["blok", "onderbreking", "blok"]);
    expect(segmenten[1]).toMatchObject({ onderbreking: { naam: "Herfstvakantie" } });
  });

  it("drops a vakantie at the edge of the year — a gap with no teaching time on one side", () => {
    const segmenten = bouwRibbon([blok(1, "2026-11-09", "2026-12-20")], [herfst]);

    expect(segmenten.map((s) => s.soort)).toEqual(["blok"]);
  });

  it("keeps blocks in order when there are no vakanties at all", () => {
    const segmenten = bouwRibbon(
      [blok(1, "2026-09-01", "2026-10-01"), blok(2, "2026-10-02", "2026-11-01")],
      [],
    );

    expect(segmenten).toHaveLength(2);
    expect(segmenten.every((s) => s.soort === "blok")).toBe(true);
  });
});

describe("plaatsingenIn", () => {
  it("matches a placement to its block on the start date, not the ordinal", () => {
    const eerste = blok(1, "2026-09-01", "2026-10-01");
    const tweede = blok(2, "2026-10-02", "2026-11-01");
    const plaatsingen = [
      plaatsing({ id: "a", blokStart: "2026-09-01" }),
      plaatsing({ id: "b", blokStart: "2026-10-02" }),
    ];

    expect(plaatsingenIn(plaatsingen, eerste).map((p) => p.id)).toEqual(["a"]);
    expect(plaatsingenIn(plaatsingen, tweede).map((p) => p.id)).toEqual(["b"]);
  });

  it("never puts a stale placement in a block", () => {
    const eerste = blok(1, "2026-09-01", "2026-10-01");
    const plaatsingen = [plaatsing({ id: "a", blokStart: "2026-09-01", isVervallen: true })];

    expect(plaatsingenIn(plaatsingen, eerste)).toEqual([]);
  });
});

describe("vervallenPlaatsingen", () => {
  const blokken = [blok(1, "2026-09-01", "2026-10-01")];

  it("collects a placement the server flagged as stale", () => {
    const plaatsingen = [plaatsing({ id: "a", blokStart: "2026-09-01", isVervallen: true })];

    expect(vervallenPlaatsingen(plaatsingen, blokken).map((p) => p.id)).toEqual(["a"]);
  });

  it("also collects one whose date matches no block, even if the server did not flag it", () => {
    // Otherwise a disagreement between the two views would make a thema vanish from the plan
    // entirely — worse than showing it as needing attention (directie 2026-07-28).
    const plaatsingen = [plaatsing({ id: "a", blokStart: "2026-10-05", isVervallen: false })];

    expect(vervallenPlaatsingen(plaatsingen, blokken).map((p) => p.id)).toEqual(["a"]);
  });

  it("leaves a healthy placement alone", () => {
    const plaatsingen = [plaatsing({ id: "a", blokStart: "2026-09-01" })];

    expect(vervallenPlaatsingen(plaatsingen, blokken)).toEqual([]);
  });

  it("accounts for every placement exactly once, across blocks and the stale list", () => {
    const plaatsingen = [
      plaatsing({ id: "gezond", blokStart: "2026-09-01" }),
      plaatsing({ id: "ziek", blokStart: "2027-01-01" }),
    ];

    const inBlokken = blokken.flatMap((b) => plaatsingenIn(plaatsingen, b));
    const vervallen = vervallenPlaatsingen(plaatsingen, blokken);

    expect([...inBlokken, ...vervallen].map((p) => p.id).sort()).toEqual(["gezond", "ziek"]);
  });
});

describe("bepaalVerplaatsing (E3-07 — what a drop does)", () => {
  // The gesture cannot be simulated in jsdom (zero-sized rects, and dnd-kit resolves drops by measuring
  // them), but this decides what a drop DOES, and that is plain logic. Left untested in the first pass and
  // flagged by the antagonist audit: the "nothing is guessed" guarantee had no assertion behind it.

  it("moves the placement to the block it was released over", () => {
    expect(bepaalVerplaatsing(plaatsing({ id: "a", blokStart: "2026-09-01" }), "2026-11-09")).toBe(
      "2026-11-09",
    );
  });

  it("changes nothing when released over no period, and never guesses one", () => {
    // Clause 1 of the directie ruling: the application does not pick a period on the teacher's behalf.
    expect(bepaalVerplaatsing(plaatsing({ id: "a" }), undefined)).toBeNull();
  });

  it("changes nothing when a draggable carries no placement", () => {
    expect(bepaalVerplaatsing(undefined, "2026-11-09")).toBeNull();
  });

  it("changes nothing when dropped back where it started", () => {
    // Otherwise a no-op gesture would cost a standing AI proposal its Voorgesteld status and its motivation.
    expect(bepaalVerplaatsing(plaatsing({ id: "a", blokStart: "2026-09-01" }), "2026-09-01")).toBeNull();
  });

  it("refuses to move a rejected placement", () => {
    // Moving it would convert Geweigerd to Manueel and hand the thema dekking it must not have (Art. V.1).
    expect(
      bepaalVerplaatsing(
        plaatsing({ id: "a", blokStart: "2026-09-01", status: "Geweigerd" }),
        "2026-11-09",
      ),
    ).toBeNull();
  });

  it("moves a STALE placement, which is the re-placement route the ruling requires", () => {
    // Nothing validates where the placement currently sits — only where it is going.
    expect(
      bepaalVerplaatsing(
        plaatsing({ id: "a", blokStart: "2026-12-01", blokOrdinaal: null, isVervallen: true }),
        "2026-11-09",
      ),
    ).toBe("2026-11-09");
  });
});

/**
 * The tier seam (E3-08 fix round 4, antagonist MINOR-4b). Tested here rather than in a file of its own: `types.ts`
 * is otherwise wire types with no behaviour, and this is the feature's home for helpers that can be checked without
 * rendering. What the compiler now guarantees — that a third `Planningsblokniveau` cannot be added without deciding
 * what every tier-dependent table says about it — is by definition not testable at runtime; what *is* testable is that
 * this reader accepts exactly the tiers the union declares and nothing else.
 */
describe("leesNiveau", () => {
  it("reads back every tier the app declares", () => {
    // Non-vacuity: the loop below proves nothing over an empty list, and the list is derived rather than written out.
    expect(PLANNINGSBLOKNIVEAUS.length).toBeGreaterThan(1);

    for (const niveau of PLANNINGSBLOKNIVEAUS) {
      expect(leesNiveau(niveau)).toBe(niveau);
    }
  });

  it("refuses a tier it does not know, including one borrowed from Object's prototype", () => {
    // The `Kwartaal` case is the one the browser pass had to fake with a rewriting proxy, because the controller 400s
    // on an unknown `?niveau=`. It must land on null, which is what routes the board to its own copy.
    expect(leesNiveau("Kwartaal")).toBeNull();
    expect(leesNiveau("")).toBeNull();
    // `"constructor" in tabel` is true through the prototype chain, so a membership test written that way would let
    // this pass as a tier and label the board after it.
    expect(leesNiveau("constructor")).toBeNull();
    expect(leesNiveau("toString")).toBeNull();
  });

  it("names one block per tier, and never the same word twice", () => {
    // The strip's sr-only ordinal and the board column's heading read this one table (`PERIODELABEL`), so they cannot
    // come to call one block by two names — the defect the E3-02/E3-06 review repaired twice.
    const labels = PLANNINGSBLOKNIVEAUS.map((niveau) => PERIODELABEL[niveau]);

    expect(labels).toHaveLength(PLANNINGSBLOKNIVEAUS.length);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
