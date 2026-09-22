import { dagMaand, weekdagKort } from "../../lib/datum";
import { t } from "../../i18n";

/**
 * What the side panel says under an activiteit that already stands in this klas's agenda (FB-076).
 *
 * **The sentence is the signal, not the colour.** Colour in this app is spoken for (Art. XII), and the one thing a
 * teacher needs here is not "something is up" but *which day she used it on*, which only words can say. The stripe and
 * the icon beside it let a scanning eye find the marked cards; this is what makes the mark worth finding.
 *
 * **Three shapes rather than a list.** The ticket allows naming both days or naming the count and the first, and a
 * column of 240px decides between them: two dates fit, five do not, and a list that wraps to four lines buries the
 * name of the activiteit it belongs to.
 *
 * The dates are the app's own date vocabulary (`weekdagKort` + `dagMaand`, so "di 22 sep"), and not a second format
 * invented here.
 */
export function ingeplandZin(datums: readonly string[]): string | null {
  const dag = (iso: string) => `${weekdagKort(iso)} ${dagMaand(iso)}`;

  if (datums.length === 0) return null;
  if (datums.length === 1) return t("activiteitenpaneel.ingeplandOp", { dag: dag(datums[0]) });
  if (datums.length === 2) {
    return t("activiteitenpaneel.ingeplandOpTwee", { eerste: dag(datums[0]), tweede: dag(datums[1]) });
  }

  return t("activiteitenpaneel.ingeplandOpMeer", { aantal: datums.length, eerste: dag(datums[0]) });
}
