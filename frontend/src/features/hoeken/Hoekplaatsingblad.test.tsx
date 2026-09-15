import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Hoekplaatsingblad } from "./Hoekplaatsingblad";
import type { HoekplaatsingWeergave } from "./gegevens";
import { t } from "../../i18n";
import { periode, volleDag } from "../../lib/datum";

/**
 * What this corner already runs, in the sheet where she plans it (owner, 2026-09-10).
 *
 * The runs used to hang under the fiche in the hoekenpaneel. They moved here, and with them the only
 * route back to a run that takes no lesuur, so the row opening its run is pinned as hard as the row
 * being there.
 */
const reeks = (id: string, van: string, tot: string): HoekplaatsingWeergave => ({
  id,
  hoekId: "h-1",
  hoekNaam: "bouwhoek",
  van,
  tot,
  momenten: [],
});

const toon = (ingepland: HoekplaatsingWeergave[], onOpenPlaatsing: (id: string) => void = () => {}) =>
  render(
    <Hoekplaatsingblad
      open
      hoekNaam="bouwhoek"
      hoekId="h-1"
      startdag="2026-09-07"
      loopt={[]}
      ingepland={ingepland}
      schooljaarVan="2026-09-01"
      schooljaarTot="2027-06-30"
      bezig={false}
      onPlaats={() => {}}
      onOpenPlaatsing={onOpenPlaatsing}
      onSluit={() => {}}
    />,
  );

describe("Hoekplaatsingblad: wat al ingepland is", () => {
  it("toont de periodes van deze hoek in kalendervolgorde, en opent er een", () => {
    const geopend = vi.fn();
    // Out of order on purpose: the server's order is not the reading order.
    toon([reeks("hp-2", "2026-10-05", "2026-10-16"), reeks("hp-1", "2026-09-01", "2026-09-04")], geopend);

    const lijst = screen.getByRole("list", { name: t("hoekplaatsing.alIngepland") });
    const rijen = within(lijst).getAllByRole("button");
    expect(rijen.map((rij) => rij.textContent)).toEqual([
      periode("2026-09-01", "2026-09-04"),
      periode("2026-10-05", "2026-10-16"),
    ]);

    fireEvent.click(rijen[1]);
    expect(geopend).toHaveBeenCalledWith("hp-2");
  });

  it("zegt niets over ingepland wanneer de hoek nog nergens loopt", () => {
    toon([]);
    expect(screen.queryByText(t("hoekplaatsing.alIngepland"))).not.toBeInTheDocument();
  });

  it("zegt in de kalender, ook in woorden, op welke dagen de hoek al loopt", () => {
    toon([reeks("hp-1", "2026-09-01", "2026-09-04")]);
    expect(
      screen.getByRole("button", { name: `${volleDag("2026-09-02")}, ${t("periodekiezer.alIngepland")}` }),
    ).toBeInTheDocument();
    // The day after the run is an ordinary day again.
    expect(screen.getByRole("button", { name: volleDag("2026-09-07") })).toBeInTheDocument();
  });
});
