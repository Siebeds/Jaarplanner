import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiAdres, apiFetch, del, get, post, put } from "../../lib/api";
import { t } from "../../i18n";
import { foutzin } from "./rapporthulp";
import type { Rapportsubdoel } from "./rapportset";

/**
 * The ontwikkelingsrapport of one child at one evaluatiemoment (FB-003, ADR-0035 §3.1): per rapportdoel of the K3 set a
 * star and a text, and an algemeen besluit (R8, R9).
 *
 * **Pupil data, so the query cache is the only copy the browser keeps**, as for the children (`leerlingen.ts`): nothing
 * here writes to storage, the server answers `no-store`, and signing out clears the query client.
 */

/** The three fixed moments (R8): numbers, with no name or date of their own. */
export const MOMENTEN = [1, 2, 3] as const;
export type Moment = (typeof MOMENTEN)[number];

export function isMoment(waarde: number): waarde is Moment {
  return (MOMENTEN as readonly number[]).includes(waarde);
}

/** Who wrote a text: the teacher (`Manueel`) or an accepted AI rewrite (`Aanvaard`, FB-004). */
export type Tekststatus = "Manueel" | "Aanvaard";

/** One rapportdoel on a report: the set's title and subdoelen, and the child's star and text. */
export interface Rapportregel {
  rapportdoelId: string;
  titel: string;
  /** For the teacher only: the parent never sees them (R11). */
  subdoelen: Rapportsubdoel[];
  gradatieId: string | null;
  tekst: string | null;
  tekstStatus: Tekststatus | null;
}

export interface Rapport {
  leerlingId: string;
  /** The child's klas: what the rights are asked about. */
  klasId: string;
  voornaam: string;
  achternaam: string;
  klasNaam: string;
  schooljaarNaam: string;
  moment: number;
  /** Every rapportdoel of the set, in its order (D2). */
  rapportdoelen: Rapportregel[];
  besluit: string | null;
  besluitStatus: Tekststatus | null;
  /** The kindtekening's version and size, or none (FB-005). The image is fetched from `tekeningadres`. */
  tekening: Tekening | null;
}

/** The one drawing of a report, as the report names it. */
export interface Tekening {
  /** Changes with every replacement, so the image's address does too. */
  versie: string;
  breedte: number;
  hoogte: number;
}

export interface BeoordelingInvoer {
  gradatieId: string | null;
  tekst: string;
  /**
   * The server's seal, on the one save that takes an AI proposal over (FB-004). The server decides from it whether the
   * text is `Aanvaard` or `Manueel`, so an edited proposal needs no different call: the seal simply stops matching.
   */
  herschrijving?: string;
}

/** What a teacher sets as the algemeen besluit, with the same seal on an accepted rewrite. */
export interface BesluitInvoer {
  tekst: string;
  herschrijving?: string;
}

/** One AI proposal on screen: the rewritten text, and the seal to send back with a decision. Never stored. */
export interface Herschrijfvoorstel {
  voorstel: string;
  herschrijving: string;
}

interface Beoordeling {
  rapportdoelId: string;
  gradatieId: string | null;
  tekst: string | null;
  tekstStatus: Tekststatus | null;
}

interface Besluit {
  besluit: string | null;
  besluitStatus: Tekststatus | null;
}

const sleutel = (leerlingId: string, moment: number) => ["rapport", leerlingId, moment] as const;
const pad = (leerlingId: string, moment: number) => `/api/leerlingen/${leerlingId}/rapporten/${moment}`;

/**
 * The report of `leerlingId` at `moment`. The server refuses it to anyone who may not read it (R17), so a refusal is an
 * answer to show, not a failure to retry.
 */
export function useRapport(leerlingId: string, moment: number) {
  return useQuery({
    queryKey: sleutel(leerlingId, moment),
    queryFn: () => get<Rapport>(pad(leerlingId, moment)),
    retry: false,
  });
}

/**
 * Saving one rapportdoel's star and text together, as the screen holds them. The answer is written into the cached
 * report rather than read again, so a save never reloads what a teacher is typing in another rapportdoel.
 */
export function useBewaarBeoordeling(leerlingId: string, moment: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rapportdoelId, invoer }: { rapportdoelId: string; invoer: BeoordelingInvoer }) =>
      put<Beoordeling>(`${pad(leerlingId, moment)}/rapportdoelen/${rapportdoelId}`, invoer),
    onSuccess: (bewaard) =>
      qc.setQueryData<Rapport>(sleutel(leerlingId, moment), (rapport) =>
        rapport
          ? {
              ...rapport,
              rapportdoelen: rapport.rapportdoelen.map((regel) =>
                regel.rapportdoelId === bewaard.rapportdoelId
                  ? { ...regel, gradatieId: bewaard.gradatieId, tekst: bewaard.tekst, tekstStatus: bewaard.tekstStatus }
                  : regel,
              ),
            }
          : rapport,
      ),
  });
}

// --- The kindtekening (FB-005, R10, ADR-0035 §3.6). ---

/**
 * The server's `Kindtekeningregels`: the size limit, which the screen checks before sending, and the two formats.
 * Copied by hand from `Kindtekeningregels.MaxMegabytes`; the refusal names this number, so change both.
 */
export const MAX_TEKENING_MB = 20;
export const TEKENINGTYPES = ["image/jpeg", "image/png"] as const;

/**
 * The image of a drawing. Only reachable with a session that may read the report; the version makes a replaced drawing
 * a new address, so the browser does not show the old one from memory.
 */
export function tekeningadres(leerlingId: string, moment: number, versie: string): string {
  return apiAdres(`${pad(leerlingId, moment)}/tekening?versie=${encodeURIComponent(versie)}`);
}

/**
 * Why a chosen file is refused before it is sent, or null. Only what the browser knows: its size, and its type where
 * the browser names one (a file it cannot type goes to the server, which reads the content itself).
 */
export function tekeningweigering(bestand: File): string | null {
  if (bestand.type !== "" && !(TEKENINGTYPES as readonly string[]).includes(bestand.type)) {
    return t("ontwikkelingsrapport.tekeningGeenJpegOfPng");
  }
  if (bestand.size > MAX_TEKENING_MB * 1024 * 1024) {
    return t("ontwikkelingsrapport.tekeningTeGroot", { mb: MAX_TEKENING_MB });
  }
  return null;
}

/**
 * Adding or replacing the drawing. The file goes under a fixed name, so the one the phone or the computer gave it never
 * leaves the browser; the server re-encodes the image and keeps nothing else of it.
 */
export function useBewaarTekening(leerlingId: string, moment: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bestand: File) => {
      const formulier = new FormData();
      formulier.append("bestand", bestand, "tekening");
      return apiFetch<Tekening>(`${pad(leerlingId, moment)}/tekening`, { method: "PUT", body: formulier });
    },
    onSuccess: (tekening) =>
      qc.setQueryData<Rapport>(sleutel(leerlingId, moment), (rapport) => (rapport ? { ...rapport, tekening } : rapport)),
  });
}

export function useVerwijderTekening(leerlingId: string, moment: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del<void>(`${pad(leerlingId, moment)}/tekening`),
    onSuccess: () =>
      qc.setQueryData<Rapport>(sleutel(leerlingId, moment), (rapport) => (rapport ? { ...rapport, tekening: null } : rapport)),
  });
}

export function useBewaarBesluit(leerlingId: string, moment: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoer: BesluitInvoer) => put<Besluit>(`${pad(leerlingId, moment)}/besluit`, invoer),
    onSuccess: (bewaard) =>
      qc.setQueryData<Rapport>(sleutel(leerlingId, moment), (rapport) =>
        rapport ? { ...rapport, besluit: bewaard.besluit, besluitStatus: bewaard.besluitStatus } : rapport,
      ),
  });
}

// --- The AI rewrite of one text (FB-004, R21 to R25, ADR-0035 §3.5). ---

/**
 * Asks the server to have one text rewritten: the text of `rapportdoelId`, or the algemeen besluit when it is null.
 *
 * **Nothing of this is cached or stored.** The proposal lives in the component that asked for it and is gone when the
 * teacher decides or leaves, which is what "no proposal is stored" means on this side of the wire too (Art. IV.2 as
 * amended). So there is no `onSuccess` writing into the report.
 */
export function useHerschrijf(leerlingId: string, moment: number) {
  return useMutation({
    // `gcTime: 0` so the mutation cache drops the answer the moment the component unmounts. Without it a proposal the
    // teacher walked away from without deciding would linger in memory, which is the one thing this whole path is built
    // not to do.
    gcTime: 0,
    mutationFn: ({ rapportdoelId, tekst }: { rapportdoelId: string | null; tekst: string }) =>
      post<Herschrijfvoorstel>(`${pad(leerlingId, moment)}/herschrijvingen`, { rapportdoelId, tekst }),
  });
}

/** Records a rejected proposal (R23). It sends the seal and no text: the proposed text may not be stored. */
export function useWeigerHerschrijving(leerlingId: string, moment: number) {
  return useMutation({
    mutationFn: ({ rapportdoelId, herschrijving }: { rapportdoelId: string | null; herschrijving: string }) =>
      post<void>(`${pad(leerlingId, moment)}/herschrijvingen/geweigerd`, { rapportdoelId, herschrijving }),
  });
}

/**
 * The teacher's sentence for a rewrite that did not arrive.
 *
 * **The server's `detail` is deliberately not shown for the two AI statuses.** For those it is an English operator
 * diagnostic ("Malformed JSON", "The AI client failed with ..."), which a teacher cannot act on. Every other refusal on
 * these routes is the service's own Dutch, and `foutzin` shows it.
 */
export function herschrijffout(fout: unknown): string {
  if (fout instanceof ApiError && fout.status === 422) return t("ontwikkelingsrapport.herschrijfOnbruikbaar");
  if (fout instanceof ApiError && fout.status === 503) return t("ontwikkelingsrapport.herschrijfGeenAntwoord");
  return foutzin(fout, "ontwikkelingsrapport.herschrijfMislukt");
}
