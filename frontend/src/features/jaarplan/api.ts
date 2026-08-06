import { apiFetch } from "../../lib/api";
import type {
  Generatieparameters,
  Generatieresultaat,
  Jaarplan,
  Plaatsingstatus,
  Planningsblokniveau,
  Planningsrooster,
  Themakeuze,
} from "./types";

/**
 * The kalender's API calls (E3-06 read, E3-04 parameters, E3-07 edit, E4-06 vergrendeling). Thin wrappers over
 * {@link apiFetch}; caching is TanStack Query's job (see useJaarplan).
 *
 * The four editing calls all return the **whole updated plan** rather than the changed placement, matching
 * the endpoints: one response re-renders the board, so a drop never leaves the screen briefly disagreeing
 * with the server about where a thema is.
 */

/** The class's jaarplan: its placements with status, motivation and lock. */
export function haalJaarplan(klasId: string): Promise<Jaarplan> {
  return apiFetch<Jaarplan>(`/api/klassen/${klasId}/jaarplan`);
}

/**
 * The school year's derived planning grid — the blocks and the vakanties between them.
 *
 * Separate from the jaarplan because the plan carries only *placements*: an empty period has no
 * placement, so a ribbon drawn from the plan alone would omit exactly the periods a teacher is
 * looking for room in.
 *
 * **The tier is passed explicitly, never left to the endpoint's default (E3-08, FR-6.3).** The endpoint does
 * default to `Themaperiode`, and relying on that is how the parameter form ended up correct by coincidence — the
 * screen now chooses a tier, so it says which one. The tier is a *derivation* argument rather than a filter: the
 * server re-derives the whole grid per request, so the two tiers are two different answers and must be cached under
 * two different keys (see `roosterKey`).
 */
export function haalRooster(
  schooljaarId: string,
  niveau: Planningsblokniveau,
): Promise<Planningsrooster> {
  return apiFetch<Planningsrooster>(
    `/api/schooljaren/${schooljaarId}/rooster?niveau=${encodeURIComponent(niveau)}`,
  );
}

/**
 * Asks the AI for a plan proposal (FR-5.1) and returns the run's outcome, including how the result is spread
 * over the year (E3-02, FR-5.2).
 *
 * Every placement lands as `Voorgesteld` with a motivation — advisory, never applied (Art. IV.1/IV.2) — and
 * locked or already-decided placements survive the run. A malformed AI response yields **422 with nothing
 * persisted** (Art. IV.5), which surfaces here as an `ApiError` the UI maps to its own Dutch copy: the 422
 * body is an English operator diagnostic and is deliberately never shown to a teacher.
 */
export function genereerJaarplan(
  klasId: string,
  parameters?: Generatieparameters,
  jaarFase?: string,
): Promise<Generatieresultaat> {
  // A body REPLACES the class's kept settings; no body USES them (E3-04 persistence half, owner ruling 2026-07-30).
  // The two are therefore no longer interchangeable, and the difference is what makes clearing possible: an
  // explicitly empty object wipes the settings, where omitting the body would silently reuse them. The form always
  // sends its current state once it has loaded, so `undefined` here means "the form has nothing to say yet" — a run
  // fired before the settings arrived still honours what is stored, which is the right answer either way.
  // `jaarFase` narrows only the dekkingsvooruitzicht the response carries, never the run itself (E3-03). It is sent
  // so the panel's figures and the live dekking line on the same screen are over one denominator: the kalender's
  // kleuterjaar chooser drives both. The server ignores a code that is not one of this class's own.
  const query = jaarFase ? `?jaarFase=${encodeURIComponent(jaarFase)}` : "";

  return apiFetch<Generatieresultaat>(`/api/klassen/${klasId}/jaarplan/generatie${query}`, {
    method: "POST",
    ...(parameters ? { body: JSON.stringify(parameters) } : {}),
  });
}

/**
 * Regenerates **one themaperiode** and leaves the rest of the plan alone (E4-05, FR-8.2).
 *
 * A separate call rather than a flag on {@link genereerJaarplan}, because the two differ in what they do with the
 * class's kept settings: the whole-plan run carries the form and **replaces** them, this one sends no body and only
 * **reads** them. There is no form on this path, so there is nothing for it to save.
 *
 * `blokStart` is the period's **start date**, for the reason given on {@link verplaatsPlaatsing}: an ordinal shifts
 * when the school edits its vakanties (ADR-0020 §3).
 *
 * Three refusals, and the status is how the UI tells them apart without reading Dutch out of a `detail`:
 * - **409** the period holds a blocking vast moment, refused before the model was called. The board withholds the
 *   control for such a period and states the reason in place, so a 409 arriving here means the page is out of date.
 * - **400** the date starts no current period (the grid changed under the page).
 * - **422** the model's answer was unusable and nothing was persisted (Art. IV.5).
 */
export function genereerPeriode(
  klasId: string,
  blokStart: string,
  jaarFase?: string,
): Promise<Generatieresultaat> {
  // Same pass-through as the whole-plan run: it narrows the dekkingsvooruitzicht only, never the run (E3-03).
  const query = jaarFase ? `?jaarFase=${encodeURIComponent(jaarFase)}` : "";

  return apiFetch<Generatieresultaat>(
    `/api/klassen/${klasId}/jaarplan/periodes/${blokStart}/generatie${query}`,
    { method: "POST" },
  );
}

/**
 * The class's **kept** pre-generation settings (E3-04, FR-5.4) — what the form shows instead of starting empty.
 *
 * A class that has never saved any answers with empty lists rather than a 404, so "nothing set" is a normal state and
 * not an error the form has to render. Entries are returned **as stored**: a preference whose period no longer exists
 * comes back unchanged, because dropping it here would hide from the teacher that a setting of theirs was stranded.
 */
export function haalGeneratieparameters(klasId: string): Promise<Generatieparameters> {
  return apiFetch<Generatieparameters>(`/api/klassen/${klasId}/jaarplan/parameters`);
}

/**
/**
 * Moves a thema to another period (E3-07, FR-6.2) and persists it at once (FR-6.5).
 *
 * `blokStart` is the target block's **start date**, never its ordinal: the ordinal is a display position that
 * shifts when the school edits its vakanties, so sending one would reintroduce exactly the silent relocation
 * the date key prevents (ADR-0020 §3).
 *
 * A date that starts no current period is a **400** rather than a nearest-period guess, and so is moving a
 * thema onto a period it already occupies. The server also sets the placement to `Manueel` and drops the AI
 * motivation, because the position is now the teacher's.
 */
export function verplaatsPlaatsing(
  klasId: string,
  plaatsingId: string,
  blokStart: string,
): Promise<Jaarplan> {
  return apiFetch<Jaarplan>(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}/blok`, {
    method: "PUT",
    body: JSON.stringify({ blokStart }),
  });
}

/**
 * Puts a thema in a period **by hand, with no AI involved** (E4-03, FR-7.2).
 *
 * `blokStart` is the period's **start date**, for the reason given on {@link verplaatsPlaatsing}.
 *
 * The one call here that works on a class with **no jaarplan yet**: the server creates the plan on the first
 * hand-placement, which is what makes a fully hand-built year possible. It lands as `Manueel`, so it counts for
 * dekking and a regeneration leaves it standing.
 *
 * **400** when the period starts no current block (the grid changed under the page) or when that thema is
 * already in that period. The picker withholds the second case rather than letting it fail, so a 400 reaching
 * the UI means the plan moved since it loaded.
 */
export function voegPlaatsingToe(
  klasId: string,
  themaId: string,
  blokStart: string,
): Promise<Jaarplan> {
  return apiFetch<Jaarplan>(`/api/klassen/${klasId}/jaarplan/plaatsingen`, {
    method: "POST",
    body: JSON.stringify({ themaId, blokStart }),
  });
}

/**
 * Takes a thema out of a period (FR-7). **Unrecoverable:** there is no soft delete and no audit trail, so the
 * confirmation in the UI is the only protection for accepted or locked teacher work — see `Themakaart`.
 */
export function verwijderPlaatsing(klasId: string, plaatsingId: string): Promise<Jaarplan> {
  return apiFetch<Jaarplan>(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}`, {
    method: "DELETE",
  });
}

/**
 * Records a teacher decision on one placement (Art. IV.2).
 *
 * E3-07 uses it for one case only: reversing a rejection. Before this existed a `Geweigerd` placement could
 * be removed but never restored, so a teacher who changed their mind was stuck. `Voorgesteld` is refused by
 * the server (400) because only the AI produces it.
 */
export function wijzigPlaatsingStatus(
  klasId: string,
  plaatsingId: string,
  status: Exclude<Plaatsingstatus, "Voorgesteld">,
): Promise<Jaarplan> {
  return apiFetch<Jaarplan>(`/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

/**
 * Locks or unlocks one placement against (re)generation (E4-06, FR-8.4, Art. IX.3).
 *
 * **The flag only changes an outcome for a `Voorgesteld` placement.** The server discards exactly the placements
 * that are `Status === Voorgesteld && !Vergrendeld`, so an accepted, manual or rejected placement already survives a
 * run with no lock at all. The endpoint accepts the call for any status anyway, and deliberately so (see
 * `JaarplanGeneratieService.WijzigVergrendelingAsync`); it is `Themakaart` that only offers it where it changes an
 * outcome, because a switch that changes no outcome is the control-that-does-nothing this project banned after
 * E3-06.
 *
 * *Stated as "no outcome", not "nothing observable":* locking a decided placement does show the "Vast" badge and does
 * change the sentence in the edit panel. What it cannot change is whether a regeneration replaces the placement, or
 * whether the thema counts as placed for the dekking.
 *
 * Answers with the whole updated plan, like the other three edits, so the board re-renders from one response.
 */
export function wijzigPlaatsingVergrendeling(
  klasId: string,
  plaatsingId: string,
  vergrendeld: boolean,
): Promise<Jaarplan> {
  return apiFetch<Jaarplan>(
    `/api/klassen/${klasId}/jaarplan/plaatsingen/${plaatsingId}/vergrendeling`,
    { method: "PUT", body: JSON.stringify({ vergrendeld }) },
  );
}

/**
 * The school's thema's, for the startthema pickers (E3-04).
 *
 * A picker rather than a text field on purpose: the server reports a thema name it does not own as
 * `onbekendeStartthemas`, and a picker makes that case far harder to reach than a text field does. A full
 * thema-beheer screen is still E1-14; this only needs the names.
 *
 * **`/bibliotheek`, not `/api/themas`.** The plain list returns `ThemaWeergave`, whose `Subthemas` carry **every
 * class's** class- and age-scoped subthema's, subdoelen and activiteiten — a whole subtree, to fill a dropdown
 * with names. The bibliotheek endpoint exists precisely to avoid that: its own docs say it *"deliberately omits
 * all subthema's … must never leak into the school-wide library view (no cross-class bleed)"* (Art. IX.2). This
 * was the first frontend consumer of either, and it had picked the heavy one.
 */
export function haalThemanamen(): Promise<Themakeuze[]> {
  return apiFetch<Themakeuze[]>("/api/themas/bibliotheek");
}
