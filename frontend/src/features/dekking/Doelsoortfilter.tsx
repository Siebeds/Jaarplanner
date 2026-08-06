import { useId } from "react";

import { doelsoortLabel } from "../../components/doelsoort";
import { t } from "../../i18n";
import type { Doelsoortkeuze, Doelsoortoptie } from "./dekkingFormat";

/**
 * Which doelsoort the overview is narrowed to (E5-03, FR-9.2: *"er kan gefilterd worden op doelsoort, bv. enkel de
 * minimumdoelen"*).
 *
 * **It changes the figure, not just the rows, and that breaks the distinction the screen's other control documented.**
 * `Bereikschakelaar` justified its own label with *"a filter hides rows and leaves the figure alone, and this does the
 * opposite"*. That sentence was true when it was written and is not any more: this story's acceptance criterion is that
 * filtering by MD shows minimumdoel-only coverage, so the percentage and the counts follow this control. The comment on
 * `Bereikschakelaar` is corrected rather than left standing, and the real difference between the two controls is now
 * stated there: the scope refetches because the server owns the denominator, this narrows the answer already in hand.
 *
 * **A `<select>`, not the pressed-track the other two controls use, and that is a deliberate break from the local
 * idiom.** Op.stap has six doelsoorten (Art. VII.1), so the track would be seven targets wide and wrap to three rows at
 * 390px, where the same component already has to fit "Meten tegen" and a kleuterjaar chooser. The register's filters
 * (`Doelenfilters`) already answer exactly this question with a labelled `<select>` carrying counts, and a teacher who
 * has filtered `/doelen` by doelsoort meets the same control here.
 *
 * **The options come from the payload**, so a doelsoort this class's curriculum does not contain is never offered.
 * Choosing one would produce an empty screen that reads as a fault, and which disciplines a school loads is an open
 * Art. XIV decision, so the set genuinely varies.
 */
export interface DoelsoortfilterProps {
  /** The doelsoorten present in this class's scope, with their counts, in the server's order. */
  opties: readonly Doelsoortoptie[];
  gekozen: Doelsoortkeuze;
  onKies: (doelsoort: Doelsoortkeuze) => void;
}

export function Doelsoortfilter({ opties, gekozen, onKies }: DoelsoortfilterProps) {
  const id = useId();

  // The active narrowing must be offered even when it matches no row, or the `<select>` would hold a value none of its
  // options carries and the browser would paint the FIRST option instead: the control would read "Alle doelsoorten"
  // while the screen beside it says every doel was filtered out. That state is reachable (antagonist round 1) and is
  // exactly why this control now renders at all when a narrowing is active.
  const zichtbaar =
    gekozen !== null && !opties.some((optie) => optie.doelsoort === gekozen)
      ? [...opties, { doelsoort: gekozen, aantal: 0 }]
      : opties;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink">
        {t("dekking.doelsoortLabel")}
      </label>

      <select
        id={id}
        value={gekozen ?? ""}
        // The empty value means "no narrowing" rather than a doelsoort called "", the same convention as the register's
        // `Keuze`. Cast at the boundary because a `<select>`'s value is a string and the option values are exactly the
        // wire-form names rendered below.
        onChange={(event) => onKies((event.target.value || null) as Doelsoortkeuze)}
        className="min-w-0 rounded-md border border-input bg-card px-3 py-1.5 text-xs text-ink"
      >
        <option value="">{t("dekking.doelsoortAlle")}</option>
        {zichtbaar.map((optie) => (
          <option key={optie.doelsoort} value={optie.doelsoort}>
            {t("dekking.doelsoortOptie", {
              naam: doelsoortLabel(optie.doelsoort),
              aantal: optie.aantal,
            })}
          </option>
        ))}
      </select>
    </div>
  );
}
