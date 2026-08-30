import { IcoonPotlood, IcoonVuilbak } from "../Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * The two controls that repeat down a list: edit this row, delete this row.
 *
 * **They are icons because there were too many words** (owner, 2026-08-30). A thema with three
 * subthema's of three activiteiten each carried twenty-six buttons spelling "Bewerken" and
 * "Verwijderen", which read as a wall of chrome over content that was set in the same size. The
 * word moves into `aria-label`, so nothing is lost to a screen reader and nothing is guessed by a
 * sighted one: these two shapes are the two every other tool a teacher uses spells the same way.
 *
 * **They are not `IcoonKnop`.** That one is 44 pixels with a border, which is right for a control
 * standing alone in a toolbar and wrong for a pair repeating on every row: twenty bordered boxes are
 * the loudest thing on the page again, one redesign later. These are borderless and 36, and they
 * take a surface only under the pointer.
 *
 * **36 pixels, not 44, and that is a deliberate exception to the touch floor.** WCAG 2.2 AA 2.5.8
 * asks 24 by 24 as the minimum and 44 is this app's own comfort target; these clear the standard
 * with room and buy back the density the owner asked for. Every one of them also has a second,
 * larger route to the same action: a subthema and a thema are edited from the sheet these open, and
 * an activiteit row is itself a 60-pixel-tall button that opens the same sheet.
 */

/** Row-level "bewerk this". The label must name WHAT is being edited: there are many of these. */
export function Bewerkknop({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={t("themabeheer.bewerk")}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-veld text-inkt-zwak",
        "transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt",
        className,
      )}
    >
      <IcoonPotlood aria-hidden="true" className="h-[18px] w-[18px]" />
    </button>
  );
}

/**
 * Row-level "delete this".
 *
 * **Red on hover and focus, ink at rest**, which is the whole argument for `--color-gevaar` and is
 * written out where the token is declared: this page carries one of these per activiteit and per
 * subthema, and a dozen resting red icons would drown the red that means "geweigerd" and "niet
 * gedekt" elsewhere in the same screen. Never colour alone either way: the shape is a bin and the
 * label says "verwijderen" before the colour ever appears.
 */
export function Verwijderknop({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={t("themabeheer.verwijder")}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-veld text-inkt-zwak",
        "transition-colors duration-150",
        "hover:bg-gevaar-zacht hover:text-gevaar focus-visible:bg-gevaar-zacht focus-visible:text-gevaar",
        className,
      )}
    >
      <IcoonVuilbak aria-hidden="true" className="h-[18px] w-[18px]" />
    </button>
  );
}
