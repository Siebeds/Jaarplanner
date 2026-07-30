import type { TranslationKey } from "../i18n";

/**
 * The app's routes and primary navigation in one place (E0-10, ADR-0021).
 *
 * The information architecture is fixed by `docs/ux/ui-ux-approach.md` §3: six destinations, in this
 * order. Two of them are built; four are not, and they are listed here anyway so a teacher can see the
 * shape of the tool. What must never happen is a nav item that looks available and silently does
 * nothing — the rule E3-06 was built under — so `isGebouwd: false` is rendered as a visible
 * "nog niet beschikbaar" marker and lands on a page that says so.
 *
 * `magBeheerder` records what functional analysis §3.2 (Toegangsrechten) already decrees: Import and
 * Beheer are directie-only. **Nothing filters on it yet** — there is no authenticated user to filter by
 * (E6-01, gated by E7-11), and inventing a client-side gate would be security theatre over an
 * unauthenticated API. It is here so E6-02 filters a list rather than restructuring one.
 */
export interface Navigatiebestemming {
  /** Route path, and the identity used by `NavLink`. */
  pad: string;
  /** Catalogue key for the label — never a literal (Art. II.3). */
  labelKey: TranslationKey;
  /** False while the screen behind it is unbuilt; rendered as an explicit marker. */
  isGebouwd: boolean;
  /** Directie-only per functional analysis §3.2. Not enforced here — see the note above. */
  magBeheerder: boolean;
  /** Catalogue key describing what will live here, shown on the placeholder page. */
  binnenkortKey?: TranslationKey;
  /** The backlog story that owns building it — for the team, never rendered. */
  story?: string;
}

export const JAARPLAN_PAD = "/jaarplan";

export const NAVIGATIE: readonly Navigatiebestemming[] = [
  {
    pad: "/doelen",
    labelKey: "navigatie.doelen",
    isGebouwd: false,
    magBeheerder: false,
    binnenkortKey: "binnenkort.doelen",
    story: "E1-13/E1-14 surface the imported goals; no story owns a browse screen yet",
  },
  {
    pad: "/themas",
    labelKey: "navigatie.themas",
    isGebouwd: true,
    magBeheerder: false,
    story: "E2-05/E2-06 built the review, E2-08 the trigger; E1-14 adds beheer",
  },
  {
    pad: JAARPLAN_PAD,
    labelKey: "navigatie.jaarplan",
    isGebouwd: true,
    magBeheerder: false,
    story: "E3-06",
  },
  {
    pad: "/dekking",
    labelKey: "navigatie.dekking",
    isGebouwd: false,
    magBeheerder: false,
    binnenkortKey: "binnenkort.dekking",
    story: "E5-02/E5-03/E5-05",
  },
  {
    pad: "/import",
    labelKey: "navigatie.import",
    isGebouwd: false,
    magBeheerder: true,
    binnenkortKey: "binnenkort.import",
    story: "E1-13 (schoolcontent) + E1-15 (Op.stap trigger)",
  },
  {
    pad: "/beheer",
    labelKey: "navigatie.beheer",
    isGebouwd: false,
    magBeheerder: true,
    binnenkortKey: "binnenkort.beheer",
    story: "E6-03/E6-04",
  },
] as const;
