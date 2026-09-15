import { IcoonChevron } from "../../components/Iconen";
import { cn } from "../../lib/cn";

/**
 * Move this row one place up or down. The size and manner of `Bewerkknop`, because it repeats down the same rows, and a
 * chevron rather than an arrow: the rapportdoelen and the scale are short lists, one step at a time is the whole need,
 * and a drag handle would be a second way to do it on a screen that already has too few rows to need one.
 */
export function Verschuifknop({
  richting,
  label,
  disabled,
  onClick,
}: {
  richting: "hoger" | "lager";
  /** Names the row, since each list carries several of these. */
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150",
        "hover:bg-vlak-diep hover:text-inkt disabled:pointer-events-none disabled:opacity-35",
      )}
    >
      <IcoonChevron aria-hidden="true" className={cn("h-[18px] w-[18px]", richting === "hoger" && "rotate-180")} />
    </button>
  );
}
