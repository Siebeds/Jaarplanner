import { useId, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { t } from "../../../i18n";
import { haalThemaVoorKlas } from "../../themas/api";
import type { Dag } from "./types";

/**
 * One day of the week view, with what is planned on it and a way to plan more (E9-04, FR-7.2).
 *
 * **A row, not a column.** Days grow with what they hold, and at 390px five columns give each activiteit 60px.
 *
 * **A picker rather than drag-and-drop, for now.** Both were in scope and this one ships first, for the reason E3-07
 * recorded when it built the same pair one tier up: the picker is the route that works on a touch screen and by
 * keyboard, and a drag is undiscoverable on its own. Dragging is a follow-up on top of this, not a replacement for it —
 * and dnd-kit needs stepped mouse moves to be testable at all, which is a cost worth paying separately.
 */

/** "maandag" — the spoken day name, for accessible names. */
const dagNaam = new Intl.DateTimeFormat("nl-BE", { weekday: "long" });

/** "ma 7 sep" — the visible heading, where the weekday is what a teacher scans for. */
const dagKort = new Intl.DateTimeFormat("nl-BE", { weekday: "short", day: "numeric", month: "short" });

/**
 * "7 september" — day and month **without** the weekday.
 *
 * A third formatter rather than reusing `dagKort` in the accessible names, because pairing that with `dagNaam` produced
 * "Bladeren zoeken van maandag ma 7 sep halen": the day said twice, once abbreviated. Caught by a test whose own regex
 * would not match, which is the cheap way to find copy that reads badly only when spoken.
 */
const dagDatum = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long" });

function alsDatum(isoDatum: string): Date {
  const [jaar, maand, dag] = isoDatum.split("-").map(Number);

  // From the parts, never `new Date(iso)`: that parses as UTC and renames the day west of Greenwich.
  return new Date(jaar, maand - 1, dag);
}

export interface DagrijProps {
  dag: Dag;
  klasId: string;
  /** The thema's placed in this period. Their activiteiten are what the picker may offer. */
  themaIds: readonly string[];
  /**
   * This day lies outside the period being planned (E9-04, found in a browser).
   *
   * A week is anchored on real Mondays, so the first and last week of a period legitimately reach outside it: periode 2
   * opens on a Friday, and **four of "week 1"'s five days belong to periode 1**. Without this the row looked ordinary
   * and the only signal came *after* planning, as `valtBuitenThemaperiode` on the card — a correction rather than a
   * warning.
   *
   * **It marks, it does not disable.** Planning there is legitimate (ADR-0023 decision 7) and the server accepts it.
   */
  buitenPeriode: boolean;
  bezig: boolean;
  onPlan: (activiteitId: string, volgorde: number) => void;
  onVerwijder: (plaatsingId: string) => void;
}

export function Dagrij({ dag, klasId, themaIds, buitenPeriode, bezig, onPlan, onVerwijder }: DagrijProps) {
  const [kiesOpen, setKiesOpen] = useState(false);
  const veldId = useId();

  const naam = dagNaam.format(alsDatum(dag.datum));
  const kort = dagKort.format(alsDatum(dag.datum)).replace(/\.$/, "");
  const gesproken = dagDatum.format(alsDatum(dag.datum));

  /**
   * The activiteiten this day may take: everything under the thema's placed in this period, scoped to this class.
   *
   * **Fetched only when the picker is open.** The board can hold seven days and each would otherwise fire a query per
   * placed thema on every render of the week — for a panel most teachers open once per day. Same `enabled`-behind-a-
   * disclosure rule `useThemanamen` follows.
   *
   * `haalThemaVoorKlas` is the class-scoped read, so the subthema's and activiteiten it returns are already this
   * class's (Art. IX.2). Nothing here filters by klas, because nothing here would know how.
   */
  const themas = useQueries({
    queries: themaIds.map((themaId) => ({
      queryKey: ["thema-voor-klas", themaId, klasId],
      queryFn: () => haalThemaVoorKlas(themaId, klasId),
      enabled: kiesOpen && Boolean(klasId),
      staleTime: 60 * 1000,
    })),
  });

  /**
   * Every activiteit the successful reads returned, **before** anything is filtered out.
   *
   * Split from `keuzes` because `keuzes.length === 0` has three causes and the teacher needs a different sentence for
   * each: nothing exists, everything that exists is already on this day, or the read failed. Collapsing them is what
   * produced the false claim the 2026-08-20 audit found.
   */
  const aanwezig = useMemo(
    () =>
      themas
        .flatMap((query) => query.data?.subthemas ?? [])
        .flatMap((subthema) =>
          subthema.activiteiten.map((activiteit) => ({
            id: activiteit.id,
            naam: activiteit.naam,
            subthemaNaam: subthema.naam,
          })),
        ),
    [themas],
  );

  const keuzes = useMemo(() => {
    const alGepland = new Set(dag.activiteiten.map((a) => a.activiteitId));

    return (
      aanwezig
        // Already on this day, so offering it again would produce the duplicate the server refuses with a 400. Filtered
        // rather than shown-and-disabled: the list is short and a disabled row here explains nothing a teacher needs.
        .filter((keuze) => !alGepland.has(keuze.id))
        .sort((a, b) => a.naam.localeCompare(b.naam, "nl"))
    );
  }, [aanwezig, dag.activiteiten]);

  const laadt = themas.some((query) => query.isPending && query.fetchStatus !== "idle");

  /**
   * **A failed read is its own state, and conflating it with an empty one was an Art. II.3 / E5-03-rule violation**
   * (the 2026-08-20 audit's second frontend MAJOR).
   *
   * `useQueries` leaves `data` undefined on failure, so `keuzes` came out empty, `laadt` came out false, and the picker
   * rendered *"Deze klas heeft nog geen activiteiten in de thema's van deze periode. Maak ze eerst aan bij Thema's."* —
   * a claim about the school's content that a failed HTTP request cannot possibly support, and one that sends a teacher
   * off to create activiteiten they may already have. **A conditional sentence may assert only what its own render
   * condition guarantees**, and this branch guarantees nothing about how many activiteiten exist.
   *
   * **There is one query per placed thema, so failure is not all-or-nothing** — and the first fix for this treated it as
   * if it were. It fired on `some(isError)`, said *"de activiteiten van deze thema's"* in the plural, and **threw away
   * the choices that had loaded**: with two thema's and one failed read, a teacher lost access to activiteiten the app
   * was holding. The retry button refetched only the errored queries, which proves partial failure was foreseen in the
   * mechanism and missed in the copy. Now the two cases are separate: everything failed, or something did.
   */
  const mislukt = themas.filter((query) => query.isError);
  const allesMislukt = themas.length > 0 && mislukt.length === themas.length;

  const opnieuwProberen = () => {
    for (const query of mislukt) {
      void query.refetch();
    }
  };

  return (
    <li
      className={[
        "rounded-lg border px-3.5 py-3",
        dag.isLesdag ? "border-border bg-card" : "border-dashed border-border bg-muted/40",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">
          <time dateTime={dag.datum}>{kort}</time>
        </h3>

        {/* A closed day says WHY, in visible text (the E3-06 rule) — not a tooltip and not a bare grey row. The name is
            the school's own ("Herfstvakantie"), which is the fact that makes the missing control make sense. Never
            behind the uitleg switch: it is a state, not help. */}
        {dag.sluitingsnaam !== null && (
          <span className="text-xs font-medium text-attentie-ink">
            {t("weekplanning.dagGesloten", { naam: dag.sluitingsnaam })}
          </span>
        )}

        {/* Said before a teacher plans here, not after. A word rather than a colour alone (Art. XII), and quiet
            (`ink-zacht`): this is a fact about the calendar, not a warning about a mistake. */}
        {buitenPeriode && dag.sluitingsnaam === null && (
          <span className="text-xs font-medium text-ink-zacht">
            {t("weekplanning.dagBuitenPeriode")}
          </span>
        )}
      </div>

      {dag.activiteiten.length === 0 ? (
        <p className="mt-1.5 text-xs text-ink-zacht">{t("weekplanning.dagLeeg")}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {dag.activiteiten.map((activiteit) => (
            <li
              key={activiteit.plaatsingId}
              className="flex items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{activiteit.activiteitNaam}</p>
                <p className="text-xs text-ink-zacht">{activiteit.subthemaNaam}</p>

                {/* Reported, never refused (ADR-0023): a teacher who front-loads an activiteit is not making a
                    mistake. Colour plus a word, never colour alone (Art. XII). */}
                {activiteit.valtBuitenThemaperiode && (
                  <p className="mt-0.5 text-xs font-medium text-attentie-ink">
                    {t("weekplanning.valtBuitenPeriode")}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onVerwijder(activiteit.plaatsingId)}
                disabled={bezig}
                // Dropped while busy so the accessible name IS the visible text (SC 2.5.3), matching the treatment
                // `Doelkiezer` uses for the same reason: `bezig` is one flag for the whole list.
                aria-label={
                  bezig
                    ? undefined
                    : t("weekplanning.verwijderAria", {
                        activiteit: activiteit.activiteitNaam,
                        dag: naam,
                        datum: gesproken,
                      })
                }
                className="shrink-0 rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-ink hover:bg-muted disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {bezig ? t("weekplanning.verwijderBezig") : t("weekplanning.verwijder")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* No control at all on a closed day, and the reason is already stated above rather than left to a disabled
          button a teacher would poke at. The server would refuse the placement anyway (400, naming the closure), so
          this is the screen agreeing with the server instead of provoking it. */}
      {dag.isLesdag &&
        (kiesOpen ? (
          <div className="mt-2 rounded-md border border-border bg-paper/60 p-3">
            <label className="block text-xs font-semibold text-ink" htmlFor={veldId}>
              {t("weekplanning.planKies")}
            </label>

            {allesMislukt ? (
              /* Every read failed, so there is nothing to offer and nothing true to say about the school's content. */
              <div className="mt-1.5">
                <p role="alert" className="text-xs font-medium text-suggestie-geweigerd">
                  {t("weekplanning.planFout")}
                </p>
                <button
                  type="button"
                  onClick={opnieuwProberen}
                  // Each Dagrij owns its own picker, so up to seven of these can be on screen at once. The name carries
                  // the day, the way `Periodekolom` names its period for the same reason — and it leads with the
                  // visible text, so SC 2.5.3 holds.
                  aria-label={t("weekplanning.opnieuwAria", { dag: naam, datum: gesproken })}
                  className="mt-1.5 rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-ink hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("weekplanning.opnieuw")}
                </button>
              </div>
            ) : laadt ? (
              <p role="status" className="mt-1.5 text-xs text-ink-zacht">
                {t("weekplanning.planBezig")}
              </p>
            ) : keuzes.length === 0 ? (
              /* Nothing offerable, and the reason decides the sentence. Three causes, three answers — collapsing them
                 is what made this branch assert something false. `aanwezig` is what the successful reads returned, so
                 "already on this day" is only claimed when something really did load. */
              <p className="mt-1.5 text-xs text-ink-zacht">
                {mislukt.length > 0
                  ? t("weekplanning.planFoutGedeeltelijkLeeg")
                  : aanwezig.length > 0
                    ? t("weekplanning.planAlGepland")
                    : themaIds.length === 0
                      ? // No thema in the period, so `planGeenKeuze`'s "in de thema's van deze periode" would
                        // quantify over an empty set and its "maak ze aan bij Thema's" would be the wrong errand.
                        t("weekplanning.planGeenThema")
                      : t("weekplanning.planGeenKeuze")}
              </p>
            ) : (
              <>
                {/* Some reads worked and some did not, so the list is real but may be short. Said above it rather than
                    instead of it: the first version of this fix dropped the whole list on one failed thema. */}
                {mislukt.length > 0 && (
                  <div className="mt-1.5">
                    <p role="alert" className="text-xs font-medium text-attentie-ink">
                      {t("weekplanning.planFoutGedeeltelijk")}
                    </p>
                    <button
                      type="button"
                      onClick={opnieuwProberen}
                      aria-label={t("weekplanning.opnieuwAria", { dag: naam, datum: gesproken })}
                      className="mt-1 rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-ink hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {t("weekplanning.opnieuw")}
                    </button>
                  </div>
                )}

                <ul id={veldId} className="mt-1.5 flex flex-col gap-1">
                {keuzes.map((keuze) => (
                  <li key={keuze.id}>
                    <button
                      type="button"
                      disabled={bezig}
                      onClick={() => {
                        // Appended after what is already there, which is what a teacher adding to a day means. The
                        // server orders on this, so a day never falls back on insertion order.
                        onPlan(keuze.id, dag.activiteiten.length);
                        setKiesOpen(false);
                      }}
                      className="flex w-full items-baseline justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-ink hover:bg-petrol-wash hover:text-petrol disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span>{keuze.naam}</span>
                      <span className="shrink-0 text-[0.6875rem] font-normal text-ink-zacht">
                        {keuze.subthemaNaam}
                      </span>
                    </button>
                  </li>
                  ))}
                </ul>
              </>
            )}

            <button
              type="button"
              onClick={() => setKiesOpen(false)}
              className="mt-2 rounded-md px-2 py-1 text-xs font-medium text-ink-zacht hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("weekplanning.annuleer")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setKiesOpen(true)}
            aria-expanded={false}
            aria-label={t("weekplanning.planAria", { dag: naam, datum: gesproken })}
            className="mt-2 rounded-md border border-dashed border-input px-2.5 py-1 text-xs font-medium text-petrol hover:bg-petrol-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span aria-hidden="true">+ </span>
            {t("weekplanning.plan")}
          </button>
        ))}
    </li>
  );
}
