import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tijdraster, type Hoekblokje } from "./Tijdraster";
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

function toon(
  dagen: Agendadag[],
  opties: {
    hoekmomenten?: Hoekblokje[];
    onVoegToe?: (datum: string, begin: number) => void;
    onOpenHoek?: (plaatsingId: string) => void;
  } = {},
) {
  return render(
    <DndContext>
      <Tijdraster
        dagen={dagen}
        hoekmomenten={opties.hoekmomenten ?? []}
        reeksenPerDag={new Map()}
        vakken={[]}
        onVoegToe={opties.onVoegToe ?? (() => {})}
        onOpen={() => {}}
        onOpenHoek={opties.onOpenHoek ?? (() => {})}
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
    // The grid starts at 7:00 and an hour is 56 pixels: 9:00 is two hours down, and 50 minutes is 46.67 of them.
    expect(plaats(knop).top).toBe(`${120 * (56 / 60)}px`);
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
    expect(plaats(knop).top).toBe(`${390 * (56 / 60)}px`);

    fireEvent.click(knop);
    expect(geopend).toHaveBeenCalledWith("hp-1");
  });

  it("biedt een gesloten dag niets aan en zegt waarom", () => {
    const gevraagd = vi.fn();
    toon([dag([], { isLesdag: false, sluitingsnaam: "Herfstvakantie" })], { onVoegToe: gevraagd });

    expect(screen.getByText("Herfstvakantie")).toBeInTheDocument();
    // No invitation on a day the server would refuse a placement on (the E3-06 rule).
    expect(screen.queryByRole("button", { name: /Activiteit toevoegen/ })).not.toBeInTheDocument();
    expect(gevraagd).not.toHaveBeenCalled();
  });

  it("verbreedt het raster voor een blok dat voor zeven uur begint", () => {
    toon([dag([activiteit("uitstap", "06:30:00", "16:00:00")])]);

    // The grid now starts at 6:00, so the block sits half an hour down rather than being clipped at the top.
    expect(plaats(screen.getByRole("button", { name: /uitstap/ })).top).toBe(`${30 * (56 / 60)}px`);
  });

  it("laat de dagkop van de weekweergave zijn eigen dag openen", () => {
    const geopend = vi.fn();
    render(
      <DndContext>
        <Tijdraster
          dagen={[dag(), dag([], { datum: "2026-09-09" })]}
          hoekmomenten={[]}
          reeksenPerDag={new Map()}
          vakken={[]}
          onVoegToe={() => {}}
          onOpen={() => {}}
          onOpenHoek={() => {}}
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
