import { useId } from "react";

import { t } from "../../i18n";

/**
 * Which of the class's own jaar/fase codes to measure against (E5-02, owner ruling 2026-08-04).
 *
 * **It exists for the kleutergroep, and it is not keyed on being one.** `Klas.Leerjaar` is `0` for a kleutergroep and
 * cannot say *which* kleuterjaar, so the derived scope is `JK + K2 + K3`: a derde kleuterklas was carrying roughly three
 * times the doelen it teaches, its figure read about a third of what it is, and its gap list named doelen for
 * two-and-a-half-year-olds it will never teach and does not have to. The owner ruled that the teacher says which year.
 *
 * The control therefore renders on **"this class has more than one available code"** rather than on "is this kleuter":
 * the second is a question the data model cannot answer, and the still-open graadklas decision (Art. XIV) would answer
 * it differently while producing exactly the same shape here.
 *
 * **The narrowing is a filter over what the class HAS**, which is why the options come from the payload's
 * `beschikbareJaarFasen` rather than from a hard-coded kleuter list: nobody can measure a kleutergroep against L6, and
 * the day a graadklas gets two codes this control offers those two without a change.
 *
 * Same gesture and the same three state carriers as `Bereikschakelaar` and the kalender's zoom (`aria-pressed`, weight,
 * fill-versus-transparent on a bordered track), so nothing rests on colour (Art. XII, WCAG 2.2 AA) and a teacher who has
 * used one has used all three. No new hue: `petrol` is the one structural chrome colour.
 */
export interface JaarfasekiezerProps {
  /** The codes this class could be measured against, in curriculum order, as the server derived them. */
  beschikbaar: readonly string[];
  /** The single code currently narrowed to, or null when all of them are being measured. */
  gekozen: string | null;
  onKies: (jaarFase: string | null) => void;
}

export function Jaarfasekiezer({ beschikbaar, gekozen, onKies }: JaarfasekiezerProps) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span id={labelId} className="text-xs font-semibold text-ink">
          {t("dekking.jaarFaseLabel")}
        </span>

        <div
          role="group"
          aria-labelledby={labelId}
          className="inline-flex rounded-md border border-input bg-card p-0.5"
        >
          {/* "Alle drie" first, because it is the state the screen starts in: a teacher narrows FROM everything, and a
              control whose current value sits in the middle reads as though something was already chosen for them. */}
          <button
            type="button"
            aria-pressed={gekozen === null}
            onClick={() => onKies(null)}
            className={[
              "rounded px-3 py-1 text-xs transition-colors duration-150",
              gekozen === null
                ? "bg-petrol font-semibold text-petrol-foreground"
                : "font-medium text-ink hover:bg-petrol-wash hover:text-petrol",
            ].join(" ")}
          >
            {t("dekking.jaarFaseAlle")}
          </button>

          {beschikbaar.map((code) => {
            const isGekozen = code === gekozen;

            return (
              <button
                key={code}
                type="button"
                aria-pressed={isGekozen}
                onClick={() => onKies(code)}
                className={[
                  "rounded px-3 py-1 text-xs transition-colors duration-150",
                  isGekozen
                    ? "bg-petrol font-semibold text-petrol-foreground"
                    : "font-medium text-ink hover:bg-petrol-wash hover:text-petrol",
                ].join(" ")}
              >
                {/* The Op.stap code itself, not a translated label. It is the school's own vocabulary, it is what the
                    doelen carry, and inventing "derde kleuterklas" here would invite a mismatch with the rows below. */}
                {code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Why this control exists at all, once, under it. A teacher who has never thought about JK/K2/K3 as a scope needs
          to know that the tool cannot tell, or the choice looks arbitrary. */}
      <p className="max-w-prose text-xs text-ink-zacht">{t("dekking.jaarFaseUitleg")}</p>
    </div>
  );
}
