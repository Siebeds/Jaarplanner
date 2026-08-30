import type { ComponentType, SVGProps } from "react";
import { IcoonDekking, IcoonDoelen, IcoonPlan, IcoonThemas } from "../components/Iconen";
import type { Vertaalsleutel } from "../i18n";

/**
 * The four destinations, in one place, in the order the bottom bar and the sidebar both use.
 *
 * All four answer with a real screen. There is deliberately no "not built yet" flag here: the moment
 * one exists it has to be rendered as visible text on the destination itself (the E3-06 rule), and a
 * flag nobody renders is exactly how a nav item ends up looking available while doing nothing.
 */
export interface Bestemming {
  pad: string;
  labelSleutel: Vertaalsleutel;
  Icoon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const BESTEMMINGEN: Bestemming[] = [
  { pad: "/doelen", labelSleutel: "navigatie.doelen", Icoon: IcoonDoelen },
  { pad: "/themas", labelSleutel: "navigatie.themas", Icoon: IcoonThemas },
  { pad: "/agenda", labelSleutel: "navigatie.agenda", Icoon: IcoonPlan },
  { pad: "/dekking", labelSleutel: "navigatie.dekking", Icoon: IcoonDekking },
];
