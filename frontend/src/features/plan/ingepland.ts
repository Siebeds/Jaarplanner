import { dagMaand, weekdagKort } from "../../lib/datum";

/**
 * The one day a card in the side panel names for an activiteit that already stands in this klas's agenda (FB-076,
 * FB-102): short, on one line, as "ma 5 okt".
 *
 * **One day, and the first one still to come.** The card sits under "Ingepland", so the group already says that it is
 * planned; what the teacher still needs is when she meets it next. An activiteit planned only in the past names its
 * last day, the one she used it on most recently. The owner asked for no separate mark for an activiteit planned more
 * than once (FB-102, out of scope), so the other days are not counted on the card.
 *
 * The dates are the app's own date vocabulary (`weekdagKort` + `dagMaand`), not a second format invented here.
 */
export function ingeplandeDag(datums: readonly string[], vandaag: string): string | null {
  if (datums.length === 0) return null;

  const gesorteerd = [...datums].sort();
  const dag = gesorteerd.find((datum) => datum >= vandaag) ?? gesorteerd[gesorteerd.length - 1];
  return `${weekdagKort(dag)} ${dagMaand(dag)}`;
}
