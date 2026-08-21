/**
 * Minimal typed fetch client for the shared REST/JSON backend — the same transport contract as
 * `frontend/src/lib/api.ts`, kept deliberately small since this app talks to the same API.
 * Relative `/api/...` paths so Vite's dev proxy (see vite.config.ts) keeps the browser same-origin.
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

async function leesFoutinhoud(response: Response): Promise<{ detail?: string; title?: string }> {
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
    const { detail, title } = await leesFoutinhoud(response);
    throw new ApiError(response.status, `Request to ${path} failed with ${response.status}`, detail, title);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const get = <T>(path: string) => apiFetch<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) });
export const del = <T>(path: string) => apiFetch<T>(path, { method: "DELETE" });
