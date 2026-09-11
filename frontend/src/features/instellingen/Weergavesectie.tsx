import { Segment } from "../../components/ui/Segment";
import { useWeergave, type Weergave } from "../../state/weergave";
import { t } from "../../i18n";

/**
 * Light or dark, the last part of Instellingen because it is the least often touched.
 *
 * "Zoals het toestel" comes first and is the default: most teachers never need this control, and
 * the ones who do are overriding their device, not configuring the app from scratch.
 *
 * The one sentence under it is the fact a teacher would otherwise get wrong. The choice is stored in
 * this browser, so it is not waiting for her on the classroom laptop, and without that line the
 * other laptop looks like a bug. It says browser and not toestel on purpose: localStorage belongs to
 * a browser profile, so another browser on the same laptop starts from the default again, and
 * "toestel" would have promised more than the mechanism keeps.
 */
export function Weergavesectie() {
  const keuze = useWeergave((s) => s.keuze);
  const kies = useWeergave((s) => s.kies);

  const opties: { waarde: Weergave; label: string }[] = [
    { waarde: "systeem", label: t("weergave.systeem") },
    { waarde: "licht", label: t("weergave.licht") },
    { waarde: "donker", label: t("weergave.donker") },
  ];

  return (
    // No heading of its own: the part's name is the page title now, and repeating it under itself
    // reads as a rendering fault. `Segment` still carries the word for a screen reader.
    <div className="flex flex-col gap-3">
      <Segment label={t("weergave.titel")} waarde={keuze} opties={opties} onKies={kies} className="self-start" />
      <p className="text-meta text-inkt-zacht">{t("weergave.dezeBrowser")}</p>
    </div>
  );
}
