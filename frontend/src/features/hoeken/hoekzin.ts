import { t } from "../../i18n";
import { valtBinnen } from "../../lib/datum";
import type { HoekplaatsingWeergave } from "./gegevens";

/**
 * What a day button adds to its label about the hoeken running on it.
 *
 * **The strips are `aria-hidden` on the promise that the button says this, and for a while the button
 * did not.** An antagonist audit found the claim in this file's own documentation and the absence in
 * `Maandcel`: no screen-reader user was ever told a corner was running. The two have to ship together,
 * which is why this module sits beside `Hoekstroken` rather than inside it. Its own file, not a
 * second export from the component, for the reason `knopklassen.ts` states: a file that exports
 * both a component and a helper breaks React Fast Refresh for that whole file.
 *
 * Shaped like `subthemaZin`: a leading comma, appended to a label that already has a subject.
 */
export function hoekZin(plaatsingen: readonly HoekplaatsingWeergave[], datum: string): string {
  const namen = plaatsingen.filter((p) => valtBinnen(datum, p.van, p.tot)).map((p) => p.hoekNaam);
  if (namen.length === 0) return "";

  return `, ${
    namen.length === 1
      ? t("periode.dagHoek", { naam: namen[0] })
      : t("periode.dagHoeken", { namen: namen.join(", ") })
  }`;
}
