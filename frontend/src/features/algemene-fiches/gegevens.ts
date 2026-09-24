import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "../../lib/api";
import type { Doelsoort } from "../../lib/types";
import type { Infodoel } from "../plan/Doelinfo";

/**
 * A class's algemene fiches: the recurring activities that belong to no thema, the onthaal and the
 * turnles (owner, 2026-09-11).
 *
 * **Its own feature module, for the reason `hoeken/gegevens.ts` gives.** The settings screen defines
 * the fiches today, and the agenda will read the same list to draw them under the hoekenfiches once
 * its time grid lands, so these types and hooks are about fiches and not about one screen.
 *
 * **Changing a fiche's goals invalidates `dekking`, unlike anything a hoek does.** A planned fiche's
 * goals count for dekking (owner ruling, 2026-09-11), so linking or unlinking one can move a figure
 * on screen. Invalidating it for a fiche that is not planned yet refetches a number that did not
 * change, which is the cheaper mistake than showing one that did.
 */

/** One goal linked to a fiche, with enough of the goal to recognise it. Mirrors `AlgemeneFichedoelWeergave`. */
export interface AlgemeneFichedoel {
  koppelingId: string;
  leerplandoelCode: string;
  doelsoort: Doelsoort;
  jaarFase: string;
  tekst: string;
}

/** A fiche as the settings screen reads it. Mirrors `AlgemeneFicheWeergave` on the server. */
export interface AlgemeneFicheWeergave {
  id: string;
  klasId: string;
  naam: string;
  omschrijving: string | null;
  /** How often it stands in the agenda. Zero means its goals do not count for dekking yet. */
  aantalPlaatsingen: number;
  doelen: AlgemeneFichedoel[];
}

/** A fiche's goals as the agenda's info icon and the fiche sheet list them (FB-018): they arrive whole, text included. */
export function alsInfodoelen(doelen: readonly AlgemeneFichedoel[]): Infodoel[] {
  return doelen.map((doel) => ({ code: doel.leerplandoelCode, doelsoort: doel.doelsoort, tekst: doel.tekst }));
}

/** What a teacher states about a fiche. */
export interface AlgemeneFicheInvoer {
  naam: string;
  omschrijving: string | null;
}

const sleutel = (klasId: string | null) => ["algemene-fiches", klasId] as const;

/** The fiches of one class. Disabled until a class is chosen: there is no school-wide list. */
export function useAlgemeneFiches(klasId: string | null) {
  return useQuery({
    queryKey: sleutel(klasId),
    queryFn: () => get<AlgemeneFicheWeergave[]>(`/api/klassen/${klasId}/algemene-fiches`),
    enabled: klasId !== null,
  });
}

function useVerversing(klasId: string | null, { ookDekking }: { ookDekking: boolean }) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: sleutel(klasId) });
    if (ookDekking) void qc.invalidateQueries({ queryKey: ["dekking"] });
  };
}

export function useMaakAlgemeneFiche(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: false });

  return useMutation({
    mutationFn: (invoer: AlgemeneFicheInvoer) =>
      post<AlgemeneFicheWeergave>(`/api/klassen/${klasId}/algemene-fiches`, invoer),
    onSuccess: ververs,
  });
}

/** `PUT` replaces the name and description together, so the form always sends both. */
export function useWijzigAlgemeneFiche(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: false });

  return useMutation({
    mutationFn: ({ ficheId, invoer }: { ficheId: string; invoer: AlgemeneFicheInvoer }) =>
      put<AlgemeneFicheWeergave>(`/api/algemene-fiches/${ficheId}`, invoer),
    onSuccess: ververs,
  });
}

/**
 * Refused by the server while the fiche stands in the agenda, with the count in the message. Surfaced
 * verbatim rather than pre-empted: only the count the server sees at the moment of the delete may
 * block it.
 */
export function useVerwijderAlgemeneFiche(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: false });

  return useMutation({
    mutationFn: (ficheId: string) => del(`/api/algemene-fiches/${ficheId}`),
    onSuccess: ververs,
  });
}

/** Links a goal as the teacher's own (`manueel`) link. */
export function useKoppelFicheDoel(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: true });

  return useMutation({
    mutationFn: ({ ficheId, leerplandoelCode }: { ficheId: string; leerplandoelCode: string }) =>
      post<AlgemeneFicheWeergave>(`/api/algemene-fiches/${ficheId}/doelkoppelingen`, { leerplandoelCode }),
    onSuccess: ververs,
  });
}

export function useOntkoppelFicheDoel(klasId: string | null) {
  const ververs = useVerversing(klasId, { ookDekking: true });

  return useMutation({
    mutationFn: ({ ficheId, koppelingId }: { ficheId: string; koppelingId: string }) =>
      del<AlgemeneFicheWeergave>(`/api/algemene-fiches/${ficheId}/doelkoppelingen/${koppelingId}`),
    onSuccess: ververs,
  });
}

/* ------------------------------------------------------------------------------------------------
   PLANNING A FICHE IN THE AGENDA (ADR-0029 decision 3)

   A separate read over its own range: a placement is outside the Jaarplan aggregate, so it is
   outside the weekplanning read model too.
   ------------------------------------------------------------------------------------------------ */

/** One occurrence in the time grid: this day, from this time to that one. Mirrors `AlgemeneFichemomentWeergave`. */
export interface AlgemeneFichemomentWeergave {
  id: string;
  datum: string;
  /** `HH:mm:ss`, as the server sends a TimeOnly. */
  begin: string;
  einde: string;
  /** What the class does in it that day, or null while nothing is filled in (FB-022). */
  tekst: string | null;
}

/** The longest day text, mirroring `AlgemeneFichemoment.MaxTekstLengte`. */
export const MAX_DAGTEKST = 500;

/** A planned fiche as the agenda reads it. Mirrors `AlgemeneFicheplaatsingWeergave`. */
export interface AlgemeneFicheplaatsingWeergave {
  id: string;
  algemeneFicheId: string;
  ficheNaam: string;
  van: string;
  tot: string;
  momenten: AlgemeneFichemomentWeergave[];
}

/** What the teacher answered in the placement sheet. Mirrors `AlgemeneFicheplaatsingInvoer`. */
export interface AlgemeneFicheplaatsingInvoer {
  algemeneFicheId: string;
  van: string;
  tot: string;
  /** ISO weekdays: 1 is maandag, 5 is vrijdag. The server refuses 6 and 7 with a sentence of its own. */
  weekdagen: number[];
  /** `HH:mm:ss`. */
  begin: string;
  einde: string;
}

const plaatsingSleutel = (klasId: string | null, van: string, tot: string) =>
  ["algemene-ficheplaatsingen", klasId, van, tot] as const;

/** The placements overlapping one date range, keyed on the range like the weekplanning, so paging a month re-reads no year. */
export function useAlgemeneFicheplaatsingen(klasId: string | null, van: string, tot: string) {
  return useQuery({
    queryKey: plaatsingSleutel(klasId, van, tot),
    queryFn: () =>
      get<AlgemeneFicheplaatsingWeergave[]>(`/api/klassen/${klasId}/algemene-ficheplaatsingen?van=${van}&tot=${tot}`),
    enabled: klasId !== null && van.length > 0 && tot.length > 0,
  });
}

/**
 * After a placement is made or removed: every mounted range, the fiche list, and dekking.
 *
 * **Dekking because the first placement and the last one move it** (Art. V.1 as amended): a fiche's goals count from
 * the moment it stands in the agenda once. Which of the two this call was, the screen cannot tell cheaply, and a
 * refetch of a figure that did not change is the cheaper mistake. The fiche list because its `aantalPlaatsingen` is
 * what Instellingen reads to say "Staat nog niet in de agenda".
 */
function usePlaatsingVerversing() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["algemene-ficheplaatsingen"] });
    void qc.invalidateQueries({ queryKey: ["algemene-fiches"] });
    void qc.invalidateQueries({ queryKey: ["dekking"] });
  };
}

export function usePlaatsAlgemeneFiche(klasId: string | null) {
  const ververs = usePlaatsingVerversing();

  return useMutation({
    mutationFn: (invoer: AlgemeneFicheplaatsingInvoer) =>
      post<AlgemeneFicheplaatsingWeergave>(`/api/klassen/${klasId}/algemene-ficheplaatsingen`, invoer),
    onSuccess: ververs,
  });
}

/** Removes a placement with all of its occurrences. */
export function useVerwijderAlgemeneFicheplaatsing() {
  const ververs = usePlaatsingVerversing();

  return useMutation({
    mutationFn: (plaatsingId: string) => del(`/api/algemene-ficheplaatsingen/${plaatsingId}`),
    onSuccess: ververs,
  });
}

/**
 * Takes ONE occurrence off its day, with its day text (TB-030). Refreshes what a placement's removal refreshes: the last
 * occurrence takes the placement along on the server, and that can move dekking.
 */
export function useVerwijderFichemoment() {
  const ververs = usePlaatsingVerversing();

  return useMutation({
    mutationFn: ({ plaatsingId, momentId }: { plaatsingId: string; momentId: string }) =>
      del(`/api/algemene-ficheplaatsingen/${plaatsingId}/momenten/${momentId}`),
    onSuccess: ververs,
  });
}

/** Where one occurrence should move to, or how long it should run. */
export interface FichemomentVerplaatsing {
  plaatsingId: string;
  momentId: string;
  datum: string;
  /** `HH:mm:ss`. A resize sends the unchanged begin with a new einde. */
  begin: string;
  einde: string;
}

/**
 * Moves or resizes ONE occurrence. Only the placements are refetched: the placement still exists afterwards, so
 * whether the fiche counts for dekking cannot have changed.
 *
 * Not optimistic: the server refuses a day outside the window, a day
 * without school (since E10-03) and a second start at the same time on one day, and she has to see that refusal
 * rather than watch the block jump back.
 */
export function useVerplaatsFichemoment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ plaatsingId, momentId, datum, begin, einde }: FichemomentVerplaatsing) =>
      put<AlgemeneFicheplaatsingWeergave>(`/api/algemene-ficheplaatsingen/${plaatsingId}/momenten/${momentId}`, {
        datum,
        begin,
        einde,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["algemene-ficheplaatsingen"] }),
  });
}

/**
 * Sets or clears ONE occurrence's day text (FB-022). An empty text clears it. Only the placements are refetched, as
 * for a move: a day text changes nothing about dekking.
 */
export function useZetFichemomenttekst() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ plaatsingId, momentId, tekst }: { plaatsingId: string; momentId: string; tekst: string }) =>
      put<AlgemeneFicheplaatsingWeergave>(`/api/algemene-ficheplaatsingen/${plaatsingId}/momenten/${momentId}/tekst`, {
        tekst,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["algemene-ficheplaatsingen"] }),
  });
}

/**
 * Gives every occurrence of ONE placement the same hours, each on its own day (FB-101). One request, so the run is
 * never half at the old hours; the server refuses a day that holds the run twice, and she sees that sentence.
 */
export function useZetFicheuren() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ plaatsingId, begin, einde }: { plaatsingId: string; begin: string; einde: string }) =>
      put<AlgemeneFicheplaatsingWeergave>(`/api/algemene-ficheplaatsingen/${plaatsingId}/uren`, { begin, einde }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["algemene-ficheplaatsingen"] }),
  });
}
