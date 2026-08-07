import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { DOELSOORT_PARAM, JAARFASE_PARAM } from "../../app/routes";
import { useSelectie } from "../../app/useSelectie";
import { doelsoortBadgeSoort, type DoelsoortNaam } from "../../components/doelsoort";
import { t } from "../../i18n";
import { Dekkingexport } from "./Dekkingexport";
import { Dekkinggroep } from "./Dekkinggroep";
import { Dekkingsamenvatting } from "./Dekkingsamenvatting";
import { Dekkingslijstkop } from "./Dekkingslijstkop";
import { Lacuneroutes } from "./Lacuneroutes";
import {
  bepaalCijfer,
  beschikbareDoelsoorten,
  gemetenDoelen,
  groepeerPerSubdomein,
  telLacuneoorzaken,
  toonbareDoelen,
  type Doelsoortkeuze,
} from "./dekkingFormat";
import { useDekking } from "./useDekking";
import { DEKKINGSBEREIKEN, type Dekkingsbereik } from "./types";

/** The scope's query-string parameter, so a shared link opens the same denominator (ADR-0021). */
export const BEREIK_PARAM = "bereik";

/**
 * The doelsoort narrowing, in the URL for the same reason as the scope (E5-03).
 *
 * It changes the figure, so a link that omitted it would open a different percentage from the one the sender was
 * looking at. That is the whole argument for the scope being in the URL and it applies here identically.
 *
 * **Defined in `app/routes.ts` and re-exported, like `JAARFASE_PARAM` above it** (antagonist round 6). The
 * Doelen-register has read this key out of the URL since E1-16, and `Doeldekkingregel`'s *nakijken* link carries the
 * whole query string from here to `/doelen/{code}`, so it is a contract shared by two features rather than this page's
 * to own. Declaring it locally was the second instance of the drift the paragraph on `JAARFASE_PARAM` was written about.
 */
export { DOELSOORT_PARAM };

/**
 * Whether the list shows only the gaps.
 *
 * In the URL too, though it changes no figure: *"stuur me je ontbrekende doelen"* is the realistic thing a directie
 * asks a teacher for, and a link that dropped it would open the full list.
 */
export const ONTBREKEND_PARAM = "ontbrekend";

/**
 * The narrowed jaar/fase, in the URL for the same reason as the scope: a figure a directie is asked to check must be
 * linkable.
 *
 * **Defined in `app/routes.ts` and re-exported here** (E3-09, antagonist round 2). The kalender's knelpunt line carries
 * this param in its link, and importing it out of this page module pulled the whole page subtree into the jaarplan
 * feature's graph. Two literals would have been worse: a route contract shared by two features belongs to neither.
 */
export { JAARFASE_PARAM };

/**
 * The dekkingsoverzicht: which leerplandoelen this class's jaarplan covers and which it does not
 * (E5-02, FR-9.1, Art. V.1).
 *
 * **This is the screen the coverage feature existed without.** E5-01 built and Postgres-tested the computation and
 * shipped it behind an endpoint, and said so plainly: not a claim that FR-9 is satisfied, because no teacher could see
 * it. This story is that half, which is why the milestone wording matters more than the code volume: what has to be
 * true at the end is that a *person* can read their coverage, not that a service can compute it.
 *
 * **The scope lives in the URL**, like the klas/schooljaar selection and the register's filters: a coverage figure that
 * cannot be linked to is not much use as evidence, and a directie asked to check a number should be able to open
 * exactly what the teacher was looking at. Written with `replace`, so switching scope does not fill the history.
 *
 * **What this screen deliberately does not do**, so no later story credits itself with it and no reader mistakes an
 * absence for an oversight:
 * - **no percentage, no doelsoort filter, no ontbrekende-doelenlijst** (E5-03);
 * - **no gap-analyse grouped by discipline and actionable from the kalender** (E5-05);
 * - **no minimumdoel level**, the level the onderwijsinspectie actually tests (E5-04, blocked on E1-12 because no
 *   `Minimumdoel` row can exist yet). That absence is stated **on screen**, not only here: a directie reading this as
 *   inspectie-proof would otherwise draw a conclusion the data does not support.
 *
 * **The export exists as of E5-06** and this list used to say it did not. It is an `.xlsx` of the full set in scope,
 * offered from the header; the format and that "full set" are both owner rulings of 2026-08-06, taken because Art. XIV
 * reserves export layout for directie and E5-07 is blocked on exactly that. The document repeats the minimumdoel
 * caveat above in its own kopblok, because a file outlives the screen that produced it.
 */
export function DekkingPagina() {
  const { klasId } = useSelectie();
  const [searchParams, setSearchParams] = useSearchParams();

  const bereik = leesBereik(searchParams);
  // Not validated here against the class's codes, deliberately: only the server knows them, and it ignores one this
  // class does not have while reporting what it actually measured. Validating in the browser would need the answer
  // before the request that produces it.
  const jaarFase = searchParams.get(JAARFASE_PARAM) || null;
  const dekking = useDekking(klasId, bereik, jaarFase);

  // VALIDATED against the wire vocabulary, which is a correction (antagonist round 1, MINOR-2). It used to be an
  // unchecked cast, justified by "an unknown value matches no row, which `bepaalCijfer` reports with a sentence and a
  // way out". Both halves were wrong: `doelsoortLabel` looks the value up in `doelsoortBadgeSoort`, misses, and asks
  // the catalogue for `doelsoort.undefined`, which `t` returns verbatim — so `?doelsoort=Foo` printed *"geen enkel doel
  // van de soort doelsoort.undefined"* to a non-technical teacher (Art. II.3).
  //
  // Falls back to no narrowing rather than 400ing, exactly as `leesBereik` does for the scope: a teacher who followed a
  // stale link gets the working screen. A value that IS a real doelsoort but matches no row is a different case and
  // still reaches `geenVanDezeSoort`, which is the honest report and now always has a control to act on.
  const doelsoort = leesDoelsoort(searchParams);
  const alleenOntbrekende = searchParams.get(ONTBREKEND_PARAM) === "1";

  // THE ONE DERIVATION CHAIN, computed here and passed down, so the summary, the list header and every group tally
  // read the same numbers. The split between these two is the story's central rule: `gemeten` is what the figure is
  // over (doelsoort only), `getoond` is what the list renders (doelsoort plus the gaps-only view). Deriving the figure
  // from `getoond` would report 0% whenever a teacher asked to see their gaps.
  const gemeten = useMemo(
    () => (dekking.data ? gemetenDoelen(dekking.data.doelen, doelsoort) : []),
    [dekking.data, doelsoort],
  );

  const cijfer = useMemo(
    () => (dekking.data ? bepaalCijfer(dekking.data, gemeten) : null),
    [dekking.data, gemeten],
  );

  const groepen = useMemo(
    () =>
      dekking.data
        ? groepeerPerSubdomein(toonbareDoelen(dekking.data.doelen, { doelsoort, alleenOntbrekende }))
        : [],
    [dekking.data, doelsoort, alleenOntbrekende],
  );

  const doelsoortopties = useMemo(
    () => (dekking.data ? beschikbareDoelsoorten(dekking.data.doelen) : []),
    [dekking.data],
  );

  // THE GAP-ANALYSE'S COUNTS (E5-05), over `gemeten` and NOT over `groepen`. The distinction is the same one the
  // comment above draws for the figure, applied to a different pair: `gemeten` follows the doelsoort narrowing, which
  // changes what is being measured, and ignores the gaps-only toggle, which changes only what is shown. Counting over
  // `groepen` would leave these numbers identical in the one view and unexplainable in the other, since with the
  // toggle off the groups also hold every covered doel.
  const lacunetellingen = useMemo(() => telLacuneoorzaken(gemeten), [gemeten]);

  function kiesBereik(volgende: Dekkingsbereik) {
    const params = new URLSearchParams(searchParams);
    params.set(BEREIK_PARAM, volgende);
    // A narrowing belongs to the class's own scope, so switching to the whole curriculum drops it rather than leaving it
    // in the URL to reappear on the way back. The server ignores it in that scope anyway; carrying it would make the
    // link say something the answer does not.
    params.delete(JAARFASE_PARAM);
    setSearchParams(params, { replace: true });
  }

  function kiesJaarFase(volgende: string | null) {
    const params = new URLSearchParams(searchParams);

    if (volgende) {
      params.set(JAARFASE_PARAM, volgende);
    } else {
      params.delete(JAARFASE_PARAM);
    }

    setSearchParams(params, { replace: true });
  }

  // Deliberately NOT dropped when the scope changes, unlike the jaar/fase above. A jaar/fase narrowing is a subset of
  // the class's own codes and means nothing under the whole curriculum, so it has to go; a doelsoort exists in both
  // scopes and a teacher looking only at minimumdoelen wants to keep doing so while they widen the denominator.
  function kiesDoelsoort(volgende: Doelsoortkeuze) {
    const params = new URLSearchParams(searchParams);

    if (volgende) {
      params.set(DOELSOORT_PARAM, volgende);
    } else {
      params.delete(DOELSOORT_PARAM);
    }

    setSearchParams(params, { replace: true });
  }

  function kiesAlleenOntbrekende(volgende: boolean) {
    const params = new URLSearchParams(searchParams);

    if (volgende) {
      params.set(ONTBREKEND_PARAM, "1");
    } else {
      params.delete(ONTBREKEND_PARAM);
    }

    setSearchParams(params, { replace: true });
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink">{t("dekking.titel")}</h2>
          {/*
            Two lines of explanation, above the list and never repeated per row: what "gedekt" means, and what this
            overview is not. Both are load-bearing rather than decorative. The first is the definition every number here
            rests on, and it is not obvious: a thema being linked to a doel is not enough, the placement has to be one
            the teacher accepted (Art. V.1, so the AI cannot grant coverage). The second is the honesty an
            inspectie-facing screen owes about the level it does NOT yet report (Art. V.2, E5-04).
          */}
          <p className="mt-1 max-w-prose text-sm text-ink-zacht">{t("dekking.watGedekt")}</p>
          <p className="mt-1 max-w-prose text-sm text-ink-zacht">
            {t("dekking.alleenLeerplandoelen")}
          </p>
        </div>

        {/*
          The export (E5-06), a page-level action in the page-level position. Why it is here rather than beside the
          scope controls it inherits is argued on `Dekkingexport` itself: the short version is that the summary card's
          controls include the doelsoort filter the export deliberately ignores, and adjacency reads as relationship.

          Rendered only once there is an answer, not merely once a klas is chosen. The document would build for any
          real klas id, but while the read is pending or has failed this screen does not yet know the id names a class,
          and a link that hands a teacher an error page is a control that does not do what it says (the E3-06 rule).
        */}
        {klasId && dekking.data && (
          <Dekkingexport klasId={klasId} bereik={bereik} gekozenJaarFase={jaarFase} />
        )}
      </header>

      {/* Three states, not two: "no class chosen" is not an error and not an empty result. Getting this wrong is how
          the register used to tell every first-time visitor that no curriculum was imported. */}
      {!klasId && (
        <p className="rounded-lg border border-dashed border-border bg-card/70 px-5 py-8 text-center text-sm text-ink-zacht">
          {t("dekking.kiesKlas")}
        </p>
      )}

      {klasId && dekking.isError && (
        <p role="alert" className="rounded-lg border border-attentie bg-attentie-zacht px-5 py-4 text-sm text-attentie-ink">
          {t("dekking.fout")}
        </p>
      )}

      {/* `isPending` rather than `isLoading`: this fires for the first answer of each (klas, bereik) pair, which
          includes a scope switch, because the scope is part of the query key and no previous answer is kept. That is
          the deliberate choice rather than an oversight, and the reason is on `Bereikschakelaar`: keeping the old
          figures up would print a total computed over a different denominator while the pressed button named the new
          one. An earlier comment here described the opposite behaviour, which this app never had. */}
      {klasId && dekking.isPending && (
        <p role="status" className="px-5 py-8 text-center text-sm text-ink-zacht">
          {t("dekking.laden")}
        </p>
      )}

      {dekking.data && cijfer && (
        <>
          <Dekkingsamenvatting
            dekking={dekking.data}
            cijfer={cijfer}
            bereik={bereik}
            onKiesBereik={kiesBereik}
            gekozenJaarFase={jaarFase}
            onKiesJaarFase={kiesJaarFase}
            doelsoortopties={doelsoortopties}
            gekozenDoelsoort={doelsoort}
            onKiesDoelsoort={kiesDoelsoort}
          />

          {/*
            The list header, rendered whenever there is a scope to have a view over. Kept OUTSIDE the
            `groepen.length > 0` guard below on purpose: with "alleen ontbrekende" pressed and nothing missing, the
            groups are empty and the control that produced that state must still be on screen to press back. A toggle
            that disappears when it succeeds strands the teacher on an empty list.
          */}
          {cijfer.soort !== "nietMeetbaar" && cijfer.soort !== "geenVanDezeSoort" && (
            <Dekkingslijstkop
              alleenOntbrekende={alleenOntbrekende}
              onKies={kiesAlleenOntbrekende}
              aantalOntbrekend={cijfer.soort === "cijfer" ? cijfer.totaal - cijfer.gedekt : 0}
              magTellingTonen={cijfer.soort === "cijfer"}
            />
          )}

          {/*
            THE ROUTES OUT OF THE GAPS (E5-05), directly under the control that reveals them and above the rows they
            describe. This is the half that makes E5-05 more than a longer list: `/dekking` has shown WHICH doelen are
            missing since E5-03, and this says where each kind of gap is closed.

            **Gated on `cijfer.soort === "cijfer"`, which is the same gate the group tallies carry and for exactly the
            same reason.** These counts partition the gaps in view, so they add up to `totaal - gedekt` — the figure
            the directie ruling of 2026-07-28 withholds while a placement is unresolved. E5-02 shipped that leak once
            already: the summary said it would give no figure while every group printed one, and the group counts
            summed to the withheld total. Passing the gate rather than the counts keeps the decision in one place;
            `Lacuneroutes` documents why an absence beats a count-free variant.
          */}
          {cijfer.soort === "cijfer" && <Lacuneroutes tellingen={lacunetellingen} />}

          {/*
            Nothing to list under a pressed "Alleen ontbrekende", said in words: an empty area there is
            indistinguishable from a screen that failed to load.

            **Two sentences, not one, and the split is load-bearing** (antagonist round 1, MINOR-3). The first version
            required `soort === "cijfer"`, which left the withheld state showing the toggle with silence underneath —
            the exact state the comment claimed to prevent. The `cijfer` guard is nonetheless right and stays: *"Elk
            doel is gedekt"* asserts `gedekt === totaal`, which is the withheld total handed over in words. So the
            withheld case gets a line that claims no coverage at all.

            **The withheld sentence was rewritten in round 2, because the first attempt at it was false** (antagonist
            round 2, MAJOR). It read *"Hier staat niets zolang dit overzicht geen cijfer geeft. Los eerst de plaatsingen
            hierboven op, dan zie je welke doelen nog ontbreken."* Both halves were wrong, and the reason is that
            **`groepen` never consults `isBetrouwbaar`**: the gaps list renders its rows normally while the figure is
            withheld, so this branch fires only when there are genuinely zero gaps. So the list is not empty *because*
            the figure is withheld, and resolving a placement cannot reveal rows — it can only cover more doelen and
            shrink the set further.

            **Round 3 killed the replacement too, and the third attempt is the one that says nothing about coverage at
            all.** The rewrite read *"Er staan hier geen doelen. Zolang dit overzicht geen cijfer geeft, kan je daar niet
            uit besluiten dat alles gedekt is."* False in the opposite direction, and the proof is on the server:
            `DekkingService` builds its covering set from `!p.IsVervallen && TeltVoorDekking(p.Status)`, so a stale
            placement is **excluded** and staleness can only ever *suppress* coverage, never manufacture it. An empty
            gaps list therefore does mean every measured doel is covered, and resolving the outstanding placements can
            only accept (adds coverage) or reject (changes nothing). The inference was valid and stable, and the
            sentence told a teacher it was not. It was also the loudest possible pointer at the withheld proposition,
            since this branch fires only when `gedekt === totaal` and the sentence named that proposition out loud.

            **The lesson, after three attempts in one slot:** the bind only forbids saying anything *about coverage*. It
            never required saying something about coverage that is untrue. Twice I tried to explain the emptiness and
            twice the explanation was the defect; the sentence now states the fact and stops.

            A `catalogus.test.ts` guard pins that, because a `t(key)` assertion cannot: it moves with the catalogue.
          */}
          {alleenOntbrekende && groepen.length === 0 && cijfer.soort === "cijfer" && (
            <p className="rounded-lg border border-dashed border-border bg-card/70 px-5 py-8 text-center text-sm text-ink">
              {t("dekking.allesGedekt")}
            </p>
          )}

          {alleenOntbrekende && groepen.length === 0 && cijfer.soort === "ingehouden" && (
            <p className="rounded-lg border border-dashed border-border bg-card/70 px-5 py-8 text-center text-sm text-ink">
              {t("dekking.geenOntbrekendeInBeeld")}
            </p>
          )}

          {/* No paging, and that is a decision rather than an omission (recorded on DekkingController). The totals and
              the reliability verdict are properties of the WHOLE scope, so a page of rows could not carry them; and the
              default scope is one class's jaar/fase rather than the whole curriculum, which is what keeps the volume
              reasonable. The whole-curriculum switch is the expensive case and it is a deliberate, named action. */}
          {/* Suppressed when there is nothing to list, rather than rendered empty. With an empty scope the wrapper
              collapsed to a bare 1px rule floating under the summary, which reads as a rendering fault rather than as
              "no rows". Reported by the test-runner as cosmetic and left standing for a round; visible in every
              screenshot of that state, which is the argument for fixing cosmetics you can see. */}
          {groepen.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {groepen.map((groep, index) => (
                <Dekkinggroep
                  key={groep.sleutel}
                  groep={groep}
                  // A DOM-safe id, generated here rather than derived from the group key: the key is JSON and contains
                  // quotes and whitespace, which an `id` may not (see `groepeerPerSubdomein`). The index is stable within
                  // one render of one server answer, which is all an `aria-labelledby` reference needs.
                  kopId={`dekking-groep-${index}`}
                  // The same value the summary renders from, now passed rather than recomputed. It used to call
                  // `bepaalCijfer` a second time here, which was equal by construction while the function took one
                  // argument; with a filter in play the two calls would have had to be given the same narrowed list to
                  // stay equal, and that is a coincidence to rely on rather than a guarantee. Found in a browser once
                  // already: the summary said it would give no figure while every group printed one, and the group
                  // counts add up to exactly the total that was withheld.
                  magTellingTonen={cijfer.soort === "cijfer"}
                  // With "alleen ontbrekende" pressed a group's rows are only its gaps, so "0 van 3 gedekt" would be a
                  // count over a subset presented as a count over the group. The tally is suppressed rather than
                  // recomputed: the honest per-group number in that view is the one the group no longer shows.
                  toonAlleenOntbrekende={alleenOntbrekende}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The scope from the query string, defaulting to the class's own jaar/fase.
 *
 * An unrecognised value falls back to the default rather than being passed through: the API would answer 400 for it,
 * and a teacher who followed a stale link deserves the screen rather than an error. Validated against
 * {@link DEKKINGSBEREIKEN} so the check cannot drift from the type.
 */
function leesBereik(searchParams: URLSearchParams): Dekkingsbereik {
  const ruw = searchParams.get(BEREIK_PARAM);

  return DEKKINGSBEREIKEN.find((optie) => optie === ruw) ?? "EigenJaarFase";
}

/**
 * The doelsoort narrowing from the query string, or `null` when there is none or the value is not a doelsoort.
 *
 * Checked against `doelsoortBadgeSoort` rather than against a literal list, so the validation cannot drift from the
 * mapping that the label lookup uses. Anything else falls back to no narrowing, which keeps a teacher who followed a
 * stale link on a working screen instead of showing them a catalogue key (antagonist round 1, MINOR-2).
 *
 * **`Object.hasOwn`, not `in`, and the difference was a live defect** (antagonist round 2). `in` walks the prototype
 * chain, so `?doelsoort=Foo` was rejected while `toString`, `valueOf`, `constructor`, `hasOwnProperty` and `__proto__`
 * all passed. `doelsoortBadgeSoort["toString"]` is then a *function*, which the label lookup interpolates into a
 * template literal, so the screen read *"geen enkel doel van de soort doelsoort.function toString() { [native code] }"*
 * — the exact Art. II.3 breach the round-1 fix was written to close, in the exact same input class. The round-1 comment
 * also claimed these were "the exact keys for which a Dutch label exists", which was false for those five.
 */
function leesDoelsoort(searchParams: URLSearchParams): Doelsoortkeuze {
  const ruw = searchParams.get(DOELSOORT_PARAM);

  return ruw && Object.hasOwn(doelsoortBadgeSoort, ruw) ? (ruw as DoelsoortNaam) : null;
}
