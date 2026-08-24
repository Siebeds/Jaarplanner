import type { ComponentType, SVGProps } from "react";
import { IcoonDekking, IcoonDoelen, IcoonPlan, IcoonThemas } from "../components/Iconen";
import type { Vertaalsleutel } from "../i18n";

/**
 * The four destinations, in one place, in the order the bottom bar and the sidebar both use.
 *
 * `gebouwd` is read precisely: it means a real screen answers this route, not that everything the
 * functional analysis promises for that destination exists. A destination that is not built routes
 * to a page that says so in visible text, which is the whole point of listing it here rather than
 * hiding it: a teacher can see the shape of the tool without meeting a control that does nothing.
 */
export interface Bestemming {
  pad: string;
  labelSleutel: Vertaalsleutel;
  Icoon: ComponentType<SVGProps<SVGSVGElement>>;
  gebouwd: boolean;
}

export const BESTEMMINGEN: Bestemming[] = [
  { pad: "/doelen", labelSleutel: "navigatie.doelen", Icoon: IcoonDoelen, gebouwd: true },
  { pad: "/themas", labelSleutel: "navigatie.themas", Icoon: IcoonThemas, gebouwd: false },
  { pad: "/plan", labelSleutel: "navigatie.plan", Icoon: IcoonPlan, gebouwd: false },
  { pad: "/dekking", labelSleutel: "navigatie.dekking", Icoon: IcoonDekking, gebouwd: false },
];
