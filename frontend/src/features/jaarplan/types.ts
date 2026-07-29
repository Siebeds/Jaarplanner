/**
 * Wire types for the kalender (E3-06, FR-6.1). These mirror the backend read models exactly —
 * `PlanningsroosterWeergave` / `JaarplanWeergave` — and nothing here is derived or renamed, so a
 * drift between the two is a compile error at the call site rather than a wrong picture.
 *
 * Dates arrive as ISO `yyyy-MM-dd` strings (C# `DateOnly`). They are kept as strings: every use here
 * is comparison or display, both of which are correct on ISO strings, and parsing to `Date` would
 * introduce a timezone that a school year does not have.
 */

/** One derived block of the planning grid. Never a month or a week — a tier + a span (ADR-0013). */
export interface Planningsblok {
  /** 1-based display position ("periode 3"). Display only; it shifts when vakanties change. */
  ordinaal: number;
  /** First day covered. **This is the key** a placement matches on (ADR-0020 §3). */
  start: string;
  /** Last day covered, inclusive. */
  eind: string;
  /** For a subthemaperiode, the themaperiode it nests in; null for a themaperiode. */
  ouderOrdinaal: number | null;
  /** Days the school is open in this block — what the ribbon sizes blocks on. */
  aantalOpenDagen: number;
}

/** A vakantie: a literal gap between two blocks in the ribbon. */
export interface Planningsonderbreking {
  naam: string;
  start: string;
  eind: string;
}

/** The school year's derived grid. */
export interface Planningsrooster {
  schooljaarId: string;
  schooljaarNaam: string;
  start: string;
  eind: string;
  niveau: string;
  /** Human-readable description of the configured grain, e.g. "themaperiode 5 wk, subthemaperiode 2 wk". */
  blokindeling: string;
  blokken: Planningsblok[];
  onderbrekingen: Planningsonderbreking[];
}

/** The persisted human-in-the-loop status of a placement (Art. IV.2). */
export type Plaatsingstatus = "Voorgesteld" | "Aanvaard" | "Geweigerd" | "Manueel";

/** One thema placed in a block. */
export interface Themaplaatsing {
  id: string;
  themaId: string;
  themaNaam: string;
  blokNiveau: string;
  /** The block start date this placement keys on. */
  blokStart: string;
  blokEind: string | null;
  blokOrdinaal: number | null;
  /**
   * True when `blokStart` is no longer the start of any derived block — the school edited its vakanties
   * and this placement points at a date that is not a period boundary. It must **never** be silently
   * relocated or hidden (directie 2026-07-28).
   */
  isVervallen: boolean;
  status: Plaatsingstatus;
  aiMotivatie: string | null;
  vergrendeld: boolean;
  /** The leerplandoel codes this thema carries. Derived server-side; dekking is never stored (Art. V.1). */
  doelcodes: string[];
}

/** One block's share of the plan, as measured after generation (E3-02, FR-5.2). */
export interface Blokspreiding {
  ordinaal: number;
  start: string;
  aantalThemas: number;
  /** Distinct leerplandoelen carried by the thema's in this block. */
  aantalDoelen: number;
  /** Sum of the placed thema's durations, in weeks. */
  benodigdeWeken: number;
  /** The block's own span in weeks. */
  beschikbareWeken: number;
  /** True when the placed thema's need more weeks than the block spans. */
  isOverbelast: boolean;
}

/**
 * How a generated plan is spread over the year (E3-02, FR-5.2).
 *
 * **Advisory and threshold-free by design.** There is no "good/bad" verdict here, because nothing in the
 * functional analysis defines an acceptable spread and inventing a limit in code would answer a question that
 * belongs to the school — the same reasoning that keeps the kalender's "te vol" threshold provisional.
 */
export interface Spreidingsrapport {
  aantalBlokken: number;
  aantalGebruikteBlokken: number;
  blokken: Blokspreiding[];
  legeBlokOrdinalen: number[];
  overbelasteBlokOrdinalen: number[];
  minsteDoelenInEenBlok: number;
  meesteDoelenInEenBlok: number;
}

/** The outcome of one generation run (FR-5.1). On failure nothing is persisted (Art. IV.5). */
export interface Generatieresultaat {
  isGeslaagd: boolean;
  fout: string | null;
  jaarplan: Jaarplan | null;
  /** Placements added by this run, each as `Voorgesteld` (Art. IV.2). */
  aantalNieuw: number;
  /** Pre-existing placements left alone because they were locked or already decided on. */
  aantalBehouden: number;
  onbekendeThemas: string[];
  onbekendeBlokken: string[];
  duplicaten: string[];
  afgewezen: string[];
  spreiding: Spreidingsrapport | null;
}

/** A class's jaarplan as the calendar reviews it. */
export interface Jaarplan {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  blokindeling: string;
  plaatsingen: Themaplaatsing[];
}
