/**
 * Types mirroring the backend's Application-layer DTOs (backend/src/Jaarplanner.Application).
 *
 * String-literal unions rather than TS `enum`: `erasableSyntaxOnly` disallows non-erasable syntax,
 * and the backend serialises its C# enums by name, so a literal union is the honest mirror.
 *
 * This file covers the curriculum half only. Thema's, jaarplan and dekking types land with their
 * own screens rather than up front, so nothing here describes an endpoint no screen calls.
 */

export type Doelsoort =
  | "Minimumdoel"
  | "Gemeenschappelijk"
  | "Verdieping"
  | "Precurriculum"
  | "Specifiek"
  | "AnderstaligeNieuwkomers";

/**
 * The one-or-two character mark Op.stap itself prints for a doelsoort. It is rendered beside every
 * doelsoort colour, so the colour is never the only carrier of the distinction (Art. XII, WCAG 2.2
 * AA 1.4.1). Not translated copy: these are Op.stap's own marks, identical in every language.
 */
export const DOELSOORT_MARK: Record<Doelsoort, string> = {
  Minimumdoel: "MD",
  Gemeenschappelijk: "G",
  Verdieping: "+",
  Precurriculum: "P",
  Specifiek: "S",
  AnderstaligeNieuwkomers: "A",
};

/** The doelsoorten in Op.stap's own order, for filter lists that must not reorder per response. */
export const DOELSOORTEN: Doelsoort[] = [
  "Minimumdoel",
  "Gemeenschappelijk",
  "Verdieping",
  "Precurriculum",
  "Specifiek",
  "AnderstaligeNieuwkomers",
];

export type KoppelingStatus = "Voorgesteld" | "Aanvaard" | "Geweigerd" | "Manueel";

/** One word of a woordweb (FB-036, ADR-0043): typed (`Manueel`), or proposed by the AI and then decided (Art. IV.2). */
export interface WoordwebWoord {
  id: string;
  woord: string;
  status: KoppelingStatus;
  aiMotivatie: string | null;
}

/** One gebruiker's woordweb on one subthema, with every word in every status. `isEigen`: the signed-in gebruiker's. */
export interface WoordwebWeergave {
  id: string;
  subthemaId: string;
  eigenaarId: string;
  eigenaarNaam: string;
  isEigen: boolean;
  woorden: WoordwebWoord[];
}

/** What an AI request did: the web afterwards and how many words it proposed. */
export interface WoordwebVoorstelResultaat {
  isGeslaagd: boolean;
  woordweb: WoordwebWeergave | null;
  aantalVoorgesteld: number;
  fout: string | null;
}

/**
 * Which content layer a register link lives in. For `AlgemeneFiche` there is no thema: `themaNaam` carries the
 * fiche's name and `onderdeel` its klas (server contract, 2026-09-11).
 */
export type KoppelingHerkomst = "Themadoel" | "Subdoel" | "Activiteit" | "AlgemeneFiche";

// --- Curriculum ---

export interface MinimumdoelWeergave {
  ref: string;
  leeftijd: string;
  nr: string;
  omschrijving: string;
}

export interface DoelKoppelingContext {
  herkomst: KoppelingHerkomst;
  themaNaam: string;
  onderdeel: string | null;
  /** The age an age-scoped link belongs to; null for the school-wide layers. Was the klas name until 2026-08-30. */
  leeftijd: string | null;
  status: KoppelingStatus;
}

/** Another leerplandoel concorded to the same minimumdoel as the one being viewed. */
export interface GerelateerdLeerplandoel {
  code: string;
  tekst: string;
  jaarFase: string;
  domein: string;
  subdomein: string;
}

export interface LeerplandoelRegel {
  code: string;
  doelsoort: Doelsoort;
  jaarFase: string;
  domein: string;
  subdomein: string;
  tekst: string;
  minimumdoelRef: string | null;
  nietMeerInOpstap: boolean;
}

export interface LeerplandoelenPagina {
  regels: LeerplandoelRegel[];
  totaal: number;
  overslaan: number;
  aantal: number;
}

export interface LeerplandoelDetail {
  code: string;
  doelsoort: Doelsoort;
  jaarFase: string;
  disciplineNummer: string;
  disciplineNaam: string | null;
  domein: string;
  subdomein: string;
  cluster: string | null;
  tekst: string;
  voorbeelden: string | null;
  toelichting: string | null;
  woordenschat: string | null;
  minimumdoelRef: string | null;
  minimumdoel: MinimumdoelWeergave | null;
  nietMeerInOpstap: boolean;
  koppelingen: DoelKoppelingContext[];
  gerelateerdeDoelen: GerelateerdLeerplandoel[];
}

// --- Facets ---

export interface DisciplineFacet {
  nummer: string;
  naam: string | null;
  aantal: number;
}

export interface SubdomeinFacet {
  subdomein: string;
  aantal: number;
}

export interface DomeinFacet {
  domein: string;
  aantal: number;
  subdomeinen: SubdomeinFacet[];
}

export interface DoelsoortFacet {
  doelsoort: Doelsoort;
  aantal: number;
}

export interface JaarFaseFacet {
  jaarFase: string;
  aantal: number;
}

export interface LeerplandoelFacetten {
  totaalAantalDoelen: number;
  disciplines: DisciplineFacet[];
  domeinen: DomeinFacet[];
  doelsoorten: DoelsoortFacet[];
  jaarFasen: JaarFaseFacet[];
}

export interface LeerplandoelFilterQuery {
  zoek?: string;
  discipline?: string;
  domein?: string;
  subdomein?: string;
  doelsoort?: Doelsoort;
  /**
   * One jaar/fase, or several.
   *
   * Several, because a class does not always teach one: a kleutergroep that has not recorded its year is measured
   * against JK, K2 and K3 together. The backend takes the parameter repeated (`?jaarFase=JK&jaarFase=K2`), so this is
   * one dimension with one representation rather than two fields.
   */
  jaarFase?: string | readonly string[];
  overslaan?: number;
  aantal?: number;
}

// --- Minimumdoelen (the decreed eindtermen, Art. VII.0) ---

/** The decree's kind of minimumdoel, as KOV publishes it (TB-010). */
export type MinimumdoelSoort = "TeBereikenIndividueel" | "TeBereikenPopulatie" | "NaTeStreven";

/**
 * One row of the minimumdoelen register: one minimumdoel, in its place in the decree's ordering (TB-010). The three
 * levels are null when the ordering is not known, which is every minimumdoel imported before TB-010 until the next
 * minimumdoelen import.
 */
export interface MinimumdoelRegel {
  ref: string;
  leeftijd: string;
  nr: string;
  /** Decreed text, plain, with its list items on lines of their own (`\n- `): render with `whitespace-pre-line`. */
  omschrijving: string;
  leergebied: string | null;
  rubriek: string | null;
  subrubriek: string | null;
  /** How many stored leerplandoelen concord to it. */
  aantalLeerplandoelen: number;
  /** Their distinct jaar/fasen, kleuter before lager, in the server's order. */
  jaarFasen: string[];
  /**
   * Only when no stored leerplandoel concords to it: why, as the last applied leerplandoelen import derived it from its
   * snapshot (owner ruling 2026-09-13). Null when that is not known, and then nothing is said.
   */
  zonderLeerplandoelReden: ZonderLeerplandoelReden | null;
  /** With `AlleenOvergeslagenDoelsets`: KOV's goal-set marks (`Z`, `V`, …). Empty otherwise. */
  zonderLeerplandoelDoelsets: string[];
}

export type ZonderLeerplandoelReden = "AlleenOvergeslagenDoelsets" | "GeenDoelInOpstap" | "DoelNietIngelezen";

export interface MinimumdoelenPagina {
  regels: MinimumdoelRegel[];
  totaal: number;
  overslaan: number;
  aantal: number;
}

export interface SubrubriekFacet {
  naam: string;
  aantal: number;
}

export interface RubriekFacet {
  naam: string;
  aantal: number;
  /** The minimumdoelen directly under the rubriek, because the decree gives them no third level. */
  aantalZonderSubrubriek: number;
  subrubrieken: SubrubriekFacet[];
}

export interface LeergebiedFacet {
  naam: string;
  aantal: number;
  rubrieken: RubriekFacet[];
}

export interface LeeftijdFacet {
  leeftijd: string;
  aantal: number;
}

/**
 * The minimumdoelen tree under the filter, in the decree's order (TB-010). Each minimumdoel sits in one branch, so the
 * counts add up: the leergebieden plus `aantalZonderOrdening` make `aantalTreffers`.
 */
export interface MinimumdoelFacetten {
  /** Every stored minimumdoel, whatever the filter. */
  totaalAantalMinimumdoelen: number;
  /** The minimumdoelen the filter matches. */
  aantalTreffers: number;
  /** Of those, the ones whose ordering is not known. */
  aantalZonderOrdening: number;
  leergebieden: LeergebiedFacet[];
  /** Per leeftijd code (`K-`, `4-`, `6-`), the minimumdoelen the rest of the filter matches. */
  leeftijden: LeeftijdFacet[];
}

/** A leerplandoel as the minimumdoel detail lists it. */
export interface GeconcordeerdLeerplandoel {
  code: string;
  tekst: string;
  disciplineNaam: string | null;
  domein: string;
  subdomein: string;
  nietMeerInOpstap: boolean;
}

export interface JaarFaseLeerplandoelen {
  jaarFase: string;
  leerplandoelen: GeconcordeerdLeerplandoel[];
}

/** One minimumdoel in full, with the leerplandoelen that concord to it per jaar/fase (TB-010). */
export interface MinimumdoelDetail {
  ref: string;
  leeftijd: string;
  nr: string;
  omschrijving: string;
  leergebied: string | null;
  rubriek: string | null;
  subrubriek: string | null;
  soort: MinimumdoelSoort | null;
  nietMeerInOpstap: boolean;
  aantalLeerplandoelen: number;
  /** Every jaar/fase in order, each with its leerplandoelen (possibly none): the server owns the vocabulary. */
  jaarFasen: JaarFaseLeerplandoelen[];
  zonderLeerplandoelReden: ZonderLeerplandoelReden | null;
  zonderLeerplandoelDoelsets: string[];
}

export interface MinimumdoelFilterQuery {
  zoek?: string;
  /** A mijlpaal: `K-`, `4-` or `6-`. */
  leeftijd?: string;
  /** Discipline, domein, subdomein and jaar/fase reach a minimumdoel through its concorded leerplandoelen. */
  discipline?: string;
  domein?: string;
  subdomein?: string;
  jaarFase?: string;
  /** One branch of the tree, for the list: named from the top. */
  leergebied?: string;
  rubriek?: string;
  subrubriek?: string;
  zonderSubrubriek?: boolean;
  zonderOrdening?: boolean;
  overslaan?: number;
  aantal?: number;
}

// --- Selection context ---

export interface KlasWeergave {
  id: string;
  schooljaarId: string;
  naam: string;
  leerjaar: number;
  aantalSubthemas: number;
  /** What this class is MEASURED against: one code once the school records one, otherwise what the leerjaar can say. */
  jaarFasen: string[];
  /** What the school has recorded, or null when it has not. */
  jaarfase: string | null;
  /**
   * The codes a form may offer for `jaarfase`, empty when there is nothing to ask.
   *
   * From the server, deliberately: `Jaarfasen` is domain vocabulary and a list spelled out here would be a second
   * answer to "what may this class teach?". Same rule as `jaarFasen` itself.
   */
  mogelijkeJaarfasen: string[];
  /**
   * Whether this klas can hold children in the ontwikkelingsrapport (FB-001, ADR-0035 D9). From the server's one
   * klas→leeftijden mapping, for the same reason as the two above: comparing `jaarfase` to "K3" here would be a
   * second mapping, and directie's graadklas decision (Art. XIV) would then have to change it too.
   */
  kanLeerlingenHebben: boolean;
}

export interface SchooljaarSamenvatting {
  id: string;
  naam: string;
  start: string;
  eind: string;
}

// --- Schoolcontent (thema, subthema, activiteit) ---

/**
 * The activiteit kinds the server accepts, as a value rather than only as a type.
 *
 * A picker needs the list at runtime, and deriving the type FROM the list keeps the two from
 * drifting: adding a kind here is the only edit needed, and removing one breaks every use.
 */
export const ACTIVITEIT_TYPES = [
  "Experiment",
  "Prentenboek",
  "Hoek",
  "Uitstap",
  "Spel",
  "Waarneming",
  "Beweging",
  "Onderzoek",
] as const;

export type ActiviteitType = (typeof ACTIVITEIT_TYPES)[number];

export interface DoelKoppelingWeergave {
  id: string;
  leerplandoelCode: string;
  status: KoppelingStatus;
  aiMotivatie: string | null;
}

export interface ThemadoelWeergave {
  id: string;
  koppeling: DoelKoppelingWeergave;
}

export interface SubdoelWeergave {
  id: string;
  leeftijd: string;
  koppeling: DoelKoppelingWeergave;
}

export interface OnderzoeksvraagWeergave {
  id: string;
  vraag: string;
  probleemstelling: string | null;
}

/**
 * The six colours a teacher may put on an activiteit.
 *
 * Here rather than beside the Tailwind classes that paint them, because this is part of what the
 * server stores and sends: it travels on an activiteit AND on a weekplanning row. `features/
 * activiteiten/kleuren.ts` owns how each one looks and re-exports these two names, so nothing else
 * had to move.
 */
export const ACTIVITEITKLEUREN = ["Klei", "Olijf", "Zee", "Indigo", "Pruim", "Zand"] as const;

export type Activiteitkleur = (typeof ACTIVITEITKLEUREN)[number];

export interface ActiviteitWeergave {
  id: string;
  naam: string;
  /** Null when the activiteit has no soort (FB-050). */
  activiteitType: ActiviteitType | null;
  hoek: string | null;
  verwachteUitkomsten: string | null;
  onderzoeksvraagId: string | null;
  kleur: Activiteitkleur | null;
  /**
   * How long this activiteit runs by DEFAULT, in units of 50 minutes.
   *
   * It is what a newly placed block gets; the block itself then owns its own begin and end (ADR-0028), so making
   * one Thursday longer changes nothing here. The unit is a leftover: the column is still `lengte_in_lesuren`
   * because renaming it waits on a stale claim, and ADR-0028 decision 2 is where that is written down.
   */
  lengteInLesuren?: number;
  doelkoppelingen: DoelKoppelingWeergave[];
  /**
   * Who created it, or null: imported, older than the rule, or its maker was removed (ADR-0030 R26, I17). It decides
   * one thing, the maker's delete while no goal is linked (R25, R33), which `lib/rechten.ts` compares with `/api/ik`.
   * Optional because a fixture or an older server may leave it out; absent reads as no maker, the safe direction.
   */
  makerId?: string | null;
  /**
   * The owner of an own activiteit, or null for a shared one (ADR-0049). Optional for the reason `makerId` is: absent
   * reads as shared, which grants only what the shared rows grant.
   */
  eigenaarId?: string | null;
  /** The owner's name, for a colleague's own activiteit; null when unknown or shared. */
  eigenaarNaam?: string | null;
}

export interface SubthemaWeergave {
  id: string;
  themaId: string;
  naam: string;
  duurWeken: number;
  /**
   * The age this subthema is for, and the whole of its scope (Art. IX.2 as amended 2026-08-30).
   *
   * It used to sit beside a `klasId`. A subthema now holds for every klas that teaches this age, so there is no
   * class to name: two K3 classes share this one and each keeps its own dagplanning.
   */
  leeftijd: string;
  onderzoeksvragen: OnderzoeksvraagWeergave[];
  subdoelen: SubdoelWeergave[];
  activiteiten: ActiviteitWeergave[];
}

/**
 * A minimumdoel a thema aims at: one of its themadoelen (FB-043). Only the ref; the text and the leerplandoelen it brings
 * along are the minimumdoel's own detail.
 */
export interface ThemaMinimumdoelWeergave {
  id: string;
  minimumdoelRef: string;
}

export interface ThemaWeergave {
  id: string;
  naam: string;
  duurWeken: number;
  invalshoeken: string | null;
  kernwoordenschat: string[];
  rijkeWoordenschat: string[];
  /** Whether the thema aims at at least two minimumdoelen: advisory (Art. IX.2). */
  heeftVoldoendeThemadoelen: boolean;
  /** Themadoelen that link a leerplandoel. No screen adds one any more; the FR-1 import still may. */
  themadoelen: ThemadoelWeergave[];
  /** The themadoelen a teacher sees: the minimumdoelen the thema aims at (FB-043). */
  minimumdoelen: ThemaMinimumdoelWeergave[];
  subthemas: SubthemaWeergave[];
  /** The thema's emoji, shown beside its naam (FB-060). Null or absent when it has none. */
  icoon?: string | null;
}

/** Where in a thema a leerplandoel is linked (FB-009). */
export type DoelPlaatsSoort = "Themadoel" | "Subdoel" | "Activiteit";

export interface DoelPlaats {
  soort: DoelPlaatsSoort;
  /** The subthema's name for a subdoel, the activiteit's for an activiteit doel; null for a themadoel. */
  naam: string | null;
}

/** A leerplandoel a thema reaches at one leeftijd, once, with every place it is linked. */
export interface OverzichtLeerplandoel {
  code: string;
  doelsoort: Doelsoort;
  tekst: string;
  nietMeerInOpstap: boolean;
  minimumdoelRef: string | null;
  plaatsen: DoelPlaats[];
}

/** What a thema reaches at one leeftijd: leerplandoelen only (FB-044); its minimumdoelen are its themadoelen. */
export interface LeeftijdDoelen {
  leeftijd: string;
  leerplandoelen: OverzichtLeerplandoel[];
}

/**
 * What a thema reaches per leeftijd (FB-009): computed by the server from the decided links under it, never stored, and
 * never dekking (that belongs to a klas with a plan, Art. V.1).
 */
export interface ThemaDoelenoverzicht {
  themaId: string;
  leeftijden: LeeftijdDoelen[];
}

/**
 * A subthema at an age this klas teaches, named with its thema (`GET /api/subthemas/voor-klas/{klasId}`). A thin row
 * for a picker, not a subtree: the agenda's activiteiten list offers these and loads the chosen one's activiteiten.
 */
export interface SubthemaBestemming {
  id: string;
  naam: string;
  leeftijd: string;
  themaId: string;
  themaNaam: string;
}

export interface ThemaBibliotheekItem {
  id: string;
  naam: string;
  duurWeken: number;
  invalshoeken: string | null;
  kernwoordenschat: string[];
  rijkeWoordenschat: string[];
  heeftVoldoendeThemadoelen: boolean;
  themadoelen: ThemadoelWeergave[];
  minimumdoelen: ThemaMinimumdoelWeergave[];
  /** The thema's emoji, shown beside its naam (FB-060). Null or absent when it has none. */
  icoon?: string | null;
}

// --- A thema's doelsuggesties (FR-4, FB-053): the AI proposes minimumdoelen as themadoel. Advisory only (Art. IV). ---

export interface DoelMatchSuggestie {
  id: string;
  minimumdoelRef: string;
  /** Voorgesteld until decided, then Aanvaard (the minimumdoel is a themadoel) or Geweigerd. */
  status: KoppelingStatus;
  aiMotivatie: string;
  /** The minimumdoel's decreed text; null when its ref no longer resolves. */
  omschrijving: string | null;
  /** Its mijlpaal ("K-", "4-", "6-"); null when its ref no longer resolves. */
  mijlpaal: string | null;
}

export interface DoelMatchResultaat {
  isGeslaagd: boolean;
  fout: string | null;
  bewaard: DoelMatchSuggestie[];
  overgeslagenOnbekend: string[];
  overgeslagenDuplicaat: string[];
  aantalKandidaten: number;
  /** The leeftijden the run was for (TB-007): the choice sent, or else the leeftijden of the subthema's. */
  jaarFasen: string[];
  /** The mijlpalen those leeftijden meet, whose minimumdoelen were the candidates. */
  mijlpalen: string[];
}

// --- Subdoelplaatsing (FB-057, ADR-0050). Advisory only: open proposals count for nothing until decided. ---

export interface SubdoelvoorstelWeergave {
  id: string;
  leerplandoelCode: string;
  tekst: string | null;
  doelsoort: Doelsoort | null;
  /** Set for a goal proposed for an existing subthema; null inside a proposed new one. */
  subthemaId: string | null;
  aiMotivatie: string;
}

export interface SubthemavoorstelWeergave {
  id: string;
  naam: string;
  onderzoeksvraag: string;
  duurWeken: number;
  aiMotivatie: string;
  doelen: SubdoelvoorstelWeergave[];
}

export interface LeeftijdPlaatsing {
  leeftijd: string;
  /** Leerplandoelen of the themadoelen in no subthema of this leeftijd yet. Needs no AI. */
  aantalOpen: number;
  /** Whether the caller may decide here; without it the two lists arrive empty (D6). */
  magBeslissen: boolean;
  subdoelvoorstellen: SubdoelvoorstelWeergave[];
  subthemavoorstellen: SubthemavoorstelWeergave[];
}

export interface SubdoelplaatsingOverzicht {
  themaId: string;
  leeftijden: LeeftijdPlaatsing[];
}

export interface SubdoelplaatsingResultaat {
  isGeslaagd: boolean;
  aantalVoorgesteld: number;
  aantalNieuweSubthemas: number;
  aantalOvergeslagen: number;
  fout: string | null;
}

export interface SubthemavoorstelBeslissing {
  status: Extract<KoppelingStatus, "Aanvaard" | "Geweigerd">;
  naam?: string;
  onderzoeksvraag?: string;
  duurWeken?: number;
  leerplandoelCodes?: string[];
}

// --- Jaarplan (FR-6, FR-7, ADR-0053) ---

/**
 * A placement's place in its thema's run: the parts the server stored around a vacation. Derived by the server,
 * never stored.
 */
export interface Reeks {
  /** This part's position, 1-based. */
  deel: number;
  aantalDelen: number;
  reeksVan: string;
  reeksTot: string;
  /** The whole lesweken the run spans. */
  weken: number;
  /** The run ends on another day than the thema's duration proposes. */
  eindeAangepast: boolean;
  /** The run was cut because the school year ends first. */
  stoptBijEindeSchooljaar: boolean;
}

/** One thema placed from one day to another, both inclusive. */
export interface Themaplaatsing {
  id: string;
  themaId: string;
  themaNaam: string;
  van: string;
  tot: string;
  /** The vacations changed and one now lies inside, or the placement left the year. Never moved by the app. */
  isVervallen: boolean;
  status: KoppelingStatus;
  aiMotivatie: string | null;
  vergrendeld: boolean;
  doelcodes: string[];
  duurWeken: number;
  reeks: Reeks | null;
  /** The thema's emoji (FB-060). Null or absent when it has none. */
  themaIcoon?: string | null;
}

/** A Monday-to-Friday week holding at least one schooldag. */
export interface Lesweek {
  maandag: string;
  heeftThema: boolean;
}

export interface Jaarbalans {
  lesweken: number;
  metThema: number;
  zonderThema: number;
}

export interface JaarplanWeergave {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  eersteSchooldag: string;
  laatsteSchooldag: string;
  plaatsingen: Themaplaatsing[];
  lesweken: Lesweek[];
  balans: Jaarbalans;
}

/** The end the server proposes for a thema and a first day, and the parts it would store. */
export interface Eindvoorstel {
  van: string;
  tot: string;
  delen: { van: string; tot: string }[];
  beperktDoor: "VolgendThema" | "Schooljaar" | null;
  volgendThemaNaam: string | null;
}

export interface Dekkingsvooruitzicht {
  aantalGedektNu: number | null;
  aantalGedektNaAanvaarding: number | null;
  aantalLeerplandoelen: number;
}

// --- Planningsrooster: a school year's span and its vacations ---

export interface Planningsonderbreking {
  naam: string;
  start: string;
  eind: string;
}

export interface Planningsrooster {
  schooljaarId: string;
  schooljaarNaam: string;
  start: string;
  eind: string;
  onderbrekingen: Planningsonderbreking[];
}

// --- Dekking (FR-9) ---

export type Dekkingsbereik = "EigenJaarFase" | "HeelCurriculum";

/**
 * Why a goal is not covered, and so where closing it happens (E5-05). Ordered by how close the goal is to being
 * covered; the server takes the first that applies.
 */
export type Lacuneoorzaak = "WachtOpBeslissing" | "PlaatsingGeweigerd" | "NietIngepland" | "KoppelingNietBeslist" | "GeenThema";

/** Where a goal stands for a klas (Art. V.1, ADR-0047). */
export type Dekkingsstap = "Geen" | "Prognose" | "Gedekt";

export interface LeerplandoelDekking {
  code: string;
  doelsoort: Doelsoort;
  jaarFase: string;
  /** The leergebied: the overview's top level (TB-022). */
  disciplineNummer: string;
  /** Null only when the number has no row on the server; show the number then. */
  disciplineNaam: string | null;
  domein: string;
  subdomein: string;
  tekst: string;
  minimumdoelRef: string | null;
  nietMeerInOpstap: boolean;
  isGedekt: boolean;
  dekkendeThemas: string[];
  /**
   * The planned algemene fiches of this class that cover the goal (owner ruling, 2026-09-11). `isGedekt` is true
   * exactly when this or `dekkendeThemas` is non-empty, so neither list alone says whether a goal is covered.
   */
  dekkendeFiches: string[];
  /**
   * The own activiteiten planned in this class's agenda that cover the goal (ADR-0049 D7). Optional for an older server;
   * absent reads as none.
   */
  dekkendeActiviteiten?: string[];
  /** Why the goal is not covered (E5-05); null exactly when it is. */
  oorzaak: Lacuneoorzaak | null;
  /** The thema's a teacher would act on to close the gap, for its cause only. Empty for GeenThema. */
  kandidaatThemas: string[];
  stap: Dekkingsstap;
  /** What aims at the goal: "subthema (thema)" for a subthema link, the thema for a doelsuggestie. */
  prognoseBronnen: string[];
}

/** One minimumdoel of the klas's mijlpaal and where it stands; it counts only through a thema (ADR-0047). */
export interface MinimumdoelDekking {
  ref: string;
  leeftijd: string;
  nr: string;
  omschrijving: string;
  leergebied: string | null;
  rubriek: string | null;
  subrubriek: string | null;
  nietMeerInOpstap: boolean;
  stap: Dekkingsstap;
  isGedekt: boolean;
  /** Every thema it is a themadoel of. */
  prognoseThemas: string[];
  /** Those of them placed in this klas's plan. */
  dekkendeThemas: string[];
  oorzaak: Lacuneoorzaak | null;
  kandidaatThemas: string[];
}

/**
 * The coverage figures without the goals themselves (`GET .../dekking/voortgang`).
 *
 * The server computes it through the same service and the same scope rules as the full read, so the
 * two cannot drift: a bar and the screen it links to are one number rendered twice, not two numbers
 * that agree today.
 */
export interface Dekkingsvoortgang {
  bereik: Dekkingsbereik;
  gemetenJaarFasen: string[];
  isTerugvalNaarHeelCurriculum: boolean;
  aantalBuitenBereik: number;
  isBetrouwbaar: boolean;
  aantalOnopgelosteVervallenPlaatsingen: number;
  /** Null together with `aantalMogelijkGedekt` while a stale placement makes the figure unsound. */
  aantalGedekt: number | null;
  aantalMogelijkGedekt: number | null;
  aantalLeerplandoelen: number;
  aantalOnbereikbaar: number;
}

export interface DekkingWeergave {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  bereik: Dekkingsbereik;
  gemetenJaarFasen: string[];
  beschikbareJaarFasen: string[];
  isTerugvalNaarHeelCurriculum: boolean;
  aantalBuitenBereik: number;
  isBetrouwbaar: boolean;
  aantalOnopgelosteVervallenPlaatsingen: number;
  aantalGedekt: number | null;
  aantalLeerplandoelen: number;
  doelen: LeerplandoelDekking[];
  /** Leerplandoelen in the prognose and not yet gedekt; null with the other figures. */
  aantalInPrognose: number | null;
  aantalMinimumdoelenGedekt: number | null;
  aantalMinimumdoelenInPrognose: number | null;
  aantalMinimumdoelen: number;
  minimumdoelen: MinimumdoelDekking[];
}

// --- Weekplanning: activiteiten on individual teaching days (E9-03, FR-6.2/FR-7.2) ---

export interface GeplandeActiviteit {
  plaatsingId: string;
  activiteitId: string;
  activiteitNaam: string;
  activiteitType: string | null;
  subthemaId: string;
  subthemaNaam: string;
  themaId: string;
  themaNaam: string;
  /**
   * When this runs on its day, as `HH:mm:ss` (ADR-0028).
   *
   * It replaced `volgorde`, an ordinal into seven numbered lesuren. The end is stored per placement, so making one
   * Thursday's block longer leaves every other day this activiteit is planned on alone.
   */
  begin: string;
  einde: string;
  status: string;
  /** The teacher's own colour, if they gave it one. Sent on the weekplanning row as well as on the
   *  activiteit, so a calendar can paint it without fetching the thema. */
  kleur: Activiteitkleur | null;
  doelcodes: string[];
  /**
   * The activiteit's thema is not planned in the themaperiode this day falls in.
   *
   * Not an error and not blocked: a teacher may deliberately run one activity outside its own
   * period. It is surfaced because it is the kind of thing that happens by accident far more often
   * than on purpose.
   */
  valtBuitenThemaperiode: boolean;
}

export interface Dagweergave {
  datum: string;
  isLesdag: boolean;
  sluitingsnaam: string | null;
  activiteiten: GeplandeActiviteit[];
}

/**
 * A stretch of days a teacher marked off for a subthema.
 *
 * It exists independently of what is scheduled inside it, which is the whole reason the server stores it: a subthema
 * with one activiteit ready still runs the five days that were marked off. The calendar draws the UNION of these
 * ranges and the days that carry an activiteit of the same subthema, so the two can never contradict each other.
 */
export interface Subthemaperiode {
  /** The window's own id: what a hoekverrijking is written against (FB-020). */
  id: string;
  subthemaId: string;
  subthemaNaam: string;
  themaId: string;
  themaNaam: string;
  van: string;
  tot: string;
}

export interface Weekplanning {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  van: string;
  tot: string;
  dagen: Dagweergave[];
  subthemaperiodes: Subthemaperiode[];
}
