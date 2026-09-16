import { useState } from "react";
import { Link } from "react-router-dom";
import type { Themaplaatsing } from "../../lib/types";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Veld } from "../../components/ui/Veld";
import { periode, volleDag } from "../../lib/datum";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * One placed thema, and everything a teacher can do to it (FR-7, ADR-0049): its days, the verdict on a proposal, and
 * removing it. Less is more (owner, 2026-09-16): the begin and end date do what week buttons did, and a changed end is
 * not marked.
 *
 * **The days are two fields and a button**, not fields that save on change: a date field fires on every digit typed,
 * and a half-typed date would move the thema. The fields are also the keyboard's way to do what a drag does.
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
  onBewaarDatums,
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
  onBewaarDatums: (van: string, tot: string) => void;
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

      {reeks?.stoptBijEindeSchooljaar ? (
        <p className="mt-2 text-meta text-inkt-zacht">{t("plan.stoptBijEinde")}</p>
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
            className="mt-4 flex flex-wrap items-end gap-3"
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
                  className="w-40"
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
                  className="w-40"
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
