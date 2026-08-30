import { beforeEach, describe, expect, it } from "vitest";
import { useDoelenfilter } from "./doelenfilter";

/**
 * The register's filter has to survive the screen, because the screen unmounts every time the
 * teacher looks something up elsewhere. What is worth asserting is not that zustand keeps a value
 * — it does — but the two rules layered on top of it: what "alles wissen" is allowed to touch, and
 * that a restored filter does not get overwritten by the class preset it already accounts for.
 */

const BEGIN = { filter: {}, zoek: "", bron: "leerplandoelen" as const, faseVanKlas: null };

beforeEach(() => {
  sessionStorage.clear();
  useDoelenfilter.setState(BEGIN);
});

describe("doelenfilter", () => {
  it("bewaart wat de leerkracht instelt in sessionStorage", () => {
    useDoelenfilter.getState().stelFilter({ domein: "Wiskunde", subdomein: "Getallen" });
    useDoelenfilter.getState().stelZoek("meten");
    useDoelenfilter.getState().stelBron("minimumdoelen");

    const bewaard = JSON.parse(sessionStorage.getItem("jaarplanner-doelenfilter") ?? "{}");
    expect(bewaard.state).toMatchObject({
      filter: { domein: "Wiskunde", subdomein: "Getallen" },
      zoek: "meten",
      bron: "minimumdoelen",
    });
  });

  it("zet de jaar/fase van de klas in het filter en onthoudt welke fase gevolgd werd", () => {
    useDoelenfilter.getState().stelFilter({ domein: "Wiskunde" });
    useDoelenfilter.getState().volgKlasFase("L3");

    expect(useDoelenfilter.getState().filter).toEqual({ domein: "Wiskunde", jaarFase: "L3" });
    expect(useDoelenfilter.getState().faseVanKlas).toBe("L3");
  });

  it("laat een klas zonder eenduidige fase het filter niet vastzetten", () => {
    useDoelenfilter.getState().volgKlasFase("L3");
    useDoelenfilter.getState().volgKlasFase(null);

    expect(useDoelenfilter.getState().filter.jaarFase).toBeUndefined();
    expect(useDoelenfilter.getState().faseVanKlas).toBeNull();
  });

  // The half that makes returning to the screen safe: after "alles wissen" the screen re-renders
  // and compares the class fase again. It must find them equal, or the preset walks straight back
  // in and the button did nothing.
  it("wist filter en zoekterm, maar blijft de klasfase volgen", () => {
    useDoelenfilter.getState().volgKlasFase("L3");
    useDoelenfilter.getState().stelFilter({ jaarFase: "L3", domein: "Wiskunde" });
    useDoelenfilter.getState().stelZoek("meten");

    useDoelenfilter.getState().wisAlles();

    expect(useDoelenfilter.getState().filter).toEqual({});
    expect(useDoelenfilter.getState().zoek).toBe("");
    expect(useDoelenfilter.getState().faseVanKlas).toBe("L3");
  });

  // A teacher who picks another jaar/fase than their own class keeps it: the screen only reapplies
  // the preset when the CLASS changes, and that is the value this field records.
  it("overschrijft een eigen keuze niet zolang de klas dezelfde blijft", () => {
    useDoelenfilter.getState().volgKlasFase("L3");
    useDoelenfilter.getState().stelFilter({ jaarFase: "L5" });

    expect(useDoelenfilter.getState().faseVanKlas).toBe("L3");
    expect(useDoelenfilter.getState().filter.jaarFase).toBe("L5");
  });
});
