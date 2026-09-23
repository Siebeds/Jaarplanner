import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Weergavekeuze } from "./Weergavekeuze";
import { Leegte } from "../../components/ui/Leegte";
import { Geenklasleegte } from "../../app/Geenklasleegte";
import { Knop } from "../../components/ui/Knop";
import { Laadvlak } from "../../components/ui/Laadvlak";
import {
  IcoonActiviteit,
  IcoonFiche,
  IcoonHoek,
  IcoonPijlLinks,
  IcoonPijlRechts,
} from "../../components/Iconen";
import {
  haalSubthemaweghaling,
  useDagacties,
  useHaalSubthemaWeg,
  useJaarplan,
  usePlaatsSubthemaperiode,
  useRooster,
  useWeekplanning,
  type Subthemaweghaling,
} from "../../lib/queries";
import { weghaalzinnen } from "./subthemaweghaling";
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
import { Tijdraster, type Ficheblokje, type Tijddoel } from "./Tijdraster";
import { Weekvoorstel } from "./Weekvoorstel";
import { STANDAARDBEGIN, alsTijd, minuten, toonTijd } from "./tijd";
import { beginSleep, doelTijd, eindigSleep, leesKolomId } from "./tijdsleep";
import { eindeVan, type Gevraagdeplek } from "./gevraagdeplek";
import { Activiteitkiezer } from "./Activiteitkiezer";
import { Dagonderschrift } from "./Dagonderschrift";
import { weekInBeeld } from "./weekInBeeld";
import { leesWeergave, weergaveZoek, type Weergave } from "./weergave";
import { Weekhoek } from "../kat/Weekhoek";
import { overslagenWeekends, schuifWerkweek, werkweekbereik, werkweekdagen } from "./werkweek";
import { Weekendaanwijzing } from "./Weekendaanwijzing";
import { Activiteitblad } from "./Activiteitblad";
import { Nieuweactiviteitblad } from "./Nieuweactiviteitblad";
import { Subthemaplanner } from "./Subthemaplanner";
import { Activiteitplaatsingblad } from "./Activiteitplaatsingblad";
import { kaartLanding, leesActiviteitkaartId, type Activiteitkaartdata } from "./activiteitkaart";
import type { Activiteitenweek, GekozenActiviteit } from "./Activiteitensectie";
import { Hoekenpaneel } from "../hoeken/Hoekenpaneel";
import { useHoekverrijkingen, type SubthemaperiodeVerrijkingen } from "../hoeken/gegevens";
import {
  reeksenVanWeek,
  volgendeReeks,
  type Verrijkingenweek,
  type Volgendsubthema,
} from "../hoeken/verrijkingenweek";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { gevolgVanDag } from "./vanDeDag";
import { Algemeneficheplaatsingblad } from "../algemene-fiches/Algemeneficheplaatsingblad";
import { Algemenefichedetailblad } from "../algemene-fiches/Algemenefichedetailblad";
import {
  alsInfodoelen,
  useAlgemeneFicheplaatsingen,
  useAlgemeneFiches,
  usePlaatsAlgemeneFiche,
  useVerplaatsFichemoment,
  useVerwijderAlgemeneFicheplaatsing,
  useVerwijderFichemoment,
} from "../algemene-fiches/gegevens";
import { ALGEMENE_FICHE_VOORVOEGSEL, fichemomentSleepId, leesAlgemeneFicheId } from "../algemene-fiches/sleepids";
import { useSchooluren } from "../schooluren/gegevens";
import { roosterdagen } from "./roosterdagen";
import {
  reeksbereik,
  reeksenPerDag,
  subthemareeksen,
  subthemasInWeek,
  voorstelReeks,
  type Subthemareeks,
} from "./subthemareeksen";
import { themablokken, themaIdsOpDag, themavakken } from "./themavakken";
import { Dekkingsbalk } from "../dekking/Dekkingsbalk";
import { kalenderMeldingen, sleepUitleg, useSleepSensors } from "./sleep";

/** A day with nothing on it, for the render before the range is known. */
function leegteDag(datum: string) {
  return { datum, isLesdag: true, sluitingsnaam: null, activiteiten: [], buitenSchooljaar: false };
}

/**
 * The agenda: the school year as a calendar, opening on the werkweek (FR-6.2, FR-6.3, FR-7.2, FB-040).
 *
 * The year plan is a screen of its own, at /agenda/periodes, because placing a thema and judging its days is a
 * different job from planning a week. It is not the front door: an agenda that opens on a planning board is a
 * planning board.
 *
 * The thema is therefore DERIVED from where the teacher is standing rather than carried in the URL (ADR-0053).
 * Everything thema-scoped (which thema's the picker offers, which days the subthema planner may use) follows the
 * thema placement the anchored date falls in, and on a day without a thema it follows nothing and says so.
 *
 * Everything here is persisted server side. That is worth stating because the obvious shortcut is
 * not: the other candidate frontend keeps its day agenda in localStorage, where it belongs to one
 * browser and is shared with nobody, which for a plan a school is inspected on is worse than not
 * having it.
 *
 * **Every write here is the klas's planning, which is admin's and the klas's own leerkrachten'** (E6-02,
 * ADR-0030 §3, R7, R15). Whoever else may read the klas (FB-013) sees its agenda: the same calendar with nothing that adds, drags,
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
  // The placement whose band opened the planner (FB-087). Null until one did: then the anchored day's placement.
  const [plannerPlaatsingId, setPlannerPlaatsingId] = useState<string | null>(null);
  const [plannerResultaat, setPlannerResultaat] = useState<{ gelukt: number; totaal: number; fouten: string[] } | null>(
    null,
  );

  const paneelOpen = useHoekenpaneel((s) => s.open);
  const paneelSoort = useHoekenpaneel((s) => s.soort);
  const kiesPaneel = useHoekenpaneel((s) => s.kies);
  // The algemene fiche that was dropped, the day it landed on, and the minute of it when the drop named one (ADR-0029).
  // Null means no sheet; a null `begin` means the gesture said nothing about an hour, which is what a month or week drop
  // is. And the planned one whose detail sheet is open, by id rather than by value: the list is refetched after a
  // delete, and holding a copy would keep a sheet describing a row that is gone. The open one also remembers the
  // occurrence it was opened from, because that day is what its sheet lets her change without a drag; opened from a
  // list of whole periods it names none.
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
   * which does show a whole week at a glance, is one press away. The werkweek shows five of the seven on a desktop and
   * three weekdays on a phone (FB-040).
   */
  const breed = useMediaQuery(BREED);
  const weekweergave = weergave === "week" || weergave === "werkweek";
  const weekdagen = weekweergave && !breed ? 3 : 7;
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

  // Every thema placement as a stretch of days, and the one the subthema planner plans into: the one whose band
  // opened it, or else the one the anchored day falls in, so the usual case finds its days already loaded when the
  // band is pressed. A day without a thema is a legitimate place to stand and not an error.
  const blokken = useMemo(() => themablokken(plan?.plaatsingen ?? []), [plan]);
  const blok = useMemo(
    () =>
      blokken.find((b) => b.plaatsingId === plannerPlaatsingId) ??
      blokken.find((b) => valtBinnen(anker, b.start, b.eind)),
    [blokken, anker, plannerPlaatsingId],
  );

  // The days the werkweek draws. Every other view draws the whole range it reads.
  const werkdagenInBeeld = useMemo(
    () => (weergave === "werkweek" && anker ? werkweekdagen(anker, weekdagen) : null),
    [weergave, anker, weekdagen],
  );

  // The range the current view needs. The server clamps it to the school year, so a month that
  // starts before the first school day is a legal request rather than an error. A werkweek reads the whole weeks its
  // days are in, so that the weekends it skips can be counted (FB-040).
  const [van, tot] = useMemo<[string, string]>(() => {
    if (!anker) return ["", ""];
    if (werkdagenInBeeld) return werkweekbereik(werkdagenInBeeld);
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
  }, [anker, weergave, weekdagen, werkdagenInBeeld]);

  // The first and last day on screen, which in a werkweek are not the ends of the range it reads.
  const eersteInBeeld = werkdagenInBeeld?.[0] ?? van;
  const laatsteInBeeld = werkdagenInBeeld?.[werkdagenInBeeld.length - 1] ?? tot;

  const { data: planning, isPending } = useWeekplanning(klasId, van, tot);

  // The algemene fiches, read separately from the weekplanning: a placement of one is not part of the jaarplan, so it
  // is not part of the read model that projects one. Their own request over the visible range, and a second one over
  // the whole year for the placement sheet's "Al ingepland" (owner, 2026-09-10): a teacher planning turnen in november
  // needs to see that it already ran in september, which the month on screen does not reach.
  const { data: fichePlaatsingen } = useAlgemeneFicheplaatsingen(klasId, van, tot);
  const { data: jaarFichePlaatsingen } = useAlgemeneFicheplaatsingen(klasId, rooster?.start ?? "", rooster?.eind ?? "");
  const { data: algemeneFiches } = useAlgemeneFiches(klasId);

  // The school's hours (FB-023), one set for every klas: where the time grid opens and what it shades.
  const { data: schooluren } = useSchooluren();
  const plaatsFiche = usePlaatsAlgemeneFiche(klasId);
  const verwijderFichePlaatsing = useVerwijderAlgemeneFicheplaatsing();
  const verplaatsFichemoment = useVerplaatsFichemoment();

  // Taking one block off its day, from the right-click menu (TB-030).
  const verwijderFichemoment = useVerwijderFichemoment();
  // The block whose leaving would take more than itself, waiting for a yes (owner, 2026-09-15: only when something is
  // lost), with the sentences that say what and the block that had focus. Kept after the question closes, so the sheet
  // keeps its title while it slides away and can still hand focus back; `vanDagOpen` is what opens and closes it.
  const [vanDagVraag, setVanDagVraag] = useState<{
    doel: Tijddoel;
    naam: string;
    datum: string;
    gevolgen: ReturnType<typeof gevolgVanDag>;
    terugNaar: HTMLElement | null;
  } | null>(null);
  const [vanDagOpen, setVanDagOpen] = useState(false);

  // Taking a subthema out of the agenda, from its bar (FB-096). Always after a question, since the window and its
  // activiteiten go together; the question waits for the server's count of what goes, so it never guesses one. Kept
  // after it closes, like `vanDagVraag`, so the sheet keeps its text while it slides away.
  const haalSubthemaWeg = useHaalSubthemaWeg(klasId);
  const [subthemaVraag, setSubthemaVraag] = useState<{
    reeks: Subthemareeks;
    gevolg: Subthemaweghaling | null;
    fout: string | null;
    terugNaar: HTMLElement;
  } | null>(null);
  const [subthemaVraagOpen, setSubthemaVraagOpen] = useState(false);

  async function vraagSubthemaWeg(reeks: Subthemareeks, knop: HTMLElement) {
    if (!klasId) return;
    haalSubthemaWeg.reset();
    setSubthemaVraag({ reeks, gevolg: null, fout: null, terugNaar: knop });
    setSubthemaVraagOpen(true);
    try {
      const gevolg = await haalSubthemaweghaling(klasId, reeks.subthemaId, reeks.van, reeks.tot);
      setSubthemaVraag((vraag) => (vraag?.reeks === reeks ? { ...vraag, gevolg } : vraag));
    } catch (fout) {
      const reden = fout instanceof ApiError && fout.detail ? fout.detail : t("periode.mislukt");
      setSubthemaVraag((vraag) => (vraag?.reeks === reeks ? { ...vraag, fout: reden } : vraag));
    }
  }

  /** Takes one block off its day through its own kind's route. A failure left from an earlier try is cleared first. */
  function haalVanDag(doel: Tijddoel) {
    if (doel.soort === "activiteit") {
      acties.verwijder.reset();
      acties.verwijder.mutate(doel.plaatsingId);
    } else {
      verwijderFichemoment.reset();
      verwijderFichemoment.mutate({ plaatsingId: doel.plaatsingId, momentId: doel.momentId });
    }
  }

  /** The menu's bin: at once when only the block goes, after a question when more does (`gevolgVanDag`). */
  function vraagVanDag(doel: Tijddoel, naam: string, datum: string) {
    const gevolgen = gevolgVanDag(doel, {
      fichePlaatsingen: fichePlaatsingen ?? [],
      fiches: algemeneFiches ?? [],
    });
    if (gevolgen.length === 0) {
      haalVanDag(doel);
      return;
    }
    // The menu has handed focus back to the block by now (`Blokmenu` runs its action after that), so this is the
    // block, for the question to give focus back to when she cancels.
    const terugNaar = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setVanDagVraag({ doel, naam, datum, gevolgen, terugNaar });
    setVanDagOpen(true);
  }

  // The planner spreads over the whole thema placement, so it needs every day of it rather than the days the
  // current view happens to be showing. A separate query with its own key: asking the view's query
  // for a wider range would refetch the grid every time the teacher changed week.
  const { data: heelDePeriode } = useWeekplanning(klasId, blok?.start ?? "", blok?.eind ?? "");

  /**
   * THE RUNS ARE DERIVED OVER WHOLE THEMA PLACEMENTS, NOT OVER WHAT IS ON SCREEN.
   *
   * A subthema run is measured from the first and last day carrying one of its activiteiten, so the
   * window it is measured in decides where it appears to start. Measured over the visible month, a
   * run that began in the last week of september would be reported as starting on 1 october, and the
   * strip on that cell would say a period begins on a day it does not.
   *
   * So the window is the union of every thema placement the view touches. That is a superset of the
   * grid, which is what makes the answer for every visible day the same answer it would get from a
   * whole year. When the union adds nothing the range is identical to the grid's own and TanStack
   * hands back the same cached response rather than a second request.
   */
  // The whole week of the anchored day is in it too, which the activiteiten list speaks about (`reeksbereik`).
  const [reeksVan, reeksTot] = useMemo(
    () => reeksbereik(van, tot, anker, blokken),
    [van, tot, anker, blokken],
  );

  const { data: reeksbron, isError: reeksbronMislukt } = useWeekplanning(klasId, reeksVan, reeksTot);

  const reeksen = useMemo(
    () => subthemareeksen(reeksbron?.dagen ?? [], blokken, reeksbron?.subthemaperiodes ?? []),
    [reeksbron, blokken],
  );
  const stroken = useMemo(() => reeksenPerDag(reeksen), [reeksen]);

  /**
   * WHAT THE HOEKEN HOLD WHILE THE SUBTHEMA'S OF THE WEEK RUN (FB-038, ADR-0044), for the side panel's hoekenfiches.
   *
   * The week is the one the activiteiten list speaks about too: Monday to Sunday of the anchored day, whatever the view.
   * The windows are read over the same range as the runs, so both come from reads of one range, and the answer is
   * "klaar" only once both are in: a card may not say "nothing written", nor the sheet "no subthema this week", on the
   * strength of a read that has not answered.
   */
  const verrijkingen = useHoekverrijkingen(klasId, reeksVan, reeksTot);
  const verrijkingenWeek = useMemo<Verrijkingenweek>(() => {
    if ((verrijkingen.isError && !verrijkingen.data) || (reeksbronMislukt && !reeksbron)) return { status: "mislukt" };
    if (!verrijkingen.data || !reeksbron) return { status: "laadt" };
    return {
      status: "klaar",
      reeksen: reeksenVanWeek(reeksen, verrijkingen.data, maandagVan(anker)),
      periodes: verrijkingen.data,
    };
  }, [verrijkingen.data, verrijkingen.isError, reeksbron, reeksbronMislukt, reeksen, anker]);

  /**
   * THE SUBTHEMA AFTER THAT WEEK (FB-098), for the hoeken's "Hierna".
   *
   * The runs above cover the thema placements around the week; after them, the klas's stored windows up to the end of
   * the school year, read only while the hoekenfiches are open. See `volgendeReeks` for what that leaves unseen.
   */
  const naReeksen = reeksTot.length > 0 ? verschuif(reeksTot, 1) : "";
  const jaareinde = rooster?.eind ?? "";
  const laterTeLezen = naReeksen.length > 0 && jaareinde.length > 0 && naReeksen <= jaareinde;
  const laterVerrijkingen = useHoekverrijkingen(
    paneelOpen && paneelSoort === "hoeken" && laterTeLezen ? klasId : null,
    naReeksen,
    jaareinde,
  );
  const volgendSubthema = useMemo<Volgendsubthema>(() => {
    if (verrijkingenWeek.status !== "klaar") return verrijkingenWeek;
    if (!verrijkingen.data || jaareinde.length === 0) return { status: "laadt" };
    let later: readonly SubthemaperiodeVerrijkingen[] = [];
    if (laterTeLezen) {
      if (laterVerrijkingen.isError && !laterVerrijkingen.data) return { status: "mislukt" };
      if (!laterVerrijkingen.data) return { status: "laadt" };
      later = laterVerrijkingen.data;
    }
    const bekend = new Set(verrijkingen.data.map((periode) => periode.subthemaperiodeId));
    const alle = [...verrijkingen.data, ...later.filter((periode) => !bekend.has(periode.subthemaperiodeId))];
    return { status: "klaar", reeks: volgendeReeks(reeksen, later, alle, maandagVan(anker)), periodes: alle };
  }, [
    verrijkingenWeek,
    verrijkingen.data,
    jaareinde,
    laterTeLezen,
    laterVerrijkingen.data,
    laterVerrijkingen.isError,
    reeksen,
    anker,
  ]);

  // The algemene fiches' occurrences, as blocks the time grid can draw: built from the placements' own momenten rather
  // than from their windows, because each is a row she can move alone, and deriving it from the window would draw the
  // same hour every day and quietly contradict what is stored. Each carries its fiche's goals for the block's info icon
  // (FB-018), read from the fiche list rather than from the placement, which does not carry them.
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
        tekst: moment.tekst,
        // The placement carries all its momenten, not just the visible range's, so this counts the whole series.
        terugkerend: plaatsing.momenten.length > 1,
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
   * EVERY THEMA PLACEMENT OF THE YEAR, AS A STRETCH OF DAYS.
   *
   * Not "the thema the teacher is in": the month grid shows a whole month, so each cell looks its own day up. See
   * `themavakken`.
   */
  const vakken = useMemo(() => themavakken(plan?.plaatsingen ?? []), [plan]);

  // The thema of that placement is what the subthema planner may offer.
  const themaIdsInPeriode = useMemo(() => (blok ? [blok.themaId] : []), [blok]);

  // From a thema band (FB-087), and only for whoever may plan this klas: no thema, no band, no planner, since the sheet
  // spreads a subthema over the days of a thema placement.
  const planSubthema =
    rechtenBekend && magPlannen
      ? (plaatsingId: string) => {
          setPlannerPlaatsingId(plaatsingId);
          setPlannerResultaat(null);
          setPlannerOpen(true);
        }
      : undefined;

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
        werkdagenInBeeld ?? (van.length > 0 ? datumsTussen(van, tot) : []),
        planning?.dagen ?? [],
        rooster?.start ?? "",
        rooster?.eind ?? "",
      ),
    [werkdagenInBeeld, van, tot, planning, rooster],
  );

  /**
   * The weekends the werkweek skips that hold something (FB-040), counted from the read of the whole weeks. Nothing
   * until that read is in: a count from a read that has not answered would be a zero nobody measured.
   */
  const weekends = useMemo(() => {
    if (!werkdagenInBeeld || !planning) return [];
    const activiteitenOp = new Map(planning.dagen.map((dag) => [dag.datum, dag.activiteiten.length]));
    const fichesOp = new Map<string, number>();
    for (const blokje of ficheblokjes) fichesOp.set(blokje.datum, (fichesOp.get(blokje.datum) ?? 0) + 1);
    return overslagenWeekends(
      van,
      tot,
      (datum) => activiteitenOp.get(datum) ?? 0,
      (datum) => fichesOp.get(datum) ?? 0,
    );
  }, [werkdagenInBeeld, planning, ficheblokjes, van, tot]);

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
  // The algemene fiches are in here under their prefixed id, from the panel and in the grid (owner, 2026-08-31). Without
  // them a fiche drag carried nothing visible and the announcer said "op woensdag 14 oktober gezet" with an empty name,
  // which is the one gesture in this agenda where a teacher most needs to see what she has hold of: the panel is chrome
  // and the fiche leaves it.
  const opNaam = useMemo(() => {
    const kaart = new Map<string, string>();
    for (const dag of planning?.dagen ?? []) {
      for (const activiteit of dag.activiteiten) kaart.set(activiteit.plaatsingId, activiteit.activiteitNaam);
    }
    for (const fiche of algemeneFiches ?? []) kaart.set(`${ALGEMENE_FICHE_VOORVOEGSEL}${fiche.id}`, fiche.naam);
    for (const plaatsing of fichePlaatsingen ?? []) {
      for (const moment of plaatsing.momenten) {
        kaart.set(fichemomentSleepId(plaatsing.id, moment.id), plaatsing.ficheNaam);
      }
    }
    return kaart;
  }, [planning, algemeneFiches, fichePlaatsingen]);

  function schuif(richting: -1 | 1) {
    // A week view showing three days pages by three, so nothing is skipped and nothing repeats.
    if (weergave === "maand") ga({ datum: verschuifMaanden(anker, richting) });
    else if (weergave === "week") ga({ datum: verschuif(anker, richting * weekdagen) });
    else if (weergave === "werkweek") ga({ datum: schuifWerkweek(anker, weekdagen, richting) });
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
   * owns it. A drop needs all three, and looking them up twice (once for the activiteiten, once for the fiches) is
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

    for (const blokje of ficheblokjes) {
      kaart.set(fichemomentSleepId(blokje.plaatsingId, blokje.momentId), {
        datum: blokje.datum,
        begin: minuten(blokje.begin),
        duur: minuten(blokje.einde) - minuten(blokje.begin),
        doel: { soort: "fiche", plaatsingId: blokje.plaatsingId, momentId: blokje.momentId },
      });
    }

    return kaart;
  }, [planning, ficheblokjes]);

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

    // THE KIND OF DRAGGED THING, and the id says which (see `algemene-fiches/sleepids.ts`). An algemene fiche from the
    // panel has no placement yet, so it opens its sheet instead of moving anything: which days, which weekdays and at
    // what time are questions a drop cannot answer. The hour is kept when the drop landed on one; a month cell says
    // nothing about an hour, so the sheet gets null and offers its own default rather than inventing one.
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
    weergave === "maand"
      ? maandJaar(anker)
      : weekweergave
        ? periodeTekst(eersteInBeeld, laatsteInBeeld)
        : volleDag(anker);

  // Only where the days in view are one week: see `weekInBeeld`.
  const weekNummer = weekInBeeld(weergave, eersteInBeeld, laatsteInBeeld);
  const weekLabel = weekNummer === null ? null : t("periode.weeknummer", { nummer: weekNummer });

  const foutTekst = (fout: unknown) =>
    fout instanceof ApiError && fout.detail ? fout.detail : fout ? t("periode.mislukt") : null;


  if (!klasId) {
    return (
      <>
        <Schermkop titel={t("periode.titel")} />
        <Schermvlak>
          <Geenklasleegte titel={t("plan.geenKlas")} />
        </Schermvlak>
      </>
    );
  }

  // THE TIME GRID FILLS THE SCREEN, AND THE LAYOUT SAYS HOW TALL THAT IS (owner, 2026-09-23, FB-092). A column exactly
  // the viewport less the bottom bar, in which the grid takes what the header, the coverage bar and any notice above it
  // leave: the page itself then does not scroll on a laptop, and the grid is the one thing that does. `min-h-min` lets
  // the column grow past the viewport only where even the grid's floor does not fit, on a low phone, and then the page
  // scrolls a little. The month grows with its weeks and keeps scrolling the page.
  const vultScherm = weergave !== "maand";

  return (
    <>
      <div
        className={cn(vultScherm && "flex min-h-min flex-col")}
        style={vultScherm ? { height: "calc(100dvh - var(--onderbalk))" } : undefined}
      >
      <Schermkop
        breed
        meeScrollen={vultScherm}
        titel={t("periode.titel")}
        onder={
          /* One toolbar, and it travels with the header, which sticks in the month (tall enough to scroll the range
             away); in the week and the day the page does not scroll (FB-092). FB-089: Vandaag first, so it never
             moves with the length of the date; the arrows as one joined control; the date and its week number
             centred on the same line; the view switch to the right. Every control is `h-9` with the `lijn-veld`
             edge, `Segment` included. Below `sm` the switch wraps onto a row of its own at full width. */
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-1 basis-auto items-center gap-3">
                {/* The button when there is a today to go to, and the reason when there is not, in the same place.
                    Never a dead control: in augustus the school year has not started and no day is today. */}
                {vandaagBereikbaar ? (
                  <button
                    type="button"
                    onClick={() => ga({ datum: nu })}
                    className="inline-flex h-9 shrink-0 items-center rounded-veld border border-lijn-veld px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
                  >
                    {t("periode.vandaag")}
                  </button>
                ) : (
                  <p className="max-w-36 shrink-0 text-meta leading-tight text-inkt-zwak">
                    {t("periode.vandaagBuitenSchooljaar")}
                  </p>
                )}

                <div className="inline-flex h-9 shrink-0 rounded-veld border border-lijn-veld">
                  <button
                    type="button"
                    aria-label={t("periode.vorige")}
                    onClick={() => schuif(-1)}
                    className="flex w-9 items-center justify-center rounded-l-veld text-inkt-zacht transition-colors duration-150 hover:bg-vlak-diep hover:text-accent"
                  >
                    <IcoonPijlLinks className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("periode.volgende")}
                    onClick={() => schuif(1)}
                    className="flex w-9 items-center justify-center rounded-r-veld border-l border-lijn-veld text-inkt-zacht transition-colors duration-150 hover:bg-vlak-diep hover:text-accent"
                  >
                    <IcoonPijlRechts className="h-4 w-4" />
                  </button>
                </div>

                {/* Wraps rather than truncates: on a phone "vrijdag 11 september" does not fit beside the controls,
                    and the month is the half of the date that matters. The week number sits on the date's baseline. */}
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <h2 className="font-display text-[1.25rem] leading-tight text-inkt sm:text-[1.5rem]">{ankerLabel}</h2>
                  {weekLabel ? (
                    <span className="shrink-0 text-meta tabular-nums text-inkt-zacht">{weekLabel}</span>
                  ) : null}
                </div>
              </div>

              {/* "Jaar" is the jaarplan: another screen, so choosing it navigates there (pushed, so the browser's
                  back button returns here), and it is never the checked option on this one. */}
              <Weergavekeuze
                waarde={weergave}
                onKies={(zicht) => (zicht === "jaar" ? navigeer("/agenda/periodes") : ga({ weergave: zicht }))}
                className="w-full sm:w-auto"
              />
            </div>

            {weergave === "dag" ? (
              <Dagonderschrift
                datum={anker}
                schooljaar={rooster ? { start: rooster.start, eind: rooster.eind, blokken } : undefined}
                vakken={vakken}
                planGeladen={planGeladen}
              />
            ) : null}

            {/*
              THE PANEL SWITCHES ARE IN THE SIDEBAR FROM `lg`, AND THIS ROW IS WHAT IS LEFT OF THEM BELOW THAT.

              The owner asked for the switches in the sidepane (2026-08-31), and a sidepane exists only from `lg`:
              below it the navigation is a bottom bar of five tabs with no room for more, while the panels still have
              to be reachable on a phone, where they open as a sheet. So this row is `lg:hidden` and `Navigatie`
              carries the switches from `lg` upward: one control per viewport, never two at once. A row of its own
              since FB-089, so the switches no longer sit between the views.

              One chip per list, in the sidebar's order: Activiteiten, Algemene fiches, Hoekenfiches (owner, TB-024).
              The algemene fiches' chip only for a gebruiker who may plan this klas; the other two for everyone who
              reads the agenda, whose cards then plan and write nothing (owner, 2026-09-15, FB-017 and FB-038). None
              until the rights are known, so the fiche chip does not appear a moment after the others. Below `sm` the
              icons give way, so the three fit one row at 390px.
            */}
            {rechtenBekend ? (
              <div className="flex flex-wrap items-center gap-2 lg:hidden">
                {(
                  [
                    { soort: "activiteiten", label: t("periode.activiteiten"), Icoon: IcoonActiviteit },
                    ...(magPlannen
                      ? ([{ soort: "algemeen", label: t("periode.algemeneFiches"), Icoon: IcoonFiche }] as const)
                      : []),
                    { soort: "hoeken", label: t("periode.hoekenfiches"), Icoon: IcoonHoek },
                  ] as const
                ).map(({ soort, label, Icoon }) => {
                  const aan = paneelOpen && paneelSoort === soort;
                  return (
                    <button
                      key={soort}
                      type="button"
                      onClick={() => kiesPaneel(soort)}
                      aria-pressed={aan}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-veld border px-3 text-meta font-medium transition-colors duration-150",
                        aan
                          ? "border-accent bg-accent-zacht text-accent"
                          : "border-lijn-veld text-inkt-zacht hover:border-accent hover:text-accent",
                      )}
                    >
                      <Icoon aria-hidden="true" className="h-4 w-4 max-sm:hidden" />
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        }
      />

      <Schermvlak breed className={cn(vultScherm && "flex min-h-0 w-full flex-auto flex-col pb-4")}>
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
          {/* INSIDE the context, and it has to be: an algemene fiche or an activiteit card is dragged FROM here ONTO
              the grid below, and dnd-kit registers a draggable through React context rather than through the DOM. The
              panel is `fixed`, so where it sits on screen owes nothing to where it sits in this tree. For a gebruiker
              who may not plan this klas it holds the activiteiten and the hoeken, to read (owner, 2026-09-15, FB-017
              and FB-038), and no algemene fiches: every one of those plans one. A hoek plans nothing for anyone; its
              card opens what the corner holds this week, which the panel writes itself (ADR-0044). */}
          <Hoekenpaneel
              klasId={klasId}
              magPlannen={magPlannen}
              onKiesAlgemeneFiche={(ficheId) => {
                plaatsFiche.reset();
                setGevallenAlgemeneFiche({ ficheId, datum: anker, begin: null });
              }}
              activiteitenWeek={activiteitenWeek}
              verrijkingenWeek={verrijkingenWeek}
              volgendSubthema={volgendSubthema}
              onKiesActiviteit={(activiteit) => {
                acties.plaats.reset();
                setGekozenActiviteit({ ...activiteit, datum: anker, begin: null });
              }}
            />

          <div className={cn("mt-3", vultScherm && "flex min-h-0 flex-auto flex-col")}>
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
                magPlannen={magPlannen}
                onKiesDag={openDag}
                onVoegToe={(datum) => setKiezer({ datum, begin: STANDAARDBEGIN })}
                onOpen={(activiteit, datum) => setGeopend({ activiteit, datum })}
                onVanDag={(activiteit) => haalVanDag({ soort: "activiteit", plaatsingId: activiteit.plaatsingId })}
                onPlanSubthema={planSubthema}
              />
            ) : (
              <>
              {/* A skipped weekend opens in the week view, whose phone window then starts on its Saturday. */}
              <Weekendaanwijzing
                weekends={weekends}
                onToonWeek={(zaterdag) => ga({ datum: zaterdag, weergave: "week", push: true })}
              />
              {/* THE DAY AND THE WEEK ARE ONE GRID (ADR-0028), which is what makes them agree: they were a row of
                 lesuren and a row of day cards, and the same Tuesday looked like two different plans depending on
                 which button a teacher had pressed. The week is the same grid with more columns, three of them on
                 a phone. */}
              {/* The AI proposes the week (FB-027): only in the week views, the unit it proposes, and only for whoever
                  may plan this klas, who decides it. */}
              {weekweergave && magPlannen && klasId && zichtbareDagen.length > 0 ? (
                <Weekvoorstel klasId={klasId} datum={anker} dagen={zichtbareDagen} />
              ) : null}
              {/* Chuck lies on the corner of the week strip when a goal of this klas is at risk (FB-071). */}
              <Weekhoek klasId={klasId} actief={weekweergave}>
              <Tijdraster
                dagen={zichtbareDagen.length > 0 ? zichtbareDagen : [leegteDag(anker)]}
                fichemomenten={ficheblokjes}
                reeksenPerDag={stroken}
                vakken={vakken}
                schooluren={schooluren?.dagen}
                magPlannen={magPlannen}
                onVoegToe={(datum, tijd, einde) => setKiezer({ datum, begin: tijd, einde })}
                onOpen={(activiteit, datum) => setGeopend({ activiteit, datum })}
                onOpenFiche={(plaatsingId, momentId) => {
                  verwijderFichePlaatsing.reset();
                  setGeopendeFiche({ plaatsingId, momentId });
                }}
                onVanDag={vraagVanDag}
                // In the week a column heading opens that day; in the day view it would go where it already is.
                onKiesDag={weekweergave ? openDag : undefined}
                onWijzigTijd={bewaarTijd}
                onPlanSubthema={planSubthema}
                onHaalSubthemaWeg={magPlannen ? (reeks, knop) => void vraagSubthemaWeg(reeks, knop) : undefined}
              />
              </Weekhoek>
              </>
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
          // The menu's bin (TB-030) opens no sheet of its own to show a failure in, so its two routes report here.
          fouten={[
            acties.plaats.error,
            acties.verplaats.error,
            verplaatsFichemoment.error,
            acties.verwijder.error,
            verwijderFichemoment.error,
          ]}
          kiezerOpen={magPlannen && kiezer !== null}
          bladOpen={nieuw !== null || geopend !== null || plannerOpen || (magPlannen && gekozenActiviteit !== null)}
        />
      </Schermvlak>
      </div>

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

      {/* THE ALGEMENE FICHE'S PAIR OF SHEETS (ADR-0029). What a dropped or clicked fiche opens is keyed on the fiche and
          the day, so dropping a second one refills the sheet instead of showing the first one's half-made window, and
          it is mounted only while a fiche has actually landed: the sheet's own state is per drop and must not survive
          one. Opening one of its listed runs closes it, for the reason the Activiteitkiezer gives: two sheets deep for
          one intention is a stack she has to unwind. The detail sheet is looked up by id on every render, in the
          visible range and in the year, so it disappears with its row. */}
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
        voorstelSubthemaId={nieuw ? voorstelReeks(reeksen, nieuw.datum, blokken)?.subthemaId : undefined}
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
        // A fresh sheet per placement: the window and the subthema chosen for one thema mean nothing in another.
        key={blok?.plaatsingId ?? "geen"}
        open={plannerOpen}
        klasId={klasId}
        // The sheet's empty state is about THIS klas, so it needs the name and not just the id.
        klasNaam={klas?.naam ?? null}
        magSubthemaMaken={magSubthemaMaken}
        magPlannen={magPlannen}
        themaIds={themaIdsInPeriode}
        dagen={blok ? heelDePeriode?.dagen : []}
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

      {/* THE QUESTION BEFORE A BLOCK LEAVES ITS DAY, asked only when more than the block goes with it (TB-030): its
          day text, or the whole period because this was its last day. `gevolgVanDag` decides and words it. */}
      <Bevestiging
        open={vanDagOpen}
        titel={vanDagVraag ? t("blokmenu.bevestigTitel", { naam: vanDagVraag.naam, dag: volleDag(vanDagVraag.datum) }) : ""}
        gevolg={vanDagVraag?.gevolgen.map((sleutel) => t(sleutel)).join(" ")}
        bevestigLabel={t("blokmenu.bevestigLabel")}
        terugNaar={vanDagVraag?.terugNaar ?? null}
        onBevestig={() => {
          if (vanDagVraag) haalVanDag(vanDagVraag.doel);
          setVanDagOpen(false);
        }}
        onSluit={() => setVanDagOpen(false)}
      />

      {/* THE QUESTION BEFORE A SUBTHEMA LEAVES THE AGENDA (FB-096): its days, what goes with it, and the dekking. The
          yes waits for the count, so she never confirms a number she has not seen. */}
      <Bevestiging
        open={subthemaVraagOpen}
        titel={subthemaVraag ? t("subthemaWeg.titel", { naam: subthemaVraag.reeks.subthemaNaam }) : ""}
        gevolg={
          !subthemaVraag
            ? undefined
            : subthemaVraag.fout
              ? t("subthemaWeg.mislukt", { reden: subthemaVraag.fout })
              : subthemaVraag.gevolg
                ? weghaalzinnen(subthemaVraag.reeks, subthemaVraag.gevolg, volleDag).join(" ") +
                  (haalSubthemaWeg.error
                    ? ` ${t("subthemaWeg.mislukt", { reden: foutTekst(haalSubthemaWeg.error) ?? t("periode.mislukt") })}`
                    : "")
                : t("subthemaWeg.laden")
        }
        bevestigLabel={t("subthemaWeg.bevestigLabel")}
        bezig={haalSubthemaWeg.isPending}
        klaar={Boolean(subthemaVraag?.gevolg)}
        terugNaar={subthemaVraag?.terugNaar ?? null}
        onBevestig={() => {
          if (!subthemaVraag?.gevolg) return;
          const { subthemaId, van, tot } = subthemaVraag.reeks;
          haalSubthemaWeg.mutate({ subthemaId, van, tot }, { onSuccess: () => setSubthemaVraagOpen(false) });
        }}
        onSluit={() => setSubthemaVraagOpen(false)}
      />
    </>
  );
}
