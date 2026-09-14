import { describe, expect, it } from "vitest";
import { eindeVan } from "./gevraagdeplek";

/**
 * Where a placement asked for in the agenda ends (TB-014). Both of the screen's placement requests, from the picker
 * and from the new-activiteit sheet, send `alsTijd(eindeVan(plek, duur))`, so this is the rule they share.
 */
describe("eindeVan", () => {
  it("laat een gesleept bereik winnen van de lengte van de activiteit", () => {
    // Dragged out 9:00 to 10:30 and the activiteit usually runs 50 minutes: the teacher's stretch is what she asked for.
    expect(eindeVan({ datum: "2026-09-08", begin: 9 * 60, einde: 10 * 60 + 30 }, 50)).toBe(10 * 60 + 30);
  });

  it("geeft de activiteit haar eigen lengte als er niets gesleept is", () => {
    expect(eindeVan({ datum: "2026-09-08", begin: 9 * 60 }, 100)).toBe(10 * 60 + 40);
  });
});
