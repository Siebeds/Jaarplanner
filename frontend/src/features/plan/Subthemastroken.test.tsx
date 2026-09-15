import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Subthemastroken } from "./Subthemastroken";
import type { Subthemareeks } from "./subthemareeksen";
import { t } from "../../i18n";
import { themapaginaPad } from "../themas/themapagina";

/**
 * The cases the demo data cannot reach.
 *
 * The browser pass covered one subthema over four weeks and two overlapping on a handover day, which
 * is what the school's own plan happens to contain. Three at once, and the count that stands in for
 * the ones that did not fit, exist only here. Written as assertions about the words on screen: what
 * can go wrong with a strip is not its colour, it is a strip that names nothing, and a cell whose
 * height goes to strips instead of to the day.
 */
const reeks = (naam: string, van: string, tot: string): Subthemareeks => ({
  subthemaId: naam,
  subthemaNaam: naam,
  themaId: "t-klas",
  themaNaam: "Ik en mijn klas",
  van,
  tot,
  aantalDagen: 1,
});

// A strip is a link since FB-037, and a link needs a router around it.
const toon = (strook: ReactElement) => render(<MemoryRouter>{strook}</MemoryRouter>);

describe("Subthemastroken", () => {
  it("noemt het subthema op de eerste dag van de reeks", () => {
    toon(<Subthemastroken reeksen={[reeks("de speelhoek", "2026-09-01", "2026-09-04")]} datum="2026-09-01" dicht />);
    expect(screen.getByText("de speelhoek")).toBeInTheDocument();
  });

  it("markeert een dag in het midden van de reeks als vervolg", () => {
    // A Tuesday: not the run's own first day and not the start of a week, so in the month grid the
    // strip carries the band and the row's first cell carries the word.
    toon(<Subthemastroken reeksen={[reeks("de speelhoek", "2026-09-01", "2026-09-04")]} datum="2026-09-02" dicht />);
    expect(screen.queryByText("de speelhoek")).not.toBeInTheDocument();
  });

  it("herhaalt de naam aan het begin van elke week, met een vervolgteken", () => {
    // 7 september 2026 is a Monday inside a run that began the week before.
    toon(<Subthemastroken reeksen={[reeks("de speelhoek", "2026-09-01", "2026-09-11")]} datum="2026-09-07" dicht />);
    expect(screen.getByText(t("periode.subthemaVervolg", { naam: "de speelhoek" }))).toBeInTheDocument();
  });

  it("zet twee subthema's naast elkaar, beide met hun naam", () => {
    const twee = [reeks("de speelhoek", "2026-09-01", "2026-09-04"), reeks("op reis", "2026-09-02", "2026-09-09")];
    toon(<Subthemastroken reeksen={twee} datum="2026-09-02" dicht />);

    // The second run starts here, so this is a handover day and both get named: the one thing a
    // teacher needs from a handover is to see which two.
    expect(screen.getByText(t("periode.subthemaVervolg", { naam: "de speelhoek" }))).toBeInTheDocument();
    expect(screen.getByText("op reis")).toBeInTheDocument();
  });

  it("vouwt drie subthema's tot één naam en een aantal", () => {
    const drie = [
      reeks("de speelhoek", "2026-09-01", "2026-09-04"),
      reeks("op reis", "2026-09-01", "2026-09-09"),
      reeks("de winkel", "2026-09-01", "2026-09-09"),
    ];
    toon(<Subthemastroken reeksen={drie} datum="2026-09-01" dicht />);

    expect(screen.getByText("de speelhoek")).toBeInTheDocument();
    expect(screen.getByText(t("periode.subthemaMeer", { aantal: 2 }))).toBeInTheDocument();
    // Not three strips: the cell is 112 pixels tall and the rest are in the day's own label.
    expect(screen.queryByText("de winkel")).not.toBeInTheDocument();
  });

  it("rendert niets als er niets loopt", () => {
    const { container } = toon(<Subthemastroken reeksen={[]} datum="2026-09-01" dicht />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Subthemastroken: naar het subthema op de themapagina (FB-037)", () => {
  it("opent het hoofdstuk van het subthema, ook op een dag zonder naam, zonder tabstop en buiten de toegankelijkheidsboom", () => {
    // A Wednesday mid-run: in the month grid this strip is blank, and it still opens the subthema.
    const { container } = toon(
      <Subthemastroken reeksen={[reeks("de speelhoek", "2026-09-01", "2026-09-11")]} datum="2026-09-02" dicht />,
    );

    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", themapaginaPad("t-klas", "de speelhoek"));
    expect(links[0]).toHaveAttribute("tabindex", "-1");
    // The day's own button speaks the subthema; the keyboard reaches its page through the menu Thema's.
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("laat het aantal dat voor de andere reeksen staat nergens naartoe gaan", () => {
    const drie = [
      reeks("de speelhoek", "2026-09-01", "2026-09-04"),
      reeks("op reis", "2026-09-01", "2026-09-09"),
      reeks("de winkel", "2026-09-01", "2026-09-09"),
    ];
    const { container } = toon(<Subthemastroken reeksen={drie} datum="2026-09-01" dicht />);

    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("de speelhoek");
  });
});
