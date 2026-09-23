import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Segment } from "../../components/ui/Segment";
import { useRechten } from "../../lib/rechten";
import { Invoer, Keuze } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { ACTIVITEIT_TYPES } from "../../lib/types";
import type { ActiviteitWeergave, ActiviteitType, OnderzoeksvraagWeergave, SubdoelWeergave } from "../../lib/types";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { ACTIVITEITKLEUREN, KLEURSTAAL, kleurSleutel, type Activiteitkleur } from "./kleuren";
import { STANDAARDDUUR } from "../plan/tijd";
import { Doellijst, Feit } from "../themas/Fiche";
import { Gekoppelddoel } from "../themas/Gekoppelddoel";
import { Doeldetailblad } from "../themas/Doeldetailblad";
import { beslist } from "../themas/subthemabalans";
import { Doelkoppelaar } from "./Doelkoppelaar";
import { Doelvoorstellen } from "./Doelvoorstellen";
import { Eigenaarmerk } from "./Eigenaarmerk";
import { Subdoelvinklijst } from "./Subdoelvinklijst";

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
 *
 * **Two rights meet here, and each branch shows only what its reader holds** (E6-02, ADR-0030 §3). The fields are the
 * activiteit's content (R17, R23; I15); the goals are R19's, which only admin and that leeftijd's hoofdleerkrachten
 * hold, also when a new activiteit carries codes on its create. So `magDoelen` gates the goal section in both branches,
 * and `alleenLezen` replaces the form with the facts for a gebruiker who may not change the content. A reader opening
 * an activiteit gets what it is, not a form whose Bewaren the server would refuse.
 *
 * **A new activiteit is the creator's own** (ADR-0049 E1). A gebruiker who may also create a shared one (a
 * hoofdleerkracht, admin) chooses "voor wie"; one who may only create a shared one gets that without a choice. Goals
 * on a new own activiteit are the creator's to link (E3), so the picker shows for it whatever `magDoelen` says; on a
 * new shared one it follows the R19 row. Both need the subthema's `leeftijd`, which every create passes.
 *
 * **A colleague's own activiteit opens as its facts, with "Gebruiken"** when the caller passes `onGebruik`: the one
 * thing she may do with it is take an own copy (D5).
 *
 * **A new activiteit offers its subthema's subdoelen to tick** (FB-051) when the caller passes them: they are the goals it
 * most likely serves, so they stand above the search as one line each, and a ticked one travels with the create like a
 * searched one. The search stays below for "andere doelen" and no longer offers a subdoel, which is already a row above.
 * Only on a new activiteit: an existing one keeps its own list and picker.
 *
 * **A goal reads as its text and opens its detail**, in all three states (TB-025): the row the thema page uses
 * (`Gekoppelddoel`), and the doel's detail on top of this sheet, which gives focus back to the row when it closes.
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
  alleenLezen = false,
  magDoelen = false,
  leeftijd,
  onGebruik,
  gebruikBezig = false,
  themaId,
  subdoelen,
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
  /**
   * The gebruiker may not change this activiteit's content (`mag.activiteitBewerken`): show what it is instead of a
   * form. Only for an existing activiteit; a new one is only ever opened by someone who may make it.
   */
  alleenLezen?: boolean;
  /**
   * The gebruiker may link goals at this activiteit's leeftijd (`mag.doelenKoppelen`, R19). Off by default, so a
   * caller that forgets it offers no picker rather than one the server refuses.
   */
  magDoelen?: boolean;
  /** The leeftijd of the subthema a NEW activiteit goes under: it decides "voor wie" and the goal picker. */
  leeftijd?: string;
  /** Take an own copy of this (someone else's own) activiteit; shown on the facts only. */
  onGebruik?: () => void;
  gebruikBezig?: boolean;
  /** The thema of an existing activiteit: with it, whoever may link its goals can also ask the AI for some (FB-026). */
  themaId?: string;
  /** The subdoelen of the subthema a NEW activiteit goes under, offered to tick; omitted, no such list (FB-051). */
  subdoelen?: SubdoelWeergave[];
}) {
  const id = useId();
  const { mag } = useRechten();
  const magEigen = leeftijd !== undefined && mag.eigenActiviteitMaken(leeftijd);
  const magGedeeld = leeftijd !== undefined && mag.gedeeldeActiviteitMaken(leeftijd);
  const [kiesGedeeld, setKiesGedeeld] = useState(false);
  // Without the own right, a shared one is the only one this gebruiker may make; with both, it is their choice.
  const gedeeld = magGedeeld && (!magEigen || kiesGedeeld);
  const magNieuweDoelen = leeftijd === undefined ? magDoelen : gedeeld ? mag.doelenKoppelen(leeftijd) : magEigen;
  const [naam, setNaam] = useState(activiteit?.naam ?? "");
  // "" is no soort. Never preselected on a new activiteit (FB-050): a soort nobody chose would still be saved as if
  // it had been chosen.
  const [soort, setSoort] = useState<ActiviteitType | "">(activiteit?.activiteitType ?? "");
  const [hoek, setHoek] = useState(activiteit?.hoek ?? "");
  const [uitkomsten, setUitkomsten] = useState(activiteit?.verwachteUitkomsten ?? "");
  const [vraagId, setVraagId] = useState(activiteit?.onderzoeksvraagId ?? "");
  const [kleur, setKleur] = useState<Activiteitkleur | null>(activiteit?.kleur ?? null);
  const [lengte, setLengte] = useState(activiteit?.lengteInLesuren ?? 1);
  const [naamFout, setNaamFout] = useState(false);
  // The goal whose detail is open over this sheet, with the row that opened it.
  const [doel, setDoel] = useState<{ code: string; knop: HTMLElement } | null>(null);
  const toonDoel = (code: string, knop: HTMLElement) => setDoel({ code, knop });

  // Only used while creating. Held here rather than written through, because there is nothing to write
  // to yet: they travel with the create request. See `ActiviteitInvoer.leerplandoelCodes`.
  const [nieuweCodes, setNieuweCodes] = useState<string[]>([]);

  const isHoek = soort === "Hoek";
  // Only decided subdoelen: an undecided one is not a subdoel yet (see `beslist`).
  const subdoelCodes = (subdoelen ?? [])
    .filter((subdoel) => beslist(subdoel.koppeling.status))
    .map((subdoel) => subdoel.koppeling.leerplandoelCode);
  const andereCodes = nieuweCodes.filter((code) => !subdoelCodes.includes(code));
  const voegToe = (code: string) => setNieuweCodes((vorige) => (vorige.includes(code) ? vorige : [...vorige, code]));

  function verstuur(event: FormEvent) {
    event.preventDefault();
    if (naam.trim().length === 0) {
      setNaamFout(true);
      return;
    }
    onBewaar({
      naam: naam.trim(),
      activiteitType: soort === "" ? null : soort,
      // Never sent for a soort that is not Hoek: the server would drop it, and a value that is stored
      // nowhere but still in the form is a value a teacher believes they saved.
      hoek: isHoek && hoek.trim() !== "" ? hoek.trim() : null,
      verwachteUitkomsten: uitkomsten.trim() === "" ? null : uitkomsten.trim(),
      onderzoeksvraagId: vraagId === "" ? null : vraagId,
      kleur,
      lengteInLesuren: lengte,
      // Left off entirely while editing rather than sent empty: the update endpoint has no such field,
      // and an empty list there would read like "remove every goal" to the next person who adds one.
      // Left off too for a gebruiker without the goal-link right, who was offered no picker (R19).
      ...(activiteit || !magNieuweDoelen ? {} : { leerplandoelCodes: nieuweCodes }),
      ...(activiteit ? {} : { gedeeld }),
    });
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;
  // Only decided doelen are linked; a proposal waits below and a rejected one is not shown (ADR-0054 D5).
  const koppelingen = (activiteit?.doelkoppelingen ?? []).filter((k) => beslist(k.status));

  // ONE DIALOG FOR BOTH STATES (E6-02 slice 4, fix round 3, F8). A refusal refetches the rights, and a gebruiker who
  // loses the content right with it turns this from the form into the facts while the sheet is open. Two dialogs
  // remounted the sheet, moved focus, and announced and scrolled a refusal in `extra` a second time. One dialog with
  // the same slots keeps the caller's section, and what is in it, as the same elements. What switches is the title,
  // the footer, the block above that section and the goals below it.
  const fiche = alleenLezen && activiteit ? activiteit : null;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      maat="breed"
      titel={fiche ? fiche.naam : activiteit ? t("activiteit.wijzigTitel") : t("activiteit.nieuwTitel")}
      // No footer on the facts: with nothing to save, the sheet's own close control is the only action, and a second
      // "Sluiten" beside it would be the same control twice under the same name.
      voet={
        fiche ? (
          onGebruik ? (
            <div className="flex flex-col gap-1.5 @sm:flex-row @sm:items-center @sm:gap-3">
              <Knop rang="hoofd" vol onClick={onGebruik} bezig={gebruikBezig} className="@sm:w-auto @sm:px-6">
                {gebruikBezig ? t("activiteit.gebruikBezig") : t("activiteit.gebruik")}
              </Knop>
              <p className="text-meta text-inkt-zacht">{t("activiteit.gebruikUitleg")}</p>
            </div>
          ) : undefined
        ) : (
          <div className="flex items-center gap-2">
            <Knop rang="hoofd" vol form={id} type="submit" bezig={bezig} className="@sm:w-auto @sm:px-6">
              {bezig ? t("themabeheer.bewaarBezig") : t("themabeheer.bewaar")}
            </Knop>
            <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
              {t("themabeheer.annuleer")}
            </Knop>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {fiche ? (
          <Feiten activiteit={fiche} onderzoeksvragen={onderzoeksvragen} />
        ) : (
          <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
            {activiteit ? (
              <Eigenaarmerk activiteit={activiteit} />
            ) : magEigen && magGedeeld ? (
              <div>
                <Segment
                  label={t("activiteit.voorWie")}
                  waarde={kiesGedeeld ? "gedeeld" : "eigen"}
                  opties={[
                    { waarde: "eigen", label: t("activiteit.alleenVoorMij") },
                    { waarde: "gedeeld", label: t("activiteit.gedeeldMetSubthema") },
                  ]}
                  onKies={(waarde) => setKiesGedeeld(waarde === "gedeeld")}
                  className="w-full @md:w-auto"
                />
                <p className="mt-1.5 text-meta text-inkt-zacht">{t("activiteit.voorWieUitleg")}</p>
              </div>
            ) : null}
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
                    // Cleared rather than kept: see the note in the component docstring.
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
          </form>
        )}

        {extra ? <section className="border-t border-lijn pt-5">{extra}</section> : null}

        {/* DOELEN, IN BEIDE RICHTINGEN, and the two branches do not behave the same.
            While EDITING, the picker writes through its own endpoints on the spot, because it can: the
            activiteit has an id. While CREATING there is no id yet, so the codes are held here and travel
            with the create request, which the server links inside the same save.
            The explaining line therefore differs per branch. It has to: one of them would be false in the
            other, and a sentence may only assert what its own branch guarantees. */}
        {fiche ? (
          <Feitdoelen activiteit={fiche} onToon={toonDoel} />
        ) : activiteit ? (
          magDoelen && onKoppel && onOntkoppel ? (
            <section className="border-t border-lijn pt-5">
              <Doelenkop aantal={koppelingen.length} uitleg={t("activiteit.doelenDirect")} />

              {koppelingen.length > 0 ? (
                <div className="mt-2">
                  <Doellijst>
                    {koppelingen.map((koppeling) => (
                      <Gekoppelddoel
                        key={koppeling.id}
                        koppeling={koppeling}
                        ontkoppelLabel={t("activiteit.ontkoppel", { code: koppeling.leerplandoelCode })}
                        ontkoppelBezig={koppelenBezig}
                        onOntkoppel={() => onOntkoppel(koppeling.id)}
                        onToon={toonDoel}
                      />
                    ))}
                  </Doellijst>
                </div>
              ) : null}

              <div className="mt-3">
                <Doelkoppelaar
                  onKies={onKoppel}
                  bezig={koppelenBezig}
                  alGekozen={koppelingen.map((k) => k.leerplandoelCode)}
                />
              </div>

              {themaId ? <Doelvoorstellen themaId={themaId} activiteit={activiteit} onToon={toonDoel} /> : null}
            </section>
          ) : null
        ) : magNieuweDoelen ? (
          <section className="border-t border-lijn pt-5">
            <Doelenkop aantal={nieuweCodes.length} uitleg={t("activiteit.doelenBijBewaren")} />

            {subdoelen ? (
              <div className="mt-3">
                <Subdoelvinklijst
                  codes={subdoelCodes}
                  gekozen={nieuweCodes}
                  bezig={bezig}
                  onWissel={(code, aan) =>
                    aan ? voegToe(code) : setNieuweCodes((vorige) => vorige.filter((c) => c !== code))
                  }
                  onToon={toonDoel}
                />
                <h4 className="mt-4 text-meta font-medium text-inkt">{t("activiteit.andereDoelen")}</h4>
              </div>
            ) : null}

            {andereCodes.length > 0 ? (
              <div className="mt-2">
                <Doellijst>
                  {/* No status here: nothing is stored yet. See `Gekoppelddoel`. */}
                  {andereCodes.map((code) => (
                    <Gekoppelddoel
                      key={code}
                      koppeling={{ leerplandoelCode: code }}
                      ontkoppelLabel={t("activiteit.codeWeg", { code })}
                      ontkoppelBezig={bezig}
                      onOntkoppel={() => setNieuweCodes((vorige) => vorige.filter((c) => c !== code))}
                      onToon={toonDoel}
                    />
                  ))}
                </Doellijst>
              </div>
            ) : null}

            <div className="mt-3">
              {/* A subdoel is not offered here: it is a row to tick above. */}
              <Doelkoppelaar onKies={voegToe} bezig={bezig} alGekozen={[...nieuweCodes, ...subdoelCodes]} />
            </div>
          </section>
        ) : null}

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

/**
 * The heading of the doelen section: what it is, how many, and when they are saved. No `uitleg` where nothing is
 * saved from here, which is the read-only view.
 */
function Doelenkop({ aantal, uitleg }: { aantal: number; uitleg?: string }) {
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

/**
 * An activiteit for a gebruiker who may read it and not change it (E6-02): the same facts the form holds, as facts.
 *
 * Shown in the form's own sheet, at its width and under its labels, so the two read as one object in two states. Every
 * fact is printed only when it has a value. What the caller adds (`extra`: the agenda's day and hours, for a gebruiker
 * who may plan the klas) still sits below.
 */
function Feiten({
  activiteit,
  onderzoeksvragen,
}: {
  activiteit: ActiviteitMetKleur;
  onderzoeksvragen: OnderzoeksvraagWeergave[];
}) {
  const vraag = onderzoeksvragen.find((kandidaat) => kandidaat.id === activiteit.onderzoeksvraagId);

  return (
    <dl className="flex flex-col gap-2">
      {/* Above the facts, not as one: the mark already says "Van An", and a label "Van" before it would say it twice. */}
      {activiteit.eigenaarId != null ? <Eigenaarmerk activiteit={activiteit} /> : null}
      {activiteit.activiteitType ? (
        <Feit label={t("activiteit.soort")}>{t(`activiteitsoort.${activiteit.activiteitType}`)}</Feit>
      ) : null}
      {activiteit.activiteitType === "Hoek" && activiteit.hoek ? (
        <Feit label={t("activiteit.hoek")}>{activiteit.hoek}</Feit>
      ) : null}
      <Feit label={t("activiteit.duur")}>
        {t("activiteit.duurFeit", {
          lesuren: telWoord(activiteit.lengteInLesuren ?? 1, "activiteit.eenLesuur", "activiteit.lesuren"),
          minuten: (activiteit.lengteInLesuren ?? 1) * STANDAARDDUUR,
        })}
      </Feit>
      {activiteit.kleur ? <Feit label={t("activiteit.kleur")}>{t(kleurSleutel(activiteit.kleur))}</Feit> : null}
      {activiteit.verwachteUitkomsten ? (
        <Feit label={t("activiteit.uitkomsten")}>{activiteit.verwachteUitkomsten}</Feit>
      ) : null}
      {vraag ? <Feit label={t("activiteit.onderzoeksvraag")}>{vraag.vraag}</Feit> : null}
    </dl>
  );
}

/** The facts' goals: listed and opening their detail, without a way to add or remove one. */
function Feitdoelen({
  activiteit,
  onToon,
}: {
  activiteit: ActiviteitMetKleur;
  onToon: (code: string, knop: HTMLElement) => void;
}) {
  const gekoppeld = activiteit.doelkoppelingen.filter((k) => beslist(k.status));
  return (
    <section className="border-t border-lijn pt-5">
      <Doelenkop aantal={gekoppeld.length} />
      {gekoppeld.length === 0 ? (
        <p className="mt-2 text-meta text-inkt-zacht">{t("activiteit.geenDoel")}</p>
      ) : (
        <div className="mt-2">
          <Doellijst>
            {gekoppeld.map((koppeling) => (
              <Gekoppelddoel
                key={koppeling.id}
                koppeling={koppeling}
                ontkoppelLabel={t("activiteit.ontkoppel", { code: koppeling.leerplandoelCode })}
                onToon={onToon}
              />
            ))}
          </Doellijst>
        </div>
      )}
    </section>
  );
}
