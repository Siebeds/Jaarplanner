import { DOELEN } from "../doelen/testdata";
import type { SchooljaarKeuze } from "../../app/schooljaren";
import type { Activiteit, Subthema, Thema, ThemaBibliotheekItem } from "./types";

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
/** A thema sitting on the domain's hard ceiling of three themadoelen (`Thema.MaxThemadoelen`). */
export const THEMA_VOL = "11111111-1111-1111-1111-111111111113";

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

/**
 * At the cap. It exists because the browser pass never reached this state (it went 0 -> 1 themadoelen on a
 * fresh thema), and it is the one state on this screen where the server refuses a write.
 */
export const VOL: ThemaBibliotheekItem = {
  id: THEMA_VOL,
  naam: "Volle mand",
  duurWeken: 5,
  invalshoeken: null,
  kernwoordenschat: [],
  rijkeWoordenschat: [],
  heeftVoldoendeThemadoelen: true,
  themadoelen: [1, 2, 3].map((nr) => ({
    id: `aaaaaaa3-0000-0000-0000-00000000000${nr}`,
    koppeling: {
      id: `bbbbbbb3-0000-0000-0000-00000000000${nr}`,
      leerplandoelCode: `NAT-K3-0${nr}`,
      status: "Manueel" as const,
      aiMotivatie: null,
    },
  })),
  aantalAfgeleideKlassen: 0,
};

export const BIBLIOTHEEK: ThemaBibliotheekItem[] = [HERFST, WATER, VOL];

/** What L3 derived from Herfst. K3 derived nothing, which is what makes the bleed test meaningful. */
const SUBTHEMA_L3: Subthema = {
  id: "cccccccc-0000-0000-0000-000000000001",
  themaId: THEMA_HERFST,
  naam: "Bladeren",
  duurWeken: 2,
  klasId: KLAS_L3,
  leeftijd: "8",
  probleemstelling: "Waarom vallen bladeren?",
  onderzoeksvraag: "Wat gebeurt er met een blad in water?",
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
      verwachteUitkomsten: "De kleuter benoemt drie kleuren van bladeren.",
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

/**
 * A second subthema for the same klas under a **different** thema (E4-08).
 *
 * It exists so a cross-thema move has a destination: the ruling of 2026-08-05 lets an activiteit leave its
 * thema but never its klas, and with one subthema per klas the picker would correctly render nothing and prove
 * nothing. It carries no activiteiten of its own, so a moved one is unambiguous.
 */
const SUBTHEMA_L3_DERDE: Subthema = {
  id: "cccccccc-0000-0000-0000-000000000003",
  themaId: THEMA_VOL,
  naam: "De regenboog",
  duurWeken: 2,
  klasId: KLAS_L3,
  leeftijd: "9",
  probleemstelling: null,
  onderzoeksvraag: null,
  subdoelen: [],
  activiteiten: [],
};

const SUBTHEMA_L3_WATER: Subthema = {
  id: "cccccccc-0000-0000-0000-000000000002",
  themaId: THEMA_WATER,
  naam: "Drijven en zinken",
  duurWeken: 2,
  klasId: KLAS_L3,
  leeftijd: "8",
  probleemstelling: null,
  onderzoeksvraag: null,
  subdoelen: [],
  activiteiten: [],
};

/** The per-klas view: the school-wide layer plus only the requested class's subthema's. */
function themaVoorKlas(item: ThemaBibliotheekItem, klasId: string, opslag: Subthema[]): Thema {
  const subthemas = opslag.filter((sub) => sub.themaId === item.id && sub.klasId === klasId);

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
  /** Answer a thema delete with a bare 500 that carries no `detail`, so the framing sentence must stand alone. */
  verwijderZonderReden?: boolean;
  /** Answer a thema delete with a 404: a colleague deleted it first. */
  verwijderAlWeg?: boolean;
  /** Answer a subthema delete with a 404, i.e. a colleague deleted that subthema first. */
  subthemaAlWeg?: boolean;
  /** Answer a thema PUT with a 404: a colleague deleted the thema while the edit form was open. */
  themaWijzigAlWeg?: boolean;
  /**
   * Serve only the klas's *own* thema subthema, so a move has nowhere to go (E4-08). The picker must then not
   * offer a control at all rather than open on an empty list.
   */
  geenBestemming?: boolean;
  /**
   * Answer a move with a 404: the activiteit itself is gone. A destination that vanished is a 400 instead, so
   * this option cannot stand for both (see `verplaatsActiviteit`).
   */
  verplaatsActiviteitAlWeg?: boolean;
  /** Answer a move with a 400 carrying this `detail`, e.g. a destination a colleague deleted meanwhile. */
  verplaatsWeigering?: string;
  /**
   * Add a **third** subthema for L3, under a third thema and with a different `leeftijd` (E4-08 round 2).
   *
   * Opt-in, because the default two-subthema store is what the destination-list test asserts exactly. Two
   * findings need it: the leeftijd disclosure only renders when a destination with another age is on offer, and
   * the derived-choice fix can only be observed when the chosen destination vanishes while **another remains**.
   */
  extraBestemming?: boolean;
  /** Fail `GET /api/subthemas/voor-klas/{klasId}`, for the panel's list-error state. */
  bestemmingenFaalt?: boolean;
  /**
   * Never resolve the destinations read, for the panel's **loading** state (E4-08 round 3).
   *
   * It exists because a property test named over "every state the panel can be in" drove three of four, and the
   * missing one hid a real surviving mutation: a submit rendered while there was no picker.
   */
  bestemmingenHangt?: boolean;
  /**
   * Answer the destinations read once and fail every later one, which is the `isRefetchError` state: `isError`
   * true while `data` still holds the previous list (E4-08 round 3, MINOR 6). `bestemmingenFaalt` cannot stand
   * in for it, because failing the first fetch means no data ever exists.
   */
  bestemmingenFaaltNaEerste?: boolean;
  /**
   * The exact race a browser pass found: the move is refused **and** the destination really is gone, so the
   * next destinations read no longer contains it. A plain `verplaatsWeigering` cannot stand in for this,
   * because the list it answers stays unchanged and the picker would look correct either way.
   */
  verplaatsBestemmingVerdwijnt?: boolean;
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

  /**
   * The class-scoped store, mutated by the write endpoints below.
   *
   * Deliberately stateful: a fake that answered a canned list would let a **missing invalidation** pass, since
   * the screen would render the same rows before and after a write. Here a create only becomes visible if the
   * component really refetches, which is the behaviour worth pinning.
   */
  let bestemmingenGeleverd = 0;
  const subthemaOpslag: Subthema[] = opties.geenBestemming
    ? [structuredClone(SUBTHEMA_L3)]
    : [
        structuredClone(SUBTHEMA_L3),
        structuredClone(SUBTHEMA_L3_WATER),
        ...(opties.extraBestemming ? [structuredClone(SUBTHEMA_L3_DERDE)] : []),
      ];
  let teller = 0;

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
      return item ? json(themaVoorKlas(item, voorKlas[2], subthemaOpslag)) : json({ detail: "onbekend" }, 404);
    }

    if (url.pathname.match(/^\/api\/themas\/[^/]+\/themadoelen$/) && methode === "POST") {
      return json({ id: "nieuw-themadoel", koppeling: { id: "nieuw", leerplandoelCode: "MUZ-L2-01", status: "Manueel", aiMotivatie: null } });
    }

    if (url.pathname.match(/^\/api\/themas\/[^/]+\/themadoelen\/[^/]+$/) && methode === "DELETE") {
      return new Response(null, { status: 204 });
    }

    const nieuwSubthema = url.pathname.match(/^\/api\/themas\/([^/]+)\/subthemas$/);
    if (nieuwSubthema && methode === "POST") {
      const invoer = JSON.parse(String(init?.body)) as {
        naam: string;
        duurWeken: number;
        klasId: string;
        leeftijd: string;
        probleemstelling?: string | null;
        onderzoeksvraag?: string | null;
      };
      teller += 1;
      const gemaakt: Subthema = {
        id: `nieuw-subthema-${teller}`,
        themaId: nieuwSubthema[1],
        naam: invoer.naam,
        duurWeken: invoer.duurWeken,
        klasId: invoer.klasId,
        leeftijd: invoer.leeftijd,
        probleemstelling: invoer.probleemstelling ?? null,
        onderzoeksvraag: invoer.onderzoeksvraag ?? null,
        subdoelen: [],
        activiteiten: [],
      };
      subthemaOpslag.push(gemaakt);
      return json(gemaakt);
    }

    const subthemaPad = url.pathname.match(/^\/api\/subthemas\/([^/]+)$/);
    if (subthemaPad) {
      const bestaand = subthemaOpslag.find((sub) => sub.id === subthemaPad[1]);
      if (!bestaand) return json({ detail: "onbekend subthema" }, 404);

      if (methode === "PUT") {
        Object.assign(bestaand, JSON.parse(String(init?.body)));
        return json(bestaand);
      }
      if (methode === "DELETE") {
        if (opties.subthemaAlWeg) {
          // Model what a 404 MEANS: it is gone server-side. Leaving it in the store would let a screen that
          // never refetches pass the test that says the row disappears (antagonist round 3).
          subthemaOpslag.splice(subthemaOpslag.indexOf(bestaand), 1);
          // **Deliberately pessimistic, and no longer what the server says.** The service was swept of
          // GUIDs in the same round; this fixture keeps the old shape so the screen cannot start relying on
          // the server's wording, and so the "no GUID reaches a teacher" assertion stays meaningful.
          return json({ title: "Niet gevonden", detail: `Subthema ${bestaand.id} bestaat niet.`, status: 404 }, 404);
        }
        subthemaOpslag.splice(subthemaOpslag.indexOf(bestaand), 1);
        return new Response(null, { status: 204 });
      }
    }

    const subdoelKoppel = url.pathname.match(/^\/api\/subthemas\/([^/]+)\/doelkoppelingen$/);
    if (subdoelKoppel && methode === "POST") {
      const sub = subthemaOpslag.find((kandidaat) => kandidaat.id === subdoelKoppel[1]);
      const { leerplandoelCode } = JSON.parse(String(init?.body)) as { leerplandoelCode: string };
      teller += 1;
      const subdoel = {
        id: `nieuw-subdoel-${teller}`,
        leeftijd: sub?.leeftijd ?? "",
        koppeling: {
          id: `nieuwe-koppeling-${teller}`,
          leerplandoelCode,
          status: "Manueel" as const,
          aiMotivatie: null,
        },
      };
      sub?.subdoelen.push(subdoel);
      return json(subdoel);
    }

    const subdoelWeg = url.pathname.match(/^\/api\/subthemas\/([^/]+)\/subdoelen\/([^/]+)$/);
    if (subdoelWeg && methode === "DELETE") {
      const sub = subthemaOpslag.find((kandidaat) => kandidaat.id === subdoelWeg[1]);
      if (sub) sub.subdoelen = sub.subdoelen.filter((doel) => doel.id !== subdoelWeg[2]);
      return new Response(null, { status: 204 });
    }

    // --- E4-08: the destinations of a move, scoped to one klas across every thema. ---
    const bestemmingen = url.pathname.match(/^\/api\/subthemas\/voor-klas\/([^/]+)$/);
    if (bestemmingen && methode === "GET") {
      if (opties.bestemmingenFaalt) {
        return json({ title: "Serverfout", status: 500 }, 500);
      }

      if (opties.bestemmingenHangt) {
        // Never settles, so the query stays `isPending` and the panel stays in its loading branch.
        return new Promise<Response>(() => {});
      }

      bestemmingenGeleverd += 1;
      if (opties.bestemmingenFaaltNaEerste && bestemmingenGeleverd > 1) {
        return json({ title: "Serverfout", status: 500 }, 500);
      }

      return json(
        subthemaOpslag
          .filter((sub) => sub.klasId === bestemmingen[1])
          .map((sub) => ({
            id: sub.id,
            naam: sub.naam,
            leeftijd: sub.leeftijd,
            themaId: sub.themaId,
            themaNaam: bibliotheek.find((thema) => thema.id === sub.themaId)?.naam ?? "",
          }))
          // The server orders by thema then subthema under the database collation; mirrored so a test can
          // assert the grouping order without depending on insertion order.
          .sort((a, b) => a.themaNaam.localeCompare(b.themaNaam) || a.naam.localeCompare(b.naam)),
      );
    }

    /*
      E4-08: the move itself, stateful for the reason `subthemaOpslag` exists. A canned 200 would let a missing
      invalidation pass, because both subthema's would render the same rows before and after.
    */
    const verplaats = url.pathname.match(/^\/api\/activiteiten\/([^/]+)\/subthema$/);
    if (verplaats && methode === "PUT") {
      if (opties.verplaatsActiviteitAlWeg) {
        return json({ title: "Niet gevonden", detail: "Deze activiteit bestaat niet meer.", status: 404 }, 404);
      }

      if (opties.verplaatsWeigering) {
        return json({ title: "Ongeldige aanvraag", detail: opties.verplaatsWeigering, status: 400 }, 400);
      }

      if (opties.verplaatsBestemmingVerdwijnt) {
        const { doelSubthemaId } = JSON.parse(String(init?.body)) as { doelSubthemaId: string };
        const weg = subthemaOpslag.findIndex((sub) => sub.id === doelSubthemaId);
        if (weg >= 0) subthemaOpslag.splice(weg, 1);
        return json(
          {
            title: "Ongeldige aanvraag",
            detail: "Dit subthema bestaat niet meer.",
            status: 400,
          },
          400,
        );
      }

      const { doelSubthemaId } = JSON.parse(String(init?.body)) as { doelSubthemaId: string };
      const bron = subthemaOpslag.find((sub) =>
        sub.activiteiten.some((kandidaat) => kandidaat.id === verplaats[1]),
      );
      const activiteit = bron?.activiteiten.find((kandidaat) => kandidaat.id === verplaats[1]);
      if (!bron || !activiteit) {
        // 404 is the activiteit itself, which is the only thing this status may mean (see `verplaatsActiviteit`).
        return json({ title: "Niet gevonden", detail: "onbekende activiteit", status: 404 }, 404);
      }

      const doel = subthemaOpslag.find((sub) => sub.id === doelSubthemaId);
      if (!doel) {
        return json(
          { title: "Ongeldige aanvraag", detail: "Dit subthema bestaat niet meer.", status: 400 },
          400,
        );
      }

      if (doel.klasId !== bron.klasId) {
        return json(
          {
            title: "Ongeldige aanvraag",
            detail: "Een activiteit kan alleen verhuizen naar een subthema van dezelfde klas.",
            status: 400,
          },
          400,
        );
      }

      bron.activiteiten = bron.activiteiten.filter((kandidaat) => kandidaat.id !== verplaats[1]);
      doel.activiteiten.push(activiteit);
      return json(activiteit);
    }

    const nieuweActiviteit = url.pathname.match(/^\/api\/subthemas\/([^/]+)\/activiteiten$/);
    if (nieuweActiviteit && methode === "POST") {
      const sub = subthemaOpslag.find((kandidaat) => kandidaat.id === nieuweActiviteit[1]);
      const invoer = JSON.parse(String(init?.body)) as {
        naam: string;
        activiteitType: Activiteit["activiteitType"];
        hoek?: string | null;
        verwachteUitkomsten?: string | null;
      };
      teller += 1;
      const gemaakt: Activiteit = {
        id: `nieuwe-activiteit-${teller}`,
        naam: invoer.naam,
        activiteitType: invoer.activiteitType,
        hoek: invoer.hoek ?? null,
        verwachteUitkomsten: invoer.verwachteUitkomsten ?? null,
        doelkoppelingen: [],
      };
      sub?.activiteiten.push(gemaakt);
      return json(gemaakt);
    }

    const activiteitPad = url.pathname.match(/^\/api\/activiteiten\/([^/]+)$/);
    if (activiteitPad) {
      const eigenaar = subthemaOpslag.find((sub) =>
        sub.activiteiten.some((kandidaat) => kandidaat.id === activiteitPad[1]),
      );
      const activiteit = eigenaar?.activiteiten.find((kandidaat) => kandidaat.id === activiteitPad[1]);
      if (!activiteit || !eigenaar) return json({ detail: "onbekende activiteit" }, 404);

      if (methode === "PUT") {
        Object.assign(activiteit, JSON.parse(String(init?.body)));
        return json(activiteit);
      }
      if (methode === "DELETE") {
        eigenaar.activiteiten = eigenaar.activiteiten.filter(
          (kandidaat) => kandidaat.id !== activiteitPad[1],
        );
        return new Response(null, { status: 204 });
      }
    }

    const activiteitKoppel = url.pathname.match(/^\/api\/activiteiten\/([^/]+)\/doelkoppelingen$/);
    if (activiteitKoppel && methode === "POST") {
      const activiteit = subthemaOpslag
        .flatMap((sub) => sub.activiteiten)
        .find((kandidaat) => kandidaat.id === activiteitKoppel[1]);
      const { leerplandoelCode } = JSON.parse(String(init?.body)) as { leerplandoelCode: string };
      teller += 1;
      const koppeling = {
        id: `nieuwe-koppeling-${teller}`,
        leerplandoelCode,
        status: "Manueel" as const,
        aiMotivatie: null,
      };
      activiteit?.doelkoppelingen.push(koppeling);
      return json(koppeling);
    }

    const activiteitOntkoppel = url.pathname.match(
      /^\/api\/activiteiten\/([^/]+)\/doelkoppelingen\/([^/]+)$/,
    );
    if (activiteitOntkoppel && methode === "DELETE") {
      const activiteit = subthemaOpslag
        .flatMap((sub) => sub.activiteiten)
        .find((kandidaat) => kandidaat.id === activiteitOntkoppel[1]);
      if (activiteit) {
        activiteit.doelkoppelingen = activiteit.doelkoppelingen.filter(
          (kandidaat) => kandidaat.id !== activiteitOntkoppel[2],
        );
      }
      return new Response(null, { status: 204 });
    }

    if (url.pathname.match(/^\/api\/themas\/[^/]+$/)) {
      if (methode === "PUT") {
        if (opties.themaWijzigAlWeg) {
          // The real 404 for this path, with the server's own sentence in it. No fixture modelled this, which
          // is exactly how round 4's finding 1 (an English sentence reaching a teacher) went unseen.
          return json(
            {
              title: "Niet gevonden",
              detail: "Dit thema bestaat niet meer. Iemand anders heeft het verwijderd.",
              status: 404,
            },
            404,
          );
        }
        const invoer = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return json({ ...bibliotheek[0], ...invoer, subthemas: [] });
      }

      if (methode === "DELETE") {
        if (opties.verwijderZonderReden) {
          // What a real unhandled 500 looks like: ProblemDetails with a title and status, and no detail.
          return json({ title: "An error occurred while processing your request.", status: 500 }, 500);
        }
        if (opties.verwijderAlWeg) {
          return json({ title: "Niet gevonden", detail: `Thema ${THEMA_HERFST} bestaat niet.`, status: 404 }, 404);
        }
        return opties.verwijderWeigering
          ? json({ title: "Ongeldige aanvraag", detail: opties.verwijderWeigering, status: 400 }, 400)
          : new Response(null, { status: 204 });
      }
    }

    return new Response("unexpected request", { status: 404 });
  };

  return { fetchFake, urls, verzoeken };
}
