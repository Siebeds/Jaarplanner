import { Schermkop, Schermvlak } from "./Schermkop";
import { Leegte } from "../components/ui/Leegte";
import { t } from "../i18n";
import type { Vertaalsleutel } from "../i18n";

/**
 * The page behind a destination that is listed but not built.
 *
 * It exists so the navigation can show the shape of the tool without shipping a control that does
 * nothing: the destination is reachable, and what it says when you get there is the plain sentence
 * that it is not there yet. Written on the page, never in a tooltip.
 */
export function NogNietGebouwd({ titelSleutel }: { titelSleutel: Vertaalsleutel }) {
  return (
    <>
      <Schermkop titel={t(titelSleutel)} />
      <Schermvlak>
        <Leegte titel={t("navigatie.nogNietGebouwd")} />
      </Schermvlak>
    </>
  );
}
