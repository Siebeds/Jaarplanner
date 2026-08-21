/**
 * Types mirroring the backend's Application-layer DTOs (see backend/src/Jaarplanner.Application).
 * Kept as plain string-literal unions rather than TS `enum` — `erasableSyntaxOnly` in
 * tsconfig.app.json disallows non-erasable syntax like enums, and the backend serialises its C#
 * enums by name (System.Text.Json string enum converter) so a literal union is the honest mirror.
 */

export type Doelsoort =
  | "Minimumdoel"
  | "Gemeenschappelijk"
  | "Verdieping"
  | "Precurriculum"
  | "Specifiek"
  | "AnderstaligeNieuwkomers";

export const DOELSOORT_CODE: Record<Doelsoort, string> = {
  Minimumdoel: "MD",
  Gemeenschappelijk: "G",
  Verdieping: "+",
  Precurriculum: "P",
  Specifiek: "S",
  AnderstaligeNieuwkomers: "A",
};

export const DOELSOORT_LABEL: Record<Doelsoort, string> = {
  Minimumdoel: "Minimumdoel",
  Gemeenschappelijk: "Gemeenschappelijk",
  Verdieping: "Verdieping",
  Precurriculum: "Precurriculum (illustratief)",
  Specifiek: "Specifiek (illustratief)",
  AnderstaligeNieuwkomers: "Anderstalige nieuwkomers (illustratief)",
};

export type KoppelingStatus = "Voorgesteld" | "Aanvaard" | "Geweigerd" | "Manueel";

export type ActiviteitType =
  | "Experiment"
  | "Prentenboek"
  | "Hoek"
  | "Uitstap"
  | "Spel"
  | "Waarneming"
  | "Beweging"
  | "Onderzoek";

export const ACTIVITEIT_TYPE_LABEL: Record<ActiviteitType, string> = {
  Experiment: "Experiment",
  Prentenboek: "Prentenboek",
  Hoek: "Hoek",
  Uitstap: "Uitstap",
  Spel: "Spel",
  Waarneming: "Waarneming",
  Beweging: "Beweging",
  Onderzoek: "Onderzoek",
};

export type Dekkingsbereik = "EigenJaarFase" | "HeelCurriculum";
export type Planningsblokniveau = "Themaperiode" | "Subthemaperiode";

// --- Curriculum (Leerplandoelen) ---

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

export interface MinimumdoelWeergave {
  ref: string;
  leeftijd: string;
  nr: string;
  omschrijving: string;
}

export type KoppelingHerkomst = "Themadoel" | "Doelsuggestie" | "Subdoel" | "Activiteit";

export interface DoelKoppelingContext {
  herkomst: KoppelingHerkomst;
  themaNaam: string;
  onderdeel: string | null;
  klasNaam: string | null;
  status: KoppelingStatus;
}

/** Another leerplandoel concorded to the same minimumdoel — see DoelDetailPage's "Gerelateerde doelen". */
export interface GerelateerdLeerplandoelWeergave {
  code: string;
  tekst: string;
  jaarFase: string;
  domein: string;
  subdomein: string;
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
  gerelateerdeDoelen: GerelateerdLeerplandoelWeergave[];
}

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

// --- Minimumdoelen (wettelijke eindtermen, per Art. VII.0) ---

export interface MinimumdoelRegel {
  ref: string;
  leeftijd: string;
  nr: string;
  omschrijving: string;
  disciplineNummer: string;
  disciplineNaam: string;
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

// --- Schoolcontent (Thema/Subthema/Activiteit) ---

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

export interface SubthemaBestemming {
  id: string;
  naam: string;
  leeftijd: string;
  themaId: string;
  themaNaam: string;
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

export interface ThemaCreatie {
  naam: string;
  duurWeken: number;
  invalshoeken?: string | null;
  kernwoordenschat?: string[] | null;
  rijkeWoordenschat?: string[] | null;
}

export interface OnderzoeksvraagInvoer {
  vraag: string;
  probleemstelling?: string | null;
}

export interface SubthemaCreatie {
  naam: string;
  duurWeken: number;
  klasId: string;
  leeftijd: string;
  onderzoeksvragen?: OnderzoeksvraagInvoer[];
}

export interface ActiviteitCreatie {
  naam: string;
  activiteitType: ActiviteitType;
  hoek?: string | null;
  verwachteUitkomsten?: string | null;
  onderzoeksvraagId?: string | null;
}

/** PUT payload shapes mirror their creatie counterparts exactly (backend replaces the full record). */
export type ThemaWijziging = ThemaCreatie;
export type SubthemaWijziging = SubthemaCreatie;
export type ActiviteitWijziging = ActiviteitCreatie;

// --- AI matching (thema-level doelsuggesties) ---

export interface DoelMatchSuggestieWeergave {
  id: string;
  leerplandoelCode: string;
  status: string;
  aiMotivatie: string | null;
  tekst: string | null;
  doelsoort: Doelsoort | null;
}

export interface DoelMatchResultaat {
  isGeslaagd: boolean;
  fout: string | null;
  bewaard: DoelMatchSuggestieWeergave[];
  overgeslagenOnbekend: string[];
  overgeslagenDuplicaat: string[];
  aantalKandidaten: number;
}

export interface LeerdoelSelectie {
  disciplines?: string[] | null;
  jaarFasen?: string[] | null;
}

// --- AI authoring (thema-opbouw wizard hooks) ---

export interface ThemaOpbouwContext {
  naam: string;
  invalshoeken?: string | null;
  duurWeken?: number | null;
  kernwoordenschat?: string[] | null;
  rijkeWoordenschat?: string[] | null;
}

export interface SubthemaOpbouwContext {
  naam: string;
  leeftijd: string;
  duurWeken?: number | null;
  probleemstelling?: string | null;
  onderzoeksvraag?: string | null;
}

export interface ThemaOpbouwAdvies {
  code: string;
  motivatie: string;
}

export interface ThemaOpbouwAdviesResultaat {
  isGeslaagd: boolean;
  fout: string | null;
  suggesties: ThemaOpbouwAdvies[];
  overgeslagenOnbekend: string[];
}

/** A leerplandoel not (yet) linked to any thema — the FR-4.4 gap list, reused here to seed "nieuwe thema's". */
export interface OngekoppeldDoelWeergave {
  code: string;
  doelsoort: Doelsoort;
  jaarFase: string;
  domein: string;
  subdomein: string;
  tekst: string;
}

// --- Klassen / Schooljaren ---

export interface KlasWeergave {
  id: string;
  schooljaarId: string;
  naam: string;
  leerjaar: number;
  aantalSubthemas: number;
}

export interface KlasCreatie {
  naam: string;
  leerjaar: number;
}

export interface SchoolsluitingWeergave {
  naam: string;
  start: string;
  eind: string;
  soort: string;
}

export interface KlasVerwijzing {
  id: string;
  naam: string;
  leerjaar: number;
}

export interface SchooljaarWeergave {
  id: string;
  naam: string;
  start: string;
  eind: string;
  sluitingen: SchoolsluitingWeergave[];
  klassen: KlasVerwijzing[];
}

export interface PlanningsblokWeergave {
  ordinaal: number;
  start: string;
  eind: string;
  ouderOrdinaal: number | null;
  aantalOpenDagen: number;
}

export interface PlanningsonderbrekingWeergave {
  naam: string;
  start: string;
  eind: string;
}

export interface PlanningsroosterWeergave {
  schooljaarId: string;
  schooljaarNaam: string;
  start: string;
  eind: string;
  niveau: string;
  blokindeling: string;
  blokken: PlanningsblokWeergave[];
  onderbrekingen: PlanningsonderbrekingWeergave[];
}

// --- Jaarplan ---

export interface GeblokkeerdePeriodeWeergave {
  blokStart: string;
  momentNaam: string;
}

export interface ThemaplaatsingWeergave {
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

export interface BlokspreidingWeergave {
  blokStart: string;
  benodigdeWeken: number;
  beschikbareWeken: number;
  isOverbelast: boolean;
}

export interface JaarplanWeergave {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  blokindeling: string;
  plaatsingen: ThemaplaatsingWeergave[];
  blokken: BlokspreidingWeergave[];
  geblokkeerdePeriodes: GeblokkeerdePeriodeWeergave[];
}

export interface Startthemakeuze {
  blokStart: string;
  themaNaam: string;
}
export interface VastMoment {
  naam: string;
  datum: string;
  blokkeertPlaatsing: boolean;
}
export interface JaarplanGeneratieParameters {
  gewensteStartthemas: Startthemakeuze[];
  vasteMomenten: VastMoment[];
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

export interface Dekkingsvooruitzicht {
  aantalGedektNu: number | null;
  aantalGedektNaAanvaarding: number | null;
  aantalLeerplandoelen: number;
}

// --- Dekking ---

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
