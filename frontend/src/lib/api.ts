/**
 * Minimal typed fetch client for the REST/JSON API (ADR-0014 — TanStack Query owns caching;
 * this is just the transport). The base URL is empty by default so requests are relative
 * (`/api/...`) and the dev server proxy / same-origin deployment resolves them; override with
 * `VITE_API_BASE_URL` for a split origin. No secrets ever live here — AI keys stay server-side
 * (Art. VI.4).
 */
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

/** An HTTP error carrying the status code so callers/UI can branch without parsing messages. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch JSON from the API. Throws {@link ApiError} on a non-2xx response (with the status code)
 * so the UI maps to its own Dutch copy — it never echoes a raw backend message to the teacher.
 * Returns `undefined` for 204 No Content.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `Request to ${path} failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
