import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { Navigatie } from "./Navigatie";
import { useHoekenpaneel } from "../state/hoekenpaneel";
import { t } from "../i18n";

/**
 * The two things about the hoekenfiches switch that are behaviour rather than style.
 *
 * Deliberately not a test of where it sits or how wide the rail gets: jsdom applies no stylesheet, so
 * `hidden lg:block` is invisible to it and an assertion about the phone shape here would pass whatever
 * the class said. That half is a browser pass, not a unit test.
 *
 * What is testable is which routes offer the switch at all, and that leaving the agenda closes the
 * panel. The second one is the one worth having: the flag drives the rail in this component and the
 * inline reservation in `Schil`, so a `true` that outlives the agenda dresses both of them for a panel
 * that has unmounted, and nothing else in the app would notice.
 */
const rendermetPad = (pad: string) =>
  render(
    <MemoryRouter initialEntries={[pad]}>
      <Navigatie />
    </MemoryRouter>,
  );

const schakelaar = () => screen.queryByRole("button", { name: t("hoekenpaneel.titel") });

afterEach(() => useHoekenpaneel.setState({ open: false }));

describe("Navigatie", () => {
  it("biedt de hoekenschakelaar aan op de agenda", () => {
    rendermetPad("/agenda");
    expect(schakelaar()).toBeInTheDocument();
  });

  it("biedt hem ook aan op een losse dag van de agenda", () => {
    rendermetPad("/agenda/dag/2026-09-01");
    expect(schakelaar()).toBeInTheDocument();
  });

  it("biedt hem niet aan op een ander scherm", () => {
    rendermetPad("/doelen");
    expect(schakelaar()).not.toBeInTheDocument();
  });

  it("biedt hem niet aan bij thema's per periode, want daar staat geen paneel", () => {
    rendermetPad("/agenda/periodes");
    expect(schakelaar()).not.toBeInTheDocument();
  });

  it("opent het paneel en zegt dat het open staat", () => {
    rendermetPad("/agenda");
    const knop = schakelaar();
    expect(knop).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(knop!);

    expect(useHoekenpaneel.getState().open).toBe(true);
    expect(schakelaar()).toHaveAttribute("aria-pressed", "true");
  });

  it("sluit het paneel wanneer de leerkracht naar een ander scherm gaat", () => {
    useHoekenpaneel.setState({ open: true });
    rendermetPad("/agenda");

    fireEvent.click(screen.getByRole("link", { name: t("navigatie.doelen") }));

    expect(useHoekenpaneel.getState().open).toBe(false);
    expect(schakelaar()).not.toBeInTheDocument();
  });
});
