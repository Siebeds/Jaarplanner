import { apiFetch } from "../../lib/api";
import type {
  Activiteit,
  ActiviteitInvoer,
  DoelKoppeling,
  Subdoel,
  Subthema,
  SubthemaBestemming,
  SubthemaInvoer,
  Thema,
  ThemaBibliotheekItem,
  ThemaInvoer,
  Themadoel,
} from "./types";

/**
 * The beheer surface's API calls (E1-14 over E1-10's endpoints, FR-3.1/3.2/3.3).
 *
 * Thin wrappers over {@link apiFetch}; caching and invalidation are TanStack Query's job (`useThemas`).
 * Nothing here composes a user-facing sentence: a fault arrives as an `ApiError` and the component decides
 * what a teacher reads (Art. II.3).
 *
 * **Three routes, one per level, and that is the server's shape rather than an accident.** A thema is
 * addressed under `/api/themas`, a subthema under `/api/subthemas/{id}` and an activiteit under
 * `/api/activiteiten/{id}` — the child levels are addressed **directly**, not nested under their parent, so a
 * caller needs the child's own id and never has to know its ancestors. The two exceptions are the *create*
 * calls, which necessarily post to the parent that will own the new row.
 *
 * **A write does not have to know which thema it touched.** For the child levels the response body does not
 * always carry one (an activiteit's view has no `themaId`), and rather than thread an ancestor id through every
 * call, the mutation hooks invalidate the whole `["thema", …]` prefix. That is a handful of cache entries at
 * primary-school volume, and it removes a class of bug where a correct write leaves a stale screen because the
 * caller passed the wrong parent.
 */

// --- Reads ---

/**
 * The shared thema-bibliotheek: the school-wide layer of every thema, with no class's subthema's in it.
 *
 * **This is the beheer screens' only school-wide read, and `GET /api/themas` is deliberately not wrapped.**
 * That endpoint returns every thema with every class's subthema's, subdoelen, activiteiten and links. Nothing
 * in this feature needs it: the list shows the school-wide layer, the detail's school-wide half shows the same
 * fields, and the class-scoped half asks {@link haalThemaVoorKlas} for exactly one class. Wrapping it "in case"
 * would put every class's content in the tab, one component away from being rendered, and "no cross-class
 * bleed" (Art. IX.2) would then hold only as long as nobody writes that component.
 *
 * It also carries `aantalAfgeleideKlassen`, which is how uptake and the delete consequence are stated without
 * reading any class's content: a count, not a list.
 */
export function haalThemaBibliotheek(): Promise<ThemaBibliotheekItem[]> {
  return apiFetch<ThemaBibliotheekItem[]>("/api/themas/bibliotheek");
}

/**
 * One thema as derived for one klas: the shared thema plus **only that class's** subthema's (Art. IX.2).
 *
 * The detail screen asks for this rather than filtering `haalThema` client-side. Filtering here would mean
 * every other class's subthema's, subdoelen and activiteiten were fetched into the tab and merely not
 * displayed, which is the kind of "no cross-class bleed" that holds until someone writes a new component.
 */
export function haalThemaVoorKlas(themaId: string, klasId: string): Promise<Thema> {
  return apiFetch<Thema>(`/api/themas/${themaId}/voor-klas/${klasId}`);
}

/**
 * Every subthema of **one klas**, across all thema's: the destinations an activiteit may move to (E4-08).
 *
 * A separate read rather than a widening of {@link haalThemaVoorKlas}, for the reason that read exists: the
 * detail screen holds one thema, and the owner's ruling of 2026-08-05 lets a move cross a thema while never
 * crossing a klas. So the picker needs the klas's whole set, and this endpoint is scoped to exactly that. It is
 * a thin projection (id, naam, leeftijd, thema) rather than the full subtree, so widening the destination list
 * does not widen how much of a class's content the tab holds.
 */
export function haalSubthemaBestemmingen(klasId: string): Promise<SubthemaBestemming[]> {
  return apiFetch<SubthemaBestemming[]>(`/api/subthemas/voor-klas/${klasId}`);
}

// --- Thema (school-wide) ---

export function maakThema(invoer: ThemaInvoer): Promise<Thema> {
  return apiFetch<Thema>("/api/themas", { method: "POST", body: JSON.stringify(invoer) });
}

export function wijzigThema(themaId: string, invoer: ThemaInvoer): Promise<Thema> {
  return apiFetch<Thema>(`/api/themas/${themaId}`, { method: "PUT", body: JSON.stringify(invoer) });
}

/**
 * Delete a thema, its themadoelen and every class's subthema's below it (the server cascades).
 *
 * **It refuses with a 400 when the thema still sits in any jaarplan**, and the message names how many times,
 * across every class. A caller must surface that refusal rather than treat the delete as done: a thema is
 * school-wide, so the blocking plan can belong to a class the deleting teacher never opens.
 */
export function verwijderThema(themaId: string): Promise<void> {
  return apiFetch<void>(`/api/themas/${themaId}`, { method: "DELETE" });
}

/** Link a leerplandoel as one of the thema's 2–3 school-wide themadoelen (FR-3.2). */
export function voegThemadoelToe(themaId: string, leerplandoelCode: string): Promise<Themadoel> {
  return apiFetch<Themadoel>(`/api/themas/${themaId}/themadoelen`, {
    method: "POST",
    body: JSON.stringify({ leerplandoelCode }),
  });
}

export function verwijderThemadoel(themaId: string, themadoelId: string): Promise<void> {
  return apiFetch<void>(`/api/themas/${themaId}/themadoelen/${themadoelId}`, { method: "DELETE" });
}

// --- Subthema (per klas & leeftijd) ---

export function maakSubthema(themaId: string, invoer: SubthemaInvoer): Promise<Subthema> {
  return apiFetch<Subthema>(`/api/themas/${themaId}/subthemas`, {
    method: "POST",
    body: JSON.stringify(invoer),
  });
}

export function wijzigSubthema(subthemaId: string, invoer: SubthemaInvoer): Promise<Subthema> {
  return apiFetch<Subthema>(`/api/subthemas/${subthemaId}`, {
    method: "PUT",
    body: JSON.stringify(invoer),
  });
}

export function verwijderSubthema(subthemaId: string): Promise<void> {
  return apiFetch<void>(`/api/subthemas/${subthemaId}`, { method: "DELETE" });
}

/** Link a leerplandoel to a subthema as a subdoel; the subdoel inherits the subthema's leeftijd. */
export function koppelSubthemaAanDoel(subthemaId: string, leerplandoelCode: string): Promise<Subdoel> {
  return apiFetch<Subdoel>(`/api/subthemas/${subthemaId}/doelkoppelingen`, {
    method: "POST",
    body: JSON.stringify({ leerplandoelCode }),
  });
}

export function ontkoppelSubdoel(subthemaId: string, subdoelId: string): Promise<void> {
  return apiFetch<void>(`/api/subthemas/${subthemaId}/subdoelen/${subdoelId}`, { method: "DELETE" });
}

// --- Activiteit (inherits its subthema's scope) ---

export function maakActiviteit(subthemaId: string, invoer: ActiviteitInvoer): Promise<Activiteit> {
  return apiFetch<Activiteit>(`/api/subthemas/${subthemaId}/activiteiten`, {
    method: "POST",
    body: JSON.stringify(invoer),
  });
}

export function wijzigActiviteit(activiteitId: string, invoer: ActiviteitInvoer): Promise<Activiteit> {
  return apiFetch<Activiteit>(`/api/activiteiten/${activiteitId}`, {
    method: "PUT",
    body: JSON.stringify(invoer),
  });
}

export function verwijderActiviteit(activiteitId: string): Promise<void> {
  return apiFetch<void>(`/api/activiteiten/${activiteitId}`, { method: "DELETE" });
}

/**
 * Move an activiteit to another subthema of the same klas (E4-08, FR-7.2), keeping its attributes and its
 * goal links. Its own route rather than a field on {@link wijzigActiviteit}: the edit payload carries the
 * activiteit's own fields, this one carries its place.
 *
 * **The two failure statuses mean different things and callers should branch on them, not on the sentence.**
 * A **404** is the activiteit itself: it is gone, exactly as after a colleague's delete. A **400** is a reason
 * to show while the picker stays open (a destination in another klas, a destination that no longer exists, or
 * the subthema it already sits in).
 */
export function verplaatsActiviteit(activiteitId: string, doelSubthemaId: string): Promise<Activiteit> {
  return apiFetch<Activiteit>(`/api/activiteiten/${activiteitId}/subthema`, {
    method: "PUT",
    body: JSON.stringify({ doelSubthemaId }),
  });
}

/** Link a leerplandoel to an activiteit (FR-3.2). An activiteit may carry more than one. */
export function koppelActiviteitAanDoel(
  activiteitId: string,
  leerplandoelCode: string,
): Promise<DoelKoppeling> {
  return apiFetch<DoelKoppeling>(`/api/activiteiten/${activiteitId}/doelkoppelingen`, {
    method: "POST",
    body: JSON.stringify({ leerplandoelCode }),
  });
}

export function ontkoppelActiviteitDoel(activiteitId: string, koppelingId: string): Promise<void> {
  return apiFetch<void>(`/api/activiteiten/${activiteitId}/doelkoppelingen/${koppelingId}`, {
    method: "DELETE",
  });
}
