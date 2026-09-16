import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t } from "../../i18n";
import { Inklaplijst, PAGINA } from "./Inklaplijst";

/** A long list on the thema page (TB-044): shut, paged, and searchable while shut. */

const ITEMS = Array.from({ length: 12 }, (_, i) => ({ id: `d-${i + 1}`, naam: `Doel ${i + 1}` }));
ITEMS[3] = { id: "d-4", naam: "Één reeks" };

function toon(opties: { zoekLaadt?: boolean; onZoekOpen?: (open: boolean) => void } = {}) {
  render(
    <Inklaplijst
      items={ITEMS}
      sleutel={(item) => item.id}
      render={(item) => (
        <li>
          <button type="button">{item.naam}</button>
        </li>
      )}
      zoektekst={(item) => item.naam}
      aantalTekst="12 doelen"
      lijstnaam="doelen"
      zoekPlaatshouder="Code of tekst"
      {...opties}
    />,
  );
}

const vouwknop = () => screen.getByRole("button", { name: "12 doelen" });
const zoekknop = () => screen.getByRole("button", { name: t("lijst.zoekIn", { lijst: "doelen" }) });
const rijen = () => screen.queryAllByRole("listitem").map((li) => li.textContent);

describe("Inklaplijst (TB-044)", () => {
  it("staat ingeklapt, met het aantal op de vouwknop", () => {
    toon();

    expect(vouwknop()).toHaveAttribute("aria-expanded", "false");
    expect(rijen()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Laad/ })).toBeNull();
  });

  it("toont opengeklapt vijf items in hun volgorde, en laadt er telkens tot vijf bij", () => {
    toon();
    fireEvent.click(vouwknop());

    expect(rijen()).toEqual(ITEMS.slice(0, PAGINA).map((i) => i.naam));
    const meer = screen.getByRole("button", { name: /^Laad 5 meer/ });
    expect(meer).toHaveTextContent(t("lijst.nogOver", { aantal: 7 }));

    fireEvent.click(meer);
    expect(rijen()).toHaveLength(10);
    // Focus goes to the first row the press revealed, so a keyboard user carries on reading where the list grew.
    expect(screen.getByRole("button", { name: "Doel 6" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: /^Laad 2 meer/ }));
    expect(rijen()).toEqual(ITEMS.map((i) => i.naam));
    expect(screen.queryByRole("button", { name: /^Laad/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Doel 11" })).toHaveFocus();
  });

  it("vergeet bij inklappen hoe ver de lijst geladen was", () => {
    toon();
    fireEvent.click(vouwknop());
    fireEvent.click(screen.getByRole("button", { name: /^Laad 5 meer/ }));
    fireEvent.click(vouwknop());
    expect(rijen()).toHaveLength(0);

    fireEvent.click(vouwknop());
    expect(rijen()).toHaveLength(PAGINA);
  });

  it("zoekt in een ingeklapte lijst, zonder op hoofdletters of accenten te letten", () => {
    const onZoekOpen = vi.fn();
    toon({ onZoekOpen });

    fireEvent.click(zoekknop());
    expect(onZoekOpen).toHaveBeenLastCalledWith(true);
    const veld = screen.getByRole("textbox", { name: t("lijst.zoekIn", { lijst: "doelen" }) });
    expect(veld).toHaveFocus();

    fireEvent.change(veld, { target: { value: "een" } });
    expect(rijen()).toEqual(["Één reeks"]);
    expect(screen.getByRole("status")).toHaveTextContent(t("lijst.eenGevonden", { totaal: 12 }));
    expect(vouwknop()).toHaveAttribute("aria-expanded", "false");

    fireEvent.change(veld, { target: { value: "doel 1" } });
    // Doel 1, 10, 11 and 12: all four found, though the list is shut.
    expect(rijen()).toEqual(["Doel 1", "Doel 10", "Doel 11", "Doel 12"]);
    expect(screen.getByRole("status")).toHaveTextContent(t("lijst.gevonden", { aantal: 4, totaal: 12 }));
  });

  it("zegt het wanneer niets overeenkomt, en wacht daarmee zolang teksten nog laden", () => {
    toon({ zoekLaadt: true });
    fireEvent.click(zoekknop());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "vlinder" } });
    expect(screen.getByRole("status")).toHaveTextContent(t("lijst.zoeken"));
  });

  it("toont 'Niets gevonden' zonder treffer", () => {
    toon();
    fireEvent.click(zoekknop());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "vlinder" } });

    expect(screen.getByRole("status")).toHaveTextContent(t("lijst.nietsGevonden"));
    expect(rijen()).toHaveLength(0);
  });

  it("sluit het zoekveld met Escape, wist de zoekterm en geeft de focus terug", () => {
    const onZoekOpen = vi.fn();
    toon({ onZoekOpen });
    fireEvent.click(zoekknop());
    const veld = screen.getByRole("textbox");
    fireEvent.change(veld, { target: { value: "doel" } });

    fireEvent.keyDown(veld, { key: "Escape" });

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(rijen()).toHaveLength(0);
    expect(zoekknop()).toHaveFocus();
    expect(onZoekOpen).toHaveBeenLastCalledWith(false);
  });

  it("sluit het zoekveld ook met dezelfde knop", () => {
    toon();
    fireEvent.click(zoekknop());
    const sluit = screen.getByRole("button", { name: t("lijst.zoekSluit", { lijst: "doelen" }) });
    expect(sluit).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(sluit);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("pagineert ook de zoekresultaten", () => {
    toon();
    fireEvent.click(zoekknop());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "doel" } });

    expect(rijen()).toHaveLength(PAGINA);
    const lijst = screen.getByRole("list");
    expect(within(lijst).queryByText("Één reeks")).toBeNull();
    expect(screen.getByRole("button", { name: /^Laad 5 meer/ })).toBeInTheDocument();
  });
});
