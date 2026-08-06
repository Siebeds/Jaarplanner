import { useId } from "react";

import { t, tAantal } from "../../i18n";

/**
 * The list's own header: which rows it shows, and how many doelen are still missing (E5-03, FR-9.2's *"een lijst van
 * de ontbrekende doelen"*).
 *
 * **It sits on the list rather than in the summary card, and that placement is the design carrying a distinction the
 * copy alone would have to keep repeating.** This screen now has two client-side narrowings and they are not the same
 * kind of thing:
 *
 * - the **doelsoort** filter changes *what is being measured*, so the percentage follows it. It lives with the scope
 *   controls in the summary, beside "Meten tegen";
 * - **"Alleen ontbrekende"** changes *what is being shown*. The percentage must NOT follow it, or asking to see your
 *   gaps would report 0% every time. So it lives on the thing it actually changes.
 *
 * **The missing count is stated here whichever view is active**, because it is the number a teacher came for and it
 * should not require pressing anything to see. It counts the doelsoort-narrowed set, so it always agrees with the
 * fraction in the summary: `totaal - gedekt`, never a second traversal that could drift.
 *
 * **It is withheld exactly when the figure is** (`magTellingTonen`). The counts are additive with the group tallies, so
 * printing "28 nog niet gedekt" while the summary declines to give a figure would hand back precisely the total the
 * directie ruling of 2026-07-28 withholds. The same defect the group tallies were fixed for, one level up.
 */
export interface DekkingslijstkopProps {
  alleenOntbrekende: boolean;
  onKies: (alleenOntbrekende: boolean) => void;
  /** How many of the measured doelen are not covered; rendered only when a figure may be shown at all. */
  aantalOntbrekend: number;
  /** False while a stale placement withholds the figure, exactly as for the summary and the group tallies. */
  magTellingTonen: boolean;
}

export function Dekkingslijstkop({
  alleenOntbrekende,
  onKies,
  aantalOntbrekend,
  magTellingTonen,
}: DekkingslijstkopProps) {
  const labelId = useId();

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span id={labelId} className="text-xs font-semibold text-ink">
          {t("dekking.toonLabel")}
        </span>

        {/* The same two-option track, the same three state carriers (`aria-pressed`, weight, fill on a bordered rail)
            and the same single structural hue as `Bereikschakelaar` and the kalender's zoom, so nothing rests on colour
            (Art. XII, WCAG 2.2 AA SC 1.4.1) and a teacher who has used one has used all of them. */}
        <div
          role="group"
          aria-labelledby={labelId}
          className="inline-flex rounded-md border border-input bg-card p-0.5"
        >
          {/* "Alle doelen" first: it is the state the screen opens in, and a control whose current value sits second
              reads as though something was already chosen for the teacher. Same ordering rule as the kleuterjaar
              chooser. */}
          <Keuzeknop gekozen={!alleenOntbrekende} onKies={() => onKies(false)}>
            {t("dekking.toonAlle")}
          </Keuzeknop>
          <Keuzeknop gekozen={alleenOntbrekende} onKies={() => onKies(true)}>
            {t("dekking.toonOntbrekende")}
          </Keuzeknop>
        </div>
      </div>

      {magTellingTonen && (
        <p className="text-sm font-medium text-ink" data-cijfers>
          {tAantal(
            aantalOntbrekend,
            "dekking.ontbrekendeTellingEnkelvoud",
            "dekking.ontbrekendeTelling",
          )}
        </p>
      )}
    </div>
  );
}

function Keuzeknop({
  gekozen,
  onKies,
  children,
}: {
  gekozen: boolean;
  onKies: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={gekozen}
      onClick={onKies}
      className={[
        "rounded px-3 py-1 text-xs transition-colors duration-150",
        gekozen
          ? "bg-petrol font-semibold text-petrol-foreground"
          : "font-medium text-ink hover:bg-petrol-wash hover:text-petrol",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
