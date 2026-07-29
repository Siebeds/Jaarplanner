import { t } from "../../i18n";
import { Themakaart } from "./Themakaart";
import { formatteerPeriode, formatteerWeken } from "./kalenderFormat";
import type { Planningsblok, Themaplaatsing } from "./types";

/**
 * The provisional "te vol" threshold, in thema's per period.
 *
 * **This is a placeholder for review question C, not a decision.** The approved wireframe flags at 3,
 * and question C asks whether "te vol" should count thema's, count goals, or scale with the period's
 * length — a 6-week period is genuinely wider than a 4-week one and can hold more before it looks full.
 * It is a named constant in one place, and the UI says out loud that the threshold is provisional, so
 * the review can change it without hunting for a magic number (see the E3-06 obligations in the backlog:
 * where the draft must pick something to be clickable, pick visibly and reversibly).
 */
export const VOORLOPIGE_TE_VOL_DREMPEL = 3;

export interface PeriodeblokProps {
  blok: Planningsblok;
  plaatsingen: Themaplaatsing[];
}

export function Periodeblok({ blok, plaatsingen }: PeriodeblokProps) {
  const teVol = plaatsingen.length >= VOORLOPIGE_TE_VOL_DREMPEL;

  return (
    <li
      /* Width proportional to teaching days — the ribbon's central claim (ADR-0013, Art. IX.3).
         `flexGrow` is the one inline style here because the value is data, not design. */
      style={{ flexGrow: blok.aantalLesdagen }}
      className={`flex min-w-[9rem] shrink-0 basis-0 flex-col rounded-lg border bg-slate-50 ${
        teVol ? "border-amber-500 bg-amber-50" : "border-slate-200"
      }`}
    >
      <div className="border-b border-slate-200 px-2 py-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {t("kalender.periode", { ordinaal: blok.ordinaal })}
        </h3>
        <p className="text-xs text-slate-500">
          {formatteerPeriode(blok.start, blok.eind)}
        </p>
        <p className="text-xs text-slate-400">
          {t("kalender.weken", { weken: formatteerWeken(blok.aantalLesdagen) })}
        </p>

        {teVol && (
          /* Icon AND word, never colour alone (Art. XII, FR-6.4). */
          <p
            className="mt-1 text-xs font-medium text-amber-800"
            title={t("kalender.teVolUitleg")}
          >
            <span aria-hidden="true">▲</span>{" "}
            {t("kalender.teVol", { aantal: plaatsingen.length })}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {plaatsingen.length === 0 ? (
          <p className="text-xs italic text-slate-400">{t("kalender.legeperiode")}</p>
        ) : (
          plaatsingen.map((plaatsing) => (
            <Themakaart key={plaatsing.id} plaatsing={plaatsing} />
          ))
        )}
      </div>
    </li>
  );
}
