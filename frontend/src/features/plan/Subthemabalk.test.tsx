import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Subthemabalk } from "./Subthemabalk";
import type { Subthemareeks } from "./subthemareeksen";
import { t } from "../../i18n";
import { periode } from "../../lib/datum";
import { themapaginaPad } from "../themas/themapagina";

/**
 * The row above the grid: the keyboard's way to the themapagina (FB-037, ADR-0042), a link per thema in view followed
 * by its runs, each a link to its chapter with its days beside it. Nothing else: what the hoeken hold is in the side
 * panel (FB-038, ADR-0044).
 */
const SEIZOENEN = { id: "t-seizoenen", naam: "Seizoenen" };

const herfst: Subthemareeks = {
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  themaId: SEIZOENEN.id,
  themaNaam: SEIZOENEN.naam,
  van: "2026-09-14",
  tot: "2026-09-25",
  aantalDagen: 3,
  periodeId: "p-herfst",
};

const winter: Subthemareeks = {
  subthemaId: "s-winter",
  subthemaNaam: "De winter",
  themaId: SEIZOENEN.id,
  themaNaam: SEIZOENEN.naam,
  van: "2026-09-21",
  tot: "2026-10-02",
  aantalDagen: 2,
};

function toon(opties: Partial<Parameters<typeof Subthemabalk>[0]> = {}) {
  render(
    <MemoryRouter>
      <Subthemabalk themas={[SEIZOENEN]} reeksen={[herfst, winter]} {...opties} />
    </MemoryRouter>,
  );
}

describe("Subthemabalk", () => {
  it("toont elk subthema met zijn dagen, en linkt het naar zijn hoofdstuk op de themapagina", () => {
    toon();

    expect(screen.getByRole("list", { name: t("subthemabalk.label") })).toBeInTheDocument();
    expect(screen.getByText(periode("2026-09-14", "2026-09-25"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("subthemabalk.naarSubthema", { naam: "De herfst" }) })).toHaveAttribute(
      "href",
      themapaginaPad("t-seizoenen", "s-herfst"),
    );
  });

  it("opent niets en zegt niets over hoeken: de verrijking staat in het zijpaneel (FB-038)", () => {
    toon();

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/hoek/i)).toBeNull();
  });

  it("tekent niets als er in beeld geen thema en geen subthema loopt", () => {
    toon({ themas: [], reeksen: [] });

    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("Subthemabalk: de weg naar de themapagina met het toetsenbord (FB-037)", () => {
  it("linkt naar het thema en naar elk subthema, de dagen buiten de link", () => {
    toon();

    expect(screen.getByRole("link", { name: t("subthemabalk.naarThema", { naam: "Seizoenen" }) })).toHaveAttribute(
      "href",
      themapaginaPad("t-seizoenen"),
    );
    const naarWinter = screen.getByRole("link", { name: t("subthemabalk.naarSubthema", { naam: "De winter" }) });
    expect(naarWinter).toHaveAttribute("href", themapaginaPad("t-seizoenen", "s-winter"));
    // The visible label is the name alone, which the link's own name contains (SC 2.5.3); the days sit beside it.
    expect(naarWinter).toHaveTextContent(/^De winter$/);
  });

  it("zet elk subthema achter zijn thema", () => {
    const natuur = { id: "t-natuur", naam: "Natuur" };
    toon({ themas: [natuur, SEIZOENEN], reeksen: [herfst, { ...winter, themaId: natuur.id, themaNaam: natuur.naam }] });

    const rijen = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rijen.map((rij) => rij.textContent)).toEqual([
      "Natuur",
      expect.stringContaining("De winter"),
      "Seizoenen",
      expect.stringContaining("De herfst"),
    ]);
  });

  it("toont het thema ook als er in beeld nog geen subthema loopt, en noemt de lijst dan naar wat ze toont", () => {
    toon({ reeksen: [] });

    expect(screen.getByRole("list", { name: t("subthemabalk.labelThemas") })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t("subthemabalk.naarThema", { naam: "Seizoenen" }) })).toBeInTheDocument();
  });

  it("geeft een subthema waarvan het thema in geen periode in beeld staat toch zijn thema", () => {
    // An activiteit planned between two periodes: no band names its thema, the run itself does.
    toon({ themas: [], reeksen: [herfst] });

    expect(screen.getByRole("link", { name: t("subthemabalk.naarThema", { naam: "Seizoenen" }) })).toHaveAttribute(
      "href",
      themapaginaPad("t-seizoenen"),
    );
  });
});
