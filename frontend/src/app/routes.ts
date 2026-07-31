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
 * `magBeheerder` records what functional analysis §3.2 (Toegangsrechten) decrees per **destination**.
 * **Nothing filters on it yet** — there is no authenticated user to filter by (E6-01, gated by E7-11), and
 * inventing a client-side gate would be security theatre over an unauthenticated API. It is here so E6-02
 * filters a list rather than restructuring one.
 *
 * Read the granularity precisely, because getting it wrong is a live defect rather than a documentation one: it
 * is a flag **per route**, and §3.2's rows are per *action*. A destination that carries two actions with
 * different audiences cannot be described here at all, and `/import` is exactly that case (see its entry). Such
 * a destination marks the restricted part at the part, not at the route.
 */
export interface Navigatiebestemming {
  /** Route path, and the identity used by `NavLink`. */
  pad: string;
  /** Catalogue key for the label — never a literal (Art. II.3). */
  labelKey: TranslationKey;
  /**
   * False while the screen behind it is a placeholder; rendered as an explicit marker.
   *
   * Read it precisely: it means "a real screen answers this route", **not** "everything §3 promises for this
   * destination exists". `/themas` is `true` and is knowingly partial — §3 defines Thema's as the shared
   * thema-bibliotheek plus the goal-first opbouwwizard, and neither is built; what answers the route today is
   * the E2 doelsuggestie-review (E1-14 adds beheer, E2-08 the trigger). Flipping it to `false` would hide
   * working, tested UI behind a placeholder, which is worse than the over-claim; so the honest move is to say
   * so here and on the story rather than to let clause 2's absent-or-labelled binary read as unconditionally
   * met. Surfaced by the E0-10 close-out audit.
   */
  isGebouwd: boolean;
  /**
   * The whole destination is directie-only per functional analysis §3.2. Not enforced here — see the note
   * above, and note it is **whole**: a route with a beheerder-only *section* on it is `false` here and carries
   * the marking on the section instead, or E6-02 hides work its own users are entitled to.
   */
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
    isGebouwd: true,
    magBeheerder: false,
    // Read it as precisely as the note on `isGebouwd` asks: E1-16 built the leerplandoel register (browse,
    // search, filter, one doel in full, read-only). The "+ minimumdoelen" half of §3 is NOT here, and cannot
    // be: no `Minimumdoel` row can exist until E1-12 imports the decreed source, which is blocked on a file
    // from directie. The concordance a doel carries is shown on its detail with an honest line; no empty
    // minimumdoel destination is built, because a control that renders nothing is banned (E3-06).
    story: "E1-16 (register); E1-12 unblocks the minimumdoel half",
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
    isGebouwd: true,
    // **`false`, and this is the interesting entry.** FA §3.2 has two rows for what lives here, with two
    // different audiences: *Leerdoelen inladen/vernieuwen (overheidsbron)* = Beheerder, and *Thema's/
    // activiteiten invoeren* = Beheerder **and** Leerkracht (FR-1.1). E1-13 first set this to `true`, which
    // records an answer the matrix contradicts: since this flag is what E6-02 filters the nav by, the first
    // real role filter would have hidden the school-content import from the teachers §3.2 grants it to.
    // So the route is visible to both roles and the beheerder-only marking sits on the Op.stap **section**:
    // `OPSTAP_SECTIE_ALLEEN_BEHEERDER` in `features/import/Opstapimport.tsx`, beside the visible sentence
    // that already says it. **E6-02 must gate that section, not this route.** If the owner decides the whole
    // import screen is directie-only after all, that is a change to §3.2 and belongs in the FA first.
    magBeheerder: false,
    // Read as precisely as the note on `isGebouwd` asks. **E1-13** built both halves of this destination: the
    // teacher-facing school-content import (upload, sjabloon, preview, per-row problems, add vs bijwerken) and
    // the directie-facing Op.stap review flow over E1-15's trigger. What is NOT here is a real Op.stap import
    // of real data: a per-discipline file refuses with a 409 until **E1-12** loads the decreed minimumdoelen,
    // which is blocked on a source file from directie. The Op.stap section states that prerequisite **up
    // front** in visible text (`import.opstap.voorwaarde`), not only reactively in the 409 panel; an earlier
    // version of this comment claimed the screen said so when no string on it mentioned minimumdoelen at all.
    story: "E1-13 (both flows); E1-12 unblocks importing real Op.stap data",
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
