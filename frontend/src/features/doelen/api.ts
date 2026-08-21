import { apiFetch } from "../../lib/api";
import type { DoelDetail, DoelenFacetten, DoelenPagina, Doelenfilter } from "./types";

/**
 * The Doelen register's API calls (E1-16, FR-2.4). Thin wrappers over {@link apiFetch}; caching is TanStack
 * Query's job (see `useDoelen`).
 *
 * **Read-only.** Three GETs and nothing else: the curriculum is decreed reference data whose only sanctioned
 * writer is the Op.stap import (Art. III.1). There is no mutation to wrap, and the API refuses one.
 *
 * **Filtering and paging happen server-side.** Never fetch the register and narrow it here: after a full
 * import that is thousands of rows on every keystroke.
 */

/** The page size the register asks for. Matches the server's default; stated here so the UI can page. */
export const PAGINA_GROOTTE = 50;

/**
 * Turns the active filter into a query string, dropping empty values so the URL stays readable.
 *
 * A `subdomein` is only sent together with its `domein`. That is not politeness: subdomein names are not
 * globally unique (Art. VII.0), and the API now **refuses** a bare one with a 400 rather than silently summing
 * unrelated domeinen, so sending it alone would turn a stale link into an error instead of a wide result.
 */
function filterNaarQuery(filter: Doelenfilter): URLSearchParams {
  const params = new URLSearchParams();

  // **Literals here on purpose, even for the two keys `app/routes.ts` now names** (E5-03, antagonist round 7). These
  // are the SERVER's query parameters, not the browser's. `doelenfilter.ts` imports `DOELSOORT_PARAM` /
  // `JAARFASE_PARAM` because the URL is a contract it shares with `/dekking`; importing them here would fuse the two,
  // and a purely cosmetic front-end rename would then silently change the HTTP query the backend parses. It would
  // surface as an empty result list rather than as a compile error. The names are identical today by choice (see this
  // module's header), and that choice is only safe while the two are free to diverge. Do not "fix" this.
  if (filter.zoek) params.set("zoek", filter.zoek);
  if (filter.discipline) params.set("discipline", filter.discipline);
  if (filter.domein) params.set("domein", filter.domein);
  if (filter.domein && filter.subdomein) params.set("subdomein", filter.subdomein);
  if (filter.doelsoort) params.set("doelsoort", filter.doelsoort);
  // Repeatable, because the endpoint matches it as "any of" and a class can teach more than one code (E9-07).
  // `append` per entry rather than one comma-joined value: the server binds a repeated parameter into an array, and a
  // joined string would arrive as one nonsense code and match nothing.
  if (typeof filter.jaarFase === "string") {
    if (filter.jaarFase) params.set("jaarFase", filter.jaarFase);
  } else if (filter.jaarFase) {
    // A blank entry is dropped rather than sent. The server treats an all-blank list as "no filter" anyway, but sending
    // one would make the request say something the caller did not mean.
    for (const fase of filter.jaarFase.filter((f) => f.trim().length > 0)) {
      params.append("jaarFase", fase);
    }
  }

  return params;
}

/** One page of leerplandoelen matching the filter, with the total the filter matches. */
export function haalDoelen(filter: Doelenfilter, overslaan: number): Promise<DoelenPagina> {
  const params = filterNaarQuery(filter);
  params.set("aantal", String(PAGINA_GROOTTE));
  if (overslaan > 0) params.set("overslaan", String(overslaan));

  return apiFetch<DoelenPagina>(`/api/leerplandoelen?${params.toString()}`);
}

/**
 * The filter vocabulary plus the unfiltered total.
 *
 * The filter is sent along because it scopes the **counts**: each option reports what picking it would yield
 * under the rest of the filter, so a select can no longer offer "Natuur (3)" while delivering nothing. The
 * option sets themselves stay stable, so nothing disappears mid-use, and `totaalAantalDoelen` stays unfiltered
 * because it is what tells "nothing imported" apart from "filtered to nothing".
 */
export function haalDoelenFacetten(filter: Doelenfilter): Promise<DoelenFacetten> {
  const params = filterNaarQuery(filter);

  // `params.toString()`, never `params.size`: `size` is Chrome 113 / Safari 17 / Firefox 112, and where it is
  // undefined `undefined > 0` is false, so the facets would be fetched UNFILTERED and every count would go back
  // to describing the whole curriculum. That is the "Natuur (3) that delivers nothing" defect this function
  // exists to prevent, reintroduced silently on an older browser: no test can see it (Node has `size`) and
  // `tsc` accepts it, so it would surface only as a teacher's complaint. This repo documents no browser
  // baseline (E7-07), so the version-floor-free form is the only safe one.
  const query = params.toString();

  return apiFetch<DoelenFacetten>(
    query.length > 0 ? `/api/leerplandoelen/facetten?${query}` : "/api/leerplandoelen/facetten",
  );
}

/**
 * One leerplandoel in full. A code no leerplandoel carries is a 404, which surfaces as an `ApiError` the
 * detail pane turns into its own Dutch "this doel does not exist" copy rather than an empty pane.
 *
 * The code is percent-encoded: Op.stap codes are alphanumeric with hyphens today, but the doelsoort
 * shorthand already contains a `+`, and a raw `+` in a path segment is not something to rely on.
 */
export function haalDoelDetail(code: string): Promise<DoelDetail> {
  return apiFetch<DoelDetail>(`/api/leerplandoelen/${encodeURIComponent(code)}`);
}
