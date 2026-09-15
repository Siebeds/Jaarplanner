import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, put } from "../../lib/api";
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
