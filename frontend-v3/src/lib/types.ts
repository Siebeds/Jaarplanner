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
