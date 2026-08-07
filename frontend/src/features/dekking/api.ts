import { apiFetch, apiUrl } from "../../lib/api";
import type { Dekking, Dekkingsbereik } from "./types";

/**
 * The dekkingsoverzicht's API surface (E5-02, E5-06, FR-9.1, FR-9.5). Read-only by construction: dekking is
 * computed, never stored (Art. V.1), so this feature has nothing to write.
 */

/**
 * One class's coverage, measured against `bereik`.
 *
 * **The scope is always passed explicitly, never left to the endpoint's default.** The endpoint does default to
 * `EigenJaarFase`, and relying on that is how the generation parameter form ended up correct by coincidence
 * (E3-08's note on `haalRooster`). It matters more here than there: the scope is part of what the answer *means*,
 * because the same class has two legitimate denominators, so a request that does not state it produces a figure the
 * screen cannot label.
 */
export function haalDekking(
  klasId: string,
  bereik: Dekkingsbereik,
  jaarFase: string | null,
): Promise<Dekking> {
  // The query is built by `scopeQuery` rather than inline, so this read and the export below cannot come to disagree
  // about what "the same scope" means. It used to be inline here, which was fine while there was one caller.
  return apiFetch<Dekking>(`/api/klassen/${klasId}/dekking${scopeQuery(bereik, jaarFase)}`);
}

/**
 * The absolute URL of the coverage export (E5-06, FR-9.5, FR-11.2): the same coverage as an `.xlsx`.
 *
 * **A URL rather than a fetch, deliberately, and for the same reason the import sjabloon is a plain `<a href
 * download>`:** a download is a navigation. Handing the URL to the browser keeps its own progress, its own
 * cancel, "link opslaan als" and middle-click, all of which a fetch-into-a-blob detour would have to
 * re-implement badly. The server names the file (`Content-Disposition`), so nothing here has to.
 *
 * **It takes the same scope arguments as {@link haalDekking} and builds the query through the same helper**, which
 * is the point of it living here rather than in the component. `bereik` and `jaarFase` decide what the figures in
 * the document *mean*, so a document built over a different scope from the screen that offered it would be
 * evidence of nothing. One helper is what makes them impossible to drift.
 *
 * **What it deliberately does NOT take is the doelsoort filter or the gaps-only toggle** (owner ruling
 * 2026-08-06: the export is always the full set in scope). There is no parameter for them on the endpoint
 * either, so this is not a matter of this function choosing to omit them.
 */
export function dekkingExportUrl(
  klasId: string,
  bereik: Dekkingsbereik,
  jaarFase: string | null,
): string {
  return apiUrl(`/api/klassen/${klasId}/dekking/export${scopeQuery(bereik, jaarFase)}`);
}

/**
 * The scope query both routes take: the bereik always, the jaar/fase narrowing only when there is one.
 *
 * `jaarFase` is omitted rather than sent empty when nothing is chosen, so the request says "no narrowing" instead
 * of "narrow to the empty string". The server ignores a code this class does not have and reports what it applied,
 * so a stale link degrades to the full scope on a working screen rather than to an error.
 */
function scopeQuery(bereik: Dekkingsbereik, jaarFase: string | null): string {
  const smaller = jaarFase ? `&jaarFase=${encodeURIComponent(jaarFase)}` : "";

  return `?bereik=${encodeURIComponent(bereik)}${smaller}`;
}
