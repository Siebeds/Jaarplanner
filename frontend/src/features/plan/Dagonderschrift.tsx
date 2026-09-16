import { t } from "../../i18n";
import { periode as periodeTekst } from "../../lib/datum";
import { cn } from "../../lib/cn";
import { themaClausule, themaLabel, vakOpDag, type Themavak } from "./themavakken";

/**
 * Where the agenda's anchored day sits in the school year, as a caption under the heading.
 *
 * **It is a caption and not a row of chips.** The owner read the filled pills that used to sit beside
 * the heading as buttons (2026-09-11), and nothing in them can be pressed. So there is no fill and no
 * radius here, only one neutral rule before the thema. The caption is set well below the heading in a
 * softer ink, and only the thema's days and its name are in full ink.
 *
 * **The thema and its days are facts about one day, so they are only printed where the view IS one day.** In the
 * month and week views the answer is on the days instead, where it can differ per day: `Themastroken`.
 *
 * **Every sentence here is printed only where its own condition holds** (the E5-03 rule), because a day without a
 * thema is not necessarily "between two thema's": it may lie outside the school year, before the first thema or
 * after the last, or the rooster may simply not have arrived yet.
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
   * Null wherever the days in view are not one week (`weekInBeeld`), and the caption is then empty.
   * That costs the period nothing: it is only printed in the day view, and one day is always one week.
   */
  weekLabel: string | null;
  dagweergave: boolean;
  datum: string;
  /** Undefined while the rooster is still loading. `blokken` are the thema placements as stretches of days. */
  schooljaar: { start: string; eind: string; blokken: readonly { start: string; eind: string }[] } | undefined;
  vakken: readonly Themavak[];
  /** False while the jaarplan loads or failed to: an empty thema list then means "unknown", not "none". */
  planGeladen: boolean;
}) {
  if (!weekLabel) return null;

  const vak = dagweergave ? vakOpDag(vakken, datum) : undefined;
  const plaats = dagweergave && !vak ? plaatsZonderPeriode(datum, schooljaar) : null;

  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-meta text-inkt-zacht">
      <span className="shrink-0 tabular-nums">{weekLabel}</span>

      {vak ? (
        <>
          <span className="shrink-0">
            {t("periode.themaLoopt")} <span className="text-inkt">{periodeTekst(vak.van, vak.tot)}</span>
          </span>
          {planGeladen ? <Themanaam vak={vak} /> : null}
        </>
      ) : null}

      {plaats === "buiten" ? <span className="shrink-0">{t("periode.buitenSchooljaar")}</span> : null}
      {plaats === "tussen" ? <span className="shrink-0">{t("periode.geenThemaOpDag")}</span> : null}
    </p>
  );
}

/**
 * Why a day has no thema, or null when saying so would be a guess.
 *
 * "Geen thema op deze dag" is said only between two thema's: before the first one, after the last one, and before
 * the rooster and the plan have arrived, the honest caption says nothing at all.
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
 * no meaning of its own. It takes no accent even on a thema's first day, where a band with a thema
 * does, because the accent is rationed to five uses (ADR-0024) and the heading already names the date.
 * What tells a screen reader this name is the thema is the spoken clause, `themaClausule`, which the
 * grid's day buttons speak too.
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
