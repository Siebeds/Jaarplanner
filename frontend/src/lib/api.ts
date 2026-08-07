/**
 * Minimal typed fetch client for the REST/JSON API (ADR-0014 — TanStack Query owns caching;
 * this is just the transport). The base URL is empty by default so requests are relative
 * (`/api/...`) and the dev server proxy / same-origin deployment resolves them; override with
 * `VITE_API_BASE_URL` for a split origin. No secrets ever live here — AI keys stay server-side
 * (Art. VI.4).
 */
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * The absolute URL of an API path, for the cases that must **not** go through {@link apiFetch}.
 *
 * There are two: the import template download (`GET …/sjabloon`) and the coverage export
 * (`GET …/dekking/export`, E5-06). Both answer a binary `.xlsx` with a `Content-Disposition` filename, and both
 * belong in a plain `<a href download>` — the browser then streams it straight to disk with the server's own
 * filename, shows its own progress, and needs no JavaScript at all. Fetching one into a blob and synthesising a
 * click would replace all of that with code, and would put a memory copy of the file in the tab for no gain.
 *
 * *This paragraph said "exactly one today" until E5-06 made it two.* A count of call sites in a comment is a claim
 * with a shelf life, so the next story to add a download should expect to edit this sentence rather than leave it
 * quietly wrong.
 *
 * It exists so a caller building such a link does not re-read `VITE_API_BASE_URL` itself, which is how a
 * split-origin deployment ends up with one link pointing at the wrong host.
 */
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/**
 * An HTTP error carrying the status code so callers/UI can branch without parsing messages.
 *
 * It also carries the response body's `detail`/`title` when there were any. Those two fields are **not** a
 * licence to render whatever arrives: see {@link apiFetch} for the rule that governs when a caller may put
 * one on screen.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /**
     * The body's `detail`, when it carried one. `undefined` for an empty body, a non-JSON body, or a JSON
     * body that is not an object with a non-blank string `detail` — so a caller never has to guard the
     * shape itself.
     */
    public readonly detail?: string,
    /** The body's `title`, under the same conditions as {@link detail}. */
    public readonly title?: string,
    /**
     * The body's RFC 7807 `type`: **which** fault of this status code it is, machine-readably.
     *
     * Present on every response written through `IProblemDetailsService`, which fills it in from the status
     * code when the server set nothing — so a `type` is not evidence that the server discriminated anything.
     * Compare it against a known URI (see `features/import/api.ts` → `OPSTAP_WEIGERINGSOORT`) and treat
     * "no match" as "we could not tell", never as a default case.
     */
    public readonly type?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Pulls `detail`/`title`/`type` off an error response, tolerating every envelope this API actually produces.
 *
 * There are three, and a parser that assumes one trips over the others:
 * 1. **RFC 7807 through `IProblemDetailsService`** — the four exception handlers, E1-15's
 *    curriculum-integrity refusals among them. They add `type` and `traceId` beside `detail`/`status`/`title`.
 * 2. **A controller's own `ProblemDetails`** — `{detail, status, title}` and nothing else. Additive versus
 *    (1) and RFC-valid, so both are correct and both occur on the *same* endpoint (`api/opstap-import`
 *    answers (2) for its request validations and (1) for its integrity refusals).
 * 3. **No ProblemDetails at all**, and this one is not hypothetical: a 502/504 from a proxy or a dev-server
 *    is an **HTML page**, a dropped connection is an **empty body**, and a body can be valid JSON that is not
 *    an object (a quoted string, `null`). Nothing in the transport can promise otherwise, whatever any given
 *    endpoint's contract says.
 *    > *An earlier version of this list cited `GET /api/leerplandoelen` answering a bare English string as the
 *    > worked example. That was true when E1-13 branched and **E1-16's fix round 2 changed it** to a real
 *    > `ProblemDetails`; the claim then went stale through a **merge**, not through an edit, which is the case
 *    > nobody re-reads. Worth generalising: a comment about another endpoint's behaviour is exactly what to
 *    > re-check when main is pulled into a branch.*
 *
 * Every step is therefore guarded and the failure mode is always "we learned nothing", never a throw: an
 * error path that can itself throw turns a 409 the UI knows how to explain into an unhandled rejection.
 */
async function leesFoutinhoud(
  response: Response,
): Promise<{ detail?: string; title?: string; type?: string }> {
  let tekst: string;
  try {
    tekst = await response.text();
  } catch {
    // The connection dropped mid-body. The status is still worth reporting.
    return {};
  }

  if (tekst.trim().length === 0) {
    return {};
  }

  let ontleed: unknown;
  try {
    ontleed = JSON.parse(tekst);
  } catch {
    // Envelope (3): not JSON at all. Deliberately NOT surfaced as `detail` — what arrives this way is an
    // English operator diagnostic or an HTML error page, and neither belongs on a teacher's screen.
    return {};
  }

  if (typeof ontleed !== "object" || ontleed === null) {
    // Valid JSON that is not an object: a quoted bare string, a number, `null`. Same reasoning as above.
    return {};
  }

  const inhoud = ontleed as Record<string, unknown>;
  const tekstveld = (waarde: unknown) =>
    typeof waarde === "string" && waarde.trim().length > 0 ? waarde : undefined;

  return {
    detail: tekstveld(inhoud.detail),
    title: tekstveld(inhoud.title),
    type: tekstveld(inhoud.type),
  };
}

/**
 * Fetch JSON from the API. Throws {@link ApiError} on a non-2xx response (with the status code, and with
 * the body's `detail`/`title` when it had them). Returns `undefined` for a 204 No Content.
 *
 * **The rule about backend messages, restated because it changed (Art. II.3, amended 2026-07-30).** This
 * comment used to claim the client *"never echoes a raw backend message to the teacher"*, and that is no
 * longer the rule the project holds — leaving it in place would be a comment asserting an invariant the code
 * does not hold, which this repo has already collected three audit findings about. The language of a message
 * now follows **who it is for**: a message a teacher or directie can act on is Dutch and may be generated
 * server-side; a message only a developer or operator can act on stays English. So:
 * - **A caller may render `detail`** where the endpoint's contract says that string is Dutch and actionable
 *   by whoever is reading it. `POST /api/opstap-import`'s refusals are the worked example: only the server
 *   knows which concordance keys are missing or which code already sits under another discipline, so
 *   `nl.json` cannot compose that sentence. The caller still owns the framing around it.
 * - **A caller must not render `detail`** where it is an operator diagnostic. The jaarplan and matching 422s
 *   carry an English parser message; those branch on the status and render their own Dutch copy.
 * - **A caller must never rely on `detail` being present**, whatever the endpoint promises. Envelope (3)
 *   above exists and a proxy can replace any body, so every render site needs an `nl.json` fallback.
 *
 * **`Content-Type` is set only for a non-`FormData` body.** A multipart upload must be left to the browser,
 * which appends the `boundary=` token it generated; hard-setting `application/json` — or even a bare
 * `multipart/form-data` — leaves the server unable to find the parts, and the request then fails as "no file
 * was sent" rather than as the header problem it is.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormulier = typeof FormData !== "undefined" && init?.body instanceof FormData;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormulier ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const { detail, title, type } = await leesFoutinhoud(response);

    throw new ApiError(
      response.status,
      `Request to ${path} failed with ${response.status}`,
      detail,
      title,
      type,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
