import type { Dekking, DoelDekking } from "./types";

/**
 * Test fixtures and the fetch fake for the dekkingsoverzicht (E5-02).
 *
 * **The fake answers `?bereik=` server-side**, following the register's fixture rather than the easier road. A fake
 * that ignored the query string would be satisfied by a screen that fetched the whole curriculum once and filtered it
 * in the browser, which is precisely the shape this story must not have: the scope changes the *denominator*, and a
 * denominator computed in the browser is not the one an export would print. So the scope tests assert both what is on
 * screen and what the request asked for.
 */

export const SCHOOLJAAR_ID = "22222222-2222-2222-2222-222222222222";
export const KLAS_ID = "11111111-1111-1111-1111-111111111111";

export const SCHOOLJAREN = [
  {
    id: SCHOOLJAAR_ID,
    naam: "2026-2027",
    start: "2026-09-01",
    eind: "2027-06-30",
    klassen: [{ id: KLAS_ID, naam: "K3 derde kleuterklas", leerjaar: 0 }],
  },
];

export function doel(overschrijving: Partial<DoelDekking> = {}): DoelDekking {
  return {
    code: "NAT-K3-01",
    doelsoort: "Gemeenschappelijk",
    jaarFase: "K3",
    domein: "Natuur",
    subdomein: "Levende natuur",
    tekst: "De kleuters verkennen levende natuur in de eigen omgeving.",
    minimumdoelRef: null,
    nietMeerInOpstap: false,
    isGedekt: false,
    dekkendeThemas: [],
    ...overschrijving,
  };
}

/** A healthy, trustworthy answer: two doelen in scope, one of them covered by one thema. */
export function dekking(overschrijving: Partial<Dekking> = {}): Dekking {
  const doelen = overschrijving.doelen ?? [
    doel({ code: "NAT-K3-01", isGedekt: true, dekkendeThemas: ["Herfst"] }),
    doel({ code: "NAT-K3-02" }),
  ];

  return {
    klasId: KLAS_ID,
    klasNaam: "K3 derde kleuterklas",
    schooljaarId: SCHOOLJAAR_ID,
    schooljaarNaam: "2026-2027",
    bereik: "EigenJaarFase",
    gemetenJaarFasen: ["JK", "K2", "K3"],
    isTerugvalNaarHeelCurriculum: false,
    aantalBuitenBereik: 0,
    isBetrouwbaar: true,
    aantalOnopgelosteVervallenPlaatsingen: 0,
    aantalGedekt: doelen.filter((d) => d.isGedekt).length,
    aantalLeerplandoelen: doelen.length,
    doelen,
    ...overschrijving,
  };
}

export interface FakeOpties {
  /** The answer per scope. `EigenJaarFase` is what an unparameterised screen would never get, so both are explicit. */
  perBereik?: Partial<Record<string, Dekking>>;
  /** Answer the dekking call with this status instead of 200. */
  status?: number;
}

/**
 * Stubs `fetch` for the shell's schooljaren list plus the dekking endpoint. Anything else 404s loudly, so an
 * unexpected request fails the test rather than being quietly absorbed.
 */
export function maakDekkingFetchFake(opties: FakeOpties = {}) {
  const urls: string[] = [];

  async function fetchFake(input: RequestInfo | URL): Promise<Response> {
    const url = String(input);
    urls.push(url);

    if (url.includes("/api/schooljaren")) {
      return new Response(JSON.stringify(SCHOOLJAREN), { status: 200 });
    }

    if (url.includes("/dekking")) {
      if (opties.status && opties.status !== 200) {
        return new Response(JSON.stringify({ title: "Fout", status: opties.status }), {
          status: opties.status,
          headers: { "Content-Type": "application/problem+json" },
        });
      }

      const bereik = new URL(url, "http://test").searchParams.get("bereik") ?? "";
      const antwoord = opties.perBereik?.[bereik];

      if (!antwoord) {
        // Deliberately a failure rather than a default. A fixture that fell back to "some answer" for an unknown or
        // absent scope would hide the exact defect these tests exist to catch: a screen that does not say which
        // denominator it wants.
        return new Response(`no fixture for bereik=${bereik}`, { status: 500 });
      }

      return new Response(JSON.stringify(antwoord), { status: 200 });
    }

    return new Response("unexpected request", { status: 404 });
  }

  return {
    fetchFake,
    urls,
    /** The last dekking request, so a test can assert the scope travelled to the server. */
    laatsteDekkingUrl: () => [...urls].reverse().find((url) => url.includes("/dekking")),
    aantalDekkingAanroepen: () => urls.filter((url) => url.includes("/dekking")).length,
  };
}
