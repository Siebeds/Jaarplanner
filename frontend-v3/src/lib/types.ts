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

export type KoppelingHerkomst = "Themadoel" | "Doelsuggestie" | "Subdoel" | "Activiteit";

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
  klasNaam: string | null;
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
  jaarFase?: string;
  overslaan?: number;
  aantal?: number;
}

// --- Minimumdoelen (the decreed eindtermen, Art. VII.0) ---

export interface MinimumdoelRegel {
  ref: string;
  leeftijd: string;
  nr: string;
  omschrijving: string;
  disciplineNummer: string;
  disciplineNaam: string | null;
  domein: string;
  subdomein: string;
  leerplandoelCodes: string[];
}

export interface MinimumdoelenPagina {
  regels: MinimumdoelRegel[];
  totaal: number;
  overslaan: number;
  aantal: number;
}

export interface MinimumdoelFacetten {
  totaalAantalMinimumdoelen: number;
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
  jaarFasen: string[];
}

export interface SchooljaarSamenvatting {
  id: string;
  naam: string;
  start: string;
  eind: string;
}

// --- Schoolcontent (thema, subthema, activiteit) ---

export type ActiviteitType =
  | "Experiment"
  | "Prentenboek"
  | "Hoek"
  | "Uitstap"
  | "Spel"
  | "Waarneming"
  | "Beweging"
  | "Onderzoek";

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

export interface ActiviteitWeergave {
  id: string;
  naam: string;
  activiteitType: ActiviteitType;
  hoek: string | null;
  verwachteUitkomsten: string | null;
  onderzoeksvraagId: string | null;
  doelkoppelingen: DoelKoppelingWeergave[];
}

export interface SubthemaWeergave {
  id: string;
  themaId: string;
  naam: string;
  duurWeken: number;
  klasId: string;
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
  volgorde: number;
  status: string;
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

export interface Weekplanning {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  van: string;
  tot: string;
  dagen: Dagweergave[];
}
