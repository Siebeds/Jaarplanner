import { t, type Vertaalsleutel } from "../../i18n";

/**
 * The six fixed star colours (FB-002, owner 2026-09-15), keyed by the server's value in lower case.
 *
 * **Which colours exist is the server's** (`GET /api/gradaties/kleuren`, the `Sterkleur` enum): the choice on screen is
 * rendered from that list, so a colour the server does not know is never offered. This table only says how each one
 * looks and what it is called, and a value missing here draws an ink outline and its raw name rather than nothing.
 *
 * The tokens are in `index.css`, with the reasoning for sharing hues the app already spends.
 */
const STERKLEUREN: Record<string, { vul: string; rand: string; naam: Vertaalsleutel }> = {
  groen: { vul: "var(--color-ster-groen)", rand: "var(--color-ster-groen-rand)", naam: "ontwikkelingsrapport.kleuren.groen" },
  lichtgroen: {
    vul: "var(--color-ster-lichtgroen)",
    rand: "var(--color-ster-lichtgroen-rand)",
    naam: "ontwikkelingsrapport.kleuren.lichtgroen",
  },
  geel: { vul: "var(--color-ster-geel)", rand: "var(--color-ster-geel-rand)", naam: "ontwikkelingsrapport.kleuren.geel" },
  oranje: { vul: "var(--color-ster-oranje)", rand: "var(--color-ster-oranje-rand)", naam: "ontwikkelingsrapport.kleuren.oranje" },
  rood: { vul: "var(--color-ster-rood)", rand: "var(--color-ster-rood-rand)", naam: "ontwikkelingsrapport.kleuren.rood" },
  blauw: { vul: "var(--color-ster-blauw)", rand: "var(--color-ster-blauw-rand)", naam: "ontwikkelingsrapport.kleuren.blauw" },
};

/** How a star of this colour is painted, or undefined for a value this table does not know. */
export function sterkleur(kleur: string): { vul: string; rand: string } | undefined {
  return STERKLEUREN[kleur.toLowerCase()];
}

/** The colour's Dutch name, for the colour choice: never a swatch alone (Art. XII). */
export function sterkleurnaam(kleur: string): string {
  const bekend = STERKLEUREN[kleur.toLowerCase()];
  return bekend ? t(bekend.naam) : kleur;
}
