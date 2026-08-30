import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Keuze } from "../../components/ui/Veld";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { IcoonKruis } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { ACTIVITEIT_TYPES } from "../../lib/types";
import type { ActiviteitWeergave, ActiviteitType, OnderzoeksvraagWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { ACTIVITEITKLEUREN, KLEURSTAAL, kleurSleutel, type Activiteitkleur } from "./kleuren";
import { MAX_LENGTE } from "./lesuren";
import { Doelkoppelaar } from "./Doelkoppelaar";

/**
 * `ActiviteitWeergave` plus the colour the API now returns.
 *
 * Declared here rather than in `lib/types.ts` because that file is held by another session while it
 * reworks the agenda. Fold it in there when the claim is released; nothing else has to change, since
 * the field name and the shape already match what the server sends.
 */
export type ActiviteitMetKleur = ActiviteitWeergave & {
  kleur: Activiteitkleur | null;
  lengteInLesuren?: number;
};

export interface ActiviteitInvoer {
  naam: string;
  activiteitType: ActiviteitType;
  hoek: string | null;
  verwachteUitkomsten: string | null;
  onderzoeksvraagId: string | null;
  kleur: Activiteitkleur | null;
  lengteInLesuren: number;
  /**
   * Goals to link in the same request, and ONLY sent while creating.
   *
   * A link needs an activiteit id, and while creating there is none, so the per-link endpoints cannot
   * be reached yet: the create payload carries the codes instead and the server links them inside the
   * same save. Absent while editing, where the picker writes through those endpoints on the spot.
   */
  leerplandoelCodes?: string[];
}

/**
 * Making or changing one activiteit, from wherever a teacher is standing.
 *
 * **One component for the thema page and for the agenda.** An activiteit is the same thing in both
 * places, and a second form would be a second set of rules about when hoek is allowed. It lives in
 * its own feature folder for that reason: neither of the two screens owns it.
 *
 * **Hoek only exists when the soort is Hoek.** Not disabled, not greyed: absent. A field that is
 * visible but refuses input is a field a teacher tries anyway, and the value would be discarded
 * server-side without a word. When the soort changes away from Hoek the value is cleared, because a
 * hoek belonging to a soort that is no longer a hoek is a hoek nobody can see.
 *
 * **`extra` is for what belongs to the CALLER's screen rather than to the activiteit.** The agenda
 * hangs the day it is planned on there, which is a property of the plaatsing and not of the
 * activiteit: it must not ride along on Bewaren, and it must not exist at all on the thema page.
 *
 * **Goal links are edited here and applied immediately, unlike everything else on this form.** They
 * are their own endpoints (`POST`/`DELETE .../doelkoppelingen`) rather than fields on the activiteit,
 * so the caller commits them as they are chosen and this form is honest about that: the list under
 * "Doelen" changes the moment you touch it, and the Bewaren button says nothing about it. That is why
 * linking is offered only on an activiteit that already exists.
 */
export function Activiteitformulier({
  open,
  activiteit,
  onderzoeksvragen,
  onBewaar,
  onSluit,
  bezig,
  fout,
  onKoppel,
  onOntkoppel,
  koppelenBezig,
  extra,
}: {
  open: boolean;
  /** The activiteit being changed, or undefined when making a new one. */
  activiteit?: ActiviteitMetKleur;
  /** The questions of the owning subthema. An activiteit may point at one of these, or at none. */
  onderzoeksvragen: OnderzoeksvraagWeergave[];
  onBewaar: (invoer: ActiviteitInvoer) => void;
  onSluit: () => void;
  bezig: boolean;
  fout?: unknown;
  /** Omitted while creating: there is nothing to link a goal to yet. */
  onKoppel?: (leerplandoelCode: string) => void;
  onOntkoppel?: (koppelingId: string) => void;
  koppelenBezig?: boolean;
  /** A section of the caller's own, rendered below the fields and above the goal links. */
  extra?: ReactNode;
}) {
  const id = useId();
  const [naam, setNaam] = useState(activiteit?.naam ?? "");
  const [soort, setSoort] = useState<ActiviteitType>(activiteit?.activiteitType ?? "Experiment");
  const [hoek, setHoek] = useState(activiteit?.hoek ?? "");
  const [uitkomsten, setUitkomsten] = useState(activiteit?.verwachteUitkomsten ?? "");
  const [vraagId, setVraagId] = useState(activiteit?.onderzoeksvraagId ?? "");
  const [kleur, setKleur] = useState<Activiteitkleur | null>(activiteit?.kleur ?? null);
  const [lengte, setLengte] = useState(activiteit?.lengteInLesuren ?? 1);
  const [naamFout, setNaamFout] = useState(false);

  // Only used while creating. Held here rather than written through, because there is nothing to write
  // to yet: they travel with the create request. See `ActiviteitInvoer.leerplandoelCodes`.
  const [nieuweCodes, setNieuweCodes] = useState<string[]>([]);

  const isHoek = soort === "Hoek";

  function verstuur(event: FormEvent) {
    event.preventDefault();
    if (naam.trim().length === 0) {
      setNaamFout(true);
      return;
    }
    onBewaar({
      naam: naam.trim(),
      activiteitType: soort,
      // Never sent for a soort that is not Hoek: the server would drop it, and a value that is stored
      // nowhere but still in the form is a value a teacher believes they saved.
      hoek: isHoek && hoek.trim() !== "" ? hoek.trim() : null,
      verwachteUitkomsten: uitkomsten.trim() === "" ? null : uitkomsten.trim(),
      onderzoeksvraagId: vraagId === "" ? null : vraagId,
      kleur,
      lengteInLesuren: lengte,
      // Left off entirely while editing rather than sent empty: the update endpoint has no such field,
      // and an empty list there would read like "remove every goal" to the next person who adds one.
      ...(activiteit ? {} : { leerplandoelCodes: nieuweCodes }),
    });
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;
  const koppelingen = activiteit?.doelkoppelingen ?? [];

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      maat="breed"
      titel={activiteit ? t("activiteit.wijzigTitel") : t("activiteit.nieuwTitel")}
      voet={
        <div className="flex items-center gap-2">
          <Knop rang="hoofd" vol form={id} type="submit" disabled={bezig} className="@sm:w-auto @sm:px-6">
            {bezig ? t("themabeheer.bewaarBezig") : t("themabeheer.bewaar")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
        <div>
          <label htmlFor={`${id}-naam`} className="text-meta font-medium text-inkt">
            {t("themabeheer.naam")}
          </label>
          <Invoer
            id={`${id}-naam`}
            value={naam}
            disabled={bezig}
            aria-invalid={naamFout || undefined}
            onChange={(e) => {
              setNaam(e.target.value);
              if (naamFout) setNaamFout(false);
            }}
            className="mt-1.5"
          />
          {naamFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("activiteit.naamVerplicht")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 @md:flex-row @md:items-start">
          <div className="min-w-48 flex-1">
            <label htmlFor={`${id}-soort`} className="text-meta font-medium text-inkt">
              {t("activiteit.soort")}
            </label>
            <Keuze
              id={`${id}-soort`}
              value={soort}
              disabled={bezig}
              onChange={(e) => {
                const nieuw = e.target.value as ActiviteitType;
                setSoort(nieuw);
                // Cleared rather than kept: see the note in the component docstring.
                if (nieuw !== "Hoek") setHoek("");
              }}
              className="mt-1.5"
            >
              {ACTIVITEIT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`activiteitsoort.${type}`)}
                </option>
              ))}
            </Keuze>
          </div>

          {isHoek ? (
            <div className="min-w-48 flex-1">
              <label htmlFor={`${id}-hoek`} className="text-meta font-medium text-inkt">
                {t("activiteit.hoek")}
              </label>
              <Invoer
                id={`${id}-hoek`}
                value={hoek}
                disabled={bezig}
                onChange={(e) => setHoek(e.target.value)}
                className="mt-1.5"
              />
            </div>
          ) : null}
        </div>

        <fieldset>
          <legend className="text-meta font-medium text-inkt">{t("activiteit.lengte")}</legend>
          {/* Buttons rather than a number field: the answer is almost always 1 or 2, and a stepper
              made the common case as much work as the rare one. The chosen number is also spelled out
              underneath, because a pressed button in a row of four is not by itself a sentence. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {Array.from({ length: MAX_LENGTE }, (_, i) => i + 1).map((aantal) => {
              const gekozen = lengte === aantal;
              return (
                <button
                  key={aantal}
                  type="button"
                  disabled={bezig}
                  aria-pressed={gekozen}
                  onClick={() => setLengte(aantal)}
                  className={cn(
                    "mono h-raak w-11 rounded-veld border text-body font-medium transition-colors duration-150",
                    gekozen
                      ? "border-accent bg-accent text-accent-op"
                      : "border-lijn-veld bg-kaart text-inkt hover:border-inkt",
                  )}
                >
                  {aantal}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-meta text-inkt-zacht">
            {lengte === 1 ? t("activiteit.eenLesuur") : t("activiteit.aantalLesuren", { aantal: lengte })}
          </p>
        </fieldset>

        <fieldset>
          <legend className="text-meta font-medium text-inkt">{t("activiteit.kleur")}</legend>
          {/* Six swatches and a way back to none. The name is in the accessible label of every
              swatch, so the choice is never carried by hue alone (Art. XII). */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bezig}
              aria-pressed={kleur === null}
              onClick={() => setKleur(null)}
              className={cn(
                "h-raak rounded-veld border px-3 text-meta font-medium transition-colors duration-150",
                kleur === null
                  ? "border-inkt bg-vlak-diep text-inkt"
                  : "border-lijn-veld bg-kaart text-inkt-zacht hover:border-inkt hover:text-inkt",
              )}
            >
              {t("activiteit.geenKleur")}
            </button>
            {ACTIVITEITKLEUREN.map((optie) => (
              <button
                key={optie}
                type="button"
                disabled={bezig}
                aria-pressed={kleur === optie}
                aria-label={t(kleurSleutel(optie))}
                onClick={() => setKleur(optie)}
                className={cn(
                  "flex h-raak w-raak items-center justify-center rounded-veld border transition-colors duration-150",
                  kleur === optie ? "border-inkt" : "border-lijn-veld hover:border-inkt",
                )}
              >
                <span aria-hidden="true" className={cn("h-6 w-6 rounded", KLEURSTAAL[optie])} />
              </button>
            ))}
          </div>
          {kleur ? <p className="mt-1.5 text-meta text-inkt-zacht">{t(kleurSleutel(kleur))}</p> : null}
        </fieldset>

        <div>
          <label htmlFor={`${id}-uitkomsten`} className="text-meta font-medium text-inkt">
            {t("activiteit.uitkomsten")}
          </label>
          <Invoer
            id={`${id}-uitkomsten`}
            value={uitkomsten}
            disabled={bezig}
            onChange={(e) => setUitkomsten(e.target.value)}
            className="mt-1.5"
          />
        </div>

        {/* Only offered when the subthema has questions: a picker with one empty option is a control
            that does nothing, and the way to get a question is to edit the subthema. */}
        {onderzoeksvragen.length > 0 ? (
          <div>
            <label htmlFor={`${id}-vraag`} className="text-meta font-medium text-inkt">
              {t("activiteit.onderzoeksvraag")}
            </label>
            <Keuze
              id={`${id}-vraag`}
              value={vraagId}
              disabled={bezig}
              onChange={(e) => setVraagId(e.target.value)}
              className="mt-1.5"
            >
              <option value="">{t("activiteit.geenVraag")}</option>
              {onderzoeksvragen.map((vraag) => (
                <option key={vraag.id} value={vraag.id}>
                  {vraag.vraag}
                </option>
              ))}
            </Keuze>
          </div>
        ) : null}

        {extra ? <section className="border-t border-lijn pt-5">{extra}</section> : null}

        {/* DOELEN, IN BEIDE RICHTINGEN, and the two branches do not behave the same.
            While EDITING, the picker writes through its own endpoints on the spot, because it can: the
            activiteit has an id. While CREATING there is no id yet, so the codes are held here and travel
            with the create request, which the server links inside the same save.
            The explaining line therefore differs per branch. It has to: one of them would be false in the
            other, and a sentence may only assert what its own branch guarantees. */}
        {activiteit ? (
          onKoppel && onOntkoppel ? (
            <section className="border-t border-lijn pt-5">
              <Doelenkop aantal={koppelingen.length} uitleg={t("activiteit.doelenDirect")} />

              {koppelingen.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {koppelingen.map((koppeling) => (
                    <li
                      key={koppeling.id}
                      className="flex items-center gap-2 rounded-veld border border-lijn bg-kaart px-3 py-1.5"
                    >
                      <span className="mono min-w-0 truncate text-meta font-medium text-inkt">
                        {koppeling.leerplandoelCode}
                      </span>
                      <Statusmerk status={koppeling.status} className="ml-auto" />
                      <Weg
                        label={t("activiteit.ontkoppel", { code: koppeling.leerplandoelCode })}
                        bezig={koppelenBezig}
                        onClick={() => onOntkoppel(koppeling.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-3">
                <Doelkoppelaar
                  onKies={onKoppel}
                  bezig={koppelenBezig}
                  alGekozen={koppelingen.map((k) => k.leerplandoelCode)}
                />
              </div>
            </section>
          ) : null
        ) : (
          <section className="border-t border-lijn pt-5">
            <Doelenkop aantal={nieuweCodes.length} uitleg={t("activiteit.doelenBijBewaren")} />

            {nieuweCodes.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {nieuweCodes.map((code) => (
                  <li
                    key={code}
                    className="flex items-center gap-2 rounded-veld border border-lijn bg-kaart px-3 py-1.5"
                  >
                    {/* No Statusmerk here. Nothing has a status yet: it becomes Manueel when the server
                        stores it, and printing that beforehand would state a fact this row does not have. */}
                    <span className="mono min-w-0 truncate text-meta font-medium text-inkt">{code}</span>
                    <Weg
                      label={t("activiteit.codeWeg", { code })}
                      bezig={bezig}
                      className="ml-auto"
                      onClick={() => setNieuweCodes((vorige) => vorige.filter((c) => c !== code))}
                    />
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-3">
              <Doelkoppelaar
                onKies={(code) => setNieuweCodes((vorige) => (vorige.includes(code) ? vorige : [...vorige, code]))}
                bezig={bezig}
                alGekozen={nieuweCodes}
              />
            </div>
          </section>
        )}

        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("themabeheer.bewaarMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </form>
    </Blad>
  );
}

/** The heading of the doelen section: what it is, how many, and when they are saved. */
function Doelenkop({ aantal, uitleg }: { aantal: number; uitleg: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-micro uppercase text-inkt-zwak">{t("activiteit.doelen")}</h3>
        <span className="mono shrink-0 text-micro text-inkt-zwak">{aantal}</span>
      </div>
      {/* Said once, above the list, because when these are written is the one thing the layout cannot show. */}
      <p className="mt-1 text-meta text-inkt-zacht">{uitleg}</p>
    </>
  );
}

/** Takes one goal off the list, wherever that list lives. */
function Weg({
  label,
  bezig,
  className,
  onClick,
}: {
  label: string;
  bezig?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={bezig}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-veld text-inkt-zwak",
        "transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt disabled:opacity-45",
        className,
      )}
    >
      <IcoonKruis aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
