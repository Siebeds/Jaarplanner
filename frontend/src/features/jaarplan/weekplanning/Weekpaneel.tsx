import { useMemo, useState } from "react";

import { t, tAantal } from "../../../i18n";
import { formatteerDatum, formatteerPeriode, wekenInBlok } from "../kalenderFormat";
import type { Planningsblok, Themaplaatsing } from "../types";
import { Minikalender } from "./Minikalender";
import { Dagrij } from "./Dagrij";
import {
  useVerplaatsActiviteit,
  useVerwijderActiviteitplaatsing,
  usePlanActiviteit,
  useWeekplanning,
} from "./useWeekplanning";
import { groepeerInWeken, verschuifWeken, weekVan, wekenInPeriode } from "./weekIndeling";
import type { Dag } from "./types";

/**
 * One themaperiode, week by week (E9-04, CR2).
 *
 * **This is the screen the directie asked for.** The themaoverzicht was fine; the subthema view was not, because the
 * `Subthemaperiode` tier redraws the *whole year* at a finer grain while still showing only thema placements. It answers
 * "what is the rhythm of the year?" when the question was "what am I doing on Tuesday?".
 *
 * **Not a modal, and that is a requirement rather than a preference.** A teacher planning a week needs the period header
 * and (once E9-06's bar lands) their coverage on screen at the same time; a dialog would trap both. It replaces the
 * board in place and its position lives in the URL (`?periode=`), so back works and a link is shareable (ADR-0021).
 *
 * ## Two layout decisions taken against the real calendar
 *
 * **Days are rows, not columns.** The owner's own sketch had rows, and at 390px it is the only shape that works: five
 * columns of activity cards on a phone gives each one 60px. Rows also let a day grow with what is in it.
 *
 * **Saturday and Sunday are hidden unless they carry something.** The server cannot help here — `Schooljaar.IsLesdag`
 * excludes only closures, so a Saturday inside the year arrives as a teaching day — and a week view with two permanently
 * empty columns spends a seventh of the screen on days nobody teaches. But a placement on a Saturday **is** reachable
 * through the API, and hiding a row that holds something would make a teacher's own work invisible. So: weekdays always,
 * weekend only when occupied. That is the honest version of both.
 */

export interface WeekpaneelProps {
  klasId: string;
  /** The period being planned, resolved from `?periode=` against the derived grid. */
  blok: Planningsblok;
  schooljaarStart: string;
  schooljaarEind: string;
  /** The thema's placed in this period, so the picker offers their activiteiten and the header names them. */
  plaatsingen: readonly Themaplaatsing[];
  onTerug: () => void;
}

export function Weekpaneel({
  klasId,
  blok,
  schooljaarStart,
  schooljaarEind,
  plaatsingen,
  onTerug,
}: WeekpaneelProps) {
  const wekenVanPeriode = useMemo(() => wekenInPeriode(blok.start, blok.eind), [blok.start, blok.eind]);

  /**
   * Which week is on show. Its own state rather than a second URL parameter, deliberately: the period is the thing a
   * teacher navigates *to* and might link to, the week within it is where they are looking right now. A second param
   * would put two positions in one URL and make "back" mean stepping a week.
   */
  const [maandag, setMaandag] = useState(() => wekenVanPeriode[0] ?? weekVan(blok.start).van);
  const week = weekVan(maandag);

  const weekplanning = useWeekplanning(klasId, week.van, week.tot);
  const plannen = usePlanActiviteit(klasId);
  const verplaatsen = useVerplaatsActiviteit(klasId);
  const verwijderen = useVerwijderActiviteitplaatsing(klasId);

  /**
   * The days to draw.
   *
   * Read off the **response** rather than generated locally, because the server clamps the range to the school year and
   * a locally generated week would offer days the answer does not contain — which is how a screen ends up with a control
   * for a date the server would refuse.
   */
  const dagen: Dag[] = useMemo(() => {
    const geleverd = weekplanning.data?.dagen ?? [];
    const groepen = groepeerInWeken(geleverd);

    return groepen[0]?.dagen ?? [];
  }, [weekplanning.data]);

  const zichtbareDagen = useMemo(
    () =>
      dagen.filter((dag) => {
        const dagVanWeek = (new Date(
          Number(dag.datum.slice(0, 4)),
          Number(dag.datum.slice(5, 7)) - 1,
          Number(dag.datum.slice(8, 10)),
        ).getDay() + 6) % 7;

        // Weekdays always; weekend only when it holds something (see the note on this component).
        return dagVanWeek < 5 || dag.activiteiten.length > 0;
      }),
    [dagen],
  );

  const themanamen = useMemo(
    () =>
      [...new Set(plaatsingen.filter((p) => p.status !== "Geweigerd").map((p) => p.themaNaam))].sort(
        (a, b) => a.localeCompare(b, "nl"),
      ),
    [plaatsingen],
  );

  const positieVanWeek = wekenVanPeriode.indexOf(maandag);
  const eersteWeek = wekenVanPeriode[0];
  const laatsteWeek = wekenVanPeriode[wekenVanPeriode.length - 1];

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onTerug}
          className="self-start rounded-md px-2 py-1 text-xs font-medium text-petrol hover:bg-petrol-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span aria-hidden="true">← </span>
          {t("weekplanning.terug")}
        </button>

        <h2 className="text-lg font-bold text-ink">
          {t("weekplanning.titel", { ordinaal: blok.ordinaal })}
        </h2>

        {/* The period's own facts, in the same shape the board's column header uses so the two cannot disagree: weeks
            from `aantalOpenDagen`, days from `aantalOpenWeekdagen`. Never the other way round (E9-02). */}
        <p className="text-xs text-ink-zacht">
          <time dateTime={blok.start}>{formatteerPeriode(blok.start, blok.eind)}</time>
          <span> · </span>
          {tAantal(wekenInBlok(blok.aantalOpenDagen), "kalender.wekenEnkelvoud", "kalender.weken")}
          <span> · </span>
          {tAantal(
            blok.aantalOpenWeekdagen,
            "kalender.schooldagenEnkelvoud",
            "kalender.schooldagen",
          )}
        </p>

        {/* Which thema this week belongs to. Unconditional, not behind the uitleg switch: without it the day rows are
            a calendar with no subject, and the picker below offers activiteiten whose provenance would be unexplained.
            A period with no thema says so and points at the fix, which is the E3-06 rule rather than help. */}
        {themanamen.length > 0 ? (
          <p className="text-xs font-medium text-petrol">
            {t("weekplanning.themas", { namen: themanamen.join(", ") })}
          </p>
        ) : (
          <p className="text-xs text-ink-zacht">{t("weekplanning.geenThema")}</p>
        )}
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-56">
          <Minikalender
            gekozenDag={maandag}
            schooljaarStart={schooljaarStart}
            schooljaarEind={schooljaarEind}
            onKies={(datum) => setMaandag(weekVan(datum).van)}
          />

          {/* The period's own weeks, as the owner's sketch had them. A list rather than a select: there are four to six
              of them, they are the primary navigation of this screen, and a closed select would hide the one thing a
              teacher is moving through. */}
          <nav aria-label={t("weekplanning.weken")}>
            <ul className="flex flex-col gap-0.5">
              {wekenVanPeriode.map((weekMaandag, index) => {
                const span = weekVan(weekMaandag);
                const isHuidig = weekMaandag === maandag;

                return (
                  <li key={weekMaandag}>
                    <button
                      type="button"
                      onClick={() => setMaandag(weekMaandag)}
                      aria-current={isHuidig ? "true" : undefined}
                      className={[
                        "flex w-full items-baseline justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        isHuidig
                          ? "bg-petrol-wash font-semibold text-petrol"
                          : "font-medium text-ink-zacht hover:bg-muted hover:text-ink",
                      ].join(" ")}
                    >
                      <span>{t("weekplanning.week", { nummer: index + 1 })}</span>
                      <span className="tabular-nums text-[0.6875rem] font-normal">
                        {formatteerDatum(span.van)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMaandag(verschuifWeken(maandag, -1))}
              disabled={maandag <= eersteWeek}
              className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-ink hover:bg-petrol-wash hover:text-petrol disabled:cursor-not-allowed disabled:text-ink-zacht/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span aria-hidden="true">‹ </span>
              {t("weekplanning.vorigeWeek")}
            </button>

            <p className="min-w-0 text-center text-sm font-semibold text-ink">
              {positieVanWeek >= 0
                ? t("weekplanning.week", { nummer: positieVanWeek + 1 })
                : /* Reachable through the mini calendar, which offers the whole school year on purpose. Said plainly
                     rather than silently redrawing, so a teacher who has navigated out of the period knows it. */
                  t("weekplanning.buitenPeriode")}
              <span className="block text-xs font-normal text-ink-zacht">
                {formatteerPeriode(week.van, week.tot)}
              </span>
            </p>

            <button
              type="button"
              onClick={() => setMaandag(verschuifWeken(maandag, 1))}
              disabled={maandag >= laatsteWeek}
              className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-ink hover:bg-petrol-wash hover:text-petrol disabled:cursor-not-allowed disabled:text-ink-zacht/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("weekplanning.volgendeWeek")}
              <span aria-hidden="true"> ›</span>
            </button>
          </div>

          {weekplanning.isError ? (
            /* A degrade, so unconditional and never behind the uitleg switch. It also says nothing changed, because a
               failed read must not read as a lost plan. */
            <div className="rounded-lg border border-suggestie-geweigerd/30 bg-suggestie-geweigerd/5 px-4 py-4">
              <p role="alert" className="text-sm font-medium text-suggestie-geweigerd">
                {t("weekplanning.fout")}
              </p>
              <button
                type="button"
                onClick={() => void weekplanning.refetch()}
                className="mt-2 rounded-md bg-petrol px-3 py-1.5 text-xs font-semibold text-petrol-foreground hover:bg-petrol-helder"
              >
                {t("weekplanning.opnieuw")}
              </button>
            </div>
          ) : weekplanning.isPending ? (
            <p role="status" className="text-sm text-ink-zacht">
              {t("weekplanning.laden")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {zichtbareDagen.map((dag) => (
                <Dagrij
                  key={dag.datum}
                  dag={dag}
                  klasId={klasId}
                  themaIds={themanamen.length > 0 ? plaatsingen.map((p) => p.themaId) : []}
                  bezig={plannen.isPending || verwijderen.isPending || verplaatsen.isPending}
                  onPlan={(activiteitId, volgorde) =>
                    plannen.mutate({ activiteitId, datum: dag.datum, volgorde })
                  }
                  onVerwijder={(plaatsingId) => verwijderen.mutate(plaatsingId)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
