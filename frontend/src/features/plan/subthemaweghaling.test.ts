import { describe, expect, it } from "vitest";
import { t } from "../../i18n";
import { weghaalzinnen } from "./subthemaweghaling";

/** FB-096: what the question says before a subthema leaves the agenda, and only what the counts guarantee. */
describe("weghaalzinnen", () => {
  const reeks = { subthemaNaam: "de speelhoek", van: "2026-09-14", tot: "2026-09-18" };
  const dagnaam = (datum: string) => `dag ${datum}`;
  const gevolg = { aantalActiviteiten: 2, aantalHoekverrijkingen: 0, heeftPeriode: true, blijftElders: false };

  it("noemt de dagen, het aantal activiteiten en dat de doelen niet langer meetellen", () => {
    expect(weghaalzinnen(reeks, gevolg, dagnaam)).toEqual([
      t("subthemaWeg.dagen", { naam: "de speelhoek", van: "dag 2026-09-14", tot: "dag 2026-09-18" }),
      t("subthemaWeg.activiteiten", { aantal: 2 }),
      t("subthemaWeg.dekkingWeg"),
      t("algemeen.nietTerugTeDraaien"),
    ]);
  });

  it("zegt dat er geen activiteiten mee verdwijnen in plaats van 0 activiteiten", () => {
    const zinnen = weghaalzinnen(reeks, { ...gevolg, aantalActiviteiten: 0 }, dagnaam);
    expect(zinnen).toContain(t("subthemaWeg.geenActiviteiten"));
    expect(zinnen.join(" ")).not.toMatch(/\b0 activiteit/);
  });

  it("spreekt van één activiteit en één dag in het enkelvoud", () => {
    const zinnen = weghaalzinnen({ ...reeks, tot: reeks.van }, { ...gevolg, aantalActiviteiten: 1 }, dagnaam);
    expect(zinnen[0]).toBe(t("subthemaWeg.dag", { naam: "de speelhoek", dag: "dag 2026-09-14" }));
    expect(zinnen).toContain(t("subthemaWeg.activiteitenEen"));
  });

  it("noemt de hoekverrijkingen alleen als er zijn", () => {
    expect(weghaalzinnen(reeks, gevolg, dagnaam).join(" ")).not.toMatch(/hoekverrijking/);
    expect(weghaalzinnen(reeks, { ...gevolg, aantalHoekverrijkingen: 1 }, dagnaam)).toContain(t("subthemaWeg.verrijkingenEen"));
    expect(weghaalzinnen(reeks, { ...gevolg, aantalHoekverrijkingen: 3 }, dagnaam)).toContain(
      t("subthemaWeg.verrijkingen", { aantal: 3 }),
    );
  });

  it("zegt dat de doelen blijven meetellen als het subthema elders nog staat", () => {
    const zinnen = weghaalzinnen(reeks, { ...gevolg, blijftElders: true }, dagnaam);
    expect(zinnen).toContain(t("subthemaWeg.dekkingBlijft"));
    expect(zinnen).not.toContain(t("subthemaWeg.dekkingWeg"));
  });

  it("zegt niets over de dekking als er geen opgeslagen periode weggaat", () => {
    const zinnen = weghaalzinnen(reeks, { ...gevolg, heeftPeriode: false }, dagnaam);
    expect(zinnen).not.toContain(t("subthemaWeg.dekkingWeg"));
    expect(zinnen).not.toContain(t("subthemaWeg.dekkingBlijft"));
  });
});
