import type { ComponentType, SVGProps } from "react";
import { IcoonDekking, IcoonDoelen, IcoonInstellingen, IcoonPlan, IcoonRapport, IcoonThemas } from "../components/Iconen";
import type { Vertaalsleutel } from "../i18n";

/**
 * The destinations, in one place, in the order the bottom bar and the sidebar both use.
 *
 * All of them answer with a real screen. There is deliberately no "not built yet" flag here: the
 * moment one exists it has to be rendered as visible text on the destination itself (the E3-06
 * rule), and a flag nobody renders is exactly how a nav item ends up looking available while doing
 * nothing.
 */
export interface Bestemming {
  pad: string;
  labelSleutel: Vertaalsleutel;
  Icoon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * The daily work: the four screens a teacher moves between all year.
 */
export const BESTEMMINGEN: Bestemming[] = [
  { pad: "/doelen", labelSleutel: "navigatie.doelen", Icoon: IcoonDoelen },
  { pad: "/themas", labelSleutel: "navigatie.themas", Icoon: IcoonThemas },
  { pad: "/agenda", labelSleutel: "navigatie.agenda", Icoon: IcoonPlan },
  { pad: "/dekking", labelSleutel: "navigatie.dekking", Icoon: IcoonDekking },
];

/**
 * Setting the school up, kept apart from the four above and drawn last (owner, 2026-08-30).
 *
 * A separate list rather than a flag on the same one, because the two groups are laid out
 * differently: in the sidebar this is pushed to the bottom edge, away from the work, and a `filter`
 * over one array in two places is how a fifth tab quietly ends up in both.
 *
 * It is one destination today. It stays an array because a settings screen grows sections and the
 * second one to earn its own destination should not have to reshape the navigation to get there.
 */
/**
 * The K3 ontwikkelingsrapport (FR-13.10; ADR-0035 R32, D17, D18), a destination of its own.
 *
 * Not in `ONDERAAN`: that group means setting the school up, and every entry in it is a phone tab too. The report is
 * neither. From `lg` it sits in a section of its own at the bottom of the sidebar, above Instellingen, and only for
 * whoever may read a report; on a phone the bar keeps its five tabs and the report is reached from Instellingen
 * (owner, 2026-09-15). `Navigatie` and `Instellingenindeling` render it, each for its own viewport.
 */
export const RAPPORT: Bestemming = {
  pad: "/ontwikkelingsrapport",
  labelSleutel: "navigatie.ontwikkelingsrapport",
  Icoon: IcoonRapport,
};

export const ONDERAAN: Bestemming[] = [
  { pad: "/instellingen", labelSleutel: "navigatie.instellingen", Icoon: IcoonInstellingen },
];
