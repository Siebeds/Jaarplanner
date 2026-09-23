import { Link } from "react-router-dom";
import { themaLabel, type Themavak } from "./themavakken";
import { t } from "../../i18n";
import { weekdagIndex } from "../../lib/datum";
import { cn } from "../../lib/cn";
import { themapaginaPad } from "../themas/themapagina";
import { Themaicoon } from "../themas/Emojikiezer";
import { IcoonPlus } from "../../components/Iconen";

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
 * **A link to the thema's page for a pointer and for a keyboard** (FB-037, FB-039, ADR-0045). A band that names a thema
 * is a link on every day it covers, and every one of them is a 24 pixel target (WCAG 2.2 SC 2.5.8): the link is the
 * whole slot, and the band drawn along its top stays 20 pixels so the heading keeps its weight. Only the band that
 * PRINTS the name is a tab stop and in the accessibility tree, named after where it goes, so a keyboard meets one stop
 * per thema per row rather than one per day. The blank bands beside it lead to the same page, stay out of the tab order and are
 * `aria-hidden`: the day's own button already speaks the thema (see `themaZin`).
 */
export function Themastroken({
  vak,
  datum,
  dicht,
  altijdNaam,
  onPlanSubthema,
  className,
}: {
  /** The themaperiode this day sits in, or undefined between two periods, where there is none. */
  vak: Themavak | undefined;
  datum: string;
  /** The month cell and the day headings, where the type is set one step smaller. */
  dicht?: boolean;
  /**
   * There is no row of neighbouring days to carry the name instead, so the word is never dropped.
   *
   * The day view of the agenda: one column, and a band with nothing written on it there is not "and it goes on" but
   * a grey stripe with no explanation, which is exactly how the owner read it on 2026-09-11. Also the first day a week
   * draws its bands on when its Monday is closed.
   */
  altijdNaam?: boolean;
  /**
   * Opens the subthema planner for this placement (FB-087). Passed only to someone who may plan the klas.
   *
   * THE ACTION SITS ON THE THEMA IT PLANS INTO. It used to be a filled accent button in the agenda's header, which came
   * and went as the anchored day entered and left a placement, shifted the header when it did, and named no thema. Here
   * it is the band's own right end: the same grey, the same height, only on the band that prints the name, so a row
   * shows it once per thema, and a day without a thema has no band and so no button.
   */
  onPlanSubthema?: (plaatsingId: string) => void;
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
  // The band a keyboard stops on: the one whose name is on screen at every width.
  const bereikbaar = toonNaam || altijdNaam === true;

  const naam = themaLabel(vak);
  // The thema the label names first is the one the band opens. With two in a period it reads "Herfst +1", and the
  // other is reached through the menu Thema's. An empty period names nothing, so it opens nothing.
  const genoemd = vak.themas.at(0);
  const icoon = <Themaicoon icoon={genoemd?.icoon} className="mr-1" />;

  // THE TARGET IS THE SLOT, 24 PIXELS, AND THE BAND IS DRAWN INSIDE IT. Stacked slots abut, so no two targets overlap.
  const slot = "flex h-6 min-w-0 flex-1 items-start";
  const band = cn(
    "flex h-5 min-w-0 flex-1 items-center overflow-hidden border-l-2 font-medium leading-none",
    leeg ? "bg-lijn text-inkt-zacht" : "bg-lijn-sterk text-inkt",
    // The tick marks where the period BEGINS. An empty period gets the neutral edge instead of
    // the accent: the accent means "something starts here", and what starts here is a stretch
    // of days with nothing in them.
    isStart ? (leeg ? "border-l-lijn-veld" : "border-l-accent") : leeg ? "border-l-lijn" : "border-l-lijn-sterk",
    dicht ? "px-1.5 text-[0.625rem]" : "px-3 text-[0.6875rem]",
  );

  const tekst = toonNaam ? (
    <span className="truncate">
      {icoon}
      {naam}
    </span>
  ) : (
    // Mid band. The month cell drops the word entirely, as its strip does; the week view keeps
    // it below `xl`, where the seven columns have folded into a stack and there is no row left
    // for a blank band to continue along. A single column never drops it: see `altijdNaam`.
    <span className={cn("truncate", !altijdNaam && (dicht ? "hidden" : "xl:hidden"))}>
      {icoon}
      {t("periode.themaVervolg", { naam })}
    </span>
  );

  // A plus alone below 9rem of band, the word beside it from there: the name of the thema keeps the room. Quieter than
  // the name by weight, not by ink: `inkt-zacht` on this grey measures 3.96:1 light and 4.42:1 dark, `inkt` 10.8 and 7.7.
  // Hover underlines and keeps the grey, so the contrast holds there too.
  const planknop =
    onPlanSubthema && genoemd && bereikbaar ? (
      <button
        type="button"
        onClick={() => onPlanSubthema(vak.plaatsingId)}
        aria-label={t("periode.planSubthemaIn", { naam: genoemd.naam })}
        title={t("periode.planSubthema")}
        // As the band's link: a press leaves no focus ring behind in the agenda. The keyboard still focuses it.
        onMouseDown={(e) => e.preventDefault()}
        className="group/plan pointer-events-auto flex h-6 shrink-0 items-start focus-visible:outline-offset-[-2px]"
      >
        <span
          className={cn(
            "flex h-5 items-center gap-0.5 border-l border-lijn-veld bg-lijn-sterk font-normal leading-none text-inkt underline-offset-2 group-hover/plan:underline",
            dicht ? "px-1.5 text-[0.625rem]" : "px-2 text-[0.6875rem]",
          )}
        >
          <IcoonPlus aria-hidden="true" className="h-3 w-3" />
          <span className="hidden @[9rem]:inline">{t("periode.subthemaKnop")}</span>
        </span>
      </button>
    ) : null;

  return (
    <div className={cn("pointer-events-none flex", planknop && "@container", className)}>
      {genoemd ? (
        <Link
          to={themapaginaPad(genoemd.id)}
          tabIndex={bereikbaar ? undefined : -1}
          aria-hidden={bereikbaar ? undefined : true}
          aria-label={bereikbaar ? t("periode.naarThema", { naam }) : undefined}
          draggable={false}
          // No focus from a press: a ctrl- or middle-click opens a tab and would leave a ring behind in the agenda.
          onMouseDown={(e) => e.preventDefault()}
          // The ring is drawn inside the slot, because the month cell clips anything outside it.
          className={cn(slot, "group/band pointer-events-auto focus-visible:outline-offset-[-2px]")}
        >
          {/* One step further into the ink on hover, and the name underlined: no accent, which here means "starts". */}
          <span
            className={cn(
              band,
              "underline-offset-2 transition-colors duration-150 group-hover/band:bg-lijn-veld/70 group-hover/band:underline",
            )}
          >
            {tekst}
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" className={slot}>
          <span className={band}>{tekst}</span>
        </span>
      )}
      {planknop}
    </div>
  );
}
