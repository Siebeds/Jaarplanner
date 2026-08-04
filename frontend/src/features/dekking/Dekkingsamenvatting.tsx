import { Link, useLocation } from "react-router-dom";

import { JAARPLAN_PAD } from "../../app/routes";
import { t, tAantal } from "../../i18n";
import { Bereikschakelaar } from "./Bereikschakelaar";
import { Jaarfasekiezer } from "./Jaarfasekiezer";
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
  /** The single jaar/fase narrowed to, or null for all of the class's own codes. */
  gekozenJaarFase: string | null;
  onKiesJaarFase: (jaarFase: string | null) => void;
}

export function Dekkingsamenvatting({
  dekking,
  bereik,
  onKiesBereik,
  gekozenJaarFase,
  onKiesJaarFase,
}: DekkingsamenvattingProps) {
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
            // Same slot, same weight, no number. `attentie` rather than the dekking hues: this is not a coverage
            // state, it is the absence of one, and colouring it green or red would assert something about coverage
            // that nobody knows yet. The heading carries the words too, so the hue is never the only signal. The
            // explanation and the link live BELOW, outside this slot, because they are also needed in the combined
            // state where the scope is empty and this branch is not the one that renders.
            <p className="text-2xl font-bold text-attentie-ink">{t("dekking.cijferIngehouden")}</p>
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
            THE UNRESOLVED PLACEMENTS, rendered OUTSIDE the three-way slot above (antagonist round 2). They used to sit
            inside the `ingehouden` branch, which meant that when the scope was ALSO empty — an L3 class while only
            kleuterdoelen are loaded — the slot said "nog niets om tegen te meten" and the screen said nothing
            whatsoever about a placement awaiting a decision, nor offered the link to go resolve it. `bepaalCijfer`
            justified its branch order by claiming this block already existed independently; it did not, and now it
            does.

            The second sentence is THE RECONCILIATION E5-01 ASSIGNED TO THIS STORY, and it is copy rather than code.
            The kalender's non-dismissible notice counts EVERY stale placement, including rejected ones; this count
            covers only the unresolved, because rejecting a stale proposal resolves it for dekking (owner ruling
            2026-08-03). Without it, a teacher reading "3" there and "1" here concludes one of the two is broken.

            The link goes where the work happens rather than pretending to fix it here: re-placing a thema is the
            kalender's inline affordance (E3-07), so this is a link rather than a control that does nothing (E3-06).
          */}
          {dekking.aantalOnopgelosteVervallenPlaatsingen > 0 && (
            <>
              <p className="mt-1 max-w-prose text-sm text-ink">
                {tAantal(
                  dekking.aantalOnopgelosteVervallenPlaatsingen,
                  "dekking.ingehoudenUitlegEnkelvoud",
                  "dekking.ingehoudenUitleg",
                )}
              </p>
              <p className="mt-1 max-w-prose text-sm text-ink-zacht">
                {t("dekking.ingehoudenGeweigerd")}
              </p>
              <Link
                to={{ pathname: JAARPLAN_PAD, search: location.search }}
                className="mt-2 inline-block text-sm font-semibold text-petrol underline decoration-petrol/40 underline-offset-2 hover:decoration-petrol"
              >
                {t("dekking.naarJaarplan")}
              </Link>
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
              : dekking.gemetenJaarFasen.length > 1
                ? t("dekking.gemetenTegenMeerdere", { fasen: dekking.gemetenJaarFasen.join(", ") })
                : // One code, and WHY it is one matters. For an L3 class it is simply the class's leerjaar; for a
                  // kleutergroep that narrowed, it is the teacher's own choice, and saying "gemeten tegen de doelen van
                  // K3" without that would read as though the tool knew all along.
                  dekking.beschikbareJaarFasen.length > 1
                  ? t("dekking.gemetenTegenGekozen", { fasen: dekking.gemetenJaarFasen[0] })
                  : t("dekking.gemetenTegen", { fasen: dekking.gemetenJaarFasen[0] })}
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

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <Bereikschakelaar bereik={bereik} onKies={onKiesBereik} />

          {/* Only for a class that HAS more than one code, which today means a kleutergroep and tomorrow may mean a
              graadklas. A control offering one option would be a control that does nothing (the E3-06 rule). */}
          {dekking.beschikbareJaarFasen.length > 1 && (
            <Jaarfasekiezer
              beschikbaar={dekking.beschikbareJaarFasen}
              gekozen={gekozenJaarFase}
              onKies={onKiesJaarFase}
            />
          )}
        </div>
      </div>
    </section>
  );
}
