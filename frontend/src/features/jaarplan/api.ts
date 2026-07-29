import { apiFetch } from "../../lib/api";
import type { Jaarplan, Planningsrooster } from "./types";

/**
 * The kalender's API calls (E3-06, FR-6.1). Thin wrappers over {@link apiFetch}; caching is
 * TanStack Query's job (see useJaarplan).
 *
 * Read-only for now on purpose. Moving a thema between periods is E3-07 (drag-and-drop) and it is
 * the story that also owns the confirmation guarding an accepted or locked placement, so shipping a
 * mutation here would ship the destructive half without the safeguard.
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
