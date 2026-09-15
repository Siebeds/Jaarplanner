import type { Vertaalsleutel } from "../../i18n";
import type { Mag } from "../../lib/rechten";

/**
 * The sections of Inladen, and the right each one needs (E6-02, ADR-0030 §3).
 *
 * **The section is gated, not the route** (owner ruling 2026-08-03, carried in the E6-02 story). `/inladen` stays one
 * address; what it shows is the sections this gebruiker may use. Themabeheer loads the school's thema's (R9) and does
 * not load Op.stap (R3, directie), so a themabeheer holder gets the one section and no switch.
 *
 * This list is the marker the old frontend had (`magBeheerder` plus a section constant): the screen builds its
 * sections from it, and every link to `/inladen` asks `magInladen`, so a gebruiker who can use neither section is never
 * offered a way in. `beheer` is not a section's right: the beheerder is the directie right now (Art. VI.1), and
 * directie holds both of these anyway.
 */
export const INLAADSECTIES = [
  { bron: "school", labelSleutel: "importeren.school.kort", recht: "schoolcontentImporteren" },
  { bron: "opstap", labelSleutel: "importeren.opstap.kort", recht: "curriculumbeheer" },
] as const satisfies readonly { bron: string; labelSleutel: Vertaalsleutel; recht: keyof Mag }[];

export type Bron = (typeof INLAADSECTIES)[number]["bron"];

/** The sections this gebruiker may use, in screen order. Empty while `/api/ik` has not answered. */
export function toegestaneSecties(mag: Mag) {
  return INLAADSECTIES.filter((sectie) => mag[sectie.recht] === true);
}

/** Whether there is anything at `/inladen` for this gebruiker, so whether to offer a link there at all. */
export function magInladen(mag: Mag): boolean {
  return toegestaneSecties(mag).length > 0;
}
