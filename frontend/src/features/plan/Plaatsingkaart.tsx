import { useState } from "react";
import { Link } from "react-router-dom";
import type { Themaplaatsing } from "../../lib/types";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Veld } from "../../components/ui/Veld";
import { periode, verschuif, volleDag } from "../../lib/datum";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * One placed thema, and everything a teacher can do to it (FR-7, ADR-0049): its days, a week earlier or later, the
 * verdict on a proposal, the lock, and removing it.
 *
 * **The days are two fields and a button**, not fields that save on change: a date field fires on every digit typed,
 * and a half-typed date would move the thema. A week earlier or later is the keyboard's way to do what a drag does.
 *
 * **Rejecting a proposal removes it** (ADR-0049 R12), and the card says so before the button is pressed.
 *
 * **All of it is the klas's planning** (E6-02, ADR-0030 §3, R7). For a gebruiker without that right the card is what
 * the placement is: its days, its status, its motivation, and "Vergrendeld" as a word when it is locked.
 */
export function Plaatsingkaart({
  plaatsing,
  plaatsingen,
  eersteSchooldag,
  laatsteSchooldag,
  magBewerken,
  bezig,
  onAanvaard,
  onWeiger,
  onVergrendel,
  onBewaarDatums,
  onVerschuif,
  onVerwijder,
}: {
  plaatsing: Themaplaatsing;
  /** Every placement of the plan, for the other parts of this thema. */
  plaatsingen: Themaplaatsing[];
  eersteSchooldag: string;
  laatsteSchooldag: string;
  /** Whether this gebruiker may change this klas's plan (`mag.klasplanningBewerken`). */
  magBewerken: boolean;
  bezig: boolean;
  onAanvaard: () => void;
  onWeiger: () => void;
  onVergrendel: (vergrendeld: boolean) => void;
  onBewaarDatums: (van: string, tot: string) => void;
  onVerschuif: (van: string) => void;
  onVerwijder: () => void;
}) {
  const [van, setVan] = useState(plaatsing.van);
  const [tot, setTot] = useState(plaatsing.tot);
  const teBeoordelen = plaatsing.status === "Voorgesteld";
  const reeks = plaatsing.reeks;
  const andereDelen =
    reeks && reeks.aantalDelen > 1
      ? plaatsingen
          .filter(
            (p) => p.id !== plaatsing.id && p.themaId === plaatsing.themaId && p.reeks?.reeksVan === reeks.reeksVan,
          )
          .sort((a, b) => (a.van < b.van ? -1 : 1))
      : [];
  const ongewijzigd = van === plaatsing.van && tot === plaatsing.tot;
  const ongeldig = van === "" || tot === "" || tot < van;

  return (
    <article
      aria-label={plaatsing.themaNaam}
      className={cn(
        "rounded-kaart border bg-kaart p-4 shadow-licht transition-opacity sm:p-5",
        plaatsing.isVervallen ? "border-attentie" : "border-accent",
        bezig && "opacity-60",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-micro uppercase text-inkt-zwak">{t("plan.thema")}</p>
          <h2 className="font-display text-sectie text-inkt">{plaatsing.themaNaam}</h2>
          <p className="mono mt-0.5 text-meta text-inkt-zwak">
            {periode(plaatsing.van, plaatsing.tot)}
            {reeks && reeks.aantalDelen > 1 ? ` · ${t("plan.deel", { deel: reeks.deel, aantal: reeks.aantalDelen })}` : ""}
            {" · "}
            {telWoord(plaatsing.doelcodes.length, "plan.eenDoel", "plan.doelen")}
          </p>
        </div>
        <Statusmerk status={plaatsing.status} />
      </header>

      <p className="mt-2 text-meta text-inkt-zacht">
        {t("plan.duur", { duur: telWoord(plaatsing.duurWeken, "plan.eenWeek", "plan.weken") })}
      </p>

      {plaatsing.isVervallen ? (
        <p className="mt-3 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {t("plan.vervallen")}
        </p>
      ) : null}

      {reeks?.eindeAangepast ? (
        <p className="mt-3 rounded-veld border border-dashed border-attentie px-3 py-2 text-meta text-attentie-inkt">
          {t("plan.eindeAangepast", { weken: reeks.weken, duur: plaatsing.duurWeken })}
          {reeks.stoptBijEindeSchooljaar ? ` ${t("plan.stoptBijEinde")}` : ""}
        </p>
      ) : null}

      {andereDelen.length > 0 ? (
        <div className="mt-3 text-meta text-inkt-zacht">
          <p>{t("plan.andereDelen")}</p>
          <ul className="mono mt-1 flex flex-wrap gap-x-4 gap-y-1 text-inkt">
            {andereDelen.map((deel) => (
              <li key={deel.id}>{periode(deel.van, deel.tot)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {plaatsing.aiMotivatie ? (
        <p className="mt-3 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">
          {plaatsing.aiMotivatie}
        </p>
      ) : null}

      {!magBewerken ? (
        plaatsing.vergrendeld ? <p className="mt-3 text-meta text-inkt-zacht">{t("plan.vergrendeld")}</p> : null
      ) : (
        <>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (!ongewijzigd || plaatsing.isVervallen) onBewaarDatums(van, tot);
            }}
          >
            <Veld label={t("plan.begindatum")}>
              {(id) => (
                <Invoer
                  id={id}
                  type="date"
                  value={van}
                  min={eersteSchooldag}
                  max={laatsteSchooldag}
                  onChange={(event) => setVan(event.target.value)}
                />
              )}
            </Veld>
            <Veld label={t("plan.einddatum")}>
              {(id) => (
                <Invoer
                  id={id}
                  type="date"
                  value={tot}
                  min={van || eersteSchooldag}
                  max={laatsteSchooldag}
                  onChange={(event) => setTot(event.target.value)}
                />
              )}
            </Veld>
            <Knop
              type="submit"
              rang="hoofd"
              disabled={bezig || ongeldig || (ongewijzigd && !plaatsing.isVervallen)}
            >
              {t("plan.bewaarDatums")}
            </Knop>
          </form>

          {ongeldig && van !== "" && tot !== "" ? (
            <p role="alert" className="mt-2 text-meta font-medium text-attentie-inkt">
              {t("tijdraster.eindeVoorBegin")}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Knop disabled={bezig} onClick={() => onVerschuif(verschuif(plaatsing.van, -7))}>
              {t("plan.weekVroeger")}
            </Knop>
            <Knop disabled={bezig} onClick={() => onVerschuif(verschuif(plaatsing.van, 7))}>
              {t("plan.weekLater")}
            </Knop>

            {/* A toggle button rather than a checkbox: a 16px checkbox is under WCAG 2.2 AA 2.5.8's 24px floor. The
                pressed state travels three ways: aria-pressed, the dot going from hollow to filled, and the border. */}
            <button
              type="button"
              aria-pressed={plaatsing.vergrendeld}
              disabled={bezig}
              onClick={() => onVergrendel(!plaatsing.vergrendeld)}
              className={cn(
                "flex h-raak items-center gap-2 rounded-veld border px-3 text-meta transition-colors duration-150",
                plaatsing.vergrendeld
                  ? "border-accent bg-accent-zacht text-accent"
                  : "border-lijn text-inkt-zacht hover:border-lijn-veld",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2.5 w-2.5 rounded-full border",
                  plaatsing.vergrendeld ? "border-accent bg-accent" : "border-lijn-veld bg-transparent",
                )}
              />
              {t("plan.vergrendeld")}
            </button>
          </div>

          {teBeoordelen ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Knop rang="hoofd" disabled={bezig} onClick={onAanvaard}>
                {t("plan.aanvaard")}
              </Knop>
              <Knop disabled={bezig} onClick={onWeiger}>
                {t("plan.weiger")}
              </Knop>
              <p className="text-meta text-inkt-zacht">{t("plan.weigerUitleg")}</p>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-lijn pt-3">
        <Link
          to={`/agenda/dag/${plaatsing.van}`}
          className="inline-flex h-raak items-center rounded-veld border border-lijn-veld px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
          aria-label={`${t("plan.openInAgenda")}: ${volleDag(plaatsing.van)}`}
        >
          {t("plan.openInAgenda")}
        </Link>
        {magBewerken ? (
          <Knop rang="stil" className="ml-auto" disabled={bezig} onClick={onVerwijder}>
            {t("plan.verwijder")}
          </Knop>
        ) : null}
      </div>
    </article>
  );
}
