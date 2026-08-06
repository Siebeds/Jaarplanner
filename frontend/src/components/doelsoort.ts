/**
 * The doelsoort vocabulary shared by everything that renders a {@link DoelsoortBadge} (Art. VII.1, XII).
 *
 * Two forms exist and both are needed: the **wire form** the API serialises (the backend `Doelsoort` enum
 * by name, PascalCase) and the badge's own lowercase key, which is also the design-token name. The mapping
 * between them lives here, once. It used to be copied into every list that shows a badge — the
 * doelsuggestie list and the ongekoppelde-doelen list each held an identical six-entry table, with a
 * comment noting the duplication — and two copies of a table keyed on an enum are two places to forget
 * when Op.stap adds a doelsoort.
 *
 * It is a plain module rather than part of `DoelsoortBadge.tsx` because a component file that also exports
 * constants breaks React Fast Refresh (and our lint rule says so).
 */

import { t } from "../i18n";

/** The badge's own key per doelsoort — also the design-token name (see `tailwind.config.js`). */
export type Doelsoort =
  | "md"
  | "gemeenschappelijk"
  | "verdieping"
  | "precurriculum"
  | "specifiek"
  | "anderstalige";

/** The Op.stap doelsoort as the API serialises it — the backend `Doelsoort` enum by name (Art. VII.1). */
export type DoelsoortNaam =
  | "Minimumdoel"
  | "Gemeenschappelijk"
  | "Verdieping"
  | "Precurriculum"
  | "Specifiek"
  | "AnderstaligeNieuwkomers";

/** The one mapping from the API's PascalCase doelsoort to the badge's key. */
export const doelsoortBadgeSoort: Record<DoelsoortNaam, Doelsoort> = {
  Minimumdoel: "md",
  Gemeenschappelijk: "gemeenschappelijk",
  Verdieping: "verdieping",
  Precurriculum: "precurriculum",
  Specifiek: "specifiek",
  AnderstaligeNieuwkomers: "anderstalige",
};

/**
 * The Dutch label for a doelsoort in its **wire** form (E5-03).
 *
 * A one-line wrapper, and it lives here rather than at its call site for the reason this whole module exists: the two
 * forms are what it keeps straight, and passing the wire form ("Minimumdoel") where the catalogue key ("md") belongs
 * renders a bare `doelsoort.Minimumdoel` on screen instead of a Dutch label.
 *
 * It is also why it is not exported from the component that uses it: a component file exporting a function breaks
 * React Fast Refresh, which is the same rule that put `doelsoortBadgeSoort` here in the first place.
 *
 * `Doelenfilters` holds a private `badgeKey` doing the same hop. It is left where it is rather than migrated, because
 * changing the register is not E5-03's; a third caller should use this one rather than write a third copy.
 */
export function doelsoortLabel(doelsoort: DoelsoortNaam): string {
  return t(`doelsoort.${doelsoortBadgeSoort[doelsoort]}`);
}
