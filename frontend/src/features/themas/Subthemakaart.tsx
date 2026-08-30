import type { ReactNode } from "react";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Doelmerk } from "../../components/ui/Doelmerk";
import { Bewerkknop, Verwijderknop } from "../../components/ui/Rijknoppen";
import { Toevoegknop } from "../../components/ui/Toevoegknop";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import type { SubthemaWeergave } from "../../lib/types";
import { KLEURVLAK, kleurSleutel, type Activiteitkleur } from "../activiteiten/kleuren";
import type { ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import { Doelkoppelaar } from "../activiteiten/Doelkoppelaar";

/**
 * One age's derivation of a thema, with everything that hangs under it.
 *
 * **Nothing static is shaped like a button.** Codes, soorten and words are text; only what acts
 * carries a surface. An earlier version put woordenschat, activiteiten and doelcodes all in rounded
 * pills, which made a card of read-only facts look like a toolbar.
 *
 * **And then the controls themselves became the wall** (owner, 2026-08-30: "veel te veel knoppen").
 * Six buttons spelling "Bewerken" and "Verwijderen" ran down one card, in the same type size as the
 * content between them. They are now the two icons every other tool uses for those two verbs, with
 * the words moved into `aria-label`, and an activiteit is edited by pressing the activiteit.
 *
 * **The nesting is the information.** A subthema owns onderzoeksvragen, and an activiteit may point
 * at one of them; an activiteit owns its own goal links, and the subthema owns its subdoelen. Those
 * are four different things and they are four visibly different blocks, because a teacher deciding
 * where to hang a doel needs to see which level they are on.
 */
export function Subthemakaart({
  subthema,
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
          {/* The leeftijd alone, and NAMED. It used to be preceded by a klas name, which stopped
              existing on 2026-08-30: a subthema is scoped by age and holds for every klas that
              teaches it (Art. IX.2), so naming one of those classes here would have picked a winner.

              What is new is the label in front of it. The line read "5-6 · 2 weken" in one grey
              monospace run, in which "5-6" is indistinguishable from a second count sitting next to
              "2 weken", and the values really are free text, from "K3" to "8-9". Four small letters
              remove the only genuine ambiguity on this card. */}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-micro uppercase tracking-wide text-inkt-zwak">
              {t("subthemabeheer.leeftijd")}
            </span>
            <span className="mono text-meta font-medium text-inkt">{subthema.leeftijd}</span>
            <span aria-hidden="true" className="text-inkt-zwak">
              ·
            </span>
            <span className="text-meta text-inkt-zacht">
              {telWoord(subthema.duurWeken, "thema.eenWeek", "thema.weken")}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Bewerkknop label={t("subthemabeheer.bewerkAria", { naam: subthema.naam })} onClick={onBewerk} />
          <Verwijderknop
            label={t("subthemabeheer.verwijderAria", { naam: subthema.naam })}
            onClick={onVerwijder}
          />
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
        actie={<Toevoegknop label={t("activiteit.toevoegen")} onClick={onNieuweActiviteit} />}
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
      <h4 className="mono text-meta text-inkt-zwak">{titel}</h4>
      {/* Under the title, like the sections on the screen around it. It was right-aligned on the
          title row, which put "Activiteit toevoegen" a full card width away from the words it
          belongs to and made every block header a two-object line to parse. Same change, same
          reason, as `Sectie`: heading, then what you can do, then what is there. */}
      {actie ? <div className="mt-2 flex flex-wrap items-center gap-2">{actie}</div> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * One activiteit.
 *
 * **The row itself opens the activiteit** (owner, 2026-08-30). It used to carry a "Bewerken" button
 * beside a "Verwijderen" one, so a list a teacher scans put two words on every line, and the obvious
 * gesture, pressing the thing you want to change, did nothing at all.
 *
 * It is an overlay button BEHIND the content rather than a button wrapped around it, the same
 * construction the month cell uses and for the same reason: this row contains a delete control and a
 * goal picker, a button inside a button is invalid and unreachable by keyboard, and everything above
 * the overlay that is not itself pressable lets its clicks fall through to it.
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
        "relative rounded-veld border px-3 py-2",
        kleur ? KLEURVLAK[kleur] : "border-lijn bg-vlak-diep/40",
      )}
    >
      {/* The hover fill is deliberately faint. This list runs to twenty rows on a real thema, and a
          row that lights up under a pointer merely passing over it is a row that keeps claiming to
          be the one you were looking for. Ink at 3.5% reads as "this responds" and no more. */}
      <button
        type="button"
        onClick={onBewerk}
        aria-label={t("activiteit.bewerkAria", { naam: activiteit.naam })}
        className="absolute inset-0 z-0 rounded-veld transition-colors duration-150 hover:bg-inkt/[0.035]"
      />

      {/* `pointer-events-none` so the name, the soort and the codes hand their clicks down to the
          overlay; every control above it turns them back on for itself. */}
      <div className="pointer-events-none relative z-10 flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-inkt">{activiteit.naam}</p>
          <p className="mt-0.5 text-meta text-inkt-zacht">
            {t(`activiteitsoort.${activiteit.activiteitType}`)}
            {activiteit.hoek ? ` · ${activiteit.hoek}` : ""}
            {kleur ? ` · ${t(kleurSleutel(kleur))}` : ""}
          </p>
        </div>
        <Verwijderknop
          className="pointer-events-auto"
          label={t("activiteit.verwijderAria", { naam: activiteit.naam })}
          onClick={onVerwijder}
        />
      </div>

      <div className="pointer-events-none relative z-10 mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-lijn/70 pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Doelmerk aantal={codes.length} />
          {codes.length > 0 ? (
            <span className="mono min-w-0 truncate text-meta text-inkt-zacht">{codes.join(" · ")}</span>
          ) : null}
        </div>
        {/* `contents` so the wrapper adds no box of its own: the koppelaar's open state is a
            full-width panel that has to stay a direct flex child to take its own line. */}
        <div className="pointer-events-auto contents">
          <Doelkoppelaar
            compact
            onKies={onKoppelDoel}
            bezig={koppelenBezig}
            alGekozen={codes}
            toelichting={t("activiteit.koppelAan", { naam: activiteit.naam })}
          />
        </div>
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
