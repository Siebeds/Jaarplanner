/**
 * The API as the mock mode answers it (TB-046): a table of routes over the in-memory state of `toestand.ts`.
 *
 * A route that is not in the table answers 501 with a ProblemDetails that names the method and the path, so a screen
 * never mistakes it for an empty list. Writes change the state and live until the page reloads.
 */
import type { ActiviteitInvoer, SubthemaInvoer, ThemaInvoer } from "../features/themas/mutaties";
import type { HoekInvoer, HoekverrijkingenInvoer } from "../features/hoeken/gegevens";
import type { Schooluren } from "../features/schooluren/gegevens";
import type {
  Dekkingsbereik,
  KoppelingStatus,
  LeerplandoelFacetten,
  LeerplandoelRegel,
  MinimumdoelFacetten,
  MinimumdoelRegel,
  SubthemaWeergave,
  ThemaWeergave,
  WoordwebWeergave,
} from "../lib/types";
import * as inhoud from "./inhoud";
import * as t from "./toestand";
import type { Toestand } from "./toestand";

export interface Antwoord {
  status: number;
  body?: unknown;
}

/** What a handler returns when the answer is not a 200 with a body. */
class Rauw implements Antwoord {
  readonly status: number;
  readonly body?: unknown;
  constructor(status: number, body?: unknown) {
    this.status = status;
    this.body = body;
  }
}

interface Verzoek {
  params: Record<string, string>;
  query: URLSearchParams;
  // The body is whatever the screen sent; each handler reads it as the type its screen sends.
  // oxlint-disable-next-line typescript/no-explicit-any
  body: any;
  s: Toestand;
}

type Handler = (v: Verzoek) => Antwoord | unknown;

export class Fout extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

function probleem(status: number, title: string, detail: string): Antwoord {
  return new Rauw(status, { type: "about:blank", title, status, detail });
}

const leeg = new Rauw(204);

function vind<T>(waarde: T | null | undefined, wat: string): T {
  if (waarde === null || waarde === undefined) throw new Fout(404, `${wat} bestaat niet in de mockmodus.`);
  return waarde;
}

/** Runs a jaarplan rule and answers its refusal as the server does: a 400 the teacher can read. */
function alsOngeldig<T>(regel: () => T): T {
  try {
    return regel();
  } catch (fout) {
    if (fout instanceof Fout) throw fout;
    throw new Fout(400, fout instanceof Error ? fout.message : String(fout));
  }
}

function klasVan(v: Verzoek) {
  return vind(
    v.s.klassen.find((k) => k.id === v.params.klasId),
    "Deze klas",
  );
}

/**
 * What of one subthema stands on the asked days (FB-096): its windows touching them, and its activiteiten on those days
 * widened to the windows, as `WeekplanningService.SelecteerSubthemaAsync` selects.
 */
function subthemaSelectie(v: Verzoek) {
  const subthemaId = v.query.get("subthemaId") ?? "";
  const vraagVan = v.query.get("van") ?? "";
  const vraagTot = v.query.get("tot") ?? "";
  const vensters = v.s.periodes.filter((p) => p.subthemaId === subthemaId && p.van <= vraagTot && p.tot >= vraagVan);
  const van = [vraagVan, ...vensters.map((p) => p.van)].reduce((a, b) => (a < b ? a : b));
  const tot = [vraagTot, ...vensters.map((p) => p.tot)].reduce((a, b) => (a > b ? a : b));
  const plaatsingen = v.s.dagplaatsingen.filter(
    (p) => p.datum >= van && p.datum <= tot && t.zoekActiviteit(v.s, p.activiteitId)?.subthema.id === subthemaId,
  );
  if (vensters.length === 0 && plaatsingen.length === 0) {
    throw new Fout(404, "Dit subthema staat op die dagen niet in de agenda.");
  }
  return { subthemaId, vensters, plaatsingen, van, tot };
}

function themaVan(v: Verzoek, id = v.params.themaId) {
  return vind(
    v.s.themas.find((th) => th.id === id),
    "Dit thema",
  );
}

function subthemaVan(v: Verzoek) {
  return vind(t.zoekSubthema(v.s, v.params.subthemaId), "Dit subthema");
}

function activiteitVan(v: Verzoek) {
  return vind(t.zoekActiviteit(v.s, v.params.activiteitId), "Deze activiteit");
}

function bereikVan(v: Verzoek): Dekkingsbereik {
  return v.query.get("bereik") === "HeelCurriculum" ? "HeelCurriculum" : "EigenJaarFase";
}

function eisLeerplandoel(code: string) {
  if (!t.bestaatLeerplandoel(code)) {
    throw new Fout(400, `Leerplandoel '${code}' staat niet bij de doelen van de mockmodus, dus er is niets gekoppeld.`);
  }
}

function eisLesdag(datum: string) {
  if (!t.isLesdag(datum)) throw new Fout(400, `Op ${datum} is er geen school.`);
}

/**
 * A stand-in for the weekvoorstel (FB-027): no AI in mock mode, so it picks the running subthema's activiteiten that are
 * not in the week yet, one per schooldag, on the first free 50 minutes between 8:30 and 12:00.
 */
function weekvoorstelMock(s: Toestand, datum: string) {
  const dag = new Date(`${datum}T00:00:00`);
  const maandag = new Date(dag);
  maandag.setDate(dag.getDate() - ((dag.getDay() + 6) % 7));
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dagen = [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(maandag);
    d.setDate(maandag.getDate() + i);
    return iso(d);
  }).filter(t.isLesdag);
  const periode = s.periodes.find((p) => dagen.some((d) => d >= p.van && d <= p.tot));
  const gevonden = periode ? t.zoekSubthema(s, periode.subthemaId) : null;
  if (!gevonden) {
    throw new Fout(400, "In deze week loopt geen subthema. Plan eerst een subthema in de agenda, dan kan de AI er activiteiten voor voorstellen.");
  }

  s.dagplaatsingen = s.dagplaatsingen.filter((p) => !(p.status === "Voorgesteld" && dagen.includes(p.datum)));
  const inWeek = new Set(s.dagplaatsingen.filter((p) => dagen.includes(p.datum)).map((p) => p.activiteitId));
  const kandidaten = gevonden.subthema.activiteiten.filter((a) => !inWeek.has(a.id)).slice(0, dagen.length);
  const pastNiet: string[] = [];
  const minuut = (tijd: string) => Number(tijd.slice(0, 2)) * 60 + Number(tijd.slice(3, 5));
  const tijd = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
  kandidaten.forEach((activiteit, i) => {
    const datumVan = dagen[i];
    const bezet = s.dagplaatsingen.filter((p) => p.datum === datumVan).map((p) => [minuut(p.begin), minuut(p.einde)]);
    let begin = 8 * 60 + 30;
    while (begin + 50 <= 12 * 60 && bezet.some(([b, e]) => b < begin + 50 && e > begin)) begin += 15;
    if (begin + 50 > 12 * 60) {
      pastNiet.push(activiteit.naam);
      return;
    }
    s.dagplaatsingen.push({
      id: t.nieuwId(),
      activiteitId: activiteit.id,
      datum: datumVan,
      begin: tijd(begin),
      einde: tijd(begin + 50),
      status: "Voorgesteld",
      aiMotivatie: "Past goed bij het begin van deze dag.",
    });
  });
  return { aantalVoorgesteld: kandidaten.length - pastNiet.length, pastNiet, aantalOvergeslagen: 0 };
}

function nieuweKoppeling(code: string) {
  return { id: t.nieuwId(), leerplandoelCode: code, status: "Manueel" as const, aiMotivatie: null };
}

// --- Filters ---------------------------------------------------------------------------------------------------------

function paginaVan<T>(v: Verzoek, regels: T[]) {
  const overslaan = Number(v.query.get("overslaan") ?? 0);
  const aantal = Number(v.query.get("aantal") ?? 50);
  return { regels: regels.slice(overslaan, overslaan + aantal), totaal: regels.length, overslaan, aantal };
}

function bevat(tekst: string, zoek: string | null): boolean {
  return !zoek || tekst.toLowerCase().includes(zoek.toLowerCase());
}

function gefilterdeLeerplandoelen(v: Verzoek, zonder: "doelsoort" | "jaarFase" | "discipline" | null = null) {
  const q = v.query;
  const jaarFasen = q.getAll("jaarFase");
  return t.alleLeerplandoelen().filter(
    (d) =>
      bevat(`${d.code} ${d.tekst}`, q.get("zoek")) &&
      (zonder === "discipline" || !q.get("discipline") || t.disciplineVan(d.code) === q.get("discipline")) &&
      (!q.get("domein") || d.domein === q.get("domein")) &&
      (!q.get("subdomein") || d.subdomein === q.get("subdomein")) &&
      (zonder === "doelsoort" || !q.get("doelsoort") || d.doelsoort === q.get("doelsoort")) &&
      (zonder === "jaarFase" || jaarFasen.length === 0 || jaarFasen.includes(d.jaarFase)),
  );
}

function tel<T>(lijst: T[], sleutel: (x: T) => string): Map<string, number> {
  const tellingen = new Map<string, number>();
  for (const x of lijst) tellingen.set(sleutel(x), (tellingen.get(sleutel(x)) ?? 0) + 1);
  return tellingen;
}

function leerplandoelFacetten(v: Verzoek): LeerplandoelFacetten {
  const doelen = gefilterdeLeerplandoelen(v);
  const domeinen = new Map<string, LeerplandoelRegel[]>();
  for (const d of doelen) domeinen.set(d.domein, [...(domeinen.get(d.domein) ?? []), d]);
  return {
    totaalAantalDoelen: t.alleLeerplandoelen().length,
    disciplines: [...tel(gefilterdeLeerplandoelen(v, "discipline"), (d) => t.disciplineVan(d.code))].map(([nummer, aantal]) => ({
      nummer,
      naam: inhoud.DISCIPLINES[nummer] ?? null,
      aantal,
    })),
    domeinen: [...domeinen].map(([domein, lijst]) => ({
      domein,
      aantal: lijst.length,
      subdomeinen: [...tel(lijst, (d) => d.subdomein)].map(([subdomein, aantal]) => ({ subdomein, aantal })),
    })),
    doelsoorten: [...tel(gefilterdeLeerplandoelen(v, "doelsoort"), (d) => d.doelsoort)].map(([doelsoort, aantal]) => ({
      doelsoort: doelsoort as LeerplandoelRegel["doelsoort"],
      aantal,
    })),
    jaarFasen: [...tel(gefilterdeLeerplandoelen(v, "jaarFase"), (d) => d.jaarFase)].map(([jaarFase, aantal]) => ({
      jaarFase,
      aantal,
    })),
  };
}

function gefilterdeMinimumdoelen(v: Verzoek, metTak: boolean, metLeeftijd = true): MinimumdoelRegel[] {
  const q = v.query;
  const doelen = gefilterdeLeerplandoelen(v);
  const viaDoelen = q.get("discipline") || q.get("domein") || q.get("subdomein") || q.get("jaarFase");
  return t.alleMinimumdoelen().filter(
    (m) =>
      bevat(`${m.ref} ${m.omschrijving}`, q.get("zoek")) &&
      (!metLeeftijd || !q.get("leeftijd") || m.leeftijd === q.get("leeftijd")) &&
      (!viaDoelen || doelen.some((d) => d.minimumdoelRef === m.ref)) &&
      (!metTak ||
        ((!q.get("leergebied") || m.leergebied === q.get("leergebied")) &&
          (!q.get("rubriek") || m.rubriek === q.get("rubriek")) &&
          (!q.get("subrubriek") || m.subrubriek === q.get("subrubriek")) &&
          (q.get("zonderSubrubriek") !== "true" || m.subrubriek === null) &&
          (q.get("zonderOrdening") !== "true" || m.leergebied === null))),
  );
}

function minimumdoelFacetten(v: Verzoek): MinimumdoelFacetten {
  const treffers = gefilterdeMinimumdoelen(v, false);
  const leergebieden = new Map<string, MinimumdoelRegel[]>();
  for (const m of treffers) {
    if (m.leergebied) leergebieden.set(m.leergebied, [...(leergebieden.get(m.leergebied) ?? []), m]);
  }
  return {
    totaalAantalMinimumdoelen: t.alleMinimumdoelen().length,
    aantalTreffers: treffers.length,
    aantalZonderOrdening: treffers.filter((m) => m.leergebied === null).length,
    leergebieden: [...leergebieden].map(([naam, lijst]) => {
      const rubrieken = new Map<string, MinimumdoelRegel[]>();
      for (const m of lijst) rubrieken.set(m.rubriek ?? "", [...(rubrieken.get(m.rubriek ?? "") ?? []), m]);
      return {
        naam,
        aantal: lijst.length,
        rubrieken: [...rubrieken].map(([rubriek, inRubriek]) => ({
          naam: rubriek,
          aantal: inRubriek.length,
          aantalZonderSubrubriek: inRubriek.filter((m) => m.subrubriek === null).length,
          subrubrieken: [...tel(inRubriek.filter((m) => m.subrubriek !== null), (m) => m.subrubriek!)].map(
            ([sub, aantal]) => ({ naam: sub, aantal }),
          ),
        })),
      };
    }),
    leeftijden: [...tel(gefilterdeMinimumdoelen(v, true, false), (m) => m.leeftijd)].map(([leeftijd, aantal]) => ({
      leeftijd,
      aantal,
    })),
  };
}

// --- Writes on schoolcontent -----------------------------------------------------------------------------------------

function maakThema(invoer: ThemaInvoer): ThemaWeergave {
  return {
    id: t.nieuwId(),
    naam: invoer.naam,
    duurWeken: invoer.duurWeken,
    invalshoeken: invoer.invalshoeken,
    kernwoordenschat: invoer.kernwoordenschat,
    rijkeWoordenschat: invoer.rijkeWoordenschat,
    heeftVoldoendeThemadoelen: false,
    themadoelen: [],
    minimumdoelen: [],
    subthemas: [],
    leeftijden: invoer.leeftijden,
  };
}

function schrijfSubthema(doel: SubthemaWeergave, invoer: SubthemaInvoer) {
  doel.naam = invoer.naam;
  doel.duurWeken = invoer.duurWeken;
  doel.leeftijd = invoer.leeftijd;
  doel.onderzoeksvragen = invoer.onderzoeksvragen.map((vraag, i) => ({
    id: doel.onderzoeksvragen[i]?.id ?? t.nieuwId(),
    vraag: vraag.vraag,
    probleemstelling: vraag.probleemstelling,
  }));
}

function schrijfActiviteit(
  doel: SubthemaWeergave["activiteiten"][number],
  invoer: ActiviteitInvoer,
) {
  doel.naam = invoer.naam;
  doel.activiteitType = invoer.activiteitType;
  doel.hoek = invoer.hoek;
  doel.verwachteUitkomsten = invoer.verwachteUitkomsten;
  doel.onderzoeksvraagId = invoer.onderzoeksvraagId;
  doel.kleur = invoer.kleur;
  doel.lengteInLesuren = invoer.lengteInLesuren;
}

function woordwebVoor(v: Verzoek, subthemaId: string): WoordwebWeergave {
  let web = v.s.woordwebs.find((w) => w.subthemaId === subthemaId && w.isEigen);
  if (!web) {
    web = {
      id: t.nieuwId(),
      subthemaId,
      eigenaarId: inhoud.GEBRUIKER.id,
      eigenaarNaam: inhoud.GEBRUIKER.naam,
      isEigen: true,
      woorden: [],
    };
    v.s.woordwebs.push(web);
  }
  return web;
}

function woordwebVan(v: Verzoek) {
  return vind(
    v.s.woordwebs.find((w) => w.id === v.params.woordwebId),
    "Dit woordweb",
  );
}

// --- The table -------------------------------------------------------------------------------------------------------

type Methode = "GET" | "POST" | "PUT" | "DELETE";

const TABEL: [Methode, string, Handler][] = [
  // Session and reference data
  ["GET", "/api/ik", () => t.ik()],
  ["POST", "/api/afmelden", () => ({ doorsturenNaar: "/afgemeld" })],
  ["GET", "/api/jaarfasen", () => inhoud.JAARFASEN],
  [
    "GET",
    "/api/schooljaren",
    () => [{ id: inhoud.SCHOOLJAAR.id, naam: inhoud.SCHOOLJAAR.naam, start: inhoud.SCHOOLJAAR.start, eind: inhoud.SCHOOLJAAR.eind }],
  ],
  ["GET", "/api/schooljaren/:schooljaarId/rooster", () => t.rooster()],
  ["GET", "/api/opstap-import/stand", () => ({ aantalMinimumdoelen: inhoud.MINIMUMDOELEN.length, laatsteVersie: null })],
  [
    "GET",
    "/api/gebruikers",
    () => ({
      gebruikers: [
        {
          ...inhoud.GEBRUIKER,
          isAdmin: true,
          heeftThemabeheer: true,
          heeftLeerlingzorg: false,
          isAangemeld: true,
          klastoewijzingen: [],
          hoofdleerkrachtaanstellingen: [],
        },
      ],
      voorbijeSchooljaarIds: [],
    }),
  ],
  ["GET", "/api/schooluren", ({ s }) => s.schooluren],
  // Chuck (FB-071). His posture is set before the page loads (start.ts), so each can be looked at without a job.
  ["GET", "/api/kat/instelling", ({ s }) => ({ isZichtbaar: s.kat.isZichtbaar })],
  [
    "PUT",
    "/api/kat/instelling",
    ({ s, body }) => {
      s.kat.isZichtbaar = Boolean((body as { isZichtbaar?: boolean }).isZichtbaar);
      return { isZichtbaar: s.kat.isZichtbaar };
    },
  ],
  ["GET", "/api/deurmat", ({ s }) => s.kat.deurmat],
  ["POST", "/api/deurmat/signalen/:id/gezien", () => new Rauw(204)],
  [
    "POST",
    "/api/deurmat/signalen/:id/later",
    ({ s, params }) => {
      s.kat.deurmat = { ...s.kat.deurmat, signalen: s.kat.deurmat.signalen.filter((x) => x.id !== params.id) };
      return new Rauw(204);
    },
  ],
  [
    "PUT",
    "/api/activiteitvoorstellen/:id/beslissing",
    ({ s, params, body }) => {
      s.kat.deurmat = { ...s.kat.deurmat, voorstellen: s.kat.deurmat.voorstellen.filter((x) => x.id !== params.id) };
      return { status: (body as { status: string }).status, activiteitId: null };
    },
  ],
  [
    "PUT",
    "/api/schooluren",
    ({ s, body }) => {
      s.schooluren = body as Schooluren;
      return s.schooluren;
    },
  ],

  // Klassen
  ["GET", "/api/klassen", ({ s }) => s.klassen.map((k) => t.klasWeergave(s, k))],
  ["GET", "/api/rapportklassen", () => []],
  [
    "POST",
    "/api/schooljaren/:schooljaarId/klassen",
    ({ s, body }) => {
      const klas = { id: t.nieuwId(), naam: body.naam as string, jaarfase: (body.jaarfase as string | null) ?? "K3" };
      s.klassen.push(klas);
      return t.klasWeergave(s, klas);
    },
  ],
  [
    "PUT",
    "/api/klassen/:klasId",
    (v) => {
      const klas = klasVan(v);
      klas.naam = v.body.naam;
      if (v.body.jaarfase) klas.jaarfase = v.body.jaarfase;
      return t.klasWeergave(v.s, klas);
    },
  ],
  [
    "DELETE",
    "/api/klassen/:klasId",
    (v) => {
      v.s.klassen = v.s.klassen.filter((k) => k.id !== klasVan(v).id);
      return leeg;
    },
  ],

  // Curriculum
  ["GET", "/api/leerplandoelen/facetten", (v) => leerplandoelFacetten(v)],
  ["GET", "/api/leerplandoelen", (v) => paginaVan(v, gefilterdeLeerplandoelen(v))],
  ["GET", "/api/leerplandoelen/:code", (v) => vind(t.leerplandoelDetail(v.s, v.params.code), "Dit leerplandoel")],
  ["GET", "/api/minimumdoelen/facetten", (v) => minimumdoelFacetten(v)],
  ["GET", "/api/minimumdoelen", (v) => paginaVan(v, gefilterdeMinimumdoelen(v, true))],
  ["GET", "/api/minimumdoelen/:ref", (v) => vind(t.minimumdoelDetail(v.params.ref), "Dit minimumdoel")],

  // Thema's
  [
    "GET",
    "/api/themas/bibliotheek",
    ({ s, query }) => {
      // With a klas, only the thema's meant for its leeftijd (FB-012), as the server filters.
      const klas = s.klassen.find((k) => k.id === query.get("klasId"));
      return t.bibliotheek(s).filter((thema) => !klas || thema.leeftijden.includes(klas.jaarfase));
    },
  ],
  [
    "POST",
    "/api/themas",
    ({ s, body }) => {
      const thema = maakThema(body as ThemaInvoer);
      s.themas.push(thema);
      return t.themaWeergave(thema);
    },
  ],
  ["GET", "/api/themas/:themaId", (v) => t.themaWeergave(themaVan(v))],
  [
    "PUT",
    "/api/themas/:themaId",
    (v) => {
      const thema = themaVan(v);
      const { naam, duurWeken, invalshoeken, kernwoordenschat, rijkeWoordenschat, leeftijden } = v.body as ThemaInvoer;
      Object.assign(thema, { naam, duurWeken, invalshoeken, kernwoordenschat, rijkeWoordenschat, leeftijden });
      return t.themaWeergave(thema);
    },
  ],
  [
    "DELETE",
    "/api/themas/:themaId",
    (v) => {
      const thema = themaVan(v);
      const activiteiten = new Set(thema.subthemas.flatMap((sub) => sub.activiteiten.map((a) => a.id)));
      v.s.themas = v.s.themas.filter((th) => th.id !== thema.id);
      v.s.plaatsingen = v.s.plaatsingen.filter((p) => p.themaId !== thema.id);
      v.s.dagplaatsingen = v.s.dagplaatsingen.filter((p) => !activiteiten.has(p.activiteitId));
      v.s.periodes = v.s.periodes.filter((p) => !thema.subthemas.some((sub) => sub.id === p.subthemaId));
      return leeg;
    },
  ],
  ["GET", "/api/themas/:themaId/doelenoverzicht", (v) => t.doelenoverzicht(themaVan(v))],
  ["GET", "/api/themas/:themaId/doelsuggesties", (v) => {
      themaVan(v);
      return [];
    }],
  [
    "GET",
    "/api/themas/:themaId/voor-klas/:klasId",
    (v) => t.themaVoorKlas(themaVan(v), klasVan(v).jaarfase),
  ],
  [
    "POST",
    "/api/themas/:themaId/minimumdoelen",
    (v) => {
      const thema = themaVan(v);
      const ref = String(v.body.minimumdoelRef ?? "").trim();
      if (!t.bestaatMinimumdoel(ref)) {
        throw new Fout(400, `Minimumdoel '${ref}' staat niet bij de doelen van de mockmodus, dus er is niets gekoppeld.`);
      }
      if (thema.minimumdoelen.some((m) => m.minimumdoelRef === ref)) {
        throw new Fout(400, `Minimumdoel ${ref} is al een themadoel van dit thema.`);
      }
      const koppeling = { id: t.nieuwId(), minimumdoelRef: ref };
      thema.minimumdoelen.push(koppeling);
      return koppeling;
    },
  ],
  [
    "DELETE",
    "/api/themas/:themaId/minimumdoelen/:koppelingId",
    (v) => {
      const thema = themaVan(v);
      thema.minimumdoelen = thema.minimumdoelen.filter((m) => m.id !== v.params.koppelingId);
      return leeg;
    },
  ],

  // Subthema's
  ["GET", "/api/subthemas/voor-klas/:klasId", (v) => t.bestemmingen(v.s, klasVan(v).jaarfase)],
  [
    "POST",
    "/api/themas/:themaId/subthemas",
    (v) => {
      const thema = themaVan(v);
      const subthema: SubthemaWeergave = {
        id: t.nieuwId(),
        themaId: thema.id,
        naam: "",
        duurWeken: 1,
        leeftijd: "",
        onderzoeksvragen: [],
        subdoelen: [],
        activiteiten: [],
      };
      schrijfSubthema(subthema, v.body as SubthemaInvoer);
      thema.subthemas.push(subthema);
      return subthema;
    },
  ],
  [
    "PUT",
    "/api/subthemas/:subthemaId",
    (v) => {
      const { subthema } = subthemaVan(v);
      schrijfSubthema(subthema, v.body as SubthemaInvoer);
      return subthema;
    },
  ],
  [
    "DELETE",
    "/api/subthemas/:subthemaId",
    (v) => {
      const { thema, subthema } = subthemaVan(v);
      const activiteiten = new Set(subthema.activiteiten.map((a) => a.id));
      thema.subthemas = thema.subthemas.filter((s) => s.id !== subthema.id);
      v.s.dagplaatsingen = v.s.dagplaatsingen.filter((p) => !activiteiten.has(p.activiteitId));
      v.s.periodes = v.s.periodes.filter((p) => p.subthemaId !== subthema.id);
      return leeg;
    },
  ],
  [
    "POST",
    "/api/subthemas/:subthemaId/doelkoppelingen",
    (v) => {
      const { subthema } = subthemaVan(v);
      const code = String(v.body.leerplandoelCode ?? "");
      eisLeerplandoel(code);
      if (subthema.subdoelen.some((sd) => sd.koppeling.leerplandoelCode === code)) {
        throw new Fout(400, `Leerplandoel ${code} is al een subdoel van dit subthema.`);
      }
      const subdoel = { id: t.nieuwId(), leeftijd: subthema.leeftijd, koppeling: nieuweKoppeling(code) };
      subthema.subdoelen.push(subdoel);
      return subdoel;
    },
  ],
  [
    "DELETE",
    "/api/subthemas/:subthemaId/subdoelen/:subdoelId",
    (v) => {
      const { subthema } = subthemaVan(v);
      subthema.subdoelen = subthema.subdoelen.filter((sd) => sd.id !== v.params.subdoelId);
      return leeg;
    },
  ],
  [
    "GET",
    "/api/subthemas/:subthemaId/hoekverrijkingen/aantal",
    (v) => {
      const { subthema } = subthemaVan(v);
      const periodes = v.s.periodes.filter((p) => p.subthemaId === subthema.id);
      return { aantal: periodes.reduce((som, p) => som + Object.keys(v.s.verrijkingen[p.id] ?? {}).length, 0) };
    },
  ],

  // Activiteiten
  [
    "POST",
    "/api/subthemas/:subthemaId/activiteiten",
    (v) => {
      const { subthema } = subthemaVan(v);
      const invoer = v.body as ActiviteitInvoer;
      const codes = invoer.leerplandoelCodes ?? [];
      codes.forEach(eisLeerplandoel);
      const activiteit: SubthemaWeergave["activiteiten"][number] = {
        id: t.nieuwId(),
        naam: "",
        activiteitType: null,
        hoek: null,
        verwachteUitkomsten: null,
        onderzoeksvraagId: null,
        kleur: null,
        lengteInLesuren: 1,
        doelkoppelingen: codes.map(nieuweKoppeling),
        makerId: inhoud.GEBRUIKER.id,
      };
      schrijfActiviteit(activiteit, invoer);
      subthema.activiteiten.push(activiteit);
      return activiteit;
    },
  ],
  [
    "PUT",
    "/api/activiteiten/:activiteitId",
    (v) => {
      const { activiteit } = activiteitVan(v);
      schrijfActiviteit(activiteit, v.body as ActiviteitInvoer);
      return activiteit;
    },
  ],
  [
    "DELETE",
    "/api/activiteiten/:activiteitId",
    (v) => {
      const { subthema, activiteit } = activiteitVan(v);
      subthema.activiteiten = subthema.activiteiten.filter((a) => a.id !== activiteit.id);
      v.s.dagplaatsingen = v.s.dagplaatsingen.filter((p) => p.activiteitId !== activiteit.id);
      return leeg;
    },
  ],
  [
    "PUT",
    "/api/activiteiten/:activiteitId/subthema",
    (v) => {
      const { subthema, activiteit } = activiteitVan(v);
      const doel = vind(t.zoekSubthema(v.s, String(v.body.doelSubthemaId)), "Dat subthema");
      subthema.activiteiten = subthema.activiteiten.filter((a) => a.id !== activiteit.id);
      doel.subthema.activiteiten.push(activiteit);
      return activiteit;
    },
  ],
  [
    "POST",
    "/api/activiteiten/:activiteitId/doelkoppelingen",
    (v) => {
      const { activiteit } = activiteitVan(v);
      const code = String(v.body.leerplandoelCode ?? "");
      eisLeerplandoel(code);
      if (activiteit.doelkoppelingen.some((k) => k.leerplandoelCode === code)) {
        throw new Fout(400, `Leerplandoel ${code} is al gekoppeld aan deze activiteit.`);
      }
      const koppeling = nieuweKoppeling(code);
      activiteit.doelkoppelingen.push(koppeling);
      return koppeling;
    },
  ],
  [
    "DELETE",
    "/api/activiteiten/:activiteitId/doelkoppelingen/:koppelingId",
    (v) => {
      const { activiteit } = activiteitVan(v);
      activiteit.doelkoppelingen = activiteit.doelkoppelingen.filter((k) => k.id !== v.params.koppelingId);
      return leeg;
    },
  ],

  // Woordwebs
  [
    "GET",
    "/api/subthemas/:subthemaId/woordwebs",
    (v) => v.s.woordwebs.filter((w) => w.subthemaId === subthemaVan(v).subthema.id),
  ],
  [
    "POST",
    "/api/subthemas/:subthemaId/woordwebs/eigen/woorden",
    (v) => {
      const web = woordwebVoor(v, subthemaVan(v).subthema.id);
      for (const woord of v.body.woorden as string[]) {
        web.woorden.push({ id: t.nieuwId(), woord, status: "Manueel", aiMotivatie: null });
      }
      return web;
    },
  ],
  [
    "POST",
    "/api/woordwebs/:woordwebId/woorden",
    (v) => {
      const web = woordwebVan(v);
      for (const woord of v.body.woorden as string[]) {
        web.woorden.push({ id: t.nieuwId(), woord, status: "Manueel", aiMotivatie: null });
      }
      return web;
    },
  ],
  [
    "DELETE",
    "/api/woordwebs/:woordwebId/woorden/:woordId",
    (v) => {
      const web = woordwebVan(v);
      web.woorden = web.woorden.filter((w) => w.id !== v.params.woordId);
      return web;
    },
  ],
  [
    "PUT",
    "/api/woordwebs/:woordwebId/woorden/:woordId/status",
    (v) => {
      const web = woordwebVan(v);
      const woord = vind(
        web.woorden.find((w) => w.id === v.params.woordId),
        "Dit woord",
      );
      woord.status = v.body.status as KoppelingStatus;
      return web;
    },
  ],

  // Jaarplan
  ["GET", "/api/klassen/:klasId/jaarplan", (v) => t.jaarplan(v.s, klasVan(v))],
  [
    "GET",
    "/api/klassen/:klasId/jaarplan/voorstel",
    (v) => {
      klasVan(v);
      const thema = themaVan(v, v.query.get("themaId") ?? "");
      return alsOngeldig(() => t.eindvoorstel(v.s, thema, v.query.get("van") ?? ""));
    },
  ],
  [
    "POST",
    "/api/klassen/:klasId/jaarplan/plaatsingen",
    (v) => {
      const klas = klasVan(v);
      const thema = themaVan(v, String(v.body.themaId));
      alsOngeldig(() => t.plaats(v.s, thema.id, String(v.body.van), String(v.body.tot), "Manueel"));
      return t.jaarplan(v.s, klas);
    },
  ],
  ...(["status", "datums", "verschuiving"] as const).map(
    (actie): [Methode, string, Handler] => [
      "PUT",
      `/api/klassen/:klasId/jaarplan/plaatsingen/:plaatsingId/${actie}`,
      (v) => {
        const klas = klasVan(v);
        const plaatsing = vind(
          v.s.plaatsingen.find((p) => p.id === v.params.plaatsingId),
          "Deze plaatsing",
        );
        if (actie === "status") {
          const status = v.body.status as KoppelingStatus;
          if (status !== "Aanvaard" && status !== "Manueel") {
            throw new Fout(400, "Een voorstel weigeren doe je door het te verwijderen.");
          }
          plaatsing.status = status;
        }
        if (actie === "datums") {
          alsOngeldig(() =>
            t.plaats(v.s, plaatsing.themaId, String(v.body.van), String(v.body.tot), "Manueel", [plaatsing.id]),
          );
        }
        if (actie === "verschuiving") alsOngeldig(() => t.verschuif(v.s, plaatsing, String(v.body.van)));
        return t.jaarplan(v.s, klas);
      },
    ],
  ),
  [
    "DELETE",
    "/api/klassen/:klasId/jaarplan/plaatsingen/:plaatsingId",
    (v) => {
      klasVan(v);
      v.s.plaatsingen = v.s.plaatsingen.filter((p) => p.id !== v.params.plaatsingId);
      return leeg;
    },
  ],

  // Weekplanning
  [
    "GET",
    "/api/klassen/:klasId/jaarplan/weekplanning",
    (v) => t.weekplanning(v.s, klasVan(v), v.query.get("van") ?? "", v.query.get("tot") ?? ""),
  ],
  [
    "POST",
    "/api/klassen/:klasId/jaarplan/weekplanning",
    (v) => {
      const klas = klasVan(v);
      const { activiteitId, datum, begin, einde } = v.body as Record<string, string>;
      vind(t.zoekActiviteit(v.s, activiteitId), "Deze activiteit");
      eisLesdag(datum);
      v.s.dagplaatsingen.push({ id: t.nieuwId(), activiteitId, datum, begin, einde });
      return t.weekplanning(v.s, klas, datum, datum);
    },
  ],
  [
    "PUT",
    "/api/klassen/:klasId/jaarplan/weekplanning/:plaatsingId/dag",
    (v) => {
      const klas = klasVan(v);
      const plaatsing = vind(
        v.s.dagplaatsingen.find((p) => p.id === v.params.plaatsingId),
        "Deze plaatsing",
      );
      const { datum, begin, einde } = v.body as Record<string, string>;
      eisLesdag(datum);
      // A proposal she moves becomes hers (ADR-0067 W4), as on the server.
      Object.assign(plaatsing, { datum, begin, einde }, plaatsing.status === "Voorgesteld" ? { status: undefined, aiMotivatie: undefined } : {});
      return t.weekplanning(v.s, klas, datum, datum);
    },
  ],
  [
    "POST",
    "/api/klassen/:klasId/jaarplan/weekvoorstel",
    (v) => {
      klasVan(v);
      const { datum } = v.body as Record<string, string>;
      return weekvoorstelMock(v.s, datum);
    },
  ],
  [
    "PUT",
    "/api/klassen/:klasId/jaarplan/weekplanning/:plaatsingId/beslissing",
    (v) => {
      const klas = klasVan(v);
      const plaatsing = vind(v.s.dagplaatsingen.find((p) => p.id === v.params.plaatsingId), "Deze plaatsing");
      if (plaatsing.status !== "Voorgesteld") {
        throw new Fout(400, "Over dit voorstel is al beslist. Vernieuw de pagina om te zien wat er nu staat.");
      }
      const { aanvaard } = v.body as { aanvaard: boolean };
      if (aanvaard) plaatsing.status = "Aanvaard";
      else v.s.dagplaatsingen = v.s.dagplaatsingen.filter((p) => p.id !== plaatsing.id);
      return t.weekplanning(v.s, klas, plaatsing.datum, plaatsing.datum);
    },
  ],
  [
    "POST",
    "/api/klassen/:klasId/jaarplan/weekvoorstel/aanvaard",
    (v) => {
      const klas = klasVan(v);
      const { van, tot } = v.body as Record<string, string>;
      for (const p of v.s.dagplaatsingen) {
        if (p.status === "Voorgesteld" && p.datum >= van && p.datum <= tot) p.status = "Aanvaard";
      }
      return t.weekplanning(v.s, klas, van, tot);
    },
  ],
  [
    "DELETE",
    "/api/klassen/:klasId/jaarplan/weekplanning/:plaatsingId",
    (v) => {
      klasVan(v);
      v.s.dagplaatsingen = v.s.dagplaatsingen.filter((p) => p.id !== v.params.plaatsingId);
      return leeg;
    },
  ],
  [
    "POST",
    "/api/klassen/:klasId/jaarplan/subthemaperiodes",
    (v) => {
      const klas = klasVan(v);
      const { subthemaId, van, tot } = v.body as Record<string, string>;
      vind(t.zoekSubthema(v.s, subthemaId), "Dit subthema");
      v.s.periodes.push({ id: t.nieuwId(), subthemaId, van, tot });
      return t.weekplanning(v.s, klas, van, tot);
    },
  ],
  // FB-096: the same selection for the count and the delete, as the server's.
  [
    "GET",
    "/api/klassen/:klasId/jaarplan/subthemaperiodes/weghaling",
    (v) => {
      klasVan(v);
      const s = subthemaSelectie(v);
      return {
        aantalActiviteiten: s.plaatsingen.length,
        aantalHoekverrijkingen: s.vensters.reduce((som, p) => som + Object.keys(v.s.verrijkingen[p.id] ?? {}).length, 0),
        heeftPeriode: s.vensters.length > 0,
        blijftElders: v.s.periodes.some((p) => p.subthemaId === s.subthemaId && !s.vensters.includes(p)),
      };
    },
  ],
  [
    "DELETE",
    "/api/klassen/:klasId/jaarplan/subthemaperiodes",
    (v) => {
      const klas = klasVan(v);
      const s = subthemaSelectie(v);
      for (const p of s.vensters) delete v.s.verrijkingen[p.id];
      v.s.periodes = v.s.periodes.filter((p) => !s.vensters.includes(p));
      v.s.dagplaatsingen = v.s.dagplaatsingen.filter((p) => !s.plaatsingen.includes(p));
      return t.weekplanning(v.s, klas, s.van, s.tot);
    },
  ],

  // Dekking
  ["GET", "/api/klassen/:klasId/dekking", (v) => t.dekking(v.s, klasVan(v), bereikVan(v))],
  [
    "GET",
    "/api/klassen/:klasId/dekking/voortgang",
    (v) => {
      const voortgang = t.dekkingsvoortgang(v.s, klasVan(v), bereikVan(v));
      // A purring Chuck needs every minimumdoel gedekt or in the prognose, which the mock plan never reaches by itself.
      if (v.s.kat.houding !== "spint" || voortgang.aantalMinimumdoelenGedekt === null) return voortgang;
      return { ...voortgang, aantalMinimumdoelenInPrognose: voortgang.aantalMinimumdoelen - voortgang.aantalMinimumdoelenGedekt };
    },
  ],

  // Hoeken
  ["GET", "/api/klassen/:klasId/hoeken", (v) => t.hoeken(v.s, klasVan(v).id)],
  [
    "POST",
    "/api/klassen/:klasId/hoeken",
    (v) => {
      const klas = klasVan(v);
      const invoer = v.body as HoekInvoer;
      v.s.hoeken.push({ id: t.nieuwId(), naam: invoer.naam, omschrijving: invoer.omschrijving });
      return t.hoeken(v.s, klas.id).at(-1);
    },
  ],
  [
    "PUT",
    "/api/hoeken/:hoekId",
    (v) => {
      const hoek = vind(
        v.s.hoeken.find((h) => h.id === v.params.hoekId),
        "Deze hoek",
      );
      Object.assign(hoek, v.body as HoekInvoer);
      return t.hoeken(v.s, inhoud.KLAS.id).find((h) => h.id === hoek.id);
    },
  ],
  [
    "DELETE",
    "/api/hoeken/:hoekId",
    (v) => {
      v.s.hoeken = v.s.hoeken.filter((h) => h.id !== v.params.hoekId);
      return leeg;
    },
  ],
  [
    "GET",
    "/api/klassen/:klasId/hoekverrijkingen",
    (v) => {
      klasVan(v);
      return t.hoekverrijkingen(v.s, v.query.get("van") ?? "", v.query.get("tot") ?? "");
    },
  ],
  [
    "PUT",
    "/api/klassen/:klasId/hoekverrijkingen",
    (v) => {
      klasVan(v);
      const invoer = v.body as HoekverrijkingenInvoer;
      let periodeId = invoer.subthemaperiodeId;
      if (periodeId === null && "subthemaId" in invoer) {
        periodeId = t.nieuwId();
        v.s.periodes.push({ id: periodeId, subthemaId: invoer.subthemaId, van: invoer.van, tot: invoer.tot });
      }
      const periode = vind(
        v.s.periodes.find((p) => p.id === periodeId),
        "Deze subthemaperiode",
      );
      const perHoek = { ...v.s.verrijkingen[periode.id] };
      for (const { hoekId, tekst } of invoer.verrijkingen) {
        if (tekst.trim() === "") delete perHoek[hoekId];
        else perHoek[hoekId] = { id: perHoek[hoekId]?.id ?? t.nieuwId(), tekst };
      }
      v.s.verrijkingen[periode.id] = perHoek;
      return t.hoekverrijkingen(v.s, periode.van, periode.tot).find((p) => p.subthemaperiodeId === periode.id);
    },
  ],

  // Algemene fiches
  ["GET", "/api/klassen/:klasId/algemene-fiches", (v) => t.algemeneFiches(v.s, klasVan(v).id)],
  ["GET", "/api/klassen/:klasId/algemene-ficheplaatsingen", (v) => {
      klasVan(v);
      return t.ficheplaatsingen();
    }],

  // The ontwikkelingsrapport is out of the mock mode's scope: no klas holds children, so its lists are empty.
  ["GET", "/api/gradaties", () => []],
  ["GET", "/api/gradaties/kleuren", () => ["Groen", "Lichtgroen", "Geel", "Oranje", "Rood", "Blauw"]],
  ["GET", "/api/rapportdoelen", () => []],
];

const ROUTES = TABEL.map(([methode, patroon, handler]) => ({
  methode,
  delen: patroon.split("/").filter(Boolean),
  handler,
}));

function pasToe(delen: string[], pad: string[]): Record<string, string> | null {
  if (delen.length !== pad.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < delen.length; i++) {
    if (delen[i].startsWith(":")) params[delen[i].slice(1)] = decodeURIComponent(pad[i]);
    else if (delen[i] !== pad[i]) return null;
  }
  return params;
}

/** Answers one API request against the state, as the server would. Never throws. */
export function beantwoord(s: Toestand, methode: string, url: URL, body: unknown): Antwoord {
  const pad = url.pathname.split("/").filter(Boolean);
  for (const route of ROUTES) {
    if (route.methode !== methode) continue;
    const params = pasToe(route.delen, pad);
    if (!params) continue;
    try {
      const resultaat = route.handler({ params, query: url.searchParams, body, s });
      return resultaat instanceof Rauw ? resultaat : new Rauw(200, resultaat);
    } catch (fout) {
      if (fout instanceof Fout) return probleem(fout.status, "Geweigerd in de mockmodus", fout.message);
      return probleem(500, "Fout in de mockmodus", String(fout));
    }
  }
  return probleem(501, "Not mocked", `${methode} ${url.pathname}`);
}
