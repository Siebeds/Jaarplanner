import { t } from "../../i18n";
import type { Generatieresultaat } from "./types";

/**
 * The report from one generation run (E3-02, FR-5.2): what was proposed, what was skipped, and how the result
 * is spread over the year.
 *
 * **It states facts and passes no judgement.** There is no green tick and no threshold: nothing in the
 * functional analysis defines an acceptable spread, so a verdict here would answer by code a question that
 * belongs to the school — the same reason the kalender's "te vol" limit is still marked provisional. The last
 * line says so out loud, because a teacher shown four numbers will otherwise reasonably assume the tool
 * approves or disapproves.
 *
 * **Nothing here is a decision.** Every placement the run added is `Voorgesteld` and visible on the ribbon for
 * the teacher to accept or reject (Art. IV.1/IV.2).
 */
export interface SpreidingsoverzichtProps {
  resultaat: Generatieresultaat;
}

export function Spreidingsoverzicht({ resultaat }: SpreidingsoverzichtProps) {
  const { spreiding } = resultaat;

  // Skipped items, only named when there is something to name. These are the model's misses — a thema the
  // school does not own, a date that is no boundary — never silently swallowed (Art. IV.4).
  const overgeslagen = [
    ...resultaat.onbekendeThemas,
    ...resultaat.onbekendeBlokken,
    ...resultaat.duplicaten,
    ...resultaat.afgewezen,
  ];

  return (
    <div className="mt-3 rounded-md border border-slate-300 bg-white p-3">
      <p className="text-sm font-medium text-slate-900">
        {resultaat.aantalNieuw === 0
          ? t("kalender.genereerNiets")
          : t("kalender.genereerGelukt", { aantal: resultaat.aantalNieuw })}
      </p>

      {resultaat.aantalBehouden > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("kalender.genereerBehouden", { aantal: resultaat.aantalBehouden })}
        </p>
      )}

      {overgeslagen.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("kalender.genereerOvergeslagen", { details: overgeslagen.join(" · ") })}
        </p>
      )}

      {spreiding && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            {t("kalender.spreidingTitel")}
          </h4>

          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-slate-700">
            <li>
              {t("kalender.spreidingBlokken", {
                gebruikt: spreiding.aantalGebruikteBlokken,
                totaal: spreiding.aantalBlokken,
              })}
            </li>

            {spreiding.legeBlokOrdinalen.length > 0 && (
              <li>
                {t("kalender.spreidingLeeg", {
                  ordinalen: spreiding.legeBlokOrdinalen.join(", "),
                })}
              </li>
            )}

            {spreiding.overbelasteBlokOrdinalen.length > 0 && (
              /* Icon AND word, never colour alone (Art. XII, WCAG 2.2 AA). */
              <li className="font-medium text-amber-900">
                <span aria-hidden="true">▲</span>{" "}
                {t("kalender.spreidingOverbelast", {
                  ordinalen: spreiding.overbelasteBlokOrdinalen.join(", "),
                })}
              </li>
            )}

            {spreiding.aantalGebruikteBlokken > 0 && (
              <li>
                {t("kalender.spreidingDoelen", {
                  minste: spreiding.minsteDoelenInEenBlok,
                  meeste: spreiding.meesteDoelenInEenBlok,
                })}
              </li>
            )}
          </ul>

          <p className="mt-2 text-xs italic text-muted-foreground">
            {t("kalender.spreidingGeenOordeel")}
          </p>
        </div>
      )}
    </div>
  );
}
