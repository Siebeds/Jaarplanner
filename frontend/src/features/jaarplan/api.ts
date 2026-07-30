import { apiFetch } from "../../lib/api";
import type {
  Generatieparameters,
  Generatieresultaat,
  Jaarplan,
  Plaatsingstatus,
  Planningsrooster,
  Themakeuze,
} from "./types";

/**
 * The kalender's API calls (E3-06 read, E3-04 parameters, E3-07 edit). Thin wrappers over {@link apiFetch};
 * caching is TanStack Query's job (see useJaarplan).
 *
 * The three editing calls all return the **whole updated plan** rather than the changed placement, matching
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
 */
export function haalRooster(schooljaarId: string): Promise<Planningsrooster> {
  return apiFetch<Planningsrooster>(`/api/schooljaren/${schooljaarId}/rooster`);
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
): Promise<Generatieresultaat> {
  // No parameters means no body at all, not an empty object: the server treats both identically, and sending
  // nothing keeps a plain run byte-for-byte the request it always was.
  return apiFetch<Generatieresultaat>(`/api/klassen/${klasId}/jaarplan/generatie`, {
    method: "POST",
    ...(parameters ? { body: JSON.stringify(parameters) } : {}),
  });
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
