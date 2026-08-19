import { t } from "../i18n";
import { useUitleg } from "./uitlegcontext";

/**
 * The one control that decides whether the screens carry their instructional prose (E9-01, owner ruling 2026-08-19).
 *
 * **Hand-rolled rather than a Radix primitive.** `components/ui/` holds a badge and a button; a single toggle needs
 * neither a roving tabindex nor a focus trap, because the button is already a natural tab stop. Adding a dependency
 * for one control is the ceremony ADR-0017 asks us not to add — the same reasoning {@link Weergaveschakelaar} records.
 *
 * **A toggle button, not a checkbox and not a Switch.** It acts immediately and there is nothing to submit, which is
 * what `aria-pressed` means; a checkbox would promise a form and a Switch would need a label element beside it,
 * spending header width on a word the button already says.
 *
 * **State rides on three carriers, two of them not colour** (Art. XII, WCAG 2.2 AA):
 * - `aria-pressed`, for assistive technology;
 * - **a check glyph that is present or absent**, which is shape rather than hue and is what a teacher who cannot
 *   distinguish petrol from paper reads;
 * - fill versus transparent on a bordered track, plus font weight.
 *
 * A dot would have been prettier and would have carried no meaning; the check says *on*.
 *
 * **No new hue.** `petrol` is the one structural chrome colour and this row already spends it, so the pressed state
 * reuses it rather than introducing a second accent that would compete with the doelsoort and dekking signals the
 * tool exists to send.
 *
 * **The label does not change between states**, and that is deliberate. A toggle button whose text flips reads as
 * double negation to a screen reader (*"Uitleg verbergen, pressed"*), and Label in Name (SC 2.5.3) is satisfied by a
 * stable visible string that is also the accessible name. So there is no `aria-label` here: adding one that did not
 * contain the visible text would break that criterion for the sake of a longer sentence.
 */
export function Uitlegschakelaar() {
  const { isAan, schakel } = useUitleg();

  return (
    <button
      type="button"
      aria-pressed={isAan}
      onClick={schakel}
      className={[
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        isAan
          ? "border-petrol bg-petrol font-semibold text-petrol-foreground"
          : // `border-input` (3,4:1 on card) rather than `border-border`: in the off state the outline is the only
            // thing saying this is a control at all, so SC 1.4.11's 3:1 applies to it.
            "border-input bg-card font-medium text-ink hover:bg-petrol-wash hover:text-petrol",
      ].join(" ")}
    >
      {/*
        `aria-hidden`, because the pressed state is already announced by `aria-pressed`. Without it a screen reader
        says the state twice, once as a stray glyph. Fixed width so the label does not shift by a few pixels when the
        check appears, which on a sticky header is a visible twitch rather than a subtlety.
      */}
      <span aria-hidden="true" className="w-3 text-center">
        {isAan ? "✓" : ""}
      </span>
      {t("uitleg.schakelaar")}
    </button>
  );
}
