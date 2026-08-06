import { afterEach, describe, expect, it, vi } from "vitest";

import { genereerJaarplan } from "./api";

/**
 * Pins the **address** of the generation call, and above all the `?jaarFase=` it carries (E3-03).
 *
 * **Why an api-level test rather than a component one** (antagonist round 3). The query parameter is the fix for
 * round 1's MAJOR: without it the panel's figures and the live dekking line on the same screen were measured over
 * two different denominators. It was verified at service level only, and the component tests that mention
 * `jaarFase=` assert it on the `/dekking` URL, not on this POST. So a rename of the parameter, or a
 * `[FromQuery(Name=…)]` slip on the controller, left every test green while quietly restoring the two-denominator
 * state. The other half of this pin lives in `JaarplanEndpointsTests`, which asserts the server end of the same wire.
 */
function stubFetch() {
  const fetchFake = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify({}), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchFake);
  return fetchFake;
}

function aanroep(fetchFake: ReturnType<typeof stubFetch>) {
  expect(fetchFake).toHaveBeenCalledTimes(1);
  const [pad, init] = fetchFake.mock.calls[0];
  return { pad: String(pad), methode: init?.method, body: init?.body };
}

const KLAS = "44444444-4444-4444-4444-444444444444";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("genereerJaarplan", () => {
  it("stuurt de gekozen jaar/fase mee als querystring", () => {
    const fetchFake = stubFetch();

    void genereerJaarplan(KLAS, undefined, "L3");

    const { pad, methode } = aanroep(fetchFake);
    expect(pad).toBe(`/api/klassen/${KLAS}/jaarplan/generatie?jaarFase=L3`);
    expect(methode).toBe("POST");
  });

  it("laat de querystring weg wanneer er tegen het hele curriculum gemeten wordt", () => {
    const fetchFake = stubFetch();

    void genereerJaarplan(KLAS);

    expect(aanroep(fetchFake).pad).toBe(`/api/klassen/${KLAS}/jaarplan/generatie`);
  });

  it("encodeert de code, zodat een rare waarde de URL niet kan breken", () => {
    const fetchFake = stubFetch();

    void genereerJaarplan(KLAS, undefined, "K3 & L1");

    expect(aanroep(fetchFake).pad).toContain("?jaarFase=K3%20%26%20L1");
  });

  it("stuurt geen body wanneer de instellingen nog niet geladen zijn", () => {
    // A bodyless run applies whatever the class has kept (E3-04 owner ruling 2026-07-30), so "no body" and
    // "an empty body" are not interchangeable: the second one wipes the settings.
    const fetchFake = stubFetch();

    void genereerJaarplan(KLAS, undefined, "L3");

    expect(aanroep(fetchFake).body).toBeUndefined();
  });
});
