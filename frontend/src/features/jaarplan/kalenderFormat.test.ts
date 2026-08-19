import { describe, expect, it } from "vitest";

import {
  PERIODELABEL,
  belastingPerStart,
  benodigdeWekenNa,
  bepaalVerplaatsing,
  bouwRibbon,
  formatteerDatum,
  formatteerPeriode,
  wekenInBlok,
  isTeVolMet,
  plaatsingenIn,
  plaatsingssignatuur,
  vervallenPlaatsingen,
} from "./kalenderFormat";
import { PLANNINGSBLOKNIVEAUS, leesNiveau } from "./types";
import type {
  Blokspreiding,
  Planningsblok,
  Planningsonderbreking,
  Themaplaatsing,
} from "./types";

/**
 * The arithmetic and ordering the ribbon's honesty rests on (E3-06). These are the claims the picture
 * makes about the school year, so they are tested without rendering: a wrong gap position or a dropped
 * stale placement is a lie about the plan, not a cosmetic bug.
 */

function blok(ordinaal: number, start: string, eind: string, aantalOpenDagen = 30): Planningsblok {
  // `aantalOpenWeekdagen` is derived here rather than parameterised: no test in this file asserts on it, and a second
  // knob would invite a fixture where the two counts contradict each other — 30 open days can never be 30 school days.
  return {
    ordinaal,
    start,
    eind,
    ouderOrdinaal: null,
    aantalOpenDagen,
    aantalOpenWeekdagen: Math.round((aantalOpenDagen * 5) / 7),
  };
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
    duurWeken: 4,
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

describe("wekenInBlok", () => {
  it("rounds up to whole weeks, so the heading and the te-vol rule state one length", () => {
    // Exact multiples are unchanged.
    expect(wekenInBlok(42)).toBe(6);

    // 31 open days is 4,4 weeks, the approved wireframe's own figure for 1 sep – 1 okt. It now reads 5, because the
    // te-vol comparison it sits above rounds the same way (owner ruling 2026-08-04). The precise figure survives as
    // the spine's segment WIDTH, which is still sized on exact open days.
    expect(wekenInBlok(31)).toBe(5);

    // The case the rounding exists for: a 6-week period losing a vrije dag must still offer 6, or te vol would fire
    // on the commonest Flemish school calendar there is.
    expect(wekenInBlok(41)).toBe(6);
  });

  it("never reports a fractional or zero-week period as one week", () => {
    // The short block a long mid-year closure can leave behind. Reaching 1 is what makes "1 weken" possible, which is
    // why the heading renders through tAantal.
    expect(wekenInBlok(7)).toBe(1);
    expect(wekenInBlok(1)).toBe(1);
  });
});

describe("te vol (E3-09, FR-6.4)", () => {
  /**
   * The load payload as the server sends it. `isOverbelast` is written by hand here rather than derived from the two
   * week figures, and that is the whole point of the mirror test below: deriving it would compare
   * `benodigde > beschikbare` against itself and pass no matter what either side did.
   */
  function belasting(
    start: string,
    benodigdeWeken: number,
    beschikbareWeken: number,
    isOverbelast: boolean,
  ): Blokspreiding {
    return {
      ordinaal: 1,
      start,
      aantalThemas: 1,
      aantalDoelen: 0,
      benodigdeWeken,
      beschikbareWeken,
      isOverbelast,
    };
  }

  it("indexes the server's measurement by block start, not by ordinal", () => {
    const kaart = belastingPerStart([
      belasting("2026-09-01", 4, 9, false),
      belasting("2026-11-09", 12, 6, true),
    ]);

    expect(kaart.get("2026-11-09")?.isOverbelast).toBe(true);
    // A date that is no period's start: a stale placement's own key. The caller must get nothing rather than a
    // neighbouring period's figures.
    expect(kaart.get("2026-12-01")).toBeUndefined();
  });

  it("reproduces the server's own verdict, so the drag preview cannot contradict the flag", () => {
    // Hand-written verdicts, including the two boundary cases the ruling turns on: needing exactly as many weeks as
    // the period offers is NOT te vol, one more week is.
    const gevallen = [
      belasting("2026-09-01", 4, 9, false),
      belasting("2026-09-02", 6, 6, false),
      belasting("2026-09-03", 7, 6, true),
      belasting("2026-09-04", 18, 6, true),
      belasting("2026-09-05", 0, 6, false),
    ];

    for (const geval of gevallen) {
      expect(
        isTeVolMet(geval.beschikbareWeken, geval.benodigdeWeken),
        `${geval.benodigdeWeken} weken in ${geval.beschikbareWeken}`,
      ).toBe(geval.isOverbelast);
    }
  });

  it("adds the dragged thema's own weeks, not one", () => {
    const doel = belasting("2026-09-01", 4, 6, false);

    // Two weeks fits: 4 + 2 = 6, which is exactly the period and therefore not te vol.
    expect(benodigdeWekenNa(doel, 2)).toBe(6);
    expect(isTeVolMet(doel.beschikbareWeken, benodigdeWekenNa(doel, 2)!)).toBe(false);

    // A six-week thema does not, and this is the case a count of thema's could never see: "one more thema" would
    // have promised room in both.
    expect(benodigdeWekenNa(doel, 6)).toBe(10);
    expect(isTeVolMet(doel.beschikbareWeken, benodigdeWekenNa(doel, 6)!)).toBe(true);
  });

  it("predicts nothing for a target it has no measurement for", () => {
    expect(benodigdeWekenNa(undefined, 5)).toBeUndefined();
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

/**
 * The signature the generation panel decides staleness with (E3-03).
 *
 * **Every one of these is a defect that shipped, not a hypothetical.** The function's whole job is to answer "do
 * this run's numbers still describe the plan on screen", and each field it was once blind to produced a panel
 * asserting figures over a plan that had moved on. So the tests are written per field, and each one changes exactly
 * that field: a signature that ignores a field looks identical to a correct one until you vary it alone.
 */
describe("plaatsingssignatuur", () => {
  it("changes when a placement moves to another period, even when it was ALREADY Manueel", () => {
    // Antagonist round 3's MAJOR. The comment here used to argue `blokStart` was redundant because a move sets the
    // status to `Manueel` — true only for a placement that was not already `Manueel`. A kept hand placement (what
    // `aantalBehouden` preserves across a run, and what E4-03 creates) moves without changing status, so the panel
    // went on printing "Te vol: themaperiode 2" over a board where that period had just been emptied.
    const voor = [plaatsing({ id: "p1", status: "Manueel", blokStart: "2026-09-01" })];
    const na = [plaatsing({ id: "p1", status: "Manueel", blokStart: "2026-11-02" })];

    expect(plaatsingssignatuur(voor)).not.toBe(plaatsingssignatuur(na));
  });

  it("changes when a proposal is accepted", () => {
    const voor = [plaatsing({ id: "p1", status: "Voorgesteld" })];
    const na = [plaatsing({ id: "p1", status: "Aanvaard" })];

    expect(plaatsingssignatuur(voor)).not.toBe(plaatsingssignatuur(na));
  });

  it("changes when a placement stops being stale", () => {
    const voor = [plaatsing({ id: "p1", isVervallen: true })];
    const na = [plaatsing({ id: "p1", isVervallen: false })];

    expect(plaatsingssignatuur(voor)).not.toBe(plaatsingssignatuur(na));
  });

  it("changes when the thema starts carrying another doel", () => {
    // Accepting a doelsuggestie on `/themas`, or a colleague doing it in another tab, moves the coverage figure
    // while id, status, position and staleness all stay put (antagonist round 2).
    const voor = [plaatsing({ id: "p1", doelcodes: ["A1"] })];
    const na = [plaatsing({ id: "p1", doelcodes: ["A1", "B2"] })];

    expect(plaatsingssignatuur(voor)).not.toBe(plaatsingssignatuur(na));
  });

  it("is stable under reordering and under doelcode order, so an edit that changed nothing does not blank a figure", () => {
    const een = [
      plaatsing({ id: "p1", doelcodes: ["B2", "A1"] }),
      plaatsing({ id: "p2", blokStart: "2026-11-02" }),
    ];
    const ander = [
      plaatsing({ id: "p2", blokStart: "2026-11-02" }),
      plaatsing({ id: "p1", doelcodes: ["A1", "B2"] }),
    ];

    expect(plaatsingssignatuur(een)).toBe(plaatsingssignatuur(ander));
  });

  it("changes when a placement is removed altogether", () => {
    const voor = [plaatsing({ id: "p1" }), plaatsing({ id: "p2" })];
    const na = [plaatsing({ id: "p1" })];

    expect(plaatsingssignatuur(voor)).not.toBe(plaatsingssignatuur(na));
  });
});
