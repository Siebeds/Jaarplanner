import type { SuggestieStatus } from "../matching/types";

/**
 * Transport types for the school-content beheer surface (E1-14, FR-3.1/3.2/3.3).
 *
 * They mirror the Application read/write DTOs in `Schoolcontent/Beheer/SchoolcontentBeheerDtos.cs` one
 * field at a time. Properties are camelCase (the API's default naming policy) and enums arrive as their
 * **names** (`JsonStringEnumConverter` in `Program.cs`), never as numbers.
 *
 * **`SuggestieStatus` is imported from `features/matching` rather than redeclared.** Both describe the same
 * `KoppelingStatus` enum, and this repo has already paid for one enum declared twice: the moment a fifth
 * member is added, a copy here would still type-check while rendering nothing for it. The status badge and
 * its tokens live with the review screen (E2-05), so the type stays where the renderer is.
 *
 * **The level scoping is in the types, not only in the UI** (Art. IX.2). A `ThemaCreatie` carries no klas
 * and no leeftijd because a thema is school-wide; a `SubthemaCreatie` requires both because a subthema
 * cannot exist school-wide. That asymmetry is the server's invariant, and mirroring it here means a
 * component cannot accidentally offer a klas field on the school-wide form.
 */

/** The form of an activiteit (`ActiviteitType`); arrives and is sent by name. */
export type ActiviteitType =
  | "Experiment"
  | "Prentenboek"
  | "Hoek"
  | "Uitstap"
  | "Spel"
  | "Waarneming"
  | "Beweging"
  | "Onderzoek";

/** Every `ActiviteitType`, in the enum's own order, for building a picker without inventing an order. */
export const ACTIVITEIT_TYPES: readonly ActiviteitType[] = [
  "Experiment",
  "Prentenboek",
  "Hoek",
  "Uitstap",
  "Spel",
  "Waarneming",
  "Beweging",
  "Onderzoek",
] as const;

/** A goal link with its teacher decision and, when the AI proposed it, its motivation (Art. IV.2). */
export interface DoelKoppeling {
  id: string;
  leerplandoelCode: string;
  status: SuggestieStatus;
  aiMotivatie: string | null;
}

/** A themadoel: the school-wide anchor, which owns one goal link (Art. IX.2 — 2 to 3 per thema). */
export interface Themadoel {
  id: string;
  koppeling: DoelKoppeling;
}

/** A subdoel: the class/age-scoped goal of a subthema. `leeftijd` is the subthema's own scope. */
export interface Subdoel {
  id: string;
  leeftijd: string;
  koppeling: DoelKoppeling;
}

/** An activiteit with its (zero or more) goal links. Inherits its subthema's klas/leeftijd scope. */
export interface Activiteit {
  id: string;
  naam: string;
  activiteitType: ActiviteitType;
  hoek: string | null;
  verwachteUitkomsten: string | null;
  doelkoppelingen: DoelKoppeling[];
}

/** A subthema with its subdoelen and activiteiten. Always scoped to one klas and one leeftijd. */
export interface Subthema {
  id: string;
  themaId: string;
  naam: string;
  duurWeken: number;
  klasId: string;
  leeftijd: string;
  probleemstelling: string | null;
  onderzoeksvraag: string | null;
  subdoelen: Subdoel[];
  activiteiten: Activiteit[];
}

/**
 * One candidate destination for moving an activiteit (E4-08): a subthema of one klas, carrying the naam of the
 * thema it hangs under.
 *
 * Deliberately not a `Subthema`: a picker needs a label, and reusing the full type would mean fetching every
 * other subthema's subdoelen and activiteiten into the tab to render two words. Same reasoning as
 * `haalThemaVoorKlas` versus `GET /api/themas`.
 */
export interface SubthemaBestemming {
  id: string;
  naam: string;
  leeftijd: string;
  themaId: string;
  themaNaam: string;
}

/**
 * A thema and its whole subtree.
 *
 * `heeftVoldoendeThemadoelen` is the server's own answer to the 2–3 guideline (Art. IX.2). The UI renders it
 * as **advice**, never as a block: the guideline is pedagogical, and E1-14's acceptance criterion says it is
 * surfaced rather than silently enforced. Note the server reports only the *upper* bound as a hard rule; a
 * thema with one themadoel lands fine and is exactly what this flag exists to make visible.
 */
export interface Thema {
  id: string;
  naam: string;
  duurWeken: number;
  invalshoeken: string | null;
  kernwoordenschat: string[];
  rijkeWoordenschat: string[];
  heeftVoldoendeThemadoelen: boolean;
  themadoelen: Themadoel[];
  subthemas: Subthema[];
}

/**
 * One entry in the shared thema-bibliotheek (E1-11, FR-3.3): the school-wide layer **only**.
 *
 * It deliberately carries no subthema's, because those are another class's derivations and must not leak
 * into a school-wide list. `aantalAfgeleideKlassen` is how many classes derived a subthema from this thema,
 * which is what lets the list show uptake without exposing any class's content.
 */
export interface ThemaBibliotheekItem {
  id: string;
  naam: string;
  duurWeken: number;
  invalshoeken: string | null;
  kernwoordenschat: string[];
  rijkeWoordenschat: string[];
  heeftVoldoendeThemadoelen: boolean;
  themadoelen: Themadoel[];
  aantalAfgeleideKlassen: number;
}

// --- Write payloads. One per level, and the shape of each records who owns that level. ---

/** Create/update payload for a school-wide thema: no klas, no leeftijd (Art. IX.2). */
export interface ThemaInvoer {
  naam: string;
  duurWeken: number;
  invalshoeken?: string | null;
  kernwoordenschat?: string[];
  rijkeWoordenschat?: string[];
}

/** Create/update payload for a subthema. `klasId` and `leeftijd` are required and may never be cleared. */
export interface SubthemaInvoer {
  naam: string;
  duurWeken: number;
  klasId: string;
  leeftijd: string;
  probleemstelling?: string | null;
  onderzoeksvraag?: string | null;
}

/** Create/update payload for an activiteit; it inherits the scope of its subthema. */
export interface ActiviteitInvoer {
  naam: string;
  activiteitType: ActiviteitType;
  hoek?: string | null;
  verwachteUitkomsten?: string | null;
}
