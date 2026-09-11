import type { Vertaalsleutel } from "../../i18n";

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
  { deel: "hoeken", labelSleutel: "instellingen.hoeken" },
  { deel: "algemene-fiches", labelSleutel: "instellingen.algemeneFiches" },
  // Last because it is the least often touched: a teacher sets light or dark once, if ever, while
  // the three above it are the school's own content. The order lives here rather than in any one
  // screen, so this is the only place that sentence stays true.
  //
  // Its label is `weergave.titel` rather than an `instellingen.*` twin: the section already owns
  // that word, and a second key with the same Dutch in it is a key that can drift. Note what that
  // costs, because the type checker cannot see it: this key names three things, the link here, the
  // page title, and the `aria-label` of the light/dark radiogroup. Shortening it for the navigation
  // renames the control for a screen reader too.
  { deel: "weergave", labelSleutel: "weergave.titel" },
] as const satisfies readonly { deel: string; labelSleutel: Vertaalsleutel }[];

export type Deel = (typeof ONDERDELEN)[number]["deel"];

/** The address of a part. */
export function padVan(deel: Deel): string {
  return `/instellingen/${deel}`;
}
