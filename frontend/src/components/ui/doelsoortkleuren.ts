import type { Doelsoort } from "../../lib/types";

/**
 * Which of the six Art. XII hues belongs to which doelsoort, in the two forms the app paints them.
 *
 * A module of its own, beside `Doelsoortmerk.tsx` the way `knopklassen.ts` sits beside `Knop.tsx`.
 * The mark is not the only thing that carries a doelsoort colour any more, and a component file that
 * also exports constants breaks fast refresh for everything that imports it.
 *
 * **Both maps are written out per doelsoort rather than composed.** Tailwind scans source text, so
 * `bg-doelsoort-${soort}` generates no CSS at all and the mark would ship transparent.
 *
 * Neither may ever be the sole carrier of a distinction (Art. XII, WCAG 2.2 AA 1.4.1): every place
 * that uses one of these also prints Op.stap's own mark or the doelsoort's name.
 */
export const DOELSOORTVLAK: Record<Doelsoort, string> = {
  Minimumdoel: "bg-doelsoort-md text-doelsoort-md-op",
  Gemeenschappelijk: "bg-doelsoort-gemeenschappelijk text-doelsoort-gemeenschappelijk-op",
  Verdieping: "bg-doelsoort-verdieping text-doelsoort-verdieping-op",
  Precurriculum: "bg-doelsoort-precurriculum text-doelsoort-precurriculum-op",
  Specifiek: "bg-doelsoort-specifiek text-doelsoort-specifiek-op",
  AnderstaligeNieuwkomers: "bg-doelsoort-anderstalige text-doelsoort-anderstalige-op",
};

/** The same six hues as a left border, for a panel that is about one doel rather than listing many. */
export const DOELSOORTRAND: Record<Doelsoort, string> = {
  Minimumdoel: "border-l-doelsoort-md",
  Gemeenschappelijk: "border-l-doelsoort-gemeenschappelijk",
  Verdieping: "border-l-doelsoort-verdieping",
  Precurriculum: "border-l-doelsoort-precurriculum",
  Specifiek: "border-l-doelsoort-specifiek",
  AnderstaligeNieuwkomers: "border-l-doelsoort-anderstalige",
};
