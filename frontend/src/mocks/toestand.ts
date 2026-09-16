/**
 * The mock mode's in-memory school (TB-046) and the read models the screens ask for, built from it on every request.
 *
 * The state lives as long as the page: a reload builds it again from `inhoud.ts`. The read models follow the types in
 * `lib/types.ts`, so a change to the API contract breaks `pnpm lint` here as well. Dekking is a simplified count, not
 * the server's calculation: it only has to give the screens something to show.
 */
import type { AlgemeneFicheplaatsingWeergave, AlgemeneFicheWeergave } from "../features/algemene-fiches/gegevens";
import type { HoekWeergave, SubthemaperiodeVerrijkingen } from "../features/hoeken/gegevens";
import type { Schooluren } from "../features/schooluren/gegevens";
import type { Ik } from "../lib/aanmelding";
import type {
  ActiviteitWeergave,
  Dagweergave,
  DekkingWeergave,
  Dekkingsbereik,
  Dekkingsvoortgang,
  Eindvoorstel,
  DoelKoppelingContext,
  DoelPlaats,
  JaarplanWeergave,
  KlasWeergave,
  LeerplandoelDekking,
  LeerplandoelDetail,
  LeerplandoelRegel,
  Lesweek,
  MinimumdoelDekking,
  MinimumdoelDetail,
  MinimumdoelRegel,
  Planningsrooster,
  SubthemaBestemming,
  ThemaBibliotheekItem,
  ThemaDoelenoverzicht,
  Themaplaatsing,
  ThemaWeergave,
  Weekplanning,
  WoordwebWeergave,
} from "../lib/types";
import * as inhoud from "./inhoud";

// --- Dates, as ISO strings -------------------------------------------------------------------------------------------

function naarDatum(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function verschuifDagen(iso: string, dagen: number): string {
  const d = naarDatum(iso);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday: 1 is Monday, 7 is Sunday. */
export function weekdag(iso: string): number {
  return naarDatum(iso).getUTCDay() || 7;
}

export function dagenTussen(van: string, tot: string): string[] {
  const dagen: string[] = [];
  for (let d = van; d <= tot; d = verschuifDagen(d, 1)) dagen.push(d);
  return dagen;
}

function sluitingOp(datum: string): string | null {
  return inhoud.ONDERBREKINGEN.find((o) => datum >= o.start && datum <= o.eind)?.naam ?? null;
}

export function isLesdag(datum: string): boolean {
  return (
    datum >= inhoud.SCHOOLJAAR.start &&
    datum <= inhoud.SCHOOLJAAR.eind &&
    weekdag(datum) <= 5 &&
    sluitingOp(datum) === null
  );
}

export function nieuwId(): string {
  return crypto.randomUUID();
}

// --- The state -------------------------------------------------------------------------------------------------------

export interface Dagplaatsing {
  id: string;
  activiteitId: string;
  datum: string;
  begin: string;
  einde: string;
}

export interface Periode {
  id: string;
  subthemaId: string;
  van: string;
  tot: string;
}

interface Plaatsing {
  id: string;
  themaId: string;
  /** First and last day: a thema that runs across a vacation has one placement per part (ADR-0053). */
  van: string;
  tot: string;
  status: Themaplaatsing["status"];
  vergrendeld: boolean;
}

export interface Toestand {
  klassen: { id: string; naam: string; jaarfase: string }[];
  themas: ThemaWeergave[];
  plaatsingen: Plaatsing[];
  dagplaatsingen: Dagplaatsing[];
  periodes: Periode[];
  hoeken: { id: string; naam: string; omschrijving: string | null }[];
  /** Per subthemaperiode, per hoek, the enrichment text. */
  verrijkingen: Record<string, Record<string, { id: string; tekst: string }>>;
  fiches: { id: string; naam: string; omschrijving: string | null; doelen: { koppelingId: string; code: string }[] }[];
  woordwebs: WoordwebWeergave[];
  schooluren: Schooluren;
}

function koppeling(code: string) {
  return { id: nieuwId(), leerplandoelCode: code, status: "Manueel" as const, aiMotivatie: null };
}

function naarThemaWeergave(thema: inhoud.MockThema): ThemaWeergave {
  return {
    id: thema.id,
    naam: thema.naam,
    duurWeken: thema.duurWeken,
    invalshoeken: thema.invalshoeken,
    kernwoordenschat: [...thema.kernwoordenschat],
    rijkeWoordenschat: [...thema.rijkeWoordenschat],
    heeftVoldoendeThemadoelen: true,
    themadoelen: [],
    minimumdoelen: thema.minimumdoelen.map((ref) => ({ id: nieuwId(), minimumdoelRef: ref })),
    subthemas: thema.subthemas.map((sub) => ({
      id: sub.id,
      themaId: thema.id,
      naam: sub.naam,
      duurWeken: sub.weken.length,
      leeftijd: inhoud.KLAS.jaarfase,
      onderzoeksvragen: [sub.onderzoeksvraag],
      subdoelen: sub.subdoelen.map((code) => ({ id: nieuwId(), leeftijd: inhoud.KLAS.jaarfase, koppeling: koppeling(code) })),
      activiteiten: sub.activiteiten.map(
        (act): ActiviteitWeergave => ({
          id: act.id,
          naam: act.naam,
          activiteitType: act.activiteitType,
          hoek: act.hoek,
          verwachteUitkomsten: act.verwachteUitkomsten,
          onderzoeksvraagId: sub.onderzoeksvraag.id,
          kleur: act.kleur,
          lengteInLesuren: 1,
          doelkoppelingen: act.doelen.map(koppeling),
          makerId: null,
        }),
      ),
    })),
  };
}

export function beginToestand(): Toestand {
  const subthemas = inhoud.THEMAS.flatMap((thema) => thema.subthemas);

  // Each subthema runs from the Monday of its first week to the Friday of its last.
  const periodes: Periode[] = subthemas.map((sub) => ({
    id: nieuwId(),
    subthemaId: sub.id,
    van: sub.weken[0],
    tot: verschuifDagen(sub.weken.at(-1)!, 4),
  }));

  // Every slot of every school day in the full stretch gets an activiteit of the subthema that runs that day. Each
  // subthema hands them out in turn and has more of them than a day has slots, so no day repeats one and no two days
  // in a row show the same set.
  const dagplaatsingen: Dagplaatsing[] = [];
  const beurten = new Map<string, number>();
  for (const datum of dagenTussen(inhoud.VOLLE_AGENDA.van, inhoud.VOLLE_AGENDA.tot)) {
    if (!isLesdag(datum)) continue;
    const periode = periodes.find((p) => datum >= p.van && datum <= p.tot);
    const sub = subthemas.find((s) => s.id === periode?.subthemaId);
    if (!sub) continue;
    for (const slot of inhoud.TIJDSLOTEN.filter((sl) => sl.voormiddag || weekdag(datum) !== 3)) {
      const beurt = beurten.get(sub.id) ?? 0;
      beurten.set(sub.id, beurt + 1);
      const act = sub.activiteiten[beurt % sub.activiteiten.length];
      dagplaatsingen.push({ id: nieuwId(), activiteitId: act.id, datum, begin: slot.begin, einde: slot.einde });
    }
  }

  const verrijkingen: Toestand["verrijkingen"] = {};
  for (const periode of periodes) {
    const perHoek = inhoud.HOEKVERRIJKINGEN[periode.subthemaId] ?? {};
    verrijkingen[periode.id] = Object.fromEntries(
      Object.entries(perHoek).map(([hoekId, tekst]) => [hoekId, { id: nieuwId(), tekst }]),
    );
  }

  return {
    klassen: [{ ...inhoud.KLAS }],
    themas: inhoud.THEMAS.map(naarThemaWeergave),
    plaatsingen: inhoud.THEMAS.flatMap((thema) =>
      thema.plaatsingen.map((p) => ({
        id: nieuwId(),
        themaId: thema.id,
        van: p.van,
        tot: p.tot,
        status: "Manueel" as const,
        vergrendeld: false,
      })),
    ),
    dagplaatsingen,
    periodes,
    hoeken: inhoud.HOEKEN.map((h) => ({ ...h })),
    verrijkingen,
    fiches: inhoud.ALGEMENE_FICHES.map((f) => ({
      id: f.id,
      naam: f.naam,
      omschrijving: f.omschrijving,
      doelen: f.doelen.map((code) => ({ koppelingId: nieuwId(), code })),
    })),
    woordwebs: [],
    schooluren: { dagen: inhoud.SCHOOLUREN.map((d) => ({ ...d })) },
  };
}

// --- Lookups ---------------------------------------------------------------------------------------------------------

export function zoekSubthema(t: Toestand, subthemaId: string) {
  for (const thema of t.themas) {
    const subthema = thema.subthemas.find((s) => s.id === subthemaId);
    if (subthema) return { thema, subthema };
  }
  return null;
}

export function zoekActiviteit(t: Toestand, activiteitId: string) {
  for (const thema of t.themas) {
    for (const subthema of thema.subthemas) {
      const activiteit = subthema.activiteiten.find((a) => a.id === activiteitId);
      if (activiteit) return { thema, subthema, activiteit };
    }
  }
  return null;
}

const leerplandoelOpCode = new Map(inhoud.LEERPLANDOELEN.map((d) => [d.code, d]));
const minimumdoelOpRef = new Map(inhoud.MINIMUMDOELEN.map((m) => [m.ref, m]));

export function bestaatLeerplandoel(code: string): boolean {
  return leerplandoelOpCode.has(code);
}

export function bestaatMinimumdoel(ref: string): boolean {
  return minimumdoelOpRef.has(ref);
}

function jaarFaseVan(code: string): string {
  return code.split(".").find((deel) => /^[GVPSA](JK|K\d|L\d)$/.test(deel))?.slice(1) ?? inhoud.KLAS.jaarfase;
}

// --- Selection context -----------------------------------------------------------------------------------------------

export function ik(): Ik {
  return {
    ...inhoud.GEBRUIKER,
    isDirectie: true,
    heeftThemabeheer: true,
    heeftLeerlingzorg: false,
    hoofdleerkrachtLeeftijden: [],
    leerkrachtLeeftijden: [],
    eigenKlasIds: [],
    rapportklasIds: [],
    lopendeRapportklasIds: [],
  };
}

export function klasWeergave(t: Toestand, klas: Toestand["klassen"][number]): KlasWeergave {
  const aantalSubthemas = t.themas.flatMap((th) => th.subthemas).filter((s) => s.leeftijd === klas.jaarfase).length;
  return {
    id: klas.id,
    schooljaarId: inhoud.SCHOOLJAAR.id,
    naam: klas.naam,
    leerjaar: 0,
    aantalSubthemas,
    jaarFasen: [klas.jaarfase],
    jaarfase: klas.jaarfase,
    mogelijkeJaarfasen: inhoud.JAARFASEN,
    kanLeerlingenHebben: klas.jaarfase === "K3",
  };
}

// --- Thema's ---------------------------------------------------------------------------------------------------------

export function themaWeergave(thema: ThemaWeergave): ThemaWeergave {
  return { ...thema, heeftVoldoendeThemadoelen: thema.minimumdoelen.length >= 2 };
}

export function themaVoorKlas(thema: ThemaWeergave, jaarfase: string): ThemaWeergave {
  return { ...themaWeergave(thema), subthemas: thema.subthemas.filter((s) => s.leeftijd === jaarfase) };
}

/**
 * The library row, with the three counts the server sends beside the typed fields (TB-049). They are not in
 * `ThemaBibliotheekItem` yet; the thema list reads them defensively, and counts them as the server does.
 */
export function bibliotheek(t: Toestand): (ThemaBibliotheekItem & {
  aantalSubthemas: number;
  aantalActiviteiten: number;
  aantalDoelkoppelingen: number;
})[] {
  return t.themas.map((thema) => {
    const { subthemas, ...rest } = themaWeergave(thema);
    const activiteiten = subthemas.flatMap((s) => s.activiteiten);
    return {
      ...rest,
      aantalAfgeleideKlassen: t.plaatsingen.some((p) => p.themaId === thema.id) ? t.klassen.length : 0,
      aantalSubthemas: subthemas.length,
      aantalActiviteiten: activiteiten.length,
      aantalDoelkoppelingen:
        thema.minimumdoelen.length +
        subthemas.reduce((som, s) => som + s.subdoelen.length, 0) +
        activiteiten.reduce((som, a) => som + a.doelkoppelingen.length, 0),
    };
  });
}

export function doelenoverzicht(thema: ThemaWeergave): ThemaDoelenoverzicht {
  const perLeeftijd = new Map<string, Map<string, DoelPlaats[]>>();
  const voegToe = (leeftijd: string, code: string, plaats: DoelPlaats) => {
    const doelen = perLeeftijd.get(leeftijd) ?? new Map<string, DoelPlaats[]>();
    perLeeftijd.set(leeftijd, doelen);
    doelen.set(code, [...(doelen.get(code) ?? []), plaats]);
  };
  for (const sub of thema.subthemas) {
    for (const subdoel of sub.subdoelen) {
      voegToe(sub.leeftijd, subdoel.koppeling.leerplandoelCode, { soort: "Subdoel", naam: sub.naam });
    }
    for (const act of sub.activiteiten) {
      for (const k of act.doelkoppelingen) voegToe(sub.leeftijd, k.leerplandoelCode, { soort: "Activiteit", naam: act.naam });
    }
  }
  return {
    themaId: thema.id,
    leeftijden: [...perLeeftijd].map(([leeftijd, doelen]) => ({
      leeftijd,
      leerplandoelen: [...doelen]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, plaatsen]) => {
          const doel = leerplandoelOpCode.get(code);
          return {
            code,
            doelsoort: doel?.doelsoort ?? "Gemeenschappelijk",
            tekst: doel?.tekst ?? code,
            nietMeerInOpstap: false,
            minimumdoelRef: doel?.minimumdoelRef ?? null,
            plaatsen,
          };
        }),
    })),
  };
}

export function bestemmingen(t: Toestand, jaarfase: string): SubthemaBestemming[] {
  return t.themas.flatMap((thema) =>
    thema.subthemas
      .filter((s) => s.leeftijd === jaarfase)
      .map((s) => ({ id: s.id, naam: s.naam, leeftijd: s.leeftijd, themaId: thema.id, themaNaam: thema.naam })),
  );
}

// --- Curriculum ------------------------------------------------------------------------------------------------------

export function leerplandoelRegel(code: string): LeerplandoelRegel | null {
  const d = leerplandoelOpCode.get(code);
  if (!d) return null;
  return {
    code: d.code,
    doelsoort: d.doelsoort,
    jaarFase: jaarFaseVan(d.code),
    domein: d.domein,
    subdomein: d.subdomein,
    tekst: d.tekst,
    minimumdoelRef: d.minimumdoelRef,
    nietMeerInOpstap: false,
  };
}

export function alleLeerplandoelen(): LeerplandoelRegel[] {
  return inhoud.LEERPLANDOELEN.map((d) => leerplandoelRegel(d.code)!);
}

export function disciplineVan(code: string): string {
  return leerplandoelOpCode.get(code)?.discipline ?? "";
}

function koppelingen(t: Toestand, code: string): DoelKoppelingContext[] {
  const lijst: DoelKoppelingContext[] = [];
  for (const thema of t.themas) {
    for (const sub of thema.subthemas) {
      for (const subdoel of sub.subdoelen) {
        if (subdoel.koppeling.leerplandoelCode === code) {
          lijst.push({ herkomst: "Subdoel", themaNaam: thema.naam, onderdeel: sub.naam, leeftijd: sub.leeftijd, status: subdoel.koppeling.status });
        }
      }
      for (const act of sub.activiteiten) {
        for (const k of act.doelkoppelingen) {
          if (k.leerplandoelCode === code) {
            lijst.push({ herkomst: "Activiteit", themaNaam: thema.naam, onderdeel: act.naam, leeftijd: sub.leeftijd, status: k.status });
          }
        }
      }
    }
  }
  for (const fiche of t.fiches) {
    if (fiche.doelen.some((d) => d.code === code)) {
      lijst.push({ herkomst: "AlgemeneFiche", themaNaam: fiche.naam, onderdeel: inhoud.KLAS.naam, leeftijd: null, status: "Manueel" });
    }
  }
  return lijst;
}

export function leerplandoelDetail(t: Toestand, code: string): LeerplandoelDetail | null {
  const d = leerplandoelOpCode.get(code);
  if (!d) return null;
  const md = d.minimumdoelRef ? minimumdoelOpRef.get(d.minimumdoelRef) : undefined;
  return {
    code: d.code,
    doelsoort: d.doelsoort,
    jaarFase: jaarFaseVan(d.code),
    disciplineNummer: d.discipline,
    disciplineNaam: inhoud.DISCIPLINES[d.discipline] ?? null,
    domein: d.domein,
    subdomein: d.subdomein,
    cluster: null,
    tekst: d.tekst,
    voorbeelden: null,
    toelichting: null,
    woordenschat: null,
    minimumdoelRef: d.minimumdoelRef,
    minimumdoel: md ? { ref: md.ref, leeftijd: "K-", nr: md.nr, omschrijving: md.omschrijving } : null,
    nietMeerInOpstap: false,
    koppelingen: koppelingen(t, code),
    gerelateerdeDoelen: inhoud.LEERPLANDOELEN.filter(
      (ander) => ander.code !== code && ander.minimumdoelRef !== null && ander.minimumdoelRef === d.minimumdoelRef,
    ).map((ander) => ({
      code: ander.code,
      tekst: ander.tekst,
      jaarFase: jaarFaseVan(ander.code),
      domein: ander.domein,
      subdomein: ander.subdomein,
    })),
  };
}

function geconcordeerd(ref: string) {
  return inhoud.LEERPLANDOELEN.filter((d) => d.minimumdoelRef === ref);
}

export function minimumdoelRegel(ref: string): MinimumdoelRegel | null {
  const m = minimumdoelOpRef.get(ref);
  if (!m) return null;
  const doelen = geconcordeerd(ref);
  return {
    ref: m.ref,
    leeftijd: "K-",
    nr: m.nr,
    omschrijving: m.omschrijving,
    leergebied: m.leergebied,
    rubriek: m.rubriek,
    subrubriek: m.subrubriek,
    aantalLeerplandoelen: doelen.length,
    jaarFasen: [...new Set(doelen.map((d) => jaarFaseVan(d.code)))],
    zonderLeerplandoelReden: null,
    zonderLeerplandoelDoelsets: [],
  };
}

export function alleMinimumdoelen(): MinimumdoelRegel[] {
  return inhoud.MINIMUMDOELEN.map((m) => minimumdoelRegel(m.ref)!);
}

export function minimumdoelDetail(ref: string): MinimumdoelDetail | null {
  const regel = minimumdoelRegel(ref);
  if (!regel) return null;
  const doelen = geconcordeerd(ref);
  return {
    ref: regel.ref,
    leeftijd: regel.leeftijd,
    nr: regel.nr,
    omschrijving: regel.omschrijving,
    leergebied: regel.leergebied,
    rubriek: regel.rubriek,
    subrubriek: regel.subrubriek,
    soort: "TeBereikenPopulatie",
    nietMeerInOpstap: false,
    aantalLeerplandoelen: doelen.length,
    jaarFasen: ["JK", "K2", "K3"].map((jaarFase) => ({
      jaarFase,
      leerplandoelen: doelen
        .filter((d) => jaarFaseVan(d.code) === jaarFase)
        .map((d) => ({
          code: d.code,
          tekst: d.tekst,
          disciplineNaam: inhoud.DISCIPLINES[d.discipline] ?? null,
          domein: d.domein,
          subdomein: d.subdomein,
          nietMeerInOpstap: false,
        })),
    })),
    zonderLeerplandoelReden: null,
    zonderLeerplandoelDoelsets: [],
  };
}

// --- Jaarplan --------------------------------------------------------------------------------------------------------

function isVakantie(datum: string): boolean {
  return inhoud.ONDERBREKINGEN.some((o) => datum >= o.start && datum <= o.eind);
}

function eersteSchooldag(): string {
  return dagenTussen(inhoud.SCHOOLJAAR.start, inhoud.SCHOOLJAAR.eind).find(isLesdag) ?? inhoud.SCHOOLJAAR.start;
}

function laatsteSchooldag(): string {
  return dagenTussen(inhoud.SCHOOLJAAR.start, inhoud.SCHOOLJAAR.eind).filter(isLesdag).at(-1) ?? inhoud.SCHOOLJAAR.eind;
}

function maandagVan(iso: string): string {
  return verschuifDagen(iso, 1 - weekdag(iso));
}

function isLesweek(maandag: string): boolean {
  return dagenTussen(maandag, verschuifDagen(maandag, 4)).some(isLesdag);
}

function volgendeSchooldag(iso: string): string | null {
  return dagenTussen(iso, inhoud.SCHOOLJAAR.eind).find(isLesdag) ?? null;
}

/** Cuts a stretch at every vacation and trims each part to its schooldagen, as the server does (ADR-0053). */
function splits(van: string, tot: string): { van: string; tot: string }[] {
  const delen: { van: string; tot: string }[] = [];
  let deel: { van: string; tot: string } | null = null;
  for (const dag of dagenTussen(van, tot)) {
    if (isVakantie(dag)) {
      if (deel) delen.push(deel);
      deel = null;
    } else if (isLesdag(dag)) {
      if (deel) deel.tot = dag;
      else deel = { van: dag, tot: dag };
    }
  }
  if (deel) delen.push(deel);
  return delen;
}

/** The last schooldag before the same weekday `weken` lesweken later, cut to the year. */
function voorgesteldEinde(van: string, weken: number): string {
  let maandag = maandagVan(van);
  let geteld = 0;
  for (;;) {
    if (maandag > inhoud.SCHOOLJAAR.eind || isLesweek(maandag)) geteld += 1;
    if (geteld === weken + 1) break;
    maandag = verschuifDagen(maandag, 7);
  }
  let einde = verschuifDagen(maandag, weekdag(van) - 2);
  while (einde > van && einde <= inhoud.SCHOOLJAAR.eind && !isLesdag(einde)) einde = verschuifDagen(einde, -1);
  return einde > laatsteSchooldag() ? laatsteSchooldag() : einde;
}

function bezet(t: Toestand, van: string, tot: string, behalve: string[] = []): Plaatsing | undefined {
  return t.plaatsingen.find((p) => !behalve.includes(p.id) && p.van <= tot && p.tot >= van);
}

/** The end the server proposes for a thema starting on `van`, and the parts it would store. */
export function eindvoorstel(t: Toestand, thema: ThemaWeergave, van: string): Eindvoorstel {
  const begin = volgendeSchooldag(van);
  if (begin === null) throw new Error("Na die dag is er geen school meer.");
  if (bezet(t, begin, begin)) throw new Error("Op die dag loopt al een ander thema.");
  let tot = voorgesteldEinde(begin, thema.duurWeken);
  let beperktDoor: Eindvoorstel["beperktDoor"] = tot === laatsteSchooldag() ? "Schooljaar" : null;
  let volgendThemaNaam: string | null = null;
  const volgende = t.plaatsingen.filter((p) => p.van > begin).sort((a, b) => a.van.localeCompare(b.van))[0];
  if (volgende && volgende.van <= tot) {
    tot = dagenTussen(begin, verschuifDagen(volgende.van, -1)).filter(isLesdag).at(-1) ?? begin;
    beperktDoor = "VolgendThema";
    volgendThemaNaam = t.themas.find((th) => th.id === volgende.themaId)?.naam ?? null;
  }
  return { van: begin, tot, delen: splits(begin, tot), beperktDoor, volgendThemaNaam };
}

/**
 * Stores a stretch as its parts around vacations, replacing the placements in `vervangt`. Refuses days outside the
 * year or taken by another thema; the message is the one a teacher reads.
 */
export function plaats(
  t: Toestand,
  themaId: string,
  van: string,
  tot: string,
  status: Plaatsing["status"],
  vervangt: string[] = [],
): void {
  if (tot < van) throw new Error("De einddatum ligt voor de begindatum.");
  if (van < eersteSchooldag() || tot > laatsteSchooldag()) throw new Error("Die dagen vallen buiten het schooljaar.");
  const delen = splits(van, tot);
  if (delen.length === 0) throw new Error("Op die dagen is er geen school.");
  if (delen.some((d) => bezet(t, d.van, d.tot, vervangt))) throw new Error("Op die dagen loopt al een ander thema.");
  const vergrendeld = t.plaatsingen.some((p) => vervangt.includes(p.id) && p.vergrendeld);
  t.plaatsingen = t.plaatsingen.filter((p) => !vervangt.includes(p.id));
  for (const deel of delen) {
    t.plaatsingen.push({ id: nieuwId(), themaId, van: deel.van, tot: deel.tot, status, vergrendeld });
  }
}

/** Moves a placement to start on the first schooldag from `van`, keeping its number of schooldagen. */
export function verschuif(t: Toestand, plaatsing: Plaatsing, van: string): void {
  const begin = volgendeSchooldag(van);
  if (begin === null) throw new Error("Na die dag is er geen school meer.");
  const aantal = dagenTussen(plaatsing.van, plaatsing.tot).filter(isLesdag).length;
  const dagen = dagenTussen(begin, inhoud.SCHOOLJAAR.eind).filter(isLesdag);
  if (aantal === 0 || dagen.length < aantal) throw new Error("Die dagen vallen buiten het schooljaar.");
  plaats(t, plaatsing.themaId, begin, dagen[aantal - 1], "Manueel", [plaatsing.id]);
}

export function rooster(): Planningsrooster {
  return {
    schooljaarId: inhoud.SCHOOLJAAR.id,
    schooljaarNaam: inhoud.SCHOOLJAAR.naam,
    start: inhoud.SCHOOLJAAR.start,
    eind: inhoud.SCHOOLJAAR.eind,
    onderbrekingen: inhoud.ONDERBREKINGEN,
  };
}

function themaDoelcodes(thema: ThemaWeergave, jaarfase: string): string[] {
  const codes = new Set<string>();
  for (const sub of thema.subthemas.filter((s) => s.leeftijd === jaarfase)) {
    for (const subdoel of sub.subdoelen) codes.add(subdoel.koppeling.leerplandoelCode);
  }
  return [...codes].sort();
}

/** The parts of one thema with no schooldag between them, in order. */
function reeksVan(t: Toestand, plaatsing: Plaatsing): Plaatsing[] {
  const eigen = t.plaatsingen.filter((p) => p.themaId === plaatsing.themaId).sort((a, b) => a.van.localeCompare(b.van));
  const reeksen: Plaatsing[][] = [];
  for (const p of eigen) {
    const laatste = reeksen.at(-1);
    const vorige = laatste?.at(-1);
    const aansluitend =
      vorige !== undefined && !dagenTussen(verschuifDagen(vorige.tot, 1), verschuifDagen(p.van, -1)).some(isLesdag);
    if (laatste && aansluitend) laatste.push(p);
    else reeksen.push([p]);
  }
  return reeksen.find((r) => r.includes(plaatsing)) ?? [plaatsing];
}

function aantalLesweken(van: string, tot: string): number {
  let aantal = 0;
  for (let maandag = maandagVan(van); maandag <= tot; maandag = verschuifDagen(maandag, 7)) {
    if (isLesweek(maandag)) aantal += 1;
  }
  return aantal;
}

export function jaarplan(t: Toestand, klas: Toestand["klassen"][number]): JaarplanWeergave {
  const plaatsingen: Themaplaatsing[] = t.plaatsingen
    .slice()
    .sort((a, b) => a.van.localeCompare(b.van))
    .flatMap((p) => {
      const thema = t.themas.find((th) => th.id === p.themaId);
      if (!thema) return [];
      const reeks = reeksVan(t, p);
      const reeksVanDag = reeks[0].van;
      const reeksTotDag = reeks[reeks.length - 1].tot;
      return [
        {
          id: p.id,
          themaId: thema.id,
          themaNaam: thema.naam,
          van: p.van,
          tot: p.tot,
          isVervallen: p.van < eersteSchooldag() || p.tot > laatsteSchooldag() || dagenTussen(p.van, p.tot).some(isVakantie),
          status: p.status,
          aiMotivatie: null,
          vergrendeld: p.vergrendeld,
          doelcodes: themaDoelcodes(thema, klas.jaarfase),
          duurWeken: thema.duurWeken,
          reeks:
            reeks.length > 1
              ? {
                  deel: reeks.indexOf(p) + 1,
                  aantalDelen: reeks.length,
                  reeksVan: reeksVanDag,
                  reeksTot: reeksTotDag,
                  weken: aantalLesweken(reeksVanDag, reeksTotDag),
                  eindeAangepast: voorgesteldEinde(reeksVanDag, thema.duurWeken) !== reeksTotDag,
                  stoptBijEindeSchooljaar: false,
                }
              : null,
        },
      ];
    });

  const lesweken: Lesweek[] = [];
  for (let maandag = maandagVan(eersteSchooldag()); maandag <= laatsteSchooldag(); maandag = verschuifDagen(maandag, 7)) {
    if (!isLesweek(maandag)) continue;
    const vrijdag = verschuifDagen(maandag, 4);
    lesweken.push({ maandag, heeftThema: t.plaatsingen.some((p) => p.van <= vrijdag && p.tot >= maandag) });
  }
  const metThema = lesweken.filter((w) => w.heeftThema).length;

  return {
    klasId: klas.id,
    klasNaam: klas.naam,
    schooljaarId: inhoud.SCHOOLJAAR.id,
    schooljaarNaam: inhoud.SCHOOLJAAR.naam,
    eersteSchooldag: eersteSchooldag(),
    laatsteSchooldag: laatsteSchooldag(),
    plaatsingen,
    lesweken,
    balans: { lesweken: lesweken.length, metThema, zonderThema: lesweken.length - metThema },
  };
}

// --- Weekplanning ----------------------------------------------------------------------------------------------------

function klem(van: string, tot: string): [string, string] {
  return [van < inhoud.SCHOOLJAAR.start ? inhoud.SCHOOLJAAR.start : van, tot > inhoud.SCHOOLJAAR.eind ? inhoud.SCHOOLJAAR.eind : tot];
}

export function weekplanning(t: Toestand, klas: Toestand["klassen"][number], van: string, tot: string): Weekplanning {
  const [begin, einde] = klem(van, tot);
  const dagen: Dagweergave[] = dagenTussen(begin, einde).map((datum) => ({
    datum,
    isLesdag: isLesdag(datum),
    sluitingsnaam: sluitingOp(datum),
    activiteiten: t.dagplaatsingen
      .filter((p) => p.datum === datum)
      .sort((a, b) => a.begin.localeCompare(b.begin))
      .flatMap((p) => {
        const gevonden = zoekActiviteit(t, p.activiteitId);
        if (!gevonden) return [];
        const { thema, subthema, activiteit } = gevonden;
        const inPeriode = t.plaatsingen.some((pl) => pl.themaId === thema.id && datum >= pl.van && datum <= pl.tot);
        return [
          {
            plaatsingId: p.id,
            activiteitId: activiteit.id,
            activiteitNaam: activiteit.naam,
            activiteitType: activiteit.activiteitType,
            subthemaId: subthema.id,
            subthemaNaam: subthema.naam,
            themaId: thema.id,
            themaNaam: thema.naam,
            begin: p.begin,
            einde: p.einde,
            status: "Manueel",
            kleur: activiteit.kleur,
            doelcodes: activiteit.doelkoppelingen.map((k) => k.leerplandoelCode),
            valtBuitenThemaperiode: !inPeriode,
          },
        ];
      }),
  }));
  return {
    klasId: klas.id,
    klasNaam: klas.naam,
    schooljaarId: inhoud.SCHOOLJAAR.id,
    schooljaarNaam: inhoud.SCHOOLJAAR.naam,
    van: begin,
    tot: einde,
    dagen,
    subthemaperiodes: t.periodes
      .filter((p) => p.van <= einde && p.tot >= begin)
      .flatMap((p) => {
        const gevonden = zoekSubthema(t, p.subthemaId);
        if (!gevonden) return [];
        return [
          {
            id: p.id,
            subthemaId: p.subthemaId,
            subthemaNaam: gevonden.subthema.naam,
            themaId: gevonden.thema.id,
            themaNaam: gevonden.thema.naam,
            van: p.van,
            tot: p.tot,
          },
        ];
      }),
  };
}

// --- Hoeken and algemene fiches --------------------------------------------------------------------------------------

export function hoeken(t: Toestand, klasId: string): HoekWeergave[] {
  return t.hoeken.map((h) => ({
    id: h.id,
    klasId,
    naam: h.naam,
    omschrijving: h.omschrijving,
    aantalVerrijkingen: Object.values(t.verrijkingen).filter((perHoek) => perHoek[h.id]).length,
  }));
}

export function hoekverrijkingen(t: Toestand, van: string, tot: string): SubthemaperiodeVerrijkingen[] {
  return t.periodes
    .filter((p) => p.van <= tot && p.tot >= van)
    .flatMap((p) => {
      const gevonden = zoekSubthema(t, p.subthemaId);
      if (!gevonden) return [];
      return [
        {
          subthemaperiodeId: p.id,
          subthemaId: p.subthemaId,
          subthemaNaam: gevonden.subthema.naam,
          van: p.van,
          tot: p.tot,
          verrijkingen: Object.entries(t.verrijkingen[p.id] ?? {}).map(([hoekId, v]) => ({ id: v.id, hoekId, tekst: v.tekst })),
        },
      ];
    });
}

export function algemeneFiches(t: Toestand, klasId: string): AlgemeneFicheWeergave[] {
  return t.fiches.map((f) => ({
    id: f.id,
    klasId,
    naam: f.naam,
    omschrijving: f.omschrijving,
    aantalPlaatsingen: 0,
    doelen: f.doelen.flatMap((d) => {
      const regel = leerplandoelRegel(d.code);
      return regel
        ? [{ koppelingId: d.koppelingId, leerplandoelCode: d.code, doelsoort: regel.doelsoort, jaarFase: regel.jaarFase, tekst: regel.tekst }]
        : [];
    }),
  }));
}

export function ficheplaatsingen(): AlgemeneFicheplaatsingWeergave[] {
  return [];
}

// --- Dekking ---------------------------------------------------------------------------------------------------------

/**
 * A simplified dekking: a leerplandoel is in the prognose through a subdoel of a subthema at the klas's age, and gedekt
 * once that subthema has a period or an activiteit in the agenda. A minimumdoel is in the prognose through its thema and
 * gedekt once that thema is placed. Left out: algemene fiches (none is planned in the mock), doelsuggesties and stale
 * placements, so `isBetrouwbaar` is always true. Not the server's calculation: never read a mock figure as a real one.
 */
function dekkingsdoelen(t: Toestand, klas: Toestand["klassen"][number]) {
  const ingepland = new Set([
    ...t.periodes.map((p) => p.subthemaId),
    ...t.dagplaatsingen.flatMap((p) => {
      const gevonden = zoekActiviteit(t, p.activiteitId);
      return gevonden ? [gevonden.subthema.id] : [];
    }),
  ]);
  const doelen: LeerplandoelDekking[] = inhoud.LEERPLANDOELEN.filter((d) => jaarFaseVan(d.code) === klas.jaarfase).map((d) => {
    const bronnen = t.themas.flatMap((thema) =>
      thema.subthemas
        .filter((s) => s.leeftijd === klas.jaarfase && s.subdoelen.some((sd) => sd.koppeling.leerplandoelCode === d.code))
        .map((s) => ({ label: `${s.naam} (${thema.naam})`, thema: thema.naam, gedekt: ingepland.has(s.id) })),
    );
    const dekkend = bronnen.filter((b) => b.gedekt);
    const stap = dekkend.length > 0 ? "Gedekt" : bronnen.length > 0 ? "Prognose" : "Geen";
    return {
      code: d.code,
      doelsoort: d.doelsoort,
      jaarFase: klas.jaarfase,
      disciplineNummer: d.discipline,
      disciplineNaam: inhoud.DISCIPLINES[d.discipline] ?? null,
      domein: d.domein,
      subdomein: d.subdomein,
      tekst: d.tekst,
      minimumdoelRef: d.minimumdoelRef,
      nietMeerInOpstap: false,
      isGedekt: stap === "Gedekt",
      dekkendeThemas: dekkend.map((b) => b.label),
      dekkendeFiches: [],
      oorzaak: stap === "Gedekt" ? null : stap === "Prognose" ? "NietIngepland" : "GeenThema",
      kandidaatThemas: stap === "Prognose" ? [...new Set(bronnen.map((b) => b.thema))] : [],
      stap,
      prognoseBronnen: bronnen.map((b) => b.label),
    };
  });

  const geplaatst = new Set(t.plaatsingen.filter((p) => p.status !== "Geweigerd").map((p) => p.themaId));
  const minimumdoelen: MinimumdoelDekking[] = inhoud.MINIMUMDOELEN.map((m) => {
    const themas = t.themas.filter((th) => th.minimumdoelen.some((md) => md.minimumdoelRef === m.ref));
    const dekkend = themas.filter((th) => geplaatst.has(th.id));
    const stap = dekkend.length > 0 ? "Gedekt" : themas.length > 0 ? "Prognose" : "Geen";
    return {
      ref: m.ref,
      leeftijd: "K-",
      nr: m.nr,
      omschrijving: m.omschrijving,
      leergebied: m.leergebied,
      rubriek: m.rubriek,
      subrubriek: m.subrubriek,
      nietMeerInOpstap: false,
      stap,
      isGedekt: stap === "Gedekt",
      prognoseThemas: themas.map((th) => th.naam),
      dekkendeThemas: dekkend.map((th) => th.naam),
      oorzaak: stap === "Gedekt" ? null : stap === "Prognose" ? "NietIngepland" : "GeenThema",
      kandidaatThemas: stap === "Prognose" ? themas.map((th) => th.naam) : [],
    };
  });
  return { doelen, minimumdoelen };
}

export function dekking(t: Toestand, klas: Toestand["klassen"][number], bereik: Dekkingsbereik): DekkingWeergave {
  const { doelen, minimumdoelen } = dekkingsdoelen(t, klas);
  const telt = <T extends { stap: string }>(lijst: T[], stap: string) => lijst.filter((d) => d.stap === stap).length;
  return {
    klasId: klas.id,
    klasNaam: klas.naam,
    schooljaarId: inhoud.SCHOOLJAAR.id,
    schooljaarNaam: inhoud.SCHOOLJAAR.naam,
    bereik,
    gemetenJaarFasen: [klas.jaarfase],
    beschikbareJaarFasen: [klas.jaarfase],
    isTerugvalNaarHeelCurriculum: false,
    aantalBuitenBereik: inhoud.LEERPLANDOELEN.length - doelen.length,
    isBetrouwbaar: true,
    aantalOnopgelosteVervallenPlaatsingen: 0,
    aantalGedekt: telt(doelen, "Gedekt"),
    aantalLeerplandoelen: doelen.length,
    doelen,
    aantalInPrognose: telt(doelen, "Prognose"),
    aantalMinimumdoelenGedekt: telt(minimumdoelen, "Gedekt"),
    aantalMinimumdoelenInPrognose: telt(minimumdoelen, "Prognose"),
    aantalMinimumdoelen: minimumdoelen.length,
    minimumdoelen,
  };
}

export function dekkingsvoortgang(t: Toestand, klas: Toestand["klassen"][number], bereik: Dekkingsbereik): Dekkingsvoortgang {
  const volledig = dekking(t, klas, bereik);
  return {
    bereik,
    gemetenJaarFasen: volledig.gemetenJaarFasen,
    isTerugvalNaarHeelCurriculum: false,
    aantalBuitenBereik: volledig.aantalBuitenBereik,
    isBetrouwbaar: true,
    aantalOnopgelosteVervallenPlaatsingen: 0,
    aantalGedekt: volledig.aantalGedekt,
    aantalMogelijkGedekt: (volledig.aantalGedekt ?? 0) + (volledig.aantalInPrognose ?? 0),
    aantalLeerplandoelen: volledig.aantalLeerplandoelen,
    aantalOnbereikbaar: volledig.doelen.filter((d) => d.stap === "Geen").length,
  };
}
