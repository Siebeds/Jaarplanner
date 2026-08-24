import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Klaskiezer } from "../../app/Klaskiezer";
import { Segment } from "../../components/ui/Segment";
import { Leegte } from "../../components/ui/Leegte";
import { Knop } from "../../components/ui/Knop";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { IcoonPijlLinks, IcoonPijlRechts, IcoonPlus } from "../../components/Iconen";
import { useDagacties, useJaarplan, useRooster, useWeekplanning } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { ApiError } from "../../lib/api";
import type { GeplandeActiviteit } from "../../lib/types";
import {
  datumsTussen,
  eersteVanMaand,
  klem,
  laatsteVanMaand,
  maandJaar,
  maandVan,
  maandagVan,
  periode as periodeTekst,
  verschuif,
  verschuifMaanden,
  valtBinnen,
  vandaag,
  volleDag,
  weekdagKort,
  dagNummer,
  weeknummer,
} from "../../lib/datum";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { Dagcel } from "./Dagcel";
import { Maandrooster } from "./Maandrooster";
import { Lesurenraster } from "../activiteiten/Lesurenraster";
import { leesSlotId } from "../activiteiten/lesuren";
import { Activiteitkiezer } from "./Activiteitkiezer";
import { Activiteitblad } from "./Activiteitblad";
import { Subthemaplanner, type Voorstel } from "./Subthemaplanner";
import { roosterdagen } from "./roosterdagen";
import { Dekkingsbalk } from "../dekking/Dekkingsbalk";
import { kalenderMeldingen, sleepUitleg, useSleepSensors } from "./sleep";

type Weergave = "maand" | "week" | "dag";

/** Anything else in the URL means the default, rather than an error page over a typo in a link. */
/** A day with nothing on it, for the render before the range is known. */
function leegteDag(datum: string) {
  return { datum, isLesdag: true, sluitingsnaam: null, activiteiten: [], buitenSchooljaar: false };
}

function leesWeergave(waarde: string | null): Weergave {
  return waarde === "week" || waarde === "dag" ? waarde : "maand";
}

/**
 * The agenda: the school year as a calendar, opening on the month (FR-6.2, FR-7.2).
 *
 * It used to be a screen per themaperiode, reached from a board of periods. The board is still
 * there, at /agenda/periodes, because placing a thema in a period and judging the generator's
 * proposals is a different job from planning a week. But it is no longer the front door: an agenda
 * that opens on a planning board is a planning board.
 *
 * The period is therefore DERIVED from where the teacher is standing rather than carried in the URL.
 * Everything period-scoped (which thema's the picker offers, which days the subthema planner may
 * use) follows the block the anchored date falls in, and between two periods it follows nothing and
 * says so.
 *
 * Everything here is persisted server side. That is worth stating because the obvious shortcut is
 * not: the other candidate frontend keeps its day agenda in localStorage, where it belongs to one
 * browser and is shared with nobody, which for a plan a school is inspected on is worse than not
 * having it.
 */
export function Agendascherm() {
  const { datum: routeDatum } = useParams<{ datum: string }>();
  const [zoek] = useSearchParams();
  const navigeer = useNavigate();
  const { klasId, schooljaarId } = useActieveSelectie();

  // The day AND the lesuur the picker was opened from. A slot of 0 is lesuur 1, which is what the
  // month view and the week cells use: they add to the first hour and the teacher moves it from there.
  const [kiezer, setKiezer] = useState<{ datum: string; slot: number } | null>(null);
  const [geopend, setGeopend] = useState<{ activiteit: GeplandeActiviteit; datum: string } | null>(null);
  const [sleepNaam, setSleepNaam] = useState<string | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerResultaat, setPlannerResultaat] = useState<{ gelukt: number; totaal: number; fouten: string[] } | null>(
    null,
  );

  const { data: rooster } = useRooster(schooljaarId);
  const { data: plan } = useJaarplan(klasId);
  const acties = useDagacties(klasId ?? "");
  const sensors = useSleepSensors();

  const nu = vandaag();

  /**
   * WHERE THE TEACHER IS STANDING LIVES IN THE URL, NOT IN STATE.
   *
   * It was `useState`, and that is fine right up to the moment anything remounts this component: a
   * refresh, the sidebar's own Agenda item, the back button, a hot reload during development. Every
   * one of those silently threw the date away and the agenda snapped back to today's month, so a
   * teacher working in november came back from a day to september. The URL also said /agenda while
   * the screen said 18 november, which is the same bug written down.
   *
   * With nothing in the path the agenda opens on today, pulled into the school year: in augustus
   * every day of the plan is still ahead, and a calendar that opens on an empty August says less
   * than one that opens on the first school day.
   */
  const anker = routeDatum ?? (rooster ? klem(nu, rooster.start, rooster.eind) : nu);
  const weergave = leesWeergave(zoek.get("weergave"));
  const vandaagBereikbaar = rooster ? valtBinnen(nu, rooster.start, rooster.eind) : false;

  /**
   * Move the agenda. `push` only where the teacher drilled IN, so the back button climbs back out to
   * the month or week they came from; paging through weeks replaces, or a morning of browsing buries
   * every other page in the history.
   */
  function ga(volgende: { datum?: string; weergave?: Weergave; push?: boolean }) {
    const datum = volgende.datum ?? anker;
    const zicht = volgende.weergave ?? weergave;
    navigeer(`/agenda/dag/${datum}${zicht === "maand" ? "" : `?weergave=${zicht}`}`, { replace: !volgende.push });
  }

  function openDag(datum: string) {
    ga({ datum, weergave: "dag", push: true });
  }

  // The themaperiode the anchored day falls in. Between two periods there is none, which is a
  // legitimate place to stand and not an error.
  const blok = useMemo(
    () => rooster?.blokken.find((b) => valtBinnen(anker, b.start, b.eind)),
    [rooster, anker],
  );

  // The range the current view needs. The server clamps it to the school year, so a month that
  // starts before the first school day is a legal request rather than an error.
  const [van, tot] = useMemo<[string, string]>(() => {
    if (!anker) return ["", ""];
    if (weergave === "maand") {
      // Whole weeks, so the grid is rectangular: back to the Monday on or before the first, and on
      // to the Sunday on or after the last.
      const eersteMaandag = maandagVan(eersteVanMaand(anker));
      const laatsteZondag = verschuif(maandagVan(laatsteVanMaand(anker)), 6);
      return [eersteMaandag, laatsteZondag];
    }
    if (weergave === "week") {
      const maandag = maandagVan(anker);
      return [maandag, verschuif(maandag, 6)];
    }
    return [anker, anker];
  }, [anker, weergave]);

  const { data: planning, isPending } = useWeekplanning(klasId, van, tot);

  // The planner spreads over the whole period, so it needs every day of it rather than the days the
  // current view happens to be showing. A separate query with its own key: asking the view's query
  // for a wider range would refetch the grid every time the teacher changed week.
  const { data: heelDePeriode } = useWeekplanning(klasId, blok?.start ?? "", blok?.eind ?? "");

  // The thema's running in this period are what the activity picker may offer.
  const themaIdsInPeriode = useMemo(() => {
    const ids = (plan?.plaatsingen ?? [])
      .filter((plaatsing) => plaatsing.blokStart === blok?.start && plaatsing.status !== "Geweigerd")
      .map((plaatsing) => plaatsing.themaId);
    return [...new Set(ids)];
  }, [plan, blok]);

  const bezig = acties.plaats.isPending || acties.verplaats.isPending || acties.verwijder.isPending;

  /**
   * What is running: the thema this period holds, and the subthema if the days on screen agree on
   * one.
   *
   * Once above the grid rather than on every card. A month cell is forty pixels of activiteit name
   * and a week card has two lines; repeating the thema in each of them would spend the cell on a
   * fact that is the same in all of them.
   *
   * The subthema is named only when EVERY activiteit in view belongs to it. Anything else would be
   * one of several presented as the one, and a chip cannot show which.
   */
  const themaNamen = useMemo(() => {
    const namen = (plan?.plaatsingen ?? [])
      .filter((plaatsing) => plaatsing.blokStart === blok?.start && plaatsing.status !== "Geweigerd")
      .map((plaatsing) => plaatsing.themaNaam);
    return [...new Set(namen)];
  }, [plan, blok]);

  /**
   * The grid, built from the dates the view asked for rather than from the server's answer.
   *
   * The weekplanning endpoint clamps a range into the school year, so a week in august comes back as
   * one day in september. Rendering that straight put a single column labelled "di 1" under a heading
   * that read "24 aug - 30 aug". See `roosterdagen` for the whole of it.
   */
  const zichtbareDagen = useMemo(
    () =>
      roosterdagen(
        van.length > 0 ? datumsTussen(van, tot) : [],
        planning?.dagen ?? [],
        rooster?.start ?? "",
        rooster?.eind ?? "",
      ),
    [van, tot, planning, rooster],
  );

  /**
   * Nothing here is a school day, so there is nothing to draw a grid of.
   *
   * Forty cells all reading "Buiten het schooljaar" is the same sentence forty times, which this
   * app's own rule forbids: once above the list is enough. The per-cell wording stays for a MIXED
   * range, where it marks which days of a real week fall outside and the others do not.
   */
  const eenheidsdagen =
    weergave === "maand"
      ? // The MONTH, not the 42-cell grid. A grid for augustus reaches into september, and those six
        // days are inside the school year, so judging on the range would keep 36 identical labels on
        // screen for a month that has nothing in it.
        zichtbareDagen.filter((dag) => maandVan(dag.datum) === maandVan(anker))
      : zichtbareDagen;
  const heelBereikBuiten = eenheidsdagen.length > 0 && eenheidsdagen.every((dag) => dag.buitenSchooljaar);

  const enigeSubthema = useMemo(() => {
    const namen = new Set((planning?.dagen ?? []).flatMap((dag) => dag.activiteiten.map((a) => a.subthemaNaam)));
    return namen.size === 1 ? [...namen][0] : null;
  }, [planning]);

  // Every activiteit on screen, by plaatsingId, so a drag announcement can name the thing it moved
  // after the grid has already re-rendered without it.
  const opNaam = useMemo(() => {
    const kaart = new Map<string, string>();
    for (const dag of planning?.dagen ?? []) {
      for (const activiteit of dag.activiteiten) kaart.set(activiteit.plaatsingId, activiteit.activiteitNaam);
    }
    return kaart;
  }, [planning]);

  function schuif(richting: -1 | 1) {
    if (weergave === "maand") ga({ datum: verschuifMaanden(anker, richting) });
    else if (weergave === "week") ga({ datum: verschuif(anker, richting * 7) });
    else ga({ datum: verschuif(anker, richting) });
  }

  function begin(gebeurtenis: DragStartEvent) {
    setSleepNaam(opNaam.get(String(gebeurtenis.active.id)) ?? null);
  }

  function laatLos({ active, over }: DragEndEvent) {
    setSleepNaam(null);
    if (!over) return;
    const plaatsingId = String(active.id);

    // Two kinds of target. The day grid drops onto a LESUUR, so its id carries the slot; the month
    // and week cells drop onto a day and say nothing about the hour.
    const doel = leesSlotId(String(over.id));
    const datum = doel?.datum ?? String(over.id);

    const huidige = (planning?.dagen ?? [])
      .flatMap((dag) => dag.activiteiten.map((a) => ({ datum: dag.datum, activiteit: a })))
      .find((x) => x.activiteit.plaatsingId === plaatsingId);

    // A drop onto a day says nothing about the hour, so the hour is KEPT. Sending the default 0
    // would quietly move an afternoon activiteit to the first lesuur every time a teacher dragged it
    // across the month, which is a change nobody asked for hidden inside one they did.
    const slot = doel ? doel.slot : (huidige?.activiteit.volgorde ?? 0);

    // Landing where it already is, is a legal target and a no-op. Firing the mutation anyway would
    // make the grid flicker and the server answer a question nobody asked.
    if (huidige && huidige.datum === datum && huidige.activiteit.volgorde === slot) return;

    acties.verplaats.mutate({ plaatsingId, datum, volgorde: slot });
  }

  // The range the teacher is looking at, said big. It used to be meta text beside the arrows, which
  // made the one thing that changes when you press them the smallest thing on the screen.
  const ankerLabel =
    weergave === "maand" ? maandJaar(anker) : weergave === "week" ? periodeTekst(van, tot) : volleDag(anker);

  // Only where a week is a unit. In a month the label already names the month, and a week number on
  // a grid spanning five of them would name only the first.
  const weekLabel = weergave === "maand" ? null : t("periode.weeknummer", { nummer: weeknummer(anker) });

  const foutTekst = (fout: unknown) =>
    fout instanceof ApiError && fout.detail ? fout.detail : fout ? t("periode.mislukt") : null;

  if (!klasId) {
    return (
      <>
        <Schermkop titel={t("periode.titel")} rechts={<Klaskiezer />} />
        <Schermvlak>
          <Leegte titel={t("plan.geenKlas")} />
        </Schermvlak>
      </>
    );
  }

  return (
    <>
      <Schermkop
        breed
        titel={t("periode.titel")}
        rechts={<Klaskiezer />}
        onder={
          /* Both rows travel with the sticky header. The range and its arrows used to scroll away
             with the grid, and a month is tall enough that they did: they ended up half behind the
             blurred bar, which reads as a rendering fault rather than as scrolling. */
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Segment
                label={t("periode.weergave")}
                waarde={weergave}
                onKies={(zicht) => ga({ weergave: zicht })}
                opties={[
                  { waarde: "maand", label: t("periode.maand") },
                  { waarde: "week", label: t("periode.week") },
                  { waarde: "dag", label: t("periode.dag") },
                ]}
              />

              <Link
                to="/agenda/periodes"
                className="inline-flex h-9 items-center rounded-full border border-lijn px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
              >
                {t("periode.themasPerPeriode")}
              </Link>

              {/* No period, no planner: the sheet spreads a subthema over the days of a themaperiode,
                  and between two periods there are none to spread it over. */}
              {blok ? (
                <button
                  type="button"
                  onClick={() => {
                    setPlannerResultaat(null);
                    setPlannerOpen(true);
                  }}
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3 text-meta font-medium text-accent-op transition-colors duration-150 hover:bg-accent-diep"
                >
                  <IcoonPlus aria-hidden="true" className="h-4 w-4" />
                  {t("periode.planSubthema")}
                </button>
              ) : null}
            </div>

            {/* The range, its arrows and the way back to today, together and at heading size. Navigation
                next to the thing it moves: the arrows used to sit up in the chrome, three controls away
                from the only label that told you what pressing them had done. */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-label={t("periode.vorige")}
                  onClick={() => schuif(-1)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-veld border border-lijn-veld text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
                >
                  <IcoonPijlLinks className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={t("periode.volgende")}
                  onClick={() => schuif(1)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-veld border border-lijn-veld text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
                >
                  <IcoonPijlRechts className="h-4 w-4" />
                </button>

                <h2 className="ml-1 min-w-0 truncate font-display text-[1.375rem] text-inkt sm:text-[1.625rem]">
                  {ankerLabel}
                </h2>

                {weekLabel ? (
                  <span className="mono shrink-0 rounded-full bg-vlak-diep px-2.5 py-1 text-[0.6875rem] font-medium text-inkt-zacht">
                    {weekLabel}
                  </span>
                ) : null}

                {/* Which period this day belongs to, beside the day rather than in the page title: the
                    calendar now spans the whole year, so the period changes while the screen does not. */}
                <span className="shrink-0 rounded-full bg-vlak-diep px-2.5 py-1 text-[0.6875rem] font-medium text-inkt-zacht">
                  {blok
                    ? `${t("periode.periodeLabel")} ${periodeTekst(blok.start, blok.eind)}`
                    : t("periode.tussenPeriodes")}
                </span>

                {themaNamen.length > 0 ? (
                  <span className="min-w-0 max-w-64 truncate rounded-full bg-vlak-diep px-2.5 py-1 text-[0.6875rem] font-medium text-inkt-zacht">
                    {themaNamen.length === 1
                      ? themaNamen[0]
                      : t("periode.themaMeer", { naam: themaNamen[0], aantal: themaNamen.length - 1 })}
                    {enigeSubthema ? ` · ${enigeSubthema}` : ""}
                  </span>
                ) : null}
              </div>

              {/* The button when there is a today to go to, and the reason when there is not. Never a
                  dead control: in augustus the school year has not started and no day is today. */}
              {vandaagBereikbaar ? (
                <button
                  type="button"
                  onClick={() => ga({ datum: nu })}
                  className="inline-flex h-9 shrink-0 items-center rounded-veld border border-lijn-veld px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
                >
                  {t("periode.vandaag")}
                </button>
              ) : (
                <p className="text-meta text-inkt-zwak">{t("periode.vandaagBuitenSchooljaar")}</p>
              )}
            </div>
          </div>
        }
      />

      <Schermvlak breed>
        <Dekkingsbalk klasId={klasId} />

        <div className="border-t border-lijn" />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements: kalenderMeldingen((id) => opNaam.get(id) ?? ""), screenReaderInstructions: sleepUitleg }}
          onDragStart={begin}
          onDragEnd={laatLos}
          onDragCancel={() => setSleepNaam(null)}
        >
          <div className="mt-3">
            {isPending || !planning ? (
              <Laadvlak className="h-72" />
            ) : heelBereikBuiten ? (
              <Leegte
                titel={t("periode.heelBereikBuiten")}
                actie={
                  rooster ? (
                    <Knop onClick={() => ga({ datum: klem(nu, rooster.start, rooster.eind) })}>
                      {t("periode.naarHetSchooljaar", { datum: volleDag(klem(nu, rooster.start, rooster.eind)) })}
                    </Knop>
                  ) : undefined
                }
              />
            ) : weergave === "maand" ? (
              <Maandrooster
                dagen={zichtbareDagen}
                ankerMaand={anker}
                periodeVan={blok?.start ?? van}
                periodeTot={blok?.eind ?? tot}
                onKiesDag={openDag}
                onVoegToe={(datum) => setKiezer({ datum, slot: 0 })}
                onOpen={(activiteit, datum) => setGeopend({ activiteit, datum })}
              />
            ) : weergave === "dag" ? (
              /* One day is a row of lesuren, not one tall cell: a teacher planning a Tuesday is
                 deciding WHEN inside that Tuesday, and Volgorde already carried that. */
              <Lesurenraster
                dag={zichtbareDagen[0] ?? leegteDag(anker)}
                onVoegToe={(datum, slot) => setKiezer({ datum, slot })}
                onOpen={(activiteit) => setGeopend({ activiteit, datum: anker })}
              />
            ) : (
              /* Week only now: the day view is the lesurenraster above. The conditionals that used to
                 ask "am I the day view?" are gone rather than left as always-false, because a branch
                 that can no longer be taken is a branch the next reader has to disprove. */
              <ul
                className={cn(
                  "grid grid-cols-1 gap-2",
                  // The columns reach down the page rather than stopping at their content, so a week
                  // of mostly empty days still reads as a week. Bounded at both ends: clamp keeps it
                  // off the floor of a short laptop and off the horizon of a tall monitor, and only
                  // from the width where a week is actually seven columns.
                  "sm:grid-cols-2 lg:grid-cols-4 xl:min-h-[clamp(22rem,calc(100dvh-19rem),40rem)] xl:grid-cols-7 xl:grid-rows-[1fr]",
                )}
              >
                {zichtbareDagen.map((dag) => (
                  <li key={dag.datum} className="min-w-0">
                    <Dagcel
                      dag={dag}
                      bovenkop={weekdagKort(dag.datum)}
                      kop={String(dagNummer(dag.datum))}
                      onVoegToe={(datum) => setKiezer({ datum, slot: 0 })}
                      onOpen={(activiteit) => setGeopend({ activiteit, datum: dag.datum })}
                      onKiesDag={openDag}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* An overlay rather than a transform on the card itself: a month cell clips its overflow,
              so the original would be dragged behind the walls of the day it started in. */}
          <DragOverlay dropAnimation={null}>
            {sleepNaam ? (
              <span className="block max-w-56 truncate rounded-veld border-l-2 border-accent bg-kaart px-2.5 py-2 text-meta font-medium text-inkt shadow-lg">
                {sleepNaam}
              </span>
            ) : null}
          </DragOverlay>
        </DndContext>

        {acties.plaats.isError || acties.verplaats.isError ? (
          <p className="mt-4 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
            {foutTekst(acties.plaats.error ?? acties.verplaats.error)}
          </p>
        ) : null}
      </Schermvlak>

      <Activiteitkiezer
        datum={kiezer?.datum ?? null}
        lesuur={kiezer ? kiezer.slot + 1 : undefined}
        klasId={klasId}
        themaIds={themaIdsInPeriode}
        bezig={bezig}
        onSluit={() => setKiezer(null)}
        onKies={(activiteitId) => {
          if (!kiezer) return;
          acties.plaats.mutate(
            { activiteitId, datum: kiezer.datum, volgorde: kiezer.slot },
            { onSuccess: () => setKiezer(null) },
          );
        }}
      />

      <Subthemaplanner
        open={plannerOpen}
        klasId={klasId}
        themaIds={themaIdsInPeriode}
        dagen={heelDePeriode?.dagen ?? []}
        bezig={acties.plaats.isPending}
        resultaat={plannerResultaat}
        onSluit={() => setPlannerOpen(false)}
        onPlan={async (voorstellen: Voorstel[]) => {
          // One POST per activiteit, in order, and the failures are collected rather than thrown.
          // Sequential on purpose: the server enforces one activiteit per day per plan, and firing
          // them in parallel makes the order in which two of them collide a matter of chance.
          const fouten: string[] = [];
          let gelukt = 0;
          for (const voorstel of voorstellen) {
            try {
              await acties.plaats.mutateAsync({ activiteitId: voorstel.activiteitId, datum: voorstel.datum });
              gelukt += 1;
            } catch (fout) {
              const reden = fout instanceof ApiError && fout.detail ? fout.detail : t("periode.mislukt");
              fouten.push(`${voorstel.activiteitNaam}: ${reden}`);
            }
          }
          setPlannerResultaat({ gelukt, totaal: voorstellen.length, fouten });
          if (fouten.length === 0) setPlannerOpen(false);
        }}
      />

      <Activiteitblad
        // Keyed on the plaatsing: the sheet fills its fields from the activiteit at mount, so a new
        // activiteit needs a new instance or it shows the previous one's values.
        key={geopend?.activiteit.plaatsingId ?? "leeg"}
        activiteit={geopend?.activiteit ?? null}
        datum={geopend?.datum ?? ""}
        klasId={klasId}
        vroegste={rooster?.start ?? ""}
        laatste={rooster?.eind ?? ""}
        bezig={bezig}
        fout={foutTekst(acties.verplaats.error ?? acties.verwijder.error)}
        onSluit={() => setGeopend(null)}
        onVerplaats={(datum) => {
          if (!geopend) return;
          acties.verplaats.mutate(
            { plaatsingId: geopend.activiteit.plaatsingId, datum },
            {
              onSuccess: () => {
                setGeopend(null);
                // Follow the activiteit to its new day. Without this the day view keeps showing the
                // day it LEFT, so a successful move looks exactly like the activiteit being deleted:
                // the sheet closes and the card is gone. Measured by doing it.
                ga({ datum });
              },
            },
          );
        }}
        onVerwijder={() => {
          if (!geopend) return;
          acties.verwijder.mutate(geopend.activiteit.plaatsingId, { onSuccess: () => setGeopend(null) });
        }}
      />
    </>
  );
}
