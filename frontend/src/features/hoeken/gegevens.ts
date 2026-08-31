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

  return useMutation({
    mutationFn: (hoekId: string) => del(`/api/hoeken/${hoekId}`),
    onSuccess: ververs,
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

/** One appearance in the timetable: this day, this lesuur. */
export interface HoekmomentWeergave {
  id: string;
  datum: string;
  volgorde: number;
}

/** What is in the corner over a stretch of days. */
export interface HoekverrijkingWeergave {
  id: string;
  van: string;
  tot: string;
  tekst: string;
}

/** A placed hoek as the agenda reads it. */
export interface HoekplaatsingWeergave {
  id: string;
  hoekId: string;
  hoekNaam: string;
  van: string;
  tot: string;
  verrijkingen: HoekverrijkingWeergave[];
  momenten: HoekmomentWeergave[];
}

/** What the teacher answered in the sheet after dropping a fiche on a day. */
export interface HoekplaatsingInvoer {
  hoekId: string;
  van: string;
  tot: string;
  /** What the corner gets over this window. Null when she left it blank, which is an ordinary answer. */
  verrijking: string | null;
  /** The zero-based lesuur it takes on every teaching day, or null for "not in the uurrooster". */
  lesuur: number | null;
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
 * Removes a placement, with its enrichments and its timetable rows.
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

/** Where one appearance of a placed hoek should move to. */
export interface HoekmomentVerplaatsing {
  plaatsingId: string;
  momentId: string;
  datum: string;
  /** Zero-based, so 0 is what a teacher calls lesuur 1. */
  volgorde: number;
}

/**
 * Moves ONE appearance of a placed hoek to another day and/or lesuur (owner, 2026-08-31).
 *
 * The rows are stored per day rather than derived exactly so that this is possible: the hoek runs all
 * fortnight and on this one Thursday it happens after the break. Moving the whole run is a different
 * verb and is not this hook.
 *
 * **It does not invalidate optimistically and it is not meant to.** The server refuses a day outside
 * the placement's window and a second appearance of the same hoek at the same hour, and both refusals
 * are things the teacher has to see rather than watch get undone.
 */
export function useVerplaatsHoekmoment() {
  const ververs = usePlaatsingVerversing();

  return useMutation({
    mutationFn: ({ plaatsingId, momentId, datum, volgorde }: HoekmomentVerplaatsing) =>
      put<HoekplaatsingWeergave>(`/api/hoekplaatsingen/${plaatsingId}/momenten/${momentId}`, {
        datum,
        volgorde,
      }),
    onSuccess: ververs,
  });
}
