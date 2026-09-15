import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import type { GeplandeActiviteit } from "../../lib/types";
import { Maandrooster } from "./Maandrooster";
import type { Agendadag } from "./roosterdagen";

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
          hoekplaatsingen={[]}
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
