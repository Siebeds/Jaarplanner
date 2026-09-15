import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Subthemabalk } from "./Subthemabalk";
import type { Subthemareeks } from "./subthemareeksen";
import type { SubthemaperiodeVerrijkingen } from "../hoeken/gegevens";
import { t } from "../../i18n";
import { periode } from "../../lib/datum";
import { themapaginaPad } from "../themas/themapagina";

/**
 * The subthemabalk above the grid (FB-020): one button per subthema on screen, with a one-line preview of what the
 * hoeken hold while it runs. The preview's branches are pinned, because each may only say what its data proves.
 *
 * Since FB-037 it is also the keyboard's way to the themapagina: a link per thema in view, followed by its runs, and a
 * link beside each run's button to its chapter.
 */
const HOEKEN = [
  { id: "h-boek", naam: "boekenhoek" },
  { id: "h-bouw", naam: "bouwhoek" },
  { id: "h-zand", naam: "zandtafel" },
];

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

// Drawn from its activiteiten alone: no stored window, so it cannot have a verrijking yet.
const winter: Subthemareeks = {
  subthemaId: "s-winter",
  subthemaNaam: "De winter",
  themaId: SEIZOENEN.id,
  themaNaam: SEIZOENEN.naam,
  van: "2026-09-21",
  tot: "2026-10-02",
  aantalDagen: 2,
};

const gevuld: SubthemaperiodeVerrijkingen = {
  subthemaperiodeId: "p-herfst",
  subthemaId: "s-herfst",
  subthemaNaam: "De herfst",
  van: "2026-09-14",
  tot: "2026-09-25",
  // Listed out of the klas's order on purpose: the preview names the first CORNER, not the first row.
  verrijkingen: [
    { id: "v-2", hoekId: "h-bouw", tekst: "kastanjes en dennenappels" },
    { id: "v-1", hoekId: "h-boek", tekst: "prentenboeken over de herfst" },
  ],
};

function toon(opties: Partial<Parameters<typeof Subthemabalk>[0]> = {}) {
  const onOpen = vi.fn();
  render(
    <MemoryRouter>
      <Subthemabalk
        themas={[SEIZOENEN]}
        reeksen={[herfst, winter]}
        verrijkingen={[gevuld]}
        geladen
        hoeken={HOEKEN}
        magPlannen
        onOpen={onOpen}
        {...opties}
      />
    </MemoryRouter>,
  );
  return { onOpen };
}

describe("Subthemabalk", () => {
  it("toont elk subthema met zijn dagen, en het voorbeeld van de verrijkte hoeken in de volgorde van de klas", () => {
    toon();

    const lijst = screen.getByRole("list", { name: t("subthemabalk.label") });
    expect(lijst).toBeInTheDocument();
    expect(screen.getByText(periode("2026-09-14", "2026-09-25"))).toBeInTheDocument();
    expect(screen.getByText(t("subthemabalk.verrijktAantal", { aantal: 2 }))).toBeInTheDocument();
    expect(screen.getByText("boekenhoek: prentenboeken over de herfst")).toBeInTheDocument();
  });

  it("biedt wie mag plannen bij een subthema zonder verrijking aan om ze in te vullen", () => {
    toon();

    expect(screen.getByRole("button", { name: new RegExp(`De winter.*${t("subthemabalk.invullen")}`) }))
      .toBeInTheDocument();
  });

  it("zegt aan wie alleen mag bekijken pas dat er niets is als dat zeker is", () => {
    // Read and empty: then it is true there is none.
    const { onOpen } = toon({ magPlannen: false, verrijkingen: [{ ...gevuld, verrijkingen: [] }] });
    expect(screen.getAllByText(t("subthemabalk.geen"))).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /De winter/ }));
    expect(onOpen).toHaveBeenCalledWith(winter);
  });

  it("zegt niet dat er geen verrijking is terwijl die nog gelezen wordt", () => {
    toon({ magPlannen: false, verrijkingen: [], geladen: false });

    // De herfst has a window whose verrijkingen are still out; De winter has no window, so none is certain.
    expect(screen.getByRole("button", { name: new RegExp(`De herfst.*${t("subthemabalk.bekijken")}`) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`De winter.*${t("subthemabalk.geen")}`) })).toBeInTheDocument();
  });

  it("tekent niets als er in beeld geen thema en geen subthema loopt", () => {
    toon({ themas: [], reeksen: [] });

    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("Subthemabalk: de weg naar de themapagina met het toetsenbord (FB-037)", () => {
  it("linkt naar het thema, en naast de knop van elk subthema naar zijn hoofdstuk", () => {
    const { onOpen } = toon();

    expect(screen.getByRole("link", { name: t("subthemabalk.naarThema", { naam: "Seizoenen" }) })).toHaveAttribute(
      "href",
      themapaginaPad("t-seizoenen"),
    );
    const naarHerfst = screen.getByRole("link", { name: t("subthemabalk.naarSubthema", { naam: "De herfst" }) });
    expect(naarHerfst).toHaveAttribute("href", themapaginaPad("t-seizoenen", "s-herfst"));
    // Beside the button, never inside it: a link in a button is invalid and unreachable by keyboard.
    expect(naarHerfst.closest("button")).toBeNull();

    // The link goes; it does not also open the verrijkingen.
    fireEvent.click(naarHerfst);
    expect(onOpen).not.toHaveBeenCalled();
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
