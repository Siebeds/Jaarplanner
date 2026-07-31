import { apiFetch, apiUrl } from "../../lib/api";
import type {
  OpstapImportAntwoord,
  SchoolcontentImportAntwoord,
  SchoolcontentImportModus,
} from "./types";

/**
 * The import feature's API calls (E1-13). Thin wrappers over {@link apiFetch}, one per endpoint the two
 * importers expose.
 *
 * **Everything but the template download is multipart.** `apiFetch` leaves `Content-Type` unset for a
 * `FormData` body so the browser can write the `boundary=` token it generated; that behaviour is a
 * precondition of every call in this file and it is pinned by `lib/api.test.ts`.
 *
 * **A preview and a commit are the same request with a different path.** They must be, because the server's
 * promise is that a commit does exactly what its preview showed for the same input; building the two bodies
 * differently is how that promise gets broken from the client side.
 */

/**
 * The import template (FR-1.5, E1-09), as a URL for a plain `<a href download>`.
 *
 * Not routed through `apiFetch`: the response is a binary `.xlsx` with the server's own
 * `Content-Disposition` filename, which a link hands straight to the browser's download machinery. A
 * fetch-and-blob dance would add code, a memory copy of the file, and a filename the frontend has to invent.
 */
export const SJABLOON_URL = apiUrl("/api/schoolcontent-import/sjabloon");

/**
 * Which Op.stap refusal a 409 is, read from the response's RFC 7807 `type`.
 *
 * **Why the wire needs this at all.** The endpoint answers 409 for two refusals whose *owners are opposite*:
 * the decreed minimumdoelen are not loaded (nothing the uploader can do; E1-12 has to land first) and the
 * file's codes already belong to another discipline (the uploader corrects the discipline number or picks the
 * other file). They share a status and a Dutch `title`, so before this the screen framed both as a system
 * state and printed that frame directly above the server's own "check whether this file belongs to discipline
 * N". Two contradictory sentences, and the reader sent off to wait.
 *
 * Mirrors `backend/src/Jaarplanner.Api/Infrastructure/Probleemsoorten.cs`; there is no generated contract
 * between the two, so a rename on either side is a breaking change on both. Match, never default: a `type`
 * that is neither of these means "we could not tell", because `IProblemDetailsService` fills the field in from
 * the status code whenever the server set nothing.
 */
export const OPSTAP_WEIGERINGSOORT = {
  ontbrekendeMinimumdoelen: "urn:jaarplanner:opstap-import:ontbrekende-minimumdoelen",
  codeInAndereDiscipline: "urn:jaarplanner:opstap-import:code-in-andere-discipline",
} as const;

/** What a school-content upload sends. `bestand` is the teacher's filled-in `.xlsx`. */
export interface SchoolcontentInvoer {
  bestand: File;
  modus: SchoolcontentImportModus;
  /**
   * The Art. IV.2 opt-in: discard the teacher-set goal links the new file no longer carries.
   *
   * **The preview always sends `false`.** Not a shortcut: with the flag on, the server *drops* those links
   * instead of reporting them, so `diff.bedreigdeBeslissingen` comes back empty and the preview could no
   * longer tell the teacher what is at stake. Reading the file non-destructively is the only way to learn the
   * count that the opt-in's own label has to state. See `Schoolcontentimport` for the consequence that
   * follows: ticking the box does not re-run the preview, because the re-run would erase the list the box
   * refers to.
   */
  menselijkeBeslissingenVerwijderen: boolean;
}

/**
 * Builds the multipart body.
 *
 * The field names match the binder's property names (`Bestand`, `Modus`,
 * `MenselijkeBeslissingenVerwijderen`) case-insensitively, and the enum travels **by name**: ASP.NET binds a
 * form value to an enum through its `TypeConverter`, which accepts the member name. Sending the numeric value
 * would work too and would be unreadable in a network log.
 */
function schoolcontentFormulier(invoer: SchoolcontentInvoer): FormData {
  const formulier = new FormData();
  formulier.append("bestand", invoer.bestand, invoer.bestand.name);
  formulier.append("modus", invoer.modus);
  formulier.append(
    "menselijkeBeslissingenVerwijderen",
    String(invoer.menselijkeBeslissingenVerwijderen),
  );

  return formulier;
}

/** Parses and diffs the upload **without writing anything** (FR-1.3 preview). */
export function voorbeeldSchoolcontent(
  invoer: SchoolcontentInvoer,
): Promise<SchoolcontentImportAntwoord> {
  return apiFetch<SchoolcontentImportAntwoord>("/api/schoolcontent-import/voorbeeld", {
    method: "POST",
    body: schoolcontentFormulier(invoer),
  });
}

/** Commits the upload (FR-1.1/1.4). */
export function importeerSchoolcontent(
  invoer: SchoolcontentInvoer,
): Promise<SchoolcontentImportAntwoord> {
  return apiFetch<SchoolcontentImportAntwoord>("/api/schoolcontent-import", {
    method: "POST",
    body: schoolcontentFormulier(invoer),
  });
}

/** What an Op.stap upload sends: one discipline's goal file, plus which discipline it is. */
export interface OpstapInvoer {
  bestand: File;
  /**
   * The Op.stap discipline number (`"1"`, `"9.2"`). It is import **context, not a column**: the goal Excel
   * carries no discipline column (Art. VII.1), so the uploader has to say which file this is.
   */
  disciplineNummer: string;
}

function opstapFormulier(invoer: OpstapInvoer): FormData {
  const formulier = new FormData();
  formulier.append("bestand", invoer.bestand, invoer.bestand.name);
  formulier.append("disciplineNummer", invoer.disciplineNummer);

  return formulier;
}

/**
 * Parses and diffs one discipline's Op.stap file without writing anything (FR-2.5 review step).
 *
 * The preview refuses exactly what the commit refuses: all three curriculum-integrity checks run before any
 * write, so a 200 here can be trusted. Those refusals arrive as **409** (the decreed minimumdoelen are not
 * loaded yet, i.e. the E1-12 gap; or a code already belongs to another discipline) and **400** (an unknown
 * discipline number, a missing file), each with a Dutch `detail` the caller branches on **by status**.
 */
export function voorbeeldOpstap(invoer: OpstapInvoer): Promise<OpstapImportAntwoord> {
  return apiFetch<OpstapImportAntwoord>("/api/opstap-import/voorbeeld", {
    method: "POST",
    body: opstapFormulier(invoer),
  });
}

/** Commits one discipline's Op.stap file: the initial import (FR-2.1) and every re-import (FR-2.5). */
export function importeerOpstap(invoer: OpstapInvoer): Promise<OpstapImportAntwoord> {
  return apiFetch<OpstapImportAntwoord>("/api/opstap-import", {
    method: "POST",
    body: opstapFormulier(invoer),
  });
}
