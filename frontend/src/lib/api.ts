/**
 * Typed fetch client for the REST/JSON backend. Relative `/api/...` paths so Vite's dev proxy keeps
 * the browser same-origin (see vite.config.ts).
 *
 * `ApiError` carries the ProblemDetails the backend sends. Which of its fields a screen may SHOW a
 * teacher is a judgement the caller makes, not this file: the backend composes Dutch for messages a
 * teacher can act on and English for messages only an operator can (Art. II.3), and only the caller
 * knows which of the two it is about to render.
 */
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Sent on every request. The API refuses a state-changing request without it (ADR-0031 decision 5):
 * a form on another site cannot set a header, so this is what tells the API that the request came
 * from this app rather than from a page that borrowed the teacher's session cookie.
 */
export const CSRF_HEADER = "X-Jaarplanner-Csrf";

/** The page a person lands on when Entra knows them and the app does not let them in. */
export const GEEN_TOEGANG_PAD = "/geen-toegang";

/** The page a sign-in lands on when it did not complete. */
export const AANMELDEN_MISLUKT_PAD = "/aanmelden-mislukt";

/** The pages a 401 must never navigate away from: each would loop through Microsoft's silent sign-in. */
const ZONDER_OMLEIDING = new Set([GEEN_TOEGANG_PAD, AANMELDEN_MISLUKT_PAD]);

let omleidingBezig = false;

/**
 * What a 401 does: send the whole browser to the sign-in, which returns it here afterwards.
 *
 * A full navigation and not a fetch, because the sign-in is a redirect to Microsoft and back that
 * only a top-level page can follow. Once per page: several queries fail at the same moment on an
 * expired session, and each would otherwise start its own navigation.
 *
 * *Never from the refusal page or the failed-sign-in page.* Someone whose account the app refused
 * would otherwise be signed in again by Microsoft without a click, refused again, and sent back
 * here, in a loop.
 *
 * An object with a method rather than a bare function so a test can replace it: jsdom cannot
 * navigate.
 */
export const aanmeldOmleiding = {
  stuurDoor(): void {
    if (omleidingBezig || ZONDER_OMLEIDING.has(window.location.pathname)) return;
    omleidingBezig = true;
    const terug = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`${BASE_URL}/api/aanmelden?terugNaar=${encodeURIComponent(terug)}`);
  },
};

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  readonly title?: string;

  constructor(status: number, message: string, detail?: string, title?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.title = title;
  }
}

async function leesProbleem(response: Response): Promise<{ detail?: string; title?: string }> {
  let tekst: string;
  try {
    tekst = await response.text();
  } catch {
    return {};
  }
  if (tekst.trim().length === 0) return {};

  let ontleed: unknown;
  try {
    ontleed = JSON.parse(tekst);
  } catch {
    return {};
  }
  if (typeof ontleed !== "object" || ontleed === null) return {};

  const inhoud = ontleed as Record<string, unknown>;
  const veld = (w: unknown) => (typeof w === "string" && w.trim().length > 0 ? w : undefined);
  return { detail: veld(inhoud.detail), title: veld(inhoud.title) };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormulier = typeof FormData !== "undefined" && init?.body instanceof FormData;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    // The session is a cookie the API set (ADR-0031). Same-origin is fetch's default already; it is
    // written out because a cross-origin VITE_API_BASE_URL would silently drop it.
    credentials: "same-origin",
    headers: {
      ...(isFormulier ? {} : { "Content-Type": "application/json" }),
      [CSRF_HEADER]: "1",
      ...init?.headers,
    },
  });

  if (response.status === 401) aanmeldOmleiding.stuurDoor();

  if (!response.ok) {
    const { detail, title } = await leesProbleem(response);
    throw new ApiError(response.status, `Request to ${path} failed with ${response.status}`, detail, title);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const get = <T>(path: string) => apiFetch<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) });
export const del = <T>(path: string) => apiFetch<T>(path, { method: "DELETE" });

/** Builds a query string from the entries that carry a value. Returns "" rather than a bare "?". */
export function naarQuery(
  params: Record<string, string | number | boolean | readonly string[] | undefined | null>,
): string {
  const zoek = new URLSearchParams();
  for (const [sleutel, waarde] of Object.entries(params)) {
    if (waarde === undefined || waarde === null || waarde === "") continue;

    // An array becomes a REPEATED parameter (`?jaarFase=JK&jaarFase=K2`), which is what the backend's
    // multi-valued dimensions expect: `LeerplandoelFilter.JaarFasen` is a list because a class does not
    // always teach one jaar. Joining with a comma would send one value nobody parses.
    if (Array.isArray(waarde)) {
      for (const deel of waarde) {
        if (deel !== "") zoek.append(sleutel, deel);
      }
      continue;
    }

    zoek.set(sleutel, String(waarde));
  }
  const tekst = zoek.toString();
  return tekst.length > 0 ? `?${tekst}` : "";
}
