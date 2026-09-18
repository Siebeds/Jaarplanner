import { afterEach, describe, expect, it, vi } from "vitest";
import { aanmeldOmleiding, apiFetch, ApiError, CSRF_HEADER } from "./api";

/**
 * What every request carries for the session (ADR-0031), and what a 401 does. `stuurDoor` itself is
 * replaced in each test: jsdom cannot navigate, and the point here is only that a 401 asks for it
 * and nothing else does.
 */
describe("apiFetch en de sessie", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stuurt de antivervalsingsheader en de sessiecookie mee", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/klassen", { method: "POST", body: "{}" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)[CSRF_HEADER]).toBe("1");
    expect(init.credentials).toBe("same-origin");
  });

  it("stuurt de header ook mee bij een upload", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/opstap-import", { method: "POST", body: new FormData() });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers[CSRF_HEADER]).toBe("1");
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("stuurt de browser naar de aanmelding bij een 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    const omleiding = vi.spyOn(aanmeldOmleiding, "stuurDoor").mockImplementation(() => {});

    await expect(apiFetch("/api/ik")).rejects.toBeInstanceOf(ApiError);

    expect(omleiding).toHaveBeenCalledTimes(1);
  });

  /*
    The decision itself, not only that a 401 asks for it. A fresh copy of the module per test, because the
    once-per-page flag lives in module state and a test that navigated would leave it set for the next one.
  */
  it.each(["/geen-toegang", "/aanmelden-mislukt", "/afgemeld"])("stuurt nooit door vanaf %s, waar dat een lus of een nieuwe aanmelding zou geven", async (pad) => {
    vi.resetModules();
    const { aanmeldOmleiding: omleiding } = await import("./api");
    const navigeer = vi.spyOn(omleiding, "navigeer").mockImplementation(() => {});
    window.history.pushState({}, "", pad);

    omleiding.stuurDoor();

    expect(navigeer).not.toHaveBeenCalled();
  });

  it("stuurt elders door naar de aanmelding, met de huidige plaats als terugkeeradres, en maar een keer", async () => {
    vi.resetModules();
    const { aanmeldOmleiding: omleiding } = await import("./api");
    const navigeer = vi.spyOn(omleiding, "navigeer").mockImplementation(() => {});
    window.history.pushState({}, "", "/agenda?week=3");

    omleiding.stuurDoor();
    omleiding.stuurDoor();

    expect(navigeer).toHaveBeenCalledTimes(1);
    expect(navigeer).toHaveBeenCalledWith(`/api/aanmelden?terugNaar=${encodeURIComponent("/agenda?week=3")}`);
    window.history.pushState({}, "", "/");
  });

  it("stuurt niet door bij een andere fout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 403 })));
    const omleiding = vi.spyOn(aanmeldOmleiding, "stuurDoor").mockImplementation(() => {});

    await expect(apiFetch("/api/klassen")).rejects.toBeInstanceOf(ApiError);

    expect(omleiding).not.toHaveBeenCalled();
  });
});
