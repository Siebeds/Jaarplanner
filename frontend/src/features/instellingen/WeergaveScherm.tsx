import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { t } from "../../i18n";
import { Weergavesectie } from "./Weergavesectie";
import { Onderdeelwissel } from "./Instellingenindeling";

/**
 * Instellingen, Weergave: light or dark, on a page of their own since 2026-09-11.
 *
 * It was the last section of the single Instellingen page. That page was split into parts on the
 * same day, on a branch that did not carry this control, so the merge of the two is what made it a
 * part. Why the choice lives in the browser, and why the copy says so, is written on
 * `Weergavesectie`.
 */
export function WeergaveScherm() {
  return (
    <>
      <Schermkop titel={t("weergave.titel")} maat="smal" onder={<Onderdeelwissel />} />
      <Schermvlak maat="smal">
        <Weergavesectie />
      </Schermvlak>
    </>
  );
}
