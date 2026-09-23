import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { IcoonKruis, IcoonPijlLinks, IcoonPijlRechts, IcoonPlus } from "../../components/Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { themapaginaPad } from "../themas/themapagina";
import { Themaicoon } from "../themas/Emojikiezer";
import type { Subthemareeks } from "./subthemareeksen";
import { themaLabel, type Themavak } from "./themavakken";
import type { Weekbalk } from "./weekbalkindeling";

/**
 * Where a bar sits in the header grid of the week: its columns, and the grid row it takes.
 *
 * Inset at its two ends only, so the columns it crosses show no break (FB-090).
 */
function plek(balk: Weekbalk<unknown>, rij: number): CSSProperties {
  return { gridColumn: `${balk.van + 1} / ${balk.tot + 2}`, gridRow: rij };
}

/**
 * The inset that puts a bar's ends on the same edges as the blocks in the columns under it (FB-092): the blocks' two
 * pixels, plus on the left the one-pixel line a day column after the first draws inside its own box.
 */
function inzet(kolom: number): string {
  return cn("mr-0.5", kolom > 0 ? "ml-[calc(0.125rem+1px)]" : "ml-0.5");
}

/**
 * The thema running over a stretch of the week, as one bar (FB-090).
 *
 * Grey, as the per-day band was and for the same reason (`Themastroken`): every hue in this app is spoken for. What
 * changed is that it is one bar with the name once, at its left, and one tab stop, named after where it goes. The accent
 * tick marks the day the thema begins; a thema that began before the first column, or goes on after the last, says so
 * with a small arrow on that side instead of a "…" that read as a cut-off name.
 *
 * **The subthema planner (FB-087) keeps its place at the bar's right end**, offered only when a day under the bar has
 * no subthema running: the owner does not want the button where every day already has one.
 */
export function Themabalk({
  balk,
  rij,
  onPlanSubthema,
}: {
  balk: Weekbalk<Themavak>;
  rij: number;
  /** Opens the subthema planner for this placement. Passed only to whoever may plan, and only with room for one. */
  onPlanSubthema?: (plaatsingId: string) => void;
}) {
  const vak = balk.item;
  const leeg = vak.themas.length === 0;
  const naam = themaLabel(vak);
  const genoemd = vak.themas.at(0);

  const band = cn(
    "flex h-5 min-w-0 flex-1 items-center gap-1 overflow-hidden border-l-2 px-1.5 text-[0.625rem] font-medium leading-none",
    leeg ? "bg-lijn text-inkt-zacht" : "bg-lijn-sterk text-inkt",
    // An empty period gets the neutral edge where a thema would get the accent: what starts there is nothing.
    balk.begint ? (leeg ? "border-l-lijn-veld" : "border-l-accent") : leeg ? "border-l-lijn" : "border-l-lijn-sterk",
  );
  const inhoud = (
    <Balktekst balk={balk}>
      <Themaicoon icoon={genoemd?.icoon} className="mr-1" />
      {naam}
    </Balktekst>
  );

  // A plus alone below 9rem of bar, the word beside it from there: the thema's name keeps the room. Quieter than the
  // name by weight, not by ink (`Themastroken` has the measurements).
  const planknop =
    onPlanSubthema && genoemd ? (
      <button
        type="button"
        onClick={() => onPlanSubthema(vak.plaatsingId)}
        aria-label={t("periode.planSubthemaIn", { naam: genoemd.naam })}
        title={t("periode.planSubthema")}
        // As the bar's link: a press leaves no focus ring behind in the agenda. The keyboard still focuses it.
        onMouseDown={(e) => e.preventDefault()}
        className="group/plan flex h-6 shrink-0 items-start focus-visible:outline-offset-[-2px]"
      >
        <span className="flex h-5 items-center gap-0.5 border-l border-lijn-veld bg-lijn-sterk px-1.5 text-[0.625rem] font-normal leading-none text-inkt underline-offset-2 group-hover/plan:underline">
          <IcoonPlus aria-hidden="true" className="h-3 w-3" />
          <span className="hidden @[9rem]:inline">{t("periode.subthemaKnop")}</span>
        </span>
      </button>
    ) : null;

  return (
    <div className={cn("relative z-10 flex min-w-0", inzet(balk.van), planknop && "@container")} style={plek(balk, rij)}>
      {genoemd ? (
        <Link
          to={themapaginaPad(genoemd.id)}
          aria-label={t("periode.naarThema", { naam })}
          draggable={false}
          // No focus from a press: a ctrl- or middle-click opens a tab and would leave a ring behind in the agenda.
          onMouseDown={(e) => e.preventDefault()}
          className="group/band flex h-6 min-w-0 flex-1 items-start focus-visible:outline-offset-[-2px]"
        >
          {/* One step further into the ink on hover, and the name underlined: no accent, which here means "starts". */}
          <span
            className={cn(
              band,
              "underline-offset-2 transition-colors duration-150 group-hover/band:bg-lijn-veld/70 group-hover/band:underline",
            )}
          >
            {inhoud}
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" className="flex h-6 min-w-0 flex-1 items-start">
          <span className={band}>{inhoud}</span>
        </span>
      )}
      {planknop}
    </div>
  );
}

/**
 * A subthema running over a stretch of the week, as one bar under the thema's, opening its chapter (FB-090).
 *
 * **Taking it out of the agenda sits at its right end (FB-096)**, where the thema bar keeps its planner: a quiet cross on
 * the bar's own grey, never the accent. Passed only to whoever may plan; the screen asks before anything goes.
 */
export function Subthemabalk({
  balk,
  rij,
  onHaalWeg,
}: {
  balk: Weekbalk<Subthemareeks>;
  rij: number;
  onHaalWeg?: (reeks: Subthemareeks, knop: HTMLElement) => void;
}) {
  const reeks = balk.item;

  return (
    <div className={cn("relative z-10 flex min-w-0", inzet(balk.van))} style={plek(balk, rij)}>
      <Link
        to={themapaginaPad(reeks.themaId, reeks.subthemaId)}
        aria-label={t("periode.naarSubthema", { naam: reeks.subthemaNaam })}
        draggable={false}
        onMouseDown={(e) => e.preventDefault()}
        className="group/strook flex h-6 min-w-0 flex-1 items-start focus-visible:outline-offset-[-2px]"
      >
        {/* The soft ink firms up with the hover step: on the darker fill it measures under 4.5:1. */}
        <span
          className={cn(
            "flex h-5 min-w-0 flex-1 items-center gap-1 overflow-hidden border-l-2 bg-lijn px-1.5 text-[0.625rem] font-medium leading-none text-inkt-zacht",
            "underline-offset-2 transition-colors duration-150 group-hover/strook:bg-lijn-sterk group-hover/strook:text-inkt group-hover/strook:underline",
            balk.begint ? "border-l-accent" : "border-l-lijn",
          )}
        >
          <Balktekst balk={balk}>{reeks.subthemaNaam}</Balktekst>
        </span>
      </Link>
      {onHaalWeg ? <Weghaalknop reeks={reeks} onHaalWeg={onHaalWeg} /> : null}
    </div>
  );
}

/**
 * The cross that takes a subthema out of the agenda (FB-096), on a week bar and on a day's strip alike.
 *
 * A 24 pixel slot with the 20 pixel band along its top, as the strips beside it. The cross is the only thing drawn, so
 * the name keeps its room on a phone's narrow column; the spoken name and the tooltip say what it does.
 */
export function Weghaalknop({
  reeks,
  onHaalWeg,
  dicht = true,
}: {
  reeks: Subthemareeks;
  onHaalWeg: (reeks: Subthemareeks, knop: HTMLElement) => void;
  /** The day view's strips set their type one step larger; the band keeps its height either way. */
  dicht?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => onHaalWeg(reeks, e.currentTarget)}
      aria-label={t("subthemaWeg.knopAria", { naam: reeks.subthemaNaam })}
      title={t("subthemaWeg.knop")}
      // As the bar's link: a press leaves no focus ring behind in the agenda. The keyboard still focuses it.
      onMouseDown={(e) => e.preventDefault()}
      className="group/weg pointer-events-auto flex h-6 shrink-0 items-start focus-visible:outline-offset-[-2px]"
    >
      <span
        className={cn(
          "flex h-5 items-center border-l border-lijn-veld bg-lijn text-inkt-zacht transition-colors duration-150 group-hover/weg:bg-lijn-sterk group-hover/weg:text-inkt",
          dicht ? "px-1" : "px-1.5",
        )}
      >
        <IcoonKruis aria-hidden="true" className="h-3 w-3" />
      </span>
    </button>
  );
}

/**
 * The name, with an arrow on each side the bar goes on past the screen or past a closed day.
 *
 * The arrows are `aria-hidden`: the day heading already says what runs on each day, and "continues" is a visual cue for
 * where the bar is cut, not a fact of its own. The name truncates; the arrow on the right stays at the bar's end.
 */
function Balktekst({ balk, children }: { balk: Weekbalk<unknown>; children: ReactNode }) {
  return (
    <>
      {balk.doorVoor ? <IcoonPijlLinks aria-hidden="true" data-doorloop="voor" className="h-3 w-3 shrink-0" /> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {balk.doorNa ? <IcoonPijlRechts aria-hidden="true" data-doorloop="na" className="h-3 w-3 shrink-0" /> : null}
    </>
  );
}

/** The runs on one day that found no row of their own, as a count. Names none, so it opens none. */
export function Subthemateveel({ kolom, rij, aantal }: { kolom: number; rij: number; aantal: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative z-10 flex h-6 items-start", inzet(kolom))}
      style={{ gridColumn: kolom + 1, gridRow: rij }}
    >
      <span className="flex h-5 min-w-0 flex-1 items-center border-l-2 border-l-lijn bg-lijn px-1.5 text-[0.625rem] font-medium leading-none text-inkt-zacht">
        {t("periode.subthemaMeer", { aantal })}
      </span>
    </span>
  );
}
