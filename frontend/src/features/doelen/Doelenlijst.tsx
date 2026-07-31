import { t, tAantal } from "../../i18n";
import { Doelregel } from "./Doelregel";
import { actieveDimensies } from "./doelenfilter";
import { PAGINA_GROOTTE, useDoelen } from "./useDoelen";
import type { Doelenfilter } from "./types";

/**
 * Whether the database holds any leerplandoel at all, which is a **three-valued** question and not a boolean.
 *
 * It is derived from the facets query's status, because "we have not asked yet" and "we asked and the answer is
 * zero" are different facts and a boolean cannot hold both. Collapsing them is what made the register claim, on
 * every cold visit and permanently after a facets error, that the curriculum had never been imported
 * (antagonist finding 1).
 */
export type Curriculumstaat = "onbekend" | "leeg" | "gevuld";

/**
 * The register itself (E1-16 clause 1): a dense, server-paged list of leerplandoelen.
 *
 * **Volume is a server concern.** Rows arrive 50 at a time and "meer laden" fetches the *next* 50; nothing
 * here filters or sorts a local copy of the curriculum.
 *
 * **Four states, and collapsing any two of them is a defect.** The story's brief named three; the audit found
 * the fourth by observing that the first was being shown *before the question had been asked*:
 *
 * 0. *We do not know yet* (`curriculum === "onbekend"`, i.e. the facets query is pending or failed). Shows the
 *    loading line, or the error alert. This state used to render as "nothing is imported", so a teacher opening
 *    `/doelen` was told for a moment that the school had never loaded Op.stap, and told it permanently if the
 *    facets request failed. That is the worst of the four to get wrong: it sends someone to the beheerder over
 *    a request that simply had not come back.
 * 1. *No curriculum imported at all* (`"leeg"`). Only on a **resolved** total of zero. It is
 *    **beheerderswerk**, so the message says so plainly, and it deliberately links to no control: the Op.stap
 *    import trigger is **E1-15** and is not built, and a button that goes nowhere teaches a review the wrong
 *    thing (E3-06).
 * 2. *The filters exclude everything.* A different sentence, and it offers "wis alle filters", which is the
 *    action that actually helps. Telling this teacher that nothing is imported would send them to the
 *    beheerder over a filter they set themselves.
 * 3. *An unknown code in the URL* lives on the detail pane, not here.
 */
export function Doelenlijst({
  filter,
  curriculum,
  gekozenCode,
  onWisFilters,
}: {
  filter: Doelenfilter;
  /**
   * Whether the database holds any leerplandoel at all, as far as we currently know. Three-valued on purpose:
   * see {@link Curriculumstaat}.
   */
  curriculum: Curriculumstaat;
  gekozenCode: string | undefined;
  onWisFilters: () => void;
}) {
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useDoelen(filter);

  // The list's OWN query decides loading and failure. It is asked first, and deliberately not gated on the
  // facets: if the facets fail while the page of rows arrives, the honest thing is to show the rows.
  if (isPending) {
    return (
      <p role="status" className="px-1 py-6 text-sm text-ink-zacht">
        {t("doelen.laden")}
      </p>
    );
  }

  if (isError) {
    return (
      <p
        role="alert"
        className="rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
      >
        {t("doelen.fout")}
      </p>
    );
  }

  const regels = data?.pages.flatMap((pagina) => pagina.regels) ?? [];
  const totaal = data?.pages[0]?.totaal ?? 0;

  if (totaal === 0) {
    // "Nothing is imported" requires a RESOLVED zero from the facets. While that answer is unknown (pending, or
    // the request failed) the register does not know which of the two empty states it is in, and it says the
    // neutral one: claiming the school never loaded Op.stap on the strength of a request that had not come back
    // is the defect this ordering exists to prevent (antagonist finding 1).
    if (curriculum === "leeg") {
      return (
        <Leegstaat titel={t("doelen.geenCurriculumTitel")} uitleg={t("doelen.geenCurriculumUitleg")} />
      );
    }

    return (
      <Leegstaat
        titel={t("doelen.geenResultaatTitel")}
        uitleg={t("doelen.geenResultaatUitleg")}
        actie={
          actieveDimensies(filter).length > 0 ? (
            <button
              type="button"
              onClick={onWisFilters}
              className="mt-4 rounded-md bg-petrol px-4 py-2 text-sm font-semibold text-petrol-foreground transition-colors duration-150 ease-uit hover:bg-petrol-helder"
            >
              {t("doelen.wisAlles")}
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div>
      {/* The count sits once above the list and never per row (`tAantal`, because Dutch inflects both the
          noun and the verb and "1 doelen" has shipped in this repo four times). */}
      <p className="px-1 pb-2 text-sm font-medium text-ink-zacht" data-cijfers>
        {tAantal(totaal, "doelen.aantalGetoondEnkelvoud", "doelen.aantalGetoond", {
          geladen: regels.length,
        })}
      </p>

      <ul
        aria-label={t("doelen.lijstLabel")}
        className="overflow-hidden rounded-lg border border-border bg-card shadow-card"
      >
        {regels.map((doel) => (
          <Doelregel key={doel.code} doel={doel} isGekozen={doel.code === gekozenCode} />
        ))}
      </ul>

      {hasNextPage ? (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-3 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-petrol transition-colors duration-150 ease-uit hover:bg-petrol-wash disabled:text-ink-zacht"
        >
          {isFetchingNextPage
            ? t("doelen.meerLadenBezig")
            : // Through `tAantal`, like every other count. It was not, and any filter whose total satisfies
              // `totaal % 50 == 1` therefore ended on "Volgende 1 doelen laden" (test-runner FAIL, and the
              // FIFTH time this exact bug has shipped in this repo). `nlAantalKeys` in the test suite now
              // fails on any future `{aantal}` string that has no singular sibling, so the class is closed
              // rather than this one instance.
              tAantal(
                Math.min(PAGINA_GROOTTE, totaal - regels.length),
                "doelen.meerLadenEnkelvoud",
                "doelen.meerLaden",
              )}
        </button>
      ) : null}
    </div>
  );
}

/** One shared shape for the empty states, so they look alike while saying different things. */
function Leegstaat({
  titel,
  uitleg,
  actie,
}: {
  titel: string;
  uitleg: string;
  actie?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-dashed border-border bg-card/70 px-6 py-10 text-center">
      <h3 className="text-base font-bold text-ink">{titel}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-zacht">{uitleg}</p>
      {actie}
    </section>
  );
}
