import { IcoonPlus } from "../../components/Iconen";
import { volleDag } from "../../lib/datum";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * Adding an activiteit to a day, from a calendar cell.
 *
 * One component for the month and the week, because it was two: the month had a small plus in the
 * corner of the cell and the week had a full-width dashed bar at the foot of the column, so the same
 * intention had two shapes depending on which button a teacher had pressed a second earlier.
 *
 * **Visible on a phone, revealed on hover on a desktop.** The month's version was `sm:inline-flex`
 * and hover-only, which on a touch screen is a control that does not exist: there is no hover to
 * reveal it with, so the month had no way to add anything at all. Below `sm` it therefore just sits
 * there, and from `sm` it fades in with the cell it belongs to.
 *
 * The caller places it. It carries no position of its own, so a month cell can pin it to its corner
 * and a week column can hang it at the end of its header row, and both get the same target.
 */
export function Dagplus({
  datum,
  onVoegToe,
  className,
}: {
  datum: string;
  onVoegToe: (datum: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onVoegToe(datum)}
      aria-label={t("periode.voegToeOp", { dag: volleDag(datum) })}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-veld text-inkt-zwak",
        "transition-opacity duration-150 hover:bg-vlak-diep hover:text-inkt",
        // Always there without a pointer; from sm it waits for the cell to be hovered or for focus
        // to land on it, so a grid of forty cells is not forty plus signs.
        "sm:opacity-0 sm:group-hover/cel:opacity-100 sm:focus-visible:opacity-100",
        className,
      )}
    >
      <IcoonPlus aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
