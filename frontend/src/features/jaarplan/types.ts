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

/** A class's jaarplan as the calendar reviews it. */
export interface Jaarplan {
  klasId: string;
  klasNaam: string;
  schooljaarId: string;
  schooljaarNaam: string;
  blokindeling: string;
  plaatsingen: Themaplaatsing[];
}
