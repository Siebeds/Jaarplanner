import type { DoelDetail, DoelRegel, DoelenFacetten } from "./types";

/**
 * Shared fixtures for the Doelen-register tests, plus the fetch fake that serves them.
 *
 * The fake answers at the **fetch boundary** (the convention `Jaarplankalender.test.tsx` set) and it
 * **applies the filters and the paging server-side**, in this module, rather than returning a fixed page.
 * That is deliberate: the thing under test is that the screen asks the server and renders what comes back,
 * so a fake that ignored `?domein=` would make a client-side filter pass just as happily as the real thing.
 */

/** The taxonomy repeats "Bouwstenen" under two domeinen, which is the Art. VII.0 hazard made concrete. */
export const DOELEN: DoelRegel[] = [
  {
    code: "NAT-K3-01",
    doelsoort: "Minimumdoel",
    jaarFase: "K3",
    domein: "Natuur",
    subdomein: "Levend",
    tekst: "De kleuter observeert planten in de omgeving.",
    minimumdoelRef: "K-12",
    nietMeerInOpstap: false,
  },
  {
    code: "NAT-K3-02",
    doelsoort: "Gemeenschappelijk",
    jaarFase: "K3",
    domein: "Natuur",
    subdomein: "Levend",
    tekst: "De kleuter benoemt de seizoenen.",
    minimumdoelRef: null,
    nietMeerInOpstap: false,
  },
  {
    code: "MUZ-L2-01",
    doelsoort: "Gemeenschappelijk",
    jaarFase: "L2",
    domein: "Muziek",
    subdomein: "Bouwstenen",
    tekst: "De leerling herkent een puls in muziek.",
    minimumdoelRef: null,
    nietMeerInOpstap: false,
  },
  {
    code: "BEE-L2-01",
    doelsoort: "Specifiek",
    jaarFase: "L2",
    domein: "Beeld",
    subdomein: "Bouwstenen",
    tekst: "De leerling herkent lijn en vlak in een beeld.",
    minimumdoelRef: null,
    nietMeerInOpstap: false,
  },
  {
    code: "VERVALLEN-1",
    doelsoort: "Precurriculum",
    jaarFase: "K2",
    domein: "Natuur",
    subdomein: "Niet-levend",
    tekst: "Dit doel stond in een eerdere Op.stap-versie.",
    minimumdoelRef: null,
    nietMeerInOpstap: true,
  },
];

export const FACETTEN: DoelenFacetten = {
  totaalAantalDoelen: DOELEN.length,
  disciplines: [
    { nummer: "1", naam: "Nederlands en communicatie", aantal: 4 },
    { nummer: "2", naam: "Wiskunde", aantal: 1 },
  ],
  domeinen: [
    { domein: "Beeld", aantal: 1, subdomeinen: [{ subdomein: "Bouwstenen", aantal: 1 }] },
    {
      domein: "Muziek",
      aantal: 1,
      subdomeinen: [{ subdomein: "Bouwstenen", aantal: 1 }],
    },
    {
      domein: "Natuur",
      aantal: 3,
      subdomeinen: [
        { subdomein: "Levend", aantal: 2 },
        { subdomein: "Niet-levend", aantal: 1 },
      ],
    },
  ],
  doelsoorten: [
    { doelsoort: "Minimumdoel", aantal: 1 },
    { doelsoort: "Gemeenschappelijk", aantal: 2 },
    { doelsoort: "Precurriculum", aantal: 1 },
    { doelsoort: "Specifiek", aantal: 1 },
  ],
  jaarFasen: [
    { jaarFase: "K2", aantal: 1 },
    { jaarFase: "K3", aantal: 2 },
    { jaarFase: "L2", aantal: 2 },
  ],
};

/** Every optional field filled, all four link layers, and a loaded decreed minimumdoel. */
export const DETAIL_VOLLEDIG: DoelDetail = {
  code: "NAT-K3-01",
  doelsoort: "Minimumdoel",
  jaarFase: "K3",
  disciplineNummer: "1",
  disciplineNaam: "Nederlands en communicatie",
  domein: "Natuur",
  subdomein: "Levend",
  cluster: "Planten",
  tekst: "De kleuter observeert planten in de omgeving.",
  voorbeelden: "een wandeling in het park",
  toelichting: "Observeren gaat voor benoemen.",
  woordenschat: "blad, stam, wortel",
  minimumdoelRef: "K-12",
  minimumdoel: {
    ref: "K-12",
    leeftijd: "K-",
    nr: "12",
    omschrijving: "De kleuter verkent de natuur in de omgeving.",
  },
  nietMeerInOpstap: false,
  koppelingen: [
    // The two school-wide layers carry no klas; the two class/age-scoped ones name theirs (Art. IX.2).
    { herkomst: "Themadoel", themaNaam: "Herfst", onderdeel: null, klasNaam: null, status: "Manueel" },
    {
      herkomst: "Doelsuggestie",
      themaNaam: "Herfst",
      onderdeel: null,
      klasNaam: null,
      status: "Voorgesteld",
    },
    {
      herkomst: "Subdoel",
      themaNaam: "Herfst",
      onderdeel: "Bladeren",
      klasNaam: "L3 derde leerjaar",
      status: "Aanvaard",
    },
    {
      herkomst: "Activiteit",
      themaNaam: "Herfst",
      onderdeel: "Bladeren zoeken",
      klasNaam: "K3 groen",
      status: "Geweigerd",
    },
  ],
};

/** Every optional field empty, no concordance, no links: the absent-field branches. */
export const DETAIL_KAAL: DoelDetail = {
  code: "NAT-K3-02",
  doelsoort: "Gemeenschappelijk",
  jaarFase: "K3",
  disciplineNummer: "1",
  disciplineNaam: "Nederlands en communicatie",
  domein: "Natuur",
  subdomein: "Levend",
  cluster: null,
  tekst: "De kleuter benoemt de seizoenen.",
  voorbeelden: null,
  toelichting: null,
  woordenschat: null,
  minimumdoelRef: null,
  minimumdoel: null,
  nietMeerInOpstap: false,
  koppelingen: [],
};

/**
 * Concorded, but the decreed omschrijving is not loaded.
 *
 * This shape is **not reachable in the database today**: `leerplandoelen.MinimumdoelRef` is a `Restrict` FK
 * to `minimumdoelen.Ref`, so a goal carrying a ref with no row fails to commit (SQLSTATE 23503) — which is
 * exactly the E1-03/E1-04 blockage that E1-12 unblocks. The read view models the two fields separately
 * anyway, so the copy is pinned here rather than faked in a Postgres fixture by dropping a constraint the
 * application never runs without.
 */
export const DETAIL_CONCORDANTIE_ZONDER_RIJ: DoelDetail = {
  ...DETAIL_KAAL,
  code: "WIS-L4-01",
  minimumdoelRef: "4-07",
  minimumdoel: null,
};

/** The `NietMeerInOpstap` review flag on a detail. */
export const DETAIL_VERVALLEN: DoelDetail = {
  ...DETAIL_KAAL,
  code: "VERVALLEN-1",
  doelsoort: "Precurriculum",
  jaarFase: "K2",
  subdomein: "Niet-levend",
  tekst: "Dit doel stond in een eerdere Op.stap-versie.",
  nietMeerInOpstap: true,
};

const DETAILS: Record<string, DoelDetail> = {
  "NAT-K3-01": DETAIL_VOLLEDIG,
  "NAT-K3-02": DETAIL_KAAL,
  "WIS-L4-01": DETAIL_CONCORDANTIE_ZONDER_RIJ,
  "VERVALLEN-1": DETAIL_VERVALLEN,
};

/** Which discipline each seeded code belongs to, so the fake can honour `?discipline=`. */
const DISCIPLINE_PER_CODE: Record<string, string> = {
  "NAT-K3-01": "1",
  "NAT-K3-02": "1",
  "MUZ-L2-01": "1",
  "BEE-L2-01": "1",
  "VERVALLEN-1": "2",
};

export interface FakeOpties {
  /** The register's contents; pass `[]` for the "nothing imported" state. */
  doelen?: DoelRegel[];
  /** Override the facets, e.g. to make `totaalAantalDoelen` zero. */
  facetten?: DoelenFacetten;
  /** Page size, so a paging test does not need 51 fixtures. */
  paginaGrootte?: number;
  /** Codes that must answer 404, for the unknown-code empty state. */
  onbekendeCodes?: string[];
}

/**
 * A fetch fake that filters, sorts and pages **the way the server does**, so a screen that quietly narrowed
 * a local copy of the register would fail these tests rather than pass them.
 *
 * It also records every request URL, which is how the filter tests assert that the *server* was asked, and
 * not merely that the visible rows changed.
 */
export function maakDoelenFetchFake(opties: FakeOpties = {}) {
  const alles = opties.doelen ?? DOELEN;
  const paginaGrootte = opties.paginaGrootte ?? 50;
  const urls: string[] = [];

  /** The filter as the API reads it off a query string. */
  function leesFilterUitUrl(params: URLSearchParams) {
    return {
      zoek: params.get("zoek")?.toLowerCase() ?? undefined,
      discipline: params.get("discipline") ?? undefined,
      domein: params.get("domein") ?? undefined,
      subdomein: params.get("subdomein") ?? undefined,
      doelsoort: params.get("doelsoort") ?? undefined,
      // `getAll`, because `?jaarFase=` is repeatable and matched as "any of" (E9-07). `get` returns only the FIRST
      // value, so a fake using it would answer a scoped picker with one of the three kleuterjaren and every assertion
      // about the class's own set would pass for the wrong reason.
      jaarFasen: params.getAll("jaarFase").filter((f) => f.length > 0),
    };
  }

  type Filterwaarden = ReturnType<typeof leesFilterUitUrl>;

  /** Applies the filter, ordered (domein, subdomein, code) exactly as the endpoint does. */
  function pasFilterToe(f: Filterwaarden) {
    return alles
      .filter((doel) =>
        f.zoek
          ? doel.code.toLowerCase().includes(f.zoek) || doel.tekst.toLowerCase().includes(f.zoek)
          : true,
      )
      .filter((doel) => (f.discipline ? DISCIPLINE_PER_CODE[doel.code] === f.discipline : true))
      .filter((doel) => (f.domein ? doel.domein === f.domein : true))
      .filter((doel) => (f.subdomein ? doel.subdomein === f.subdomein : true))
      .filter((doel) => (f.doelsoort ? doel.doelsoort === f.doelsoort : true))
      .filter((doel) => (f.jaarFasen.length > 0 ? f.jaarFasen.includes(doel.jaarFase) : true))
      .sort(
        (a, b) =>
          a.domein.localeCompare(b.domein) ||
          a.subdomein.localeCompare(b.subdomein) ||
          a.code.localeCompare(b.code),
      );
  }

  /**
   * Facets the way the server builds them: **option sets from the whole curriculum, counts under the rest of
   * the filter**. The fake mirrors that rule rather than returning a fixed object, so a test can prove a
   * zero-count option still appears and reads "(0)" — which is the behaviour antagonist finding 12 asked for,
   * and a fixed fixture could not show either way.
   */
  function bouwFacetten(params: URLSearchParams): DoelenFacetten {
    const basis = opties.facetten ?? FACETTEN;
    const filter = leesFilterUitUrl(params);
    const zonder = (weg: Partial<Filterwaarden>) => pasFilterToe({ ...filter, ...weg });

    const perDiscipline = zonder({ discipline: undefined });
    const perTaxonomie = zonder({ domein: undefined, subdomein: undefined });
    const perDoelsoort = zonder({ doelsoort: undefined });
    const perJaarFase = zonder({ jaarFasen: [] });

    return {
      // Deliberately the UNFILTERED total, like the server: it is what tells "nothing imported" from
      // "filtered to nothing" apart.
      totaalAantalDoelen: opties.facetten?.totaalAantalDoelen ?? alles.length,
      disciplines: basis.disciplines.map((d) => ({
        ...d,
        aantal: perDiscipline.filter((doel) => DISCIPLINE_PER_CODE[doel.code] === d.nummer).length,
      })),
      domeinen: basis.domeinen.map((d) => {
        const subdomeinen = d.subdomeinen.map((s) => ({
          ...s,
          aantal: perTaxonomie.filter(
            (doel) => doel.domein === d.domein && doel.subdomein === s.subdomein,
          ).length,
        }));
        return {
          ...d,
          aantal: subdomeinen.reduce((som, s) => som + s.aantal, 0),
          subdomeinen,
        };
      }),
      doelsoorten: basis.doelsoorten.map((d) => ({
        ...d,
        aantal: perDoelsoort.filter((doel) => doel.doelsoort === d.doelsoort).length,
      })),
      jaarFasen: basis.jaarFasen.map((j) => ({
        ...j,
        aantal: perJaarFase.filter((doel) => doel.jaarFase === j.jaarFase).length,
      })),
    };
  }

  const fetchFake = async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    urls.push(url.pathname + url.search);

    if (url.pathname === "/api/leerplandoelen/facetten") {
      // The API refuses a subdomein without its domein (Art. VII.0); the fake refuses it too, so a client that
      // sent one would fail these tests instead of quietly getting a wide answer.
      if (url.searchParams.get("subdomein") && !url.searchParams.get("domein")) {
        return new Response("subdomein requires domein", { status: 400 });
      }
      return new Response(JSON.stringify(bouwFacetten(url.searchParams)), { status: 200 });
    }

    if (url.pathname.startsWith("/api/leerplandoelen/")) {
      const code = decodeURIComponent(url.pathname.slice("/api/leerplandoelen/".length));
      if (opties.onbekendeCodes?.includes(code) || !DETAILS[code]) {
        return new Response("niet gevonden", { status: 404 });
      }
      return new Response(JSON.stringify(DETAILS[code]), { status: 200 });
    }

    if (url.pathname === "/api/leerplandoelen") {
      if (url.searchParams.get("subdomein") && !url.searchParams.get("domein")) {
        return new Response("subdomein requires domein", { status: 400 });
      }

      const overslaan = Number(url.searchParams.get("overslaan") ?? "0");
      const aantal = Number(url.searchParams.get("aantal") ?? String(paginaGrootte));
      const gevonden = pasFilterToe(leesFilterUitUrl(url.searchParams));

      return new Response(
        JSON.stringify({
          regels: gevonden.slice(overslaan, overslaan + Math.min(aantal, paginaGrootte)),
          totaal: gevonden.length,
          overslaan,
          aantal,
        }),
        { status: 200 },
      );
    }

    return new Response("unexpected request", { status: 404 });
  };

  return { fetchFake, urls };
}
