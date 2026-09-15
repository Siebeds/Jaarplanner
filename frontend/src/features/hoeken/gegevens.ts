import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "../../lib/api";

/**
 * The corners of one classroom, read and written from the one screen that defines them.
 *
 * **Its own feature module rather than `lib/queries.ts` or a file under `instellingen/`.** It began
 * under `instellingen/`, where the only screen that used it lived. The agenda now reads the same
 * hoeken to draw its fiches, so a second screen depends on it, and the two honest homes were the
 * shared query file or a module of its own. A module of its own wins on the repo's own rule to
 * organise by feature: these types and hooks are about hoeken, not about queries in general.
 *
 * **Nothing here invalidates `dekking`, unlike the klas mutations.** A hoek carries no
 * doelkoppelingen (owner ruling, 2026-08-30), so no corner can move a coverage figure. Invalidating
 * it anyway would refetch every dekking on screen to prove a number that cannot have changed.
 */

/** A corner as the beheerscherm reads it. Mirrors `HoekWeergave` on the server. */
export interface HoekWeergave {
  id: string;
  klasId: string;
  naam: string;
  omschrijving: string | null;
  /** How often this corner is currently placed on the agenda. Zero for one that is only defined. */
  aantalPlaatsingen: number;
  /** How many verrijkingen were written for it, over every subthemaperiode: what deleting it takes along (FB-020). */
  aantalVerrijkingen: number;
}

/** What a teacher states about a corner. */
export interface HoekInvoer {
  naam: string;
  omschrijving: string | null;
}

/** What taking over another class's corners did: the ones created, and the names already present. */
export interface HoekOvername {
  overgenomen: HoekWeergave[];
  overgeslagen: string[];
}

const sleutel = (klasId: string | null) => ["hoeken", klasId] as const;

/** The corners of one class. Disabled until a class is chosen: there is no school-wide list to fall back on. */
export function useHoeken(klasId: string | null) {
  return useQuery({
    queryKey: sleutel(klasId),
    queryFn: () => get<HoekWeergave[]>(`/api/klassen/${klasId}/hoeken`),
    enabled: klasId !== null,
  });
}

function useHoekVerversing(klasId: string | null) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: sleutel(klasId) });
}

export function useMaakHoek(klasId: string | null) {
  const ververs = useHoekVerversing(klasId);

  return useMutation({
    mutationFn: (invoer: HoekInvoer) => post<HoekWeergave>(`/api/klassen/${klasId}/hoeken`, invoer),
    onSuccess: ververs,
  });
}

/** `PUT` replaces the whole hoek, so the form always sends both fields, never a patch. */
export function useWijzigHoek(klasId: string | null) {
  const ververs = useHoekVerversing(klasId);

  return useMutation({
    mutationFn: ({ hoekId, invoer }: { hoekId: string; invoer: HoekInvoer }) =>
      put<HoekWeergave>(`/api/hoeken/${hoekId}`, invoer),
    onSuccess: ververs,
  });
}

/**
 * Deleting is refused by the server while the corner still stands in the agenda, with the count in
 * the message. That refusal is surfaced verbatim rather than pre-empted here: the count this screen
 * holds is the one it fetched, and the only count that may block a delete is the one the server sees
 * at the moment of the delete.
 */
export function useVerwijderHoek(klasId: string | null) {
  const ververs = useHoekVerversing(klasId);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (hoekId: string) => del(`/api/hoeken/${hoekId}`),
    onSuccess: () => {
      ververs();
      // Its verrijkingen went with it (FB-020).
      void qc.invalidateQueries({ queryKey: ["hoekverrijkingen"] });
    },
  });
}

/**
 * Copies another class's corners into this one. A copy, never a share: the new rows belong to this
 * class from the moment they exist, so renaming one here touches nothing in the class it came from.
 */
export function useNeemHoekenOver(klasId: string | null) {
  const ververs = useHoekVerversing(klasId);

  return useMutation({
    mutationFn: (vanKlasId: string) =>
      post<HoekOvername>(`/api/klassen/${klasId}/hoeken/overnemen`, { vanKlasId }),
    onSuccess: ververs,
  });
}

/* ------------------------------------------------------------------------------------------------
   PLACING A HOEK ON THE AGENDA

   A separate read from the weekplanning, over its own range, because a hoekplaatsing is not part of
   the jaarplan and must not be part of the read model that projects one. One extra request buys the
   property the model exists for: a (re)generation cannot reach what it cannot see.
   ------------------------------------------------------------------------------------------------ */

/** One appearance in the time grid: this day, from this time to that one (ADR-0028). */
export interface HoekmomentWeergave {
  id: string;
  datum: string;
  /** `HH:mm:ss`, as the server sends a TimeOnly. */
  begin: string;
  einde: string;
}

/** A placed hoek as the agenda reads it. What is in the corner is not here: see the verrijkingen below. */
export interface HoekplaatsingWeergave {
  id: string;
  hoekId: string;
  hoekNaam: string;
  van: string;
  tot: string;
  momenten: HoekmomentWeergave[];
}

/** What the teacher answered in the sheet after dropping a fiche on a day. */
export interface HoekplaatsingInvoer {
  hoekId: string;
  van: string;
  tot: string;
  /**
   * When it opens and closes on every teaching day of the window, as `HH:mm:ss`.
   *
   * Required since 2026-09-11 (owner: "elke hoek moet een tijdstip krijgen", ADR-0028). "Niet in het uurrooster"
   * was an answer until then, and it left a corner running over its days with no hour and no block on any day.
   */
  begin: string;
  einde: string;
}

const plaatsingSleutel = (klasId: string | null, van: string, tot: string) =>
  ["hoekplaatsingen", klasId, van, tot] as const;

/**
 * The placements overlapping one date range.
 *
 * Keyed on the range like the weekplanning beside it, so paging a month does not re-read a year, and
 * so the two answers on screen were fetched for the same window.
 */
export function useHoekplaatsingen(klasId: string | null, van: string, tot: string) {
  return useQuery({
    queryKey: plaatsingSleutel(klasId, van, tot),
    queryFn: () =>
      get<HoekplaatsingWeergave[]>(
        `/api/klassen/${klasId}/hoekplaatsingen?van=${van}&tot=${tot}`,
      ),
    enabled: klasId !== null && van.length > 0 && tot.length > 0,
  });
}

/**
 * Invalidates every range at once.
 *
 * The keys carry a range, and a placement made in september changes what a screen showing november
 * must draw whenever the window spans both. Matching on the prefix refetches whichever ranges are
 * actually mounted, which is one or two, rather than trying to work out which of them overlap.
 */
function usePlaatsingVerversing() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["hoekplaatsingen"] });
}

export function usePlaatsHoek(klasId: string | null) {
  const ververs = usePlaatsingVerversing();

  return useMutation({
    mutationFn: (invoer: HoekplaatsingInvoer) =>
      post<HoekplaatsingWeergave>(`/api/klassen/${klasId}/hoekplaatsingen`, invoer),
    onSuccess: ververs,
  });
}

/**
 * Removes a placement, with its timetable rows. The corner's verrijkingen stay: they belong to the hoek and a
 * subthemaperiode, not to a run in the timetable (FB-020).
 *
 * The way back out of a mistake, which is what makes placing safe to offer at all: a teacher who
 * drags a fiche onto the wrong fortnight can undo it without a support call.
 */
export function useVerwijderHoekplaatsing() {
  const ververs = usePlaatsingVerversing();

  return useMutation({
    mutationFn: (plaatsingId: string) => del(`/api/hoekplaatsingen/${plaatsingId}`),
    onSuccess: ververs,
  });
}

/** Where one appearance of a placed hoek should move to, or how long it should run. */
export interface HoekmomentVerplaatsing {
  plaatsingId: string;
  momentId: string;
  datum: string;
  /** `HH:mm:ss`. A resize sends the unchanged begin with a new einde. */
  begin: string;
  einde: string;
}

/**
 * Moves or resizes ONE appearance of a placed hoek (owner, 2026-08-31; clock times since ADR-0028).
 *
 * The rows are stored per day rather than derived exactly so that this is possible: the hoek runs all
 * fortnight and on this one Thursday it happens after the break, or half an hour longer. Moving the
 * whole run is a different verb and is not this hook.
 *
 * **It does not invalidate optimistically and it is not meant to.** The server refuses a day outside
 * the placement's window, a day without school (a weekend day or a closure, TB-011) and a second
 * appearance of the same hoek starting at the same time, and all three refusals are things the teacher
 * has to see rather than watch get undone.
 */
export function useVerplaatsHoekmoment() {
  const ververs = usePlaatsingVerversing();

  return useMutation({
    mutationFn: ({ plaatsingId, momentId, datum, begin, einde }: HoekmomentVerplaatsing) =>
      put<HoekplaatsingWeergave>(`/api/hoekplaatsingen/${plaatsingId}/momenten/${momentId}`, {
        datum,
        begin,
        einde,
      }),
    onSuccess: ververs,
  });
}

/** The hours every day of a run should have, as `HH:mm:ss`. */
export interface Hoekuren {
  plaatsingId: string;
  begin: string;
  einde: string;
}

/**
 * Gives every appearance of a run the same hours, each on the day it is already on (owner, 2026-09-11).
 *
 * **Every day, the ones moved by hand included**: the owner's ruling of the same day. The detail sheet says so before
 * saving when a day currently differs.
 *
 * **One request for the whole run**, not one `useVerplaatsHoekmoment` per day. Fifteen requests of which the eighth
 * fails leave a run half at the old hours, which is worse than not saving at all; the server does it in one save.
 */
export function useZetHoekuren() {
  const ververs = usePlaatsingVerversing();

  return useMutation({
    mutationFn: ({ plaatsingId, begin, einde }: Hoekuren) =>
      put<HoekplaatsingWeergave>(`/api/hoekplaatsingen/${plaatsingId}/uren`, { begin, einde }),
    onSuccess: ververs,
  });
}

/* ------------------------------------------------------------------------------------------------
   WHAT IS IN THE CORNER WHILE A SUBTHEMA RUNS (FB-020, ADR-0041)

   One text per hoek and per subthemaperiode: a window the klas's plan stores for a subthema. Written
   from the subthemabalk above the agenda, and from the hoek's detail sheet; never a block in the grid.
   ------------------------------------------------------------------------------------------------ */

/** The longest text one verrijking may hold. The server refuses anything longer, with the same number. */
export const MAXIMALE_VERRIJKING = 2000;

/** What one hoek holds for one subthemaperiode. */
export interface HoekverrijkingWeergave {
  id: string;
  hoekId: string;
  tekst: string;
}

/** One stored subthemaperiode of the klas, with what each hoek holds while it runs. Mirrors the server's record. */
export interface SubthemaperiodeVerrijkingen {
  subthemaperiodeId: string;
  subthemaId: string;
  subthemaNaam: string;
  van: string;
  tot: string;
  /** One per hoek that has one; empty is the ordinary state of a new window. */
  verrijkingen: HoekverrijkingWeergave[];
}

/**
 * What the sheet saves. A window's id when the klas stores one; otherwise the subthema and the days the agenda draws it
 * on, and the server stores that window first (owner, 2026-09-15). A blank text removes that hoek's verrijking.
 */
export type HoekverrijkingenInvoer = {
  verrijkingen: { hoekId: string; tekst: string }[];
} & (
  | { subthemaperiodeId: string }
  | { subthemaperiodeId: null; subthemaId: string; van: string; tot: string }
);

/**
 * The stored subthemaperiodes of the klas touching a range, each with its verrijkingen.
 *
 * Keyed on the range like the weekplanning, so the agenda's reads over the same range share one request.
 */
export function useHoekverrijkingen(klasId: string | null, van: string, tot: string) {
  return useQuery({
    queryKey: ["hoekverrijkingen", klasId, van, tot] as const,
    queryFn: () => get<SubthemaperiodeVerrijkingen[]>(`/api/klassen/${klasId}/hoekverrijkingen?van=${van}&tot=${tot}`),
    enabled: klasId !== null && van.length > 0 && tot.length > 0,
  });
}

/**
 * Writes the verrijkingen of one subthemaperiode, for every hoek named in the request.
 *
 * **It invalidates the weekplanning too**, because a save for a subthema the agenda drew from its activiteiten alone
 * stores the window first, and from then on the weekplanning names that window.
 */
export function useBewaarHoekverrijkingen(klasId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (invoer: HoekverrijkingenInvoer) =>
      put<SubthemaperiodeVerrijkingen>(`/api/klassen/${klasId}/hoekverrijkingen`, invoer),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hoekverrijkingen"] });
      void qc.invalidateQueries({ queryKey: ["weekplanning"] });
      // The corners' own counts, which the delete confirmation in Instellingen reads.
      void qc.invalidateQueries({ queryKey: sleutel(klasId) });
    },
  });
}

/** How many verrijkingen deleting a subthema would take along, over every klas. Disabled until one is chosen. */
export function useAantalHoekverrijkingen(subthemaId: string | null) {
  return useQuery({
    queryKey: ["hoekverrijkingen", "aantal", subthemaId] as const,
    queryFn: () => get<{ aantal: number }>(`/api/subthemas/${subthemaId}/hoekverrijkingen/aantal`),
    enabled: subthemaId !== null,
  });
}
