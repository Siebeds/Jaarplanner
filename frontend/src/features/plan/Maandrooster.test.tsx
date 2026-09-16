import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { GeplandeActiviteit } from "../../lib/types";
import { Maandrooster } from "./Maandrooster";
import { CELHOOGTE } from "./maandcelhoogte";
import type { Agendadag } from "./roosterdagen";
import type { Subthemareeks } from "./subthemareeksen";
import type { Themavak } from "./themavakken";

/** The right-click menu on an activiteit in the month view (TB-030): the same menu a block of the time grid has. */

const KRING: GeplandeActiviteit = {
  plaatsingId: "p-kring",
  activiteitId: "a-kring",
  activiteitNaam: "kringgesprek",
  activiteitType: "spel",
  subthemaId: "s1",
  subthemaNaam: "de speelhoek",
  themaId: "t1",
  themaNaam: "Ik en mijn klas",
  begin: "09:00:00",
  einde: "09:50:00",
  status: "Manueel",
  kleur: null,
  doelcodes: [],
  valtBuitenThemaperiode: false,
};

const DINSDAG: Agendadag = {
  datum: "2026-09-08",
  isLesdag: true,
  sluitingsnaam: null,
  buitenSchooljaar: false,
  activiteiten: [KRING],
};

function toon(magPlannen: boolean) {
  const onOpen = vi.fn();
  const onVanDag = vi.fn();
  // The strips link to the themapagina (FB-037), so the month needs a router.
  render(
    <MemoryRouter>
      <DndContext>
        <Maandrooster
          dagen={[DINSDAG]}
          ankerMaand="2026-09-08"
          vakken={[]}
          reeksenPerDag={new Map()}
          magPlannen={magPlannen}
          onKiesDag={() => {}}
          onOpen={onOpen}
          onVanDag={onVanDag}
          onVoegToe={() => {}}
        />
      </DndContext>
    </MemoryRouter>,
  );
  return { onOpen, onVanDag, chip: screen.getByRole("button", { name: "kringgesprek" }) };
}

describe("Maandrooster, het rechtermuisklikmenu van een activiteit (TB-030)", () => {
  it("haalt de activiteit van haar dag, en bewerken opent haar blad", async () => {
    const { onOpen, onVanDag, chip } = toon(true);

    fireEvent.contextMenu(chip);
    fireEvent.click(screen.getByRole("menuitem", { name: t("blokmenu.vanDag") }));
    await vi.waitFor(() => expect(onVanDag).toHaveBeenCalledWith(KRING, "2026-09-08"));
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.contextMenu(chip);
    fireEvent.click(screen.getByRole("menuitem", { name: t("blokmenu.bewerk") }));
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith(KRING, "2026-09-08"));
  });

  it("geeft wie de klas alleen mag inkijken geen eigen menu", () => {
    const { chip } = toon(false);

    fireEvent.contextMenu(chip);

    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Maandrooster, de hoogte van een cel met stroken (FB-039)", () => {
  const leeg = (datum: string): Agendadag => ({ ...DINSDAG, datum, activiteiten: [] });
  const reeks = (naam: string): Subthemareeks => ({
    subthemaId: naam,
    subthemaNaam: naam,
    themaId: "t1",
    themaNaam: "Ik en mijn klas",
    van: "2026-09-07",
    tot: "2026-09-11",
    aantalDagen: 5,
  });
  const vak: Themavak = { plaatsingId: "p1", van: "2026-09-01", tot: "2026-09-11", themas: [{ id: "t1", naam: "Ik en mijn klas" }] };

  it("geeft elke cel van een rij de hoogte die de dag met de meeste stroken nodig heeft, zodat de activiteiten hun plaats houden", () => {
    // Week of 7 september: Monday carries the thema band and two subthema slots (three runs fold to one and a count),
    // Tuesday only the thema. The week of 14 september lies outside the period and carries nothing.
    const reeksen = new Map([["2026-09-07", [reeks("a"), reeks("b"), reeks("c")]]]);
    const { container } = render(
      <MemoryRouter>
        <DndContext>
          <Maandrooster
            dagen={[7, 8, 9, 10, 11, 12, 13, 14].map((d) => leeg("2026-09-" + String(d).padStart(2, "0")))}
            ankerMaand="2026-09-08"
            vakken={[vak]}
            reeksenPerDag={reeksen}
            magPlannen={false}
            onKiesDag={() => {}}
            onOpen={() => {}}
            onVanDag={() => {}}
            onVoegToe={() => {}}
          />
        </DndContext>
      </MemoryRouter>,
    );

    const cellen = [...container.querySelectorAll("li > div")];
    expect(cellen).toHaveLength(8);
    // 112 pixels plus what three 24 pixel slots take over three 16 pixel bands and their two 1 pixel gaps.
    expect(cellen[0]).toHaveClass(CELHOOGTE[3]);
    expect(CELHOOGTE[3]).toBe("sm:h-[134px]");
    expect(cellen[1]).toHaveClass(CELHOOGTE[3]);
    expect(cellen[6]).toHaveClass(CELHOOGTE[3]);
    expect(cellen[7]).toHaveClass("sm:h-28");
  });

  it("groeit per strook met precies wat de strook erbij kreeg", () => {
    // A band was 16 pixels with a 1 pixel gap between bands; a slot is 24. The chips keep the room they had.
    const px = (klasse: string) => (klasse === "sm:h-28" ? 112 : Number(/\[(\d+)px\]/.exec(klasse)?.[1]));
    CELHOOGTE.forEach((klasse, n) => {
      const vroeger = n === 0 ? 0 : 16 * n + (n - 1);
      expect(px(klasse) - 112).toBe(24 * n - vroeger);
    });
  });
});
