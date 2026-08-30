import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * Whether anything on this activiteit is linked to a leerplandoel, said in both directions.
 *
 * **Absence used to be encoded as absence.** An activiteitregel printed its doelcodes when it had
 * any and printed nothing when it had none, so "no doelen" and "this row is just shorter" looked
 * identical, and the one thing a teacher scans a list of activiteiten for was the one thing the list
 * did not say. This mark is therefore unconditional: every activiteit carries it, filled or empty.
 *
 * **The two states are deliberately not symmetric in weight.** Having doelen is a plain fact and
 * gets the neutral treatment of the other merken; having none is a knelpunt and gets `attentie`,
 * the one warm hue reserved for exactly that (Art. XII). An activiteit with zero doelen can never
 * contribute to dekking whatever else happens to it, which is what earns the colour here.
 *
 * **It is not the dekking hue, on purpose.** Dekking is a computed property of a *doel*: gedekt
 * means linked AND placed in the plan. An activiteit with three doelen that is never placed covers
 * nothing, so painting it green would assert something this component cannot know.
 *
 * Never the colour alone (Art. XII, WCAG 1.4.1): the words differ completely, and the leading shape
 * is a filled disc against a hollow ring. The ring is 10px where `Statusmerk`'s dot is 6px, because
 * at 6px a 1.5px border closes the hole and the two states become one dot in two colours.
 */
export function Doelmerk({ aantal, className }: { aantal: number; className?: string }) {
  const leeg = aantal === 0;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pl-1.5 pr-2",
        "text-[0.6875rem] font-medium",
        leeg
          ? "border-attentie/40 bg-attentie-zacht text-attentie-inkt"
          : "border-lijn bg-kaart text-inkt-zacht",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          leeg ? "border-[1.5px] border-attentie" : "bg-inkt-zwak",
        )}
      />
      {leeg ? t("activiteit.geenDoel") : telWoord(aantal, "activiteit.eenDoel", "activiteit.aantalDoelen")}
    </span>
  );
}
