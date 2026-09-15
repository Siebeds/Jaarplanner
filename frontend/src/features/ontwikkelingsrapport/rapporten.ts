import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiAdres, apiFetch, del, get, put } from "../../lib/api";
import { t } from "../../i18n";
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

/** The server's `Kindtekeningregels`: the size limit, which the screen checks before sending, and the two formats. */
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
    mutationFn: (tekst: string) => put<Besluit>(`${pad(leerlingId, moment)}/besluit`, { tekst }),
    onSuccess: (bewaard) =>
      qc.setQueryData<Rapport>(sleutel(leerlingId, moment), (rapport) =>
        rapport ? { ...rapport, besluit: bewaard.besluit, besluitStatus: bewaard.besluitStatus } : rapport,
      ),
  });
}
