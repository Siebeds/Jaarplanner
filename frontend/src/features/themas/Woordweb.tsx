import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { IcoonKruis } from "../../components/Iconen";
import { AiKnop } from "../../components/ui/Knop";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { Voorstelstapel } from "../../components/ui/Voorstelstapel";
import { ApiError } from "../../lib/api";
import { geenToegangZin, useRechten } from "../../lib/rechten";
import type { WoordwebWeergave, WoordwebWoord } from "../../lib/types";
import { t } from "../../i18n";
import { Subkop } from "./Fiche";
import { useBeslisWoord, useStelWoordenVoor, useVerwijderWoord, useVoegWoordenToe, useWoordwebs } from "./woordwebs";

const staatInWeb = (woord: WoordwebWoord) => woord.status === "Manueel" || woord.status === "Aanvaard";

/**
 * The brainstorm of step 3, per teacher (FB-036, ADR-0043): her own woordweb on this subthema, and her colleagues' below
 * it, to read.
 *
 * **The subthema's name sits in the middle of her words.** The owner asked for "losse woorden rond het thema", and a
 * radial diagram is what that phrase suggests, but at 390 pixels a circle of chips either overlaps or shrinks to a dot.
 * One centred, wrapping line of words with the name as its dark core reads as "around" at every width: the words split
 * in two halves on either side of it and the field to add one closes the line. The dark core is the one bold object
 * here; everything else is the fiche's ordinary ink.
 *
 * **Every write saves at once**, so there is no Bewaren: a word is typed and Enter, a comma or a paste of a list sends
 * it. The field keeps what was typed until the server took it.
 *
 * **The AI's proposals wait below the web, one at a time with its reason**, in the same `Voorstelstapel` as the
 * doelsuggesties on this screen (TB-045), so a teacher meets one shape for "the AI proposes, you decide" (Art. IV.1
 * to IV.3). Only the owner's web gets them, and the AI control stays disabled, with the one sentence that says why,
 * until the web holds a word of her own (W5).
 *
 * **A colleague's web is read-only**: her name and her words, outlined rather than filled, so the two kinds of web never
 * look alike. Admin may take a word out of any web (D3); nobody else sees a control there. A colleague's open
 * proposals and rejected words are hers, and are not shown.
 */
export function Woordweb({ subthemaId, naam }: { subthemaId: string; naam: string }) {
  const { data: webs, isPending, isError } = useWoordwebs(subthemaId);
  const { mag, bekend } = useRechten();
  const voegToe = useVoegWoordenToe(subthemaId);
  const verwijder = useVerwijderWoord(subthemaId);
  const beslis = useBeslisWoord(subthemaId);
  const stelVoor = useStelWoordenVoor(subthemaId);

  if (isPending) {
    return (
      <Subkop titel={t("woordweb.titel")}>
        <Laadvlak className="h-16" />
      </Subkop>
    );
  }

  if (isError || !webs) {
    return (
      <Subkop titel={t("woordweb.titel")}>
        <p className="text-meta text-inkt-zacht">{t("woordweb.laadFout")}</p>
      </Subkop>
    );
  }

  const eigen = webs.find((web) => web.isEigen) ?? null;
  const eigenWoorden = eigen?.woorden.filter(staatInWeb) ?? [];
  const voorstellen = eigen?.woorden.filter((woord) => woord.status === "Voorgesteld") ?? [];
  const collegas = webs.filter((web) => !web.isEigen && web.woorden.some(staatInWeb));
  const helft = Math.ceil(eigenWoorden.length / 2);

  const haalWeg = (web: WoordwebWeergave, woord: WoordwebWoord) =>
    verwijder.mutate({ woordwebId: web.id, woordId: woord.id });

  const schrijffout = [voegToe, verwijder, beslis]
    .map((mutatie) => mutatie.error)
    .filter((fout) => fout !== null)
    .map((fout) => geenToegangZin(fout) ?? (fout instanceof ApiError && fout.status === 400 && fout.detail ? fout.detail : t("woordweb.bewaarMislukt")))[0];

  return (
    <Subkop titel={t("woordweb.titel")}>
      <div
        role="group"
        aria-label={t("woordweb.eigenLabel", { naam })}
        className="flex flex-wrap items-center justify-center gap-1.5 rounded-veld border border-lijn bg-kaart px-3 py-4"
      >
        {eigenWoorden.slice(0, helft).map((woord) => (
          <Woordchip key={woord.id} woord={woord.woord} onHaalWeg={eigen ? () => haalWeg(eigen, woord) : undefined} />
        ))}
        <span className="rounded-full bg-inkt px-3.5 py-1.5 text-body font-medium text-kaart">{naam}</span>
        {eigenWoorden.slice(helft).map((woord) => (
          <Woordchip key={woord.id} woord={woord.woord} onHaalWeg={eigen ? () => haalWeg(eigen, woord) : undefined} />
        ))}
        {bekend ? (
          <WoordInvoer
            leeg={eigenWoorden.length === 0}
            onVoegToe={(woorden, gelukt) =>
              voegToe.mutate({ woordwebId: eigen?.id ?? null, woorden }, { onSuccess: gelukt })
            }
          />
        ) : null}
      </div>

      {bekend ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <AiKnop
            className="h-9 min-h-9 px-2.5 text-meta"
            bezig={stelVoor.isPending}
            disabled={eigen === null || eigenWoorden.length === 0}
            onClick={() => eigen && stelVoor.mutate(eigen.id)}
          >
            {stelVoor.isPending ? t("woordweb.voorstellenBezig") : t("woordweb.voorstellen")}
          </AiKnop>
          {eigenWoorden.length === 0 ? <p className="text-meta text-inkt-zacht">{t("woordweb.eerstZelf")}</p> : null}
        </div>
      ) : null}

      <div aria-live="polite">
        {stelVoor.isError ? (
          <p className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
            {aiFout(stelVoor.error)}
          </p>
        ) : stelVoor.data && stelVoor.data.aantalVoorgesteld === 0 ? (
          <p className="mt-2 text-meta text-inkt-zacht">{t("woordweb.geenNieuwe")}</p>
        ) : null}
        {schrijffout ? (
          <p role="alert" className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
            {schrijffout}
          </p>
        ) : null}
      </div>

      {eigen !== null && voorstellen.length > 0 ? (
        <div className="mt-3">
          <Voorstelstapel
            label={t("voorstelstapel.woordenLabel")}
            voorstellen={voorstellen.map((voorstel) => ({
              id: voorstel.id,
              naam: voorstel.woord,
              inhoud: voorstel.woord,
              motivatie: voorstel.aiMotivatie,
            }))}
            onBeslis={(woordId, status) => beslis.mutateAsync({ woordwebId: eigen.id, woordId, status })}
          />
        </div>
      ) : null}

      {collegas.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-meta font-medium text-inkt-zacht">{t("woordweb.collegas")}</h4>
          <ul className="mt-2 flex flex-col gap-3">
            {collegas.map((web) => (
              <li key={web.id} aria-label={t("woordweb.vanCollega", { naam: web.eigenaarNaam })}>
                <p className="text-meta font-medium text-inkt">{web.eigenaarNaam}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {web.woorden.filter(staatInWeb).map((woord) => (
                    <Woordchip
                      key={woord.id}
                      woord={woord.woord}
                      omlijnd
                      onHaalWeg={mag.woordwebBewerken(web.eigenaarId) ? () => haalWeg(web, woord) : undefined}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Subkop>
  );
}

/** What went wrong with an AI request, in the words a teacher can act on. */
function aiFout(fout: unknown): string {
  const geweigerd = geenToegangZin(fout);
  if (geweigerd) return geweigerd;
  if (fout instanceof ApiError && fout.status === 422) return t("woordweb.aiOngeldig");
  // 400 is a refusal the server words for the teacher; 502 is an answer cut off at the output ceiling (TB-043).
  if (fout instanceof ApiError && (fout.status === 400 || fout.status === 502) && fout.detail) return fout.detail;
  return t("woordweb.aiMislukt");
}

/**
 * One word. Filled for one's own web, outlined for a colleague's: weight, not a hue, because every hue here already
 * means something (Art. XII). The remove control is 24 pixels, the WCAG 2.2 minimum target, and only there for whoever
 * may change that web.
 */
function Woordchip({ woord, omlijnd, onHaalWeg }: { woord: string; omlijnd?: boolean; onHaalWeg?: () => void }) {
  return (
    <span
      className={
        omlijnd
          ? "inline-flex items-center gap-1 rounded-full border border-lijn py-1 pl-2.5 pr-2.5 text-meta text-inkt-zacht has-[button]:pr-1"
          : "inline-flex items-center gap-1 rounded-full bg-vlak-diep py-1 pl-2.5 pr-2.5 text-meta font-medium text-inkt has-[button]:pr-1"
      }
    >
      {woord}
      {onHaalWeg ? (
        <button
          type="button"
          aria-label={t("woordweb.haalWeg", { woord })}
          onClick={onHaalWeg}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-inkt-zwak transition-colors duration-150 hover:bg-kaart hover:text-inkt"
        >
          <IcoonKruis aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </span>
  );
}

/**
 * The field that adds words, at the end of the line of words. Enter, a comma or a semicolon sends what was typed; a
 * pasted list becomes separate words (the reason `Woordchips` exists, carried over). What was typed stays in the field
 * until the server took it, so a failed save loses nothing.
 */
function WoordInvoer({
  leeg,
  onVoegToe,
}: {
  leeg: boolean;
  onVoegToe: (woorden: string[], gelukt: () => void) => void;
}) {
  const [tekst, setTekst] = useState("");

  function verstuur(ruw: string) {
    const woorden = ruw
      .split(/[,;\n\r\t]+/)
      .map((woord) => woord.trim())
      .filter((woord) => woord.length > 0);
    if (woorden.length === 0) return;
    onVoegToe(woorden, () => setTekst((huidig) => (huidig === ruw ? "" : huidig)));
  }

  function opToets(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      verstuur(tekst);
    }
  }

  function opPlakken(e: ClipboardEvent<HTMLInputElement>) {
    const geplakt = e.clipboardData.getData("text");
    if (!/[,;\n]/.test(geplakt)) return;
    e.preventDefault();
    setTekst(geplakt);
    verstuur(geplakt);
  }

  return (
    <input
      value={tekst}
      aria-label={t("woordweb.invoerLabel")}
      placeholder={leeg ? t("woordweb.invoerLeeg") : t("woordweb.invoerVolgend")}
      onChange={(e) => setTekst(e.target.value)}
      onKeyDown={opToets}
      onPaste={opPlakken}
      className="min-h-8 w-36 rounded-full border border-dashed border-lijn-veld bg-transparent px-3 text-meta text-inkt outline-none placeholder:text-inkt-zacht focus-visible:border-solid focus-visible:ring-2 focus-visible:ring-inkt/30"
    />
  );
}
