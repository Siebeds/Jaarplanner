import { useState, type FormEvent } from "react";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { AiKnop, Knop } from "../../components/ui/Knop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Invoer, Tekstvlak, Veld } from "../../components/ui/Veld";
import { IcoonKruis, IcoonPotlood, IcoonToverstok, IcoonVink } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import type { SubdoelvoorstelWeergave, SubthemavoorstelBeslissing, SubthemavoorstelWeergave } from "../../lib/types";
import { aiFout, beslisFout, useBeslisSubthemavoorstel, useStelPlaatsingenVoor } from "./plaatsingen";

/**
 * The subdoelplaatsing on the thema page (FB-057, ADR-0050, ADR-0051).
 *
 * **Where the proposals land is where they are shown** (P3): a doel proposed for an existing subthema sits inside that
 * chapter (`Subdoelvoorstellen`), a proposed new subthema is a chapter-like card of its own after that leeftijd's
 * chapters (`Subthemavoorstelkaart`). What asks, and the count it answers, sit once above the leeftijd's chapters
 * (`Plaatsingsbalk`).
 *
 * **An undecided proposal wears the faint ring** (`voorstel-ai`), never alone: the wand with a word and the status mark
 * with its word say the same. A decided one is not drawn here any more; it is an ordinary subdoel or chapter, or gone.
 */

/**
 * Above a leeftijd's chapters: how many doelen of the themadoelen are still open there, and, for whoever may ask, the AI
 * button. Nothing at all while none is open: "all placed" would also be said of a thema without themadoelen.
 */
export function Plaatsingsbalk({
  themaId,
  leeftijd,
  aantalOpen,
  magVragen,
}: {
  themaId: string;
  leeftijd: string;
  aantalOpen: number;
  magVragen: boolean;
}) {
  const stelVoor = useStelPlaatsingenVoor(themaId);
  if (aantalOpen === 0 && !stelVoor.data && !stelVoor.isError) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {aantalOpen > 0 ? (
          <p className="text-meta font-medium text-attentie-inkt">
            {telWoord(aantalOpen, "plaatsing.eenOpen", "plaatsing.open")}
          </p>
        ) : null}
        {magVragen && aantalOpen > 0 ? (
          <AiKnop
            className="h-9 min-h-9 px-2.5 text-meta"
            bezig={stelVoor.isPending}
            disabled={stelVoor.isPending}
            onClick={() => stelVoor.mutate(leeftijd)}
          >
            {stelVoor.isPending ? t("plaatsing.vraagBezig") : t("plaatsing.vraag")}
          </AiKnop>
        ) : null}
      </div>
      <div aria-live="polite">
        {stelVoor.isError ? (
          <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
            {aiFout(stelVoor.error)}
          </p>
        ) : stelVoor.data ? (
          <p className="text-meta text-inkt-zacht">{resultaatZin(stelVoor.data.aantalVoorgesteld, stelVoor.data.aantalNieuweSubthemas)}</p>
        ) : null}
      </div>
    </div>
  );
}

function resultaatZin(voorgesteld: number, nieuw: number): string {
  if (voorgesteld === 0) return t("plaatsing.geenVoorstellen");
  const doelen = telWoord(voorgesteld, "plaatsing.eenVoorstel", "plaatsing.voorstellen");
  return nieuw === 0 ? doelen : t("plaatsing.voorstellenMetNieuw", { doelen, nieuw: telWoord(nieuw, "plaatsing.eenNieuw", "plaatsing.nieuw") });
}


/**
 * The quiet decision controls (ADR-0051 D4): a check and a cross, and for a new subthema a pencil. Borderless and ink at
 * rest, taking the aanvaard or geweigerd hue only under the pointer or focus, so a list of proposals stays calm. 28
 * pixels clear WCAG 2.2's 24; the word is in the accessible name and the tooltip.
 */
export function Beslisknoppen({
  naam,
  bezig,
  onAanvaard,
  onWeiger,
  onPasAan,
  aanvaardLabel,
}: {
  /** What is decided, for the accessible names. */
  naam: string;
  bezig?: boolean;
  onAanvaard: () => void;
  onWeiger: () => void;
  onPasAan?: () => void;
  /** The accept verb when it is not "Aanvaard" (a new subthema is made). */
  aanvaardLabel?: string;
}) {
  const knop =
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-inkt-zwak transition-colors duration-150 disabled:opacity-45";
  const aanvaard = aanvaardLabel ?? t("plaatsing.aanvaard");
  return (
    <span className="relative z-10 inline-flex shrink-0 items-center">
      <button
        type="button"
        disabled={bezig}
        onClick={onAanvaard}
        aria-label={`${aanvaard}: ${naam}`}
        title={aanvaard}
        className={cn(knop, "hover:bg-suggestie-aanvaard/10 hover:text-suggestie-aanvaard focus-visible:text-suggestie-aanvaard")}
      >
        <IcoonVink aria-hidden="true" className="h-4 w-4" />
      </button>
      {onPasAan ? (
        <button
          type="button"
          disabled={bezig}
          onClick={onPasAan}
          aria-label={`${t("plaatsing.pasAan")}: ${naam}`}
          title={t("plaatsing.pasAan")}
          className={cn(knop, "hover:bg-vlak-diep hover:text-inkt")}
        >
          <IcoonPotlood aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        disabled={bezig}
        onClick={onWeiger}
        aria-label={`${t("plaatsing.weiger")}: ${naam}`}
        title={t("plaatsing.weiger")}
        className={cn(knop, "hover:bg-suggestie-geweigerd/10 hover:text-suggestie-geweigerd focus-visible:text-suggestie-geweigerd")}
      >
        <IcoonKruis aria-hidden="true" className="h-4 w-4" />
      </button>
    </span>
  );
}

/** The wand and a word: what the ring means, said without colour (ADR-0051 decision 2). */
export function Aimerk({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-micro font-medium text-inkt-zacht">
      <IcoonToverstok aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/** One proposed doel: its mark, code and text, which open its detail like any doel on this page (TB-016). */
function Voorsteldoel({
  doel,
  onToon,
}: {
  doel: SubdoelvoorstelWeergave;
  onToon: (code: string, knop: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => onToon(doel.leerplandoelCode, event.currentTarget)}
      className="min-w-0 flex-1 rounded-md text-left hover:bg-inkt/[0.035]"
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {doel.doelsoort ? <Doelsoortmerk soort={doel.doelsoort} /> : null}
        <span className="mono text-micro font-medium text-inkt-zacht">{doel.leerplandoelCode}</span>
      </span>
      {doel.tekst ? <span className="mt-1 line-clamp-2 block text-body text-inkt">{doel.tekst}</span> : null}
    </button>
  );
}

/**
 * The open proposals for one existing subthema, under its subdoelen. Each is decided on its own (P2); the chapter passes
 * `onBeslis` only to whoever may decide, and the server sends the proposals to no one else anyway (D6).
 */
export function Subdoelvoorstellen({
  voorstellen,
  bezig,
  onBeslis,
  onToon,
}: {
  voorstellen: SubdoelvoorstelWeergave[];
  bezig?: boolean;
  onBeslis?: (voorstelId: string, status: "Aanvaard" | "Geweigerd") => void;
  onToon: (code: string, knop: HTMLElement) => void;
}) {
  if (voorstellen.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-2" aria-label={t("plaatsing.voorgesteldeSubdoelen")}>
      {voorstellen.map((voorstel) => (
        <li key={voorstel.id} className="voorstel-ai rounded-veld px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Aimerk label={t("plaatsing.aiVoorstel")} />
            <Statusmerk status="Voorgesteld" className="ml-auto" />
            {onBeslis ? (
              <Beslisknoppen
                naam={voorstel.leerplandoelCode}
                bezig={bezig}
                onAanvaard={() => onBeslis(voorstel.id, "Aanvaard")}
                onWeiger={() => onBeslis(voorstel.id, "Geweigerd")}
              />
            ) : null}
          </div>
          <div className="mt-1.5 flex">
            <Voorsteldoel doel={voorstel} onToon={onToon} />
          </div>
          <p className="mt-2 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">{voorstel.aiMotivatie}</p>
          {voorstel.activiteitNaam ? (
            <p className="mt-1.5 text-micro text-inkt-zacht">{t("plaatsing.viaActiviteit", { naam: voorstel.activiteitNaam })}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * A proposed new subthema (P2, D4): decided as one. The pencil opens its fields in place, so the name, the question,
 * the length and which doelen come along can be changed before it is made; a doel left out is rejected with it.
 */
export function Subthemavoorstelkaart({
  themaId,
  voorstel,
  magBeslissen,
  onToon,
}: {
  themaId: string;
  voorstel: SubthemavoorstelWeergave;
  magBeslissen: boolean;
  onToon: (code: string, knop: HTMLElement) => void;
}) {
  const beslis = useBeslisSubthemavoorstel(themaId);
  const [aanpassen, setAanpassen] = useState(false);
  const verstuur = (beslissing: SubthemavoorstelBeslissing) => beslis.mutate({ voorstelId: voorstel.id, beslissing });

  return (
    <article className="voorstel-ai min-w-0 rounded-kaart p-4 sm:p-5" aria-label={t("plaatsing.nieuwSubthemaAria", { naam: voorstel.naam })}>
      <div className="flex items-center gap-2">
        <Aimerk label={t("plaatsing.nieuwSubthema")} />
        <Statusmerk status="Voorgesteld" className="ml-auto" />
        {magBeslissen && !aanpassen ? (
          <Beslisknoppen
            naam={voorstel.naam}
            bezig={beslis.isPending}
            aanvaardLabel={t("plaatsing.maakSubthema")}
            onAanvaard={() => verstuur({ status: "Aanvaard" })}
            onPasAan={() => {
              beslis.reset();
              setAanpassen(true);
            }}
            onWeiger={() => verstuur({ status: "Geweigerd" })}
          />
        ) : null}
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
          <h3 className="mt-2 font-display text-hoofdstuk text-inkt">{voorstel.naam}</h3>
          <p className="mt-1 text-meta text-inkt-zacht">{telWoord(voorstel.duurWeken, "thema.eenWeek", "thema.weken")}</p>
          <p className="mt-3 text-sectie text-inkt">{voorstel.onderzoeksvraag}</p>
          <ul className="mt-3 divide-y divide-lijn overflow-hidden rounded-veld border border-lijn">
            {voorstel.doelen.map((doel) => (
              <li key={doel.id} className="flex px-3 py-2.5">
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
  voorstel: SubthemavoorstelWeergave;
  bezig: boolean;
  onBewaar: (beslissing: SubthemavoorstelBeslissing) => void;
  onAnnuleer: () => void;
}) {
  const [naam, setNaam] = useState(voorstel.naam);
  const [vraag, setVraag] = useState(voorstel.onderzoeksvraag);
  const [duur, setDuur] = useState(String(voorstel.duurWeken));
  const [gekozen, setGekozen] = useState<string[]>(voorstel.doelen.map((d) => d.leerplandoelCode));
  const [fout, setFout] = useState<string | null>(null);

  const bewaar = (event: FormEvent) => {
    event.preventDefault();
    const weken = Number(duur);
    if (naam.trim() === "") return setFout(t("plaatsing.naamVerplicht"));
    if (vraag.trim() === "") return setFout(t("plaatsing.vraagVerplicht"));
    if (!Number.isInteger(weken) || weken < 1 || weken > 6) return setFout(t("plaatsing.duurOngeldig"));
    if (gekozen.length === 0) return setFout(t("plaatsing.minstensEenDoel"));
    setFout(null);
    onBewaar({
      status: "Aanvaard",
      naam: naam.trim(),
      onderzoeksvraag: vraag.trim(),
      duurWeken: weken,
      leerplandoelCodes: gekozen,
    });
  };

  return (
    <form onSubmit={bewaar} className="mt-3 flex flex-col gap-3">
      <Veld label={t("plaatsing.naam")}>
        {(id) => <Invoer id={id} value={naam} maxLength={200} onChange={(e) => setNaam(e.target.value)} />}
      </Veld>
      <Veld label={t("plaatsing.onderzoeksvraag")}>
        {(id) => <Tekstvlak id={id} rows={2} value={vraag} onChange={(e) => setVraag(e.target.value)} />}
      </Veld>
      <Veld label={t("plaatsing.duurWeken")}>
        {(id) => (
          <Invoer id={id} type="number" min={1} max={6} className="w-24" value={duur} onChange={(e) => setDuur(e.target.value)} />
        )}
      </Veld>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-meta font-medium text-inkt-zacht">{t("plaatsing.doelenMee")}</legend>
        {voorstel.doelen.map((doel) => (
          <label key={doel.id} className="flex items-start gap-2.5 rounded-veld px-1 py-1 text-body text-inkt">
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
          {t("plaatsing.maakSubthema")}
        </Knop>
        <Knop rang="rustig" type="button" onClick={onAnnuleer} disabled={bezig}>
          {t("plaatsing.annuleer")}
        </Knop>
      </div>
    </form>
  );
}
