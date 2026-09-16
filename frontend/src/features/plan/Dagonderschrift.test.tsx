import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dagonderschrift } from "./Dagonderschrift";
import type { Themavak } from "./themavakken";
import { periode as periodeTekst } from "../../lib/datum";
import { t } from "../../i18n";

/**
 * The caption's sentences, one per state of the day.
 *
 * A day without a period used to get "Tussen twee periodes" and "Nog geen thema" whatever the reason:
 * outside the school year, before the first period, after the last, while the rooster loads, and
 * genuinely between two periods. Only the last one earns the sentence.
 *
 * The school year opens a day before its first period, so that "before the first" is reachable here:
 * a school year that opens on a vacation, or a block indeling behind the E3-05 seam, gives the same.
 */
const schooljaar = {
  start: "2026-08-31",
  eind: "2027-06-30",
  blokken: [
    { start: "2026-09-01", eind: "2026-10-01" },
    { start: "2026-10-02", eind: "2026-11-01" },
    { start: "2026-11-09", eind: "2026-12-20" },
  ],
};

const vak = (themas: Themavak["themas"]): Themavak => ({
  plaatsingId: "p1",
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
    expect(screen.getByText(t("periode.themaLoopt"))).toBeInTheDocument();
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
    expect(screen.getByText(t("periode.geenThemaOpDag"))).toBeInTheDocument();
    expect(screen.queryByText(t("periode.geenThema"))).not.toBeInTheDocument();
  });

  it("zegt buiten het schooljaar op een dag voor de eerste schooldag", () => {
    toon({ datum: "2026-08-30" });
    expect(screen.getByText(t("periode.buitenSchooljaar"))).toBeInTheDocument();
    expect(screen.queryByText(t("periode.geenThemaOpDag"))).not.toBeInTheDocument();
  });

  it("zwijgt over periodes voor de eerste periode", () => {
    toon({ datum: "2026-08-31" });
    expect(screen.queryByText(t("periode.geenThemaOpDag"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("periode.buitenSchooljaar"))).not.toBeInTheDocument();
  });

  it("zwijgt over periodes na de laatste periode", () => {
    toon({ datum: "2027-06-25" });
    expect(screen.queryByText(t("periode.geenThemaOpDag"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("periode.buitenSchooljaar"))).not.toBeInTheDocument();
  });

  it("zwijgt over periodes zolang het rooster laadt", () => {
    toon({ schooljaar: undefined, vakken: [] });
    expect(screen.getByText("Week 37")).toBeInTheDocument();
    expect(screen.queryByText(t("periode.geenThemaOpDag"))).not.toBeInTheDocument();
    expect(screen.queryByText(t("periode.buitenSchooljaar"))).not.toBeInTheDocument();
  });

  it("toont in de weekweergave alleen het weeknummer", () => {
    toon({ dagweergave: false });
    expect(screen.getByText("Week 37")).toBeInTheDocument();
    expect(screen.queryByText(t("periode.themaLoopt"))).not.toBeInTheDocument();
    expect(screen.queryByText("Ik en mijn klas")).not.toBeInTheDocument();
  });

  it("toont niets in de maandweergave", () => {
    const { container } = toon({ weekLabel: null, dagweergave: false });
    expect(container).toBeEmptyDOMElement();
  });
});
