import type { Vertaalsleutel } from "../../i18n";
import { useRechten } from "../../lib/rechten";

/**
 * The parts of Instellingen, in the order both shapes list them: the column from `lg` and the switch
 * under the title on a phone.
 *
 * **The routes are built from this list too** (`App.tsx`), so a part's link and its route share one
 * segment and that segment cannot drift. The `/instellingen` prefix is not shared: it is written in
 * `padVan` below, the route table, `routes.ts` and `zijkolom.ts`, and renaming it means all four. A
 * new part is an entry here plus its screen in `App.tsx`'s `INSTELLINGEN`, and the type checker
 * refuses the first without the second (owner, 2026-09-11: "er zullen later wel meerdere settings
 * komen").
 *
 * Each part is a route of its own rather than a section on one long page, which is the split the
 * owner asked for: klassen and hoeken no longer on the same page.
 */
export const ONDERDELEN = [
  { deel: "klassen", labelSleutel: "instellingen.klassen" },
  // Beside the klassen because it answers the other half of the same question: which classes the
  // school has, and who teaches them (E6-04). Admin only (ADR-0030 §3): nobody else sees the
  // link, and a direct visit lands on the first part they can use (`Onderdeelpoort`).
  { deel: "gebruikers", labelSleutel: "instellingen.gebruikers", alleenAdmin: true },
  // The school's hours (FB-023): school organisation like the two above, so it stands with them. Not admin only:
  // every agenda draws these hours, so everyone may read them, and the screen offers the fields to admin alone.
  { deel: "schooluren", labelSleutel: "instellingen.schooluren" },
  { deel: "hoeken", labelSleutel: "instellingen.hoeken" },
  { deel: "algemene-fiches", labelSleutel: "instellingen.algemeneFiches" },
  // Whether the school shows Chuck (FB-071, ADR-0064): a school decision, admin only, touched once.
  { deel: "chuck", labelSleutel: "instellingen.chuck", alleenAdmin: true },
  // Last because it is the least often touched: a teacher sets light or dark once, if ever, while
  // the parts above it are the school's own content and people. The order lives here rather than in
  // any one screen, so this is the only place that sentence stays true.
  //
  // Its label is `weergave.titel` rather than an `instellingen.*` twin: the section already owns
  // that word, and a second key with the same Dutch in it is a key that can drift. Note what that
  // costs, because the type checker cannot see it: this key names three things, the link here, the
  // page title, and the `aria-label` of the light/dark radiogroup. Shortening it for the navigation
  // renames the control for a screen reader too.
  { deel: "weergave", labelSleutel: "weergave.titel" },
] as const satisfies readonly { deel: string; labelSleutel: Vertaalsleutel; alleenAdmin?: boolean }[];

export type Onderdeel = (typeof ONDERDELEN)[number];
export type Deel = Onderdeel["deel"];

/**
 * Whether only admin may see this part: the §3 "beheren" row (`mag.beheer`), which is admin only. The link is
 * hidden, and the server refuses the data.
 */
export function isAlleenAdmin(onderdeel: Onderdeel): boolean {
  return "alleenAdmin" in onderdeel && onderdeel.alleenAdmin;
}

/**
 * The parts this person may see, in `ONDERDELEN` order. Until `/api/ik` has answered, a
 * admin-only part counts as hidden: a link that appears a moment later is better than one that
 * is offered and then taken away. The column, the phone switch and the route gate all read this,
 * so they cannot disagree about which parts exist. The answer comes from `lib/rechten.ts` (E6-02
 * slice 4), the one place the frontend decides what a gebruiker may do.
 */
export function useZichtbareOnderdelen(): readonly Onderdeel[] {
  const { mag } = useRechten();
  return ONDERDELEN.filter((onderdeel) => mag.beheer || !isAlleenAdmin(onderdeel));
}

/** The address of a part. */
export function padVan(deel: Deel): string {
  return `/instellingen/${deel}`;
}
