import { useId, type FormEvent, type ReactNode } from "react";
import { Knop } from "../../components/ui/Knop";
import type { OnderzoeksvraagWeergave } from "../../lib/types";
import { t, telWoord } from "../../i18n";
import { kleurSleutel } from "./kleuren";
import { STANDAARDDUUR } from "../plan/tijd";
import { Doellijst, Feit } from "../themas/Fiche";
import { Gekoppelddoel } from "../themas/Gekoppelddoel";
import { beslist } from "../themas/subthemabalans";
import {
  Activiteitsheet,
  Activiteitvelden,
  Bewaarvoet,
  Doelenkop,
  type ActiviteitInvoer,
  type ActiviteitMetKleur,
} from "./Activiteitformulier";
import { useActiviteitvelden } from "./activiteitvelden";
import { Doelkoppelaar } from "./Doelkoppelaar";
import { Doelvoorstellen } from "./Doelvoorstellen";
import { Eigenaarmerk } from "./Eigenaarmerk";

/**
 * Changing an existing activiteit, or reading it (TB-074: the edit variant of the activiteit sheet; the shared parts
 * are in `Activiteitformulier`).
 *
 * **Goal links are edited here and applied immediately, unlike everything else on this form.** They are their own
 * endpoints (`POST`/`DELETE .../doelkoppelingen`) rather than fields on the activiteit, so the caller commits them as
 * they are chosen and this sheet is honest about that: the list under "Doelen" changes the moment you touch it, and the
 * Bewaren button says nothing about it.
 *
 * **Two rights meet here, and each state shows only what its reader holds** (E6-02, ADR-0030 §3). The fields are the
 * activiteit's content (R17, R23; I15); the goals are R19's, which only admin and that leeftijd's hoofdleerkrachten
 * hold. So `magDoelen` gates the goal section, and `alleenLezen` replaces the form with the facts for a gebruiker who
 * may not change the content. A reader opening an activiteit gets what it is, not a form whose Bewaren the server
 * would refuse.
 *
 * **A colleague's own activiteit opens as its facts, with "Gebruiken"** when the caller passes `onGebruik`: the one
 * thing she may do with it is take an own copy (ADR-0049 D5).
 */
export function BestaandeActiviteit({
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
  onGebruik,
  gebruikBezig = false,
  themaId,
}: {
  open: boolean;
  activiteit: ActiviteitMetKleur;
  /** The questions of the owning subthema. An activiteit may point at one of these, or at none. */
  onderzoeksvragen: OnderzoeksvraagWeergave[];
  onBewaar: (invoer: ActiviteitInvoer) => void;
  onSluit: () => void;
  bezig: boolean;
  fout?: unknown;
  onKoppel: (leerplandoelCode: string) => void;
  onOntkoppel: (koppelingId: string) => void;
  koppelenBezig?: boolean;
  /** A section of the caller's own, rendered below the fields and above the goal links. */
  extra?: ReactNode;
  /** The gebruiker may not change this activiteit's content (`mag.activiteitBewerken`): show what it is instead of a form. */
  alleenLezen?: boolean;
  /**
   * The gebruiker may link goals at this activiteit's leeftijd (`mag.doelenKoppelen`, R19). Off by default, so a
   * caller that forgets it offers no picker rather than one the server refuses.
   */
  magDoelen?: boolean;
  /** Take an own copy of this (someone else's own) activiteit; shown on the facts only. */
  onGebruik?: () => void;
  gebruikBezig?: boolean;
  /** The activiteit's thema: with it, whoever may link its goals can also ask the AI for some (FB-026). */
  themaId?: string;
}) {
  const id = useId();
  const { velden, leesInvoer } = useActiviteitvelden(activiteit);

  function verstuur(event: FormEvent) {
    event.preventDefault();
    const invoer = leesInvoer();
    // Only the fields: the update endpoint has no goal codes, and an empty list there would read like "remove every
    // goal" to the next person who adds one.
    if (invoer) onBewaar(invoer);
  }

  // Only decided doelen are linked; a proposal waits below and a rejected one is not shown (ADR-0054 D5).
  const koppelingen = activiteit.doelkoppelingen.filter((k) => beslist(k.status));

  // ONE SHEET FOR BOTH STATES (E6-02 slice 4, fix round 3, F8). A refusal refetches the rights, and a gebruiker who
  // loses the content right with it turns this from the form into the facts while the sheet is open. Two dialogs
  // remounted the sheet, moved focus, and announced and scrolled a refusal in `extra` a second time. One sheet with
  // the same slots keeps the caller's section, and what is in it, as the same elements. What switches is the title,
  // the footer, the block above that section and the goals below it.
  return (
    <Activiteitsheet
      open={open}
      onSluit={onSluit}
      titel={alleenLezen ? activiteit.naam : t("activiteit.wijzigTitel")}
      // No footer on the facts: with nothing to save, the sheet's own close control is the only action, and a second
      // "Sluiten" beside it would be the same control twice under the same name.
      voet={
        alleenLezen ? (
          onGebruik ? (
            <div className="flex flex-col gap-1.5 @sm:flex-row @sm:items-center @sm:gap-3">
              <Knop rang="hoofd" vol onClick={onGebruik} bezig={gebruikBezig} className="@sm:w-auto @sm:px-6">
                {gebruikBezig ? t("activiteit.gebruikBezig") : t("activiteit.gebruik")}
              </Knop>
              <p className="text-meta text-inkt-zacht">{t("activiteit.gebruikUitleg")}</p>
            </div>
          ) : undefined
        ) : (
          <Bewaarvoet formulier={id} bezig={bezig} onSluit={onSluit} />
        )
      }
      fout={fout}
      extra={extra}
      inhoud={
        alleenLezen ? (
          <Feiten activiteit={activiteit} onderzoeksvragen={onderzoeksvragen} />
        ) : (
          <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
            <Eigenaarmerk activiteit={activiteit} />
            <Activiteitvelden id={id} velden={velden} onderzoeksvragen={onderzoeksvragen} bezig={bezig} />
          </form>
        )
      }
      doelen={(toonDoel) =>
        alleenLezen ? (
          <Feitdoelen activiteit={activiteit} onToon={toonDoel} />
        ) : magDoelen ? (
          <section className="border-t border-lijn pt-5">
            {/* Written on the spot, so the line under the heading says so: the create sheet saves them with the
                activiteit, and a sentence may only assert what its own case guarantees. */}
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
              <Doelkoppelaar onKies={onKoppel} bezig={koppelenBezig} alGekozen={koppelingen.map((k) => k.leerplandoelCode)} />
            </div>

            {themaId ? <Doelvoorstellen themaId={themaId} activiteit={activiteit} onToon={toonDoel} /> : null}
          </section>
        ) : null
      }
    />
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
