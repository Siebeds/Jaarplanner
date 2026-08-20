import { useMemo, useState } from "react";

import { ApiError } from "../../../lib/api";
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

/**
 * What a **failed scheduling edit** tells the teacher (E9-04, the 2026-08-20 audit's first frontend MAJOR).
 *
 * The three mutations shipped with no error surface at all: a refused plan, move or removal rendered *nothing*, so the
 * card simply did not appear and the screen looked like it had ignored the click. Worse, it threw away the one thing
 * built to be shown — `OngeldigeDagplanningFout` composes four **Dutch, teacher-actionable** sentences that name the
 * day and the reason ("Op 2 november 2026 is de school gesloten (Herfstvakantie). Kies een andere dag."), which is
 * exactly the Dutch side of the ratified Art. II.3 split and exactly what `api.ts` says the caller may render.
 *
 * **A 400 shows the server's own sentence; nothing else does.** Following `Opstapimport`'s precedent, and for the
 * reason the kalender's `verplaatsFoutmelding` maps status → key instead. Four distinct refusals share the 400 here —
 * closed day, outside the school year, duplicate, another class's activiteit — so a status → key map genuinely
 * **cannot** say which one happened, which is why this branch reads `detail`. Every one of the four is Dutch,
 * teacher-actionable and names the day (`OngeldigeDagplanningFout`), which is the Dutch side of the ratified Art. II.3
 * split.
 *
 * *An earlier version of this paragraph justified the restriction by saying the other statuses carry "an English
 * operator diagnostic or no body at all". That is **not** true of the likeliest one: `SchoolcontentNietGevondenFout`
 * produces a **Dutch** 404 detail. Withholding it is still right — those sentences are built around a raw GUID
 * ("Activiteit 3f2a… is niet gevonden") and are not actionable — but the honest reason is that the body is either an
 * operator diagnostic, absent, or a Dutch sentence about an internal id, and none of the three belongs on a teacher's
 * screen.*
 *
 * **404 gets its own sentence**, because it is the ordinary concurrent case — another session removed the placement —
 * and *"probeer het opnieuw"* cannot succeed on it. Same shape as `themabeheer.subthemaAlWeg`.
 *
 * **⚠ This is safe on today's throw sites and pinned by nothing.** I traced every throw reachable from the three
 * endpoints: the only 400 carrying a `detail` is `OngeldigeDagplanningFout`. But `PlanningExceptionHandler` also maps
 * `OngeldigePlaatsingFout` and two siblings to 400 with their own message, and its docstring says those sentences give
 * *wrong advice for a day*; `SchoolcontentExceptionHandler` is registered first and maps `SchoolcontentValidatieFout`
 * to 400 with `exception.Message` from a dozen throw sites. **Nothing asserts that only `OngeldigeDagplanningFout` can
 * 400 on these routes.** A `type`-URI discriminator is the mechanism for that (`ApiError.type` and
 * `OPSTAP_WEIGERINGSOORT` already exist); until then this restriction is a property of today's server, not a guarantee.
 */
function wijzigingsfout(fout: unknown): string {
  if (fout instanceof ApiError && fout.status === 400) {
    // `detail` is undefined for an empty or non-JSON body, which a proxy 400 can produce — so the fallback is not
    // theoretical (see `apiFetch`'s three-envelope note).
    return fout.detail ?? t("weekplanning.wijzigGeweigerd");
  }

  if (fout instanceof ApiError && fout.status === 404) {
    return t("weekplanning.wijzigVerdwenen");
  }

  return t("weekplanning.wijzigOnbeschikbaar");
}

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

  /**
   * The most recent of the three edits to have failed, or nothing.
   *
   * **Picked by `submittedAt` rather than by the order of this array**, and that is not fussiness: a mutation's `error`
   * survives until its *own* next call, so after a refused plan and then a refused removal **both** are in error, and a
   * first-match-wins lookup would show the older sentence — about a different day, naming a reason that no longer
   * applies. Newest wins is the only answer that is always about what the teacher just did.
   */
  const mislukt = useMemo(() => {
    const gefaald = [plannen, verplaatsen, verwijderen].filter((mutatie) => mutatie.isError);

    return gefaald.reduce<(typeof gefaald)[number] | undefined>(
      (nieuwste, mutatie) =>
        nieuwste === undefined || mutatie.submittedAt > nieuwste.submittedAt ? mutatie : nieuwste,
      undefined,
    );
  }, [plannen, verplaatsen, verwijderen]);

  /**
   * Dismiss clears **all three**, not just the one on show.
   *
   * The first version reset only `mislukt`, which reintroduced the exact defect the newest-wins lookup above exists to
   * prevent: with two edits in error, closing the notice did not close it — it re-rendered with the *older* sentence,
   * about a different day and an action the teacher had moved on from. A control that says "Melding sluiten" and
   * reveals another message is the E3-06 rule broken by the fix for a copy defect. Pinned by a two-failure test.
   */
  const sluitMelding = () => {
    plannen.reset();
    verplaatsen.reset();
    verwijderen.reset();
  };

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
          {/* Capped to match the day list below it: uncapped, "Volgende week" sat ~250px right of the last day card at
              1440px, which reads as belonging to nothing. */}
          <div className="flex max-w-3xl items-center justify-between gap-2">
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

          {/* A refused or failed edit, above the days rather than on the row it concerns: the sentence names its own
              day, and a message inside a row would be invisible for the one case that matters most — a plan refused on
              a day whose row is not on screen because the week stepped. Dismissed by the teacher rather than by a
              timer or by a week change, so it cannot vanish before it is read. */}
          {mislukt !== undefined && (
            <div
              className="flex max-w-3xl items-start justify-between gap-3 rounded-lg border border-suggestie-geweigerd/30 bg-suggestie-geweigerd/5 px-4 py-3"
            >
              {/* `role="alert"` because it appears in response to the teacher's own action and must be announced
                  without them going looking for it. */}
              <p role="alert" className="text-sm font-medium text-suggestie-geweigerd">
                {wijzigingsfout(mislukt.error)}
              </p>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {/* `wijzigOnbeschikbaar` says we do not know whether the write landed, so the way to find out has to be
                    on screen beside it rather than described (the E3-06 rule). Only on that branch: after a 400 or a
                    404 nothing was written and a reload would say nothing new. */}
                {mislukt.error instanceof ApiError && mislukt.error.status !== 400 && mislukt.error.status !== 404 && (
                  <button
                    type="button"
                    onClick={() => {
                      void weekplanning.refetch();
                      sluitMelding();
                    }}
                    className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-ink hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {t("weekplanning.wijzigHerlaad")}
                  </button>
                )}

                <button
                  type="button"
                  onClick={sluitMelding}
                  className="rounded-md px-2 py-1 text-xs font-medium text-ink-zacht hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("weekplanning.wijzigFoutSluiten")}
                </button>
              </div>
            </div>
          )}

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
            /* `max-w-3xl` found by looking at it: at 1440px a day row ran the full ~1100px, leaving its
               "Van deze dag halen" button stranded at the far right of an otherwise empty card. That is the same
               stretched-column defect the E3-06 browser pass found on the period columns. */
            <ul className="flex max-w-3xl flex-col gap-2">
              {zichtbareDagen.map((dag) => (
                <Dagrij
                  key={dag.datum}
                  dag={dag}
                  // A week is anchored on real Mondays, so the first and last week of a period legitimately reach
                  // outside it — periode 2 opens on a Friday, and four of "week 1"'s five days belong to periode 1.
                  // Said BEFORE a teacher plans on such a day, not only after: the server reports
                  // `valtBuitenThemaperiode` on the card afterwards, which is a correction rather than a warning.
                  buitenPeriode={dag.datum < blok.start || dag.datum > blok.eind}
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
