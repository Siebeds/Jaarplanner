import { Link, useLocation } from "react-router-dom";

import { DEKKING_PAD } from "../../app/routes";
import { t, tAantal } from "../../i18n";
import { bepaalVoortgangsbalk } from "./voortgang";
import { useDekkingsvoortgang } from "./useDekkingsvoortgang";

/**
 * The live coverage progress bar (E9-06, CR4, FR-9.1): what this class covers now, and what accepting the placements
 * standing in its plan would add.
 *
 * **Why a second read exists at all, since it looks like duplication.** `GET …/dekking` reports `aantalGedekt` and no
 * ceiling, and the ceiling is the entire point: while a teacher links doelen to a thema that is not placed yet, honest
 * coverage does not move (Art. V.1 — a doel is covered through the *thema placement*), so a one-figure bar would sit
 * perfectly still through the twenty minutes of work CR4 exists to make visible, and read as broken. The pair was
 * computed by `BerekenVooruitzichtAsync` and reachable only from the two generation endpoints; E9-06's backend half
 * made it a read.
 *
 * **The two quantities are never added together and the second is never called coverage** (Art. IV.1). `teAanvaarden`
 * counts placements the teacher has not answered, including AI proposals, so presenting the sum as one figure would
 * report an AI suggestion as taught. They get separate labels and separate visual treatments; see
 * `.dekking-arcering` in `index.css` for why the second is a texture rather than a hue.
 *
 * **All meaning is in the text; the bar is `aria-hidden` and presentational**, the same division `Dekkingsamenvatting`
 * already makes on `/dekking`. That is what satisfies Art. XII's "never colour alone" — not the hatch pattern, which
 * is a third carrier rather than the only one.
 *
 * **It is not a second dekkingsoverzicht.** No per-doel list, no gap analysis, no doelsoort filter, no export, no
 * scope control: those live on `/dekking` (E5-02/03/05/06) and this links there. If it ever grows a filter it has
 * become that screen and belongs on it.
 */
export interface DekkingsvoortgangsbalkProps {
  klasId: string;
  /**
   * The narrowing currently applied, or null for all of the class's own codes.
   *
   * **Threaded into the link as well as into the query**, so following it does not silently widen the scope back out
   * and land the teacher on a screen measuring a different denominator. That defect was found and fixed once already,
   * on the sibling link this component replaces in the jaarplanner.
   */
  jaarFase: string | null;
  /**
   * Extra classes for the wrapper, so each mount site can place it without this component knowing where it is.
   *
   * The jaarplanner needs the knelpunt treatment it inherits (a left rule, no fill); `/themas` needs a plain card.
   */
  className?: string;
  /**
   * The mount site already states the withholding, so this bar renders **nothing** in that state instead of repeating
   * it.
   *
   * **Only the kalender passes this, and it is not a styling preference.** A stale placement makes the figures null,
   * and the kalender carries its own non-dismissible notice counting exactly those placements with the inline
   * affordance to resolve them. Two statements of one fact, in different words, a few hundred pixels apart, is the
   * E4-06 "one card says two things" defect, and it is why the component this replaces returned `null` here too.
   *
   * `/themas` does **not** pass it: nothing on that screen says why the figure is absent, so there the withheld state
   * is the only thing standing between a teacher and a bar that silently stopped moving.
   */
  ingehoudenElders?: boolean;
}

export function Dekkingsvoortgangsbalk({
  klasId,
  jaarFase,
  className = "",
  ingehoudenElders = false,
}: DekkingsvoortgangsbalkProps) {
  // Read through the router rather than `window.location`, so the klas/schooljaar selection travels with the link the
  // way every other cross-screen link in this app carries it (ADR-0021), and so it is testable in jsdom.
  const location = useLocation();

  /*
    `EigenJaarFase` always, matching the kalender's own choice for the same reason: the whole-curriculum scope is a
    deliberate decision a teacher makes on `/dekking`, and offering it here would put a second scope control on a
    screen for a figure that is about this class.
  */
  const voortgang = useDekkingsvoortgang(klasId, "EigenJaarFase", jaarFase);

  // Carries the narrowing AND the klas/schooljaar selection. `location.search` already holds the latter, and the
  // jaarFase is appended rather than assumed to be in there: on the kalender the narrowing lives in component state
  // for the *kleuterjaar chooser*, not always in the URL.
  const zoek = new URLSearchParams(location.search);
  if (jaarFase) {
    zoek.set("jaarFase", jaarFase);
  }
  const doel = { pathname: DEKKING_PAD, search: zoek.toString() };

  const link = (
    <Link
      to={doel}
      className="shrink-0 text-sm font-semibold text-petrol underline decoration-petrol/40 underline-offset-2 hover:decoration-petrol"
    >
      {t("dekking.voortgangLink")}
    </Link>
  );

  /*
    A failed load SAYS SO rather than rendering nothing, and this rule is inherited rather than invented: silence here
    reads as "no goals are missing", which is the one direction a coverage signal must never fail in. It is the reason
    the component this replaces in the jaarplanner had an error branch at all.
  */
  if (voortgang.isError) {
    return (
      <section aria-label={t("dekking.voortgangTitel")} className={wrapper(className)}>
        <p className="text-sm text-ink">{t("dekking.fout")}</p>
        {link}
      </section>
    );
  }

  /*
    Still loading. Nothing is rendered, and this is the one state where silence is right: there is no claim to make
    yet, and a skeleton bar would be a shape a teacher reads as a figure of zero. Every write that moves this figure
    DROPS the cache entry rather than invalidating it (see `useDekkingsvoortgang`), so this branch is also what a
    teacher sees for the length of the refetch after they link a doel, which is the alternative to showing them the
    pre-edit number. Every such write goes through `vernieuwDekking`, which **resets** rather than removes: a remove
    would clear the entry without notifying this observer, and on `/themas` nothing else re-renders to rebuild it, so
    the bar would never move at all.
  */
  if (voortgang.data === undefined) {
    return null;
  }

  const balk = bepaalVoortgangsbalk(voortgang.data);

  if (balk.soort === "nietMeetbaar") {
    /*
      Nothing in scope, so there is no fraction to be. **This is the state a progress bar would most easily render as
      success** — 0 of 0 satisfies `gedekt === totaal` and would draw full — so it gets its own branch, its own words
      and no bar at all. `bepaalVoortgangsbalk` gates it first for the same reason.

      The link is what makes this actionable without a paragraph: `/dekking` distinguishes "no curriculum loaded" from
      "none of it belongs to this class" and offers the import when that is the remedy. Repeating that reasoning here
      is what E9-08 is about removing, not adding.
    */
    return (
      <section aria-label={t("dekking.voortgangTitel")} className={wrapper(className)}>
        <p className="text-sm font-semibold text-ink">{t("dekking.nietMeetbaar")}</p>
        {link}
      </section>
    );
  }

  if (balk.soort === "ingehouden") {
    /*
      A placement points at a period that no longer exists, so the server sends no figures (directie 2026-07-28) and
      there is none to print. Both are withheld together, which is what stops this bar from drawing a ceiling beside a
      blank and reading as coverage of zero.

      `attentie-ink` rather than either dekking hue, following `Dekkingsamenvatting`: this is not a coverage state, it
      is the absence of one, and colouring it green or red would assert something nobody knows yet. The words carry it
      too, so the hue is never the only signal.

      Suppressed entirely where the mount site already says it; see {@link DekkingsvoortgangsbalkProps.ingehoudenElders}.
    */
    if (ingehoudenElders) {
      return null;
    }

    return (
      <section aria-label={t("dekking.voortgangTitel")} className={wrapper(className)}>
        <p className="text-sm font-semibold text-attentie-ink">{t("dekking.cijferIngehouden")}</p>
        {link}
      </section>
    );
  }

  return (
    <section aria-label={t("dekking.voortgangTitel")} className={wrapper(className)}>
      <div className="min-w-0 flex-1">
        {/* The fraction, which is also the denominator E9-06 requires it to state. Tabular numerals, so it does not
            shift width as the figures climb: they move on every accept, and a jittering total reads as a glitch
            rather than as progress. */}
        <p className="text-sm font-medium text-ink" data-cijfers>
          {tAantal(balk.totaal, "dekking.cijferEnkelvoud", "dekking.cijfer", {
            gedekt: balk.gedekt,
          })}
        </p>

        {/*
          THE BAR. Three regions on one track, `aria-hidden` and purely presentational: the fraction above and the
          sentence below already carry both quantities, and a bar that announced itself would make a screen reader read
          the same facts twice.

          Widths come from the CLAMPED percentages (`bepaalPercentage` holds 1..99), so the covered segment can never
          look full at 99%, and the second segment is drawn from the DIFFERENCE rather than from the ceiling: drawing
          `percentageMogelijk` from zero would paint over the covered part and show one number where there are two.
        */}
        <div
          aria-hidden="true"
          className="mt-1.5 flex h-2 w-full max-w-xs overflow-hidden rounded-full bg-dekking-niet-gedekt/25"
        >
          <div className="h-full bg-dekking-gedekt" style={{ width: `${balk.percentageGedekt}%` }} />
          <div
            className="dekking-arcering h-full"
            style={{ width: `${balk.percentageMogelijk - balk.percentageGedekt}%` }}
          />
        </div>

        {/*
          The increment, and the noun in it is a correction rather than a phrasing choice.

          It says **plaatsingen**, not *voorstellen*. The ceiling counts placements the teacher has not answered; a
          doelsuggestie that has not been accepted does NOT raise it, which is pinned by
          `Een_nog_niet_aanvaarde_doelsuggestie_verhoogt_het_plafond_niet`. On the kalender the owner ruled the loose
          word acceptable because the cards it counts sit directly beside it (2026-08-06). **That justification does
          not transfer to `/themas`**, where there is no board on screen and where the thing the teacher is accepting
          all afternoon *is* a doelsuggestie. So the noun names what actually moves the figure.

          Suppressed at 0, so a plan with nothing standing in it carries no sentence about nothing.
        */}
        {balk.teAanvaarden > 0 && (
          <p className="mt-1 text-xs text-ink-zacht" data-cijfers>
            {tAantal(
              balk.teAanvaarden,
              "dekking.voortgangTeAanvaardenEnkelvoud",
              "dekking.voortgangTeAanvaarden",
              { aantal: balk.teAanvaarden },
            )}
          </p>
        )}
      </div>

      {link}
    </section>
  );
}

/**
 * One flex row in every state, so the link keeps its place while the left half changes shape.
 *
 * A `section` with an accessible name rather than a bare `div`: this is a landmark a screen-reader user arrives at out
 * of context, and "7 van 14 doelen gedekt" does not say what it is 7 of. The name is not rendered visibly, because
 * every mount site already sits under a heading that says where you are, and CR1 is about taking prose off the screen.
 */
function wrapper(extra: string) {
  return `flex items-start justify-between gap-4 ${extra}`.trim();
}
