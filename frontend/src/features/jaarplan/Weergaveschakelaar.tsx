import { useId } from "react";

import { t, type TranslationKey } from "../../i18n";
import { PLANNINGSBLOKNIVEAUS } from "./types";
import type { Planningsblokniveau } from "./types";

/**
 * The zoom control: which **tier** the whole kalender is drawn at (E3-08, FR-6.3).
 *
 * **It drives one fetch, and everything below it follows.** The chosen tier is a `/rooster` argument, so the
 * {@link Jaarspine} strip and the board underneath render from the same answer. The rejected alternative was a spine
 * pinned to the year while only the board zoomed: that puts two ordinal spaces on one screen, which is the
 * "two views disagree about the same period" defect the E3-02/E3-06 code review had to repair twice.
 *
 * **The options are named after the school's own periods, not after a view.** *Themaperiodes* and
 * *Subthemaperiodes* are the ratified two-tier model (directie 2026-07-14, Art. IX.3), which makes the pair
 * symmetric and keeps the label honest: **both** tiers show the whole school year, only the grain differs, so a
 * label like "hele jaar" versus "per periode" would have been false about the second one. The ratified week counts
 * (4–6 wk / ~2 wk) are deliberately **absent** from the labels: the lengths are configuration behind the E3-05 seam
 * (`Planning:Blokindeling`), and printing a default into user-facing copy compiles it in where nobody can change it.
 *
 * **Hand-rolled rather than a new Radix primitive.** `components/ui/` holds a badge and a button; a two-option
 * toggle needs neither a roving tabindex nor a focus trap, because each button is already a natural tab stop. Adding
 * a dependency for two options is the ceremony ADR-0017 asks us not to add.
 *
 * **State rides on three carriers, so it never rests on colour** (Art. XII, WCAG 2.2 AA): `aria-pressed` for
 * assistive tech, `font-semibold` for weight, and fill-versus-transparent on a bordered track for shape. A teacher
 * who cannot tell petrol from paper still sees which half of the track is filled. No new hue: `petrol` is the one
 * structural chrome colour and this screen already spends it.
 */
export interface WeergaveschakelaarProps {
  niveau: Planningsblokniveau;
  onKies: (niveau: Planningsblokniveau) => void;
  /**
   * The chosen tier's grid is still on its way, so the board below is still drawing the previous one.
   *
   * Said in visible text rather than left as a silent lag: the control answers immediately (it must, or it feels
   * broken), which means that for one request the pressed option and the board disagree about the grain. One line
   * beside the control is cheaper than a spinner and truer than nothing.
   */
  bezig: boolean;
}

/**
 * The label per tier, and therefore which tiers this control offers at all (E3-08 fix round 4, MINOR-4b).
 *
 * It was a hand-written array, which is why **adding a third `Planningsblokniveau` errored nowhere**: the new tier
 * simply had no button, so it was a grain the app could be in and could not be chosen or left. A `Record` keyed on the
 * union refuses to compile until it has a label, and the order comes from {@link PLANNINGSBLOKNIVEAUS} — coarse first,
 * because a teacher zooms *in* from the year rather than out from a fortnight.
 */
const NIVEAULABEL: Record<Planningsblokniveau, TranslationKey> = {
  Themaperiode: "kalender.weergaveGrof",
  Subthemaperiode: "kalender.weergaveFijn",
};

export function Weergaveschakelaar({ niveau, onKies, bezig }: WeergaveschakelaarProps) {
  const labelId = useId();

  return (
    // Wraps under its own label at 390px and sits right-aligned from `sm`, where there is room beside the spine
    // it reshapes. Not in the page header: that carries identity (title, klas, schooljaar), and this is an action.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:justify-end">
      <span id={labelId} className="text-xs font-semibold text-ink">
        {t("kalender.weergaveLabel")}
      </span>

      {/* A `group` with a visible name, rather than a radiogroup: these are two buttons that act at once, not a
          pending choice waiting to be submitted. */}
      <div
        role="group"
        aria-labelledby={labelId}
        // `border-input` (3,4:1 on card / 3,2:1 on paper) rather than `border-border`: this outline is the only
        // thing that says "these two belong together and one of them is on", so SC 1.4.11's 3:1 applies to it.
        className="inline-flex rounded-md border border-input bg-card p-0.5"
      >
        {PLANNINGSBLOKNIVEAUS.map((optie) => {
          const gekozen = optie === niveau;

          return (
            <button
              key={optie}
              type="button"
              aria-pressed={gekozen}
              onClick={() => onKies(optie)}
              className={[
                "rounded px-3 py-1 text-xs transition-colors duration-150",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                gekozen
                  ? "bg-petrol font-semibold text-petrol-foreground"
                  : "font-medium text-ink hover:bg-petrol-wash hover:text-petrol",
              ].join(" ")}
            >
              {t(NIVEAULABEL[optie])}
            </button>
          );
        })}
      </div>

      {/* `status` rather than `alert`: a grain that is one request behind is progress, not a problem. */}
      {bezig && (
        <span role="status" className="text-xs text-ink-zacht">
          {t("kalender.weergaveBezig")}
        </span>
      )}
    </div>
  );
}
