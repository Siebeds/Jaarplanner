import { t } from "../../i18n";
import { periode as periodeTekst } from "../../lib/datum";
import { cn } from "../../lib/cn";
import { themaClausule, themaLabel, vakOpDag, type Themavak } from "./themavakken";

/**
 * Where the agenda's anchored day sits in the school year, as a caption under the heading.
 *
 * **It is a caption and not a row of chips.** The owner read the filled pills that used to sit beside
 * the heading as buttons (2026-09-11), and nothing in them can be pressed. So there is no fill and no
 * radius here, only one neutral rule before the thema, and the size and ink step down from the heading
 * instead of sitting level with it.
 *
 * **The period and its thema are facts about one day, so they are only printed where the view IS one
 * day.** They used to be printed always, derived from the anchored day, above a grid showing a whole
 * month. On this school year the periods end on the 1st and paging a month keeps the day of the month,
 * so a teacher who paged from september stood on 1 november and read "Periode 2 okt - 1 nov" over a grid
 * of which that period owned not one day. In the month and week views the answer is on the days
 * instead, where it can differ per day: `Themastroken`.
 *
 * **Every sentence here is printed only where its own condition holds** (the E5-03 rule), because a day
 * without a period is not necessarily "between two periods": it may lie outside the school year, before
 * its first period or after its last, or the rooster may simply not have arrived yet.
 */
export function Dagonderschrift({
  weekLabel,
  dagweergave,
  datum,
  schooljaar,
  vakken,
  planGeladen,
}: {
  /**
   * Null wherever one week number would name only part of what is in view: the month view, and a
   * phone's three-day window that crosses a Monday.
   */
  weekLabel: string | null;
  dagweergave: boolean;
  datum: string;
  /** Undefined while the rooster is still loading. */
  schooljaar: { start: string; eind: string; blokken: readonly { start: string; eind: string }[] } | undefined;
  vakken: readonly Themavak[];
  /** False while the jaarplan loads or failed to: an empty thema list then means "unknown", not "none". */
  planGeladen: boolean;
}) {
  const vak = dagweergave ? vakOpDag(vakken, datum) : undefined;
  const plaats = dagweergave && !vak ? plaatsZonderPeriode(datum, schooljaar) : null;

  if (!weekLabel && !vak && !plaats) return null;

  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-meta text-inkt-zacht">
      {weekLabel ? <span className="shrink-0 tabular-nums">{weekLabel}</span> : null}

      {vak ? (
        <>
          <span className="shrink-0">
            {t("periode.periodeLabel")} <span className="text-inkt">{periodeTekst(vak.van, vak.tot)}</span>
          </span>
          {planGeladen ? <Themanaam vak={vak} /> : null}
        </>
      ) : null}

      {plaats === "buiten" ? <span className="shrink-0">{t("periode.buitenSchooljaar")}</span> : null}
      {plaats === "tussen" ? <span className="shrink-0">{t("periode.tussenPeriodes")}</span> : null}
    </p>
  );
}

/**
 * Why a day has no period, or null when saying so would be a guess.
 *
 * "Tussen twee periodes" needs a period on both sides. Before the first one, after the last one, and
 * before the rooster has arrived, the honest caption says nothing about periods at all.
 */
function plaatsZonderPeriode(
  datum: string,
  schooljaar: { start: string; eind: string; blokken: readonly { start: string; eind: string }[] } | undefined,
): "buiten" | "tussen" | null {
  if (!schooljaar) return null;
  if (datum < schooljaar.start || datum > schooljaar.eind) return "buiten";

  const ervoor = schooljaar.blokken.some((blok) => blok.eind < datum);
  const erna = schooljaar.blokken.some((blok) => blok.start > datum);
  return ervoor && erna ? "tussen" : null;
}

/**
 * The thema, behind a rule in the colour its band is filled with in the month and week views.
 *
 * The rule is decoration: in neutral ink it measures well under 3:1 against the page, so it carries
 * no meaning of its own. It takes no accent even on a period's first day, where the band does, because
 * the accent is rationed to five uses (ADR-0024) and the heading already names the date. What tells a
 * screen reader this name is the thema is the spoken clause, `themaClausule`, which the grid's day
 * buttons speak too.
 */
function Themanaam({ vak }: { vak: Themavak }) {
  const leeg = vak.themas.length === 0;

  return (
    <span
      className={cn(
        "min-w-0 max-w-64 truncate border-l-2 pl-2",
        leeg ? "border-l-lijn text-inkt-zacht" : "border-l-lijn-sterk font-medium text-inkt",
      )}
    >
      <span className="sr-only">{themaClausule(vak)}</span>
      <span aria-hidden="true">{themaLabel(vak)}</span>
    </span>
  );
}
