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

/**
 * Which layer of school content a link to this doel lives in (Art. IX.2).
 *
 * The scope differs across them and that difference is load-bearing: `Themadoel` and `Doelsuggestie` are
 * school-wide, while `Subdoel` and `Activiteit` belong to **one klas and one leeftijd**.
 */
export type KoppelingHerkomst = "Themadoel" | "Doelsuggestie" | "Subdoel" | "Activiteit";

/**
 * One link between this doel and a piece of school content, with the teacher's decision on it (Art. IV.2).
 * Every status is reported, including `Voorgesteld` and `Geweigerd` — wider than the Art. V coverage
 * definition, because the question this screen answers is "where does this doel appear?" rather than "is it
 * covered?". Only `Aanvaard` and `Manueel` make a doel gedekt, which is why the status is never omitted.
 */
export interface DoelKoppelingWeergave {
  herkomst: KoppelingHerkomst;
  themaNaam: string;
  /** The subthema or activiteit name for a class/age-scoped link; null at thema level. */
  onderdeel: string | null;
  /**
   * The klas a class/age-scoped link belongs to (Art. IX.2); null for the school-wide layers. It is what stops
   * one class's subdoel from reading as something the whole school does.
   */
  klasNaam: string | null;
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
 * **The option sets are stable; the counts follow the active filter.** Each count is computed under the rest of
 * the filter, so a number means "pick this and you get this many", and a zero is sent as `0` rather than
 * omitted. Previously a count described the whole curriculum, so with Discipline = Wiskunde chosen the register
 * still offered "Natuur (3)" and delivered nothing.
 *
 * `totaalAantalDoelen` is the one **unfiltered** figure, and it is what separates "nothing is imported yet"
 * from "your filters exclude everything" — two empty states that must never share a message.
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
  /**
   * One jaar/fase code, or **several** matched as "any of".
   *
   * **Two shapes, one dimension** (E9-07). The register's own filter is a single select and keeps a single value in the
   * URL; the Doelkiezer scopes to everything a class teaches, and a kleutergroep teaches three codes because
   * `Leerjaar = 0` cannot say which kleuterjaar it is. A second field (`jaarFasen`) would be two names for one
   * dimension and would drift the first time only one of them was updated, so this is a union that
   * {@link buildParams} serialises as a repeatable `?jaarFase=`, which is exactly what the endpoint accepts.
   *
   * `schrijfFilter` and `actieveDimensies` both test `typeof === "string"`, so the list form is deliberately invisible
   * to the URL: the picker has no shareable state to write, and a repeated parameter in a filter chip would be a
   * control the register does not have.
   */
  jaarFase?: string | readonly string[];
}
