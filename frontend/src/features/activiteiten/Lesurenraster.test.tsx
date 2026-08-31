import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Lesurenraster, type GeplandMetKleur, type Hoekuur } from "./Lesurenraster";
import { t } from "../../i18n";
import type { Dagweergave } from "../../lib/types";

/**
 * What it means for a hoek to take a lesuur (owner ruling, 2026-08-31).
 *
 * Three of these are about an hour that holds a corner and nothing else, which is the case the ruling
 * changed: before it, such an hour still offered to be filled. The fourth is the one the demo data
 * cannot reach, and the one a browser pass would not have found either: a corner sitting in an hour
 * that a three-hour activiteit above it swallowed. That hour gets no cell in the content column, so
 * the corner has to be drawn by the covering cell or it is drawn nowhere at all, and "nowhere at all"
 * is exactly what shipped on 2026-08-30 under a comment saying otherwise.
 */
const activiteit = (volgorde: number, naam: string, lengte: number): GeplandMetKleur => ({
  plaatsingId: `p-${volgorde}`,
  activiteitId: `a-${volgorde}`,
  activiteitNaam: naam,
  activiteitType: "spel",
  subthemaId: "s1",
  subthemaNaam: "de speelhoek",
  themaId: "t1",
  themaNaam: "Ik en mijn klas",
  volgorde,
  status: "Aanvaard",
  kleur: null,
  doelcodes: [],
  valtBuitenThemaperiode: false,
  lengteInLesuren: lengte,
});

const dag = (activiteiten: GeplandMetKleur[] = []): Dagweergave => ({
  datum: "2026-09-01",
  isLesdag: true,
  sluitingsnaam: null,
  activiteiten,
});

const hoek = (slot: number, naam = "bouwhoek", plaatsingId = "hp-1"): Hoekuur => ({ plaatsingId, naam, slot });

const toon = (
  d: Dagweergave,
  hoeken: [number, Hoekuur[]][] = [],
  onOpenHoek: (plaatsingId: string) => void = () => {},
) =>
  render(
    <DndContext>
      <Lesurenraster
        dag={d}
        hoekenPerSlot={new Map(hoeken)}
        onVoegToe={() => {}}
        onOpen={() => {}}
        onOpenHoek={onOpenHoek}
      />
    </DndContext>,
  );

describe("Lesurenraster en hoekenwerk", () => {
  it("laat een leeg lesuur zich nog altijd aanbieden", () => {
    toon(dag());
    // Seven free hours, so the count is what proves none of them was taken by something invisible.
    expect(screen.getAllByText(t("lesuur.vrij"))).toHaveLength(7);
  });

  it("neemt het lesuur in waar een hoek staat, dus geen vrij lesuur meer", () => {
    toon(dag(), [[1, [hoek(1)]]]);
    expect(screen.getByText("bouwhoek")).toBeInTheDocument();
    expect(screen.getByText(t("lesuur.hoekenwerk"))).toBeInTheDocument();
    expect(screen.getAllByText(t("lesuur.vrij"))).toHaveLength(6);
  });

  it("opent de plaatsing wanneer de leerkracht de hoek aanklikt", () => {
    const geopend = vi.fn();
    toon(dag(), [[1, [hoek(1, "boekenhoek", "hp-9")]]], geopend);
    fireEvent.click(screen.getByRole("button", { name: /boekenhoek/ }));
    expect(geopend).toHaveBeenCalledWith("hp-9");
  });

  it("tekent een hoek die onder een blok van drie lesuren valt, en zegt in welk lesuur", () => {
    // The activiteit starts at lesuur 1 and runs three hours, so slots 1 and 2 have no cell of their
    // own. The corner sits in slot 2, which a teacher calls lesuur 3.
    toon(dag([activiteit(0, "kringgesprek", 3)]), [[2, [hoek(2)]]]);
    expect(screen.getByText("bouwhoek")).toBeInTheDocument();
    expect(screen.getByText(t("lesuur.hoekenwerkOp", { nummer: 3 }))).toBeInTheDocument();
    // Its own hour is not free either: it is covered, and a covered hour has never offered a plus.
    expect(screen.getAllByText(t("lesuur.vrij"))).toHaveLength(4);
  });
});
