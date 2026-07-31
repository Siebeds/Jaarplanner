import { useMemo } from "react";
import { Outlet, useMatch, useNavigate, useSearchParams } from "react-router-dom";

import { t } from "../../i18n";
import { Doelenfilters } from "./Doelenfilters";
import { Doelenlijst } from "./Doelenlijst";
import { leesFilter, schrijfFilter } from "./doelenfilter";
import { useDoelenFacetten } from "./useDoelen";
import type { Doelenfilter } from "./types";

/** The nested route the detail pane renders at, and the pattern the list matches its selection against. */
export const DOEL_DETAIL_PAD = ":code";

/**
 * The Doelen screen (E1-16, FR-2.4): the teacher-facing register of the imported Op.stap curriculum.
 *
 * **Two panes, and the selection lives in the URL.** The list is on the left, one doel on the right at
 * `/doelen/:code` as a nested route, so a doel is deep-linkable and the browser Back button works
 * (ADR-0021). At ~390px the list *is* the page and the detail replaces it, rather than being squeezed into a
 * column that fits neither.
 *
 * **Filters live in the query string** for the same reason: a filtered register is shareable and survives a
 * reload. They are written with `replace` so that filtering does not fill the history with near-identical
 * entries and Back still leaves the screen.
 *
 * **Read-only is stated once, above the list, and never per row** (Art. III.1, clause 4). One line, not a
 * paragraph: prose is the first thing to cut on a screen a teacher scans.
 */
export function DoelenPagina() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filter = useMemo(() => leesFilter(searchParams), [searchParams]);

  // `useMatch` rather than `useParams`, because the parameter belongs to the child route: this asks the
  // question directly instead of relying on what a parent does or does not see of its child's match.
  const gekozenCode = useMatch("/doelen/:code")?.params.code;
  const facetten = useDoelenFacetten();

  function wijzigFilter(volgende: Doelenfilter) {
    const params = schrijfFilter(searchParams, volgende);

    // Changing a filter keeps the chosen doel open on purpose: a teacher narrowing the list is usually still
    // reading the doel they opened, and closing it under them would be the screen taking a decision.
    setSearchParams(params, { replace: true });

    if (gekozenCode) {
      navigate(
        { pathname: `/doelen/${encodeURIComponent(gekozenCode)}`, search: params.toString() },
        { replace: true },
      );
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-bold text-ink">{t("doelen.titel")}</h2>
        <p className="mt-1 text-sm text-ink-zacht">{t("doelen.leesAlleen")}</p>
      </header>

      {facetten.isError ? (
        <p
          role="alert"
          className="rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
        >
          {t("doelen.fout")}
        </p>
      ) : null}

      {facetten.data ? (
        <Doelenfilters filter={filter} facetten={facetten.data} onWijzig={wijzigFilter} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
        {/* At ~390px the detail replaces the list rather than sitting under it: two stacked panes on a phone
            means scrolling past the whole register to read the doel you just opened. */}
        <div className={gekozenCode ? "hidden lg:block" : ""}>
          <Doelenlijst
            filter={filter}
            heeftCurriculum={(facetten.data?.totaalAantalDoelen ?? 0) > 0}
            gekozenCode={gekozenCode}
            onWisFilters={() => wijzigFilter({})}
          />
        </div>

        <div className={[gekozenCode ? "" : "hidden lg:block", "lg:sticky lg:top-40"].join(" ")}>
          {gekozenCode ? (
            <Outlet />
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-card/70 px-5 py-8 text-center text-sm text-ink-zacht">
              {t("doelen.kiesDoel")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
