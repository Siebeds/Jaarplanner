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
