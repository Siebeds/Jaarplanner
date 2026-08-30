import { naamOpDezeDag, type Subthemareeks } from "./subthemareeksen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

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
 * `aria-hidden`, because the day's own button already names what is running on it. Two readings of
 * the same fact per cell, across forty cells, is what makes a calendar unusable with a screen
 * reader.
 */
export function Subthemastroken({
  reeksen,
  datum,
  dicht,
  className,
}: {
  reeksen: readonly Subthemareeks[];
  datum: string;
  /** The month cell, where a strip pays for itself in a cell that is 112 pixels tall. */
  dicht?: boolean;
  className?: string;
}) {
  if (reeksen.length === 0) return null;

  const toonNaam = naamOpDezeDag(datum, reeksen);

  // One name plus a count once there are three, rather than three strips: a cell that spends half
  // its height on strips has stopped being a day. Nothing is lost, the day's button lists them all.
  const zichtbaar = reeksen.length > 2 ? reeksen.slice(0, 1) : reeksen;
  const rest = reeksen.length - zichtbaar.length;

  return (
    <div aria-hidden="true" className={cn("pointer-events-none flex flex-col gap-px", className)}>
      {zichtbaar.map((reeks) => (
        <Strook
          key={reeks.subthemaId + reeks.van}
          isStart={reeks.van === datum}
          dicht={dicht}
          vervolg={!toonNaam}
          tekst={reeks.van === datum ? reeks.subthemaNaam : t("periode.subthemaVervolg", { naam: reeks.subthemaNaam })}
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
 */
function Strook({
  isStart,
  dicht,
  vervolg,
  tekst,
}: {
  isStart: boolean;
  dicht?: boolean;
  /** The middle of a run, so this is the label a wide layout can do without. */
  vervolg?: boolean;
  tekst: string;
}) {
  return (
    <span
      className={cn(
        // `lijn` rather than `vlak-diep` for the fill. At a six percent step from the page the four
        // pixel gutter between two cells stopped reading as a gutter, so a week of strips looked like
        // one bar spanning the row: it joined a Friday to the Monday after it and claimed the weekend
        // between them. Measured at 2x in the browser, invisible in a downscaled screenshot.
        "flex items-center overflow-hidden border-l-2 bg-lijn font-medium leading-none text-inkt-zacht",
        isStart ? "border-l-accent" : "border-l-lijn",
        dicht ? "h-4 px-1.5 text-[0.625rem]" : "h-5 px-3 text-[0.6875rem]",
      )}
    >
      {vervolg && dicht ? null : <span className={cn("truncate", vervolg && "xl:hidden")}>{tekst}</span>}
    </span>
  );
}
