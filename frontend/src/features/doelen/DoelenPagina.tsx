import { useMemo } from "react";
import { Outlet, useMatch, useNavigate, useSearchParams } from "react-router-dom";

import { t } from "../../i18n";
import { Doelenfilters } from "./Doelenfilters";
import { Doelenlijst, type Curriculumstaat } from "./Doelenlijst";
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
  const facetten = useDoelenFacetten(filter);

  /**
   * Whether the school has any curriculum loaded, as a **three-valued** answer.
   *
   * Derived from the query's status rather than from `(totaal ?? 0) > 0`, because that expression cannot tell
   * "we have not asked yet" from "the answer is zero". It read `false` while the request was in flight and
   * `false` forever after a failure, so every cold visit to `/doelen` first painted "Er zijn nog geen doelen van
   * Op.stap ingeladen ... vraag het aan wie de tool beheert", and a facets error showed that permanently next
   * to the error alert (antagonist finding 1). Both are false statements about the school's data, and the
   * second sends a teacher to the beheerder over a request that merely failed.
   */
  const curriculum: Curriculumstaat = facetten.data
    ? facetten.data.totaalAantalDoelen > 0
      ? "gevuld"
      : "leeg"
    : "onbekend";

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

      {/*
        Hidden at phone width while a doel is open, because there the detail REPLACES the list: the filters
        would be controls acting on something the teacher cannot see, and they pushed ~330px of chrome above
        the doel being read. From `lg` up the list sits beside the detail, so they stay. Found by opening the
        app at 390px, not by a test.
      */}
      {facetten.data ? (
        <div className={gekozenCode ? "hidden lg:block" : ""}>
          <Doelenfilters filter={filter} facetten={facetten.data} onWijzig={wijzigFilter} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start">
        {/* At ~390px the detail replaces the list rather than sitting under it: two stacked panes on a phone
            means scrolling past the whole register to read the doel you just opened. */}
        <div className={gekozenCode ? "hidden lg:block" : ""}>
          <Doelenlijst
            filter={filter}
            curriculum={curriculum}
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
