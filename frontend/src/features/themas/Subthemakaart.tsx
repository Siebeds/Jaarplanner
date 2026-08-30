import type { ReactNode } from "react";
import { Knop } from "../../components/ui/Knop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Doelmerk } from "../../components/ui/Doelmerk";
import { IcoonPlus } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import type { SubthemaWeergave } from "../../lib/types";
import { KLEURVLAK, kleurSleutel, type Activiteitkleur } from "../activiteiten/kleuren";
import type { ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import { Doelkoppelaar } from "../activiteiten/Doelkoppelaar";

/**
 * One class's derivation of a thema, with everything that hangs under it.
 *
 * **Nothing static is shaped like a button.** Codes, soorten and words are text; only the two
 * controls at the bottom of a row and the card's own actions carry an outline. The previous version
 * put woordenschat, activiteiten and doelcodes all in rounded pills, which made a card of read-only
 * facts look like a toolbar.
 *
 * **The nesting is the information.** A subthema owns onderzoeksvragen, and an activiteit may point
 * at one of them; an activiteit owns its own goal links, and the subthema owns its subdoelen. Those
 * are four different things and they are four visibly different blocks, because a teacher deciding
 * where to hang a doel needs to see which level they are on.
 */
export function Subthemakaart({
  subthema,
  klasNaam,
  onBewerk,
  onVerwijder,
  onNieuweActiviteit,
  onBewerkActiviteit,
  onVerwijderActiviteit,
  onKoppelSubdoel,
  onOntkoppelSubdoel,
  onKoppelActiviteitdoel,
  koppelenBezig,
}: {
  subthema: SubthemaWeergave;
  /** The class this derivation belongs to, resolved by the caller: the subthema carries only an id. */
  klasNaam: string | null;
  onBewerk: () => void;
  onVerwijder: () => void;
  onNieuweActiviteit: () => void;
  onBewerkActiviteit: (activiteit: ActiviteitMetKleur) => void;
  onVerwijderActiviteit: (activiteit: ActiviteitMetKleur) => void;
  onKoppelSubdoel: (leerplandoelCode: string) => void;
  onOntkoppelSubdoel: (subdoelId: string) => void;
  onKoppelActiviteitdoel: (activiteitId: string, leerplandoelCode: string) => void;
  koppelenBezig?: boolean;
}) {
  const activiteiten = subthema.activiteiten as ActiviteitMetKleur[];

  return (
    <article className="rounded-kaart border border-lijn bg-kaart p-4 shadow-licht">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-display text-sectie text-inkt">{subthema.naam}</h3>
          {/* Klas and leeftijd together, because neither alone identifies the derivation. */}
          <p className="mono mt-0.5 text-meta text-inkt-zwak">
            {klasNaam ? `${klasNaam} · ` : ""}
            {subthema.leeftijd} · {telWoord(subthema.duurWeken, "thema.eenWeek", "thema.weken")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={onBewerk}>
            {t("themabeheer.bewerk")}
          </Knop>
          <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={onVerwijder}>
            {t("themabeheer.verwijder")}
          </Knop>
        </div>
      </header>

      {subthema.onderzoeksvragen.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {subthema.onderzoeksvragen.map((vraag) => (
            <li key={vraag.id} className="border-l-2 border-lijn-sterk pl-3">
              <p className="text-body text-inkt">{vraag.vraag}</p>
              {vraag.probleemstelling ? (
                <p className="text-meta text-inkt-zacht">{vraag.probleemstelling}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Blok
        titel={telWoord(subthema.subdoelen.length, "thema.eenSubdoel", "thema.subdoelen")}
        actie={
          <Doelkoppelaar
            onKies={onKoppelSubdoel}
            bezig={koppelenBezig}
            alGekozen={subthema.subdoelen.map((s) => s.koppeling.leerplandoelCode)}
          />
        }
      >
        {subthema.subdoelen.length === 0 ? (
          <p className="text-meta text-inkt-zwak">{t("thema.geenSubdoelen")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {subthema.subdoelen.map((subdoel) => (
              <li key={subdoel.id} className="flex items-center gap-2">
                <span className="mono min-w-0 truncate text-meta text-inkt">
                  {subdoel.koppeling.leerplandoelCode}
                </span>
                <Statusmerk status={subdoel.koppeling.status} className="ml-auto" />
                <Ontkoppel
                  label={t("activiteit.ontkoppel", { code: subdoel.koppeling.leerplandoelCode })}
                  bezig={koppelenBezig}
                  onClick={() => onOntkoppelSubdoel(subdoel.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Blok>

      <Blok
        titel={telWoord(activiteiten.length, "thema.eenActiviteit", "thema.activiteiten")}
        actie={
          <Knop rang="rustig" className="h-9 min-h-9 px-3 text-meta" onClick={onNieuweActiviteit}>
            <IcoonPlus aria-hidden="true" className="h-4 w-4" />
            {t("activiteit.toevoegen")}
          </Knop>
        }
      >
        {activiteiten.length === 0 ? (
          <p className="text-meta text-inkt-zwak">{t("activiteit.geen")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activiteiten.map((activiteit) => (
              <li key={activiteit.id}>
                <Activiteitregel
                  activiteit={activiteit}
                  onBewerk={() => onBewerkActiviteit(activiteit)}
                  onVerwijder={() => onVerwijderActiviteit(activiteit)}
                  onKoppelDoel={(code) => onKoppelActiviteitdoel(activiteit.id, code)}
                  koppelenBezig={koppelenBezig}
                />
              </li>
            ))}
          </ul>
        )}
      </Blok>
    </article>
  );
}

/**
 * A titled block inside the card, with an optional action.
 *
 * The title already carries its own count, phrased ("3 subdoelen"), because a number in a separate
 * slot beside an uppercase label reads as a badge and this is a sentence about what is below it.
 */
function Blok({ titel, actie, children }: { titel: string; actie?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-4 border-t border-lijn pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="mono text-meta text-inkt-zwak">{titel}</h4>
        {actie}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * One activiteit.
 *
 * The teacher's colour is a wash on the row plus its name in words, never the wash alone. The soort
 * and the goal codes are plain text: they are facts about the activiteit, and only the controls do
 * anything.
 *
 * **The doelen live in their own zone below a hairline, and that zone is always there.** It used to
 * be a line of codes that appeared when there were codes and vanished when there were not, which
 * made the question a teacher actually scans this list for ("which of these still needs a doel?")
 * the one question the list refused to answer. Now the state is stated in both directions, in a
 * fixed place, and the control that fixes it stands next to it: noticing the gap and closing it are
 * the same glance, instead of a trip through the bewerk-blad.
 */
function Activiteitregel({
  activiteit,
  onBewerk,
  onVerwijder,
  onKoppelDoel,
  koppelenBezig,
}: {
  activiteit: ActiviteitMetKleur;
  onBewerk: () => void;
  onVerwijder: () => void;
  onKoppelDoel: (leerplandoelCode: string) => void;
  koppelenBezig?: boolean;
}) {
  const kleur = activiteit.kleur as Activiteitkleur | null;
  const codes = activiteit.doelkoppelingen.map((k) => k.leerplandoelCode);

  return (
    <div
      className={cn(
        "rounded-veld border px-3 py-2",
        kleur ? KLEURVLAK[kleur] : "border-lijn bg-vlak-diep/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-inkt">{activiteit.naam}</p>
          <p className="mt-0.5 text-meta text-inkt-zacht">
            {t(`activiteitsoort.${activiteit.activiteitType}`)}
            {activiteit.hoek ? ` · ${activiteit.hoek}` : ""}
            {kleur ? ` · ${t(kleurSleutel(kleur))}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={onBewerk}>
            {t("themabeheer.bewerk")}
          </Knop>
          <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={onVerwijder}>
            {t("themabeheer.verwijder")}
          </Knop>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-lijn/70 pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Doelmerk aantal={codes.length} />
          {codes.length > 0 ? (
            <span className="mono min-w-0 truncate text-meta text-inkt-zacht">{codes.join(" · ")}</span>
          ) : null}
        </div>
        <Doelkoppelaar
          onKies={onKoppelDoel}
          bezig={koppelenBezig}
          alGekozen={codes}
          toelichting={t("activiteit.koppelAan", { naam: activiteit.naam })}
        />
      </div>
    </div>
  );
}

/** A small remove control for a goal link, next to the code it removes. */
function Ontkoppel({ label, bezig, onClick }: { label: string; bezig?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={bezig}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
    >
      <span aria-hidden="true" className="block h-[1.5px] w-3.5 bg-current" />
    </button>
  );
}
