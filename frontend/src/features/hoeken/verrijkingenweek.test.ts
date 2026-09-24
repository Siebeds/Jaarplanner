import { describe, expect, it } from "vitest";
import { aantalVerrijkt, reeksenVanWeek, reeksSleutel, verrijkingVan, volgendeReeks } from "./verrijkingenweek";
import type { SubthemaperiodeVerrijkingen } from "./gegevens";
import type { Subthemareeks } from "../plan/subthemareeksen";

/** The week the side panel's hoeken speak about (FB-038): which runs touch it, and which window each one writes to. */
const reeks = (subthemaId: string, van: string, tot: string, periodeId?: string): Subthemareeks => ({
  subthemaId,
  subthemaNaam: subthemaId,
  themaId: "t-1",
  themaNaam: "Seizoenen",
  van,
  tot,
  aantalDagen: 2,
  periodeId,
});

const venster = (subthemaperiodeId: string, subthemaId: string, van: string, tot: string): SubthemaperiodeVerrijkingen => ({
  subthemaperiodeId,
  subthemaId,
  subthemaNaam: subthemaId,
  van,
  tot,
  verrijkingen: [{ id: `v-${subthemaperiodeId}`, hoekId: "h-1", tekst: `tekst ${subthemaperiodeId}` }],
});

describe("reeksenVanWeek", () => {
  it("houdt alleen de reeksen die de week van maandag tot zondag raken", () => {
    const reeksen = [
      reeks("voor", "2026-09-01", "2026-09-11"),
      reeks("tot-maandag", "2026-09-07", "2026-09-14"),
      reeks("vanaf-zondag", "2026-09-20", "2026-10-02"),
      reeks("na", "2026-09-21", "2026-10-02"),
    ];

    expect(reeksenVanWeek(reeksen, [], "2026-09-14").map((r) => r.subthemaId)).toEqual(["tot-maandag", "vanaf-zondag"]);
  });

  it("geeft een reeks zonder venster het opgeslagen venster van hetzelfde subthema dat dagen met haar deelt", () => {
    const periodes = [venster("p-vorige", "s-1", "2026-09-07", "2026-09-15"), venster("p-ander", "s-2", "2026-09-14", "2026-09-18")];

    const [uit] = reeksenVanWeek([reeks("s-1", "2026-09-15", "2026-09-25")], periodes, "2026-09-14");

    // Not "p-ander": a window of another subthema is never borrowed.
    expect(uit.periodeId).toBe("p-vorige");
  });

  it("laat een reeks met een eigen venster en een reeks zonder overlappend venster zoals ze zijn", () => {
    const eigen = reeks("s-1", "2026-09-14", "2026-09-25", "p-eigen");
    const zonder = reeks("s-3", "2026-09-14", "2026-09-25");

    expect(reeksenVanWeek([eigen, zonder], [venster("p-vroeg", "s-3", "2026-09-01", "2026-09-11")], "2026-09-14")).toEqual([
      eigen,
      zonder,
    ]);
  });
});

describe("verrijkingVan", () => {
  it("leest de tekst van de hoek in het venster van de reeks, en niets voor een reeks zonder venster", () => {
    const periodes = [venster("p-1", "s-1", "2026-09-14", "2026-09-25")];

    expect(verrijkingVan(periodes, reeks("s-1", "2026-09-14", "2026-09-25", "p-1"), "h-1")).toBe("tekst p-1");
    expect(verrijkingVan(periodes, reeks("s-1", "2026-09-14", "2026-09-25", "p-1"), "h-2")).toBeUndefined();
    expect(verrijkingVan(periodes, reeks("s-1", "2026-09-14", "2026-09-25"), "h-1")).toBeUndefined();
  });

  it("sleutelt een reeks op haar subthema en haar eerste dag", () => {
    expect(reeksSleutel(reeks("s-1", "2026-09-14", "2026-09-25"))).toBe("s-1-2026-09-14");
  });
});

describe("volgendeReeks (FB-098)", () => {
  const MAANDAG = "2026-09-14";

  it("kiest de eerste reeks die na de week begint, ook een die de agenda al tekent", () => {
    const reeksen = [
      reeks("nu", "2026-09-14", "2026-09-25", "p-nu"),
      reeks("later", "2026-10-12", "2026-10-23", "p-later"),
      reeks("hierna", "2026-09-28", "2026-10-09", "p-hierna"),
    ];

    expect(volgendeReeks(reeksen, [], [], MAANDAG)?.subthemaId).toBe("hierna");
  });

  it("kijkt verder in de opgeslagen vensters van later in het jaar, wanneer de agenda erna niets tekent", () => {
    const later = [venster("p-nov", "s-nov", "2026-11-02", "2026-11-13"), venster("p-okt", "s-okt", "2026-10-05", "2026-10-16")];

    expect(volgendeReeks([reeks("nu", "2026-09-14", "2026-09-25")], later, later, MAANDAG)).toEqual({
      subthemaId: "s-okt",
      subthemaNaam: "s-okt",
      van: "2026-10-05",
      tot: "2026-10-16",
      periodeId: "p-okt",
    });
  });

  it("telt een venster dat dagen deelt met een reeks van hetzelfde subthema niet als tweede kandidaat", () => {
    const reeksen = [reeks("s-1", "2026-09-28", "2026-10-09")];
    const later = [venster("p-1", "s-1", "2026-10-01", "2026-10-09")];

    // The run itself, with the window a save writes to.
    expect(volgendeReeks(reeksen, later, later, MAANDAG)).toMatchObject({ subthemaId: "s-1", van: "2026-09-28", periodeId: "p-1" });
  });

  it("geeft niets wanneer na de week niets gepland is, ook niet wat in de week zelf begint", () => {
    expect(volgendeReeks([reeks("nu", "2026-09-16", "2026-09-30")], [], [], MAANDAG)).toBeNull();
  });
});

describe("aantalVerrijkt (FB-098)", () => {
  it("telt de hoeken met een niet-lege verrijking in het venster van de reeks", () => {
    const periodes: SubthemaperiodeVerrijkingen[] = [
      {
        ...venster("p-1", "s-1", "2026-09-14", "2026-09-25"),
        verrijkingen: [
          { id: "v-1", hoekId: "h-1", tekst: "kastanjes" },
          { id: "v-2", hoekId: "h-2", tekst: "  " },
          { id: "v-3", hoekId: "h-weg", tekst: "van een hoek die er niet meer is" },
        ],
      },
    ];

    expect(aantalVerrijkt(periodes, reeks("s-1", "2026-09-14", "2026-09-25", "p-1"), ["h-1", "h-2", "h-3"])).toBe(1);
    expect(aantalVerrijkt(periodes, reeks("s-1", "2026-09-14", "2026-09-25"), ["h-1"])).toBe(0);
  });
});
