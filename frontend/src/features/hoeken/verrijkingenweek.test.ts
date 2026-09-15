import { describe, expect, it } from "vitest";
import { reeksenVanWeek, reeksSleutel, verrijkingVan } from "./verrijkingenweek";
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
