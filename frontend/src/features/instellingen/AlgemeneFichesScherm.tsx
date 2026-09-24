import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { useActieveSelectie } from "../../lib/selectie";
import { t } from "../../i18n";
import { Algemenefichesectie } from "./Algemenefichesectie";
import { Onderdeelwissel } from "./Instellingenindeling";

/**
 * Instellingen, Algemene fiches: the recurring activities of each klas outside every thema.
 *
 * The fiches arrived on main as a third section of the single Instellingen page, on the same day the
 * owner split that page into parts; they became a part of their own when the two met (2026-09-11).
 * The screen is only the frame, exactly as `HoekenScherm` is: what a fiche is and how it is managed
 * is written on `Algemenefichesectie`.
 */
export function AlgemeneFichesScherm() {
  const { klassen, laadt } = useActieveSelectie();

  return (
    <>
      <Schermkop titel={t("instellingen.algemeneFiches")} maat="smal" onder={<Onderdeelwissel />} />
      <Schermvlak maat="smal">
        <Algemenefichesectie klassen={klassen} laadt={laadt} />
      </Schermvlak>
    </>
  );
}
