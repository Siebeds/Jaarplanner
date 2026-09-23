import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Tijdraster, type Ficheblokje, type Tijddoel } from "./Tijdraster";
import type { Agendadag } from "./roosterdagen";
import type { GeplandeActiviteit } from "../../lib/types";
import type { Schooldaguren } from "../schooluren/gegevens";
import { STANDAARDBEGIN, toonBereik } from "./tijd";
import type { Subthemareeks } from "./subthemareeksen";
import { t } from "../../i18n";
import { FICHEVLAK, FICHEVLAK_STIL } from "../algemene-fiches/merk";

/**
 * The time grid (ADR-0028).
 *
 * **What is worth pinning here is what a screenshot cannot check**: that a block is drawn where its own times say,
 * that two overlapping blocks end up beside each other rather than on top of each other, and that a press on empty
 * space asks for the hour it landed on. The now-line and the drag preview need a real viewport and a pointer, so
 * they belong to the browser pass instead; jsdom reports every rectangle as zero.
 */
const activiteit = (naam: string, begin: string, einde: string): GeplandeActiviteit => ({
  plaatsingId: `p-${naam}`,
  activiteitId: `a-${naam}`,
  activiteitNaam: naam,
  activiteitType: "spel",
  subthemaId: "s1",
  subthemaNaam: "de speelhoek",
  themaId: "t1",
  themaNaam: "Ik en mijn klas",
  begin,
  einde,
  status: "Manueel",
  kleur: null,
  doelcodes: [],
  valtBuitenThemaperiode: false,
});

const dag = (activiteiten: GeplandeActiviteit[] = [], extra: Partial<Agendadag> = {}): Agendadag => ({
  datum: "2026-09-08",
  isLesdag: true,
  sluitingsnaam: null,
  buitenSchooljaar: false,
  activiteiten,
  ...extra,
});

const fiche = (begin: string, einde: string): Ficheblokje => ({
  plaatsingId: "fp-1",
  momentId: "fm-1",
  naam: "turnen",
  datum: "2026-09-08",
  begin,
  einde,
  terugkerend: false,
});

function toon(
  dagen: Agendadag[],
  opties: {
    fichemomenten?: Ficheblokje[];
    onVoegToe?: (datum: string, begin: number) => void;
    onOpen?: (activiteit: GeplandeActiviteit, datum: string) => void;
    onOpenFiche?: (plaatsingId: string, momentId: string) => void;
    onVanDag?: (doel: Tijddoel, naam: string, datum: string) => void;
    magPlannen?: boolean;
    schooluren?: Schooldaguren[];
  } = {},
) {
  return render(
    <DndContext>
      <Tijdraster
        dagen={dagen}
        fichemomenten={opties.fichemomenten ?? []}
        reeksenPerDag={new Map()}
        vakken={[]}
        schooluren={opties.schooluren}
        magPlannen={opties.magPlannen ?? true}
        onVoegToe={opties.onVoegToe ?? (() => {})}
        onOpen={opties.onOpen ?? (() => {})}
        onOpenFiche={opties.onOpenFiche ?? (() => {})}
        onVanDag={opties.onVanDag ?? (() => {})}
        onWijzigTijd={() => {}}
      />
    </DndContext>,
  );
}

/** The inline `top`/`height` a block was drawn with, in pixels. */
function plaats(knop: HTMLElement) {
  const vak = knop.closest("div[style]") as HTMLElement;
  return { top: vak.style.top, height: vak.style.height, left: vak.style.left, width: vak.style.width };
}

describe("het rechtermuisklikmenu van een blok (TB-030)", () => {
  it("haalt op een fiche het aangeklikte moment van zijn dag, en bewerken opent het blad van dat moment", async () => {
    const onOpenFiche = vi.fn();
    const onVanDag = vi.fn();
    toon([dag()], { fichemomenten: [fiche("10:30:00", "11:20:00")], onOpenFiche, onVanDag });
    const blok = screen.getByRole("button", { name: /^turnen/ });

    fireEvent.contextMenu(blok);
    fireEvent.click(screen.getByRole("menuitem", { name: t("blokmenu.vanDag") }));
    await vi.waitFor(() =>
      expect(onVanDag).toHaveBeenCalledWith({ soort: "fiche", plaatsingId: "fp-1", momentId: "fm-1" }, "turnen", "2026-09-08"),
    );
    expect(onOpenFiche).not.toHaveBeenCalled();

    fireEvent.contextMenu(blok);
    fireEvent.click(screen.getByRole("menuitem", { name: t("blokmenu.bewerk") }));
    await vi.waitFor(() => expect(onOpenFiche).toHaveBeenCalledWith("fp-1", "fm-1"));
    expect(onVanDag).toHaveBeenCalledTimes(1);
  });

  it("geeft wie de klas alleen mag inkijken geen eigen menu", () => {
    toon([dag([activiteit("kringgesprek", "09:00:00", "09:50:00")])], { magPlannen: false });

    fireEvent.contextMenu(screen.getByRole("button", { name: /^kringgesprek/ }));

    expect(screen.queryByRole("menu")).toBeNull();
  });
});

// FB-091: the routine stands back behind what is planned, and a block says no start the hour gutter already says.
describe("Tijdraster: een terugkerende fiche en het beginuur (FB-091)", () => {
  /** The block's drawn box: the element that carries its ground and its edge. */
  const vlak = (knop: HTMLElement) => knop.closest(".rounded-veld") as HTMLElement;
  /** The block's name as it is printed. */
  const naamIn = (knop: HTMLElement, naam: string) => within(knop).getByText(naam);

  it("tekent een terugkerende fiche zonder rand en niet vet, en een eenmalige zoals voordien", () => {
    toon([dag()], {
      fichemomenten: [
        { ...fiche("08:00:00", "09:00:00"), naam: "onthaal", terugkerend: true },
        { ...fiche("13:00:00", "14:00:00"), momentId: "fm-2", naam: "uitstap", terugkerend: false },
      ],
    });

    const onthaal = screen.getByRole("button", { name: /^onthaal/ });
    expect(vlak(onthaal).className).toContain(FICHEVLAK_STIL);
    expect(vlak(onthaal).className).not.toContain(FICHEVLAK);
    expect(naamIn(onthaal, "onthaal")).toHaveClass("font-normal");
    expect(naamIn(onthaal, "onthaal")).not.toHaveClass("font-medium");

    const uitstap = screen.getByRole("button", { name: /^uitstap/ });
    expect(vlak(uitstap).className).toContain(FICHEVLAK);
    expect(vlak(uitstap).className).not.toContain(FICHEVLAK_STIL);
    expect(naamIn(uitstap, "uitstap")).toHaveClass("font-medium");
  });

  it("houdt een terugkerende fiche herkenbaar aan haar icoon en haar onderschrift, niet aan kleur alleen", () => {
    toon([dag()], { fichemomenten: [{ ...fiche("08:00:00", "09:00:00"), naam: "onthaal", terugkerend: true }] });

    const onthaal = screen.getByRole("button", { name: /^onthaal/ });
    expect(onthaal.querySelector("svg")).not.toBeNull();
    expect(within(onthaal).getByText(t("tijdraster.algemeneFiche"))).toBeInTheDocument();
  });

  it("laat een activiteit vet en met rand staan naast een terugkerende fiche", () => {
    toon([dag([activiteit("kringgesprek", "10:00:00", "11:00:00")])], {
      fichemomenten: [{ ...fiche("08:00:00", "09:00:00"), naam: "onthaal", terugkerend: true }],
    });

    const kring = screen.getByRole("button", { name: /^kringgesprek/ });
    expect(vlak(kring)).toHaveClass("border-lijn");
    expect(naamIn(kring, "kringgesprek")).toHaveClass("font-medium");
  });

  it("toont geen beginuur in een blok dat op een heel uur begint, wel het einde", () => {
    toon([dag([activiteit("kringgesprek", "09:00:00", "09:50:00"), activiteit("lezen", "10:00:00", "11:15:00")])]);

    expect(within(screen.getByRole("button", { name: /^kringgesprek/ })).queryByText("9:00")).toBeNull();
    const lezen = screen.getByRole("button", { name: /^lezen/ });
    expect(within(lezen).queryByText(toonBereik("10:00:00", "11:15:00"))).toBeNull();
    expect(within(lezen).getByText(t("tijdraster.tot", { tijd: "11:15" }))).toBeInTheDocument();
    // The accessible name still says both ends.
    expect(lezen).toHaveAccessibleName(new RegExp(toonBereik("10:00:00", "11:15:00")));
  });

  it("toont het beginuur in een blok dat niet op een heel uur begint", () => {
    toon([dag([activiteit("kringgesprek", "10:15:00", "10:50:00"), activiteit("lezen", "13:15:00", "14:30:00")])]);

    expect(within(screen.getByRole("button", { name: /^kringgesprek/ })).getByText("10:15")).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /^lezen/ })).getByText(toonBereik("13:15:00", "14:30:00")),
    ).toBeInTheDocument();
  });
});

describe("Tijdraster", () => {
  it("tekent een blok op de hoogte van zijn eigen uren", () => {
    toon([dag([activiteit("kringgesprek", "09:00:00", "09:50:00")])]);

    const knop = screen.getByRole("button", { name: /^kringgesprek/ });
    // The grid draws from midnight and an hour is 56 pixels: 9:00 is nine hours down, and 50 minutes is 46.67 of them.
    expect(plaats(knop).top).toBe(`${540 * (56 / 60)}px`);
    expect(plaats(knop).height).toBe(`${50 * (56 / 60)}px`);
  });

  it("zegt de uren van een blok in zijn naam, ook waar het te kort is om ze te tonen", () => {
    toon([dag([activiteit("kort", "09:00:00", "09:20:00")])]);

    // Twenty minutes is under the threshold where the time is printed inside the block, so the accessible name is
    // the only place it is said. That is the half a screenshot cannot check.
    expect(screen.getByRole("button", { name: `kort, ${toonBereik("09:00:00", "09:20:00")}` })).toBeInTheDocument();
  });

  it("zet blokken die overlappen naast elkaar, en laat de rest de volle breedte", () => {
    toon([
      dag([
        activiteit("kring", "09:00:00", "10:00:00"),
        activiteit("lezen", "09:30:00", "10:15:00"),
        activiteit("turnen", "13:30:00", "14:20:00"),
      ]),
    ]);

    expect(plaats(screen.getByRole("button", { name: /^kring/ })).width).toBe("50%");
    expect(plaats(screen.getByRole("button", { name: /^lezen/ })).left).toBe("50%");
    // The afternoon touches neither of them, so it gets its column back: drawing it half width would make the day
    // look busier than it is.
    expect(plaats(screen.getByRole("button", { name: /^turnen/ })).width).toBe("100%");
  });

  it("vraagt om een activiteit op het uur waar de leerkracht drukt", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    // A click with no pointer position behind it (a keyboard press, and every click in jsdom) means the ordinary
    // start of a morning rather than whatever hour the top of the grid happens to be.
    fireEvent.click(screen.getByRole("button", { name: t("periode.voegToeOp", { dag: "dinsdag 8 september" }) }));

    expect(gevraagd).toHaveBeenCalledWith("2026-09-08", STANDAARDBEGIN);
  });

  /*
    E6-02: the grid's four gestures are the klas's planning (ADR-0030 §3, R7). A gebruiker who may not plan this klas
    reads it: blocks still open, and nothing invites a placement, stretches or drags. The drag semantics matter as much
    as the pixels, because dnd-kit's attributes tell a screen reader a block is "draggable". The lit-up quarter and the
    dragged-out stretch (TB-014) live on the empty column's button, the one "Tijdraster onder de muis" presses, so its
    absence here is what withholds them too.
  */
  it("biedt wie deze klas niet mag plannen geen toevoegen, rekken of slepen, maar opent een blok wel", () => {
    const geopend = vi.fn();
    const { container } = toon([dag([activiteit("kringgesprek", "09:00:00", "09:50:00")])], {
      magPlannen: false,
      onOpen: geopend,
    });

    expect(
      screen.queryByRole("button", { name: t("periode.voegToeOp", { dag: "dinsdag 8 september" }) }),
    ).not.toBeInTheDocument();
    expect(container.querySelector("[data-rekgreep]")).toBeNull();

    const blok = screen.getByRole("button", { name: /^kringgesprek/ });
    expect(blok).not.toHaveAttribute("aria-roledescription");
    fireEvent.click(blok);
    expect(geopend).toHaveBeenCalled();
  });

  it("geeft wie de klas mag plannen de greep en het toevoegen", () => {
    const { container } = toon([dag([activiteit("kringgesprek", "09:00:00", "09:50:00")])]);

    expect(
      screen.getByRole("button", { name: t("periode.voegToeOp", { dag: "dinsdag 8 september" }) }),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-rekgreep]")).not.toBeNull();
    expect(screen.getByRole("button", { name: /^kringgesprek/ })).toHaveAttribute("aria-roledescription");
  });

  // An algemene fiche is the klas's planning too (ADR-0030 §3, R7): a reader opens it and cannot drag it (merge of
  // E6-02 with the agenda's algemene fiches).
  it("laat wie deze klas niet mag plannen een algemene fiche openen, niet slepen", () => {
    const geopend = vi.fn();
    toon([dag()], { fichemomenten: [fiche("10:30:00", "11:30:00")], onOpenFiche: geopend, magPlannen: false });

    const knop = screen.getByRole("button", { name: /^turnen/ });
    expect(knop).not.toHaveAttribute("aria-roledescription");
    fireEvent.click(knop);
    expect(geopend).toHaveBeenCalledWith("fp-1", "fm-1");
  });

  it("tekent een algemene fiche als blok met haar eigen onderschrift, en opent dat ene moment", () => {
    const geopend = vi.fn();
    toon([dag()], { fichemomenten: [fiche("10:30:00", "11:30:00")], onOpenFiche: geopend });

    const knop = screen.getByRole("button", { name: /^turnen/ });
    expect(plaats(knop).top).toBe(`${630 * (56 / 60)}px`);
    // Told apart from an activiteit by a word, not by a hue (Art. XII): an hour is tall enough to print it.
    expect(screen.getByText(t("tijdraster.algemeneFiche"))).toBeInTheDocument();

    // The occurrence travels with the placement: its sheet offers that one day's hours without a drag.
    fireEvent.click(knop);
    expect(geopend).toHaveBeenCalledWith("fp-1", "fm-1");
  });

  // FB-022: an algemene fiche's day text on its block, in whole lines of the room the block has.
  it("toont het begin van de dagtekst op een blok dat er plaats voor heeft, en niet op een kort blok", () => {
    toon([dag()], {
      fichemomenten: [
        { ...fiche("13:15:00", "14:00:00"), tekst: "We bouwen een toren met kapla." },
        { ...fiche("10:30:00", "11:00:00"), momentId: "fm-2", naam: "onthaal", tekst: "Kringgesprek over het weekend." },
      ],
    });

    // Three quarters of an hour holds one line under the name and the time.
    expect(screen.getByText("We bouwen een toren met kapla.")).toBeInTheDocument();
    // Half an hour holds only the name-and-time line; the text stays in the sheet and in the block's accessible name.
    expect(screen.queryByText("Kringgesprek over het weekend.")).toBeNull();
    expect(screen.getByRole("button", { name: /^onthaal.*Kringgesprek over het weekend\.$/ })).toBeInTheDocument();
  });

  it("zet de dagtekst op een blok van een uur in de plaats van het onderschrift", () => {
    toon([dag()], { fichemomenten: [{ ...fiche("10:30:00", "11:30:00"), tekst: "Buiten met de fietsjes." }] });

    expect(screen.getByText("Buiten met de fietsjes.")).toBeInTheDocument();
    // The glyph and the accessible name still say it is an algemene fiche.
    expect(screen.queryByText(t("tijdraster.algemeneFiche"))).toBeNull();
    expect(screen.getByRole("button", { name: new RegExp(t("tijdraster.algemeneFiche")) })).toBeInTheDocument();
  });

  it("biedt een gesloten dag niets aan en zegt waarom", () => {
    const gevraagd = vi.fn();
    toon([dag([], { isLesdag: false, sluitingsnaam: "Herfstvakantie" })], { onVoegToe: gevraagd });

    expect(screen.getByText("Herfstvakantie")).toBeInTheDocument();
    // No invitation on a day the server would refuse a placement on (the E3-06 rule).
    expect(screen.queryByRole("button", { name: /Activiteit toevoegen/ })).not.toBeInTheDocument();
    expect(gevraagd).not.toHaveBeenCalled();
  });

  it("tekent elk uur van het etmaal, en opent op zeven uur", () => {
    const { container } = toon([dag([activiteit("uitstap", "06:30:00", "16:00:00")])]);

    // Every hour is drawn, so a 6:30 trip is not clipped AND an empty 6:00 can still be clicked. The label of the
    // first hour is 0:00 and the last is 23:00: the boundary at midnight gets no label, because one drawn on the
    // very last pixel would hang outside the scroller, which is the half-cut hour this replaces.
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("23:00")).toBeInTheDocument();
    expect(screen.queryByText("24:00")).not.toBeInTheDocument();
    expect(plaats(screen.getByRole("button", { name: /^uitstap/ })).top).toBe(`${390 * (56 / 60)}px`);

    // And what a teacher sees of it before scrolling is 7:00 downwards. jsdom lays nothing out, so the scroll
    // position is the only half of "default 7u-18u" it can check; the height of the window is the browser pass.
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller.scrollTop).toBe(7 * 56);
  });

  /*
    FB-023: the school's hours. 2026-09-08, the day these tests draw, is a Tuesday, so ISO weekday 2.
  */
  const dinsdag: Schooldaguren = {
    weekdag: 2,
    begin: "08:30:00",
    einde: "15:30:00",
    middagpauzeBegin: "12:00:00",
    middagpauzeEinde: "13:15:00",
  };

  it("opent op het hele uur waarin de schooldag begint", () => {
    const { container } = toon([dag()], { schooluren: [dinsdag] });

    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller.scrollTop).toBe(8 * 56);
  });

  it("tint de uren buiten de schooldag en de middagpauze effen, zonder arcering of labels in de kolom", () => {
    const { container } = toon([dag()], { schooluren: [dinsdag] });

    const strook = (soort: string) => container.querySelector(`[data-schooltijd="${soort}"]`) as HTMLElement;
    // FB-058: a flat tint, no pattern, and no words inside the column.
    for (const soort of ["voor", "pauze", "na"]) {
      expect(strook(soort)).toHaveClass("bg-vlak/70");
      expect(strook(soort).style.backgroundImage).toBe("");
      expect(strook(soort)).toBeEmptyDOMElement();
    }
    expect(strook("voor").style.top).toBe("0px");
    expect(strook("voor").style.height).toBe(`${510 * (56 / 60)}px`);
    expect(strook("pauze").style.top).toBe(`${720 * (56 / 60)}px`);
    expect(strook("pauze").style.height).toBe(`${75 * (56 / 60)}px`);
    expect(strook("na").style.top).toBe(`${930 * (56 / 60)}px`);
  });

  it("schrijft alleen hele uren in de uurkolom en tekent de grenzen van de schooldag in de kolom zelf (FB-092)", () => {
    const { container } = toon([dag()], { schooluren: [dinsdag] });

    // No half-hour label under "12:00" or "8:00": the gutter is whole hours, all 24 of them.
    expect(screen.queryByText("8:30")).not.toBeInTheDocument();
    expect(screen.queryByText("13:15")).not.toBeInTheDocument();
    expect(screen.queryByText("15:30")).not.toBeInTheDocument();
    expect(screen.getByText("8:00")).toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();

    // Never the tint alone (Art. XII): each stretch is edged by a dashed line on the side that faces the school day.
    const strook = (soort: string) => container.querySelector(`[data-schooltijd="${soort}"]`) as HTMLElement;
    expect(strook("voor")).toHaveClass("border-dashed", "border-b");
    expect(strook("pauze")).toHaveClass("border-dashed", "border-y");
    expect(strook("na")).toHaveClass("border-dashed", "border-t");
  });

  it("is een scrollgebied dat het toetsenbord bereikt en een naam heeft (FB-092)", () => {
    toon([dag()], { schooluren: [dinsdag] });

    const uren = screen.getByRole("region", { name: "Uren van de dag" });
    expect(uren).toHaveAttribute("tabindex", "0");
    expect(uren).toHaveClass("overflow-y-auto", "rustige-schuifbalk");
  });

  it("geeft een algemene fiche een ander vlak dan een activiteit van dezelfde week, en een icoon erbij (FB-077)", () => {
    toon([dag([activiteit("bladeren stempelen", "15:00", "16:00")])], {
      fichemomenten: [fiche("10:30:00", "11:20:00")],
      schooluren: [dinsdag],
    });

    const vlakVan = (naam: RegExp) =>
      (screen.getByRole("button", { name: naam }).closest(".group\\/blok") as HTMLElement).className;

    // jsdom cannot evaluate a colour, so what is pinned here is that the two blocks are drawn from different grounds
    // at all; that the fiche's ground is deeper, and legible, is the browser pass.
    expect(vlakVan(/^turnen/)).toContain(FICHEVLAK);
    expect(vlakVan(/^bladeren stempelen/)).not.toContain(FICHEVLAK);

    // Never colour alone (Art. XII): the fiche also says what it is, in its name for a screen reader and with the icon
    // for everyone else.
    expect(screen.getByRole("button", { name: /^turnen/ }).getAttribute("aria-label")).toContain(
      t("tijdraster.algemeneFiche"),
    );
    expect(screen.getByRole("button", { name: /^turnen/ }).querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^bladeren stempelen/ }).querySelector("svg")).toBeNull();
  });

  it("geeft een activiteit een dekkende achtergrond, zodat de tint er niet door schemert", () => {
    toon([dag([activiteit("bladeren stempelen", "15:00", "16:00")])], { schooluren: [dinsdag] });

    const knop = screen.getAllByRole("button").find((el) => el.getAttribute("aria-label")?.startsWith("bladeren stempelen"));
    const vlak = knop?.closest(".group\\/blok") as HTMLElement;
    expect(vlak.className).not.toMatch(/bg-[\w-]+\/\d+/);
    expect(vlak.className).toContain("bg-[color-mix(");
  });

  it("laat elk uur planbaar, ook op de tint", () => {
    const gevraagd = vi.fn();
    toon([dag()], { schooluren: [dinsdag], onVoegToe: gevraagd });

    // The tint is under the empty column's button and catches nothing, so the invitation is still there.
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t("periode.voegToeOp", { dag: "dinsdag 8 september" })) }));
    expect(gevraagd).toHaveBeenCalled();
  });

  it("arceert niets op een weekdag zonder uren of op een gesloten dag, en opent dan op zeven uur", () => {
    const woensdagUren = { ...dinsdag, weekdag: 3 };
    const { container, unmount } = toon([dag()], { schooluren: [woensdagUren] });
    expect(container.querySelector("[data-schooltijd]")).toBeNull();
    expect((container.querySelector(".overflow-y-auto") as HTMLElement).scrollTop).toBe(7 * 56);
    unmount();

    const gesloten = toon([dag([], { isLesdag: false, sluitingsnaam: "Herfstvakantie" })], { schooluren: [dinsdag] });
    expect(gesloten.container.querySelector("[data-schooltijd]")).toBeNull();
  });

  it("zegt de schooluren in de dagkop voor wie de tint niet ziet", () => {
    toon([dag()], { schooluren: [dinsdag] });

    // The day view has no heading button, so the clause is spoken after the date as sr-only text.
    expect(
      screen.getByText((_, el) =>
        el?.classList.contains("sr-only") === true &&
        (el.textContent ?? "").includes(", schooldag van 8:30 tot 15:30, middagpauze van 12:00 tot 13:15"),
      ),
    ).toBeInTheDocument();
  });

  /**
   * The day and the two bands above it (owner, 2026-09-11).
   *
   * A run's name may be dropped only where a day on the same row is carrying it, and that day is the Monday. So the
   * rows without a Monday in them are the ones that used to draw two grey bars with nothing written on them: the day
   * view, and the phone's three-day week when it is anchored past Monday.
   */
  const lopendeReeks = [
    {
      subthemaId: "s1",
      subthemaNaam: "de speelhoek",
      themaId: "t1",
      themaNaam: "Ik en mijn klas",
      van: "2026-09-07",
      tot: "2026-09-18",
      aantalDagen: 4,
    },
  ];
  const midden = {
    magPlannen: true,
    fichemomenten: [],
    schooluren: undefined,
    reeksenPerDag: new Map([
      ["2026-09-10", lopendeReeks],
      ["2026-09-11", lopendeReeks],
      ["2026-09-12", lopendeReeks],
      ["2026-09-14", lopendeReeks],
    ]),
    vakken: [
      { plaatsingId: "p1", van: "2026-09-01", tot: "2026-10-01", themas: [{ id: "t1", naam: "Ik en mijn klas" }] },
    ],
    onVoegToe: () => {},
    onOpen: () => {},
    onOpenFiche: () => {},
    onVanDag: () => {},
    onWijzigTijd: () => {},
  };
  // The bands are links to the themapagina (FB-037), so these rows need a router.
  const toonRij = (datums: string[]) =>
    render(
      <MemoryRouter>
        <DndContext>
          <Tijdraster dagen={datums.map((datum) => dag([], { datum }))} {...midden} />
        </DndContext>
      </MemoryRouter>,
    );
  const themaLabels = () => screen.getAllByText(t("periode.themaVervolg", { naam: "Ik en mijn klas" }));

  it("noemt allebei de balken in de dagweergave, waar geen rij de naam draagt", () => {
    // One column, a Friday in the middle of both runs: what the owner was looking at.
    toonRij(["2026-09-11"]);
    expect(themaLabels()[0].className).not.toMatch(/hidden/);
    expect(screen.getByText(t("periode.subthemaVervolg", { naam: "de speelhoek" })).className).not.toMatch(/hidden/);
  });

  it("tekent thema en subthema over de dagen van de week als één balk, met een pijltje waar ze doorlopen", () => {
    // FB-090. The phone's three working days anchored past Monday, the row that used to draw nameless grey pieces.
    const { container } = toonRij(["2026-09-10", "2026-09-11", "2026-09-14"]);

    // One stop per bar, the name once, and no "…" that read as a cut-off name.
    expect(screen.getAllByRole("link", { name: t("periode.naarThema", { naam: "Ik en mijn klas" }) })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: t("periode.naarSubthema", { naam: "de speelhoek" }) })).toHaveLength(1);
    expect(screen.getAllByText("Ik en mijn klas")).toHaveLength(1);
    expect(screen.getAllByText("de speelhoek")).toHaveLength(1);
    expect(screen.queryByText(/…/)).toBeNull();

    // Both began before the first column and go on after the last: an arrow on each side of each bar.
    expect(container.querySelectorAll('[data-doorloop="voor"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-doorloop="na"]')).toHaveLength(2);
    const balk = screen.getByRole("link", { name: t("periode.naarThema", { naam: "Ik en mijn klas" }) }).parentElement;
    expect(balk?.style.gridColumn).toBe("1 / 4");
  });

  it("zegt tegen een schermlezer wat er op de dag loopt, want de balken zijn aria-hidden", () => {
    // The bands are `aria-hidden` on the promise that the day says the same facts once. This grid's day view has no
    // day button to carry them, so without this the subthema is readable on screen and nowhere else.
    toonRij(["2026-09-11"]);

    expect(screen.getByText(/de speelhoek/, { selector: ".sr-only" })).toBeInTheDocument();
    expect(screen.getByText(/Ik en mijn klas/, { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("hangt dezelfde zin aan de dagknop van de weekweergave", () => {
    render(
      <MemoryRouter>
        <DndContext>
          <Tijdraster dagen={[dag([], { datum: "2026-09-11" })]} {...midden} onKiesDag={() => {}} />
        </DndContext>
      </MemoryRouter>,
    );

    // One control, one reading: the button a screen reader lands on names the date AND what runs on it.
    expect(screen.getByRole("button", { name: /vrijdag 11 september.*de speelhoek/ })).toBeInTheDocument();
  });

  it("laat de dagkop van de weekweergave zijn eigen dag openen", () => {
    const geopend = vi.fn();
    render(
      <DndContext>
        <Tijdraster
          dagen={[dag(), dag([], { datum: "2026-09-09" })]}
          fichemomenten={[]}
          reeksenPerDag={new Map()}
          vakken={[]}
          schooluren={undefined}
          magPlannen
          onVoegToe={() => {}}
          onOpen={() => {}}
          onOpenFiche={() => {}}
          onVanDag={() => {}}
          onKiesDag={geopend}
          onWijzigTijd={() => {}}
        />
      </DndContext>,
    );

    fireEvent.click(screen.getByRole("button", { name: t("periode.openDag", { dag: "woensdag 9 september" }) }));
    expect(geopend).toHaveBeenCalledWith("2026-09-09");
  });

  it("toont geen nu-lijn en geen vandaag-merk op een week zonder vandaag erin", () => {
    const { container } = toon([dag()]);

    // 8 september 2026 is in the past, so neither half of the now-line may be drawn: not the rule itself
    // (the only `border-t-2` in this grid) and not the time label that keeps it from being colour alone.
    expect(container.querySelector(".border-t-2")).toBeNull();
    expect(screen.queryByText(t("periode.vandaag"))).not.toBeInTheDocument();
  });
});

/**
 * Empty space under a mouse (owner, 2026-09-14, TB-014): the quarter a click would pick lights up, and a press dragged
 * across the column asks for that stretch.
 *
 * jsdom reports every rectangle at zero, so a pointer's `clientY` is a distance from the top of the grid, which starts
 * at midnight: minute `m` is at `m * 56 / 60` pixels. One pixel is added so a pointer sits inside its quarter rather
 * than on the line above it. What these cannot see is the band's tint and whether the page scrolls under a drag; that
 * is the browser pass.
 */
describe("Tijdraster onder de muis", () => {
  const y = (minuut: number) => minuut * (56 / 60) + 1;
  const kolom = () => screen.getByRole("button", { name: t("periode.voegToeOp", { dag: "dinsdag 8 september" }) });

  // jsdom has no PointerEvent, so `fireEvent.pointerDown` would build a bare Event with no position and no pointer
  // type, and every gesture below would read as a keyboard's.
  beforeAll(() => {
    if (typeof window.PointerEvent === "function") return;
    class Aanwijzer extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    vi.stubGlobal("PointerEvent", Aanwijzer);
  });
  afterAll(() => vi.unstubAllGlobals());

  it("licht het kwartier onder de muis op, afgerond naar beneden, tot de muis weggaat", () => {
    toon([dag()]);

    // 9:42 is nearer to 9:45, but it is inside the quarter that starts at 9:30, and the band names that start: it is
    // what a click there asks for (the next test). A nearest-quarter band would say 9:45 here.
    fireEvent.pointerMove(kolom(), { clientY: y(9 * 60 + 42) });
    expect(screen.getByText("9:30")).toBeInTheDocument();

    // A button held down with no stretch of this column running (a block dragged across it) asks nothing.
    fireEvent.pointerMove(kolom(), { clientY: y(9 * 60 + 42), buttons: 1 });
    expect(screen.queryByText("9:30")).not.toBeInTheDocument();

    fireEvent.pointerMove(kolom(), { clientY: y(9 * 60 + 42) });
    fireEvent.pointerLeave(kolom());
    expect(screen.queryByText("9:30")).not.toBeInTheDocument();
  });

  it("vraagt bij een klik het kwartier dat oplicht, ook in zijn onderste helft", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    // 9:12 is nearer to 9:15 than to 9:00, but it is inside the 9:00 quarter, and that quarter is the one lit up.
    fireEvent.pointerDown(kolom(), { clientY: y(9 * 60 + 12) });
    fireEvent.pointerUp(kolom(), { clientY: y(9 * 60 + 12) });
    fireEvent.click(kolom(), { detail: 1, clientY: y(9 * 60 + 12) });

    // Once, and with no end: a press that stayed in its quarter is a click, and the activiteit's own length decides.
    expect(gevraagd).toHaveBeenCalledTimes(1);
    expect(gevraagd).toHaveBeenCalledWith("2026-09-08", 9 * 60);
  });

  it("plant het bereik dat de leerkracht sleept, en toont het terwijl ze sleept", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    fireEvent.pointerDown(kolom(), { clientY: y(9 * 60) });
    fireEvent.pointerMove(kolom(), { clientY: y(10 * 60 + 20), buttons: 1 });
    // Both quarters it touches are in it: from the start of the first to the end of the last.
    expect(screen.getByText(toonBereik(9 * 60, 10 * 60 + 30))).toBeInTheDocument();

    fireEvent.pointerUp(kolom(), { clientY: y(10 * 60 + 20) });
    fireEvent.click(kolom(), { detail: 1, clientY: y(10 * 60 + 20) });

    expect(gevraagd).toHaveBeenCalledTimes(1);
    expect(gevraagd).toHaveBeenCalledWith("2026-09-08", 9 * 60, 10 * 60 + 30);
    expect(screen.queryByText(toonBereik(9 * 60, 10 * 60 + 30))).not.toBeInTheDocument();
  });

  it("geeft omhoog gesleept hetzelfde bereik", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    fireEvent.pointerDown(kolom(), { clientY: y(10 * 60 + 20) });
    fireEvent.pointerMove(kolom(), { clientY: y(9 * 60 + 5), buttons: 1 });
    fireEvent.pointerUp(kolom(), { clientY: y(9 * 60 + 5) });

    expect(gevraagd).toHaveBeenCalledWith("2026-09-08", 9 * 60, 10 * 60 + 30);
  });

  it("laat een bereik los op Escape, zonder iets te openen", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    fireEvent.pointerDown(kolom(), { clientY: y(9 * 60) });
    fireEvent.pointerMove(kolom(), { clientY: y(11 * 60), buttons: 1 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText(toonBereik(9 * 60, 11 * 60 + 15))).not.toBeInTheDocument();

    // The button is still down after Escape, so the release and the click that follows it must not ask either.
    fireEvent.pointerUp(kolom(), { clientY: y(11 * 60) });
    fireEvent.click(kolom(), { detail: 1, clientY: y(11 * 60) });
    expect(gevraagd).not.toHaveBeenCalled();
  });

  it("laat een tik op een aanraakscherm het kwartier onder de vinger kiezen, zonder bereik", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    // A finger drawn down the grid scrolls it, so a touch press starts no stretch; the click alone answers.
    fireEvent.pointerDown(kolom(), { clientY: y(13 * 60 + 40), pointerType: "touch" });
    fireEvent.pointerMove(kolom(), { clientY: y(14 * 60 + 40), pointerType: "touch" });
    fireEvent.pointerUp(kolom(), { clientY: y(14 * 60 + 40), pointerType: "touch" });
    fireEvent.click(kolom(), { detail: 1, clientY: y(13 * 60 + 40) });

    expect(gevraagd).toHaveBeenCalledTimes(1);
    expect(gevraagd).toHaveBeenCalledWith("2026-09-08", 13 * 60 + 30);
  });

  it("vraagt aan het einde van de dag het kwartier dat de band toont, en sleept niet tot middernacht", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    // The last quarter a click may start in still fits an activiteit of the default length (50 minutes): 23:00. The
    // band stops there too, so what it names is what the click asks for, never an off-grid 23:10. Two "23:00" on
    // screen: the hour label in the gutter, and the band.
    fireEvent.pointerMove(kolom(), { clientY: y(23 * 60 + 40) });
    expect(screen.getAllByText("23:00")).toHaveLength(2);
    fireEvent.pointerDown(kolom(), { clientY: y(23 * 60 + 40) });
    fireEvent.pointerUp(kolom(), { clientY: y(23 * 60 + 40) });
    expect(gevraagd).toHaveBeenLastCalledWith("2026-09-08", 23 * 60);

    // A stretch ends a quarter before midnight at the latest: the wire format stops at 23:59, and "tot 24:00" would
    // say one time while another was stored.
    fireEvent.pointerDown(kolom(), { clientY: y(22 * 60) });
    fireEvent.pointerMove(kolom(), { clientY: y(23 * 60 + 55), buttons: 1 });
    fireEvent.pointerUp(kolom(), { clientY: y(23 * 60 + 55) });
    expect(gevraagd).toHaveBeenLastCalledWith("2026-09-08", 22 * 60, 23 * 60 + 45);
  });

  it("laat een bereik vallen als de knop is losgelaten waar de kolom het niet hoorde", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    fireEvent.pointerDown(kolom(), { clientY: y(9 * 60) });
    fireEvent.pointerMove(kolom(), { clientY: y(10 * 60), buttons: 1 });
    expect(screen.getByText(toonBereik(9 * 60, 10 * 60 + 15))).toBeInTheDocument();

    // The next move says no button is down: the release went somewhere else (a context menu, another window).
    fireEvent.pointerMove(kolom(), { clientY: y(11 * 60), buttons: 0 });
    expect(screen.queryByText(toonBereik(9 * 60, 10 * 60 + 15))).not.toBeInTheDocument();

    // So a later release on this column, such as the end of a block drag dropped here, finishes nothing.
    fireEvent.pointerUp(kolom(), { clientY: y(11 * 60) });
    expect(gevraagd).not.toHaveBeenCalled();
  });

  it("hoort een klik zonder indrukken ervoor, ook na een klik met de muis", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    // A mouse click: answered on release, and the click that follows it is not asked a second time.
    fireEvent.pointerDown(kolom(), { clientY: y(9 * 60) });
    fireEvent.pointerUp(kolom(), { clientY: y(9 * 60) });
    fireEvent.click(kolom(), { detail: 1, clientY: y(9 * 60) });
    expect(gevraagd).toHaveBeenCalledTimes(1);

    // A click with no press before it (some assistive technology sends those) is still heard, at its own quarter.
    fireEvent.click(kolom(), { detail: 1, clientY: y(14 * 60 + 10) });
    expect(gevraagd).toHaveBeenCalledTimes(2);
    expect(gevraagd).toHaveBeenLastCalledWith("2026-09-08", 14 * 60);
  });

  it("beslist klik of bereik op hetzelfde kwartier, ook in het laatste uur", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    // A press at 23:40 with a tremble inside its own quarter is a click: 23:00, the latest a click may start, with no
    // end, so the activiteit keeps its own length.
    fireEvent.pointerDown(kolom(), { clientY: y(23 * 60 + 40) });
    fireEvent.pointerMove(kolom(), { clientY: y(23 * 60 + 41), buttons: 1 });
    fireEvent.pointerUp(kolom(), { clientY: y(23 * 60 + 41) });
    expect(gevraagd).toHaveBeenLastCalledWith("2026-09-08", 23 * 60);

    // And a real drag up out of that quarter is a stretch, however late it starts.
    fireEvent.pointerDown(kolom(), { clientY: y(23 * 60 + 40) });
    fireEvent.pointerMove(kolom(), { clientY: y(23 * 60 + 5), buttons: 1 });
    fireEvent.pointerUp(kolom(), { clientY: y(23 * 60 + 5) });
    expect(gevraagd).toHaveBeenLastCalledWith("2026-09-08", 23 * 60, 23 * 60 + 45);
  });

  it("laat een bereik vallen als de kolom de aanwijzer kwijtraakt, maar niet na een gewone loslating", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    // Capture lost in the middle of a stretch: whatever release comes later finishes nothing.
    fireEvent.pointerDown(kolom(), { clientY: y(9 * 60) });
    fireEvent.pointerMove(kolom(), { clientY: y(10 * 60), buttons: 1 });
    fireEvent.lostPointerCapture(kolom(), { bubbles: true });
    expect(screen.queryByText(toonBereik(9 * 60, 10 * 60 + 15))).not.toBeInTheDocument();
    fireEvent.pointerUp(kolom(), { clientY: y(10 * 60) });
    expect(gevraagd).not.toHaveBeenCalled();

    // A normal release lets capture go right after it and before its click: still exactly one question.
    fireEvent.pointerDown(kolom(), { clientY: y(13 * 60) });
    fireEvent.pointerUp(kolom(), { clientY: y(13 * 60) });
    fireEvent.lostPointerCapture(kolom(), { bubbles: true });
    fireEvent.click(kolom(), { detail: 1, clientY: y(13 * 60) });
    expect(gevraagd).toHaveBeenCalledTimes(1);
    expect(gevraagd).toHaveBeenCalledWith("2026-09-08", 13 * 60);
  });

  it("laat een druk die geen eigen klik krijgt er later geen inslikken", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    // A right press opens a context menu and is never followed by a click on this column.
    fireEvent.pointerDown(kolom(), { clientY: y(9 * 60), button: 2 });
    fireEvent.pointerUp(kolom(), { clientY: y(9 * 60), button: 2 });
    fireEvent.click(kolom(), { detail: 1, clientY: y(14 * 60 + 10) });
    expect(gevraagd).toHaveBeenCalledTimes(1);
    expect(gevraagd).toHaveBeenLastCalledWith("2026-09-08", 14 * 60);

    // Nor is a stretch whose release went somewhere else.
    fireEvent.pointerDown(kolom(), { clientY: y(9 * 60) });
    fireEvent.pointerMove(kolom(), { clientY: y(10 * 60), buttons: 1 });
    fireEvent.pointerMove(kolom(), { clientY: y(10 * 60), buttons: 0 });
    fireEvent.click(kolom(), { detail: 1, clientY: y(15 * 60 + 10) });
    expect(gevraagd).toHaveBeenCalledTimes(2);
    expect(gevraagd).toHaveBeenLastCalledWith("2026-09-08", 15 * 60);
  });

  it("toont pas een bereik als de druk zijn eerste kwartier verlaat", () => {
    toon([dag()]);

    // Pressed at 9:00 and trembling inside that quarter: still a click, which gets the activiteit's own length, so no
    // stretch is promised on screen.
    fireEvent.pointerDown(kolom(), { clientY: y(9 * 60) });
    fireEvent.pointerMove(kolom(), { clientY: y(9 * 60 + 10), buttons: 1 });
    expect(screen.queryByText(/^\d{1,2}:\d{2} - \d{1,2}:\d{2}$/)).not.toBeInTheDocument();

    // Into the next quarter, and the stretch appears: both quarters, 9:00 to 9:30.
    fireEvent.pointerMove(kolom(), { clientY: y(9 * 60 + 20), buttons: 1 });
    expect(screen.getByText(toonBereik(9 * 60, 9 * 60 + 30))).toBeInTheDocument();
  });
});

/**
 * The info icon on a block (FB-018): the goals one press away, without opening the block or moving it. From half an hour
 * up, where the 24-pixel target fits; below that the sheet the block opens lists them. The goals themselves, their text
 * and the detail they open, are `Doelinfo.test.tsx`; these blocks carry none, so no row needs a query client.
 */
describe("Tijdraster: doelen van een blok", () => {
  const info = (naam: string) => ({ name: t("doelinfo.open", { naam }) });

  it("zet een info-icoon op een blok van een half uur of langer, en niet op een korter", () => {
    toon([dag([activiteit("kringgesprek", "09:00:00", "09:30:00"), activiteit("kort", "11:00:00", "11:20:00")])]);

    expect(screen.getByRole("button", info("kringgesprek"))).toBeInTheDocument();
    expect(screen.queryByRole("button", info("kort"))).not.toBeInTheDocument();
  });

  it("toont de doelen zonder het blok te openen", () => {
    const geopend = vi.fn();
    toon([dag([activiteit("kringgesprek", "09:00:00", "09:50:00")])], { onOpen: geopend });

    fireEvent.click(screen.getByRole("button", info("kringgesprek")));

    const venster = screen.getByRole("dialog", { name: "kringgesprek" });
    expect(venster).toHaveTextContent(t("doelinfo.geen"));
    expect(geopend).not.toHaveBeenCalled();
  });

  it("geeft ook wie de klas alleen mag bekijken het icoon, want doelen lezen is geen plannen", () => {
    toon([dag([activiteit("kringgesprek", "09:00:00", "09:50:00")])], { magPlannen: false });

    expect(screen.getByRole("button", info("kringgesprek"))).toBeInTheDocument();
  });

  it("zet een icoon op een algemene fiche met haar doelen, en niet zolang die doelen er niet zijn", () => {
    toon([dag()], {
      fichemomenten: [
        fiche("10:30:00", "11:30:00"),
        { ...fiche("13:00:00", "14:00:00"), momentId: "fm-2", naam: "onthaal", doelen: [] },
      ],
    });

    // Without the fiche list there is nothing true to say about its goals, so there is no icon to say it.
    expect(screen.queryByRole("button", info("turnen"))).not.toBeInTheDocument();
    expect(screen.getByRole("button", info("onthaal"))).toBeInTheDocument();
  });
});

describe("Tijdraster, de stroken in een week met een gesloten maandag (FB-039)", () => {
  it("noemt thema en subthema op de eerste lesdag en maakt daar de tabstop", () => {
    const reeks: Subthemareeks = {
      subthemaId: "s1",
      subthemaNaam: "de speelhoek",
      themaId: "t1",
      themaNaam: "Ik en mijn klas",
      van: "2026-09-01",
      tot: "2026-09-18",
      aantalDagen: 14,
    };
    const dagen = [
      dag([], { datum: "2026-09-07", isLesdag: false, sluitingsnaam: "Facultatieve vrije dag" }),
      dag([], { datum: "2026-09-08" }),
      dag([], { datum: "2026-09-09" }),
    ];
    render(
      <MemoryRouter>
        <DndContext>
          <Tijdraster
            dagen={dagen}
            fichemomenten={[]}
            reeksenPerDag={new Map([["2026-09-08", [reeks]], ["2026-09-09", [reeks]]])}
            vakken={[{ plaatsingId: "p1", van: "2026-09-01", tot: "2026-10-09", themas: [{ id: "t1", naam: "Ik en mijn klas" }] }]}
            schooluren={undefined}
            magPlannen={false}
            onVoegToe={() => {}}
            onOpen={() => {}}
            onOpenFiche={() => {}}
            onVanDag={() => {}}
            onKiesDag={() => {}}
            onWijzigTijd={() => {}}
          />
        </DndContext>
      </MemoryRouter>,
    );

    // Tuesday carries the names and the one stop per band; Wednesday's bands are for a pointer only.
    expect(screen.getAllByRole("link", { name: t("periode.naarThema", { naam: "Ik en mijn klas" }) })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: t("periode.naarSubthema", { naam: "de speelhoek" }) })).toHaveLength(1);
  });
});

describe("Tijdraster, de themabalken van de week (FB-090)", () => {
  const reeks: Subthemareeks = {
    subthemaId: "s1",
    subthemaNaam: "de speelhoek",
    themaId: "t1",
    themaNaam: "Herfst",
    van: "2026-09-14",
    tot: "2026-09-16",
    aantalDagen: 3,
  };
  const week = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"];

  function toonWeek(onPlanSubthema?: (plaatsingId: string) => void) {
    return render(
      <MemoryRouter>
        <DndContext>
          <Tijdraster
            dagen={week.map((datum) => dag([], { datum }))}
            fichemomenten={[]}
            reeksenPerDag={new Map(week.slice(0, 3).map((datum) => [datum, [reeks]]))}
            vakken={[
              { plaatsingId: "p1", van: "2026-09-07", tot: "2026-09-16", themas: [{ id: "t1", naam: "Herfst" }] },
              { plaatsingId: "p2", van: "2026-09-17", tot: "2026-10-02", themas: [{ id: "t2", naam: "Dieren" }] },
            ]}
            schooluren={undefined}
            magPlannen
            onVoegToe={() => {}}
            onOpen={() => {}}
            onOpenFiche={() => {}}
            onVanDag={() => {}}
            onKiesDag={() => {}}
            onWijzigTijd={() => {}}
            onPlanSubthema={onPlanSubthema}
          />
        </DndContext>
      </MemoryRouter>,
    );
  }

  it("zet twee balken waar het ene thema stopt en het volgende begint, elk met zijn naam", () => {
    toonWeek();

    const herfst = screen.getByRole("link", { name: t("periode.naarThema", { naam: "Herfst" }) });
    const dieren = screen.getByRole("link", { name: t("periode.naarThema", { naam: "Dieren" }) });
    expect(herfst.parentElement?.style.gridColumn).toBe("1 / 4");
    expect(dieren.parentElement?.style.gridColumn).toBe("4 / 6");
    expect(screen.getByText("Herfst")).toBeInTheDocument();
    expect(screen.getByText("Dieren")).toBeInTheDocument();
  });

  it("biedt Subthema inplannen op de themabalk waar er ruimte is, en niet waar elke dag al een subthema heeft", () => {
    const gepland = vi.fn();
    toonWeek(gepland);

    // Herfst has a subthema on each of its three days: no room there. Dieren has none.
    expect(screen.queryByRole("button", { name: t("periode.planSubthemaIn", { naam: "Herfst" }) })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t("periode.planSubthemaIn", { naam: "Dieren" }) }));
    expect(gepland).toHaveBeenCalledWith("p2");
  });
});
