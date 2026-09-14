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

/**
 * Which content layer a register link lives in. For `AlgemeneFiche` there is no thema: `themaNaam` carries the
 * fiche's name and `onderdeel` its klas (server contract, 2026-09-11).
 */
export type KoppelingHerkomst = "Themadoel" | "Doelsuggestie" | "Subdoel" | "Activiteit" | "AlgemeneFiche";

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

/**
 * One row of the minimumdoelen register: a minimumdoel in one (discipline, domein, subdomein) bucket of its concorded
 * leerplandoelen. A minimumdoel no loaded leerplandoel concords arrives once, last, with the three bucket fields null
 * and no codes (E1-22). That null means no loaded goal refers to it, never that the teachers left something out.
 */
export interface MinimumdoelRegel {
  ref: string;
  leeftijd: string;
  nr: string;
  /** Decreed text, plain, with its list items on lines of their own (`\n- `): render with `whitespace-pre-line`. */
  omschrijving: string;
  disciplineNummer: string | null;
  disciplineNaam: string | null;
  domein: string | null;
  subdomein: string | null;
  leerplandoelCodes: string[];
  /**
   * On a row without a bucket only: why no loaded leerplandoel concords it, as the last applied leerplandoelen import
   * derived it from its snapshot (owner ruling 2026-09-13). Null when that is not known, and then nothing is said.
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

export interface MinimumdoelFacetten {
  /** Every stored minimumdoel, whatever the filter. */
  totaalAantalMinimumdoelen: number;
  /** Distinct minimumdoelen the filter matches. The facet counts below are rows, and summing them is not this. */
  aantalTreffers: number;
  /** Of those, the ones no loaded leerplandoel concords. */
  aantalZonderLeerplandoel: number;
  /** Rows per discipline: what the register lists under that heading. */
  disciplines: DisciplineFacet[];
  domeinen: DomeinFacet[];
  jaarFasen: JaarFaseFacet[];
}

export interface MinimumdoelFilterQuery {
  zoek?: string;
  discipline?: string;
  domein?: string;
  subdomein?: string;
  jaarFase?: string;
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

/**
 * The most themadoelen one thema can anchor (Art. IX.2: 2–3).
 *
 * A second copy of `Thema.MaxThemadoelen`, and the only reason it is allowed to exist is that the
 * server does not send the number: a client that wants to stop offering a fourth themadoel before
 * the teacher clicks has nothing else to read. It is a bound, not a rule: the domain still refuses
 * the fourth on its own, so this being wrong would cost a confusing button and never a bad write.
 */
export const MAX_THEMADOELEN = 3;

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
  activiteitType: ActiviteitType;
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

export interface ThemaWeergave {
  id: string;
  naam: string;
  duurWeken: number;
  invalshoeken: string | null;
  kernwoordenschat: string[];
  rijkeWoordenschat: string[];
  heeftVoldoendeThemadoelen: boolean;
  themadoelen: ThemadoelWeergave[];
  subthemas: SubthemaWeergave[];
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
  aantalAfgeleideKlassen: number;
}

// --- AI matching (FR-4). Advisory only: everything lands as Voorgesteld (Art. IV). ---

export interface DoelMatchSuggestie {
  id: string;
  leerplandoelCode: string;
  status: KoppelingStatus;
  aiMotivatie: string | null;
  tekst: string | null;
  doelsoort: Doelsoort | null;
}

export interface DoelMatchResultaat {
  isGeslaagd: boolean;
  fout: string | null;
  bewaard: DoelMatchSuggestie[];
  overgeslagenOnbekend: string[];
  overgeslagenDuplicaat: string[];
  aantalKandidaten: number;
}

// --- Jaarplan (FR-5 to FR-8) ---

export interface Themaplaatsing {
  id: string;
  themaId: string;
  themaNaam: string;
  blokNiveau: string;
  blokStart: string;
  blokEind: string | null;
  blokOrdinaal: number | null;
  isVervallen: boolean;
  status: KoppelingStatus;
  aiMotivatie: string | null;
  vergrendeld: boolean;
  doelcodes: string[];
  duurWeken: number;
}

/**
 * How full one planning period is.
 *
 * The key is `start`, NOT `blokStart` like every other jaarplan shape. Measured against the running
 * API rather than copied from the other frontend, whose type says `blokStart` here and therefore
 * silently matches nothing: every period renders as empty while the plan underneath is full.
 */
export interface Blokspreiding {
  ordinaal: number;
  start: string;
  aantalThemas: number;
  aantalDoelen: number;
  benodigdeWeken: number;
  beschikbareWeken: number;
  isOverbelast: boolean;
}

export interface GeblokkeerdePeriode {
  blokStart: string;
  momentNaam: string;
}

export interface JaarplanWeergave {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  blokindeling: string;
  plaatsingen: Themaplaatsing[];
  blokken: Blokspreiding[];
  geblokkeerdePeriodes: GeblokkeerdePeriode[];
}

export interface Dekkingsvooruitzicht {
  aantalGedektNu: number | null;
  aantalGedektNaAanvaarding: number | null;
  aantalLeerplandoelen: number;
}

export interface JaarplanGeneratieResultaat {
  isGeslaagd: boolean;
  fout: string | null;
  jaarplan: JaarplanWeergave | null;
  aantalNieuw: number;
  aantalBehouden: number;
  aantalVervangen: number;
  onbekendeThemas: string[];
  onbekendeBlokken: string[];
  duplicaten: string[];
  afgewezen: string[];
  vooruitzicht: Dekkingsvooruitzicht | null;
}

// --- Planningsrooster: the periods a school year is cut into ---

export interface Planningsblok {
  ordinaal: number;
  start: string;
  eind: string;
  ouderOrdinaal: number | null;
  aantalOpenDagen: number;
}

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
  niveau: string;
  blokindeling: string;
  blokken: Planningsblok[];
  onderbrekingen: Planningsonderbreking[];
}

// --- Dekking (FR-9) ---

export type Dekkingsbereik = "EigenJaarFase" | "HeelCurriculum";

export interface LeerplandoelDekking {
  code: string;
  doelsoort: Doelsoort;
  jaarFase: string;
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
}

// --- Weekplanning: activiteiten on individual teaching days (E9-03, FR-6.2/FR-7.2) ---

export interface GeplandeActiviteit {
  plaatsingId: string;
  activiteitId: string;
  activiteitNaam: string;
  activiteitType: string;
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
