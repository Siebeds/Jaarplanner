import { useEffect, useRef, useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { Toevoegknop } from "../../components/ui/Toevoegknop";
import { Invoer } from "../../components/ui/Veld";
import { IcoonChevron, IcoonPlus, IcoonZoek } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { useMinimumdoel, useMinimumdoelen, useMinimumdoelTeksten } from "../../lib/queries";
import type { GeconcordeerdLeerplandoel, ThemaMinimumdoelWeergave } from "../../lib/types";
import { MIJLPAAL } from "../doelen/mijlpaal";
import { Doellijst, Ontkoppel } from "./Fiche";
import { Inklaplijst } from "./Inklaplijst";
import { opMinimumdoelRef } from "./opCode";

/**
 * The themadoelen of a thema, which are minimumdoelen (FB-043).
 *
 * **Four levels, each shut until asked for**: the list itself (TB-051), then the three below. The owner, 2026-09-16:
 * first which minimumdoelen the thema aims at, then, per minimumdoel, the leerplandoelen that lead there. A thema runs
 * across several leeftijden and a leerplandoel belongs to one, so between the two sits one row per leeftijd with its
 * count ("K2 · 3 leerplandoelen"). Opened, a leeftijd lists its leerplandoelen and nothing else: the minimumdoel they
 * lead to is the row above.
 *
 * **The leerplandoelen are read, never chosen.** They are the minimumdoel's concordance, from its own detail
 * (`GET /api/minimumdoelen/{ref}`, TB-010), and a leeftijd without any is left out. Unlinking the minimumdoel takes them
 * along, since nothing but the link holds them here.
 *
 * **Never dekking.** These rows say what the thema aims at; whether a klas covers it is the plan's (Art. V.1).
 */
export function Themaminimumdoelen({
  koppelingen,
  ontkoppelBezig,
  onOntkoppel,
  onToonDoel,
}: {
  koppelingen: ThemaMinimumdoelWeergave[];
  ontkoppelBezig?: boolean;
  /** Absent without the right to unlink (R4): the rows then only open. */
  onOntkoppel?: (koppelingId: string) => void;
  onToonDoel: (code: string, knop: HTMLElement) => void;
}) {
  // The list is shut and paged (TB-051), kleuter first, then by leerjaar and ref. The search matches the ref and the
  // decreed text, which is fetched for every row only once the search opens.
  const [zoekOpen, setZoekOpen] = useState(false);
  const gesorteerd = [...koppelingen].sort((a, b) => opMinimumdoelRef(a.minimumdoelRef, b.minimumdoelRef));
  const { teksten, laadt } = useMinimumdoelTeksten(
    gesorteerd.map((k) => k.minimumdoelRef),
    zoekOpen,
  );

  return (
    <Inklaplijst
      items={gesorteerd}
      sleutel={(koppeling) => koppeling.id}
      aantalTekst={telWoord(gesorteerd.length, "thema.eenMinimumdoel", "thema.minimumdoelen")}
      lijstnaam={t("thema.lijstMinimumdoelen")}
      zoekPlaatshouder={t("thema.zoekMinimumdoel")}
      zoektekst={(koppeling) => `${koppeling.minimumdoelRef} ${teksten.get(koppeling.minimumdoelRef) ?? ""}`}
      zoekLaadt={laadt}
      onZoekOpen={setZoekOpen}
      render={(koppeling) => (
        <Minimumdoelrij
          minimumdoelRef={koppeling.minimumdoelRef}
          ontkoppelBezig={ontkoppelBezig}
          onOntkoppel={onOntkoppel ? () => onOntkoppel(koppeling.id) : undefined}
          onToonDoel={onToonDoel}
        />
      )}
    />
  );
}

function Minimumdoelrij({
  minimumdoelRef,
  ontkoppelBezig,
  onOntkoppel,
  onToonDoel,
}: {
  minimumdoelRef: string;
  ontkoppelBezig?: boolean;
  onOntkoppel?: () => void;
  onToonDoel: (code: string, knop: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data, isPending, isError } = useMinimumdoel(minimumdoelRef);
  // Every jaar/fase comes back, most of them empty; only those with a leerplandoel are a leeftijd of this minimumdoel.
  const leeftijden = (data?.jaarFasen ?? []).filter((fase) => fase.leerplandoelen.length > 0);

  return (
    <li>
      <div className="flex items-start gap-2 px-3 py-2.5 transition-colors duration-150 hover:bg-inkt/[0.035]">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <IcoonChevron
            aria-hidden="true"
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0 text-inkt-zwak transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* The ref in the minimumdoel hue, as in the doelen per leeftijd: it IS the MD doelsoort (Art. XII). */}
              <span className="mono inline-block rounded bg-doelsoort-md px-1.5 py-0.5 text-[0.6875rem] font-medium text-doelsoort-md-op">
                {minimumdoelRef}
              </span>
              {data ? (
                <span className="text-meta text-inkt-zacht">
                  {MIJLPAAL[data.leeftijd] ? t(MIJLPAAL[data.leeftijd]) : data.leeftijd}
                </span>
              ) : null}
              {data?.nietMeerInOpstap ? (
                <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
                  {t("doel.vervallen")}
                </span>
              ) : null}
            </span>
            {data ? (
              <span className="mt-1 line-clamp-2 whitespace-pre-line text-body text-inkt">{data.omschrijving}</span>
            ) : isPending ? (
              <span aria-hidden="true" className="mt-1.5 block h-4 w-3/4 animate-pulse rounded-veld bg-vlak-diep" />
            ) : null}
          </span>
        </button>

        {onOntkoppel ? (
          <span className="-my-1.5 flex">
            <Ontkoppel
              label={t("thema.minimumdoelOntkoppel", { ref: minimumdoelRef })}
              bezig={ontkoppelBezig}
              onClick={onOntkoppel}
            />
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="px-3 pb-3 pl-10">
          {isError ? (
            <p className="text-meta text-inkt-zacht">{t("thema.minimumdoelNietGeladen")}</p>
          ) : !data ? (
            <span aria-hidden="true" className="block h-4 w-1/2 animate-pulse rounded-veld bg-vlak-diep" />
          ) : leeftijden.length === 0 ? (
            <p className="text-meta text-inkt-zacht">{t("thema.minimumdoelZonderLeerplandoel")}</p>
          ) : (
            <Doellijst>
              {leeftijden.map((fase) => (
                <Leeftijdrij
                  key={fase.jaarFase}
                  leeftijd={fase.jaarFase}
                  leerplandoelen={fase.leerplandoelen}
                  onToonDoel={onToonDoel}
                />
              ))}
            </Doellijst>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** One leeftijd under a minimumdoel: its count on the fold button, its leerplandoelen once opened. */
function Leeftijdrij({
  leeftijd,
  leerplandoelen,
  onToonDoel,
}: {
  leeftijd: string;
  leerplandoelen: GeconcordeerdLeerplandoel[];
  onToonDoel: (code: string, knop: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
      >
        <span className="w-9 shrink-0 font-display text-sectie text-inkt">{leeftijd}</span>
        <span className="min-w-0 flex-1 text-meta text-inkt-zacht">
          {telWoord(leerplandoelen.length, "thema.overzichtEenLeerplandoel", "thema.overzichtLeerplandoelen")}
        </span>
        <IcoonChevron
          aria-hidden="true"
          className={cn(
            "h-5 w-5 shrink-0 text-inkt-zwak transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ul className="divide-y divide-lijn border-t border-lijn">
          {leerplandoelen.map((doel) => (
            <li key={doel.code}>
              <button
                type="button"
                onClick={(event) => onToonDoel(doel.code, event.currentTarget)}
                className="block w-full px-3 py-2.5 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="mono text-micro font-medium text-inkt-zacht">{doel.code}</span>
                  {doel.nietMeerInOpstap ? (
                    <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
                      {t("doel.vervallen")}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 line-clamp-2 text-body text-inkt">{doel.tekst}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Finding a minimumdoel and handing back its ref: closed until asked for, like the leerplandoel `Doelkoppelaar`, and
 * closed again after a pick, since the picked minimumdoel then shows up in the list above.
 *
 * **Search, not a tree**, on the ref and on the decreed text, as the register's own search does. Every mijlpaal is
 * offered: a thema is school-wide, so no klas narrows it.
 */
export function Minimumdoelkoppelaar({
  onKies,
  bezig,
  alGekozen,
}: {
  onKies: (minimumdoelRef: string) => void;
  bezig?: boolean;
  /** Refs already linked, so the list does not offer the same minimumdoel twice. */
  alGekozen: string[];
}) {
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState("");
  // Closing unmounts the field that had focus; the add button it came from takes it back, so a keyboard user is not
  // dropped at the top of the page.
  const focusTerug = useRef(false);
  const knopHouder = useRef<HTMLSpanElement>(null);
  const term = zoek.trim();
  const { data, isPending } = useMinimumdoelen({ zoek: term, aantal: 8 }, { enabled: open && term.length >= 2 });
  const gevonden = (data?.regels ?? []).filter((regel) => !alGekozen.includes(regel.ref));

  useEffect(() => {
    if (open || !focusTerug.current) return;
    focusTerug.current = false;
    knopHouder.current?.querySelector("button")?.focus();
  }, [open]);

  if (!open) {
    return (
      <span ref={knopHouder} className="contents">
        <Toevoegknop label={t("thema.minimumdoelKoppelen")} disabled={bezig} onClick={() => setOpen(true)} />
      </span>
    );
  }

  const sluit = () => {
    setZoek("");
    setOpen(false);
    focusTerug.current = true;
  };

  return (
    <div className="w-full rounded-veld border border-lijn bg-vlak-diep/40 p-2">
      <div className="relative">
        <IcoonZoek
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-inkt-zwak"
        />
        <Invoer
          value={zoek}
          disabled={bezig}
          autoFocus
          aria-label={t("thema.minimumdoelZoek")}
          onChange={(e) => setZoek(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") sluit();
          }}
          placeholder={t("thema.minimumdoelZoek")}
          className="pl-10"
        />
      </div>

      {term.length < 2 ? null : isPending ? (
        <p className="mt-2 text-meta text-inkt-zwak">{t("doelkiezer.zoeken")}</p>
      ) : gevonden.length === 0 ? (
        <p className="mt-2 text-meta text-inkt-zwak">{t("thema.minimumdoelNiets")}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {gevonden.map((regel) => (
            <li key={regel.ref}>
              <button
                type="button"
                disabled={bezig}
                onClick={() => {
                  onKies(regel.ref);
                  sluit();
                }}
                className="flex w-full items-start gap-2 rounded-veld border border-lijn bg-kaart px-3 py-2 text-left transition-colors duration-150 hover:border-accent"
              >
                <IcoonPlus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-inkt-zwak" />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="mono inline-block rounded bg-doelsoort-md px-1.5 py-0.5 text-[0.6875rem] font-medium text-doelsoort-md-op">
                      {regel.ref}
                    </span>
                    <span className="text-micro text-inkt-zwak">
                      {MIJLPAAL[regel.leeftijd] ? t(MIJLPAAL[regel.leeftijd]) : regel.leeftijd}
                    </span>
                  </span>
                  <span className="mt-1 block line-clamp-2 whitespace-pre-line text-meta text-inkt-zacht">
                    {regel.omschrijving}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2">
        <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={sluit}>
          {t("themabeheer.annuleer")}
        </Knop>
      </div>
    </div>
  );
}
