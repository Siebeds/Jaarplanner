import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Planningsblok, Themaplaatsing } from "../../lib/types";
import { t } from "../../i18n";
import { Plaatsingkaart } from "./Plaatsingkaart";

/**
 * A placement for a gebruiker who may plan this klas, and for one who may only read it (E6-02, ADR-0030 §3, R7).
 * The reader's card keeps the one fact the lock switch otherwise carries: whether it is locked.
 */

const PLAATSING: Themaplaatsing = {
  id: "p-1",
  themaId: "t-1",
  themaNaam: "Herfst",
  blokNiveau: "Themaperiode",
  blokStart: "2026-09-01",
  blokEind: "2026-10-01",
  blokOrdinaal: 1,
  isVervallen: false,
  status: "Voorgesteld",
  aiMotivatie: "Past bij september.",
  vergrendeld: true,
  doelcodes: [],
  duurWeken: 4,
};

const BLOKKEN: Planningsblok[] = [
  { ordinaal: 1, start: "2026-09-01", eind: "2026-10-01", ouderOrdinaal: null, aantalOpenDagen: 20 },
];

function toon(magBewerken: boolean) {
  render(
    <Plaatsingkaart
      plaatsing={PLAATSING}
      blokken={BLOKKEN}
      magBewerken={magBewerken}
      bezig={false}
      onBeoordeel={vi.fn()}
      onVergrendel={vi.fn()}
      onVerplaats={vi.fn()}
      onVerwijder={vi.fn()}
    />,
  );
}

describe("Plaatsingkaart", () => {
  it("toont wie deze klas niet mag plannen de plaatsing zonder één knop, en dat ze vergrendeld is", () => {
    toon(false);

    expect(screen.getByText("Herfst")).toBeInTheDocument();
    expect(screen.getByText("Past bij september.")).toBeInTheDocument();
    expect(screen.getByText(t("plan.vergrendeld"))).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("geeft wie de klas mag plannen het oordeel, het slot, het verplaatsen en het verwijderen", () => {
    toon(true);

    expect(screen.getByRole("button", { name: t("plan.aanvaard") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("plan.weiger") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("plan.vergrendeld") })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: t("plan.verplaatsNaar") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("plan.verwijder") })).toBeInTheDocument();
  });
});
