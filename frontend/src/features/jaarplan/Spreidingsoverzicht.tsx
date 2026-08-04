import { t, tAantal } from "../../i18n";
import { Parameteroverzicht } from "./Parameteroverzicht";
import type { Generatieresultaat } from "./types";

/**
 * The report from one generation run (E3-02, FR-5.2): what was proposed, what was skipped, and how the result
 * is spread over the year.
 *
 * **It states facts and passes no judgement on the spread.** There is no green tick: nothing in the functional
 * analysis defines an acceptable spread, so a verdict on it here would answer by code a question that belongs to the
 * school. The last line says so out loud, because a teacher shown four numbers will otherwise reasonably assume the
 * tool approves or disapproves.
 *
 * **The overbelast line is the one exception, and it is not an invented threshold.** It reports the same te-vol rule
 * the board flags (owner ruling, 2026-07-31, E3-09): the placed thema's need more weeks than the period offers, both
 * figures supplied by the school. It is therefore worded with the same words the board uses, because one signal under
 * two names reads as two problems.
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
    <div className="mt-4 rounded-md border border-border bg-paper p-4">
      <p className="text-sm font-semibold text-ink">
        {resultaat.aantalNieuw === 0
          ? t("kalender.genereerNiets")
          : tAantal(
              resultaat.aantalNieuw,
              "kalender.genereerGeluktEnkelvoud",
              "kalender.genereerGelukt",
            )}
      </p>

      {/* The superseded proposal is deleted BEFORE the new placements are added and is persisted either way,
          so a run that places nothing has still changed the plan. This line used to be absent and the
          zero-result copy read "Er is niets gewijzigd" — a false statement about the teacher's own data, which
          the E3-02 code review caught. Shown whenever anything was discarded, success or not. */}
      {resultaat.aantalVervangen > 0 && (
        <p className="mt-1.5 text-xs text-ink-zacht">
          {tAantal(
            resultaat.aantalVervangen,
            "kalender.genereerVervangenEnkelvoud",
            "kalender.genereerVervangen",
          )}
        </p>
      )}

      {resultaat.aantalBehouden > 0 && (
        <p className="mt-1.5 text-xs text-ink-zacht">
          {tAantal(
            resultaat.aantalBehouden,
            "kalender.genereerBehoudenEnkelvoud",
            "kalender.genereerBehouden",
          )}
        </p>
      )}

      {overgeslagen.length > 0 && (
        <p className="mt-1.5 text-xs text-ink-zacht">
          {t("kalender.genereerOvergeslagen", { details: overgeslagen.join(" · ") })}
        </p>
      )}

      {spreiding && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-zacht">
            {t("kalender.spreidingTitel")}
          </h3>

          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-ink" data-cijfers>
            <li>
              {t("kalender.spreidingBlokken", {
                gebruikt: spreiding.aantalGebruikteBlokken,
                totaal: spreiding.aantalBlokken,
              })}
            </li>

            {spreiding.legeBlokOrdinalen.length > 0 && (
              <li>
                {tAantal(
                  spreiding.legeBlokOrdinalen.length,
                  "kalender.spreidingLeegEnkelvoud",
                  "kalender.spreidingLeeg",
                  { ordinalen: spreiding.legeBlokOrdinalen.join(", ") },
                )}
              </li>
            )}

            {spreiding.overbelasteBlokOrdinalen.length > 0 && (
              /* Icon AND word, never colour alone (Art. XII, WCAG 2.2 AA). */
              <li className="font-semibold text-attentie-ink">
                <span aria-hidden="true">▲</span>{" "}
                {tAantal(
                  spreiding.overbelasteBlokOrdinalen.length,
                  "kalender.spreidingOverbelastEnkelvoud",
                  "kalender.spreidingOverbelast",
                  { ordinalen: spreiding.overbelasteBlokOrdinalen.join(", ") },
                )}
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

          <p className="mt-2.5 text-xs italic text-ink-zacht">
            {t("kalender.spreidingGeenOordeel")}
          </p>
        </div>
      )}

      {/* The parameter report belongs to the same run, so it lives in the same panel (E3-04, FR-5.4). It renders
          nothing when the teacher set no parameters. */}
      {resultaat.parameters && <Parameteroverzicht rapport={resultaat.parameters} />}
    </div>
  );
}
