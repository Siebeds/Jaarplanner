import { apiFetch } from "../../lib/api";
import type { OpstapImportAntwoord, SchoolcontentImportAntwoord, SchoolcontentImportModus } from "./types";

/**
 * The four upload calls, plus the template link.
 *
 * `FormData` goes to `apiFetch` unwrapped and with no Content-Type of ours: the browser has to write
 * the `boundary=` token it generated, and setting the header by hand strips it and the server then
 * finds no parts at all.
 *
 * The field names bind to the controllers' form properties (`Bestand`, `Modus`,
 * `MenselijkeBeslissingenVerwijderen`, `DisciplineNummer`) case-insensitively, and the enum travels
 * by member NAME rather than by its number: both bind, only one is readable in a network log.
 */

/** The template download. A plain href rather than a fetch: the browser already knows how to save a file. */
export const SJABLOON_PAD = "/api/schoolcontent-import/sjabloon";

export interface SchoolcontentInvoer {
  bestand: File;
  modus: SchoolcontentImportModus;
  /** The Art. IV.2 opt-in: discard teacher-set links the new file no longer carries. Defaults false. */
  menselijkeBeslissingenVerwijderen: boolean;
}

function schoolcontentFormulier(invoer: SchoolcontentInvoer): FormData {
  const formulier = new FormData();
  formulier.append("bestand", invoer.bestand, invoer.bestand.name);
  formulier.append("modus", invoer.modus);
  formulier.append("menselijkeBeslissingenVerwijderen", String(invoer.menselijkeBeslissingenVerwijderen));
  return formulier;
}

/** Parses and diffs the upload without writing anything (FR-1.3). */
export function voorbeeldSchoolcontent(invoer: SchoolcontentInvoer): Promise<SchoolcontentImportAntwoord> {
  return apiFetch<SchoolcontentImportAntwoord>("/api/schoolcontent-import/voorbeeld", {
    method: "POST",
    body: schoolcontentFormulier(invoer),
  });
}

/** Parses and commits the upload (FR-1.4). */
export function importeerSchoolcontent(invoer: SchoolcontentInvoer): Promise<SchoolcontentImportAntwoord> {
  return apiFetch<SchoolcontentImportAntwoord>("/api/schoolcontent-import", {
    method: "POST",
    body: schoolcontentFormulier(invoer),
  });
}

export interface OpstapInvoer {
  bestand: File;
  /** The discipline the file belongs to, as it is numbered in Op.stap (the 9.x split). */
  disciplineNummer: string;
}

function opstapFormulier(invoer: OpstapInvoer): FormData {
  const formulier = new FormData();
  formulier.append("bestand", invoer.bestand, invoer.bestand.name);
  formulier.append("disciplineNummer", invoer.disciplineNummer);
  return formulier;
}

/** Parses and diffs one discipline's goal file without writing anything (FR-2.5). */
export function voorbeeldOpstap(invoer: OpstapInvoer): Promise<OpstapImportAntwoord> {
  return apiFetch<OpstapImportAntwoord>("/api/opstap-import/voorbeeld", {
    method: "POST",
    body: opstapFormulier(invoer),
  });
}

/** Parses and commits one discipline's goal file (FR-2.1). */
export function importeerOpstap(invoer: OpstapInvoer): Promise<OpstapImportAntwoord> {
  return apiFetch<OpstapImportAntwoord>("/api/opstap-import", {
    method: "POST",
    body: opstapFormulier(invoer),
  });
}
