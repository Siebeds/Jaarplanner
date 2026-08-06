import { t, tAantal } from "../../i18n";
import { Parameteroverzicht } from "./Parameteroverzicht";
import { Vooruitzichtoverzicht } from "./Vooruitzichtoverzicht";
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
  /**
   * Why this run's **measurements** no longer describe what is on screen, or `null` while they still do (E3-03).
   *
   * **Both measured blocks react, and that is a correction** (antagonist round 2). Round 1 withheld only the dekking
   * figures, on the reasoning that the spreiding lines are statements about the run while "Nu gedekt" is present
   * tense about the plan. **That reasoning was false:** `spreidingLeeg` ("Nog leeg: themaperiode 3") and
   * `spreidingOverbelast` ("Te vol …") are present-tense claims about the plan too, and E3-09 made te-vol a live
   * property rendered from the plain jaarplan read on the board beside this panel. The result was one panel printing
   * an unqualified "▲ Te vol" directly above "deze cijfers kloppen niet meer" — the E4-06 contradiction this fix was
   * meant to end, moved four lines up.
   *
   * So the rule is now stated by what a line is *about*: the counts of what this run added, kept, replaced and
   * skipped stay (they are facts about the run and remain true forever), and everything measured **over the plan** is
   * withheld together.
   *
   * **That rule is applied to the parameter report too, and it lands the other way** (antagonist round 3): its
   * sentences are run facts, so it stays visible, but two of them were phrased as present-tense claims about the plan
   * and had to be reworded before that was true. A block is not exempt because it sits outside the branch; it is
   * outside the branch because every sentence in it survives an edit.
   */
  verouderd?: Verouderingsreden | null;
}

/**
 * Why a run's measurements are stale. Two causes, two sentences: "je hebt het jaarplan aangepast" is simply the
 * wrong thing to say to a teacher who only changed the kleuterjaar chooser.
 */
export type Verouderingsreden = "plan" | "bereik";

export function Spreidingsoverzicht({ resultaat, verouderd = null }: SpreidingsoverzichtProps) {
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

      {verouderd !== null ? (
        /* One notice replacing every plan-measured block at once, rather than one per block. Placed where those
           measurements would have been, so it reads as their replacement rather than as a remark about the run counts
           above it.

           **It does not govern the parameter report below it, and saying that it did was wrong** (antagonist round 3).
           That report is outside this branch on purpose: every sentence in it is a fact about the run ("de AI koos een
           ander thema", "vast moment meegenomen"), and a fact about the run stays true no matter what the teacher
           edits afterwards. The two sentences that were NOT run facts are the reason this comment had to be corrected
           rather than merely believed: `rapportGeweigerd` said "Thema's die **nu** in geen enkele themaperiode staan"
           and `rapportGeweigerdWatNu` told the teacher to give it a period, both still printing after the teacher had
           done exactly that. They are reworded as run facts instead of being withheld, because the refusal block
           carries the model's motivation and is the only place that proposal can still be read. */
        <p className="mt-4 border-t border-border pt-3 text-xs text-ink-zacht">
          {t(verouderd === "bereik" ? "kalender.metingenVerouderdBereik" : "kalender.metingenVerouderd")}
        </p>
      ) : (
        <>
          {spreiding && (
            <div className="mt-4 border-t border-border pt-3">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-zacht">
                {t("kalender.spreidingTitel")}
              </h3>

              <ul className="mt-1.5 flex flex-col gap-1 text-xs text-ink" data-cijfers>
                <li>
                  {/* Through `tAantal` on the TOTAL, because that is the number the noun follows: "1 van 1
                      themaperiodes gebruikt" was ungrammatical on a year deriving a single period. Pre-existing, and
                      neither E3-02 nor E3-09 authored it — it surfaced when E3-09 widened `catalogus.test.ts` to stop
                      finding counts by placeholder NAME (`{aantal}`) and start finding them by the noun that follows
                      them. Fixed rather than exempted: the guard is new, so this is its first real catch and waving it
                      through would teach the next reader that the list is advisory. */}
                  {tAantal(
                    spreiding.aantalBlokken,
                    "kalender.spreidingBlokkenEnkelvoud",
                    "kalender.spreidingBlokken",
                    {
                      gebruikt: spreiding.aantalGebruikteBlokken,
                      totaal: spreiding.aantalBlokken,
                    },
                  )}
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

          {/* What the proposal would cover once accepted (E3-03, FR-5.3). Below the spreading rather than above it:
              the spreading describes what came back, and this describes what it would be worth — a teacher reads the
              second question after the first. Absent on a failed run, where nothing was persisted to measure. */}
          {resultaat.vooruitzicht && <Vooruitzichtoverzicht vooruitzicht={resultaat.vooruitzicht} />}
        </>
      )}

      {/* The parameter report belongs to the same run, so it lives in the same panel (E3-04, FR-5.4). It renders
          nothing when the teacher set no parameters. Deliberately OUTSIDE the staleness branch above: it states run
          facts only, which an edit cannot falsify. See the notice's own comment for what that cost to establish. */}
      {resultaat.parameters && <Parameteroverzicht rapport={resultaat.parameters} />}
    </div>
  );
}
