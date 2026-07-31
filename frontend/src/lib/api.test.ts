import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "./api";

/**
 * Pins the two transport properties E1-13 needed and the client did not have.
 *
 * Both were blockers rather than polish: without the first, a multipart upload cannot reach the API at all
 * (the server finds no parts and answers "er is geen bestand meegestuurd"), and without the second the Dutch
 * `detail` of a 400/409 — which under the Art. II.3 amendment of 2026-07-30 is the *only* place the specific
 * reason a curriculum import was refused exists — is thrown away before any screen can read it.
 *
 * The body parser is tested against every envelope the API is known to produce, including the two that are
 * not ProblemDetails, because "it worked on the endpoint I was building" is how a parser that assumes one
 * shape ships.
 */

/**
 * Captures the `RequestInit` the client hands to `fetch`, so the headers can be asserted.
 *
 * The signature is given as a **type argument** rather than through declared parameters: inferred from
 * `async () => antwoord` the mock takes no arguments and `mock.calls[0][1]` does not typecheck, while declaring
 * the parameters to fix that leaves two unused ones for lint to reject.
 */
function stubFetch(antwoord: Response) {
  const fetchFake = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () => antwoord,
  );
  vi.stubGlobal("fetch", fetchFake);
  return fetchFake;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch — the request headers", () => {
  it("does not set Content-Type for a FormData body, so the browser can write its own boundary", async () => {
    const fetchFake = stubFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const formulier = new FormData();
    formulier.append("Bestand", new Blob(["x"]), "thema.xlsx");

    await apiFetch("/api/schoolcontent-import/voorbeeld", { method: "POST", body: formulier });

    const init = fetchFake.mock.calls[0][1]!;
    const headers = init.headers as Record<string, string>;
    expect(headers).not.toHaveProperty("Content-Type");
  });

  it("still sets Content-Type for a JSON body", async () => {
    const fetchFake = stubFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await apiFetch("/api/themas/1/doelsuggesties/genereer", {
      method: "POST",
      body: JSON.stringify({ selectie: null }),
    });

    const init = fetchFake.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sets no Content-Type on a plain GET either, since there is no body to describe", async () => {
    // Belt and braces on the branch: the guard keys on `body instanceof FormData`, and a GET has no body at
    // all, so it must keep taking the JSON branch exactly as it did before this change.
    const fetchFake = stubFetch(new Response(JSON.stringify([]), { status: 200 }));

    await apiFetch("/api/leerplandoelen");

    const init = fetchFake.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});

describe("apiFetch — what an error carries", () => {
  it("carries detail and title from a ProblemDetails written by a controller", async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          detail: "Er is geen bestand meegestuurd.",
          status: 400,
          title: "Ongeldige aanvraag",
        }),
        { status: 400, headers: { "Content-Type": "application/problem+json" } },
      ),
    );

    const fout = await apiFetch("/api/opstap-import").catch((e: unknown) => e);

    expect(fout).toBeInstanceOf(ApiError);
    expect((fout as ApiError).status).toBe(400);
    expect((fout as ApiError).detail).toBe("Er is geen bestand meegestuurd.");
    expect((fout as ApiError).title).toBe("Ongeldige aanvraag");
  });

  it("carries detail and type from the other envelope on the same endpoint, the one with traceId", async () => {
    // E1-15's integrity refusals travel through IProblemDetailsService, so they add fields the controller's
    // own 400s do not. Additive and RFC-valid; a parser keyed on an exact shape would miss exactly this one,
    // which is the 409 that matters most to render. `type` is the discriminator the Op.stap screen branches
    // its framing copy on, since the two 409s share a status and a title.
    stubFetch(
      new Response(
        JSON.stringify({
          type: "urn:jaarplanner:opstap-import:ontbrekende-minimumdoelen",
          title: "Import niet doorgevoerd",
          status: 409,
          detail: "Deze leerplandoelen verwijzen naar minimumdoelen die nog niet ingeladen zijn: K-1.",
          traceId: "00-abc-def-01",
        }),
        { status: 409 },
      ),
    );

    const fout = (await apiFetch("/api/opstap-import").catch((e: unknown) => e)) as ApiError;

    expect(fout.status).toBe(409);
    expect(fout.detail).toContain("minimumdoelen die nog niet ingeladen zijn");
    expect(fout.type).toBe("urn:jaarplanner:opstap-import:ontbrekende-minimumdoelen");
  });

  it("leaves type undefined when the body has none, so no caller can mistake absence for a match", async () => {
    stubFetch(
      new Response(JSON.stringify({ detail: "Er is geen bestand meegestuurd.", status: 400 }), {
        status: 400,
      }),
    );

    const fout = (await apiFetch("/api/opstap-import").catch((e: unknown) => e)) as ApiError;

    expect(fout.detail).toBe("Er is geen bestand meegestuurd.");
    expect(fout.type).toBeUndefined();
  });

  it("survives a body that is a bare string rather than a ProblemDetails", async () => {
    // Envelope (3): not every non-2xx body is a ProblemDetails. A proxy answers HTML, a dropped connection
    // answers nothing, and a plain-text body reaches here as unparseable JSON.
    //
    // This test used to name `GET /api/leerplandoelen` as the endpoint that answered exactly this. It did,
    // when E1-13 branched; **E1-16's fix round 2 changed it** to a real ProblemDetails and the claim went stale
    // through the merge that brought that onto this branch. The shape is still real, so the test stays; the
    // false attribution does not.
    stubFetch(new Response("Filtering by subdomein requires a domein.", { status: 400 }));

    const fout = (await apiFetch("/api/iets?subdomein=x").catch((e: unknown) => e)) as ApiError;

    expect(fout.status).toBe(400);
    // Deliberately absent: an English operator diagnostic must not become a teacher's sentence just because
    // it happened to arrive on the field a render site reads.
    expect(fout.detail).toBeUndefined();
  });

  it("survives an empty body, an HTML body and a quoted JSON string", async () => {
    for (const body of ["", "<html><body>502 Bad Gateway</body></html>", '"Not Found"']) {
      stubFetch(new Response(body, { status: 500 }));
      const fout = (await apiFetch("/api/iets").catch((e: unknown) => e)) as ApiError;

      expect(fout).toBeInstanceOf(ApiError);
      expect(fout.status).toBe(500);
      expect(fout.detail).toBeUndefined();
      expect(fout.title).toBeUndefined();
      vi.unstubAllGlobals();
    }
  });

  it("ignores a blank detail rather than passing an empty sentence to a render site", async () => {
    stubFetch(new Response(JSON.stringify({ detail: "   ", title: "" }), { status: 404 }));

    const fout = (await apiFetch("/api/iets").catch((e: unknown) => e)) as ApiError;

    expect(fout.detail).toBeUndefined();
    expect(fout.title).toBeUndefined();
  });

  it("keeps the status-only message, so a caller that branches on status is unaffected", async () => {
    stubFetch(new Response(JSON.stringify({ detail: "Iets" }), { status: 409 }));

    const fout = (await apiFetch("/api/iets").catch((e: unknown) => e)) as ApiError;

    expect(fout.message).toBe("Request to /api/iets failed with 409");
  });
});

describe("apiFetch — the success path is unchanged", () => {
  it("returns undefined for 204 and parsed JSON otherwise", async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(apiFetch("/api/iets")).resolves.toBeUndefined();
    vi.unstubAllGlobals();

    stubFetch(new Response(JSON.stringify({ naam: "Herfst" }), { status: 200 }));
    await expect(apiFetch<{ naam: string }>("/api/iets")).resolves.toEqual({ naam: "Herfst" });
  });
});
