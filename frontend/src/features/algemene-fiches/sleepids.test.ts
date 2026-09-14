import { describe, expect, it } from "vitest";
import { ALGEMENE_FICHE_VOORVOEGSEL, fichemomentSleepId, leesAlgemeneFicheId, leesFichemomentId } from "./sleepids";
import { FICHE_VOORVOEGSEL, leesFicheId, leesMomentId, momentSleepId } from "../hoeken/sleepids";

/**
 * The agenda's drop handler learns what it was handed from the id alone, so an algemene fiche read as a hoek (or the
 * other way round) would open the wrong sheet or save through the wrong endpoint. Pinned in both directions.
 */
describe("algemene fiches: sleep-id's", () => {
  it("leest een fiche uit het paneel terug", () => {
    expect(leesAlgemeneFicheId(`${ALGEMENE_FICHE_VOORVOEGSEL}f-1`)).toBe("f-1");
  });

  it("leest een moment terug met zijn plaatsing", () => {
    expect(leesFichemomentId(fichemomentSleepId("p-1", "m-1"))).toEqual({ plaatsingId: "p-1", momentId: "m-1" });
  });

  it("verwart een algemene fiche nooit met een hoek, in geen van beide richtingen", () => {
    expect(leesFicheId(`${ALGEMENE_FICHE_VOORVOEGSEL}f-1`)).toBeNull();
    expect(leesMomentId(fichemomentSleepId("p-1", "m-1"))).toBeNull();
    expect(leesAlgemeneFicheId(`${FICHE_VOORVOEGSEL}h-1`)).toBeNull();
    expect(leesFichemomentId(momentSleepId("p-1", "m-1"))).toBeNull();
  });

  it("leest een kaal plaatsingId (een activiteit) als niets van dit alles", () => {
    expect(leesAlgemeneFicheId("p-1")).toBeNull();
    expect(leesFichemomentId("p-1")).toBeNull();
  });
});
