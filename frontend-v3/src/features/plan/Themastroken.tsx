import type { Themavak } from "./themavakken";
import { t } from "../../i18n";
import { weekdagIndex } from "../../lib/datum";
import { cn } from "../../lib/cn";

/**
 * Which thema this day's themaperiode holds, as a band along the top edge of the day.
 *
 * It replaces a chip above the grid that named the thema of ONE anchored day while the grid showed a
 * whole month, which on this school year's periods meant it named the previous period's thema in
 * october and nothing at all in november. Why that happened, and why the answer belongs on the days:
 * `themavakken`.
 *
 * **It sits above the subthema strip and reads as the outer unit.** A thema runs for a whole period
 * and a subthema is a stretch inside it, so the two bands are a hierarchy and are drawn as one: the
 * thema takes the darker surface and the firmer ink, the subthema keeps the lighter one. No new hue
 * for either. Art. XII has the six doelsoort hues, the suggestion statuses and the two dekking
 * states already, the accent is the app's one structural colour, and `attentie` is spoken for by
 * knelpunten. A band drawn on forty cells is the last place to spend a colour.
 *
 * **A period with no thema says so in words.** That is the state the owner was looking at when this
 * was found, and the old chip's answer to it was to render nothing, so the screen looked the same as
 * a screen with no period at all. It deliberately does NOT take the attentie colour: a month wholly
 * inside an empty period would then be thirty warm bars, and the one hue this app has for a knelpunt
 * would be spent on the calmest possible reading of one. The words carry it.
 *
 * `aria-hidden`, like the strip below it: the day's own button already speaks both facts, once. See
 * `themaZin`.
 */
export function Themastroken({
  vak,
  datum,
  dicht,
  className,
}: {
  /** The themaperiode this day sits in, or undefined between two periods, where there is none. */
  vak: Themavak | undefined;
  datum: string;
  /** The month cell, where 16 pixels of band is already a seventh of the cell. */
  dicht?: boolean;
  className?: string;
}) {
  if (!vak) return null;

  const leeg = vak.themas.length === 0;
  const isStart = vak.van === datum;

  // Named on the day it starts and again at the head of every week. Same rule as the subthema strip
  // and for the same reason: a name on all seven days of a row is the per-cell version of the prose
  // this app cuts first, and a band that only ever labelled its first day would go anonymous for the
  // three weeks after it in a six week period.
  const toonNaam = isStart || weekdagIndex(datum) === 0;

  const naam = leeg
    ? t("periode.geenThema")
    : vak.themas.length === 1
      ? vak.themas[0].naam
      : t("periode.themaMeer", { naam: vak.themas[0].naam, aantal: vak.themas.length - 1 });

  return (
    <div aria-hidden="true" className={cn("pointer-events-none flex", className)}>
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center overflow-hidden border-l-2 font-medium leading-none",
          leeg ? "bg-lijn text-inkt-zacht" : "bg-lijn-sterk text-inkt",
          // The tick marks where the period BEGINS. An empty period gets the neutral edge instead of
          // the accent: the accent means "something starts here", and what starts here is a stretch
          // of days with nothing in them.
          isStart ? (leeg ? "border-l-lijn-veld" : "border-l-accent") : leeg ? "border-l-lijn" : "border-l-lijn-sterk",
          dicht ? "h-4 px-1.5 text-[0.625rem]" : "h-5 px-3 text-[0.6875rem]",
        )}
      >
        {toonNaam ? (
          <span className="truncate">{naam}</span>
        ) : (
          // Mid band. The month cell drops the word entirely, as its strip does; the week view keeps
          // it below `xl`, where the seven columns have folded into a stack and there is no row left
          // for a blank band to continue along.
          <span className={cn("truncate", dicht ? "hidden" : "xl:hidden")}>
            {t("periode.themaVervolg", { naam })}
          </span>
        )}
      </span>
    </div>
  );
}
