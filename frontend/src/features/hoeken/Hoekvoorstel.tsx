import { useId, useState, type ReactNode } from "react";
import { AiKnop, Knop } from "../../components/ui/Knop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Tekstvlak } from "../../components/ui/Veld";
import { t } from "../../i18n";
import { Aimerk, Beslisknoppen } from "../themas/Subdoelplaatsing";
import { aiFout, beslisFout } from "../themas/plaatsingen";
import {
  useBeslisHoekverrijkingsvoorstel,
  useVraagHoekverrijkingsvoorstel,
  type Hoekverrijkingsbeslissing,
  type HoekverrijkingsvoorstelWeergave,
} from "./gegevens";
import type { Verrijkingsreeks } from "./verrijkingenweek";

/** The longest text a proposal holds, and so the longest she can keep when she changes it first. Same number as the server. */
const MAXIMAAL_VOORSTEL = 1000;

/**
 * One corner's row in a subthema block, with the AI beside it (FB-028, ADR-0070): a small wand button asks for a
 * verrijking for this corner while this subthema runs, and the open proposal stands under the row.
 *
 * **Only for whoever may plan the klas**, the one person who may ask and decide (owner, 2026-09-24); a reader gets the
 * plain row. The proposal wears the faint ring and is decided with the quiet check, pencil and cross (ADR-0051):
 * taking it over writes the corner's verrijking, the pencil lets her change the text first, the cross leaves the
 * verrijking as it was.
 */
export function Hoekvoorstel({
  klasId,
  hoek,
  reeks,
  voorstel,
  rij,
}: {
  klasId: string;
  hoek: { id: string; naam: string };
  reeks: Verrijkingsreeks;
  /** The open proposal for this corner and this subthema, if any. */
  voorstel: HoekverrijkingsvoorstelWeergave | null;
  /** The row itself: the button that opens the corner's sheet. */
  rij: ReactNode;
}) {
  const vraag = useVraagHoekverrijkingsvoorstel(klasId);
  const beslis = useBeslisHoekverrijkingsvoorstel(klasId);
  const [bewerkt, setBewerkt] = useState<string | null>(null);
  const veldId = useId();
  const knopId = useId();

  function stelVoor() {
    beslis.reset();
    setBewerkt(null);
    vraag.mutate({ hoekId: hoek.id, subthemaId: reeks.subthemaId });
  }

  function neemBeslissing(beslissing: Hoekverrijkingsbeslissing) {
    if (!voorstel) return;
    vraag.reset();
    beslis.mutate(
      { voorstelId: voorstel.id, beslissing },
      {
        onSuccess: () => {
          setBewerkt(null);
          // The card goes; focus goes back to the button that asked for it rather than to the page.
          requestAnimationFrame(() => document.getElementById(knopId)?.focus());
        },
      },
    );
  }

  const venster = reeks.periodeId ? { subthemaperiodeId: reeks.periodeId } : { van: reeks.van, tot: reeks.tot };
  const neemOver = (tekst?: string) =>
    neemBeslissing({ status: "Aanvaard", ...(tekst === undefined ? {} : { tekst }), ...venster });

  const niets = vraag.isSuccess && vraag.data.voorstel === null && !voorstel;
  const fout = vraag.isError ? aiFout(vraag.error, "hoekvoorstel.mislukt") : beslis.isError ? beslisFout(beslis.error) : null;

  return (
    <>
      <div className="flex items-start gap-1">
        {/* The row reaches 6px past its box on either side for its hover; this padding keeps that clear of the button. */}
        <div className="min-w-0 flex-1 pr-1.5">{rij}</div>
        <AiKnop
          id={knopId}
          bezig={vraag.isPending}
          onClick={stelVoor}
          aria-label={t(vraag.isPending ? "hoekvoorstel.bezig" : "hoekvoorstel.vraag", { hoek: hoek.naam })}
          title={t("hoekvoorstel.vraagKort")}
          className="mt-1.5 h-raak w-raak shrink-0 gap-0 px-0 sm:h-8 sm:min-h-8 sm:w-8"
        />
      </div>

      <div aria-live="polite">
        {fout ? (
          <p className="mb-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">{fout}</p>
        ) : niets ? (
          <p className="mb-2 text-meta text-inkt-zacht">{t("hoekvoorstel.nietsNieuws")}</p>
        ) : null}
      </div>

      {voorstel ? (
        <div className="voorstel-ai mb-2 rounded-veld px-3 py-2.5">
          {/* Wraps in the panel's narrow column: the mark and the status on one line, the quiet buttons at the right,
              on the next line when they do not fit beside them. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Aimerk label={t("plaatsing.aiVoorstel")} />
            <Statusmerk status="Voorgesteld" />
            {bewerkt === null ? (
              <span className="ml-auto">
                <Beslisknoppen
                  naam={hoek.naam}
                  bezig={beslis.isPending}
                  aanvaardLabel={t("hoekvoorstel.overnemen")}
                  onAanvaard={() => neemOver()}
                  onPasAan={() => setBewerkt(voorstel.tekst)}
                  onWeiger={() => neemBeslissing({ status: "Geweigerd" })}
                />
              </span>
            ) : null}
          </div>

          {bewerkt === null ? (
            <p className="mt-1.5 whitespace-pre-line text-meta leading-snug text-inkt">{voorstel.tekst}</p>
          ) : (
            <div className="mt-1.5">
              <label htmlFor={veldId} className="sr-only">
                {t("hoekvoorstel.tekstVoor", { hoek: hoek.naam })}
              </label>
              <Tekstvlak
                id={veldId}
                value={bewerkt}
                rows={4}
                maxLength={MAXIMAAL_VOORSTEL}
                disabled={beslis.isPending}
                autoFocus
                onChange={(e) => setBewerkt(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Knop
                  className="px-3 text-meta sm:h-9 sm:min-h-9"
                  bezig={beslis.isPending}
                  disabled={bewerkt.trim().length === 0}
                  onClick={() => neemOver(bewerkt.trim())}
                >
                  {t("hoekvoorstel.overnemen")}
                </Knop>
                <Knop
                  rang="stil"
                  className="px-3 text-meta sm:h-9 sm:min-h-9"
                  disabled={beslis.isPending}
                  onClick={() => setBewerkt(null)}
                >
                  {t("hoekvoorstel.annuleren")}
                </Knop>
              </div>
            </div>
          )}

          <p className="mt-2 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">{voorstel.aiMotivatie}</p>
        </div>
      ) : null}
    </>
  );
}
