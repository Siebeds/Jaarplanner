import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Algemeneficheplaatsingblad } from "./Algemeneficheplaatsingblad";
import type { AlgemeneFicheplaatsingInvoer, AlgemeneFicheplaatsingWeergave } from "./gegevens";
import { t } from "../../i18n";
import { volleDag } from "../../lib/datum";

/**
 * Planning an algemene fiche: "elke maandag turnen op dit uur" (teachers' feedback, 2026-09-11).
 *
 * What is pinned is what the one gesture means: the day she dropped on is the start and its weekday the first day
 * switched on, and the sheet sends period, weekdays and hours together in the shape the server's
 * `AlgemeneFicheplaatsingInvoer` reads.
 */
const toon = (
  opties: {
    startdag?: string;
    startuur?: number | null;
    ingepland?: AlgemeneFicheplaatsingWeergave[];
    onPlaats?: (invoer: AlgemeneFicheplaatsingInvoer) => void;
  } = {},
) =>
  render(
    <Algemeneficheplaatsingblad
      open
      ficheNaam="turnen"
      ficheId="f-1"
      // 7 september 2026 is a Monday.
      startdag={opties.startdag ?? "2026-09-07"}
      startuur={opties.startuur ?? null}
      loopt={[]}
      ingepland={opties.ingepland ?? []}
      schooljaarVan="2026-09-01"
      schooljaarTot="2027-06-30"
      bezig={false}
      onPlaats={opties.onPlaats ?? (() => {})}
      onOpenPlaatsing={() => {}}
      onSluit={() => {}}
    />,
  );

// The sheet's submit button sits in the portalled footer and reaches the form through its `form` attribute; submitting
// the form itself is what that button does.
const verstuur = () => fireEvent.submit(document.querySelector("form")!);

describe("Algemeneficheplaatsingblad", () => {
  it("zet de weekdag van de dag waarop de fiche viel al aan, en geen andere", () => {
    toon();
    expect(screen.getByRole("button", { name: "maandag" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "dinsdag" })).toHaveAttribute("aria-pressed", "false");
    // Weekends are not offered at all: the server refuses them.
    expect(screen.queryByRole("button", { name: "zaterdag" })).not.toBeInTheDocument();
  });

  it("stuurt periode, weekdagen en uren samen", () => {
    const geplaatst = vi.fn();
    toon({ onPlaats: geplaatst });

    fireEvent.click(screen.getByRole("button", { name: "donderdag" }));
    fireEvent.click(screen.getByRole("button", { name: t("ficheplaatsing.totEindeSchooljaar") }));
    verstuur();

    expect(geplaatst).toHaveBeenCalledWith({
      algemeneFicheId: "f-1",
      van: "2026-09-07",
      tot: "2027-06-30",
      weekdagen: [1, 4],
      begin: "08:30:00",
      einde: "09:20:00",
    });
  });

  it("neemt het uur over waarop de fiche in het raster viel", () => {
    toon({ startuur: 13 * 60 + 30 });
    expect(screen.getByLabelText(t("ficheplaatsing.van"))).toHaveValue("13:30");
    expect(screen.getByLabelText(t("ficheplaatsing.tot"))).toHaveValue("14:20");
  });

  it("zegt beide ontbrekende keuzes tegelijk en stuurt niets", () => {
    const geplaatst = vi.fn();
    // A Saturday: no weekday to switch on, and no end chosen yet.
    toon({ startdag: "2026-09-12", onPlaats: geplaatst });

    expect(screen.getByRole("button", { name: "maandag" })).toHaveAttribute("aria-pressed", "false");
    verstuur();

    expect(screen.getByText(t("ficheplaatsing.einddagVerplicht"))).toBeInTheDocument();
    expect(screen.getByText(t("ficheplaatsing.weekdagVerplicht"))).toBeInTheDocument();
    expect(geplaatst).not.toHaveBeenCalled();
  });

  it("zegt in de kalender in woorden op welke dagen de fiche al staat, in haar eigen woorden", () => {
    toon({
      ingepland: [
        { id: "p-1", algemeneFicheId: "f-1", ficheNaam: "turnen", van: "2026-09-01", tot: "2026-09-04", momenten: [] },
      ],
    });

    expect(
      screen.getByRole("button", { name: `${volleDag("2026-09-02")}, ${t("ficheplaatsing.kalenderAlIngepland")}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: t("ficheplaatsing.alIngepland") })).toBeInTheDocument();
  });
});
