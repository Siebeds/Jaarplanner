import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { useActieveSelectie } from "../../lib/selectie";
import { t } from "../../i18n";
import { Hoekensectie } from "./Hoekensectie";
import { Onderdeelwissel } from "./Instellingenindeling";

/**
 * Instellingen, Hoeken: the corners of each classroom, on a page of their own since 2026-09-11.
 *
 * The screen is only the frame. What a hoek is and why this part asks which room it is talking about
 * is written on `Hoekensectie`, which was a section of the single Instellingen page before the split.
 */
export function HoekenScherm() {
  const { klassen, laadt } = useActieveSelectie();

  return (
    <>
      <Schermkop titel={t("instellingen.hoeken")} smal onder={<Onderdeelwissel />} />
      <Schermvlak smal>
        <Hoekensectie klassen={klassen} laadt={laadt} />
      </Schermvlak>
    </>
  );
}
