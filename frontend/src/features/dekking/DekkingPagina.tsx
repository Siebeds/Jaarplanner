import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { useSelectie } from "../../app/useSelectie";
import { t } from "../../i18n";
import { Dekkinggroep } from "./Dekkinggroep";
import { Dekkingsamenvatting } from "./Dekkingsamenvatting";
import { groepeerPerSubdomein } from "./dekkingFormat";
import { useDekking } from "./useDekking";
import { DEKKINGSBEREIKEN, type Dekkingsbereik } from "./types";

/** The scope's query-string parameter, so a shared link opens the same denominator (ADR-0021). */
export const BEREIK_PARAM = "bereik";

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
 *   inspectie-proof would otherwise draw a conclusion the data does not support;
 * - **no export** (E5-06).
 */
export function DekkingPagina() {
  const { klasId } = useSelectie();
  const [searchParams, setSearchParams] = useSearchParams();

  const bereik = leesBereik(searchParams);
  const dekking = useDekking(klasId, bereik);

  const groepen = useMemo(
    () => (dekking.data ? groepeerPerSubdomein(dekking.data.doelen) : []),
    [dekking.data],
  );

  function kiesBereik(volgende: Dekkingsbereik) {
    const params = new URLSearchParams(searchParams);
    params.set(BEREIK_PARAM, volgende);
    setSearchParams(params, { replace: true });
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
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

      {/* `isPending` rather than `isLoading`, and only when there is no previous answer to keep on screen: a scope
          switch keeps the old figures visible with the schakelaar saying so, which is why `bezig` is passed down. */}
      {klasId && dekking.isPending && (
        <p role="status" className="px-5 py-8 text-center text-sm text-ink-zacht">
          {t("dekking.laden")}
        </p>
      )}

      {dekking.data && (
        <>
          <Dekkingsamenvatting
            dekking={dekking.data}
            bereik={bereik}
            onKiesBereik={kiesBereik}
            bezig={dekking.isFetching}
          />

          {/* No paging, and that is a decision rather than an omission (recorded on DekkingController). The totals and
              the reliability verdict are properties of the WHOLE scope, so a page of rows could not carry them; and the
              default scope is one class's jaar/fase rather than the whole curriculum, which is what keeps the volume
              reasonable. The whole-curriculum switch is the expensive case and it is a deliberate, named action. */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {groepen.map((groep) => (
              <Dekkinggroep key={groep.sleutel} groep={groep} />
            ))}
          </div>
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
