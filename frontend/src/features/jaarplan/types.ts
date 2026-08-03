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

/**
 * The two tiers the calendar can be viewed at (E3-08, FR-6.3).
 *
 * Mirrors the backend `Planningsblokniveau` enum, whose names are what `?niveau=` accepts and what
 * `Planningsrooster.niveau` returns. **Deliberately a tier, never a calendar unit** — there is no `Maand` member
 * here for the same reason the domain enum has none and guards it with a test (Art. IX.3, ADR-0013): the grain is
 * the school's ratified themaperiode/subthemaperiode pair, and a month would compile in an assumption Art. XIV
 * still leaves open.
 *
 * `Planningsrooster.niveau` stays a plain `string`, because it is what the server said rather than what this app
 * asked for; the string is turned into one of these members by {@link leesNiveau}, and the comparison that decides
 * whether a placement can be moved goes through {@link GENERATIEBLOKNIVEAU}.
 */
export type Planningsblokniveau = "Themaperiode" | "Subthemaperiode";

/**
 * The tiers as **data**, so the compiler can count them (E3-08 fix round 4, antagonist MINOR-4b).
 *
 * The union above was the only statement of "which tiers exist", and every place that had to *act* on a tier spelled
 * the two literals out again: two comparisons in `Jaarplankalender`, the option list in `Weergaveschakelaar`, a
 * ternary per tier-specific sentence. So **adding a third `Planningsblokniveau` errored nowhere.** A valid new
 * cadence would have fallen through every one of those comparisons into the unrecognised-tier degrade, where a
 * teacher reads *"De tool kon deze weergave van het schooljaar niet lezen … Meld dit aan de beheerder van de tool"*
 * about a tier the tool was in fact asked to draw. `satisfies Record<Planningsblokniveau, …>` moves that failure to
 * the one place it belongs: a missing-property error in front of the developer who adds the tier.
 *
 * The values carry nothing. The **keys** are the content, and their insertion order (defined for string keys in JS)
 * is the coarse-to-fine order the zoom control offers: a teacher zooms *in* from the year, not out from a fortnight.
 *
 * *What this does not buy, stated because Art. XIV's resolved promise is broader than the code:* the block unit is
 * "configurable without a code change" for the **backend** grain (`Planning:Blokindeling`, the E3-05 seam), and it
 * stays that. A new *tier* was never configuration on this side, and after this round it is a compile error rather
 * than a false sentence on a teacher's screen. The failure mode changed; the promise did not.
 */
const NIVEAUTABEL = {
  Themaperiode: null,
  Subthemaperiode: null,
} satisfies Record<Planningsblokniveau, null>;

/**
 * Every tier this app can draw, coarse first. Derived from {@link NIVEAUTABEL}, never hand-listed, so it cannot
 * disagree with the union: `satisfies` rejects a missing key (TS1360) **and** an unknown one (TS2353), both checked by
 * mutation rather than assumed.
 *
 * The one assertion in this file, and it is sound for that reason: `Object.keys` is typed `string[]` with no way to
 * narrow it, while the object it reads has exactly the union's keys by the check above. Written as an ordered list
 * rather than as a second literal, because a hand-written array of union members is *not* checked for completeness —
 * a two-element array satisfies `readonly Planningsblokniveau[]` however many members the union grows to, which is the
 * defect this whole seam exists to remove.
 */
export const PLANNINGSBLOKNIVEAUS = Object.keys(NIVEAUTABEL) as readonly Planningsblokniveau[];

/**
 * The server's own `niveau` string as a tier this app can draw, or `null` when it is one this app does not know.
 *
 * A lookup rather than a pair of `===` comparisons, and a `find` rather than `in`: `"constructor" in NIVEAUTABEL` is
 * `true` through the prototype chain, which would let an unrecognised answer pass as a tier. `null` for "not one of
 * ours" is the state the board renders its own copy for; it is deliberately not widened to the union.
 */
export function leesNiveau(niveau: string): Planningsblokniveau | null {
  return PLANNINGSBLOKNIVEAUS.find((kandidaat) => kandidaat === niveau) ?? null;
}

/**
 * The tier a generated thema is placed on, and therefore the tier a **kept generation setting** keys on.
 *
 * Mirrors `JaarplanGeneratieService.GeneratieNiveau` (`Planningsblokniveau.Themaperiode`) and exists because the
 * pairing used to be silent: `/rooster` happens to default to this tier, so handing the board's blocks to the
 * parameter form was correct by coincidence. **E3-08 made it reachable:** the zoom now does fetch
 * `Subthemaperiode`, and blocks of that tier would flag every kept preference as "zonder periode" and offer rows
 * whose dates the server reports as `vervallenStartthemas`. Comparing against this constant makes that a checked
 * condition instead of an assumption.
 *
 * It is also what decides whether a **move** is possible on the board at all: `VerplaatsPlaatsingAsync` derives its
 * candidate blocks at this same tier, so a target date that is not a themaperiode start is a 400 (see
 * {@link Themaplaatsing.blokNiveau} and the note in `Periodekolom`).
 *
 * Kept as a bare string literal on purpose: a backend test reads this declaration and compares it against
 * `JaarplanGeneratieService.GeneratieNiveau`, so moving the tier fails a test instead of silently degrading the
 * form to "another tier" forever. Do not add a type annotation here.
 */
export const GENERATIEBLOKNIVEAU = "Themaperiode";

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
  /**
   * Superseded proposals this run **discarded**. Non-zero means the plan changed even when `aantalNieuw` is 0,
   * so the UI must not claim nothing happened.
   */
  aantalVervangen: number;
  onbekendeThemas: string[];
  onbekendeBlokken: string[];
  duplicaten: string[];
  afgewezen: string[];
  spreiding: Spreidingsrapport | null;
  /** What became of the teacher's pre-generation parameters (E3-04, FR-5.4); absent when none were sent. */
  parameters: Parameterrapport | null;
}

/**
 * What the teacher sets before a run (E3-04, FR-5.4), and what the class **keeps** between runs since the owner's
 * ruling of 2026-07-30: the same shape is posted with a generation and returned by `GET …/jaarplan/parameters`.
 *
 * **Vakanties are deliberately absent.** They are schooljaar data (FR-12.1, the beheerder) and the planning grid
 * is derived from them, so a block can never span one. Offering them here would be a second place to enter the
 * school calendar.
 */
export interface Generatieparameters {
  /** One entry per period the teacher has a preference for. Order is irrelevant: each names its own period. */
  gewensteStartthemas: Startthemakeuze[];
  vasteMomenten: VastMoment[];
}

/**
 * One start-thema preference: the thema a given period should open with.
 *
 * **Keyed on `blokStart`, not on array position.** The contract was positional until 2026-07-30 (the i-th name
 * targeted the i-th period), which is an ordinal in different clothing and which ADR-0020 §3 rules out as a block
 * key. Storing an ordinal would have been worse still, since it survives exactly the vakantie edits that invalidate
 * it. Everything awkward about this form existed only to survive the positional contract: the growing list, the
 * clear-cascade, and the rule that a gap had to be inexpressible. A gap is now just "no preference".
 */
export interface Startthemakeuze {
  /** The target period's start date, the same stable key a placement and a move use. */
  blokStart: string;
  themaNaam: string;
}

/**
 * A date the school has already committed inside a teaching period. Anything that *closes* the school is a
 * schoolsluiting on the schooljaar instead, not one of these.
 */
export interface VastMoment {
  naam: string;
  /** ISO `yyyy-MM-dd`. Never shown to a teacher in this form — see `formatteerDatum`. */
  datum: string;
  /**
   * Required, with no default, and the form gives it no pre-selected value on purpose: the server rejects the
   * moment outright when it is missing. `false` would otherwise be indistinguishable from a run with no
   * parameters at all, i.e. a control that silently does nothing.
   */
  blokkeertPlaatsing: boolean;
}

/** One placement the run refused because a blocking vast moment holds its period. */
export interface GeweigerdePlaatsing {
  themaNaam: string;
  blokStart: string;
  momentNaam: string;
  /** The model's own reason, kept so a refusal is not a silent loss: the teacher can still place it by hand. */
  aiMotivatie: string | null;
}

/** What became of one vast moment. `blokStart` is null when its date falls in no period. */
export interface VastMomentUitkomst {
  naam: string;
  datum: string;
  blokkeertPlaatsing: boolean;
  blokStart: string | null;
}

/**
 * The parameter report (E3-04). Like the spreading report it states facts and passes no judgement, and it keeps
 * four outcomes apart because a teacher acts differently on each: the model declined a request; the teacher's own
 * two instructions conflicted; the tool refused a placement; or an instruction could not be applied at all.
 */
export interface Parameterrapport {
  onbekendeStartthemas: string[];
  gehonoreerdeStartthemas: string[];
  nietGehonoreerdeStartthemas: string[];
  tegenstrijdigeStartthemas: string[];
  /**
   * Kept preferences whose period no longer exists, because the vakantiedata changed after they were saved. Never
   * dropped and never moved to a neighbouring period (directie 2026-07-28); the form says so too, before a run.
   */
  vervallenStartthemas: Startthemakeuze[];
  geweigerdDoorVastMoment: GeweigerdePlaatsing[];
  toegepasteVasteMomenten: VastMomentUitkomst[];
  onplaatsbareVasteMomenten: VastMomentUitkomst[];
  heeftAandachtspunten: boolean;
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

/** Just enough of a thema to offer it in a picker: the name is what the generation contract keys on. */
export interface Themakeuze {
  id: string;
  naam: string;
}
