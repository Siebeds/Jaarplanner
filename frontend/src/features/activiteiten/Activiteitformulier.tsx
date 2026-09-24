import { useState, type ReactNode } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Keuze } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { ACTIVITEIT_TYPES } from "../../lib/types";
import type { ActiviteitWeergave, ActiviteitType, OnderzoeksvraagWeergave } from "../../lib/types";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { ACTIVITEITKLEUREN, KLEURSTAAL, kleurSleutel, type Activiteitkleur } from "./kleuren";
import { STANDAARDDUUR } from "../plan/tijd";
import { Doeldetailblad } from "../themas/Doeldetailblad";
import type { Activiteitveldwaarden } from "./activiteitvelden";

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
  /** Null for no soort: the soort is optional (FB-050). */
  activiteitType: ActiviteitType | null;
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
  /**
   * Only sent while creating: true for a shared activiteit, false (the default) for the creator's own (ADR-0049 D1).
   */
  gedeeld?: boolean;
}

/*
  THE ACTIVITEIT SHEET, in two explicit variants (TB-074): `NieuweActiviteit` makes one, `BestaandeActiviteit` changes
  or shows one. Each takes only the props of its own case, and a caller picks the one it means. What they share lives
  here: the sheet around them (`Activiteitsheet`), the activiteit's own fields (`Activiteitvelden`, with their state in
  `useActiviteitvelden`), the Bewaren footer and the heading of the doelen section.

  **One set of fields for the thema page and for the agenda.** An activiteit is the same thing in both places, and a
  second form would be a second set of rules about when hoek is allowed. It lives in its own feature folder for that
  reason: neither of the two screens owns it.

  **Hoek only exists when the soort is Hoek.** Not disabled, not greyed: absent. A field that is visible but refuses
  input is a field a teacher tries anyway, and the value would be discarded server-side without a word. When the soort
  changes away from Hoek the value is cleared, because a hoek belonging to a soort that is no longer a hoek is a hoek
  nobody can see.

  **`extra` is for what belongs to the CALLER's screen rather than to the activiteit.** The agenda hangs the day it is
  planned on there, which is a property of the plaatsing and not of the activiteit: it must not ride along on Bewaren,
  and it must not exist at all on the thema page.

  **A goal reads as its text and opens its detail**, in all three states (TB-025): the row the thema page uses
  (`Gekoppelddoel`), and the doel's detail on top of this sheet, which gives focus back to the row when it closes.
*/

/**
 * The sheet both variants stand in, with its slots in one fixed order: the fields or facts, the caller's `extra`, the
 * doelen, and a refusal. The slots are the same in every state, so a variant that switches what fills one of them (the
 * edit sheet turning into the facts) keeps the others as the same elements (E6-02 slice 4, fix round 3, F8).
 *
 * `doelen` gets the function that opens a goal's detail over this sheet.
 */
export function Activiteitsheet({
  open,
  onSluit,
  titel,
  voet,
  inhoud,
  extra,
  doelen,
  fout,
}: {
  open: boolean;
  onSluit: () => void;
  titel: string;
  voet?: ReactNode;
  /** The form, or the facts. */
  inhoud: ReactNode;
  /** A section of the caller's own, rendered below the fields and above the goal links. */
  extra?: ReactNode;
  doelen: (toonDoel: (code: string, knop: HTMLElement) => void) => ReactNode;
  fout?: unknown;
}) {
  // The goal whose detail is open over this sheet, with the row that opened it.
  const [doel, setDoel] = useState<{ code: string; knop: HTMLElement } | null>(null);
  const toonDoel = (code: string, knop: HTMLElement) => setDoel({ code, knop });
  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad open={open} onOpenChange={(o) => !o && onSluit()} maat="breed" titel={titel} voet={voet}>
      <div className="flex flex-col gap-5">
        {inhoud}

        {extra ? <section className="border-t border-lijn pt-5">{extra}</section> : null}

        {doelen(toonDoel)}

        {/* A refusal that arrived while this was the form stays: after the refetched rights turn it into the facts,
            this is still the same element in the same dialog. */}
        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("themabeheer.bewaarMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </div>

      <Doeldetailblad code={doel?.code ?? null} terugNaar={doel?.knop} onSluit={() => setDoel(null)} />
    </Blad>
  );
}

/** Bewaren and Annuleren, submitting the form with id `formulier`. */
export function Bewaarvoet({ formulier, bezig, onSluit }: { formulier: string; bezig: boolean; onSluit: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Knop rang="hoofd" vol form={formulier} type="submit" bezig={bezig} className="@sm:w-auto @sm:px-6">
        {bezig ? t("themabeheer.bewaarBezig") : t("themabeheer.bewaar")}
      </Knop>
      <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
        {t("themabeheer.annuleer")}
      </Knop>
    </div>
  );
}

/**
 * The activiteit's own fields, the same in both variants; the variant owns the `<form>` around them and what stands
 * above them. `id` prefixes the fields' ids.
 */
export function Activiteitvelden({
  id,
  velden,
  onderzoeksvragen,
  bezig,
}: {
  id: string;
  velden: Activiteitveldwaarden;
  /** The questions of the owning subthema. An activiteit may point at one of these, or at none. */
  onderzoeksvragen: OnderzoeksvraagWeergave[];
  bezig: boolean;
}) {
  const {
    naam,
    setNaam,
    soort,
    setSoort,
    hoek,
    setHoek,
    uitkomsten,
    setUitkomsten,
    vraagId,
    setVraagId,
    kleur,
    setKleur,
    lengte,
    setLengte,
    naamFout,
    setNaamFout,
  } = velden;
  const isHoek = soort === "Hoek";

  return (
    <>
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
              const nieuw = e.target.value as ActiviteitType | "";
              setSoort(nieuw);
              // Cleared rather than kept: see "Hoek only exists when the soort is Hoek" above.
              if (nieuw !== "Hoek") setHoek("");
            }}
            className="mt-1.5"
          >
            {/* Always offered, also once a soort is chosen: the soort is optional, so it can be cleared again. */}
            <option value="">{t("activiteit.geenSoort")}</option>
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
        <legend className="text-meta font-medium text-inkt">{t("activiteit.duur")}</legend>
        {/*
          THE DEFAULT LENGTH, and the reason it is four buttons rather than a field.

          The answer is almost always the first or the second, and a stepper made the common case as much work
          as the rare one. What the agenda then does with it is a starting point: the block lands this long and
          the teacher drags its bottom edge to whatever that Thursday actually needs (ADR-0028).

          **Named in lesuren, with the minutes under it.** The value is stored as a count of 50-minute units
          (`lengteInLesuren`, ADR-0028 decision 2), a lesuur is the unit a teacher counts in, and the minutes say
          how long the block will land in the agenda's clock times.
        */}
        {/* Two by two on a phone, where four in a row do not fit and wrapping left the fourth alone. */}
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 @md:flex @md:flex-wrap @md:items-stretch">
          {[1, 2, 3, 4].map((aantal) => {
            const gekozen = lengte === aantal;
            return (
              <button
                key={aantal}
                type="button"
                disabled={bezig}
                aria-pressed={gekozen}
                onClick={() => setLengte(aantal)}
                className={cn(
                  "flex min-h-raak min-w-24 flex-col items-center justify-center rounded-veld border px-3 py-1.5",
                  "transition-colors duration-150",
                  gekozen
                    ? "border-accent bg-accent text-accent-op"
                    : "border-lijn-veld bg-kaart text-inkt hover:border-inkt",
                )}
              >
                <span className="text-body font-medium">
                  {telWoord(aantal, "activiteit.eenLesuur", "activiteit.lesuren")}
                </span>{" "}
                <span className={cn("mono text-micro", gekozen ? "text-accent-op" : "text-inkt-zacht")}>
                  {t("activiteit.minutenKort", { aantal: aantal * STANDAARDDUUR })}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-meta text-inkt-zacht">{t("activiteit.duurUitleg")}</p>
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
    </>
  );
}

/**
 * The heading of the doelen section: what it is, how many, and when they are saved. No `uitleg` where nothing is
 * saved from here, which is the read-only view.
 */
export function Doelenkop({ aantal, uitleg }: { aantal: number; uitleg?: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-micro uppercase text-inkt-zwak">{t("activiteit.doelen")}</h3>
        <span className="mono shrink-0 text-micro text-inkt-zwak">{aantal}</span>
      </div>
      {/* Said once, above the list, because when these are written is the one thing the layout cannot show. */}
      {uitleg ? <p className="mt-1 text-meta text-inkt-zacht">{uitleg}</p> : null}
    </>
  );
}
