/**
 * The AI goal-match domain types shared across the matching feature (E2, FR-4). Names mirror the
 * backend read view (`DoelMatchSuggestieWeergave`) and the `KoppelingStatus` enum (Art. IV.2),
 * serialised by name — so the status strings are PascalCase exactly as the API sends/accepts them.
 */

/** The human-in-the-loop status of a doelsuggestie (Art. IV.2). */
export type SuggestieStatus = "Voorgesteld" | "Aanvaard" | "Geweigerd" | "Manueel";

/** A teacher decision on a suggestion (E2-05): accept / reject / adjust — never `Voorgesteld` (AI-only). */
export type Leerkrachtbeslissing = Exclude<SuggestieStatus, "Voorgesteld">;

/** One persisted AI goal-match suggestion for a thema (FR-4.3). */
export interface Doelsuggestie {
  id: string;
  leerplandoelCode: string;
  status: SuggestieStatus;
  aiMotivatie: string | null;
}
