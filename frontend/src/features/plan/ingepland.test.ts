import { describe, expect, it } from "vitest";
import { ingeplandeDag } from "./ingepland";

/** FB-076, FB-102: the one day a card names for an activiteit that already stands in this klas's agenda. */
describe("ingeplandeDag", () => {
  const VANDAAG = "2026-10-14";

  it("noemt geen dag voor een activiteit die nergens staat", () => {
    expect(ingeplandeDag([], VANDAAG)).toBeNull();
  });

  it("noemt de dag kort, als in de rest van de app", () => {
    expect(ingeplandeDag(["2026-10-15"], VANDAAG)).toBe("do 15 okt");
  });

  it("noemt van meerdere dagen de eerste die nog komt, vandaag inbegrepen", () => {
    expect(ingeplandeDag(["2026-11-03", "2026-10-13", "2026-10-15"], VANDAAG)).toBe("do 15 okt");
    expect(ingeplandeDag(["2026-10-13", "2026-10-14"], VANDAAG)).toBe("wo 14 okt");
  });

  it("noemt de laatste dag wanneer ze alleen in het verleden staat", () => {
    expect(ingeplandeDag(["2026-09-22", "2026-10-06"], VANDAAG)).toBe("di 6 okt");
  });
});
