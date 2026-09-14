import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tijdraster, type Ficheblokje, type Hoekblokje } from "./Tijdraster";
import type { Agendadag } from "./roosterdagen";
import type { GeplandeActiviteit } from "../../lib/types";
import { STANDAARDBEGIN, toonBereik } from "./tijd";
import { t } from "../../i18n";

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

const hoek = (begin: string, einde: string): Hoekblokje => ({
  plaatsingId: "hp-1",
  momentId: "hm-1",
  naam: "bouwhoek",
  datum: "2026-09-08",
  begin,
  einde,
});

const fiche = (begin: string, einde: string): Ficheblokje => ({
  plaatsingId: "fp-1",
  momentId: "fm-1",
  naam: "turnen",
  datum: "2026-09-08",
  begin,
  einde,
});

function toon(
  dagen: Agendadag[],
  opties: {
    hoekmomenten?: Hoekblokje[];
    fichemomenten?: Ficheblokje[];
    onVoegToe?: (datum: string, begin: number) => void;
    onOpenHoek?: (plaatsingId: string) => void;
    onOpen?: (activiteit: GeplandeActiviteit, datum: string) => void;
    onOpenFiche?: (plaatsingId: string, momentId: string) => void;
    magPlannen?: boolean;
  } = {},
) {
  return render(
    <DndContext>
      <Tijdraster
        dagen={dagen}
        hoekmomenten={opties.hoekmomenten ?? []}
        fichemomenten={opties.fichemomenten ?? []}
        reeksenPerDag={new Map()}
        vakken={[]}
        magPlannen={opties.magPlannen ?? true}
        onVoegToe={opties.onVoegToe ?? (() => {})}
        onOpen={opties.onOpen ?? (() => {})}
        onOpenHoek={opties.onOpenHoek ?? (() => {})}
        onOpenFiche={opties.onOpenFiche ?? (() => {})}
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

describe("Tijdraster", () => {
  it("tekent een blok op de hoogte van zijn eigen uren", () => {
    toon([dag([activiteit("kringgesprek", "09:00:00", "09:50:00")])]);

    const knop = screen.getByRole("button", { name: /kringgesprek/ });
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

    expect(plaats(screen.getByRole("button", { name: /kring/ })).width).toBe("50%");
    expect(plaats(screen.getByRole("button", { name: /lezen/ })).left).toBe("50%");
    // The afternoon touches neither of them, so it gets its column back: drawing it half width would make the day
    // look busier than it is.
    expect(plaats(screen.getByRole("button", { name: /turnen/ })).width).toBe("100%");
  });

  it("vraagt om een activiteit op het uur waar de leerkracht drukt", () => {
    const gevraagd = vi.fn();
    toon([dag()], { onVoegToe: gevraagd });

    // A click with no pointer position behind it (a keyboard press, and every click in jsdom) means the ordinary
    // start of a morning rather than whatever hour the top of the grid happens to be.
    fireEvent.click(screen.getByRole("button", { name: t("periode.voegToeOp", { dag: "dinsdag 8 september" }) }));

    expect(gevraagd).toHaveBeenCalledWith("2026-09-08", STANDAARDBEGIN);
  });

  it("tekent een hoek als blok op de dag zelf en opent zijn plaatsing", () => {
    const geopend = vi.fn();
    toon([dag()], { hoekmomenten: [hoek("13:30:00", "14:20:00")], onOpenHoek: geopend });

    const knop = screen.getByRole("button", { name: /bouwhoek/ });
    expect(plaats(knop).top).toBe(`${810 * (56 / 60)}px`);

    fireEvent.click(knop);
    expect(geopend).toHaveBeenCalledWith("hp-1");
  });

  /*
    E6-02: the grid's three gestures are the klas's planning (ADR-0030 §3, R7). A gebruiker who may not plan this klas
    reads it: blocks still open, and nothing invites a placement, stretches or drags. The drag semantics matter as much
    as the pixels, because dnd-kit's attributes tell a screen reader a block is "draggable".
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

    const blok = screen.getByRole("button", { name: /kringgesprek/ });
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
    expect(screen.getByRole("button", { name: /kringgesprek/ })).toHaveAttribute("aria-roledescription");
  });

  // An algemene fiche is the klas's planning too (ADR-0030 §3, R7): a reader opens it and cannot drag it (merge of
  // E6-02 with the agenda's algemene fiches).
  it("laat wie deze klas niet mag plannen een algemene fiche openen, niet slepen", () => {
    const geopend = vi.fn();
    toon([dag()], { fichemomenten: [fiche("10:30:00", "11:30:00")], onOpenFiche: geopend, magPlannen: false });

    const knop = screen.getByRole("button", { name: /turnen/ });
    expect(knop).not.toHaveAttribute("aria-roledescription");
    fireEvent.click(knop);
    expect(geopend).toHaveBeenCalledWith("fp-1", "fm-1");
  });

  it("tekent een algemene fiche als blok met haar eigen onderschrift, en opent dat ene moment", () => {
    const geopend = vi.fn();
    toon([dag()], { fichemomenten: [fiche("10:30:00", "11:30:00")], onOpenFiche: geopend });

    const knop = screen.getByRole("button", { name: /turnen/ });
    expect(plaats(knop).top).toBe(`${630 * (56 / 60)}px`);
    // Told apart from a hoek and an activiteit by a word, not by a hue (Art. XII): an hour is tall enough to print it.
    expect(screen.getByText(t("tijdraster.algemeneFiche"))).toBeInTheDocument();

    // The occurrence travels with the placement: its sheet offers that one day's hours without a drag.
    fireEvent.click(knop);
    expect(geopend).toHaveBeenCalledWith("fp-1", "fm-1");
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
    expect(plaats(screen.getByRole("button", { name: /uitstap/ })).top).toBe(`${390 * (56 / 60)}px`);

    // And what a teacher sees of it before scrolling is 7:00 downwards. jsdom lays nothing out, so the scroll
    // position is the only half of "default 7u-18u" it can check; the height of the window is the browser pass.
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroller.scrollTop).toBe(7 * 56);
  });

  /**
   * The day and the two bands above it (owner, 2026-09-11).
   *
   * A run's name may be dropped only where a day on the same row is carrying it, and that day is the Monday. So the
   * rows without a Monday in them are the ones that used to draw two grey bars with nothing written on them: the day
   * view, and the phone's three-day week when it is anchored past Monday.
   */
  const lopendeReeks = [
    { subthemaId: "s1", subthemaNaam: "de speelhoek", van: "2026-09-07", tot: "2026-09-18", aantalDagen: 4 },
  ];
  const midden = {
    magPlannen: true,
    hoekmomenten: [],
    fichemomenten: [],
    reeksenPerDag: new Map([
      ["2026-09-10", lopendeReeks],
      ["2026-09-11", lopendeReeks],
      ["2026-09-12", lopendeReeks],
      ["2026-09-14", lopendeReeks],
    ]),
    vakken: [
      { blokStart: "2026-09-01", van: "2026-09-01", tot: "2026-10-01", themas: [{ id: "t1", naam: "Ik en mijn klas" }] },
    ],
    onVoegToe: () => {},
    onOpen: () => {},
    onOpenHoek: () => {},
    onOpenFiche: () => {},
    onWijzigTijd: () => {},
  };
  const toonRij = (datums: string[]) =>
    render(
      <DndContext>
        <Tijdraster dagen={datums.map((datum) => dag([], { datum }))} {...midden} />
      </DndContext>,
    );
  const themaLabels = () => screen.getAllByText(t("periode.themaVervolg", { naam: "Ik en mijn klas" }));

  it("noemt allebei de balken op een rij zonder maandag erin, in de dag en op een telefoonweek", () => {
    // One column, a Friday in the middle of both runs: what the owner was looking at.
    const dagweergave = toonRij(["2026-09-11"]);
    expect(themaLabels()[0].className).not.toMatch(/hidden/);
    expect(screen.getByText(t("periode.subthemaVervolg", { naam: "de speelhoek" })).className).not.toMatch(/hidden/);
    dagweergave.unmount();

    // The phone's week is three days starting at the anchored one, so an anchor past Monday gives a row with no
    // Monday in it. Same two nameless bars, and the reason the rule counts Mondays rather than columns.
    toonRij(["2026-09-10", "2026-09-11", "2026-09-12"]);
    expect(themaLabels().every((label) => !/hidden/.test(label.className))).toBe(true);
    expect(screen.getAllByText(t("periode.subthemaVervolg", { naam: "de speelhoek" }))).toHaveLength(3);
  });

  it("laat de rest van een rij mét maandag wel zwijgen", () => {
    // The rule the week view had, and keeps. Monday carries the name for the row; the Tuesday beside it renders no
    // subthema strip text at all, and its thema band keeps the class that takes the word away from `xl`.
    toonRij(["2026-09-14", "2026-09-15"]);

    // Monday's own label says "… de speelhoek" too, because the run began the week before: it is the carrier, not
    // the start. Exactly one, so the Tuesday is the day that went quiet.
    expect(screen.getAllByText(t("periode.subthemaVervolg", { naam: "de speelhoek" }))).toHaveLength(1);
    expect(themaLabels()).toHaveLength(1);
    expect(themaLabels()[0].className).toMatch(/hidden/);
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
      <DndContext>
        <Tijdraster dagen={[dag([], { datum: "2026-09-11" })]} {...midden} onKiesDag={() => {}} />
      </DndContext>,
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
          hoekmomenten={[]}
          fichemomenten={[]}
          reeksenPerDag={new Map()}
          vakken={[]}
          magPlannen
          onVoegToe={() => {}}
          onOpen={() => {}}
          onOpenHoek={() => {}}
          onOpenFiche={() => {}}
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
