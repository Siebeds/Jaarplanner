import { describe, expect, it } from "vitest";
import type { ThemaWeergave } from "../../lib/types";
import { themabalans } from "./themabalans";

/**
 * The counts the thema fiche puts in its margin. They are worth a test because they are the one
 * thing on that screen a teacher cannot verify by looking: the links sit at three different depths,
 * and until now finding "which activiteit still has no doel" meant scrolling the whole page.
 */

function activiteit(codes: string[], status = "Manueel") {
  return { doelkoppelingen: codes.map((leerplandoelCode) => ({ leerplandoelCode, status })) };
}

function thema(vorm: unknown): ThemaWeergave {
  return vorm as ThemaWeergave;
}

describe("themabalans", () => {
  it("telt de drie niveaus apart en samen", () => {
    const balans = themabalans(
      thema({
        // The thema's own share is its minimumdoelen (FB-043); an older leerplandoel themadoel no longer counts.
        themadoelen: [{}],
        minimumdoelen: [{}, {}],
        subthemas: [
          { subdoelen: [{}, {}, {}], activiteiten: [activiteit(["A", "B"]), activiteit(["C"])] },
          { subdoelen: [{}], activiteiten: [activiteit(["D"])] },
        ],
      }),
    );

    expect(balans.themadoelen).toBe(2);
    expect(balans.subdoelen).toBe(4);
    expect(balans.activiteitdoelen).toBe(4);
    expect(balans.totaal).toBe(10);
  });

  it("wijst de activiteiten aan die nog geen enkel doel dragen", () => {
    const balans = themabalans(
      thema({
        themadoelen: [], minimumdoelen: [],
        subthemas: [
          { subdoelen: [], activiteiten: [activiteit([]), activiteit(["A"]), activiteit([])] },
          { subdoelen: [], activiteiten: [activiteit([])] },
        ],
      }),
    );

    expect(balans.activiteiten).toBe(4);
    expect(balans.activiteitenZonderDoel).toBe(3);
  });

  it("telt een voorgesteld of geweigerd doel niet (FB-026)", () => {
    const balans = themabalans(
      thema({
        themadoelen: [], minimumdoelen: [],
        subthemas: [
          {
            subdoelen: [],
            activiteiten: [activiteit(["A"], "Voorgesteld"), activiteit(["B"], "Geweigerd"), activiteit(["C"], "Aanvaard")],
          },
        ],
      }),
    );

    expect(balans.activiteitdoelen).toBe(1);
    expect(balans.activiteitenZonderDoel).toBe(2);
  });

  it("geeft nullen voor een thema waar nog niets onder hangt", () => {
    const balans = themabalans(thema({ themadoelen: [], minimumdoelen: [], subthemas: [] }));

    expect(balans.totaal).toBe(0);
    expect(balans.activiteiten).toBe(0);
    expect(balans.activiteitenZonderDoel).toBe(0);
  });

  it("telt een subthema zonder activiteiten niet mee als een gat", () => {
    // An empty subthema is not an activiteit missing a doel, and counting it as one would send a
    // teacher looking for a row that does not exist.
    const balans = themabalans(
      thema({ themadoelen: [], minimumdoelen: [], subthemas: [{ subdoelen: [{}], activiteiten: [] }] }),
    );

    expect(balans.subdoelen).toBe(1);
    expect(balans.activiteitenZonderDoel).toBe(0);
  });
});
