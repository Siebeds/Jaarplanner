import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Lesweek, Themaplaatsing } from "../../lib/types";
import { t } from "../../i18n";
import { volleDag } from "../../lib/datum";
import { Jaartijdlijn } from "./Jaartijdlijn";
import { bouwRaster, eindeKort, eindeZin } from "./jaarraster";

/**
 * The year timeline (ADR-0049): a column of five day tracks per lesweek, one gap per vacation, bars that start and end
 * on their own weekday, and a lesweek without a thema that says so.
 *
 * The calendar: school from Monday 19 October, the herfstvakantie the week of 2 November, school again from
 * 9 November.
 */
const LESWEKEN: Lesweek[] = [
  { maandag: "2026-10-19", heeftThema: true },
  { maandag: "2026-10-26", heeftThema: true },
  { maandag: "2026-11-09", heeftThema: true },
  { maandag: "2026-11-16", heeftThema: false },
];

const VAKANTIES = [{ naam: "Herfstvakantie", start: "2026-11-02", eind: "2026-11-06" }];

function plaatsing(overschrijf: Partial<Themaplaatsing>): Themaplaatsing {
  return {
    id: "p",
    themaId: "t-herfst",
    themaNaam: "Herfst",
    van: "2026-10-19",
    tot: "2026-10-30",
    isVervallen: false,
    status: "Manueel",
    aiMotivatie: null,
    vergrendeld: false,
    doelcodes: [],
    duurWeken: 3,
    reeks: null,
    ...overschrijf,
  };
}

const REEKS = {
  aantalDelen: 2,
  reeksVan: "2026-10-19",
  reeksTot: "2026-11-13",
  weken: 3,
  eindeAangepast: false,
  stoptBijEindeSchooljaar: false,
};

const DEEL_1 = plaatsing({ id: "p-1", reeks: { ...REEKS, deel: 1 } });
const DEEL_2 = plaatsing({ id: "p-2", van: "2026-11-11", tot: "2026-11-13", reeks: { ...REEKS, deel: 2 } });

describe("bouwRaster", () => {
  const raster = bouwRaster(LESWEKEN, VAKANTIES);

  it("geeft elke lesweek vijf sporen en de vakantie één gat met haar naam", () => {
    expect(raster.kolommen.map((k) => (k.soort === "week" ? k.maandag : `gat ${k.naam}`))).toEqual([
      "2026-10-19",
      "2026-10-26",
      "gat Herfstvakantie",
      "2026-11-09",
      "2026-11-16",
    ]);
    expect(raster.sporen.split("repeat(5").length - 1).toBe(4);
  });

  it("zet een dag op zijn eigen weekdag, een vakantiedag in het gat en een weekend op de vrijdag", () => {
    expect(raster.spoorVan("2026-10-19")).toBe(1);
    expect(raster.spoorVan("2026-10-23")).toBe(5);
    expect(raster.spoorVan("2026-10-25")).toBe(5);
    expect(raster.spoorVan("2026-10-26")).toBe(6);
    expect(raster.spoorVan("2026-11-04")).toBe(11);
    expect(raster.spoorVan("2026-11-11")).toBe(14);
  });

  it("noemt elke maand bij de eerste week waarvan de woensdag erin valt", () => {
    expect(raster.maanden.map((m) => [m.maandag, m.naam])).toEqual([
      ["2026-10-19", "oktober"],
      ["2026-11-09", "november"],
    ]);
  });
});

describe("Jaartijdlijn", () => {
  function toon(magBewerken: boolean) {
    const onKies = vi.fn();
    const onVoegToeInWeek = vi.fn();
    render(
      <Jaartijdlijn
        lesweken={LESWEKEN}
        onderbrekingen={VAKANTIES}
        plaatsingen={[DEEL_1, DEEL_2]}
        gekozenId="p-2"
        magBewerken={magBewerken}
        bezig={false}
        onKies={onKies}
        onVerschuif={vi.fn()}
        onVoegToeInWeek={onVoegToeInWeek}
      />,
    );
    return { onKies, onVoegToeInWeek };
  }

  it("toont elk deel als balk met zijn plaats in het thema, en opent een deel", () => {
    const { onKies } = toon(true);

    const eerste = screen.getByRole("button", { name: new RegExp(`^Herfst, ${volleDag("2026-10-19")}`) });
    expect(eerste).toHaveTextContent(t("plan.deel", { deel: 1, aantal: 2 }));
    expect(screen.getByRole("button", { name: new RegExp(`^Herfst, ${volleDag("2026-11-11")}`) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(eerste);
    expect(onKies).toHaveBeenCalledWith("p-1");
  });

  it("noemt de vakantie in het gat", () => {
    toon(true);
    expect(screen.getByText("Herfstvakantie")).toBeInTheDocument();
  });

  it("zegt bij een lesweek zonder thema dat er geen is, en laat er een toevoegen", () => {
    const { onVoegToeInWeek } = toon(true);

    const leeg = screen.getByRole("button", {
      name: t("plan.geenThemaWeekAria", { datum: volleDag("2026-11-16") }),
    });
    expect(leeg).toHaveTextContent(t("plan.geenThemaWeek"));
    fireEvent.click(leeg);
    expect(onVoegToeInWeek).toHaveBeenCalledWith("2026-11-16");
  });

  it("zegt het ook aan wie alleen mag lezen, zonder knop", () => {
    toon(false);

    expect(screen.getByRole("img", { name: t("plan.weekZonderThemaAria", { datum: volleDag("2026-11-16") }) }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thema toevoegen/ })).toBeNull();
  });

  it("zegt op de balk dat het einde is aangepast", () => {
    render(
      <Jaartijdlijn
        lesweken={LESWEKEN}
        onderbrekingen={VAKANTIES}
        plaatsingen={[plaatsing({ id: "p-k", reeks: { ...REEKS, aantalDelen: 1, deel: 1, weken: 2, eindeAangepast: true } })]}
        gekozenId={null}
        magBewerken
        bezig={false}
        onKies={vi.fn()}
        onVerschuif={vi.fn()}
        onVoegToeInWeek={vi.fn()}
      />,
    );

    const balk = screen.getByRole("button", { name: /^Herfst/ });
    expect(balk).toHaveTextContent(eindeKort(2, 3));
    expect(balk).toHaveAccessibleName(expect.stringContaining(eindeZin(2, 3)));
  });
});

describe("eindeZin", () => {
  it("zegt niet '5 van 5 weken' voor een reeks die enkele dagen langer loopt", () => {
    expect(eindeZin(5, 5)).toBe(t("plan.eindeLanger", { duur: 5 }));
    expect(eindeKort(5, 5)).toBe(t("plan.eindeLangerKort", { duur: 5 }));
    expect(eindeZin(4, 5)).toBe(t("plan.eindeAangepast", { weken: 4, duur: 5 }));
  });
});
