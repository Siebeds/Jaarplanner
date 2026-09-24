import { ALLE_JAARFASEN, renderMetJaarfasen } from "../../test/jaarfasen";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { Themaformulier } from "./Themaformulier";

/**
 * The thema form (FB-061): one calm column, a create button that says so, and an edit mode that shows what changed
 * and asks before throwing changes away.
 */

const BOERDERIJ: ThemaWeergave = {
  id: "thema-1",
  naam: "Op de boerderij",
  duurWeken: 5,
  invalshoeken: "Van gras tot melk",
  kernwoordenschat: ["koe", "kip"],
  rijkeWoordenschat: ["hooi"],
  heeftVoldoendeThemadoelen: false,
  leeftijden: ["JK", "K2", "K3", "L1", "L2", "L3", "L4", "L5", "L6"],
  themadoelen: [],
  minimumdoelen: [],
  subthemas: [],
};

function toon(thema?: ThemaWeergave) {
  const onBewaar = vi.fn();
  const onSluit = vi.fn();
  renderMetJaarfasen(<Themaformulier open thema={thema} onBewaar={onBewaar} onSluit={onSluit} bezig={false} />);
  return { onBewaar, onSluit, blad: screen.getByRole("dialog") };
}

const gewijzigd = () => screen.queryAllByText(t("algemeen.gewijzigd"));

describe("Themaformulier: een nieuw thema", () => {
  it("toont invalshoeken als tekstvak en de twee woordenlijsten met teller en uitleg", () => {
    const { blad } = toon();

    expect(within(blad).getByLabelText(t("themabeheer.invalshoeken")).tagName).toBe("TEXTAREA");
    expect(within(blad).getByText(t("themabeheer.kernUitleg"))).toBeInTheDocument();
    expect(within(blad).getByText(t("themabeheer.rijkUitleg"))).toBeInTheDocument();
    expect(within(blad).getAllByText("0")).toHaveLength(2);
  });

  it("maakt het thema aan met een knop die dat zegt", () => {
    const { blad, onBewaar } = toon();

    fireEvent.change(within(blad).getByLabelText(t("themabeheer.naam")), { target: { value: "  Op de boerderij " } });
    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.aanmaken") }));

    expect(onBewaar).toHaveBeenCalledWith({
      naam: "Op de boerderij",
      duurWeken: 4,
      invalshoeken: null,
      kernwoordenschat: [],
      rijkeWoordenschat: [],
      icoon: null,
      leeftijden: ALLE_JAARFASEN,
    });
    expect(within(blad).queryByRole("button", { name: t("themabeheer.bewaar") })).toBeNull();
  });

  it("beperkt het thema tot de gekozen leeftijden, en weigert het zonder leeftijd (FB-012)", () => {
    const { blad, onBewaar } = toon();
    fireEvent.change(within(blad).getByLabelText(t("themabeheer.naam")), { target: { value: "Herfst" } });
    const groep = within(blad).getByRole("group", { name: t("themabeheer.leeftijden") });

    for (const fase of ALLE_JAARFASEN) {
      fireEvent.click(within(groep).getByRole("button", { name: fase }));
    }
    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.aanmaken") }));
    expect(onBewaar).not.toHaveBeenCalled();
    expect(within(blad).getByText(t("themabeheer.leeftijdVerplicht"))).toBeInTheDocument();

    fireEvent.click(within(groep).getByRole("button", { name: "K3" }));
    fireEvent.click(within(groep).getByRole("button", { name: "K2" }));
    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.aanmaken") }));
    expect(onBewaar).toHaveBeenCalledWith(expect.objectContaining({ leeftijden: ["K2", "K3"] }));
  });

  it("sluit meteen zonder ingevulde velden", () => {
    const { blad, onSluit } = toon();
    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.annuleer") }));
    expect(onSluit).toHaveBeenCalledTimes(1);
  });

  it("vraagt het eerst zodra er iets ingetypt is", () => {
    const { blad, onSluit } = toon();
    fireEvent.change(within(blad).getByLabelText(t("themabeheer.naam")), { target: { value: "Herfst" } });
    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.annuleer") }));
    expect(onSluit).not.toHaveBeenCalled();
    expect(within(blad).getByRole("alert")).toHaveTextContent(t("themabeheer.nietBewaard"));
  });

  it("toont geen 'gewijzigd' bij een nieuw thema", () => {
    const { blad } = toon();
    fireEvent.change(within(blad).getByLabelText(t("themabeheer.naam")), { target: { value: "Herfst" } });
    expect(gewijzigd()).toHaveLength(0);
  });
});

describe("Themaformulier: een thema bewerken", () => {
  it("noemt het thema in de titel en laat Bewaren pas toe na een wijziging", () => {
    const { blad } = toon(BOERDERIJ);

    expect(within(blad).getByRole("heading", { name: "Op de boerderij bewerken" })).toBeInTheDocument();
    expect(within(blad).getByRole("button", { name: t("themabeheer.bewaar") })).toBeDisabled();
    expect(gewijzigd()).toHaveLength(0);
  });

  it("markeert een gewijzigde duur, en haalt de markering weg als de oude duur terugkomt", () => {
    const { blad } = toon(BOERDERIJ);
    const bewaar = within(blad).getByRole("button", { name: t("themabeheer.bewaar") });

    fireEvent.click(within(blad).getByRole("button", { name: "6" }));
    expect(gewijzigd()).toHaveLength(1);
    expect(bewaar).toBeEnabled();

    fireEvent.click(within(blad).getByRole("button", { name: "5" }));
    expect(gewijzigd()).toHaveLength(0);
    expect(bewaar).toBeDisabled();
  });

  it("markeert gewijzigde leeftijden en stuurt ze mee (FB-012)", () => {
    const { blad, onBewaar } = toon({ ...BOERDERIJ, leeftijden: ["K2", "K3"] });
    const groep = within(blad).getByRole("group", { name: t("themabeheer.leeftijden") });
    expect(within(groep).getByRole("button", { name: "K3" })).toHaveAttribute("aria-pressed", "true");
    expect(within(groep).getByRole("button", { name: "JK" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(within(groep).getByRole("button", { name: "JK" }));
    expect(gewijzigd()).toHaveLength(1);
    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(onBewaar).toHaveBeenCalledWith(expect.objectContaining({ leeftijden: ["JK", "K2", "K3"] }));
  });

  it("markeert een gewijzigde woordenlijst", () => {
    const { blad } = toon(BOERDERIJ);

    fireEvent.click(within(blad).getByRole("button", { name: t("woorden.haalWeg", { woord: "kip" }) }));

    expect(gewijzigd()).toHaveLength(1);
    expect(within(blad).getByRole("button", { name: t("themabeheer.bewaar") })).toBeEnabled();
  });

  it("vraagt bij annuleren met wijzigingen eerst: verder bewerken houdt ze, weggooien sluit", () => {
    const { blad, onSluit } = toon(BOERDERIJ);
    const naam = within(blad).getByRole("textbox", { name: /Naam/ });
    fireEvent.change(naam, { target: { value: "De boerderij" } });

    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.annuleer") }));
    expect(onSluit).not.toHaveBeenCalled();
    const vraag = within(blad).getByRole("alert");
    expect(vraag).toHaveTextContent(t("themabeheer.nietBewaard"));
    expect(within(vraag).getByRole("button", { name: t("themabeheer.verderBewerken") })).toHaveFocus();

    fireEvent.click(within(vraag).getByRole("button", { name: t("themabeheer.verderBewerken") }));
    expect(within(blad).queryByRole("alert")).toBeNull();
    expect(naam).toHaveValue("De boerderij");

    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.annuleer") }));
    fireEvent.click(within(blad).getByRole("button", { name: t("themabeheer.weggooien") }));
    expect(onSluit).toHaveBeenCalledTimes(1);
  });

  it("vraagt het ook bij Escape", () => {
    const { blad, onSluit } = toon(BOERDERIJ);
    fireEvent.click(within(blad).getByRole("button", { name: "4" }));

    fireEvent.keyDown(blad, { key: "Escape" });

    expect(onSluit).not.toHaveBeenCalled();
    expect(within(blad).getByRole("alert")).toHaveTextContent(t("themabeheer.nietBewaard"));
  });

  it("sluit zonder vragen als er niets gewijzigd is", () => {
    const { blad, onSluit } = toon(BOERDERIJ);
    fireEvent.click(within(blad).getByRole("button", { name: t("algemeen.sluiten") }));
    expect(onSluit).toHaveBeenCalledTimes(1);
  });
});
