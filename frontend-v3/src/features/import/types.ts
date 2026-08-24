/**
 * The import feature's wire types (FR-1.1..1.5 and FR-2.5).
 *
 * Names mirror the two controllers' response records (`SchoolcontentImportController.ImportAntwoord`,
 * `OpstapImportController.OpstapImportAntwoord`) and their diffs. Enums travel **by name**: the API
 * registers `JsonStringEnumConverter` with no naming policy, so every enum string here is PascalCase
 * exactly as the API sends it, the same convention `KoppelingStatus` follows.
 *
 * **Two importers, two contracts, deliberately not unified.** They share the outer shape
 * `{ isBestandGeldig, isVolledigVerwerkt, problemen[], diff, toegepast }` and nothing else. One
 * describes the school's own editable content, the other the decreed curriculum, and their per-row
 * problem records differ in fields AND in language (see `OpstapRijProbleem`). A common base type
 * would hide exactly the distinction this screen exists to show.
 */
import type { KoppelingStatus } from "../../lib/types";

// --- School content (thema / subthema / activiteit), FR-1 --------------------------------------

/** What a re-import does with content whose match key already exists (FR-1.4). */
export type SchoolcontentImportModus = "Toevoegen" | "Bijwerken";

/** Whether a piece of content is new, updated in place, or left alone. */
export type WijzigingSoort = "Toegevoegd" | "Bijgewerkt" | "Ongewijzigd";

/** Which layer of school content a threatened goal link lives in (Art. IX.2). */
export type KoppelingNiveau = "Themadoel" | "Subdoel" | "Activiteit";

/**
 * One per-row (or file-level) validation problem from the school-content parser (FR-1.2).
 *
 * `melding` is Dutch and rendered verbatim. The file was written by a teacher and only a teacher can
 * fix it, which is the actionable side of the Art. II.3 split: a sentence naming a row, a column and
 * the offending value cannot be assembled from a static catalogue.
 */
export interface SchoolcontentRijProbleem {
  /** The 1-based Excel row, or 0 for a problem about the file rather than a row. Never print "rij 0". */
  rijNummer: number;
  melding: string;
  /** The offending column as an enum member name: a technical identifier, so it is not rendered. */
  kolom: string | null;
  /** The Dutch header label of that column, derived server-side from the one column table (Art. III.3). */
  kolomLabel: string | null;
}

/** One thema in the diff, keyed on its naam (thema's are school-wide, Art. IX.2). */
export interface ThemaWijziging {
  naam: string;
  soort: WijzigingSoort;
}

/** One subthema in the diff. `klas` and `leeftijd` are part of its identity: it is class/age scoped. */
export interface SubthemaWijziging {
  themaNaam: string;
  naam: string;
  klas: string;
  leeftijd: string;
  soort: WijzigingSoort;
}

/** One activiteit in the diff, under its subthema and thema. */
export interface ActiviteitWijziging {
  themaNaam: string;
  subthemaNaam: string;
  naam: string;
  soort: WijzigingSoort;
}

/**
 * A teacher-set goal link an overwrite would discard, because the re-imported file no longer carries
 * it (Art. IV.2).
 *
 * The server KEEPS these unless the caller opts in, so this list is a warning and not a report of
 * something already lost. That is why the opt-in belongs after the preview and not beside the
 * upload: only a preview can say how many decisions are at stake.
 */
export interface BedreigdeBeslissing {
  niveau: KoppelingNiveau;
  contentNaam: string;
  leerplandoelCode: string;
  status: KoppelingStatus;
}

/** What an import did, or would do, per level (FR-1.3). */
export interface SchoolcontentImportDiff {
  modus: SchoolcontentImportModus;
  themas: ThemaWijziging[];
  subthemas: SubthemaWijziging[];
  activiteiten: ActiviteitWijziging[];
  bedreigdeBeslissingen: BedreigdeBeslissing[];
  /** True when the import was deliberately skipped as a whole (an empty or unusable file). */
  overgeslagen: boolean;
  /**
   * Dutch notices about content that was DROPPED although the file parsed: an unknown leerplandoel
   * code, a fourth themadoel, a subthema naming a klas that does not exist. A probleem means the row
   * could not be read; an opmerking means it was read and something was still lost.
   */
  opmerkingen: string[];
  isLeeg: boolean;
  vereistReview: boolean;
}

/** The answer to a school-content preview or commit. */
export interface SchoolcontentImportAntwoord {
  /** True when the file parsed with no per-row or file-level problems. */
  isBestandGeldig: boolean;
  /** True when the import additionally discarded nothing: no problemen AND no opmerkingen. */
  isVolledigVerwerkt: boolean;
  problemen: SchoolcontentRijProbleem[];
  diff: SchoolcontentImportDiff;
  /** False for a preview, true once the changes were committed. */
  toegepast: boolean;
}

// --- Op.stap curriculum, FR-2.1 / FR-2.5 -------------------------------------------------------

/**
 * One per-row parse problem from the OFFICIAL Op.stap goal file.
 *
 * `reden` is English on purpose and must not be translated. A malformed row in a file the school
 * downloaded from Op.stap is not something any user of this application can fix, so it is an
 * operator diagnostic: the mirror image of `SchoolcontentRijProbleem`, whose Dutch `melding`
 * describes a row the teacher wrote themselves.
 */
export interface OpstapRijProbleem {
  rijNummer: number;
  reden: string;
  /** The leerplandoel code on the row, when it could be read at all. */
  code: string | null;
}

/** One changed field of a leerplandoel during a re-import. */
export interface VeldWijziging {
  /** The model field name, e.g. `Tekst`. A technical identifier, so it is shown as one. */
  veld: string;
  oudeWaarde: string | null;
  nieuweWaarde: string | null;
}

/** One leerplandoel whose official content differs from what is loaded. */
export interface LeerplandoelWijziging {
  code: string;
  velden: VeldWijziging[];
}

/** A leerplandoel gone from Op.stap that school content still links, so it is flagged and kept. */
export interface VerdwenenGekoppeldDoel {
  code: string;
  aantalKoppelingen: number;
}

/** The FR-2.5 review report for one discipline. */
export interface OpstapHerimportDiff {
  disciplineNummer: string;
  toegevoegd: string[];
  gewijzigd: LeerplandoelWijziging[];
  ongewijzigd: string[];
  /** Gone from the file and referenced by nothing. Flagged, never deleted. */
  verdwenen: string[];
  /** Gone from the file and still in use. Never deleted (Art. IV.2). */
  verdwenenMaarGekoppeld: VerdwenenGekoppeldDoel[];
  overgeslagen: boolean;
  /** Dutch notices: why a file did nothing, or that its discipline is out of the configured selection. */
  opmerkingen: string[];
  isLeeg: boolean;
  /**
   * True when this run produced something a human should look at.
   *
   * NOT a durable "needs review" state, and it must not be rendered as one: a flag-and-keep row
   * stays absent from every later file, so once a discipline has lost a goal every subsequent
   * re-import reports it again, forever. This screen scopes the notice to the run in front of the
   * reader.
   */
  vereistReview: boolean;
}

/** The answer to an Op.stap preview or commit. */
export interface OpstapImportAntwoord {
  isBestandGeldig: boolean;
  isVolledigVerwerkt: boolean;
  problemen: OpstapRijProbleem[];
  diff: OpstapHerimportDiff;
  toegepast: boolean;
}
