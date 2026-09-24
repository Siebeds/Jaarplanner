import { useId, useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Tekstvlak } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst } from "../../lib/datum";
import { t } from "../../i18n";
import { MAXIMALE_VERRIJKING, useBewaarHoekverrijkingen, type SubthemaperiodeVerrijkingen } from "./gegevens";
import { verrijkingVan, type Verrijkingsreeks } from "./verrijkingenweek";

/**
 * Every hoek of the klas for ONE subthema: the sheet behind "Al voorbereiden" (FB-098), so a teacher fills the corners
 * for the subthema that comes next before it starts.
 *
 * The same save as the sheet of one hoek (`Hoekverrijkingblad`), turned the other way: one window, several corners.
 * Only the corners she changed are sent, in one request, so a colleague's text in another corner is never overwritten.
 * A blank field removes what the hoek had. Only whoever may plan the klas opens it; a reader has no button to.
 */
export function Subthemaverrijkingblad({
  klasId,
  reeks,
  hoeken,
  periodes,
  onSluit,
}: {
  klasId: string;
  reeks: Verrijkingsreeks;
  hoeken: readonly { id: string; naam: string }[];
  periodes: readonly SubthemaperiodeVerrijkingen[];
  onSluit: () => void;
}) {
  const bewaar = useBewaarHoekverrijkingen(klasId);
  const [teksten, setTeksten] = useState<Record<string, string>>({});
  const id = useId();
  const dagen = periodeTekst(reeks.van, reeks.tot);

  const opgeslagen = (hoekId: string) => verrijkingVan(periodes, reeks, hoekId) ?? "";
  const waarde = (hoekId: string) => teksten[hoekId] ?? opgeslagen(hoekId);

  function bewaarAlles() {
    const verrijkingen = hoeken
      .filter((hoek) => waarde(hoek.id).trim() !== opgeslagen(hoek.id).trim())
      .map((hoek) => ({ hoekId: hoek.id, tekst: waarde(hoek.id).trim() }));
    // Nothing changed, nothing to say: no request, and no window stored for a subthema that had none.
    if (verrijkingen.length === 0) {
      onSluit();
      return;
    }
    bewaar.mutate(
      reeks.periodeId
        ? { subthemaperiodeId: reeks.periodeId, verrijkingen }
        : { subthemaperiodeId: null, subthemaId: reeks.subthemaId, van: reeks.van, tot: reeks.tot, verrijkingen },
      { onSuccess: onSluit },
    );
  }

  const bezig = bewaar.isPending;
  const fout = bewaar.error instanceof ApiError ? bewaar.error.detail : undefined;

  return (
    <Blad
      open
      onOpenChange={(open) => !open && !bezig && onSluit()}
      titel={reeks.subthemaNaam}
      voet={
        <div className="flex flex-wrap items-center gap-2">
          <Knop type="button" onClick={bewaarAlles} disabled={bezig}>
            {bezig ? t("hoekverrijkingblad.bewarenBezig") : t("hoekverrijkingblad.bewaren")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("hoekverrijkingblad.annuleren")}
          </Knop>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p id={`${id}-dagen`} className="text-meta text-inkt-zacht">
          {dagen}
        </p>
        {/* Only where it is true: no stored window of this subthema covers these days, and a save would store one. */}
        {reeks.periodeId === undefined ? (
          <p id={`${id}-vastleggen`} className="text-meta text-inkt-zacht">
            {t("hoekverrijkingblad.periodeVastleggen", { periode: dagen })}
          </p>
        ) : null}
        <ul className="flex flex-col gap-4">
          {hoeken.map((hoek) => (
            <li key={hoek.id}>
              <label htmlFor={`${id}-${hoek.id}`} className="text-meta font-medium text-inkt">
                {hoek.naam}
              </label>
              <Tekstvlak
                id={`${id}-${hoek.id}`}
                value={waarde(hoek.id)}
                disabled={bezig}
                rows={2}
                maxLength={MAXIMALE_VERRIJKING}
                aria-describedby={reeks.periodeId === undefined ? `${id}-dagen ${id}-vastleggen` : `${id}-dagen`}
                onChange={(e) => setTeksten({ ...teksten, [hoek.id]: e.target.value })}
                className="mt-1.5"
              />
            </li>
          ))}
        </ul>

        {bewaar.isError ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("hoekverrijkingblad.mislukt")}</p>
            {fout ? <p className="mt-1 text-meta text-attentie-inkt">{fout}</p> : null}
          </div>
        ) : null}
      </div>
    </Blad>
  );
}
