import type { Activiteitkleur } from "../../lib/types";

/**
 * The six colours a teacher may put on an activiteit.
 *
 * **Deliberately not in `index.css`.** Everything in that file is a semantic token: `doelsoort-md`
 * means minimumdoel, `dekking-gedekt` means covered, `attentie` means something is at stake. These
 * six mean whatever the teacher decided and nothing the application reads, so putting them beside
 * the semantic layer would invite the next screen to give one of them a meaning.
 *
 * **Low saturation on purpose, and that is what keeps them inside Art. XII.** Every hue that carries
 * meaning here is a saturated mark: a dot, a badge, a bar. These are pale surface washes. A wash and
 * a dot are different visual channels, so a teal-grey card cannot be confused with the teal accent or
 * with a green dekking dot, even where they sit on the same row.
 *
 * The name always travels with the colour (`ACTIVITEITKLEUR_SLEUTEL` into `nl.json`), so nothing
 * rests on hue alone.
 */
export { ACTIVITEITKLEUREN } from "../../lib/types";
export type { Activiteitkleur } from "../../lib/types";

/** Wash plus a border a shade down, for a card or a chip carrying the colour. */
export const KLEURVLAK: Record<Activiteitkleur, string> = {
  Klei: "bg-[hsl(18_38%_93%)] border-[hsl(18_30%_82%)]",
  Olijf: "bg-[hsl(74_32%_92%)] border-[hsl(74_25%_78%)]",
  Zee: "bg-[hsl(186_30%_92%)] border-[hsl(186_24%_78%)]",
  Indigo: "bg-[hsl(232_34%_93%)] border-[hsl(232_26%_83%)]",
  Pruim: "bg-[hsl(310_28%_93%)] border-[hsl(310_22%_83%)]",
  Zand: "bg-[hsl(40_38%_92%)] border-[hsl(40_30%_80%)]",
};

/**
 * A solid swatch for the picker, where the colour IS the content.
 *
 * Darker than the wash: a row of six pale rectangles is six rectangles, and a teacher choosing one
 * needs to see which is which before it is on a card.
 */
export const KLEURSTAAL: Record<Activiteitkleur, string> = {
  Klei: "bg-[hsl(18_45%_62%)]",
  Olijf: "bg-[hsl(74_32%_46%)]",
  Zee: "bg-[hsl(186_38%_42%)]",
  Indigo: "bg-[hsl(232_38%_58%)]",
  Pruim: "bg-[hsl(310_30%_54%)]",
  Zand: "bg-[hsl(40_48%_56%)]",
};

/** The catalogue key for a colour's Dutch name. */
export const kleurSleutel = (kleur: Activiteitkleur) => `activiteitkleur.${kleur}` as const;
