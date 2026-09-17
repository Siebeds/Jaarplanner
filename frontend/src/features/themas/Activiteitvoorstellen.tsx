import { useState, type FormEvent } from "react";
import { AiKnop, Knop } from "../../components/ui/Knop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Invoer, Keuze, Tekstvlak, Veld } from "../../components/ui/Veld";
import { t, telWoord } from "../../i18n";
import { ACTIVITEIT_TYPES } from "../../lib/types";
import type { ActiviteitType, ActiviteitvoorstelBeslissing, ActiviteitvoorstelWeergave } from "../../lib/types";
import { beslisFout, useBeslisActiviteitvoorstel, useStelActiviteitenVoor, vraagFout } from "./voorgesteldeActiviteiten";
import { Aimerk, Beslisknoppen, Voorsteldoel } from "./Subdoelplaatsing";

/**
 * The AI's activiteit proposals in a subthema chapter (FB-025, ADR-0056).
 *
 * **They sit under the activiteiten they would join**, in the faint ring of ADR-0051 with the wand, the status mark and
 * the quiet check, pencil and cross of the subdoelplaatsing, so a teacher meets one shape for "the AI proposes, you
 * decide". A proposal is its asker's, and directie's (A3): the server sends someone else's only to directie, which the
 * card then names.
 *
 * **Accepting makes her own activiteit.** The check takes the proposal as it is; the pencil opens its fields in place
 * first. Once decided, the card goes: an accepted one is now a row in the list above.
 */

type StelVoor = ReturnType<typeof useStelActiviteitenVoor>;

/** The AI button, beside "Activiteit toevoegen". */
export function ActiviteitvoorstelKnop({ stelVoor }: { stelVoor: StelVoor }) {
  return (
    <AiKnop
      className="h-9 min-h-9 px-2.5 text-meta"
      bezig={stelVoor.isPending}
      disabled={stelVoor.isPending}
      onClick={() => stelVoor.mutate()}
    >
      {stelVoor.isPending ? t("activiteitvoorstel.vraagBezig") : t("activiteitvoorstel.vraag")}
    </AiKnop>
  );
}

/** What the last request did, or why it failed. Polite, so a screen reader hears the result without losing its place. */
export function ActiviteitvoorstelMelding({ stelVoor }: { stelVoor: StelVoor }) {
  return (
    <div aria-live="polite">
      {stelVoor.isError ? (
        <p className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {vraagFout(stelVoor.error)}
        </p>
      ) : stelVoor.data ? (
        <p className="mt-2 text-meta text-inkt-zacht">
          {stelVoor.data.aantalVoorgesteld === 0
            ? t("activiteitvoorstel.geenVoorstellen")
            : telWoord(stelVoor.data.aantalVoorgesteld, "activiteitvoorstel.eenVoorstel", "activiteitvoorstel.voorstellen")}
        </p>
      ) : null}
    </div>
  );
}

/** The open proposals, each decided on its own. */
export function Activiteitvoorstellen({
  subthemaId,
  voorstellen,
  onToon,
}: {
  subthemaId: string;
  voorstellen: ActiviteitvoorstelWeergave[];
  onToon: (code: string, knop: HTMLElement) => void;
}) {
  if (voorstellen.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-2.5" aria-label={t("activiteitvoorstel.lijst")}>
      {voorstellen.map((voorstel) => (
        <li key={voorstel.id}>
          <Voorstelkaart subthemaId={subthemaId} voorstel={voorstel} onToon={onToon} />
        </li>
      ))}
    </ul>
  );
}

function lengteWoord(lesuren: number) {
  return telWoord(lesuren, "activiteit.eenLesuur", "activiteit.lesuren");
}

function Voorstelkaart({
  subthemaId,
  voorstel,
  onToon,
}: {
  subthemaId: string;
  voorstel: ActiviteitvoorstelWeergave;
  onToon: (code: string, knop: HTMLElement) => void;
}) {
  const beslis = useBeslisActiviteitvoorstel(subthemaId);
  const [aanpassen, setAanpassen] = useState(false);
  const verstuur = (beslissing: ActiviteitvoorstelBeslissing) => beslis.mutate({ voorstelId: voorstel.id, beslissing });

  return (
    <article className="voorstel-ai min-w-0 rounded-veld px-3 py-2.5" aria-label={voorstel.naam}>
      <div className="flex items-center gap-2">
        <Aimerk label={t("activiteitvoorstel.aiVoorstel")} />
        <Statusmerk status="Voorgesteld" className="ml-auto" />
        {aanpassen ? null : (
          <Beslisknoppen
            naam={voorstel.naam}
            bezig={beslis.isPending}
            aanvaardLabel={t("activiteitvoorstel.aanvaard")}
            onAanvaard={() => verstuur({ status: "Aanvaard" })}
            onPasAan={() => {
              beslis.reset();
              setAanpassen(true);
            }}
            onWeiger={() => verstuur({ status: "Geweigerd" })}
          />
        )}
      </div>

      {aanpassen ? (
        <Aanpasformulier
          voorstel={voorstel}
          bezig={beslis.isPending}
          onBewaar={verstuur}
          onAnnuleer={() => setAanpassen(false)}
        />
      ) : (
        <>
          <p className="mt-1.5 text-body font-medium text-inkt">{voorstel.naam}</p>
          {/* Only directie is sent someone else's proposal (ADR-0056 A3); an acceptance makes it the asker's own. */}
          {voorstel.isEigen ? null : (
            <p className="mt-0.5 text-meta text-inkt-zacht">
              {t("activiteitvoorstel.vanCollega", { naam: voorstel.aanvragerNaam })}
            </p>
          )}
          <p className="mt-0.5 text-meta text-inkt-zacht">
            {[
              voorstel.activiteitType ? t(`activiteitsoort.${voorstel.activiteitType}`) : null,
              lengteWoord(voorstel.lengteInLesuren),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-2 text-body text-inkt">{voorstel.verwachteUitkomsten}</p>
          {voorstel.onderzoeksvraag ? (
            <p className="mt-1 text-meta text-inkt-zacht">
              {t("activiteitvoorstel.bijVraag", { vraag: voorstel.onderzoeksvraag })}
            </p>
          ) : null}
          <p className="mt-3 text-micro font-medium text-inkt-zacht">{t("activiteitvoorstel.werktAan")}</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {voorstel.doelen.map((doel) => (
              <li key={doel.leerplandoelCode} className="flex">
                <Voorsteldoel doel={doel} onToon={onToon} />
              </li>
            ))}
          </ul>
          <p className="mt-3 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">{voorstel.aiMotivatie}</p>
        </>
      )}

      {beslis.isError ? (
        <p role="alert" className="mt-3 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {beslisFout(beslis.error)}
        </p>
      ) : null}
    </article>
  );
}

function Aanpasformulier({
  voorstel,
  bezig,
  onBewaar,
  onAnnuleer,
}: {
  voorstel: ActiviteitvoorstelWeergave;
  bezig: boolean;
  onBewaar: (beslissing: ActiviteitvoorstelBeslissing) => void;
  onAnnuleer: () => void;
}) {
  const [naam, setNaam] = useState(voorstel.naam);
  const [soort, setSoort] = useState<ActiviteitType | "">(voorstel.activiteitType ?? "");
  const [beschrijving, setBeschrijving] = useState(voorstel.verwachteUitkomsten);
  const [lengte, setLengte] = useState(String(voorstel.lengteInLesuren));
  const [gekozen, setGekozen] = useState<string[]>(voorstel.doelen.map((d) => d.leerplandoelCode));
  const [fout, setFout] = useState<string | null>(null);

  const bewaar = (event: FormEvent) => {
    event.preventDefault();
    const lesuren = Number(lengte);
    if (naam.trim() === "") return setFout(t("activiteitvoorstel.naamVerplicht"));
    if (beschrijving.trim() === "") return setFout(t("activiteitvoorstel.beschrijvingVerplicht"));
    if (!Number.isInteger(lesuren) || lesuren < 1 || lesuren > 4) return setFout(t("activiteitvoorstel.lengteOngeldig"));
    setFout(null);
    onBewaar({
      status: "Aanvaard",
      naam: naam.trim(),
      activiteitType: soort === "" ? null : soort,
      verwachteUitkomsten: beschrijving.trim(),
      lengteInLesuren: lesuren,
      leerplandoelCodes: gekozen,
    });
  };

  return (
    <form onSubmit={bewaar} noValidate className="mt-3 flex flex-col gap-3">
      <Veld label={t("activiteitvoorstel.naam")}>
        {(id) => <Invoer id={id} value={naam} maxLength={200} onChange={(e) => setNaam(e.target.value)} />}
      </Veld>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-44 flex-1">
          <Veld label={t("activiteit.soort")}>
            {(id) => (
              <Keuze id={id} value={soort} onChange={(e) => setSoort(e.target.value as ActiviteitType | "")}>
                <option value="">{t("activiteit.geenSoort")}</option>
                {ACTIVITEIT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`activiteitsoort.${type}`)}
                  </option>
                ))}
              </Keuze>
            )}
          </Veld>
        </div>
        <Veld label={t("activiteitvoorstel.lengte")}>
          {(id) => (
            <Invoer id={id} type="number" min={1} max={4} className="w-24" value={lengte} onChange={(e) => setLengte(e.target.value)} />
          )}
        </Veld>
      </div>
      <Veld label={t("activiteitvoorstel.beschrijving")}>
        {(id) => (
          <Tekstvlak id={id} rows={3} maxLength={1000} value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} />
        )}
      </Veld>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-meta font-medium text-inkt-zacht">{t("activiteitvoorstel.doelenMee")}</legend>
        {voorstel.doelen.map((doel) => (
          <label key={doel.leerplandoelCode} className="flex items-start gap-2.5 rounded-veld px-1 py-1 text-body text-inkt">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-inkt"
              checked={gekozen.includes(doel.leerplandoelCode)}
              onChange={(e) =>
                setGekozen((huidig) =>
                  e.target.checked
                    ? [...huidig, doel.leerplandoelCode]
                    : huidig.filter((code) => code !== doel.leerplandoelCode),
                )
              }
            />
            <span className="min-w-0">
              <span className="mono block text-micro font-medium text-inkt-zacht">{doel.leerplandoelCode}</span>
              {doel.tekst ? <span className="line-clamp-2">{doel.tekst}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
      {fout ? (
        <p role="alert" className="text-meta font-medium text-attentie-inkt">
          {fout}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Knop rang="hoofd" type="submit" disabled={bezig}>
          {t("activiteitvoorstel.aanvaard")}
        </Knop>
        <Knop rang="rustig" type="button" onClick={onAnnuleer} disabled={bezig}>
          {t("activiteitvoorstel.annuleer")}
        </Knop>
      </div>
    </form>
  );
}
