import { useMutation } from "@tanstack/react-query";
import { post } from "../../lib/api";

/**
 * The cat's chat (FB-031, ADR-0066). The server answers a question with an explanation from the handleiding or with
 * the result of a lookup over the school's content; this side composes the sentences (`chatzinnen.ts`). Nothing is
 * cached: a question is a mutation, and the conversation lives only in the open window, whose last turns go along with
 * each question (FB-093).
 */

export type Katvraag =
  | "DoelInThema"
  | "WaarGebruikt"
  | "DoelenVanThema"
  | "ActiviteitInSubthema"
  | "SubthemaVanActiviteit"
  | "DoelenVanSubthema";

/** Mirrors `Katopzoeking`: sent back as is, with one term replaced by the picked candidate. */
export interface Katopzoeking {
  vraag: Katvraag;
  doel?: string | null;
  thema?: string | null;
  subthema?: string | null;
  activiteit?: string | null;
}

export type Katantwoordsoort =
  | "Uitleg"
  | "Onbekend"
  | "Mislukt"
  | "NietGevonden"
  | "Kies"
  | Katvraag;

export type Katonderwerp = "Doel" | "Thema" | "Subthema" | "Activiteit";

export interface Katdoel {
  code: string;
  soort: "Leerplandoel" | "Minimumdoel";
  tekst: string;
}

export type Katpleksoort = "Themadoel" | "Subdoel" | "Activiteit" | "AlgemeneFiche";

export interface Katplek {
  soort: Katpleksoort;
  themaId: string;
  thema: string;
  subthemaId?: string | null;
  subthema?: string | null;
  leeftijd?: string | null;
  activiteit?: string | null;
  fiche?: string | null;
  klas?: string | null;
  doel?: Katdoel | null;
  verwijzing?: string | null;
}

export interface Katagendaplek {
  klasId: string;
  klas: string;
  soort: "Thema" | "Subthema" | "Activiteit" | "AlgemeneFiche";
  naam: string;
  van: string;
  tot: string;
  voorstel: boolean;
  verwijzing: string;
}

export interface Katkandidaat {
  id: string;
  label: string;
  detail?: string | null;
}

/**
 * One turn as the server sealed it (FB-093, ADR-0069): sent back unchanged with the next questions of the conversation.
 * The browser never reads or builds one; a changed turn is refused.
 */
export interface Katbeurt {
  vraag: string;
  antwoord: string;
  zegel: string;
}

/** Mirrors `Katantwoord`. */
export interface Katantwoord {
  soort: Katantwoordsoort;
  uitleg?: string | null;
  hoofdstukken: string[];
  opzoeking?: Katopzoeking | null;
  nietGevonden?: { wat: Katonderwerp; term: string } | null;
  keuze?: { wat: Katonderwerp; term: string; kandidaten: Katkandidaat[] } | null;
  doel?: Katdoel | null;
  thema?: { id: string; naam: string } | null;
  activiteit?: { id: string; naam: string } | null;
  subthema?: string | null;
  ja?: boolean | null;
  plekken: Katplek[];
  voorstellen: Katplek[];
  agenda: Katagendaplek[];
  agendaTotaal: number;
  beurt?: Katbeurt | null;
}

/** The longest question the server accepts; the field stops there. */
export const MAX_VRAAG = 500;

/** How many earlier turns go along with a question; the server takes no more (FB-093). */
export const MAX_BEURTEN = 10;

/**
 * Asks Chuck a question after the turns of the conversation so far, oldest first. The schooljaar decides which klassen
 * the agenda part of an answer covers.
 */
export function useVraagChuck() {
  return useMutation({
    mutationFn: ({ vraag, schooljaarId, gesprek }: { vraag: string; schooljaarId: string | null; gesprek: Katbeurt[] }) =>
      post<Katantwoord>("/api/kat/chat", { vraag, schooljaarId, gesprek }),
  });
}

/** Runs a lookup again with the candidate she picked, whose label is her turn; the model is not asked. */
export function useZoekOpnieuw() {
  return useMutation({
    mutationFn: ({ opzoeking, schooljaarId, vraag }: { opzoeking: Katopzoeking; schooljaarId: string | null; vraag: string }) =>
      post<Katantwoord>("/api/kat/chat/opzoeking", { opzoeking, schooljaarId, vraag }),
  });
}
