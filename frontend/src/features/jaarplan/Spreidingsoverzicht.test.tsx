import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Spreidingsoverzicht } from "./Spreidingsoverzicht";
import type { Generatieresultaat } from "./types";

/**
 * What the generation panel keeps saying, and what it stops saying, once the teacher edits the plan under it
 * (E3-03, FR-5.2/FR-5.3).
 *
 * **This whole branch shipped untested through two fix rounds, and both of round 3's MAJORs lived in it.** Rounds 1
 * and 2 each rewrote the staleness rule and each verified it by looking at a browser once; no test asserted that the
 * notice appears, that the two causes produce two different sentences, or that a plan-measured line disappears with
 * it. So these tests are written against the *rule* rather than against the markup: a line that measures the PLAN is
 * withheld, a line that states a fact about the RUN survives. Anything that cannot be sorted into one of those two
 * boxes is the defect.
 */
describe("Spreidingsoverzicht en verouderde metingen", () => {
  const basis: Generatieresultaat = {
    isGeslaagd: true,
    fout: null,
    jaarplan: null,
    aantalNieuw: 3,
    aantalBehouden: 1,
    aantalVervangen: 0,
    onbekendeThemas: [],
    onbekendeBlokken: [],
    duplicaten: [],
    afgewezen: [],
    spreiding: {
      aantalBlokken: 8,
      aantalGebruikteBlokken: 6,
      blokken: [],
      legeBlokOrdinalen: [3],
      overbelasteBlokOrdinalen: [2],
      minsteDoelenInEenBlok: 1,
      meesteDoelenInEenBlok: 9,
    },
    parameters: null,
    vooruitzicht: {
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
    },
  };

  it("toont spreiding en vooruitzicht zolang de metingen nog kloppen", () => {
    render(<Spreidingsoverzicht resultaat={basis} />);

    expect(screen.getByText(/Nog leeg: themaperiode 3/)).toBeInTheDocument();
    expect(screen.getByText(/Te vol/)).toBeInTheDocument();
    expect(screen.getByText("Nu gedekt: 0 van 34.")).toBeInTheDocument();
    expect(screen.queryByText(/kloppen niet meer/)).not.toBeInTheDocument();
  });

  it("houdt elke meting over het plan achter zodra de leerkracht het plan aanpaste", () => {
    render(<Spreidingsoverzicht resultaat={basis} verouderd="plan" />);

    expect(
      screen.getByText(/Je hebt het jaarplan aangepast na deze generatie/),
    ).toBeInTheDocument();

    // The two lines round 2 was reopened for: both are present-tense claims about the plan, and an unqualified
    // "Te vol" above "deze cijfers kloppen niet meer" is the contradiction this rule exists to end.
    expect(screen.queryByText(/Nog leeg: themaperiode 3/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Te vol/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nu gedekt/)).not.toBeInTheDocument();
  });

  it("zegt iets anders wanneer alleen het gemeten jaar veranderde", () => {
    render(<Spreidingsoverzicht resultaat={basis} verouderd="bereik" />);

    // "Je hebt het jaarplan aangepast" is simply false for a teacher who only moved the kleuterjaar chooser.
    expect(screen.getByText(/Je meet nu tegen een ander jaar/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Je hebt het jaarplan aangepast na deze generatie/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Nu gedekt/)).not.toBeInTheDocument();
  });

  it("blijft de feiten over de run zelf noemen, want die blijven waar", () => {
    render(<Spreidingsoverzicht resultaat={basis} verouderd="plan" />);

    // What the run added, kept and replaced is history: no later edit can falsify it, and withholding it would
    // leave a teacher who edited one card with no record of what the run had done at all.
    expect(screen.getByText(/3 thema/)).toBeInTheDocument();
  });

  it("laat het parameterrapport staan, en dat rapport doet geen uitspraak over het huidige plan", () => {
    // Antagonist round 3, MAJOR 2. This block sits OUTSIDE the withholding, so every sentence in it has to survive
    // an edit. Two did not: the heading claimed a thema stood in no period "nu", and the closing line told the
    // teacher to give it one — printed unchanged directly below "je hebt het jaarplan aangepast", to a teacher who
    // had just done exactly that.
    render(
      <Spreidingsoverzicht
        resultaat={{
          ...basis,
          parameters: {
            onbekendeStartthemas: [],
            gehonoreerdeStartthemas: [],
            nietGehonoreerdeStartthemas: [],
            tegenstrijdigeStartthemas: [],
            vervallenStartthemas: [],
            geweigerdDoorVastMoment: [
              {
                themaNaam: "Herfst",
                blokStart: "2026-09-01",
                momentNaam: "Schoolfeest",
                aiMotivatie: null,
              },
            ],
            toegepasteVasteMomenten: [],
            onplaatsbareVasteMomenten: [],
            heeftAandachtspunten: true,
          },
        }}
        verouderd="plan"
      />,
    );

    // Still readable, because the motivation behind a refusal exists nowhere else on the screen.
    expect(screen.getByText(/Thema dat deze generatie niet kon inplannen/)).toBeInTheDocument();

    // But phrased as a run fact. No sentence may assert where the thema stands NOW.
    expect(screen.queryByText(/in geen enkele themaperiode staat/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dit thema is niet ingepland\./)).not.toBeInTheDocument();

    // The remedy survives as a conditional: this component cannot see the live plan.
    expect(screen.getByText(/Staat het er nog altijd niet/)).toBeInTheDocument();
  });
});
