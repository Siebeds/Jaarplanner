import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Tekstvlak } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst } from "../../lib/datum";
import { t } from "../../i18n";
import type { Subthemareeks } from "../plan/subthemareeksen";
import {
  MAXIMALE_VERRIJKING,
  useBewaarHoekverrijkingen,
  type HoekWeergave,
  type SubthemaperiodeVerrijkingen,
} from "./gegevens";

/**
 * What each hoek of the klas holds while one subthema runs: the sheet a row of the subthemabalk opens (owner,
 * 2026-09-15, FB-020).
 *
 * **One field per hoek, saved together**, because she writes them together: standing in the agenda at the start of "de
 * herfst", she goes round the room. The server writes the whole set in one save, where a blank field removes what that
 * hoek had.
 *
 * **A run with no stored window says so before the save** (owner, 2026-09-15). The agenda draws a subthema from its
 * activiteiten alone as well; saving here stores its window as the balk shows it, and she reads that first, not after.
 *
 * **A reader gets the same sheet without a field or a button** (E6-02, ADR-0030 §3, R7): what each hoek holds, and the
 * sheet's own close control.
 */
export function Verrijkingenblad({
  klasId,
  reeks,
  periode,
  hoeken,
  status,
  magPlannen,
  onSluit,
}: {
  klasId: string;
  reeks: Subthemareeks;
  /** The stored window's verrijkingen, or undefined for a run with no stored window (or none read yet). */
  periode: SubthemaperiodeVerrijkingen | undefined;
  hoeken: readonly HoekWeergave[] | undefined;
  /** Whether the hoeken and the verrijkingen are read: the fields are only filled from a read that finished. */
  status: "laadt" | "mislukt" | "klaar";
  magPlannen: boolean;
  onSluit: () => void;
}) {
  const bewaar = useBewaarHoekverrijkingen(klasId);
  const [teksten, setTeksten] = useState<Record<string, string> | null>(null);

  // The fields start from what is stored, once the read has it; after that they are hers until she saves or closes.
  const opgeslagen = Object.fromEntries((periode?.verrijkingen ?? []).map((v) => [v.hoekId, v.tekst]));
  const waarden = teksten ?? opgeslagen;

  function bewaarAlles() {
    const verrijkingen = (hoeken ?? []).map((hoek) => ({ hoekId: hoek.id, tekst: (waarden[hoek.id] ?? "").trim() }));
    bewaar.mutate(
      reeks.periodeId
        ? { subthemaperiodeId: reeks.periodeId, verrijkingen }
        : { subthemaperiodeId: null, subthemaId: reeks.subthemaId, van: reeks.van, tot: reeks.tot, verrijkingen },
      { onSuccess: onSluit },
    );
  }

  const kanBewaren = magPlannen && status === "klaar" && (hoeken?.length ?? 0) > 0;
  const fout = bewaar.error instanceof ApiError ? bewaar.error.detail : undefined;

  return (
    <Blad
      open
      onOpenChange={(open) => !open && onSluit()}
      titel={t("verrijkingenblad.titel", { naam: reeks.subthemaNaam })}
      voet={
        kanBewaren ? (
          <div className="flex flex-wrap items-center gap-2">
            <Knop type="button" onClick={bewaarAlles} disabled={bewaar.isPending}>
              {bewaar.isPending ? t("verrijkingenblad.bewarenBezig") : t("verrijkingenblad.bewaren")}
            </Knop>
            <Knop rang="stil" type="button" onClick={onSluit} disabled={bewaar.isPending}>
              {t("verrijkingenblad.annuleren")}
            </Knop>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-meta text-inkt-zwak">{periodeTekst(reeks.van, reeks.tot)}</p>

        {/* Only where it is true: this run has no stored window, and this gebruiker's save would store one. */}
        {magPlannen && reeks.periodeId === undefined ? (
          <p className="text-meta text-inkt-zacht">
            {t("verrijkingenblad.periodeVastleggen", { periode: periodeTekst(reeks.van, reeks.tot) })}
          </p>
        ) : null}

        {status === "laadt" ? (
          <Laadlijst rijen={3} />
        ) : status === "mislukt" ? (
          <p role="alert" className="text-meta text-attentie-inkt">
            {t("verrijkingenblad.laadtMislukt")}
          </p>
        ) : (hoeken ?? []).length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-body text-inkt-zacht">{t("verrijkingenblad.geenHoeken")}</p>
            {magPlannen ? (
              <Link
                to="/instellingen/hoeken"
                className="text-meta font-medium text-accent underline-offset-2 hover:underline"
              >
                {t("verrijkingenblad.naarHoeken")}
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {(hoeken ?? []).map((hoek) => (
              <Hoekveld
                key={hoek.id}
                naam={hoek.naam}
                waarde={waarden[hoek.id] ?? ""}
                bewerkbaar={magPlannen}
                bezig={bewaar.isPending}
                onWaarde={(tekst) => setTeksten({ ...waarden, [hoek.id]: tekst })}
              />
            ))}
          </ul>
        )}

        {bewaar.isError ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("verrijkingenblad.mislukt")}</p>
            {fout ? <p className="mt-1 text-meta text-attentie-inkt">{fout}</p> : null}
          </div>
        ) : null}
      </div>
    </Blad>
  );
}

/** One hoek: its name as the label, and what it holds, as a field or as text. */
function Hoekveld({
  naam,
  waarde,
  bewerkbaar,
  bezig,
  onWaarde,
}: {
  naam: string;
  waarde: string;
  bewerkbaar: boolean;
  bezig: boolean;
  onWaarde: (tekst: string) => void;
}) {
  const id = useId();

  if (!bewerkbaar) {
    return (
      <li>
        <p className="text-meta font-medium text-inkt">{naam}</p>
        <p className={waarde ? "mt-0.5 whitespace-pre-line text-body text-inkt" : "mt-0.5 text-body text-inkt-zacht"}>
          {waarde || t("verrijkingenblad.leeg")}
        </p>
      </li>
    );
  }

  return (
    <li>
      <label htmlFor={id} className="text-meta font-medium text-inkt">
        {naam}
      </label>
      <Tekstvlak
        id={id}
        value={waarde}
        disabled={bezig}
        rows={2}
        maxLength={MAXIMALE_VERRIJKING}
        placeholder={t("verrijkingenblad.voorbeeld")}
        onChange={(e) => onWaarde(e.target.value)}
        className="mt-1"
      />
    </li>
  );
}
