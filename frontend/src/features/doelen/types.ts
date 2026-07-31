/**
 * The Doelen-register types (E1-16, FR-2.4). Names mirror the backend read views
 * (`LeerplandoelRegelWeergave`, `LeerplandoelDetailWeergave`, `LeerplandoelFacettenWeergave`); enums are
 * serialised by name, so the strings here are PascalCase exactly as the API sends them.
 *
 * Everything is read-only reference data (Art. III.1). There is deliberately **no** request type for
 * changing a leerplandoel anywhere in this feature, because no such endpoint exists.
 */
import type { DoelsoortNaam } from "../../components/doelsoort";
import type { SuggestieStatus } from "../matching/types";

export type { DoelsoortNaam };

/** One row of the register. Narrow on purpose: the list renders thousands of these. */
export interface DoelRegel {
  code: string;
  doelsoort: DoelsoortNaam;
  jaarFase: string;
  domein: string;
  subdomein: string;
  tekst: string;
  minimumdoelRef: string | null;
  /** The re-import's review flag: gone from Op.stap, still in use (Art. III.4 / IV.2). */
  nietMeerInOpstap: boolean;
}

/** One page of the register plus the total the filter matches, so "meer laden" can be honest. */
export interface DoelenPagina {
  regels: DoelRegel[];
  totaal: number;
  overslaan: number;
  aantal: number;
}

/**
 * The decreed minimumdoel behind a concordance, when its row is loaded.
 *
 * Null while **E1-12** has not imported the decreed source: the per-discipline goal Excel carries the
 * concordance key but no omschrijving, so `minimumdoelen` is empty. That is a different statement from
 * "this doel is not concorded", which is `minimumdoelRef === null` — the detail must not merge them.
 */
export interface MinimumdoelWeergave {
  ref: string;
  leeftijd: string;
  nr: string;
  omschrijving: string;
}

/** Which layer of school content a link to this doel lives in (Art. IX.2). */
export type KoppelingHerkomst = "Themadoel" | "Doelsuggestie" | "Subdoel" | "Activiteit";

/**
 * One link between this doel and a piece of school content, with the teacher's decision on it (Art. IV.2).
 * Every status is reported, including `Voorgesteld` and `Geweigerd` — wider than the Art. V coverage
 * definition, because the question this screen answers is "which thema's mention this doel, and what was
 * decided?".
 */
export interface DoelKoppelingWeergave {
  herkomst: KoppelingHerkomst;
  themaNaam: string;
  /** The subthema or activiteit name for a class/age-scoped link; null at thema level. */
  onderdeel: string | null;
  status: SuggestieStatus;
}

/** Everything one leerplandoel holds. Optional Op.stap columns are null when the source left them empty. */
export interface DoelDetail {
  code: string;
  doelsoort: DoelsoortNaam;
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
  koppelingen: DoelKoppelingWeergave[];
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

/**
 * A domein with its subdomeinen nested inside it. The nesting is the Art. VII.0 rule made structural:
 * subdomein names are not globally unique, so a subdomein is only offerable together with its domein.
 */
export interface DomeinFacet {
  domein: string;
  aantal: number;
  subdomeinen: SubdomeinFacet[];
}

export interface DoelsoortFacet {
  doelsoort: DoelsoortNaam;
  aantal: number;
}

export interface JaarFaseFacet {
  jaarFase: string;
  aantal: number;
}

/**
 * The filter vocabulary, built from the loaded rows rather than from a hard-coded enum.
 *
 * That is a constraint, not a convenience: three open Art. XIV decisions touch exactly these lists (which
 * disciplines are in scope, whether `leergebied`/Wereldoriëntatie is surfaced, and whether jaar/fase reads
 * 1K/2K/3K or JK/K2/K3). A list compiled into the UI would answer all three silently.
 *
 * `totaalAantalDoelen` is the unfiltered count, and it is what separates "nothing is imported yet" from
 * "your filters exclude everything" — two empty states that must never share a message.
 */
export interface DoelenFacetten {
  totaalAantalDoelen: number;
  disciplines: DisciplineFacet[];
  domeinen: DomeinFacet[];
  doelsoorten: DoelsoortFacet[];
  jaarFasen: JaarFaseFacet[];
}

/**
 * The active filter, as the URL carries it (ADR-0021: the URL is the source of truth, so a filtered view is
 * shareable and survives a reload). Every field is optional; an absent field means "no filter".
 */
export interface Doelenfilter {
  zoek?: string;
  discipline?: string;
  domein?: string;
  subdomein?: string;
  doelsoort?: DoelsoortNaam;
  jaarFase?: string;
}
