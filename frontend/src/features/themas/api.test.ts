import { afterEach, describe, expect, it, vi } from "vitest";

import {
  haalThemaBibliotheek,
  haalThemaVoorKlas,
  koppelActiviteitAanDoel,
  koppelSubthemaAanDoel,
  maakSubthema,
  maakThema,
  ontkoppelActiviteitDoel,
  ontkoppelSubdoel,
  verwijderActiviteit,
  verwijderSubthema,
  verwijderThema,
  verwijderThemadoel,
  voegThemadoelToe,
  wijzigActiviteit,
  wijzigSubthema,
  wijzigThema,
} from "./api";
import type { ActiviteitInvoer, SubthemaInvoer, ThemaInvoer } from "./types";

/**
 * Pins the **address and the verb** of every beheer call (E1-14 over E1-10's endpoints).
 *
 * Why this file exists at all, when a component test would exercise the same functions: this surface has
 * fifteen calls across three route families, and the child levels are addressed *directly*
 * (`/api/subthemas/{id}`) rather than nested under their parent. A wrong path or a POST where the server
 * wants a PUT is a 404/405 that a component test with a stubbed hook cannot see, and that a stubbed
 * component test would keep passing through.
 *
 * The delete calls are asserted against a **204 No Content**, because that is what the controllers answer and
 * because `apiFetch` has a dedicated branch for it — a test that stubs `200 {}` would pass while the real
 * response took the other path.
 */

function stubFetch(antwoord: Response) {
  const fetchFake = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () => antwoord,
  );
  vi.stubGlobal("fetch", fetchFake);
  return fetchFake;
}

/** A JSON 200, for the reads and the writes that answer a body. */
function jsonAntwoord(inhoud: unknown = {}) {
  return new Response(JSON.stringify(inhoud), { status: 200 });
}

/** What the DELETE endpoints really answer. */
function leegAntwoord() {
  return new Response(null, { status: 204 });
}

/** The path and method of the single `fetch` call the function under test made. */
function aanroep(fetchFake: ReturnType<typeof stubFetch>) {
  expect(fetchFake).toHaveBeenCalledTimes(1);
  const [pad, init] = fetchFake.mock.calls[0];
  return { pad: String(pad), methode: init?.method, body: init?.body };
}

const THEMA = "11111111-1111-1111-1111-111111111111";
const SUBTHEMA = "22222222-2222-2222-2222-222222222222";
const ACTIVITEIT = "33333333-3333-3333-3333-333333333333";
const KLAS = "44444444-4444-4444-4444-444444444444";
const KOPPELING = "55555555-5555-5555-5555-555555555555";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("de leesaanroepen", () => {
  it("vraagt de bibliotheek op, niet de volledige themalijst", async () => {
    const fetchFake = stubFetch(jsonAntwoord([]));

    await haalThemaBibliotheek();

    expect(aanroep(fetchFake).pad).toBe("/api/themas/bibliotheek");
  });

  // The klas variant is the guard against cross-class bleed (Art. IX.2): it must ask the server for one
  // class's derivation rather than fetch every class's subthema's and filter them in the browser.
  it("vraagt het themadetail per klas op via de voor-klas route", async () => {
    const fetchFake = stubFetch(jsonAntwoord({}));

    await haalThemaVoorKlas(THEMA, KLAS);

    expect(aanroep(fetchFake).pad).toBe(`/api/themas/${THEMA}/voor-klas/${KLAS}`);
  });
});

describe("thema (schoolbreed)", () => {
  const invoer: ThemaInvoer = { naam: "Herfst", duurWeken: 6 };

  it("maakt een thema met POST op de collectie", async () => {
    const fetchFake = stubFetch(jsonAntwoord({}));

    await maakThema(invoer);

    const { pad, methode, body } = aanroep(fetchFake);
    expect(pad).toBe("/api/themas");
    expect(methode).toBe("POST");
    expect(JSON.parse(String(body))).toEqual(invoer);
  });

  it("wijzigt een thema met PUT op zijn eigen adres", async () => {
    const fetchFake = stubFetch(jsonAntwoord({}));

    await wijzigThema(THEMA, invoer);

    const { pad, methode } = aanroep(fetchFake);
    expect(pad).toBe(`/api/themas/${THEMA}`);
    expect(methode).toBe("PUT");
  });

  it("verwijdert een thema en verwerkt de 204 zonder inhoud", async () => {
    const fetchFake = stubFetch(leegAntwoord());

    await expect(verwijderThema(THEMA)).resolves.toBeUndefined();

    const { pad, methode } = aanroep(fetchFake);
    expect(pad).toBe(`/api/themas/${THEMA}`);
    expect(methode).toBe("DELETE");
  });

  it("koppelt een themadoel met alleen de leerplandoelcode als body", async () => {
    const fetchFake = stubFetch(jsonAntwoord({}));

    await voegThemadoelToe(THEMA, "NAT-K3-01");

    const { pad, methode, body } = aanroep(fetchFake);
    expect(pad).toBe(`/api/themas/${THEMA}/themadoelen`);
    expect(methode).toBe("POST");
    // The code is the only thing sent: a leerplandoel is read-only reference data and the client has no
    // business shipping any of its content back (Art. III.1 / III.5).
    expect(JSON.parse(String(body))).toEqual({ leerplandoelCode: "NAT-K3-01" });
  });

  it("ontkoppelt een themadoel binnen zijn thema", async () => {
    const fetchFake = stubFetch(leegAntwoord());

    await verwijderThemadoel(THEMA, KOPPELING);

    const { pad, methode } = aanroep(fetchFake);
    expect(pad).toBe(`/api/themas/${THEMA}/themadoelen/${KOPPELING}`);
    expect(methode).toBe("DELETE");
  });
});

describe("subthema (per klas en leeftijd)", () => {
  const invoer: SubthemaInvoer = { naam: "Bladeren", duurWeken: 2, klasId: KLAS, leeftijd: "8" };

  it("maakt een subthema onder zijn thema, met klas en leeftijd in de body", async () => {
    const fetchFake = stubFetch(jsonAntwoord({}));

    await maakSubthema(THEMA, invoer);

    const { pad, methode, body } = aanroep(fetchFake);
    expect(pad).toBe(`/api/themas/${THEMA}/subthemas`);
    expect(methode).toBe("POST");
    // Both scope fields must travel: the server refuses a subthema without a klas (Art. IX.2).
    expect(JSON.parse(String(body))).toMatchObject({ klasId: KLAS, leeftijd: "8" });
  });

  it("wijzigt en verwijdert een subthema op zijn eigen adres, niet onder het thema", async () => {
    const wijzigFake = stubFetch(jsonAntwoord({}));
    await wijzigSubthema(SUBTHEMA, invoer);
    expect(aanroep(wijzigFake)).toMatchObject({ pad: `/api/subthemas/${SUBTHEMA}`, methode: "PUT" });

    vi.unstubAllGlobals();
    const verwijderFake = stubFetch(leegAntwoord());
    await verwijderSubthema(SUBTHEMA);
    expect(aanroep(verwijderFake)).toMatchObject({
      pad: `/api/subthemas/${SUBTHEMA}`,
      methode: "DELETE",
    });
  });

  it("koppelt een doel aan een subthema en ontkoppelt het via de subdoel-route", async () => {
    const koppelFake = stubFetch(jsonAntwoord({}));
    await koppelSubthemaAanDoel(SUBTHEMA, "NAT-K3-02");
    expect(aanroep(koppelFake)).toMatchObject({
      pad: `/api/subthemas/${SUBTHEMA}/doelkoppelingen`,
      methode: "POST",
    });

    // Asymmetric on purpose, and worth pinning: linking posts to `doelkoppelingen`, unlinking deletes a
    // `subdoelen/{id}` — the subdoel is the thing that owns the link at this level.
    vi.unstubAllGlobals();
    const ontkoppelFake = stubFetch(leegAntwoord());
    await ontkoppelSubdoel(SUBTHEMA, KOPPELING);
    expect(aanroep(ontkoppelFake)).toMatchObject({
      pad: `/api/subthemas/${SUBTHEMA}/subdoelen/${KOPPELING}`,
      methode: "DELETE",
    });
  });
});

describe("activiteit", () => {
  const invoer: ActiviteitInvoer = { naam: "Bladkroon maken", activiteitType: "Hoek" };

  it("wijzigt een activiteit op zijn eigen adres en stuurt het type bij naam", async () => {
    const fetchFake = stubFetch(jsonAntwoord({}));

    await wijzigActiviteit(ACTIVITEIT, invoer);

    const { pad, methode, body } = aanroep(fetchFake);
    expect(pad).toBe(`/api/activiteiten/${ACTIVITEIT}`);
    expect(methode).toBe("PUT");
    // By name, never by number: the API converts enums as strings, and a numeric 2 would bind to whatever
    // member happens to sit at that value after the enum grows.
    expect(JSON.parse(String(body))).toMatchObject({ activiteitType: "Hoek" });
  });

  it("verwijdert een activiteit", async () => {
    const fetchFake = stubFetch(leegAntwoord());

    await verwijderActiviteit(ACTIVITEIT);

    expect(aanroep(fetchFake)).toMatchObject({
      pad: `/api/activiteiten/${ACTIVITEIT}`,
      methode: "DELETE",
    });
  });

  it("koppelt en ontkoppelt een doel op een activiteit", async () => {
    const koppelFake = stubFetch(jsonAntwoord({}));
    await koppelActiviteitAanDoel(ACTIVITEIT, "NAT-K3-03");
    expect(aanroep(koppelFake)).toMatchObject({
      pad: `/api/activiteiten/${ACTIVITEIT}/doelkoppelingen`,
      methode: "POST",
    });

    vi.unstubAllGlobals();
    const ontkoppelFake = stubFetch(leegAntwoord());
    await ontkoppelActiviteitDoel(ACTIVITEIT, KOPPELING);
    expect(aanroep(ontkoppelFake)).toMatchObject({
      pad: `/api/activiteiten/${ACTIVITEIT}/doelkoppelingen/${KOPPELING}`,
      methode: "DELETE",
    });
  });
});
