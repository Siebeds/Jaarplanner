import { useId, type ReactNode, type Ref } from "react";
import { Link } from "react-router-dom";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonPlus, IcoonVink } from "../../components/Iconen";
import { dagMaandVoluit, periodeVoluit, valtBinnen, vandaag } from "../../lib/datum";
import { t } from "../../i18n";
import type { HoekWeergave, SubthemaperiodeVerrijkingen } from "./gegevens";
import { Toevoegtegel } from "./Toevoegtegel";
import {
  aantalVerrijkt,
  reeksSleutel,
  verrijkingVan,
  type Verrijkingenweek,
  type Verrijkingsreeks,
  type Volgendsubthema,
} from "./verrijkingenweek";

/**
 * The hoekenfiches in the side panel, per subthema (owner, 2026-09-23, FB-098, variant A).
 *
 * **The subthema is the block, not a line on every corner.** Each subthema running in the agenda's week gets one block:
 * its days, its name, and how many corners already have a verrijking for it, as a bar AND as "1 van 6", so the stand
 * never hangs on the bar alone. Under it one row per corner, with its verrijking and a tick, or the offer to write one.
 * Two subthema's in one week are two blocks, in the order they start.
 *
 * **A corner's description is not here.** A teacher knows her own corners; it stays in the corner's fiche, the sheet a
 * row opens (`Hoekverrijkingblad`). Dropping it is what lets six corners stand on a laptop without scrolling.
 *
 * **What comes next, under the blocks:** the klas's next subthema after this week, with its stand and "Al voorbereiden"
 * for whoever may plan the klas. Absent when nothing is planned after it, and while that is not known.
 */
export function Hoekenlijst({
  laadt,
  mislukt,
  hoeken,
  week,
  volgende,
  magPlannen,
  tegelRef,
  rijId,
  onKiesHoek,
  onVoorbereiden,
  voorbereidenId,
  onNieuw,
}: {
  laadt: boolean;
  /** The corners' read failed and nothing is loaded. Not the same as a klas without corners (antagonist, E10-03). */
  mislukt: boolean;
  hoeken: readonly HoekWeergave[];
  week: Verrijkingenweek;
  volgende: Volgendsubthema;
  magPlannen: boolean;
  tegelRef: Ref<HTMLButtonElement>;
  /** A row's element id, per block and corner, so focus can go back to the row she pressed once its sheet closes. */
  rijId: (blok: string, hoekId: string) => string;
  onKiesHoek: (hoekId: string, terugId: string) => void;
  onVoorbereiden: (reeks: Verrijkingsreeks, periodes: readonly SubthemaperiodeVerrijkingen[]) => void;
  /** The id of the "Al voorbereiden" button, for focus to return to. */
  voorbereidenId: string;
  onNieuw: () => void;
}) {
  if (laadt) return <Laadlijst rijen={3} />;

  if (mislukt) {
    return (
      <p role="alert" className="text-meta text-attentie-inkt">
        {t("hoekenpaneel.mislukt")}
      </p>
    );
  }

  // The same `div` with the tile as a keyed child in every branch below, so when a klas's first corner turns the empty
  // branch into the list, React keeps the tile's node and the focus `sluitBlad` returned to it.
  const tegel = magPlannen ? (
    <Toevoegtegel key="toevoegen" ref={tegelRef} label={t("hoeken.toevoegen")} onKies={onNieuw} />
  ) : null;

  if (hoeken.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-meta text-inkt-zacht">{t("hoekenpaneel.geenHoeken")}</p>
        {tegel}
        {magPlannen ? (
          <Link
            to="/instellingen/hoeken"
            className="text-meta font-medium text-accent underline-offset-2 hover:underline"
          >
            {t("hoekenpaneel.naarInstellingen")}
          </Link>
        ) : null}
      </div>
    );
  }

  const hoekIds = hoeken.map((hoek) => hoek.id);

  return (
    <div className="flex flex-col gap-4">
      {week.status !== "klaar" ? (
        // While the week is out, or could not be read, the corners without a word under them: a row may not say
        // "nothing written" on the strength of a read that has not answered.
        <Hoekrijen hoeken={hoeken} blok="week" rijId={rijId} onKiesHoek={onKiesHoek} />
      ) : week.reeksen.length === 0 ? (
        <div>
          <p className="text-meta text-inkt-zacht">{t("hoekenpaneel.geenSubthemaInWeek")}</p>
          <Hoekrijen hoeken={hoeken} blok="week" rijId={rijId} onKiesHoek={onKiesHoek} />
        </div>
      ) : (
        week.reeksen.map((reeks) => (
          <Subthemablok
            key={reeksSleutel(reeks)}
            kop={
              // "Nu" only while today is one of its days: the agenda may stand in any week of the year.
              valtBinnen(vandaag(), reeks.van, reeks.tot)
                ? t("hoekenpaneel.nu", { periode: periodeVoluit(reeks.van, reeks.tot) })
                : periodeVoluit(reeks.van, reeks.tot)
            }
            reeks={reeks}
            aantal={aantalVerrijkt(week.periodes, reeks, hoekIds)}
            totaal={hoeken.length}
          >
            <Hoekrijen
              hoeken={hoeken}
              blok={reeksSleutel(reeks)}
              rijId={rijId}
              onKiesHoek={onKiesHoek}
              verrijking={(hoekId) => verrijkingVan(week.periodes, reeks, hoekId) ?? null}
              magPlannen={magPlannen}
            />
          </Subthemablok>
        ))
      )}

      {volgende.status === "klaar" && volgende.reeks ? (
        <Hierna
          reeks={volgende.reeks}
          aantal={aantalVerrijkt(volgende.periodes, volgende.reeks, hoekIds)}
          totaal={hoeken.length}
          onVoorbereiden={magPlannen ? () => onVoorbereiden(volgende.reeks!, volgende.periodes) : null}
          voorbereidenId={voorbereidenId}
        />
      ) : null}

      {tegel}
    </div>
  );
}

/** One subthema of the week: its days, its name, its stand, and its corners. */
function Subthemablok({
  kop,
  reeks,
  aantal,
  totaal,
  children,
}: {
  kop: string;
  reeks: Verrijkingsreeks;
  aantal: number;
  totaal: number;
  children: ReactNode;
}) {
  const kopId = useId();
  return (
    <section aria-labelledby={kopId} className="rounded-veld border border-lijn px-3 pt-3">
      <p className="text-micro text-inkt-zacht">{kop}</p>
      <h3 id={kopId} className="mt-0.5 text-body font-semibold text-inkt">
        {reeks.subthemaNaam}
      </h3>
      <Stand aantal={aantal} totaal={totaal} balk />
      {children}
    </section>
  );
}

/** "1 van 6", with a bar in a block of this week. The number is always there: the bar alone would be colour alone. */
function Stand({ aantal, totaal, balk = false }: { aantal: number; totaal: number; balk?: boolean }) {
  const deel = totaal === 0 ? 0 : Math.round((aantal / totaal) * 100);
  return (
    <div className={balk ? "mb-1 mt-2 flex items-center gap-2.5" : "shrink-0"}>
      {balk ? (
        <div aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-vlak-diep">
          <div className="h-1.5 rounded-full bg-inkt" style={{ width: `${deel}%` }} />
        </div>
      ) : null}
      <p className="shrink-0 text-micro font-medium tabular-nums text-inkt-zacht">
        <span aria-hidden="true">{t("hoekenpaneel.stand", { aantal, totaal })}</span>
        <span className="sr-only">{t("hoekenpaneel.standVoluit", { aantal, totaal })}</span>
      </p>
    </div>
  );
}

/**
 * The corners as rows, each one button that opens the corner's fiche. Under the name, when a subthema is given, what
 * the corner holds while it runs, or the offer to write it; without one, the name alone.
 */
function Hoekrijen({
  hoeken,
  blok,
  rijId,
  onKiesHoek,
  verrijking,
  magPlannen = false,
}: {
  hoeken: readonly HoekWeergave[];
  blok: string;
  rijId: (blok: string, hoekId: string) => string;
  onKiesHoek: (hoekId: string, terugId: string) => void;
  verrijking?: (hoekId: string) => string | null;
  magPlannen?: boolean;
}) {
  return (
    <ul className="mt-1">
      {hoeken.map((hoek) => {
        const id = rijId(blok, hoek.id);
        const tekst = verrijking?.(hoek.id);
        return (
          <li key={hoek.id} className="border-t border-lijn first:border-t-0">
            <button
              id={id}
              type="button"
              onClick={() => onKiesHoek(hoek.id, id)}
              className="-mx-1.5 block w-[calc(100%+0.75rem)] rounded-veld px-1.5 py-2 text-left transition-colors duration-150 hover:bg-vlak"
            >
              <span className="block text-meta font-medium text-inkt">{hoek.naam}</span>
              {verrijking === undefined ? null : tekst ? (
                <span className="mt-0.5 flex gap-1.5 text-meta leading-snug text-inkt">
                  <IcoonVink aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-inkt-zacht" />
                  <span className="min-w-0">
                    <span className="sr-only">{t("hoekenpaneel.verrijkt")} </span>
                    <span className="line-clamp-2 whitespace-pre-line">{tekst}</span>
                  </span>
                </span>
              ) : (
                <span className="mt-0.5 flex items-center gap-1 text-meta text-inkt-zacht">
                  {magPlannen ? <IcoonPlus aria-hidden="true" className="h-3 w-3 shrink-0" /> : null}
                  {magPlannen ? t("hoekenpaneel.verrijkingInvullen") : t("hoekenpaneel.geenVerrijking")}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The subthema after this week: from when, its name, its stand, and for a planner the way to prepare it now. */
function Hierna({
  reeks,
  aantal,
  totaal,
  onVoorbereiden,
  voorbereidenId,
}: {
  reeks: Verrijkingsreeks;
  aantal: number;
  totaal: number;
  onVoorbereiden: (() => void) | null;
  voorbereidenId: string;
}) {
  const kopId = useId();
  return (
    <section aria-labelledby={kopId} className="border-t border-lijn pt-3">
      <p className="text-micro text-inkt-zacht">{t("hoekenpaneel.hierna", { datum: dagMaandVoluit(reeks.van) })}</p>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <h3 id={kopId} className="min-w-0 text-meta font-semibold text-inkt">
          {reeks.subthemaNaam}
        </h3>
        <Stand aantal={aantal} totaal={totaal} />
      </div>
      {onVoorbereiden ? (
        <button
          type="button"
          id={voorbereidenId}
          onClick={onVoorbereiden}
          className="-mx-1.5 mt-1 inline-flex min-h-8 items-center gap-1 rounded-veld px-1.5 text-meta font-medium text-inkt underline-offset-2 transition-colors duration-150 hover:bg-vlak hover:underline"
        >
          {t("hoekenpaneel.alVoorbereiden")}
        </button>
      ) : null}
    </section>
  );
}
