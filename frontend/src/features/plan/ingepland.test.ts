import { describe, expect, it } from "vitest";
import { ingeplandZin } from "./ingepland";
import { t } from "../../i18n";

/**
 * FB-076: what the side panel says under an activiteit that already stands in this klas's agenda.
 *
 * The three shapes are a layout decision (a 240px column fits two dates and not five), so what is pinned here is the
 * boundary between them, and that nothing is said at all about an activiteit that stands nowhere.
 */
describe("ingeplandZin", () => {
  it("zegt niets over een activiteit die nergens staat", () => {
    expect(ingeplandZin([])).toBeNull();
  });

  it("noemt de dag van een activiteit die één keer ingepland is", () => {
    expect(ingeplandZin(["2026-10-13"])).toBe(t("activiteitenpaneel.ingeplandOp", { dag: "di 13 okt" }));
  });

  it("noemt beide dagen van een activiteit die twee keer ingepland is", () => {
    expect(ingeplandZin(["2026-10-13", "2026-10-15"])).toBe(
      t("activiteitenpaneel.ingeplandOpTwee", { eerste: "di 13 okt", tweede: "do 15 okt" }),
    );
  });

  it("noemt vanaf drie dagen het aantal en de eerste dag", () => {
    expect(ingeplandZin(["2026-10-13", "2026-10-15", "2026-11-03"])).toBe(
      t("activiteitenpaneel.ingeplandOpMeer", { aantal: 3, eerste: "di 13 okt" }),
    );
  });
});
