import { Link, useLocation } from "react-router-dom";

import { JAARPLAN_PAD } from "../../app/routes";
import { t, tAantal } from "../../i18n";
import { doelsoortLabel } from "../../components/doelsoort";
import { Bereikschakelaar } from "./Bereikschakelaar";
import { Doelsoortfilter } from "./Doelsoortfilter";
import { Jaarfasekiezer } from "./Jaarfasekiezer";
import type { Dekkingscijfer, Doelsoortkeuze, Doelsoortoptie } from "./dekkingFormat";
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
 * **The percentage is E5-03's and it arrived with two conditions attached.** E5-02 declined to show one, on the
 * grounds that *"a big 35% says more than anyone can defend"* while the Art. XIV denominator question was open. The
 * owner ruled the single-leerjaar half on 2026-08-04 and the graadklas half is still open, so the figure ships with
 * the scope sentence directly under it and the terugval notice beside it: a percentage on this screen is never
 * allowed to appear without saying what it is a percentage *of*. It also never appears where the count would not
 * (`bepaalCijfer` is the one gate), so the directie ruling of 2026-07-28 governs both figures identically.
 *
 * **Still not here:** the minimumdoel level (**E5-04**, blocked on E1-12).
 *
 * *This line used to name the gap-analyse too. E5-05 built it (2026-08-07), and it lives one component down in
 * `Lacuneroutes` rather than in this card, deliberately: this card is where the figure and its scope are stated, and
 * the routes out of the gaps are gated on that figure being shown at all. Keeping them apart is what lets the gate be
 * expressed once, in `DekkingPagina`, instead of twice.*
 */
export interface DekkingsamenvattingProps {
  dekking: Dekking;
  /**
   * The figure to render, computed once by the page over the doelsoort-narrowed set.
   *
   * **Passed in rather than computed here**, which is a change E5-03 had to make: the summary and the group tallies
   * must agree about whether a figure may be shown at all, they now both depend on the active filter, and two call
   * sites deriving that from two argument lists is how they would come to disagree. The single-source property was
   * already load-bearing (`DekkingPagina`'s `magTellingTonen` exists because the summary once withheld a figure while
   * every group printed one); a filter multiplies the ways to get it wrong.
   */
  cijfer: Dekkingscijfer;
  bereik: Dekkingsbereik;
  onKiesBereik: (bereik: Dekkingsbereik) => void;
  /** The single jaar/fase narrowed to, or null for all of the class's own codes. */
  gekozenJaarFase: string | null;
  onKiesJaarFase: (jaarFase: string | null) => void;
  /** The doelsoorten present in scope, with counts, for the filter's options. */
  doelsoortopties: readonly Doelsoortoptie[];
  gekozenDoelsoort: Doelsoortkeuze;
  onKiesDoelsoort: (doelsoort: Doelsoortkeuze) => void;
}

export function Dekkingsamenvatting({
  dekking,
  cijfer,
  bereik,
  onKiesBereik,
  gekozenJaarFase,
  onKiesJaarFase,
  doelsoortopties,
  gekozenDoelsoort,
  onKiesDoelsoort,
}: DekkingsamenvattingProps) {
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
            // The hero, in two registers: the percentage FR-9.2 asks for, and directly under it the fraction it was
            // computed from. Never the percentage alone. `bepaalPercentage` clamps 1..99 so a rounded figure can
            // never contradict the fraction, and printing the fraction is what makes that guarantee checkable by the
            // person reading it rather than only by a test.
            //
            // Tabular numerals on both, so neither shifts width as the figures climb: they move on every accept, and
            // a jittering total reads as a glitch rather than as progress.
            <>
              <p className="text-3xl font-bold leading-none text-ink" data-cijfers>
                {t("dekking.percentage", { percentage: cijfer.percentage })}
              </p>
              <p className="mt-1 text-sm font-medium text-ink" data-cijfers>
                {tAantal(cijfer.totaal, "dekking.cijferEnkelvoud", "dekking.cijfer", {
                  gedekt: cijfer.gedekt,
                })}
              </p>

              {/*
                The gap, made visible at a glance. `aria-hidden` and purely presentational: both figures above already
                carry the meaning, and a bar that announced itself would make a screen reader read the same fact three
                times. It is the one decorative element on this screen and it earns its place by showing the REMAINDER,
                which is what a teacher is here to close and what no single number puts in front of them.

                Two existing dekking tokens, no new hue (Art. XII): the covered part is `dekking-gedekt`, the rest is
                the `dekking-niet-gedekt` wash rather than empty space, so the bar reads as a whole divided in two
                rather than as a progress bar that has not finished loading. Widths come from the CLAMPED percentage,
                so the bar cannot look full at 99% either.
              */}
              <div
                aria-hidden="true"
                className="mt-2 flex h-2 w-full max-w-xs overflow-hidden rounded-full bg-dekking-niet-gedekt/25"
              >
                <div
                  className="h-full rounded-full bg-dekking-gedekt"
                  style={{ width: `${cijfer.percentage}%` }}
                />
              </div>
            </>
          )}

          {cijfer.soort === "geenVanDezeSoort" && (
            // Doelen ARE loaded and in scope; none of them is of the chosen soort. Distinct from `nietMeetbaar`
            // because the remedy is different and one click away: change the filter, not import a curriculum. Reached
            // only through the filter, so the sentence names the doelsoort the teacher chose rather than describing
            // the state in the abstract.
            //
            // **The sentence points at the control by its LABEL, not by where it sits, and that is a fix rather than a
            // style choice.** It first read "Kies hiernaast een andere doelsoort", which is true at 1440px and false at
            // 390px: the control column stacks under the summary there, measured at 146px BELOW this paragraph rather
            // than beside it. Naming "Doelsoort" is true at every width and survives any future reflow, which the
            // per-breakpoint alternative would not.
            <>
              <p className="text-2xl font-bold text-ink">{t("dekking.geenVanDezeSoort")}</p>
              <p className="mt-1 max-w-prose text-sm text-ink">
                {t("dekking.geenVanDezeSoortUitleg", {
                  naam: gekozenDoelsoort ? doelsoortLabel(gekozenDoelsoort) : "",
                })}
              </p>
            </>
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
                // The `search` is carried, like every other cross-screen link in this app (ADR-0021). It used to be
                // absent, so following this link silently dropped the klas/schooljaar selection: found by E5-03's
                // antagonist, recorded against E5-02 in the epic file, and handed to whoever next opened this feature.
                // That is E5-06, so it is fixed here rather than routed on a third time. Low impact by itself, because
                // the import is school-wide and the teacher still lands somewhere useful. It is worth the two lines
                // because of how it was missed: E5-02's own audit enumerated every `to={` in this feature and concluded
                // one link was the only one without a `search`, and that enumeration was one short.
                <Link
                  to={{ pathname: "/import", search: location.search }}
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

          {/*
            THE DOELSOORT NARROWING, stated for the same reason as the scope line above it and directly beside it,
            because it does the same thing: it changes what the figure is a figure of. Filtering to MD makes "40" become
            "12", and a percentage that rose because the denominator shrank is the single most misleading thing this
            screen could do silently.

            **Rendered only when there IS a cijfer, which is a correction** (antagonist round 2). The guard was
            `!== "geenVanDezeSoort"`, so the sentence also reached `ingehouden` and `nietMeetbaar`: the screen said
            *"Nog geen betrouwbaar cijfer"* and then, directly under it, *"… tellen mee in dit cijfer"*, presupposing
            the very figure the line above refuses. The fix round made that worse rather than better, because the MD
            variant is forty-odd words comparing itself to minimumdoelniveau in a state where no dekking is reported at
            all. The `buitenBereik` sentence eight lines below already carried the right guard for the same reason.

            **MINIMUMDOEL GETS ITS OWN SENTENCE, and that is a correction rather than a nicety** (antagonist round 1,
            MAJOR-2). The doelsoort is labelled *"Minimumdoel"*, so with that filter on, the screen read, top to bottom:
            *"Dekking op het niveau van de minimumdoelen, wat de onderwijsinspectie toetst, zit er nog niet in"*, then
            **63%**, then *"Alleen doelen van de soort Minimumdoel tellen mee in dit cijfer."* A directie reads that as
            *63% van de minimumdoelen*, on the one screen whose whole job is to be evidence.

            They are genuinely different quantities, not two names for one. Art. V.1 makes a **minimumdoel** covered
            when **at least one** concorded leerplandoel is covered, aggregated over distinct `minimumdoelRef`; this
            counts leerplandoelen one by one whose `doelsoort` happens to be MD. The OR alone makes the two numbers
            differ, so E5-04 will print a different percentage for the same class. Saying so costs one sentence now and
            avoids retracting a number later.
          */}
          {gekozenDoelsoort !== null && cijfer.soort === "cijfer" && (
            <p className="mt-1 max-w-prose text-sm text-ink-zacht">
              {gekozenDoelsoort === "Minimumdoel"
                ? t("dekking.gefilterdOpMinimumdoel")
                : t("dekking.gefilterdOpDoelsoort", { naam: doelsoortLabel(gekozenDoelsoort) })}
            </p>
          )}

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

          {/*
            Grouped with the scope controls rather than sat above the list, because it belongs to the same question they
            answer: which doelen this figure is over. The "alleen ontbrekende" toggle deliberately does NOT live here,
            and that placement is the design carrying the distinction — it changes what is shown, not what is measured,
            so it sits on the thing it changes.

            Rendered when the scope holds more than one doelsoort **or a narrowing is currently active**, and the second
            half is a fix (antagonist round 1, MAJOR-1). The first half alone is the kleuterjaar chooser's rule — with
            one option every choice yields the same screen, so the control would do nothing (E3-06). But the two
            conditions intersect: a class whose scope holds exactly one doelsoort, plus a `?doelsoort=` naming another,
            renders *"Kies bij Doelsoort een andere soort"* with **no Doelsoort control on the page at all**. The list
            header is suppressed in that branch too, so the only ways out were the Back button and the scope switch,
            which changes the denominator rather than clearing the filter.

            It is reachable by ordinary clicking, not just by a pasted link: `useSelectie.kiesKlas` carries every other
            query param across a class switch, and `kiesBereik` deliberately keeps `doelsoort` while dropping
            `jaarFase`. So "Heel curriculum, filter to Verdieping, back to Deze klas" lands in it.

            A control that can clear a live narrowing is emphatically not a control that does nothing, so the E3-06 rule
            is satisfied by rendering it, not by hiding it.
          */}
          {(doelsoortopties.length > 1 || gekozenDoelsoort !== null) && (
            <Doelsoortfilter
              opties={doelsoortopties}
              gekozen={gekozenDoelsoort}
              onKies={onKiesDoelsoort}
            />
          )}

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
