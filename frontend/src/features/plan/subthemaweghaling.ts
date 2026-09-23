import { t } from "../../i18n";
import type { Subthemaweghaling } from "../../lib/queries";

/**
 * The sentences the question before taking a subthema out of the agenda says (FB-096), in the order a teacher reads
 * them: which days, which activiteiten go with it, which hoekverrijkingen, and what it does to the dekking.
 *
 * **Each sentence asserts only what the server's counts guarantee.** The dekking sentence is left out for a run drawn
 * from its activiteiten alone: only a stored window makes the goals count (ADR-0047), so removing none changes
 * nothing there. With another window of the subthema staying, it says the goals go on counting instead.
 */
export function weghaalzinnen(
  reeks: { subthemaNaam: string; van: string; tot: string },
  gevolg: Subthemaweghaling,
  dagnaam: (datum: string) => string,
): string[] {
  const zinnen = [
    reeks.van === reeks.tot
      ? t("subthemaWeg.dag", { naam: reeks.subthemaNaam, dag: dagnaam(reeks.van) })
      : t("subthemaWeg.dagen", { naam: reeks.subthemaNaam, van: dagnaam(reeks.van), tot: dagnaam(reeks.tot) }),
  ];

  zinnen.push(
    gevolg.aantalActiviteiten === 0
      ? t("subthemaWeg.geenActiviteiten")
      : gevolg.aantalActiviteiten === 1
        ? t("subthemaWeg.activiteitenEen")
        : t("subthemaWeg.activiteiten", { aantal: gevolg.aantalActiviteiten }),
  );

  if (gevolg.aantalHoekverrijkingen === 1) zinnen.push(t("subthemaWeg.verrijkingenEen"));
  else if (gevolg.aantalHoekverrijkingen > 1) {
    zinnen.push(t("subthemaWeg.verrijkingen", { aantal: gevolg.aantalHoekverrijkingen }));
  }

  if (gevolg.heeftPeriode) {
    zinnen.push(t(gevolg.blijftElders ? "subthemaWeg.dekkingBlijft" : "subthemaWeg.dekkingWeg"));
  }

  zinnen.push(t("algemeen.nietTerugTeDraaien"));
  return zinnen;
}
