import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AiKnop, Knop } from "../../components/ui/Knop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Invoer } from "../../components/ui/Veld";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { useSelectie } from "../../state/selectie";
import { Ballon } from "./Ballon";
import { Kopje } from "./Tekening";
import { MAX_VRAAG, type Katantwoord, type Katantwoordsoort, type Katopzoeking, type Katplek } from "./chat";
import type { Katchat } from "./useKatchat";
import { agendazin, antwoordzin, doelplekzin, perKlas, plekzin, uitlegblokken } from "./chatzinnen";

/**
 * The chat in Chuck's window (FB-031, ADR-0066). What she asks stands in a plain box on the right; what he says in his
 * comic balloon on the left, its tail pointing at his head beside it (FB-071). The conversation lives only while the
 * window is open: closing it unmounts this state, and nothing is sent anywhere to be kept (ADR-0059 D6).
 */

/** A link in an answer: ink, underlined, so it reads as a link without the accent colour. */
const LINK = "inline-flex min-h-6 items-center text-inkt underline decoration-inkt-zwak underline-offset-4 transition-colors duration-150 hover:decoration-inkt";

/** The answers that are a list of goals, each under its code and text. */
const DOELLIJST = new Set<Katantwoordsoort>(["DoelenVanThema", "DoelenVanSubthema"]);

const TERM: Record<string, keyof Katopzoeking> = { Doel: "doel", Thema: "thema", Subthema: "subthema", Activiteit: "activiteit" };

/** The conversation, oldest first. The newest answer scrolls into view and is read out (`role="log"`). */
export function Gesprek({ chat, onSluit }: { chat: Katchat; onSluit: () => void }) {
  const laatste = useRef<HTMLLIElement>(null);
  const aantal = chat.beurten.length;
  const beantwoord = chat.beurten.filter((b) => b.antwoord || b.fout).length;
  useEffect(() => {
    if (aantal > 0) laatste.current?.scrollIntoView?.({ block: "nearest" });
  }, [aantal, beantwoord]);

  if (aantal === 0) return null;

  return (
    <ol role="log" aria-label={t("kat.chat.gesprek")} className="flex flex-col gap-3 px-4 py-4">
      {chat.beurten.map((beurt, i) => (
        <li key={beurt.id} ref={i === aantal - 1 ? laatste : undefined} className="flex flex-col gap-2">
          <p className="ml-8 self-end rounded-veld border border-lijn bg-vlak px-3 py-1.5 text-meta text-inkt">
            <span className="sr-only">{t("kat.chat.jij")}: </span>
            {beurt.vraag}
          </p>
          <div className="mr-2 flex items-end gap-3.5">
            <Kopje className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              {beurt.fout ? (
                <Ballon staart="links" className="text-inkt">
                  <span className="sr-only">{t("kat.chat.chuck")}: </span>
                  {beurt.fout}
                </Ballon>
              ) : beurt.antwoord ? (
                <Antwoord antwoord={beurt.antwoord} chat={chat} onSluit={onSluit} />
              ) : (
                <Ballon staart="links" className="text-inkt-zacht">
                  {t("kat.chat.bezig")}
                  <span aria-hidden="true" className="ai-puntjes ml-1">
                    <i />
                    <i />
                    <i />
                  </span>
                </Ballon>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Antwoord({ antwoord, chat, onSluit }: { antwoord: Katantwoord; chat: Katchat; onSluit: () => void }) {
  const kiesKlas = useSelectie((s) => s.kiesKlas);
  const volg = (klasId?: string) => {
    if (klasId) kiesKlas(klasId);
    onSluit();
  };

  return (
    <Ballon staart="links" als="div" pop className="flex flex-col gap-2 py-2">
      <span className="sr-only">{t("kat.chat.chuck")}: </span>
      {antwoord.soort === "Uitleg" ? (
        <Uitleg antwoord={antwoord} />
      ) : (
        <p className="text-body text-inkt">{antwoordzin(antwoord)}</p>
      )}

      {antwoord.doel && !DOELLIJST.has(antwoord.soort) ? (
        <p className="line-clamp-3 text-meta text-inkt-zacht">{antwoord.doel.tekst}</p>
      ) : null}

      {antwoord.soort === "Kies" && antwoord.keuze && antwoord.opzoeking ? (
        <ul className="flex flex-col gap-1.5">
          {antwoord.keuze.kandidaten.map((kandidaat) => (
            <li key={kandidaat.id}>
              <Knop
                rang="rustig"
                disabled={chat.bezig}
                aria-label={t("kat.chat.kiesAria", { wat: kandidaat.detail ? `${kandidaat.label}: ${kandidaat.detail}` : kandidaat.label })}
                onClick={() => chat.kies(antwoord.opzoeking!, kandidaat, TERM[antwoord.keuze!.wat])}
                className="h-auto w-full flex-col items-start gap-0.5 py-2 text-left"
              >
                <span className="font-medium text-inkt">{kandidaat.label}</span>
                {kandidaat.detail ? <span className="line-clamp-2 font-normal text-meta text-inkt-zacht">{kandidaat.detail}</span> : null}
              </Knop>
            </li>
          ))}
        </ul>
      ) : null}

      {DOELLIJST.has(antwoord.soort) ? (
        <Doellijst plekken={antwoord.plekken} volg={volg} />
      ) : (
        <Pleklijst plekken={antwoord.plekken} volg={volg} />
      )}

      {antwoord.voorstellen.length > 0 ? (
        <Deel kop={t("kat.chat.voorstellen")} merk>
          {DOELLIJST.has(antwoord.soort) ? (
            <Doellijst plekken={antwoord.voorstellen} volg={volg} />
          ) : (
            <Pleklijst plekken={antwoord.voorstellen} volg={volg} />
          )}
        </Deel>
      ) : null}

      {antwoord.agenda.length > 0 ? (
        <Deel kop={t("kat.chat.inDeAgenda")}>
          {perKlas(antwoord.agenda).map((groep) => (
            <div key={groep.klasId} className="flex flex-col gap-1">
              <p className="text-micro font-medium text-inkt-zacht">{groep.klas}</p>
              <ul className="flex flex-col gap-1">
                {groep.plekken.map((plek, i) => {
                  const { wat, wanneer } = agendazin(plek);
                  return (
                    <li key={`${plek.verwijzing}-${plek.soort}-${plek.naam}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                      <Link to={plek.verwijzing} onClick={() => volg(plek.klasId)} className={LINK}>
                        {wat}
                      </Link>
                      <span className="text-micro text-inkt-zacht">{wanneer}</span>
                      {plek.voorstel ? <Statusmerk status="Voorgesteld" /> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {antwoord.agendaTotaal > antwoord.agenda.length ? (
            <p className="text-micro text-inkt-zacht">
              {telWoord(antwoord.agendaTotaal - antwoord.agenda.length, "kat.chat.nogMeerEen", "kat.chat.nogMeer")}
            </p>
          ) : null}
        </Deel>
      ) : null}
    </Ballon>
  );
}

function Uitleg({ antwoord }: { antwoord: Katantwoord }) {
  return (
    <>
      {uitlegblokken(antwoord.uitleg ?? "").map((blok, i) =>
        blok.soort === "stappen" ? (
          <ol key={i} className="flex list-decimal flex-col gap-1 pl-5 text-body text-inkt marker:text-inkt-zacht">
            {blok.stappen.map((stap, j) => (
              <li key={j}>{stap}</li>
            ))}
          </ol>
        ) : (
          <p key={i} className="text-body text-inkt">
            {blok.tekst}
          </p>
        ),
      )}
      {antwoord.hoofdstukken.length > 0 ? (
        <p className="text-micro text-inkt-zacht">
          {t("kat.chat.uitDeHandleiding", { hoofdstukken: antwoord.hoofdstukken.join(", ") })}
        </p>
      ) : null}
    </>
  );
}

/** A part of an answer under a small heading; proposals wear the status mark, never colour alone. */
function Deel({ kop, merk, children }: { kop: string; merk?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-lijn pt-2">
      <p className="flex items-center gap-2 text-micro font-medium text-inkt-zacht">
        {merk ? <Statusmerk status="Voorgesteld" /> : null}
        {kop}
      </p>
      {children}
    </div>
  );
}

function Pleklijst({ plekken, volg }: { plekken: Katplek[]; volg: () => void }) {
  if (plekken.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {plekken.map((plek, i) => (
        <li key={`${plek.soort}-${plek.verwijzing}-${plek.activiteit}-${plek.fiche}-${i}`}>
          <Plaats plek={plek} tekst={plekzin(plek)} volg={volg} />
        </li>
      ))}
    </ul>
  );
}

function Doellijst({ plekken, volg }: { plekken: Katplek[]; volg: () => void }) {
  if (plekken.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {plekken.map((plek, i) => (
        <li key={`${plek.doel?.code}-${plek.subthemaId}-${i}`} className="flex flex-col">
          <span className="text-meta">
            <span className="font-medium text-inkt">{plek.doel?.code}</span>
            {plek.doel?.tekst ? <span className="text-inkt-zacht">: {plek.doel.tekst}</span> : null}
          </span>
          <Plaats plek={plek} tekst={doelplekzin(plek)} volg={volg} klein />
        </li>
      ))}
    </ul>
  );
}

function Plaats({ plek, tekst, volg, klein }: { plek: Katplek; tekst: string; volg: () => void; klein?: boolean }) {
  const klasse = cn(klein ? "text-micro" : "text-meta");
  return plek.verwijzing ? (
    <Link to={plek.verwijzing} onClick={() => volg()} className={cn(LINK, klasse)}>
      {tekst}
    </Link>
  ) : (
    <span className={cn("text-inkt", klasse)}>{tekst}</span>
  );
}

/** The question field under the conversation. Asking calls the model, so the button is an AI button (ADR-0039). */
export function Vraagveld({ chat }: { chat: Katchat }) {
  const id = useId();
  const uitlegId = `${id}-uitleg`;
  const [tekst, setTekst] = useState("");
  const leeg = tekst.trim().length === 0;

  const verstuur = (e: FormEvent) => {
    e.preventDefault();
    if (leeg || chat.bezig) return;
    chat.vraag(tekst.trim());
    setTekst("");
  };

  return (
    <form onSubmit={verstuur} className="flex shrink-0 flex-col gap-1.5 border-t border-lijn bg-kaart px-4 py-3">
      <label htmlFor={id} className="text-meta font-medium text-inkt">
        {t("kat.chat.label")}
      </label>
      <p id={uitlegId} className="-mt-1 text-micro text-inkt-zacht">
        {t("kat.chat.uitleg")}
      </p>
      <div className="flex gap-2">
        <Invoer
          id={id}
          value={tekst}
          maxLength={MAX_VRAAG}
          autoComplete="off"
          aria-describedby={uitlegId}
          onChange={(e) => setTekst(e.target.value)}
          className="min-w-0 flex-1"
        />
        <AiKnop type="submit" bezig={chat.bezig} disabled={leeg || chat.bezig} className="shrink-0">
          {t("kat.chat.vraag")}
        </AiKnop>
      </div>
    </form>
  );
}
