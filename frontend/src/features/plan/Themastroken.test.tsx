import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Themastroken } from "./Themastroken";
import type { Themavak } from "./themavakken";
import { t } from "../../i18n";
import { themapaginaPad } from "../themas/themapagina";

/**
 * The thema band as a pointer's shortcut to the thema's page (FB-037, ADR-0042): which thema it opens, and that it opens
 * nothing where it names none.
 */
const vak = (themas: Themavak["themas"]): Themavak => ({
  blokStart: "2026-09-01",
  van: "2026-09-01",
  tot: "2026-10-01",
  themas,
});

// 16 september 2026 is a Wednesday in the middle of the period, where a wide row drops the name.
const toon = (v: Themavak, datum = "2026-09-16") =>
  render(
    <MemoryRouter>
      <Themastroken vak={v} datum={datum} />
    </MemoryRouter>,
  );

describe("Themastroken (FB-037)", () => {
  it("opent de themapagina van het thema, ook midden in de periode, zonder tabstop en buiten de toegankelijkheidsboom", () => {
    const { container } = toon(vak([{ id: "t-herfst", naam: "De herfst" }]));

    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", themapaginaPad("t-herfst"));
    expect(link).toHaveAttribute("tabindex", "-1");
    // The day's own button speaks the thema; the keyboard reaches its page through the menu Thema's.
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("opent met twee thema's in de periode het thema dat het label noemt", () => {
    const { container } = toon(
      vak([
        { id: "t-herfst", naam: "De herfst" },
        { id: "t-sint", naam: "Sint" },
      ]),
      "2026-09-01",
    );

    expect(screen.getByText(t("periode.themaMeer", { naam: "De herfst", aantal: 1 }))).toBeInTheDocument();
    expect(container.querySelector("a")).toHaveAttribute("href", themapaginaPad("t-herfst"));
  });

  it("opent niets in een periode zonder thema", () => {
    const { container } = toon(vak([]), "2026-09-01");

    expect(screen.getByText(t("periode.geenThema"))).toBeInTheDocument();
    expect(container.querySelector("a")).toBeNull();
  });
});
