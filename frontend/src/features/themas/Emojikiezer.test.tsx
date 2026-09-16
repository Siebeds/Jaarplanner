import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ThemaWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { Schermkop } from "../../app/Schermkop";
import { Themastroken } from "../plan/Themastroken";
import { themavakken } from "../plan/themavakken";
import { eersteEmoji, zoekEmoji } from "./emojicatalogus";
import { Emojikiezer, Themaicoon } from "./Emojikiezer";
import { Themaformulier } from "./Themaformulier";

/**
 * FB-060: the emoji box before a thema's naam, the grid it opens, the emoji a teacher types into its search field, and
 * the emoji beside the naam where the thema is shown. Where the grid sits on screen is the browser pass's.
 */
function toon(waarde: string | null = null) {
  const onKies = vi.fn();
  const gevolg = render(<Emojikiezer waarde={waarde} onKies={onKies} />);
  return { onKies, ...gevolg };
}

function open(label = t("emojikiezer.kies")) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  return screen.getByRole("dialog", { name: t("emojikiezer.titel") });
}

describe("Emojikiezer", () => {
  it("opent met de cursor in het zoekveld, en een klik op een emoji kiest het en sluit het raster", () => {
    const { onKies } = toon();

    const raster = open();
    expect(within(raster).getByRole("searchbox", { name: t("emojikiezer.zoekLabel") })).toHaveFocus();
    expect(within(raster).getAllByRole("group")).toHaveLength(6);

    fireEvent.click(within(raster).getByRole("button", { name: t("emojikiezer.naam.koe") }));

    expect(onKies).toHaveBeenCalledWith("🐮");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("zegt op het vakje welk emoji gekozen is en drukt dat emoji in het raster in", () => {
    toon("🐮");

    const raster = open(t("emojikiezer.wijzig", { emoji: "🐮" }));

    expect(within(raster).getByRole("button", { name: t("emojikiezer.naam.koe") })).toHaveAttribute("aria-pressed", "true");
    expect(within(raster).getByRole("button", { name: t("emojikiezer.naam.kip") })).toHaveAttribute("aria-pressed", "false");
  });

  it("toont bij een zoekterm alleen wat erbij past, en zegt het als er niets past", () => {
    toon();
    const raster = open();
    const zoek = within(raster).getByRole("searchbox");

    fireEvent.change(zoek, { target: { value: "boerderij" } });
    expect(within(raster).getAllByRole("button", { pressed: false }).map((knop) => knop.getAttribute("aria-label"))).toEqual([
      t("emojikiezer.naam.koe"),
      t("emojikiezer.naam.kip"),
    ]);

    fireEvent.change(zoek, { target: { value: "xyz" } });
    expect(within(raster).getByText(t("emojikiezer.geenResultaat"))).toBeInTheDocument();
    expect(within(raster).queryAllByRole("group")).toHaveLength(0);
  });

  it("maakt het emoji leeg met Geen emoji, en biedt dat niet aan als er geen is", () => {
    const { onKies, unmount } = toon("🐮");
    fireEvent.click(within(open(t("emojikiezer.wijzig", { emoji: "🐮" }))).getByRole("button", { name: t("emojikiezer.geen") }));
    expect(onKies).toHaveBeenCalledWith(null);
    unmount();

    toon();
    expect(within(open()).getByRole("button", { name: t("emojikiezer.geen") })).toBeDisabled();
  });

  it("kiest een emoji dat in het zoekveld getypt wordt, ook een dat het raster niet heeft", () => {
    const { onKies } = toon();

    fireEvent.change(within(open()).getByRole("searchbox"), { target: { value: "🦖" } });

    expect(onKies).toHaveBeenCalledWith("🦖");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("kiest niets bij gewone tekst in het zoekveld", () => {
    const { onKies } = toon();

    fireEvent.change(within(open()).getByRole("searchbox"), { target: { value: "herfst" } });

    expect(onKies).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sluit het raster met Escape zonder iets te kiezen", () => {
    const { onKies } = toon("🐮");
    const raster = open(t("emojikiezer.wijzig", { emoji: "🐮" }));

    fireEvent.keyDown(within(raster).getByRole("searchbox"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onKies).not.toHaveBeenCalled();
  });

  it("gaat met de pijltjes door het raster", () => {
    toon();
    const raster = open();
    const eerste = within(raster).getByRole("button", { name: t("emojikiezer.naam.herfstblad") });
    eerste.focus();

    fireEvent.keyDown(eerste, { key: "ArrowRight" });
    expect(within(raster).getByRole("button", { name: t("emojikiezer.naam.bloesem") })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(within(raster).getByRole("button", { name: t("emojikiezer.naam.zonnebloem") })).toHaveFocus();
  });
});

describe("eersteEmoji", () => {
  it("neemt een samengesteld emoji als geheel", () => {
    expect(eersteEmoji("👨‍👩‍👧")).toBe("👨‍👩‍👧");
    expect(eersteEmoji("x🇧🇪y")).toBe("🇧🇪");
    expect(eersteEmoji("1️⃣")).toBe("1️⃣");
    expect(eersteEmoji("👋🏽")).toBe("👋🏽");
  });

  it("vindt niets in gewone tekst of cijfers", () => {
    expect(eersteEmoji("herfst")).toBeNull();
    expect(eersteEmoji("12")).toBeNull();
    // A bare arrow or square is text: typing one searches.
    expect(eersteEmoji("→")).toBeNull();
    expect(eersteEmoji("■")).toBeNull();
    expect(eersteEmoji("➡️")).toBe("➡️");
    expect(eersteEmoji("")).toBeNull();
  });
});

describe("zoekEmoji", () => {
  it("biedt zonder zoekterm zes groepen van zes", () => {
    const groepen = zoekEmoji("  ");
    expect(groepen).toHaveLength(6);
    expect(groepen.every((groep) => groep.emoji.length === 6)).toBe(true);
    expect(new Set(groepen.flatMap((groep) => groep.emoji.map((keuze) => keuze.teken))).size).toBe(36);
  });
});

const THEMA: ThemaWeergave = {
  id: "t-1",
  naam: "Herfst",
  duurWeken: 4,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: false,
  themadoelen: [],
  minimumdoelen: [],
  subthemas: [],
  icoon: "🍂",
};

describe("Themaformulier", () => {
  it("toont het emoji van het thema in het vakje, en een ander emoji alleen is al een wijziging om te bewaren", () => {
    const onBewaar = vi.fn();
    render(<Themaformulier open thema={THEMA} onBewaar={onBewaar} onSluit={vi.fn()} bezig={false} />);

    const bewaar = screen.getByRole("button", { name: t("themabeheer.bewaar") });
    expect(bewaar).toBeDisabled();
    fireEvent.click(within(open(t("emojikiezer.wijzig", { emoji: "🍂" }))).getByRole("button", { name: t("emojikiezer.naam.koe") }));
    fireEvent.click(bewaar);

    expect(onBewaar).toHaveBeenCalledWith(expect.objectContaining({ naam: "Herfst", icoon: "🐮" }));
  });

  it("stuurt null mee voor een thema zonder emoji", () => {
    const onBewaar = vi.fn();
    render(<Themaformulier open thema={{ ...THEMA, icoon: null }} onBewaar={onBewaar} onSluit={vi.fn()} bezig={false} />);

    fireEvent.change(screen.getByLabelText(t("themabeheer.naam")), { target: { value: "Herfstbos" } });
    fireEvent.click(screen.getByRole("button", { name: t("themabeheer.bewaar") }));

    expect(onBewaar).toHaveBeenCalledWith(expect.objectContaining({ icoon: null }));
  });
});

describe("het emoji naast de naam", () => {
  it("staat voor de titel van de themapagina, zonder dat een schermlezer het in de titel hoort", () => {
    render(<Schermkop titel="Herfst" icoon="🍂" />);

    const kop = screen.getByRole("heading", { level: 1, name: "Herfst" });
    expect(kop).toHaveTextContent("🍂Herfst");
  });

  it("verschijnt niet als het thema er geen heeft", () => {
    const { container } = render(<Themaicoon icoon={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("staat voor de naam op de themaband van de agenda", () => {
    const [vak] = themavakken([
      { id: "p-1", van: "2026-09-01", tot: "2026-10-01", themaId: "t-1", themaNaam: "Herfst", themaIcoon: "🍂", status: "Aanvaard" },
    ]);
    expect(vak.themas).toEqual([{ id: "t-1", naam: "Herfst", icoon: "🍂" }]);

    // 1 september 2026 is the placement's first day, where the band prints the name.
    render(
      <MemoryRouter>
        <Themastroken vak={vak} datum="2026-09-01" />
      </MemoryRouter>,
    );
    const band = screen.getByRole("link", { name: t("periode.naarThema", { naam: "Herfst" }) });
    expect(band).toHaveTextContent("🍂Herfst");
  });
});
