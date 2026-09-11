import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dagonderschrift } from "./Dagonderschrift";
import type { Themavak } from "./themavakken";
import { periode as periodeTekst } from "../../lib/datum";
import { t } from "../../i18n";

/**
 * The caption's sentences, one per state of the day.
 *
 * "No period" has four causes and the caption used to answer all of them with "Tussen twee periodes"
 * and "Nog geen thema": outside the school year, after the last period, while the rooster loads, and
 * genuinely between two periods. Only the last one earns the sentence.
 */
const schooljaar = {
  start: "2026-09-01",
  eind: "2027-06-30",
  blokken: [
    { start: "2026-09-01", eind: "2026-10-01" },
    { start: "2026-10-02", eind: "2026-11-01" },
    { start: "2026-11-09", eind: "2026-12-20" },
  ],
};

const vak = (themas: Themavak["themas"]): Themavak => ({
  blokStart: "2026-09-01",
  van: "2026-09-01",
  tot: "2026-10-01",
  themas,
});

const toon = (props: Partial<Parameters<typeof Dagonderschrift>[0]> = {}) =>
  render(
    <Dagonderschrift
      weekLabel="Week 37"
      dagweergave
      datum="2026-09-11"
      schooljaar={schooljaar}
      vakken={[vak([{ id: "t1", naam: "Ik en mijn klas" }])]}
      planGeladen
      {...props}
    />,
  );

describe("Dagonderschrift", () => {
  it("noemt week, periode en thema op een dag in een periode", () => {
    toon();
    expect(screen.getByText("Week 37")).toBeInTheDocument();
    expect(screen.getByText(t("periode.periodeLabel"))).toBeInTheDocument();
    expect(screen.getByText(periodeTekst("2026-09-01", "2026-10-01"))).toBeInTheDocument();
    expect(screen.getByText("Ik en mijn klas")).toBeInTheDocument();
  });

  it("zegt een schermlezer dat de naam het thema is", () => {
    toon();
    expect(screen.getByText(t("periode.dagThema", { naam: "Ik en mijn klas" }))).toBeInTheDocument();
  });

  it("zegt dat een periode zonder thema nog geen thema heeft", () => {
    toon({ vakken: [vak([])] });
    expect(screen.getByText(t("periode.geenThema"))).toBeInTheDocument();
  });

  it("telt twee thema's met dezelfde naam als twee", () => {
    toon({ vakken: [vak([{ id: "a", naam: "Herfst" }, { id: "b", naam: "Herfst" }])] });
    expect(screen.getByText(t("periode.themaMeer", { naam: "Herfst", aantal: 1 }))).toBeInTheDocument();
  });

  it("beweert niets over het thema zolang het jaarplan laadt", () => {
    toon({ vakken: [vak([])], planGeladen: false });
    expect(screen.getByText(periodeTekst("2026-09-01", "2026-10-01"))).toBeInTheDocument();
    expect(screen.queryByText(t("periode.geenThema"))).not.toBeInTheDocument();
  });

  it("zegt tussen twee periodes alleen als er een periode voor en na ligt", () => {
    toon({ datum: "2026-11-05" });
    expect(screen.getByText(t("periode.tussenPeriodes"))).toBeInTheDocument();
    expect(screen.queryByText(t("periode.geenThema"))).not.toBeInTheDocument();
  });

  it("zegt buiten het schooljaar op een dag voor de eerste schooldag", () => {
    toon({ datum: "2026-08-31" });
    expect(screen.getByText(t("periode.buitenSchooljaar"))).toBeInTheDocument();
    expect(screen.queryByText(t("periode.tussenPeriodes"))).not.toBeInTheDocument();
  });

  it("zwijgt over periodes na de laatste periode", () => {
    toon({ datum: "2027-06-25" });
    expect(screen.queryByText(t("periode.tussenPeriodes"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("periode.buitenSchooljaar"))).not.toBeInTheDocument();
  });

  it("zwijgt over periodes zolang het rooster laadt", () => {
    toon({ schooljaar: undefined, vakken: [] });
    expect(screen.getByText("Week 37")).toBeInTheDocument();
    expect(screen.queryByText(t("periode.tussenPeriodes"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("periode.buitenSchooljaar"))).not.toBeInTheDocument();
  });

  it("toont in de weekweergave alleen het weeknummer", () => {
    toon({ dagweergave: false });
    expect(screen.getByText("Week 37")).toBeInTheDocument();
    expect(screen.queryByText(t("periode.periodeLabel"))).not.toBeInTheDocument();
    expect(screen.queryByText("Ik en mijn klas")).not.toBeInTheDocument();
  });

  it("toont niets in de maandweergave", () => {
    const { container } = toon({ weekLabel: null, dagweergave: false });
    expect(container).toBeEmptyDOMElement();
  });
});
