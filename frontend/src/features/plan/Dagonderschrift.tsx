import { t } from "../../i18n";
import { periode as periodeTekst } from "../../lib/datum";
import { cn } from "../../lib/cn";
import { vakOpDag, type Themavak } from "./themavakken";

/**
 * Where the agenda's anchored day sits in the school year, as a caption under the heading.
 *
 * **It is a caption and not a row of chips.** The owner read the filled pills that used to sit beside
 * the heading as buttons (2026-09-11), and nothing in them can be pressed. So there is no fill, no
 * border and no radius here, and the size and ink step down from the heading instead of sitting level
 * with it.
 *
 * **The period and its thema are facts about one day, so they are only printed where the view IS one
 * day.** They used to be printed always, derived from the anchored day, above a grid showing a whole
 * month. On this school year the periods end on the 1st and paging a month keeps the day of the month,
 * so a teacher who paged from september stood on 1 november and read "Periode 2 okt - 1 nov" over a grid
 * of which that period owned not one day. In the month and week views the answer is on the days
 * instead, where it can differ per day: `Themastroken`.
 *
 * **Every sentence here is printed only where its own condition holds** (the E5-03 rule), because
 * "no period" has four causes and only one of them is "between two periods": the day may lie outside
 * the school year, after its last period, or the rooster may simply not have arrived yet.
 */
export function Dagonderschrift({
  weekLabel,
  dagweergave,
  datum,
  schooljaar,
  vakken,
  planGeladen,
}: {
  /** Null in the month view, where a week number over five weeks would name only the first. */
  weekLabel: string | null;
  dagweergave: boolean;
  datum: string;
  /** Undefined while the rooster is still loading. */
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
 * Why a day in the school year's range has no period, or null when saying so would be a guess.
 *
 * "Tussen twee periodes" needs a period on both sides. After the last one, and before the rooster has
 * arrived, the honest caption says nothing about periods at all.
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
 * The thema, marked by the left edge its band carries in the month and week views.
 *
 * The edge is an echo, not the identification: in neutral ink it measures well under 3:1 against the
 * page, so it cannot carry meaning on its own, and it stays neutral even on a period's first day because
 * the accent is rationed to five uses (ADR-0024) and the heading already names the date. What tells a
 * screen reader this name is the thema is the spoken clause, the same one a day's button in the grid
 * appends (`themaZin`).
 */
function Themanaam({ vak }: { vak: Themavak }) {
  const leeg = vak.themas.length === 0;

  const zichtbaar = leeg
    ? t("periode.geenThema")
    : vak.themas.length === 1
      ? vak.themas[0].naam
      : t("periode.themaMeer", { naam: vak.themas[0].naam, aantal: vak.themas.length - 1 });

  const gesproken = leeg
    ? t("periode.dagGeenThema")
    : vak.themas.length === 1
      ? t("periode.dagThema", { naam: vak.themas[0].naam })
      : t("periode.dagThemas", { namen: vak.themas.map((thema) => thema.naam).join(", ") });

  return (
    <span
      className={cn(
        "min-w-0 max-w-64 truncate border-l-2 pl-2",
        leeg ? "border-l-lijn text-inkt-zacht" : "border-l-lijn-sterk font-medium text-inkt",
      )}
    >
      <span className="sr-only">{gesproken}</span>
      <span aria-hidden="true">{zichtbaar}</span>
    </span>
  );
}
