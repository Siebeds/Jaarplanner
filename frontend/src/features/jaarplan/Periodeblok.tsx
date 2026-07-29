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
  // A rejected thema is still SHOWN — a teacher should see what they threw out, and the status badge renders
  // it struck through — but it must not count toward "te vol": nothing is taught in this period on its
  // account. The backend applies the same rule via `Themaplaatsing.IsGepland` (E3-02 code review).
  const gepland = plaatsingen.filter((p) => p.status !== "Geweigerd");
  const teVol = gepland.length >= VOORLOPIGE_TE_VOL_DREMPEL;

  return (
    <li
      /* Width proportional to teaching days — the ribbon's central claim (ADR-0013, Art. IX.3).
         `flexGrow` is the one inline style here because the value is data, not design. */
      style={{ flexGrow: blok.aantalOpenDagen }}
      className={`flex min-w-[9rem] shrink-0 basis-0 flex-col rounded-lg border bg-slate-50 ${
        teVol ? "border-amber-500 bg-amber-50" : "border-slate-200"
      }`}
    >
      <div className="border-b border-slate-200 px-2 py-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          {t("kalender.periode", { ordinaal: blok.ordinaal })}
        </h3>
        {/* `text-muted-foreground` (a design token, deliberately darkened in index.css) rather than
            `slate-400`/`slate-500`: those measure 2.45:1 and 4.35:1 against these tinted backgrounds at
            12px, below the 4.5:1 WCAG 2.2 AA threshold. jsdom cannot evaluate contrast, so the axe test
            does not catch this — it has to be got right by construction (ADR-0017 §2/§4). */}
        <p className="text-xs text-muted-foreground">
          {formatteerPeriode(blok.start, blok.eind)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("kalender.weken", { weken: formatteerWeken(blok.aantalOpenDagen) })}
        </p>

        {teVol && (
          <>
            {/* Icon AND word, never colour alone (Art. XII, FR-6.4). */}
            <p className="mt-1 text-xs font-medium text-amber-900">
              <span aria-hidden="true">▲</span>{" "}
              {t("kalender.teVol", { aantal: gepland.length })}
            </p>
            {/* Visible, not a `title` tooltip. The threshold is a placeholder for review question C, and a
                disclosure that only appears on hover is invisible on touch, unreachable by keyboard and
                usually unread by screen readers — i.e. not a disclosure at the session it exists for. */}
            <p className="mt-0.5 text-xs text-amber-900">{t("kalender.teVolUitleg")}</p>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {plaatsingen.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">{t("kalender.legeperiode")}</p>
        ) : (
          plaatsingen.map((plaatsing) => (
            <Themakaart key={plaatsing.id} plaatsing={plaatsing} />
          ))
        )}
      </div>
    </li>
  );
}
