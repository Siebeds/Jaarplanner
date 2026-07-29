import { apiFetch } from "../../lib/api";
import type { Generatieresultaat, Jaarplan, Planningsrooster } from "./types";

/**
 * The kalender's API calls (E3-06, FR-6.1). Thin wrappers over {@link apiFetch}; caching is
 * TanStack Query's job (see useJaarplan).
 *
 * Moving a thema between periods is still absent on purpose: that is E3-07 (drag-and-drop), which also
 * owns the confirmation guarding an accepted or locked placement, so shipping it here would ship the
 * destructive half without its safeguard. Generation is different — it only ever *adds* proposals and
 * never discards a human decision, so it is safe to trigger before E3-07 exists.
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
export function genereerJaarplan(klasId: string): Promise<Generatieresultaat> {
  return apiFetch<Generatieresultaat>(`/api/klassen/${klasId}/jaarplan/generatie`, {
    method: "POST",
  });
}
