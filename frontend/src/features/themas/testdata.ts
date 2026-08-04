import { DOELEN } from "../doelen/testdata";
import type { SchooljaarKeuze } from "../../app/schooljaren";
import type { Subthema, Thema, ThemaBibliotheekItem } from "./types";

/**
 * Fixtures and a routing fetch fake for the beheer screens (E1-14).
 *
 * **The fake answers per endpoint, and the level scoping is baked into it.** `…/bibliotheek` returns the
 * school-wide layer with no subthema's in it at all, and `…/voor-klas/{klasId}` returns only the subthema's of
 * the class asked for. A fake that ignored the klas would make a screen that leaks another class's content
 * pass, which is the one property these tests exist to prove (Art. IX.2).
 *
 * The leerplandoelen come from the **Doelen register's own fixtures**, so the picker is exercised against the
 * same rows and the same server-side filtering as `/doelen`.
 */

export const KLAS_L3 = "44444444-4444-4444-4444-444444444444";
export const KLAS_K3 = "44444444-4444-4444-4444-444444444445";
export const THEMA_HERFST = "11111111-1111-1111-1111-111111111111";
export const THEMA_WATER = "11111111-1111-1111-1111-111111111112";

export const SCHOOLJAREN: SchooljaarKeuze[] = [
  {
    id: "99999999-9999-9999-9999-999999999999",
    naam: "2026-2027",
    start: "2026-09-01",
    eind: "2027-06-30",
    klassen: [
      { id: KLAS_L3, naam: "L3 derde leerjaar", leerjaar: 3 },
      { id: KLAS_K3, naam: "K3 derde kleuterklas", leerjaar: 0 },
    ],
  },
];

/** Herfst: two themadoelen, so it sits inside the 2-or-3 advice and one class built on it. */
export const HERFST: ThemaBibliotheekItem = {
  id: THEMA_HERFST,
  naam: "Herfst",
  duurWeken: 6,
  invalshoeken: "natuur en techniek",
  kernwoordenschat: ["blad", "wind", "oogst"],
  rijkeWoordenschat: ["bladerdek"],
  heeftVoldoendeThemadoelen: true,
  themadoelen: [
    {
      id: "aaaaaaa1-0000-0000-0000-000000000001",
      koppeling: {
        id: "bbbbbbb1-0000-0000-0000-000000000001",
        leerplandoelCode: "NAT-K3-01",
        status: "Aanvaard",
        aiMotivatie: null,
      },
    },
    {
      id: "aaaaaaa1-0000-0000-0000-000000000002",
      koppeling: {
        id: "bbbbbbb1-0000-0000-0000-000000000002",
        leerplandoelCode: "NAT-K3-02",
        status: "Voorgesteld",
        aiMotivatie: "Sluit aan bij het observeren van bladeren.",
      },
    },
  ],
  aantalAfgeleideKlassen: 1,
};

/** Water: one themadoel (so the advice shows) and nothing derived from it, so it is deletable. */
export const WATER: ThemaBibliotheekItem = {
  id: THEMA_WATER,
  naam: "Water",
  duurWeken: 4,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: false,
  themadoelen: [
    {
      id: "aaaaaaa2-0000-0000-0000-000000000001",
      koppeling: {
        id: "bbbbbbb2-0000-0000-0000-000000000001",
        leerplandoelCode: "NAT-K3-01",
        status: "Manueel",
        aiMotivatie: null,
      },
    },
  ],
  aantalAfgeleideKlassen: 0,
};

export const BIBLIOTHEEK: ThemaBibliotheekItem[] = [HERFST, WATER];

/** What L3 derived from Herfst. K3 derived nothing, which is what makes the bleed test meaningful. */
const SUBTHEMA_L3: Subthema = {
  id: "cccccccc-0000-0000-0000-000000000001",
  themaId: THEMA_HERFST,
  naam: "Bladeren",
  duurWeken: 2,
  klasId: KLAS_L3,
  leeftijd: "8",
  probleemstelling: "Waarom vallen bladeren?",
  onderzoeksvraag: null,
  subdoelen: [
    {
      id: "dddddddd-0000-0000-0000-000000000001",
      leeftijd: "8",
      koppeling: {
        id: "eeeeeeee-0000-0000-0000-000000000001",
        leerplandoelCode: "NAT-K3-01",
        status: "Aanvaard",
        aiMotivatie: null,
      },
    },
  ],
  activiteiten: [
    {
      id: "ffffffff-0000-0000-0000-000000000001",
      naam: "Bladkroon maken",
      activiteitType: "Hoek",
      hoek: "creahoek",
      verwachteUitkomsten: null,
      doelkoppelingen: [
        {
          id: "ffffffff-0000-0000-0000-000000000002",
          leerplandoelCode: "NAT-K3-02",
          status: "Manueel",
          aiMotivatie: null,
        },
      ],
    },
  ],
};

/** The per-klas view: the school-wide layer plus only the requested class's subthema's. */
function themaVoorKlas(item: ThemaBibliotheekItem, klasId: string): Thema {
  const subthemas =
    item.id === THEMA_HERFST && klasId === KLAS_L3 ? [SUBTHEMA_L3] : ([] as Subthema[]);

  return {
    id: item.id,
    naam: item.naam,
    duurWeken: item.duurWeken,
    invalshoeken: item.invalshoeken,
    kernwoordenschat: item.kernwoordenschat,
    rijkeWoordenschat: item.rijkeWoordenschat,
    heeftVoldoendeThemadoelen: item.heeftVoldoendeThemadoelen,
    themadoelen: item.themadoelen,
    subthemas,
  };
}

export interface ThemaFakeOpties {
  /** The bibliotheek to serve; defaults to Herfst + Water. Pass `[]` for the empty state. */
  bibliotheek?: ThemaBibliotheekItem[];
  /** Fail the bibliotheek read, for the error state. */
  bibliotheekFaalt?: boolean;
  /** Answer a thema delete with this ProblemDetails 400 instead of 204 (the "still in a jaarplan" refusal). */
  verwijderWeigering?: string;
  /** Serve an empty Op.stap register, so the picker must say "nothing imported" rather than "not found". */
  geenCurriculum?: boolean;
}

/** One recorded write, so a test can assert the address, the verb and the body the screen sent. */
export interface Verzoek {
  pad: string;
  methode: string;
  body?: unknown;
}

export function maakThemaFetchFake(opties: ThemaFakeOpties = {}) {
  const bibliotheek = opties.bibliotheek ?? BIBLIOTHEEK;
  const urls: string[] = [];
  const verzoeken: Verzoek[] = [];

  const fetchFake = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const pad = String(input);
    const url = new URL(pad, "http://localhost");
    const methode = (init?.method ?? "GET").toUpperCase();
    urls.push(pad);

    if (methode !== "GET") {
      verzoeken.push({
        pad,
        methode,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
    }

    const json = (inhoud: unknown, status = 200) =>
      new Response(JSON.stringify(inhoud), { status });

    // --- The shell's own reads, so the class selector and its names work in a full-App render. ---
    if (url.pathname === "/api/schooljaren") {
      return json(SCHOOLJAREN);
    }

    // --- E2's reads, which the thema detail now hosts. Empty is the honest default here: these tests are
    //     about beheer, and E2 has its own suites for the review itself. ---
    if (url.pathname.includes("/doelsuggesties")) {
      return methode === "GET" ? json([]) : json({ isGeslaagd: true, fout: null, aantalKandidaten: 0, bewaard: [], overgeslagenOnbekend: [], overgeslagenDuplicaat: [] });
    }

    if (url.pathname === "/api/leerplandoelen/ongekoppeld") {
      return json([]);
    }

    // --- The picker's two reads: the unfiltered total (is there a curriculum at all?) and the search. ---
    if (url.pathname === "/api/leerplandoelen/facetten") {
      return json({
        disciplines: [],
        domeinen: [],
        subdomeinen: [],
        doelsoorten: [],
        jaarFasen: [],
        totaalAantalDoelen: opties.geenCurriculum ? 0 : DOELEN.length,
      });
    }

    // --- The picker searches the register, server-side, exactly as /doelen does. ---
    if (url.pathname === "/api/leerplandoelen") {
      const zoek = url.searchParams.get("zoek")?.toLowerCase() ?? "";
      const gevonden = (opties.geenCurriculum ? [] : DOELEN).filter(
        (doel) =>
          zoek === "" ||
          doel.code.toLowerCase().includes(zoek) ||
          doel.tekst.toLowerCase().includes(zoek),
      );
      const aantal = Number(url.searchParams.get("aantal") ?? "50");
      return json({ regels: gevonden.slice(0, aantal), totaal: gevonden.length, overslaan: 0, aantal });
    }

    // --- Beheer: the school-wide layer. ---
    if (url.pathname === "/api/themas/bibliotheek") {
      return opties.bibliotheekFaalt ? json({ detail: "stuk" }, 500) : json(bibliotheek);
    }

    if (url.pathname === "/api/themas" && methode === "POST") {
      const invoer = JSON.parse(String(init?.body)) as { naam: string; duurWeken: number };
      return json(
        {
          id: "11111111-1111-1111-1111-11111111119a",
          naam: invoer.naam,
          duurWeken: invoer.duurWeken,
          invalshoeken: null,
          kernwoordenschat: [],
          rijkeWoordenschat: [],
          heeftVoldoendeThemadoelen: false,
          themadoelen: [],
          subthemas: [],
        },
        200,
      );
    }

    // --- Beheer: one class's derivation. Note the pattern is matched BEFORE the bare thema routes. ---
    const voorKlas = url.pathname.match(/^\/api\/themas\/([^/]+)\/voor-klas\/([^/]+)$/);
    if (voorKlas) {
      const item = bibliotheek.find((thema) => thema.id === voorKlas[1]);
      return item ? json(themaVoorKlas(item, voorKlas[2])) : json({ detail: "onbekend" }, 404);
    }

    if (url.pathname.match(/^\/api\/themas\/[^/]+\/themadoelen$/) && methode === "POST") {
      return json({ id: "nieuw-themadoel", koppeling: { id: "nieuw", leerplandoelCode: "MUZ-L2-01", status: "Manueel", aiMotivatie: null } });
    }

    if (url.pathname.match(/^\/api\/themas\/[^/]+\/themadoelen\/[^/]+$/) && methode === "DELETE") {
      return new Response(null, { status: 204 });
    }

    if (url.pathname.match(/^\/api\/themas\/[^/]+$/)) {
      if (methode === "PUT") {
        const invoer = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return json({ ...bibliotheek[0], ...invoer, subthemas: [] });
      }

      if (methode === "DELETE") {
        return opties.verwijderWeigering
          ? json({ title: "Ongeldige aanvraag", detail: opties.verwijderWeigering, status: 400 }, 400)
          : new Response(null, { status: 204 });
      }
    }

    return new Response("unexpected request", { status: 404 });
  };

  return { fetchFake, urls, verzoeken };
}
