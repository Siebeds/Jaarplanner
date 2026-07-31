import { t, tAantal } from "../../i18n";
import { Doelregel } from "./Doelregel";
import { actieveDimensies } from "./doelenfilter";
import { PAGINA_GROOTTE, useDoelen } from "./useDoelen";
import type { Doelenfilter } from "./types";

/**
 * The register itself (E1-16 clause 1): a dense, server-paged list of leerplandoelen.
 *
 * **Volume is a server concern.** Rows arrive 50 at a time and "meer laden" fetches the *next* 50; nothing
 * here filters or sorts a local copy of the curriculum.
 *
 * **Three empty states, and collapsing any two of them is a defect.** This is the E1-07 audit finding one
 * layer up, so it is stated here rather than left to the reader:
 *
 * 1. *No curriculum imported at all* (`heeftCurriculum === false`). The likely state today, and it is
 *    **beheerderswerk**, so the message says so plainly. It deliberately links to no control: the Op.stap
 *    import trigger is **E1-15** and is not built, and a button that goes nowhere teaches a review the wrong
 *    thing (E3-06).
 * 2. *The filters exclude everything.* A different sentence, and it offers "wis alle filters", which is the
 *    action that actually helps. Telling this teacher that nothing is imported would send them to the
 *    beheerder over a filter they set themselves.
 * 3. *An unknown code in the URL* is the third, and it lives on the detail pane, not here.
 */
export function Doelenlijst({
  filter,
  heeftCurriculum,
  gekozenCode,
  onWisFilters,
}: {
  filter: Doelenfilter;
  /** Whether the database holds any leerplandoel at all, from the facets' unfiltered total. */
  heeftCurriculum: boolean;
  gekozenCode: string | undefined;
  onWisFilters: () => void;
}) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useDoelen(filter);

  if (!heeftCurriculum) {
    return (
      <Leegstaat titel={t("doelen.geenCurriculumTitel")} uitleg={t("doelen.geenCurriculumUitleg")} />
    );
  }

  if (isLoading) {
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
            : t("doelen.meerLaden", { aantal: Math.min(PAGINA_GROOTTE, totaal - regels.length) })}
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
