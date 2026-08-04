import { Link, useLocation } from "react-router-dom";

import { JAARPLAN_PAD } from "../../app/routes";
import { t, tAantal } from "../../i18n";
import { Bereikschakelaar } from "./Bereikschakelaar";
import { bepaalCijfer } from "./dekkingFormat";
import type { Dekking, Dekkingsbereik } from "./types";

/**
 * The summary of one class's dekking, and **the one place on this screen where a number may appear** (E5-02).
 *
 * **The figure can honestly be absent, and that is the point of the design rather than an edge case.** Most coverage
 * screens open with a percentage; this one opens with a slot that holds one of three things. E5-01 made
 * `aantalGedekt` `null` while any stale placement is unresolved precisely so a caller *cannot* print a total it has
 * no right to (directie 2026-07-28: coverage must not claim what it cannot prove, because a thema whose period is
 * unknown is not demonstrably taught). So the withheld state is not an error banner bolted on: it occupies the same
 * space, at the same weight, and says what to do instead.
 *
 * **No percentage here.** The counts are E5-02's; the percentage, the doelsoort filter and the missing-goals list are
 * **E5-03**, and the gap-analyse presentation is **E5-05**. A percentage would also need the Art. XIV denominator
 * question settled further than it is: the owner ruled the single-leerjaar case on 2026-08-04 and the graadklas is
 * still open, which is exactly the state in which a big "35%" says more than anyone can defend.
 */
export interface DekkingsamenvattingProps {
  dekking: Dekking;
  bereik: Dekkingsbereik;
  onKiesBereik: (bereik: Dekkingsbereik) => void;
}

export function Dekkingsamenvatting({ dekking, bereik, onKiesBereik }: DekkingsamenvattingProps) {
  const cijfer = bepaalCijfer(dekking);
  // Read through the router rather than `window.location`, so the klas/schooljaar selection travels with the link the
  // way every other cross-screen link in this app carries it (ADR-0021), and so it is testable in jsdom.
  const location = useLocation();

  return (
    <section
      aria-labelledby="dekking-samenvatting"
      className="rounded-lg border border-border bg-card px-5 py-4"
    >
      <h3 id="dekking-samenvatting" className="sr-only">
        {t("dekking.titel")}
      </h3>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {cijfer.soort === "cijfer" && (
            // The hero. Tabular numerals so the figure does not shift width as it climbs, which it does on every
            // accept: a jittering total reads as a glitch rather than as progress.
            <p className="text-2xl font-bold text-ink" data-cijfers>
              {tAantal(cijfer.totaal, "dekking.cijferEnkelvoud", "dekking.cijfer", {
                gedekt: cijfer.gedekt,
              })}
            </p>
          )}

          {cijfer.soort === "ingehouden" && (
            <>
              {/*
                Same slot, same weight, no number. `attentie` rather than the dekking hues: this is not a coverage
                state, it is the absence of one, and colouring it green or red would assert something about coverage
                that nobody knows yet. The heading carries the words too, so the hue is never the only signal.
              */}
              <p className="text-2xl font-bold text-attentie-ink">{t("dekking.cijferIngehouden")}</p>
              <p className="mt-1 max-w-prose text-sm text-ink">
                {tAantal(
                  dekking.aantalOnopgelosteVervallenPlaatsingen,
                  "dekking.ingehoudenUitlegEnkelvoud",
                  "dekking.ingehoudenUitleg",
                )}
              </p>
              {/*
                THE RECONCILIATION E5-01 ASSIGNED TO THIS STORY, and it is copy rather than code. The kalender's
                non-dismissible notice counts EVERY stale placement, including rejected ones; this figure counts only
                the unresolved ones, because rejecting a stale proposal resolves it for dekking (owner ruling
                2026-08-03). So the two screens legitimately show different numbers for what looks like one thing, and
                without this sentence a teacher reading "3" there and "1" here concludes one of them is broken.
              */}
              <p className="mt-1 max-w-prose text-sm text-ink-zacht">
                {t("dekking.ingehoudenGeweigerd")}
              </p>
              {/*
                The action, on the screen that owns it. Not a button that pretends to fix it here: re-placing a thema
                is the kalender's inline affordance (E3-07), so this is a link to where the work happens rather than a
                control that does nothing (the E3-06 rule).
              */}
              <Link
                to={{ pathname: JAARPLAN_PAD, search: location.search }}
                className="mt-2 inline-block text-sm font-semibold text-petrol underline decoration-petrol/40 underline-offset-2 hover:decoration-petrol"
              >
                {t("dekking.naarJaarplan")}
              </Link>
            </>
          )}

          {cijfer.soort === "nietMeetbaar" && (
            <>
              {/*
                Nothing is in scope, so there is no fraction to be. This state is the one a screen could most easily
                render as success: "0 of 0" satisfies `gedekt === totaal`, and a progress bar would show it full.
                Hence its own branch and its own words.
              */}
              <p className="text-2xl font-bold text-ink">{t("dekking.nietMeetbaar")}</p>
              <p className="mt-1 max-w-prose text-sm text-ink">
                {dekking.aantalBuitenBereik === 0
                  ? t("dekking.nietMeetbaarLeeg")
                  : tAantal(
                      dekking.aantalBuitenBereik,
                      "dekking.nietMeetbaarUitlegEnkelvoud",
                      "dekking.nietMeetbaarUitleg",
                    )}
              </p>
              {/* Only when the school has loaded nothing at all is Inladen the next step. With goals loaded but none
                  in this class's scope, importing more of the same discipline would not help, so no link is offered
                  rather than one that leads nowhere useful. */}
              {dekking.aantalBuitenBereik === 0 && (
                <Link
                  to="/import"
                  className="mt-2 inline-block text-sm font-semibold text-petrol underline decoration-petrol/40 underline-offset-2 hover:decoration-petrol"
                >
                  {t("dekking.naarImport")}
                </Link>
              )}
            </>
          )}

          {/*
            What the figure above is a figure OF. One line, directly under it, because a total without its scope is not
            evidence: the same class has two legitimate denominators.

            **More than one code is a WIDER scope than the control admits, and it says so** (antagonist MAJOR-2). A
            kleutergroep has `Leerjaar = 0`, which cannot say which kleuterjaar it is, so it is measured against JK, K2
            and K3 together: up to two other years' doelen sit in a derde-kleuterklas's denominator and appear as its
            own lacunes. The payload reports `EigenJaarFase` with `isTerugvalNaarHeelCurriculum` false, which is
            accurate and not the whole truth, and only the leerjaar-7 case had a notice. Since kleuter is roughly half
            of a 2,5-12 school this is not an edge case.

            Derived from `gemetenJaarFasen.length` rather than from a new flag, deliberately: the sentence then cannot
            drift from the codes printed beside it, and a future graadklas ruling that yields two codes lands in the
            same branch without new copy. Whether a three-year scope may be labelled "Deze klas" at all is the owner's
            to rule and is recorded in the Art. XIV list.
          */}
          <p className="mt-2 max-w-prose text-sm text-ink-zacht">
            {dekking.gemetenJaarFasen.length === 0
              ? t("dekking.gemetenTegenAlles")
              : dekking.gemetenJaarFasen.length === 1
                ? t("dekking.gemetenTegen", { fasen: dekking.gemetenJaarFasen[0] })
                : t("dekking.gemetenTegenMeerdere", { fasen: dekking.gemetenJaarFasen.join(", ") })}
          </p>

          {/* The narrowing, stated rather than left implicit: a smaller denominator flatters the figure. Suppressed at
              0 so the whole-curriculum scope does not carry a sentence about nothing. */}
          {dekking.aantalBuitenBereik > 0 && cijfer.soort !== "nietMeetbaar" && (
            <p className="mt-1 max-w-prose text-sm text-ink-zacht">
              {tAantal(
                dekking.aantalBuitenBereik,
                "dekking.buitenBereikEnkelvoud",
                "dekking.buitenBereik",
              )}
            </p>
          )}

          {/*
            The class asked to be measured against its own jaar/fase and could not be, so the screen is showing more
            than was asked for. Said out loud, or the control and the content contradict each other: "Deze klas" is
            pressed while every leerjaar is listed. This is the unresolved graadklas half of the Art. XIV decision
            reaching a user.
          */}
          {dekking.isTerugvalNaarHeelCurriculum && (
            <p className="mt-1 max-w-prose text-sm text-attentie-ink">{t("dekking.terugval")}</p>
          )}
        </div>

        <div className="shrink-0">
          <Bereikschakelaar bereik={bereik} onKies={onKiesBereik} />
        </div>
      </div>
    </section>
  );
}
