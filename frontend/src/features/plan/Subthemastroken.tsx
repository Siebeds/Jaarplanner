import { Link } from "react-router-dom";
import { naamOpDezeDag, type Subthemareeks } from "./subthemareeksen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { themapaginaPad } from "../themas/themapagina";

/**
 * Which subthema is running on this day, as a strip along the top edge of the day.
 *
 * It replaces a chip above the grid that named the subthema only when EVERY activiteit in view
 * belonged to one, which in a month with two subthema's meant it named nothing. A subthema is a
 * stretch of days, so it is drawn on the days.
 *
 * **A row of strips, deliberately not one continuous bar.** The break between two cells stays
 * visible: a bar drawn across the gutter would join a Friday to the Monday after it and read as
 * "this ran over the weekend too" on a grid where the weekend cells are right there to be looked at.
 *
 * **The name is on it wherever a blank strip would say nothing.** A nameless tinted strip carries its
 * identity in hue alone (Art. XII), and there is no subthema hue to carry it with: the palette's
 * colours are all spoken for. So the rule is not "label every strip" but "label the start of every
 * group a reader scans as one", and what counts as a group depends on the layout, see `Strook`.
 *
 * **A link to the subthema's chapter for a pointer and for a keyboard** (FB-037, FB-039, ADR-0045). A strip that names a
 * run opens its chapter on the thema's page, on every day it covers, through a 24 pixel target. The strip that prints
 * the name is the tab stop, named after where it goes; the blank strips beside it stay out of the tab order and are
 * `aria-hidden`, because the day's own button already names what is running on it, and two readings of the same fact
 * per cell, across forty cells, is what makes a calendar unusable with a screen reader. The count that stands in for
 * the runs that did not fit names none, so it opens none.
 */
export function Subthemastroken({
  reeksen,
  datum,
  dicht,
  altijdNaam,
  className,
}: {
  reeksen: readonly Subthemareeks[];
  datum: string;
  /** The month cell and the day headings, where the type is set one step smaller. */
  dicht?: boolean;
  /**
   * There is no row of neighbouring days to carry the name instead, so the word is never dropped.
   *
   * The day view of the agenda: one column, and a strip with nothing written on it there is not "and it goes on" but
   * a grey stripe with no explanation, which is exactly how the owner read it on 2026-09-11. It is the same reason
   * `Strook` keeps the word below `xl`, at the width where the week has folded out of a row. Also the first day a
   * week draws its strips on when its Monday is closed.
   */
  altijdNaam?: boolean;
  className?: string;
}) {
  if (reeksen.length === 0) return null;

  // `vervolg` does not mean "this run started earlier": the text already says that. It means "a neighbour on this
  // row is naming it, so this label may be dropped", which is false the moment there is no row.
  const toonNaam = naamOpDezeDag(datum, reeksen) || altijdNaam === true;

  // One name plus a count once there are three, rather than three strips: a cell that spends half
  // its height on strips has stopped being a day. Nothing is lost, the day's button lists them all.
  const zichtbaar = reeksen.length > 2 ? reeksen.slice(0, 1) : reeksen;
  const rest = reeksen.length - zichtbaar.length;

  return (
    <div className={cn("pointer-events-none flex flex-col", className)}>
      {zichtbaar.map((reeks) => (
        <Strook
          key={reeks.subthemaId + reeks.van}
          isStart={reeks.van === datum}
          dicht={dicht}
          vervolg={!toonNaam}
          tekst={reeks.van === datum ? reeks.subthemaNaam : t("periode.subthemaVervolg", { naam: reeks.subthemaNaam })}
          naar={themapaginaPad(reeks.themaId, reeks.subthemaId)}
          naarNaam={toonNaam ? t("periode.naarSubthema", { naam: reeks.subthemaNaam }) : undefined}
        />
      ))}
      {rest > 0 ? <Strook isStart={false} dicht={dicht} tekst={t("periode.subthemaMeer", { aantal: rest })} /> : null}
    </div>
  );
}

/**
 * One strip.
 *
 * The left edge is the structure: an accent tick means the run BEGINS on this day, and a run that is
 * already going gets the same two pixels in the surface colour so the label of every strip in a week
 * lines up on the same pixel. Without that, "de speelhoek" and "… de speelhoek" would sit two pixels
 * apart and the eye would read the shift as the difference rather than the tick.
 *
 * **WHERE A CONTINUATION LABEL CAN BE DROPPED IS A LAYOUT QUESTION, SO CSS ANSWERS IT.** A blank
 * strip reads as "and it goes on" only next to a labelled one on the same line. The month grid is
 * seven columns at every width it is shown at, so there the line is always a week and the label
 * belongs on its first day, full stop. The week view is seven columns only from `xl`; below that it
 * folds to four, then two, then one, and a stack of cards has no line to continue along. Measured at
 * 390 pixels, where six blank grey bars under one labelled card looked like six rendering faults. So
 * the label is always rendered there and `xl:hidden` takes it away exactly where a row exists to
 * carry the meaning instead.
 *
 * **The target is the 24 pixel slot; the strip is drawn 20 pixels along its top**, as on the thema band.
 */
function Strook({
  isStart,
  dicht,
  vervolg,
  tekst,
  naar,
  naarNaam,
}: {
  isStart: boolean;
  dicht?: boolean;
  /** The middle of a run, so this is the label a wide layout can do without. */
  vervolg?: boolean;
  tekst: string;
  /** Where a press takes a pointer, or nothing for a strip that names no single run. */
  naar?: string;
  /** The link's name when this strip is the tab stop for its run; without it the strip is for a pointer only. */
  naarNaam?: string;
}) {
  const slot = "flex h-6 items-start";
  const klassen = cn(
    // `lijn` rather than `vlak-diep` for the fill. At a six percent step from the page the four
    // pixel gutter between two cells stopped reading as a gutter, so a week of strips looked like
    // one bar spanning the row: it joined a Friday to the Monday after it and claimed the weekend
    // between them. Measured at 2x in the browser, invisible in a downscaled screenshot.
    "flex h-5 min-w-0 flex-1 items-center overflow-hidden border-l-2 bg-lijn font-medium leading-none text-inkt-zacht",
    isStart ? "border-l-accent" : "border-l-lijn",
    dicht ? "px-1.5 text-[0.625rem]" : "px-3 text-[0.6875rem]",
    // The same step the thema band takes on hover, one level lighter. The ink firms up with it: the soft ink on the
    // darker fill measures under 4.5:1.
    naar &&
      "underline-offset-2 transition-colors duration-150 group-hover/strook:bg-lijn-sterk group-hover/strook:text-inkt group-hover/strook:underline",
  );
  const inhoud = vervolg && dicht ? null : <span className={cn("truncate", vervolg && "xl:hidden")}>{tekst}</span>;

  return naar ? (
    <Link
      to={naar}
      tabIndex={naarNaam ? undefined : -1}
      aria-hidden={naarNaam ? undefined : true}
      aria-label={naarNaam}
      draggable={false}
      // No focus from a press, as on the thema band: a ctrl- or middle-click would leave a ring behind in the agenda.
      onMouseDown={(e) => e.preventDefault()}
      // The ring is drawn inside the slot, because the month cell clips anything outside it.
      className={cn(slot, "group/strook pointer-events-auto focus-visible:outline-offset-[-2px]")}
    >
      <span className={klassen}>{inhoud}</span>
    </Link>
  ) : (
    <span aria-hidden="true" className={slot}>
      <span className={klassen}>{inhoud}</span>
    </span>
  );
}
