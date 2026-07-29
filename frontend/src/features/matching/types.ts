/**
 * The AI goal-match domain types shared across the matching feature (E2, FR-4). Names mirror the
 * backend read view (`DoelMatchSuggestieWeergave`) and the `KoppelingStatus` enum (Art. IV.2),
 * serialised by name — so the status strings are PascalCase exactly as the API sends/accepts them.
 */

/** The human-in-the-loop status of a doelsuggestie (Art. IV.2). */
export type SuggestieStatus = "Voorgesteld" | "Aanvaard" | "Geweigerd" | "Manueel";

/** A teacher decision on a suggestion (E2-05): accept / reject / adjust — never `Voorgesteld` (AI-only). */
export type Leerkrachtbeslissing = Exclude<SuggestieStatus, "Voorgesteld">;

/**
 * One persisted AI goal-match suggestion for a thema (FR-4.3).
 *
 * `tekst` and `doelsoort` are the leerplandoel's own official content, added in E2-08: FR-4.2 wants the
 * teacher to be able to *judge* a suggestion, and a bare code plus one AI sentence is not enough for
 * that. Both are nullable — a code that no longer resolves is still shown, never hidden.
 */
export interface Doelsuggestie {
  id: string;
  leerplandoelCode: string;
  status: SuggestieStatus;
  aiMotivatie: string | null;
  tekst: string | null;
  doelsoort: DoelsoortNaam | null;
}

/**
 * Which Op.stap leerplandoelen a match run may choose from (E2-08). Every dimension is optional and an
 * omitted/empty one means "no filter", so leaving all of them out searches the whole loaded set.
 *
 * It is part of the request on purpose: "which disciplines does the school start with?" is an open
 * decision (Constitution Art. XIV), so the scope of a run stays the teacher's visible, per-run choice
 * rather than something the frontend or backend picks for them.
 */
export interface Leerdoelselectie {
  disciplines?: string[];
  jaarFasen?: string[];
}

/**
 * The outcome of one match run (E2-08, FR-4.1): what was proposed, what was skipped, and how many
 * leerplandoelen were actually searched.
 *
 * `aantalKandidaten` matters more than it looks: without it, "0 suggesties" cannot be told apart from
 * "there were no leerplandoelen to search" — which, until the Op.stap import ships, is the likelier
 * cause and is not an AI problem at all.
 */
export interface Doelsuggestiegeneratie {
  isGeslaagd: boolean;
  fout: string | null;
  aantalKandidaten: number;
  bewaard: Doelsuggestie[];
  overgeslagenOnbekend: string[];
  overgeslagenDuplicaat: string[];
}

/**
 * The Op.stap doelsoort as the API serialises it — the backend `Doelsoort` enum by name (Art. VII.1).
 * The `DoelsoortBadge` uses its own lowercase keys, so the view maps between the two.
 */
export type DoelsoortNaam =
  | "Minimumdoel"
  | "Gemeenschappelijk"
  | "Verdieping"
  | "Precurriculum"
  | "Specifiek"
  | "AnderstaligeNieuwkomers";

/**
 * One leerplandoel that is (nog) niet aan een thema gekoppeld (E2-06, FR-4.4). Mirrors the backend
 * `OngekoppeldDoelWeergave`. A doel is only "gekoppeld" once a suggestion is aanvaard or a manual link
 * exists (status aanvaard/manueel, Art. V) — so a doel with only an open suggestion appears here.
 */
export interface OngekoppeldDoel {
  code: string;
  doelsoort: DoelsoortNaam;
  jaarFase: string;
  domein: string;
  subdomein: string;
  tekst: string;
}
