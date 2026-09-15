import { useId, useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Tekstvlak } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst } from "../../lib/datum";
import { t } from "../../i18n";
import type { Subthemareeks } from "../plan/subthemareeksen";
import { MAXIMALE_VERRIJKING, useBewaarHoekverrijkingen } from "./gegevens";
import { reeksSleutel, verrijkingVan, type Verrijkingenweek } from "./verrijkingenweek";

/**
 * What one hoek holds while each subthema of the week runs: the sheet a hoek in the side panel opens (owner, 2026-09-15,
 * FB-038: "de hoekenverrijking wil ik zien hier in de sidepane"; ADR-0044).
 *
 * **One field per subthema running in the week the agenda stands in**, usually one. Each is saved to its own
 * subthemaperiode, and only the fields she changed are sent, each naming this hoek alone: the other corners of that
 * window are not in the request, so a colleague's text in them is never overwritten. A blank field removes what the
 * hoek had there.
 *
 * **A run with no stored window says so before the save** (owner, 2026-09-15, ADR-0041 decision 3). The agenda draws a
 * subthema from its activiteiten alone as well; saving stores its window as the agenda shows it, and she reads that
 * first, not after.
 *
 * **A reader gets the same sheet without a field or a button** (ADR-0030 §3, R7): what the hoek holds, and the sheet's
 * own close control.
 */
export function Hoekverrijkingblad({
  klasId,
  hoek,
  week,
  magPlannen,
  onSluit,
}: {
  klasId: string;
  hoek: { id: string; naam: string };
  week: Verrijkingenweek;
  magPlannen: boolean;
  onSluit: () => void;
}) {
  const bewaar = useBewaarHoekverrijkingen(klasId);
  // Her fields, per run, from the moment she types; until then each shows what is stored.
  const [teksten, setTeksten] = useState<Record<string, string>>({});
  // Its own flag rather than the mutation's: two windows are two requests, and between them the mutation is idle.
  const [bezig, setBezig] = useState(false);

  const reeksen = week.status === "klaar" ? week.reeksen : [];
  const periodes = week.status === "klaar" ? week.periodes : [];
  const opgeslagen = (reeks: Subthemareeks) => verrijkingVan(periodes, reeks, hoek.id) ?? "";
  const waarde = (reeks: Subthemareeks) => teksten[reeksSleutel(reeks)] ?? opgeslagen(reeks);

  async function bewaarAlles() {
    const gewijzigd = reeksen.filter((reeks) => waarde(reeks).trim() !== opgeslagen(reeks).trim());
    // Nothing changed, nothing to say: no request, and no window stored for a run that had none.
    if (gewijzigd.length === 0) {
      onSluit();
      return;
    }

    setBezig(true);
    try {
      for (const reeks of gewijzigd) {
        const verrijkingen = [{ hoekId: hoek.id, tekst: waarde(reeks).trim() }];
        await bewaar.mutateAsync(
          reeks.periodeId
            ? { subthemaperiodeId: reeks.periodeId, verrijkingen }
            : { subthemaperiodeId: null, subthemaId: reeks.subthemaId, van: reeks.van, tot: reeks.tot, verrijkingen },
        );
      }
      onSluit();
    } catch {
      // The sheet stays open with the reason under the fields. What saved before the refusal is stored, and once the
      // read is back it no longer differs from its field, so trying again sends only what is left.
    } finally {
      setBezig(false);
    }
  }

  const kanBewaren = magPlannen && week.status === "klaar" && reeksen.length > 0;
  const fout = bewaar.error instanceof ApiError ? bewaar.error.detail : undefined;

  return (
    <Blad
      open
      onOpenChange={(open) => !open && onSluit()}
      titel={hoek.naam}
      voet={
        kanBewaren ? (
          <div className="flex flex-wrap items-center gap-2">
            <Knop type="button" onClick={() => void bewaarAlles()} disabled={bezig}>
              {bezig ? t("hoekverrijkingblad.bewarenBezig") : t("hoekverrijkingblad.bewaren")}
            </Knop>
            <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
              {t("hoekverrijkingblad.annuleren")}
            </Knop>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {/* Each branch says only what it knows: "no subthema this week" needs the runs and the windows both read. */}
        {week.status === "laadt" ? (
          <Laadlijst rijen={2} />
        ) : week.status === "mislukt" ? (
          <p role="alert" className="text-meta text-attentie-inkt">
            {t("hoekverrijkingblad.laadtMislukt")}
          </p>
        ) : reeksen.length === 0 ? (
          <p className="text-body text-inkt-zacht">{t("hoekverrijkingblad.geenSubthema")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {reeksen.map((reeks) => (
              <Reeksveld
                key={reeksSleutel(reeks)}
                reeks={reeks}
                waarde={waarde(reeks)}
                bewerkbaar={magPlannen}
                bezig={bezig}
                onWaarde={(tekst) => setTeksten({ ...teksten, [reeksSleutel(reeks)]: tekst })}
              />
            ))}
          </ul>
        )}

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

/** One subthema of the week: its name as the label, its days under it, and what the hoek holds, as a field or as text. */
function Reeksveld({
  reeks,
  waarde,
  bewerkbaar,
  bezig,
  onWaarde,
}: {
  reeks: Subthemareeks;
  waarde: string;
  bewerkbaar: boolean;
  bezig: boolean;
  onWaarde: (tekst: string) => void;
}) {
  const id = useId();
  const dagen = periodeTekst(reeks.van, reeks.tot);

  if (!bewerkbaar) {
    return (
      <li>
        <p className="text-meta font-medium text-inkt">{reeks.subthemaNaam}</p>
        <p className="text-micro text-inkt-zwak">{dagen}</p>
        <p className={waarde ? "mt-1 whitespace-pre-line text-body text-inkt" : "mt-1 text-body text-inkt-zacht"}>
          {waarde || t("hoekverrijkingblad.leeg")}
        </p>
      </li>
    );
  }

  return (
    <li>
      <label htmlFor={id} className="text-meta font-medium text-inkt">
        {reeks.subthemaNaam}
      </label>
      <p id={`${id}-dagen`} className="text-micro text-inkt-zwak">
        {dagen}
      </p>
      {/* Only where it is true: no stored window of this subthema shares these days, and this gebruiker's save would
          store one. Tied to the field, so a screen reader hears it before typing, not after saving. */}
      {reeks.periodeId === undefined ? (
        <p id={`${id}-vastleggen`} className="mt-1 text-meta text-inkt-zacht">
          {t("hoekverrijkingblad.periodeVastleggen", { periode: dagen })}
        </p>
      ) : null}
      <Tekstvlak
        id={id}
        value={waarde}
        disabled={bezig}
        rows={3}
        maxLength={MAXIMALE_VERRIJKING}
        placeholder={t("hoekverrijkingblad.voorbeeld")}
        aria-describedby={reeks.periodeId === undefined ? `${id}-dagen ${id}-vastleggen` : `${id}-dagen`}
        onChange={(e) => onWaarde(e.target.value)}
        className="mt-1.5"
      />
    </li>
  );
}
