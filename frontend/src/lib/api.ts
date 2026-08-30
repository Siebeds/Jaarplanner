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
    headers: {
      ...(isFormulier ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

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
