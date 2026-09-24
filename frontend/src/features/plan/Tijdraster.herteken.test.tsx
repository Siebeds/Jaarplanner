import { DndContext } from "@dnd-kit/core";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tijdraster } from "./Tijdraster";
import type { Agendadag } from "./roosterdagen";
import type { GeplandeActiviteit } from "../../lib/types";
import { kolommen, toonTijd } from "./tijd";

// The overlap layout, counted: a pass-through spy, so the grid draws exactly what it drew before.
vi.mock("./tijd", async (echt) => {
  const module = await echt<typeof import("./tijd")>();
  return { ...module, kolommen: vi.fn(module.kolommen) };
});

/**
 * What the minute clock re-renders (TB-071). It ticks in the grid itself, so every column renders again each minute;
 * what must not happen again is the overlap layout of a column whose blocks did not change.
 */
const activiteit = (naam: string, begin: string, einde: string): GeplandeActiviteit => ({
  plaatsingId: `p-${naam}`,
  activiteitId: `a-${naam}`,
  activiteitNaam: naam,
  activiteitType: "spel",
  subthemaId: "s1",
  subthemaNaam: "de speelhoek",
  themaId: "t1",
  themaNaam: "Ik en mijn klas",
  begin,
  einde,
  status: "Manueel",
  kleur: null,
  doelcodes: [],
  valtBuitenThemaperiode: false,
});

const dag = (datum: string, activiteiten: GeplandeActiviteit[]): Agendadag => ({
  datum,
  isLesdag: true,
  sluitingsnaam: null,
  buitenSchooljaar: false,
  activiteiten,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 8, 8, 9, 7));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Tijdraster en de minuutklok (TB-071)", () => {
  it("rekent de overlap-indeling van geen enkele kolom opnieuw uit als alleen de klok tikt, en de nu-lijn gaat mee", () => {
    const dagen = [
      dag("2026-09-08", [activiteit("kring", "09:00:00", "10:00:00"), activiteit("verven", "09:30:00", "10:30:00")]),
      dag("2026-09-09", [activiteit("turnen", "13:00:00", "14:00:00")]),
      dag("2026-09-10", []),
    ];
    render(
      <MemoryRouter>
        <DndContext>
          <Tijdraster
            dagen={dagen}
            fichemomenten={[]}
            reeksenPerDag={new Map()}
            vakken={[]}
            schooluren={undefined}
            magPlannen
            onVoegToe={() => {}}
            onOpen={() => {}}
            onOpenFiche={() => {}}
            onVanDag={() => {}}
            onWijzigTijd={() => {}}
          />
        </DndContext>
      </MemoryRouter>,
    );
    expect(screen.getByText(toonTijd(9 * 60 + 7))).toBeInTheDocument();
    const indelingen = vi.mocked(kolommen).mock.calls.length;
    expect(indelingen).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText(toonTijd(9 * 60 + 8))).toBeInTheDocument();
    expect(vi.mocked(kolommen).mock.calls.length).toBe(indelingen);
  });
});
