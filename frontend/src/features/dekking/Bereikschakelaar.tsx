import { useId } from "react";

import { t, type TranslationKey } from "../../i18n";
import { DEKKINGSBEREIKEN, type Dekkingsbereik } from "./types";

/**
 * Which leerplandoelen this class is measured against (E5-02, owner ruling 2026-08-04).
 *
 * **It changes the denominator, not a filter over one answer.** Pressing it refetches, because the two scopes are two
 * server-side computations with two different totals. That is why the label is *"Meten tegen"* rather than
 * *"Toon"*: a filter hides rows and leaves the figure alone, and this does the opposite.
 *
 * **Deliberately the same control as the kalender's zoom** (`Weergaveschakelaar`): a two-option track, hand-rolled
 * rather than a new Radix primitive, with state on three carriers so it never rests on colour (Art. XII, WCAG 2.2
 * AA): `aria-pressed` for assistive tech, `font-semibold` for weight, and fill-versus-transparent on a bordered
 * track for shape. Two screens, one gesture. No new hue either: `petrol` is the one structural chrome colour.
 *
 * The option labels come from a `Record` keyed on the union, so adding a third scope fails to compile instead of
 * silently rendering no button, which is the defect E3-08's fix round 4 found in the zoom control's hand-written
 * array.
 */
const BEREIKLABEL: Record<Dekkingsbereik, TranslationKey> = {
  // The class's own jaar/fase. Labelled "Deze klas" rather than "Dit leerjaar" because a kleutergroep is measured
  // against all three kleuter jaren (Klas.Leerjaar cannot say which one it is), so "leerjaar" would be false for
  // every kleuterklas. The sentence under the control names the actual codes.
  EigenJaarFase: "dekking.bereikEigen",
  HeelCurriculum: "dekking.bereikAlles",
};

export interface BereikschakelaarProps {
  bereik: Dekkingsbereik;
  onKies: (bereik: Dekkingsbereik) => void;
  /**
   * The new scope's answer is still on its way, so the figures beside it are still the previous scope's.
   *
   * Said in visible text rather than left as a silent lag, following the zoom control: the buttons answer
   * immediately (they must, or the control feels broken), which means that for one request the pressed option and
   * the total disagree about what is being counted. Here that matters more than on the kalender, because the thing
   * disagreeing is a number a teacher may write down.
   */
  bezig: boolean;
}

export function Bereikschakelaar({ bereik, onKies, bezig }: BereikschakelaarProps) {
  const labelId = useId();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span id={labelId} className="text-xs font-semibold text-ink">
        {t("dekking.bereikLabel")}
      </span>

      <div
        role="group"
        aria-labelledby={labelId}
        // `border-input` (3,4:1 on card) rather than `border-border`: this outline is the only thing that says "these
        // two belong together and one of them is on", so SC 1.4.11's 3:1 applies to it.
        className="inline-flex rounded-md border border-input bg-card p-0.5"
      >
        {DEKKINGSBEREIKEN.map((optie) => {
          const gekozen = optie === bereik;

          return (
            <button
              key={optie}
              type="button"
              aria-pressed={gekozen}
              onClick={() => onKies(optie)}
              className={[
                "rounded px-3 py-1 text-xs transition-colors duration-150",
                gekozen
                  ? "bg-petrol font-semibold text-petrol-foreground"
                  : "font-medium text-ink hover:bg-petrol-wash hover:text-petrol",
              ].join(" ")}
            >
              {t(BEREIKLABEL[optie])}
            </button>
          );
        })}
      </div>

      {/* `status` rather than `alert`: a total that is one request behind is progress, not a problem. */}
      {bezig && (
        <span role="status" className="text-xs text-ink-zacht">
          {t("dekking.laden")}
        </span>
      )}
    </div>
  );
}
