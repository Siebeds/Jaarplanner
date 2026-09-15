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
import {
  IcoonActiviteit,
  IcoonFiche,
  IcoonHoek,
  IcoonPijlLinks,
  IcoonPijlRechts,
  IcoonPlus,
} from "../../components/Iconen";
import { useDagacties, useJaarplan, usePlaatsSubthemaperiode, useRooster, useWeekplanning } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { isGeenToegang, useRechten } from "../../lib/rechten";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import { Agendamelding } from "./Agendamelding";
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
  weeknummer,
} from "../../lib/datum";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { useMediaQuery, BREED } from "../../lib/scherm";
import { Maandrooster } from "./Maandrooster";
import { Tijdraster, type Ficheblokje, type Hoekblokje, type Tijddoel } from "./Tijdraster";
import { STANDAARDBEGIN, alsTijd, minuten, toonTijd } from "./tijd";
import { beginSleep, doelTijd, eindigSleep, leesKolomId } from "./tijdsleep";
import { eindeVan, type Gevraagdeplek } from "./gevraagdeplek";
import { Activiteitkiezer } from "./Activiteitkiezer";
import { Dagonderschrift } from "./Dagonderschrift";
import { weekInBeeld } from "./weekInBeeld";
import { leesWeergave, weergaveZoek, type Weergave } from "./weergave";
import { Activiteitblad } from "./Activiteitblad";
import { Nieuweactiviteitblad } from "./Nieuweactiviteitblad";
import { Subthemaplanner } from "./Subthemaplanner";
import { Activiteitplaatsingblad } from "./Activiteitplaatsingblad";
import { kaartLanding, leesActiviteitkaartId, type Activiteitkaartdata } from "./activiteitkaart";
import type { Activiteitenweek, GekozenActiviteit } from "./Activiteitensectie";
import { Hoekenpaneel } from "../hoeken/Hoekenpaneel";
import { FICHE_VOORVOEGSEL, leesFicheId, momentSleepId } from "../hoeken/sleepids";
import { Hoekplaatsingblad } from "../hoeken/Hoekplaatsingblad";
import { Hoekdetailblad } from "../hoeken/Hoekdetailblad";
import {
  useHoekplaatsingen,
  usePlaatsHoek,
  useVerplaatsHoekmoment,
  useVerwijderHoekplaatsing,
  useHoeken,
} from "../hoeken/gegevens";
import { Algemeneficheplaatsingblad } from "../algemene-fiches/Algemeneficheplaatsingblad";
import { Algemenefichedetailblad } from "../algemene-fiches/Algemenefichedetailblad";
import {
  alsInfodoelen,
  useAlgemeneFicheplaatsingen,
  useAlgemeneFiches,
  usePlaatsAlgemeneFiche,
  useVerplaatsFichemoment,
  useVerwijderAlgemeneFicheplaatsing,
} from "../algemene-fiches/gegevens";
import { ALGEMENE_FICHE_VOORVOEGSEL, fichemomentSleepId, leesAlgemeneFicheId } from "../algemene-fiches/sleepids";
import { useSchooluren } from "../schooluren/gegevens";
import { roosterdagen } from "./roosterdagen";
import { reeksbereik, reeksenPerDag, subthemareeksen, subthemasInWeek, voorstelReeks } from "./subthemareeksen";
import { themaIdsOpDag, themavakken } from "./themavakken";
import { Dekkingsbalk } from "../dekking/Dekkingsbalk";
import { kalenderMeldingen, sleepUitleg, useSleepSensors } from "./sleep";

/** A day with nothing on it, for the render before the range is known. */
function leegteDag(datum: string) {
  return { datum, isLesdag: true, sluitingsnaam: null, activiteiten: [], buitenSchooljaar: false };
}

/**
 * The agenda: the school year as a calendar, opening on the week (FR-6.2, FR-7.2).
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
 *
 * **Every write here is the klas's planning, which is directie's and the klas's own leerkrachten'** (E6-02,
 * ADR-0030 §3, R7, R15). Everyone else reads any klas's agenda (I9): the same calendar with nothing that adds, drags,
 * stretches or plans, and one quiet line that says so, because a teacher who switched to a colleague's klas would
 * otherwise meet her own agenda with its controls gone and no reason. An activiteit's content is a different right
 * (the leeftijd's), so a block still opens its form for whoever holds that one.
 */
export function Agendascherm() {
  const { datum: routeDatum } = useParams<{ datum: string }>();
  const [zoek] = useSearchParams();
  const navigeer = useNavigate();
  const { klasId, klas, schooljaarId } = useActieveSelectie();
  // `bekend`, not "not loading": a failed `/api/ik` proves nothing about rights, so the quiet line waits for an answer
  // with a gebruiker in it (fix round 1, F3).
  const { mag, bekend: rechtenBekend } = useRechten();
  const magPlannen = mag.klasplanningBewerken(klasId);
  // Whether a subthema can be made for this klas's leeftijd, for the planner's empty state: the sentence that tells a
  // teacher to go and make one, and the links that take her there, are only for whoever may (R5, R21).
  const magSubthemaMaken = (klas?.jaarFasen ?? []).some((leeftijd) => mag.subthemaBeheren(leeftijd));

  // The day AND the minute of it the picker was opened from (ADR-0028). The month view has no hours to press, so
  // it passes the ordinary start of a morning and the teacher drags the block from there. An `einde` means the
  // teacher dragged out the stretch in the time grid (TB-014), and that stretch wins over the activiteit's length.
  const [kiezer, setKiezer] = useState<Gevraagdeplek | null>(null);
  const [geopend, setGeopend] = useState<{ activiteit: GeplandeActiviteit; datum: string } | null>(null);
  // Making an activiteit that does not exist yet, for the day and the hour (or the stretch) the picker was on.
  const [nieuw, setNieuw] = useState<Gevraagdeplek | null>(null);
  const [sleepNaam, setSleepNaam] = useState<string | null>(null);
  // Why a drop was refused before any request went out. Cleared at the start of the next drag, so it
  // describes the last thing she tried rather than accumulating.
  const [sleepFout, setSleepFout] = useState<string | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerResultaat, setPlannerResultaat] = useState<{ gelukt: number; totaal: number; fouten: string[] } | null>(
    null,
  );

  const paneelOpen = useHoekenpaneel((s) => s.open);
  const paneelSoort = useHoekenpaneel((s) => s.soort);
  const kiesPaneel = useHoekenpaneel((s) => s.kies);
  // The fiche that was dropped, the day it landed on, and the minute of it when the drop named one. Null means no
  // sheet; a null `begin` means the gesture said nothing about an hour, which is what a month or week drop is.
  const [gevallenFiche, setGevallenFiche] = useState<{ hoekId: string; datum: string; begin: number | null } | null>(
    null,
  );
  // The placement whose detail sheet is open, by id rather than by value: the list is refetched after
  // a delete, and holding a copy would keep a sheet describing a row that is gone.
  const [geopendeHoek, setGeopendeHoek] = useState<string | null>(null);
  // The same pair for an algemene fiche (ADR-0029): the one that landed, and the planned one that is open. The open
  // one also remembers the occurrence it was opened from, because that day is what its sheet lets her change without
  // a drag; opened from a list of whole periods it names none.
  const [gevallenAlgemeneFiche, setGevallenAlgemeneFiche] = useState<{
    ficheId: string;
    datum: string;
    begin: number | null;
  } | null>(null);
  const [geopendeFiche, setGeopendeFiche] = useState<{ plaatsingId: string; momentId: string | null } | null>(null);
  // An activiteit card from the side panel that was clicked, or dropped where the drop named no hour (FB-017): the day
  // it starts from, and the minute when there was one. A drop on an hour of the time grid plans it without asking.
  const [gekozenActiviteit, setGekozenActiviteit] = useState<
    (GekozenActiviteit & { datum: string; begin: number | null }) | null
  >(null);

  const { data: rooster } = useRooster(schooljaarId);
  const { data: plan, isSuccess: planGeladen } = useJaarplan(klasId);
  const acties = useDagacties(klasId ?? "");
  const plaatsSubthema = usePlaatsSubthemaperiode(klasId);
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
  /**
   * A WEEK IS SEVEN COLUMNS ON A DESKTOP AND THREE ON A PHONE (ADR-0028).
   *
   * Seven time columns need about 90 pixels each before a block can hold a name; on 390 pixels that is 50, which is
   * a column of truncated first letters. Three days is what every phone calendar settles on, and the month view,
   * which does show a whole week at a glance, is one press away.
   */
  const breed = useMediaQuery(BREED);
  const weekdagen = weergave === "week" && !breed ? 3 : 7;
  const vandaagBereikbaar = rooster ? valtBinnen(nu, rooster.start, rooster.eind) : false;

  /**
   * Move the agenda. `push` only where the teacher drilled IN, so the back button climbs back out to
   * the month or week they came from; paging through weeks replaces, or a morning of browsing buries
   * every other page in the history.
   */
  function ga(volgende: { datum?: string; weergave?: Weergave; push?: boolean }) {
    const datum = volgende.datum ?? anker;
    const zicht = volgende.weergave ?? weergave;
    navigeer(`/agenda/dag/${datum}${weergaveZoek(zicht)}`, { replace: !volgende.push });
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
      // On a phone the three days START at the anchored day rather than at its Monday: a teacher who opened
      // Thursday wants Thursday, and snapping back to Monday would hide the day she came from.
      if (weekdagen < 7) return [anker, verschuif(anker, weekdagen - 1)];
      const maandag = maandagVan(anker);
      return [maandag, verschuif(maandag, 6)];
    }
    return [anker, anker];
  }, [anker, weergave, weekdagen]);

  const { data: planning, isPending } = useWeekplanning(klasId, van, tot);

  // The hoeken running in the visible range, read separately from the weekplanning: a hoekplaatsing
  // is not part of the jaarplan, so it is not part of the read model that projects one.
  const { data: hoekplaatsingen } = useHoekplaatsingen(klasId, van, tot);
  // Every run of every corner over the whole school year, for the placement sheet's "Al ingepland"
  // (owner, 2026-09-10). The visible range above is not enough: a teacher planning the boekenhoek in
  // november needs to see that it already ran in september, which the month on screen does not reach.
  const { data: jaarHoekplaatsingen } = useHoekplaatsingen(klasId, rooster?.start ?? "", rooster?.eind ?? "");
  const { data: hoeken } = useHoeken(klasId);
  const plaatsHoek = usePlaatsHoek(klasId);
  const verwijderPlaatsing = useVerwijderHoekplaatsing();
  const verplaatsMoment = useVerplaatsHoekmoment();

  // The algemene fiches, read the way the hoeken are and for the same reasons: their own request over the visible
  // range, and a second one over the whole year for the placement sheet's "Al ingepland".
  const { data: fichePlaatsingen } = useAlgemeneFicheplaatsingen(klasId, van, tot);
  const { data: jaarFichePlaatsingen } = useAlgemeneFicheplaatsingen(klasId, rooster?.start ?? "", rooster?.eind ?? "");
  const { data: algemeneFiches } = useAlgemeneFiches(klasId);

  // The school's hours (FB-023), one set for every klas: where the time grid opens and what it shades.
  const { data: schooluren } = useSchooluren();
  const plaatsFiche = usePlaatsAlgemeneFiche(klasId);
  const verwijderFichePlaatsing = useVerwijderAlgemeneFicheplaatsing();
  const verplaatsFichemoment = useVerplaatsFichemoment();

  // The planner spreads over the whole period, so it needs every day of it rather than the days the
  // current view happens to be showing. A separate query with its own key: asking the view's query
  // for a wider range would refetch the grid every time the teacher changed week.
  const { data: heelDePeriode } = useWeekplanning(klasId, blok?.start ?? "", blok?.eind ?? "");

  /**
   * THE RUNS ARE DERIVED OVER WHOLE PERIODES, NOT OVER WHAT IS ON SCREEN.
   *
   * A subthema run is measured from the first and last day carrying one of its activiteiten, so the
   * window it is measured in decides where it appears to start. Measured over the visible month, a
   * run that began in the last week of september would be reported as starting on 1 october, and the
   * strip on that cell would say a period begins on a day it does not.
   *
   * So the window is the union of every themaperiode the view touches. That is a superset of the
   * grid, which is what makes the answer for every visible day the same answer it would get from a
   * whole year. When the union adds nothing the range is identical to the grid's own and TanStack
   * hands back the same cached response rather than a second request.
   */
  // The whole week of the anchored day is in it too, which the activiteiten list speaks about (`reeksbereik`).
  const [reeksVan, reeksTot] = useMemo(
    () => reeksbereik(van, tot, anker, rooster?.blokken ?? []),
    [van, tot, anker, rooster],
  );

  const { data: reeksbron, isError: reeksbronMislukt } = useWeekplanning(klasId, reeksVan, reeksTot);

  const reeksen = useMemo(
    () => subthemareeksen(reeksbron?.dagen ?? [], rooster?.blokken ?? [], reeksbron?.subthemaperiodes ?? []),
    [reeksbron, rooster],
  );
  const stroken = useMemo(() => reeksenPerDag(reeksen), [reeksen]);

  /**
   * The hoek appearances of the visible range, as blocks the time grid can draw.
   *
   * Built from the placements' own momenten rather than from their windows: a moment is a row a
   * teacher can move on its own, so a hoek running all fortnight can genuinely sit after lunch on
   * Monday and in the morning on Thursday. Deriving it from the window would draw the same hour
   * every day and quietly contradict what is stored.
   *
   * The placement id travels with the name because a block opens the placement, which is the same
   * sheet the panel's period row opens.
   */
  const hoekblokjes = useMemo<Hoekblokje[]>(
    () =>
      (hoekplaatsingen ?? []).flatMap((plaatsing) =>
        plaatsing.momenten.map((moment) => ({
          plaatsingId: plaatsing.id,
          momentId: moment.id,
          naam: plaatsing.hoekNaam,
          datum: moment.datum,
          begin: moment.begin,
          einde: moment.einde,
        })),
      ),
    [hoekplaatsingen],
  );

  // The algemene fiches' occurrences, built the same way and for the same reason: each is a row she can move alone.
  // Each carries its fiche's goals for the block's info icon (FB-018), read from the fiche list rather than from the
  // placement, which does not carry them.
  const ficheblokjes = useMemo<Ficheblokje[]>(() => {
    const doelenPerFiche = new Map((algemeneFiches ?? []).map((fiche) => [fiche.id, alsInfodoelen(fiche.doelen)]));
    return (fichePlaatsingen ?? []).flatMap((plaatsing) =>
      plaatsing.momenten.map((moment) => ({
        plaatsingId: plaatsing.id,
        momentId: moment.id,
        naam: plaatsing.ficheNaam,
        datum: moment.datum,
        begin: moment.begin,
        einde: moment.einde,
        doelen: doelenPerFiche.get(plaatsing.algemeneFicheId),
      })),
    );
  }, [fichePlaatsingen, algemeneFiches]);

  /**
   * The subthema runs as the placement sheet wants them: a name and a window.
   *
   * Derived from the same `reeksen` the calendar draws, so the sheet cannot tell a teacher a subthema
   * runs on days the grid behind it leaves blank.
   *
   * *This comment sat above `hoekenPerSlot` from 2026-08-30 until 2026-08-31, describing the wrong
   * declaration. Recorded rather than silently moved, because it is the second stray comment in this
   * file and both times the code below it read plausibly enough to keep it there.*
   */
  const looptSubthema = useMemo(
    () => reeksen.map((reeks) => ({ naam: reeks.subthemaNaam, van: reeks.van, tot: reeks.tot })),
    [reeksen],
  );

  /**
   * The week the activiteiten list opens on (FB-017), and the subthema's running in it.
   *
   * The WEEK of the anchored day, Monday to Sunday, whatever the view: the owner asked for "het subthema van die week",
   * and a day would miss a subthema that starts on Wednesday. The list names it by number, since in the month view it
   * is not a week the screen singles out. Until the runs are read it says so rather than passing an empty list, which
   * would read as "nothing runs".
   */
  const activiteitenWeek = useMemo<Activiteitenweek>(() => {
    const maandag = maandagVan(anker);
    return {
      maandag,
      nummer: weeknummer(maandag),
      lopend: reeksbron ? subthemasInWeek(reeksen, maandag) : reeksbronMislukt ? "mislukt" : "laadt",
    };
  }, [anker, reeksbron, reeksbronMislukt, reeksen]);

  /**
   * EVERY THEMAPERIODE OF THE YEAR, WITH THE THEMA'S PLACED IN IT.
   *
   * Not "the period the teacher is in": that is what went wrong. `blok` is the period containing the
   * ANCHORED DAY, and the month grid shows a whole month, so as soon as the anchor drifted into the
   * neighbouring period the header described days that were not on screen. Paging a month keeps the
   * day of the month and this year's periods end on the 1st, so the drift was systematic rather than
   * a corner case. The cells now each look their own day up. See `themavakken`.
   */
  const vakken = useMemo(
    () => themavakken(rooster?.blokken ?? [], plan?.plaatsingen ?? []),
    [rooster, plan],
  );

  // The thema's running in this period are what the activity picker may offer.
  const themaIdsInPeriode = useMemo(() => {
    const ids = (plan?.plaatsingen ?? [])
      .filter((plaatsing) => plaatsing.blokStart === blok?.start && plaatsing.status !== "Geweigerd")
      .map((plaatsing) => plaatsing.themaId);
    return [...new Set(ids)];
  }, [plan, blok]);

  const bezig = acties.plaats.isPending || acties.verplaats.isPending || acties.verwijder.isPending;

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

  // Every DRAGGABLE thing on screen, by the id dnd-kit will hand back, so a drag announcement and the
  // overlay can name the thing being carried after the grid has re-rendered without it.
  //
  // The hoekenfiches are in here under their prefixed id (owner, 2026-08-31). Without them a fiche
  // drag carried nothing visible and the announcer said "op woensdag 14 oktober gezet" with an empty
  // name, which is the one gesture in this agenda where a teacher most needs to see what she has hold
  // of: the panel is chrome and the fiche leaves it.
  const opNaam = useMemo(() => {
    const kaart = new Map<string, string>();
    for (const dag of planning?.dagen ?? []) {
      for (const activiteit of dag.activiteiten) kaart.set(activiteit.plaatsingId, activiteit.activiteitNaam);
    }
    for (const hoek of hoeken ?? []) kaart.set(`${FICHE_VOORVOEGSEL}${hoek.id}`, hoek.naam);
    // The appearances of a placed hoek too, since 2026-08-31: they drag inside the lesurenraster, and a
    // drag that names nothing is what this map exists to prevent.
    for (const plaatsing of hoekplaatsingen ?? []) {
      for (const moment of plaatsing.momenten) {
        kaart.set(momentSleepId(plaatsing.id, moment.id), plaatsing.hoekNaam);
      }
    }
    // The algemene fiches, from the panel and in the grid, for the same reason.
    for (const fiche of algemeneFiches ?? []) kaart.set(`${ALGEMENE_FICHE_VOORVOEGSEL}${fiche.id}`, fiche.naam);
    for (const plaatsing of fichePlaatsingen ?? []) {
      for (const moment of plaatsing.momenten) {
        kaart.set(fichemomentSleepId(plaatsing.id, moment.id), plaatsing.ficheNaam);
      }
    }
    return kaart;
  }, [planning, hoeken, hoekplaatsingen, algemeneFiches, fichePlaatsingen]);

  function schuif(richting: -1 | 1) {
    // A week view showing three days pages by three, so nothing is skipped and nothing repeats.
    if (weergave === "maand") ga({ datum: verschuifMaanden(anker, richting) });
    else if (weergave === "week") ga({ datum: verschuif(anker, richting * weekdagen) });
    else ga({ datum: verschuif(anker, richting) });
  }

  /**
   * The name of whatever is being dragged: from `opNaam` for everything already on screen, and for an activiteit card
   * from the panel from the card's own drag data, because the agenda does not load that list (`activiteitkaart.ts`).
   */
  function sleepnaam(sleepId: string, data?: unknown): string | undefined {
    const bekend = opNaam.get(sleepId);
    if (bekend !== undefined) return bekend;
    return leesActiviteitkaartId(sleepId) !== null ? (data as Activiteitkaartdata | undefined)?.naam : undefined;
  }

  function begin(gebeurtenis: DragStartEvent) {
    setSleepNaam(sleepnaam(String(gebeurtenis.active.id), gebeurtenis.active.data.current) ?? null);
    // Starts following the pointer, which is the only thing a fiche from the panel and a block in the grid have in
    // common; see `tijdsleep`. Ended in both `laatLos` and the cancel handler, so the listener never outlives a drag.
    beginSleep(gebeurtenis);
  }

  /**
   * Every block on screen, by the id dnd-kit hands back: which day it is on, how long it runs, and which endpoint
   * owns it. A drop needs all three, and looking them up twice (once for the activiteiten, once for the hoeken) is
   * what made the old handler a hundred lines.
   */
  const blokOpSleepId = useMemo(() => {
    const kaart = new Map<string, { datum: string; begin: number; duur: number; doel: Tijddoel }>();

    for (const dag of planning?.dagen ?? []) {
      for (const activiteit of dag.activiteiten) {
        kaart.set(activiteit.plaatsingId, {
          datum: dag.datum,
          begin: minuten(activiteit.begin),
          duur: minuten(activiteit.einde) - minuten(activiteit.begin),
          doel: { soort: "activiteit", plaatsingId: activiteit.plaatsingId },
        });
      }
    }

    for (const blokje of hoekblokjes) {
      kaart.set(momentSleepId(blokje.plaatsingId, blokje.momentId), {
        datum: blokje.datum,
        begin: minuten(blokje.begin),
        duur: minuten(blokje.einde) - minuten(blokje.begin),
        doel: { soort: "hoek", plaatsingId: blokje.plaatsingId, momentId: blokje.momentId },
      });
    }

    for (const blokje of ficheblokjes) {
      kaart.set(fichemomentSleepId(blokje.plaatsingId, blokje.momentId), {
        datum: blokje.datum,
        begin: minuten(blokje.begin),
        duur: minuten(blokje.einde) - minuten(blokje.begin),
        doel: { soort: "fiche", plaatsingId: blokje.plaatsingId, momentId: blokje.momentId },
      });
    }

    return kaart;
  }, [planning, hoekblokjes, ficheblokjes]);

  /**
   * Saves a block's day and times, through whichever endpoint owns its kind.
   *
   * The one place either mutation is fired from a gesture, so a drag and a resize cannot end up sending different
   * shapes: both are "this block, this day, from here to there".
   */
  function bewaarTijd(doel: Tijddoel, datum: string, begin: number, einde: number) {
    if (doel.soort === "activiteit") {
      acties.verplaats.mutate({
        plaatsingId: doel.plaatsingId,
        datum,
        begin: alsTijd(begin),
        einde: alsTijd(einde),
      });
    } else if (doel.soort === "hoek") {
      verplaatsMoment.mutate({
        plaatsingId: doel.plaatsingId,
        momentId: doel.momentId,
        datum,
        begin: alsTijd(begin),
        einde: alsTijd(einde),
      });
    } else {
      verplaatsFichemoment.mutate({
        plaatsingId: doel.plaatsingId,
        momentId: doel.momentId,
        datum,
        begin: alsTijd(begin),
        einde: alsTijd(einde),
      });
    }
  }

  function laatLos({ active, over }: DragEndEvent) {
    setSleepNaam(null);
    setSleepFout(null);
    acties.verplaats.reset();
    verplaatsMoment.reset();
    verplaatsFichemoment.reset();

    const sleepId = String(active.id);
    // Two kinds of target. A column of the time grid names a day AND, through the pointer, an hour; a month cell
    // names only a day. Both are legitimate, and the difference is what the block keeps.
    const kolom = over === null ? null : leesKolomId(String(over.id));

    // THE HOUR IS READ BEFORE THE POINTER IS FORGOTTEN, and the order is the whole of it. `eindigSleep` clears the
    // last pointer position, so calling it first made `doelTijd` answer null on every drop: the block changed day
    // and kept its old time, silently, while the preview had shown the right one. Found in a browser, by dragging
    // one across two hours and reading the label back.
    const doelBegin = kolom === null ? null : doelTijd(kolom);
    eindigSleep();

    if (!over) return;
    const datum = kolom ?? String(over.id);

    // TWO KINDS OF DRAGGED THING, and the id says which (see `sleepids.ts`). A hoekfiche comes from the panel and
    // has no placement yet, so it opens the sheet instead of moving anything: which days, with what in it and at
    // what time are three questions a drop cannot answer.
    const hoekId = leesFicheId(sleepId);
    if (hoekId !== null) {
      // The hour is kept when the drop landed on one. A month cell says nothing about an hour, so the sheet gets
      // null and offers its own default rather than inventing one from where the pointer happened to be.
      plaatsHoek.reset();
      setGevallenFiche({ hoekId, datum, begin: doelBegin });
      return;
    }

    // An algemene fiche from the panel is the same case with one more question (which weekdays), so it opens its own
    // sheet with the same three facts the drop carries.
    const algemeneFicheId = leesAlgemeneFicheId(sleepId);
    if (algemeneFicheId !== null) {
      plaatsFiche.reset();
      setGevallenAlgemeneFiche({ ficheId: algemeneFicheId, datum, begin: doelBegin });
      return;
    }

    // An activiteit card from the panel (FB-017). Unlike a fiche it has one question only, when, and a drop on an hour
    // of the time grid answers it: the block is planned there, with the activiteit's own length. A month cell or a
    // keyboard drop names no hour, so they open the sheet on that day, as a click does on the day the agenda is on.
    const kaartId = leesActiviteitkaartId(sleepId);
    if (kaartId !== null) {
      const kaart = active.data.current as Activiteitkaartdata | undefined;
      if (!kaart) return;
      acties.plaats.reset();
      const landing = kaartLanding(kaart, doelBegin);
      if (landing) {
        acties.plaats.mutate({ activiteitId: kaartId, datum, begin: alsTijd(landing.begin), einde: alsTijd(landing.einde) });
      } else {
        setGekozenActiviteit({ id: kaartId, naam: kaart.naam, duur: kaart.duur, datum, begin: null });
      }
      return;
    }

    const blok = blokOpSleepId.get(sleepId);
    // Not on the days in hand. Only reachable if the grid and the fetched range disagree, and there is nothing
    // honest to send: without the block's own duration a move would have to invent an end time.
    if (!blok) return;

    // A drop onto a month cell says nothing about the hour, so the hour is KEPT. Taking a default would quietly
    // move an afternoon activiteit to the morning every time a teacher dragged it across the month, which is a
    // change nobody asked for hidden inside one they did. The same fallback covers a keyboard drag, which names
    // no pointer position either.
    const begin = doelBegin ?? blok.begin;

    // Landing where it already is, is a legal target and a no-op. Firing the mutation anyway would make the grid
    // flicker and the server answer a question nobody asked.
    if (blok.datum === datum && begin === blok.begin) return;

    bewaarTijd(blok.doel, datum, begin, begin + blok.duur);
  }

  // The range the teacher is looking at, said big. It used to be meta text beside the arrows, which
  // made the one thing that changes when you press them the smallest thing on the screen.
  const ankerLabel =
    weergave === "maand" ? maandJaar(anker) : weergave === "week" ? periodeTekst(van, tot) : volleDag(anker);

  // Only where the days in view are one week: see `weekInBeeld`.
  const weekNummer = weekInBeeld(weergave, van, tot);
  const weekLabel = weekNummer === null ? null : t("periode.weeknummer", { nummer: weekNummer });

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
                className="inline-flex h-9 items-center rounded-veld border border-lijn px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
              >
                {t("periode.themasPerPeriode")}
              </Link>

              {/*
                THE HOEKENFICHES SWITCH IS IN THE SIDEBAR FROM `lg`, AND THIS IS WHAT IS LEFT OF IT
                BELOW THAT.

                The owner asked for the switch in the sidepane (2026-08-31), and a sidepane exists
                only from `lg`: below it the navigation is a bottom bar of five tabs with no room for
                a sixth, while the panel still has to be reachable on a phone, where it opens as a
                sheet. So this chip is `lg:hidden` and `Navigatie` carries the switch from `lg`
                upward. One control per viewport, never two at once, which is what made a single
                control in the toolbar the earlier answer.

                Only for whoever may plan this klas: a fiche is dragged or clicked to plan a hoek.
              */}
              {/* Two chips since 2026-09-14, one per list, for the reason the sidebar has two switches (owner: "twee
                  secties ... niet gegroepeerd als fiches"), and a third for the activiteiten since 2026-09-15 (FB-017).
                  The fiche chips only for a gebruiker who may plan this klas; the activiteiten chip for everyone who
                  reads the agenda, whose cards then plan nothing (owner, 2026-09-15). */}
              {/* None until the rights are known, so the fiche chips do not appear before the activiteiten chip a moment
                  later, as the sidebar does. */}
              {([
                ...(magPlannen
                  ? ([
                      { soort: "hoeken", label: t("periode.hoekenfiches"), Icoon: IcoonHoek },
                      { soort: "algemeen", label: t("periode.algemeneFiches"), Icoon: IcoonFiche },
                    ] as const)
                  : []),
                { soort: "activiteiten", label: t("periode.activiteiten"), Icoon: IcoonActiviteit },
              ] as const)
                .filter(() => rechtenBekend)
                .map(({ soort, label, Icoon }) => {
                const aan = paneelOpen && paneelSoort === soort;
                return (
                  <button
                    key={soort}
                    type="button"
                    onClick={() => kiesPaneel(soort)}
                    aria-pressed={aan}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-veld border px-3 text-meta font-medium transition-colors duration-150 lg:hidden",
                      aan
                        ? "border-accent bg-accent-zacht text-accent"
                        : "border-lijn text-inkt-zacht hover:border-accent hover:text-accent",
                    )}
                  >
                    <Icoon aria-hidden="true" className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}

              {/* No period, no planner: the sheet spreads a subthema over the days of a themaperiode,
                  and between two periods there are none to spread it over. Nor for anyone who may not plan
                  this klas. */}
              {blok && magPlannen ? (
                <button
                  type="button"
                  onClick={() => {
                    setPlannerResultaat(null);
                    setPlannerOpen(true);
                  }}
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-veld bg-accent px-3 text-meta font-medium text-accent-op transition-colors duration-150 hover:bg-accent-diep"
                >
                  <IcoonPlus aria-hidden="true" className="h-4 w-4" />
                  {t("periode.planSubthema")}
                </button>
              ) : null}
            </div>

            {/* The range, its arrows and the way back to today, together and at heading size. Navigation
                next to the thing it moves: the arrows used to sit up in the chrome, three controls away
                from the only label that told you what pressing them had done. */}
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-start gap-2">
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

                <div className="ml-1 min-w-0">
                  {/* Wraps rather than truncates: beside the arrows a 320px screen has room for
                      "vrijdag 11 septem...", and the month is the half of the date that matters. */}
                  <h2 className="flex min-h-9 items-center font-display text-[1.375rem] leading-tight text-inkt sm:text-[1.625rem]">
                    {ankerLabel}
                  </h2>

                  <Dagonderschrift
                    weekLabel={weekLabel}
                    dagweergave={weergave === "dag"}
                    datum={anker}
                    schooljaar={rooster}
                    vakken={vakken}
                    planGeladen={planGeladen}
                  />
                </div>
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
        {/* Once, above everything, and only when it is true: the rights have answered and this gebruiker holds no
            planning right on the klas the picker shows. It names the klas, because the picker is what changed. */}
        {rechtenBekend && !magPlannen && klas ? (
          <p className="mb-3 text-meta text-inkt-zacht">{t("rechten.planningAlleenBekijken", { klas: klas.naam })}</p>
        ) : null}

        <Dekkingsbalk klasId={klasId} />

        <div className="border-t border-lijn" />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{
            announcements: kalenderMeldingen((id, data) => sleepnaam(id, data) ?? ""),
            screenReaderInstructions: sleepUitleg,
          }}
          onDragStart={begin}
          onDragEnd={laatLos}
          onDragCancel={() => {
            setSleepNaam(null);
            eindigSleep();
          }}
        >
          {/* INSIDE the context, and it has to be: a fiche is dragged FROM here ONTO the grid below,
              and dnd-kit registers a draggable through React context rather than through the DOM. The
              panel is `fixed`, so where it sits on screen owes nothing to where it sits in this tree.
              For a gebruiker who may not plan this klas it holds only the activiteiten, as cards that plan
              nothing (owner, 2026-09-15, FB-017): every fiche plans a hoek or an algemene fiche, and every create
              tile makes one. */}
          <Hoekenpaneel
              klasId={klasId}
              magPlannen={magPlannen}
              onKies={(hoekId) => {
                // A click has no landing point, so the window opens on the day the agenda is standing
                // on and the sheet offers its own default hour. On a phone the panel closes its own
                // sheet first; see `Hoekenpaneel`.
                plaatsHoek.reset();
                setGevallenFiche({ hoekId, datum: anker, begin: null });
              }}
              onKiesAlgemeneFiche={(ficheId) => {
                plaatsFiche.reset();
                setGevallenAlgemeneFiche({ ficheId, datum: anker, begin: null });
              }}
              activiteitenWeek={activiteitenWeek}
              onKiesActiviteit={(activiteit) => {
                acties.plaats.reset();
                setGekozenActiviteit({ ...activiteit, datum: anker, begin: null });
              }}
            />

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
                vakken={vakken}
                reeksenPerDag={stroken}
                hoekplaatsingen={hoekplaatsingen ?? []}
                magPlannen={magPlannen}
                onKiesDag={openDag}
                onVoegToe={(datum) => setKiezer({ datum, begin: STANDAARDBEGIN })}
                onOpen={(activiteit, datum) => setGeopend({ activiteit, datum })}
              />
            ) : (
              /* THE DAY AND THE WEEK ARE ONE GRID (ADR-0028), which is what makes them agree: they were a row of
                 lesuren and a row of day cards, and the same Tuesday looked like two different plans depending on
                 which button a teacher had pressed. The week is the same grid with more columns, three of them on
                 a phone. */
              <Tijdraster
                dagen={zichtbareDagen.length > 0 ? zichtbareDagen : [leegteDag(anker)]}
                hoekmomenten={hoekblokjes}
                fichemomenten={ficheblokjes}
                reeksenPerDag={stroken}
                vakken={vakken}
                schooluren={schooluren?.dagen}
                magPlannen={magPlannen}
                onVoegToe={(datum, tijd, einde) => setKiezer({ datum, begin: tijd, einde })}
                onOpen={(activiteit, datum) => setGeopend({ activiteit, datum })}
                onOpenHoek={(plaatsingId) => {
                  verwijderPlaatsing.reset();
                  setGeopendeHoek(plaatsingId);
                }}
                onOpenFiche={(plaatsingId, momentId) => {
                  verwijderFichePlaatsing.reset();
                  setGeopendeFiche({ plaatsingId, momentId });
                }}
                // In the week a column heading opens that day; in the day view it would go where it already is.
                onKiesDag={weergave === "week" ? openDag : undefined}
                onWijzigTijd={bewaarTijd}
              />
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

        {/* ONE STRIP FOR EVERYTHING A DRAG CAN GO WRONG WITH, because from the teacher side they are one
            thing: the drop did not do what she meant. `sleepFout` wins, since a refusal decided here
            fired no request and any server error beside it belongs to an earlier attempt.

            Told which sheets are open, as they render, so a refusal is announced where the teacher is (fix round 2,
            F7). The picker renders only while this gebruiker may plan. */}
        <Agendamelding
          sleepFout={sleepFout}
          fouten={[acties.plaats.error, acties.verplaats.error, verplaatsMoment.error, verplaatsFichemoment.error]}
          kiezerOpen={magPlannen && kiezer !== null}
          bladOpen={nieuw !== null || geopend !== null || plannerOpen || (magPlannen && gekozenActiviteit !== null)}
        />
      </Schermvlak>

      <Activiteitkiezer
        // Closed as soon as this gebruiker may not plan the klas, which after a 403 is the moment the refetched rights
        // arrive: the picker has no error line of its own, and left open it would go on offering choices the server
        // refuses while the reason sits behind it on the page (seen in the browser pass).
        datum={magPlannen ? (kiezer?.datum ?? null) : null}
        tijd={kiezer ? toonTijd(kiezer.begin) : undefined}
        eindtijd={kiezer?.einde !== undefined ? toonTijd(kiezer.einde) : undefined}
        klasId={klasId}
        themaIds={kiezer ? themaIdsOpDag(vakken, kiezer.datum) : []}
        bezig={bezig}
        onSluit={() => setKiezer(null)}
        onKies={(activiteitId, duur) => {
          if (!kiezer) return;
          acties.plaats.mutate(
            {
              activiteitId,
              datum: kiezer.datum,
              begin: alsTijd(kiezer.begin),
              // A stretch she dragged out wins over the activiteit's own length (`eindeVan` says why).
              einde: alsTijd(eindeVan(kiezer, duur)),
            },
            {
              onSuccess: () => setKiezer(null),
              // A refusal closes the picker at once rather than when the refetched rights arrive: the refusal's alert
              // mounts in the same render, and it can only take focus once no dialog holds it (fix round 1).
              onError: (fout) => {
                if (isGeenToegang(fout)) setKiezer(null);
              },
            },
          );
        }}
        onNieuw={() => {
          if (!kiezer) return;
          // The picker closes rather than staying underneath. Two sheets deep for one intention is a
          // stack the teacher has to unwind afterwards, and the new sheet names the day and the lesuur
          // the picker was standing on, so nothing is lost by leaving it.
          setKiezer(null);
          // A refusal left over from an earlier placement would otherwise be sitting inside the new
          // sheet, attached to a request nobody has made yet.
          acties.plaats.reset();
          setNieuw(kiezer);
        }}
      />

      {/* WHAT A DROPPED OR CLICKED FICHE OPENS.

          Keyed on the fiche and the day, so dropping a second corner refills the sheet instead of
          showing the first one's half-made window. Mounted only while a fiche has actually landed:
          the sheet's own state (which days, what text, which hours) is per drop and must not survive
          one. Opening one of its listed runs closes it, for the reason the Activiteitkiezer gives:
          two sheets deep for one intention is a stack she has to unwind. */}
      {gevallenFiche && rooster ? (
        <Hoekplaatsingblad
          open
          key={`${gevallenFiche.hoekId}-${gevallenFiche.datum}-${gevallenFiche.begin ?? "geen"}`}
          hoekId={gevallenFiche.hoekId}
          hoekNaam={(hoeken ?? []).find((h) => h.id === gevallenFiche.hoekId)?.naam ?? ""}
          startdag={gevallenFiche.datum}
          startuur={gevallenFiche.begin}
          loopt={looptSubthema}
          ingepland={(jaarHoekplaatsingen ?? []).filter((p) => p.hoekId === gevallenFiche.hoekId)}
          schooljaarVan={rooster.start}
          schooljaarTot={rooster.eind}
          bezig={plaatsHoek.isPending}
          fout={plaatsHoek.error}
          onOpenPlaatsing={(plaatsingId) => {
            setGevallenFiche(null);
            verwijderPlaatsing.reset();
            setGeopendeHoek(plaatsingId);
          }}
          onSluit={() => setGevallenFiche(null)}
          onPlaats={(invoer) =>
            plaatsHoek.mutate(invoer, { onSuccess: () => setGevallenFiche(null) })
          }
        />
      ) : null}

      {/* THE WAY BACK OUT, and the only screen that reads a verrijking back. Looked up by id on every
          render, so the sheet disappears by itself when the placement it describes does. In the
          year's list as well as the visible range's: the placement sheet opens runs from any month,
          and one outside the range on screen would otherwise open nothing at all. */}
      {(() => {
        const open =
          (hoekplaatsingen ?? []).find((p) => p.id === geopendeHoek) ??
          (jaarHoekplaatsingen ?? []).find((p) => p.id === geopendeHoek);
        return open ? (
          <Hoekdetailblad
            open
            plaatsing={open}
            alleenLezen={!magPlannen}
            bezig={verwijderPlaatsing.isPending}
            fout={verwijderPlaatsing.error}
            onSluit={() => setGeopendeHoek(null)}
            onVerwijder={() =>
              verwijderPlaatsing.mutate(open.id, { onSuccess: () => setGeopendeHoek(null) })
            }
          />
        ) : null;
      })()}

      {/* THE ALGEMENE FICHE'S PAIR OF SHEETS, arranged as the hoek's pair above and for the same reasons: the
          placement sheet is mounted only while a fiche has landed and keyed on the drop, and the detail sheet is
          looked up by id on every render, in the visible range and in the year, so it disappears with its row. */}
      {gevallenAlgemeneFiche && rooster ? (
        <Algemeneficheplaatsingblad
          open
          key={`${gevallenAlgemeneFiche.ficheId}-${gevallenAlgemeneFiche.datum}-${gevallenAlgemeneFiche.begin ?? "geen"}`}
          ficheId={gevallenAlgemeneFiche.ficheId}
          ficheNaam={(algemeneFiches ?? []).find((f) => f.id === gevallenAlgemeneFiche.ficheId)?.naam ?? ""}
          startdag={gevallenAlgemeneFiche.datum}
          startuur={gevallenAlgemeneFiche.begin}
          loopt={looptSubthema}
          ingepland={(jaarFichePlaatsingen ?? []).filter((p) => p.algemeneFicheId === gevallenAlgemeneFiche.ficheId)}
          schooljaarVan={rooster.start}
          schooljaarTot={rooster.eind}
          bezig={plaatsFiche.isPending}
          fout={plaatsFiche.error}
          onOpenPlaatsing={(plaatsingId) => {
            setGevallenAlgemeneFiche(null);
            verwijderFichePlaatsing.reset();
            setGeopendeFiche({ plaatsingId, momentId: null });
          }}
          onSluit={() => setGevallenAlgemeneFiche(null)}
          onPlaats={(invoer) => plaatsFiche.mutate(invoer, { onSuccess: () => setGevallenAlgemeneFiche(null) })}
        />
      ) : null}

      {(() => {
        if (!geopendeFiche) return null;
        const open =
          (fichePlaatsingen ?? []).find((p) => p.id === geopendeFiche.plaatsingId) ??
          (jaarFichePlaatsingen ?? []).find((p) => p.id === geopendeFiche.plaatsingId);
        if (!open) return null;
        const fiche = (algemeneFiches ?? []).find((f) => f.id === open.algemeneFicheId);
        return (
          <Algemenefichedetailblad
            open
            key={`${open.id}-${geopendeFiche.momentId ?? "periode"}`}
            plaatsing={open}
            momentId={geopendeFiche.momentId}
            // The count is placements, not occurrences (`AlgemeneFicheWeergave.AantalPlaatsingen`), so one means this
            // placement is the fiche's only one.
            enigePeriodeMetDoelen={fiche !== undefined && fiche.aantalPlaatsingen === 1 && fiche.doelen.length > 0}
            doelen={fiche ? alsInfodoelen(fiche.doelen) : undefined}
            alleenLezen={!magPlannen}
            bezig={verwijderFichePlaatsing.isPending}
            fout={verwijderFichePlaatsing.error}
            onSluit={() => setGeopendeFiche(null)}
            onVerwijder={() => verwijderFichePlaatsing.mutate(open.id, { onSuccess: () => setGeopendeFiche(null) })}
          />
        );
      })()}

      {/* WHAT A CLICKED ACTIVITEIT CARD OPENS (FB-017), and a card dropped where the drop named no hour. Keyed on the
          card and the day, so a second card refills the sheet. Only while this gebruiker may plan the klas, which after a
          refusal is the moment the refetched rights arrive, for the reason the Activiteitkiezer gives. */}
      {gekozenActiviteit && rooster && magPlannen ? (
        <Activiteitplaatsingblad
          key={`${gekozenActiviteit.id}-${gekozenActiviteit.datum}-${gekozenActiviteit.begin ?? "geen"}`}
          naam={gekozenActiviteit.naam}
          startdag={gekozenActiviteit.datum}
          startuur={gekozenActiviteit.begin}
          duur={gekozenActiviteit.duur}
          vroegste={rooster.start}
          laatste={rooster.eind}
          bezig={acties.plaats.isPending}
          fout={acties.plaats.error}
          onSluit={() => setGekozenActiviteit(null)}
          onPlaats={(plek) =>
            acties.plaats.mutate(
              { activiteitId: gekozenActiviteit.id, ...plek },
              {
                onSuccess: () => {
                  setGekozenActiviteit(null);
                  // Follow it to its day, as a moved activiteit does: planned on a day off screen, the sheet would
                  // close on an agenda that shows no sign of it.
                  ga({ datum: plek.datum });
                },
                onError: (fout) => {
                  if (isGeenToegang(fout)) setGekozenActiviteit(null);
                },
              },
            )
          }
        />
      ) : null}

      <Nieuweactiviteitblad
        // Keyed on the day and the hour: the form fills its fields at mount, so reopening it for
        // another day without a remount would offer the previous day's half-typed activiteit.
        // Not "leeg": the sheet beside this one uses that fallback, and two siblings sharing a key is
        // a React warning and, one refactor later, two sheets sharing state.
        key={nieuw ? `nieuw-${nieuw.datum}-${nieuw.begin}-${nieuw.einde ?? "eigen"}` : "geen-nieuwe"}
        datum={nieuw?.datum ?? null}
        tijd={nieuw ? toonTijd(nieuw.begin) : undefined}
        eindtijd={nieuw?.einde !== undefined ? toonTijd(nieuw.einde) : undefined}
        klasId={klasId}
        // The same day scoping the picker uses, so the sheet cannot offer a subthema of a thema that
        // the list the teacher just came from did not show.
        themaIds={nieuw ? themaIdsOpDag(vakken, nieuw.datum) : []}
        // What the day already knows. A teacher pressing the plus in the middle of a subthema means
        // that subthema far more often than not, and the dropdown is there for when they do not.
        voorstelSubthemaId={nieuw ? voorstelReeks(reeksen, nieuw.datum, rooster?.blokken ?? [])?.subthemaId : undefined}
        planBezig={acties.plaats.isPending}
        planFout={acties.plaats.isError ? foutTekst(acties.plaats.error) : null}
        planGeweigerd={isGeenToegang(acties.plaats.error)}
        onSluit={() => setNieuw(null)}
        onPlan={(activiteitId, duur) => {
          if (!nieuw) return;
          acties.plaats.mutate(
            {
              activiteitId,
              datum: nieuw.datum,
              begin: alsTijd(nieuw.begin),
              // The stretch she dragged out, when she did; the new activiteit's own length otherwise.
              einde: alsTijd(eindeVan(nieuw, duur)),
            },
            { onSuccess: () => setNieuw(null) },
          );
        }}
      />

      <Subthemaplanner
        open={plannerOpen}
        klasId={klasId}
        // The sheet's empty state is about THIS klas, so it needs the name and not just the id.
        klasNaam={klas?.naam ?? null}
        magSubthemaMaken={magSubthemaMaken}
        magPlannen={magPlannen}
        themaIds={themaIdsInPeriode}
        dagen={heelDePeriode?.dagen ?? []}
        bezig={acties.plaats.isPending}
        resultaat={plannerResultaat}
        onSluit={() => setPlannerOpen(false)}
        onPlan={async (voorstellen, venster) => {
          const fouten: string[] = [];

          // THE WINDOW FIRST, and it is not conditional on the activiteiten landing. Marking off the days is the
          // thing the teacher asked for; the activiteiten are what happens to be ready to go in them. Doing it
          // second would mean a subthema with one activiteit and a failed placement kept no period at all, which is
          // the state the owner reported as a bug in the first place.
          try {
            await plaatsSubthema.mutateAsync({ subthemaId: venster.subthemaId, van: venster.van, tot: venster.tot });
          } catch (fout) {
            const reden = fout instanceof ApiError && fout.detail ? fout.detail : t("periode.mislukt");
            fouten.push(`${t("periode.periodeLabel")}: ${reden}`);
          }

          // One POST per activiteit, in order, and the failures are collected rather than thrown.
          // Sequential on purpose: the server enforces one activiteit per day per plan, and firing
          // them in parallel makes the order in which two of them collide a matter of chance.
          let gelukt = 0;
          for (const voorstel of voorstellen) {
            try {
              await acties.plaats.mutateAsync({
                activiteitId: voorstel.activiteitId,
                datum: voorstel.datum,
                begin: voorstel.begin,
                einde: voorstel.einde,
              });
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
        magPlannen={magPlannen}
        vroegste={rooster?.start ?? ""}
        laatste={rooster?.eind ?? ""}
        bezig={bezig}
        fout={foutTekst(acties.verplaats.error ?? acties.verwijder.error)}
        onSluit={() => setGeopend(null)}
        // The sheet's own fields are the non-drag route to both moving and resizing a block
        // (WCAG 2.2 SC 2.5.7), so all three values travel together.
        onVerplaats={(datum, beginTijd, eindeTijd) => {
          if (!geopend) return;
          acties.verplaats.mutate(
            { plaatsingId: geopend.activiteit.plaatsingId, datum, begin: beginTijd, einde: eindeTijd },
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
