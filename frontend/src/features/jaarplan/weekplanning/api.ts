import { apiFetch } from "../../../lib/api";
import type { Dagplanning, Dagwijziging, Weekplanning } from "./types";

/**
 * The week view's API calls (E9-04, FR-6.2/FR-7.2). Thin wrappers over {@link apiFetch}; caching is TanStack Query's
 * job (see `useWeekplanning`).
 *
 * **All three mutating calls return the whole affected week**, matching the endpoints and the rule the kalender's five
 * placement edits already follow: one response re-renders the grid, so a drop never leaves the screen briefly
 * disagreeing with the server about which day an activiteit is on.
 */

/**
 * The days between `van` and `tot`, inclusive, with what is scheduled on them.
 *
 * **The server clamps the range to the school year rather than refusing it**, so the week containing the first or last
 * school day is renderable — and the response says which range it actually answered. Read `van`/`tot` off the response,
 * never off the request.
 *
 * Both dates are `encodeURIComponent`'d even though an ISO date needs no escaping: the day these become a
 * caller-supplied string rather than something `weekVan` produced, the escaping is already there.
 */
export function haalWeekplanning(klasId: string, van: string, tot: string): Promise<Weekplanning> {
  return apiFetch<Weekplanning>(
    `/api/klassen/${klasId}/jaarplan/weekplanning` +
      `?van=${encodeURIComponent(van)}&tot=${encodeURIComponent(tot)}`,
  );
}

/**
 * Schedules one activiteit onto one day. The placement lands as `Manueel` — nothing here proposes anything, so there is
 * no status for a teacher to review (Art. IV.2).
 *
 * Refused with a **400** when the day is closed or outside the school year, when the activiteit is already on that day,
 * or when it belongs to another class. Those `detail` sentences are Dutch and teacher-actionable by design (Art. II.3,
 * `OngeldigeDagplanningFout`), so unlike the 422 from a malformed AI answer they **may** be rendered — but the caller
 * still decides, because only the caller knows whether an alternative exists to offer.
 */
export function planActiviteit(klasId: string, planning: Dagplanning): Promise<Weekplanning> {
  return apiFetch<Weekplanning>(`/api/klassen/${klasId}/jaarplan/weekplanning`, {
    method: "POST",
    body: JSON.stringify(planning),
  });
}

/**
 * Moves a scheduled activiteit to another day and/or another position within it.
 *
 * **Reversible, unlike a thema move**, and no screen may claim otherwise: nothing is rewritten and nothing is
 * destroyed, because there is no AI motivation to lose and no proposal to override — every placement here is already the
 * teacher's own. `Themaplaatsing.VerplaatsNaar` has to clear a motivation and rewrite a status, which is what makes a
 * thema move a small unrecoverable edit that E3-07 discloses before it happens. Copying that disclosure onto this would
 * warn about a consequence that cannot occur, which trains teachers to dismiss the warnings that matter.
 */
export function verplaatsActiviteit(
  klasId: string,
  plaatsingId: string,
  wijziging: Dagwijziging,
): Promise<Weekplanning> {
  return apiFetch<Weekplanning>(
    `/api/klassen/${klasId}/jaarplan/weekplanning/${plaatsingId}/dag`,
    { method: "PUT", body: JSON.stringify(wijziging) },
  );
}

/**
 * Takes an activiteit off its day, whatever its status — an explicit teacher action is the one actor Art. IV.2 allows to
 * discard a human decision.
 *
 * **It is also the remediation three server-side delete guards name.** Deleting an activiteit, a subthema or a thema is
 * refused while any of its activiteiten sit in the weekplanning, and all three messages tell the teacher to clear it
 * first. If this call ever stops working, those three refusals become dead ends.
 */
export function verwijderActiviteitplaatsing(
  klasId: string,
  plaatsingId: string,
): Promise<Weekplanning> {
  return apiFetch<Weekplanning>(
    `/api/klassen/${klasId}/jaarplan/weekplanning/${plaatsingId}`,
    { method: "DELETE" },
  );
}
