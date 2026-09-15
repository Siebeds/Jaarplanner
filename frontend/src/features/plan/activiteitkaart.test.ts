import { describe, expect, it } from "vitest";
import { ACTIVITEIT_VOORVOEGSEL, kaartLanding, leesActiviteitkaartId } from "./activiteitkaart";
import { FICHE_VOORVOEGSEL } from "../hoeken/sleepids";
import { ALGEMENE_FICHE_VOORVOEGSEL } from "../algemene-fiches/sleepids";

/** An activiteit card from the side panel is planned on the drop, so what the drop decides is worth pinning (FB-017). */
describe("activiteitkaart", () => {
  it("leest een kaart terug uit haar sleep-id, en niets anders", () => {
    expect(leesActiviteitkaartId(`${ACTIVITEIT_VOORVOEGSEL}a-1`)).toBe("a-1");
    expect(leesActiviteitkaartId(`${FICHE_VOORVOEGSEL}h-1`)).toBeNull();
    expect(leesActiviteitkaartId(`${ALGEMENE_FICHE_VOORVOEGSEL}f-1`)).toBeNull();
    // A planned activiteit is dragged under its bare plaatsingId.
    expect(leesActiviteitkaartId("plaatsing-1")).toBeNull();
  });

  it("plant een kaart die op een uur valt op dat uur, met haar eigen lengte", () => {
    expect(kaartLanding({ naam: "Eikels rapen", duur: 100 }, 10 * 60)).toEqual({ begin: 600, einde: 700 });
  });

  it("vraagt het uur wanneer de drop er geen noemde", () => {
    expect(kaartLanding({ naam: "Eikels rapen", duur: 100 }, null)).toBeNull();
  });
});
