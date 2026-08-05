import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Vooruitzichtoverzicht } from "./Vooruitzichtoverzicht";
import type { Dekkingsvooruitzicht } from "./types";

/**
 * The dekkingsvooruitzicht on the generation panel (E3-03, FR-5.3).
 *
 * **What these tests are really guarding is a claim, not a layout.** The block reports two numbers that a reader
 * could easily take for coverage, and only one of them is: the ceiling is what accepting *would* achieve. So the
 * assertions are about which sentence appears in which state, and above all about the states where a figure must
 * **not** appear at all: a plan with an unresolved stale placement, and a class with nothing to measure against.
 */
describe("Dekkingsvooruitzicht op het generatiepaneel", () => {
  const basis: Dekkingsvooruitzicht = {
    bereik: "EigenJaarFase",
    gemetenJaarFasen: ["L3"],
    isTerugvalNaarHeelCurriculum: false,
    aantalBuitenBereik: 118,
    isBetrouwbaar: true,
    aantalOnopgelosteVervallenPlaatsingen: 0,
    aantalGedekt: 0,
    aantalMogelijkGedekt: 12,
    aantalLeerplandoelen: 34,
    aantalOnbereikbaar: 22,
    aantalWinstBijAanvaarden: 12,
  };

  it("toont wat er nu gedekt is naast wat aanvaarden zou opleveren", () => {
    render(<Vooruitzichtoverzicht vooruitzicht={basis} />);

    // The decided figure, which after a fresh run is 0 by design (Art. IV.1/V.1).
    expect(screen.getByText("Nu gedekt: 0 van 34.")).toBeInTheDocument();

    // The ceiling, stated as a condition rather than as a result, so it cannot read as coverage.
    expect(
      screen.getByText("Als je alle voorstellen aanvaardt: 12 van 34."),
    ).toBeInTheDocument();

    // And the sentence that says in words what the two numbers are: a prospect, not proof.
    expect(screen.getByText(/vooruitzicht, geen bewijs/)).toBeInTheDocument();
  });

  it("noemt wat aanvaarden nog steeds niet zou dekken", () => {
    render(<Vooruitzichtoverzicht vooruitzicht={basis} />);

    expect(screen.getByText("Ook dan nog niet gedekt: 22.")).toBeInTheDocument();
  });

  it("zwijgt over onbereikbare doelen wanneer het voorstel alles kan dekken", () => {
    render(
      <Vooruitzichtoverzicht
        vooruitzicht={{ ...basis, aantalMogelijkGedekt: 34, aantalOnbereikbaar: 0 }}
      />,
    );

    expect(screen.queryByText(/Ook dan nog niet gedekt/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Als je alle voorstellen aanvaardt: 34 van 34."),
    ).toBeInTheDocument();
  });

  it("zegt tegen welke jaar/fase gemeten is", () => {
    render(<Vooruitzichtoverzicht vooruitzicht={{ ...basis, gemetenJaarFasen: ["JK", "K2", "K3"] }} />);

    expect(screen.getByText("Gemeten tegen JK, K2, K3.")).toBeInTheDocument();
  });

  it("zegt bij een terugval dat er tegen alles gemeten is", () => {
    // The unresolved graadklas case: the class's own set could not be derived, so the scope widened. The reader has
    // to be told, otherwise the denominator silently means something else than on every other class.
    render(
      <Vooruitzichtoverzicht
        vooruitzicht={{
          ...basis,
          bereik: "HeelCurriculum",
          gemetenJaarFasen: [],
          isTerugvalNaarHeelCurriculum: true,
        }}
      />,
    );

    expect(
      screen.getByText("Van deze klas is geen jaar of fase bekend, dus gemeten tegen het hele curriculum."),
    ).toBeInTheDocument();
  });

  it("zegt bij een bewuste keuze voor het hele curriculum iets anders dan bij een terugval", () => {
    // The distinction the first version could not make, because the component branched on `gemetenJaarFasen.length`
    // alone and the two states share that. A directie that deliberately measures against everything has not lost
    // anything; a graadklas whose jaar/fase could not be derived has. Same empty list, different sentence.
    render(
      <Vooruitzichtoverzicht
        vooruitzicht={{
          ...basis,
          bereik: "HeelCurriculum",
          gemetenJaarFasen: [],
          isTerugvalNaarHeelCurriculum: false,
        }}
      />,
    );

    expect(screen.getByText("Gemeten tegen alle ingeladen leerplandoelen.")).toBeInTheDocument();
    expect(screen.queryByText(/geen jaar of fase bekend/)).not.toBeInTheDocument();
  });

  it("toont geen enkel cijfer zolang een thema buiten een periode staat", () => {
    // The directie ruling of 2026-07-28. The server withholds both figures, and the block must not fill the gap
    // with a 0: "we cannot say" and "it covers nothing" are different statements.
    render(
      <Vooruitzichtoverzicht
        vooruitzicht={{
          ...basis,
          isBetrouwbaar: false,
          aantalOnopgelosteVervallenPlaatsingen: 1,
          aantalGedekt: null,
          aantalMogelijkGedekt: null,
          aantalOnbereikbaar: null,
          aantalWinstBijAanvaarden: null,
        }}
      />,
    );

    expect(
      screen.getByText(
        "1 plaatsing staat buiten een themaperiode. Zolang je daarover niets beslist, kunnen we niet " +
          "zeggen wat dit jaarplan dekt.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Nu gedekt/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Als je alle voorstellen aanvaardt/)).not.toBeInTheDocument();

    // The scope still shows: it is the one line that stays true in every state.
    expect(screen.getByText("Gemeten tegen L3.")).toBeInTheDocument();
  });

  it("leest 0 van 0 niet als alles gedekt", () => {
    // A class scoped to a jaar/fase whose doelen are not imported yet. "0 van 0" would be arithmetically true and
    // read as either total failure or total success; both are wrong, so the state gets its own sentence.
    render(
      <Vooruitzichtoverzicht
        vooruitzicht={{
          ...basis,
          aantalGedekt: 0,
          aantalMogelijkGedekt: 0,
          aantalLeerplandoelen: 0,
          aantalOnbereikbaar: 0,
          aantalWinstBijAanvaarden: 0,
        }}
      />,
    );

    expect(
      screen.getByText("Voor dit jaar staan er nog geen leerplandoelen in de tool, dus valt er niets te meten."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Nu gedekt/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 van 0/)).not.toBeInTheDocument();
  });

  it("telt de vervallen plaatsingen als plaatsingen, niet als thema's", () => {
    render(
      <Vooruitzichtoverzicht
        vooruitzicht={{
          ...basis,
          isBetrouwbaar: false,
          aantalOnopgelosteVervallenPlaatsingen: 3,
          aantalGedekt: null,
          aantalMogelijkGedekt: null,
          aantalOnbereikbaar: null,
          aantalWinstBijAanvaarden: null,
        }}
      />,
    );

    expect(screen.getByText(/^3 plaatsingen staan buiten een themaperiode/)).toBeInTheDocument();
  });

  it("noemt de dekking nergens een bewijs of een percentage", () => {
    // E5-03 owns the dekkingspercentage. A second one here could drift from it, and a percentage next to an
    // unaccepted proposal would be a figure about something nobody has decided yet.
    const { container } = render(<Vooruitzichtoverzicht vooruitzicht={basis} />);

    expect(container.textContent).not.toContain("%");
    expect(container.textContent).not.toMatch(/procent/i);
  });
});
