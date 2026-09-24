import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDndMonitor, useDraggable, useDroppable } from "@dnd-kit/core";
import { IcoonFiche, IcoonToverstok } from "../../components/Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { dagNummer, vandaag, volleDag, weekdagIndex, weekdagKort } from "../../lib/datum";
import type { GeplandeActiviteit } from "../../lib/types";
import { KLEURVLAK, kleurSleutel } from "../activiteiten/kleuren";
import { FICHEVLAK, FICHEVLAK_STIL } from "../algemene-fiches/merk";
import { fichemomentSleepId, leesAlgemeneFicheId } from "../algemene-fiches/sleepids";
import { Blokmenu } from "./Blokmenu";
import { Doelinfo, type Infodoel } from "./Doelinfo";
import { Subthemastroken } from "./Subthemastroken";
import { Themastroken } from "./Themastroken";
import { Subthemabalk, Subthemateveel, Themabalk } from "./Weekbalken";
import { subthemabalken, themabalken } from "./weekbalkindeling";
import { subthemaruimte, subthemaZin, type Subthemareeks, type Subthemaruimte } from "./subthemareeksen";
import { themaZin, vakOpDag, type Themavak } from "./themavakken";
import type { Agendadag } from "./roosterdagen";
import type { Schooldaguren } from "../schooluren/gegevens";
import { openingsminuut, urenOp } from "../schooluren/schooluren";
import {
  DAGBEGIN,
  HEEL_DE_DAG,
  KORTSTE,
  PX_PER_MINUUT,
  STANDAARDBEGIN,
  STANDAARDDUUR,
  STAP,
  type Blokje,
  kolommen,
  minuten,
  rond,
  toonBereik,
  toonTijd,
  vloer,
} from "./tijd";
import { KOLOM_ATTRIBUUT, VAN_ATTRIBUUT, doelTijd, kolomId } from "./tijdsleep";

/**
 * One occurrence of a planned algemene fiche on a day, as the grid draws it: a fiche moment is a row a teacher can move
 * on its own.
 *
 * Plus the fiche's goals, for the block's info icon (FB-018). Absent while the fiche list has not arrived, which draws
 * no icon rather than one that would say the fiche has no goals.
 */
export interface Ficheblokje {
  plaatsingId: string;
  momentId: string;
  naam: string;
  datum: string;
  begin: string;
  einde: string;
  doelen?: readonly Infodoel[];
  /** What the class does in it that day (FB-022), drawn in the block where there is room. */
  tekst?: string | null;
  /** Whether its placement has more than this one moment: a recurring fiche is drawn quieter (FB-091). */
  terugkerend: boolean;
}

/** What a resize asks the screen to save. The two kinds live behind two endpoints; the grid knows which is which. */
export type Tijddoel =
  | { soort: "activiteit"; plaatsingId: string }
  | { soort: "fiche"; plaatsingId: string; momentId: string };

/** A block on the grid, of either kind, with what it takes to draw and address it. */
type Rasterblok = Blokje & {
  datum: string;
  naam: string;
  /**
   * The line under the name: an activiteit's subthema. An algemene fiche has none, since its plane and its icon already
   * say its kind and the word only crowded the agenda (FB-100); its accessible name still says it.
   */
  onder?: string;
  doel: Tijddoel;
  activiteit?: GeplandeActiviteit;
  /** The goals the block works on, for its info icon (FB-018). */
  doelen?: readonly Infodoel[];
  /** An algemene fiche's day text (FB-022). Absent for every other kind, and for a day nobody wrote about. */
  tekst?: string;
  /** A recurring algemene fiche, drawn quieter than an activiteit (FB-091). */
  stil?: boolean;
};

/**
 * The day and the week as a time grid, the shape a teacher already knows from Outlook (owner, 2026-09-11, ADR-0028).
 *
 * **The hours of the day are the vertical axis**, so where a block sits IS when it happens. That replaced a row of
 * seven numbered lesuren, in which a 20-minute kring at 8:45 could not be said at all. What a block knows is its own
 * begin and end; the grid only turns minutes into pixels.
 *
 * **One component for the day view and the week view**, because a day looks the same wherever a teacher meets it: the
 * week is the same grid with more columns. It is also what keeps the two from drifting, which is the defect the month
 * and week views produced twice before.
 *
 * **Four gestures, and each one says something the others cannot.** Dragging a block moves it in both axes at once
 * (another day, another hour). Dragging its bottom edge changes when it ends. Clicking empty space makes something at
 * that quarter, which lights up under a mouse before it is pressed; dragging across empty space makes something for
 * exactly that stretch (TB-014). The keyboard has the first through dnd-kit, and the second and fourth through a click
 * followed by the activiteit sheet's time fields, which is the non-drag route WCAG 2.2 SC 2.5.7 asks for.
 *
 * **The now-line is ink, not a hue** (Art. XII): the accent is rationed to five uses and none of them is this. It
 * carries the current time as text in the hour gutter, so it is never colour alone.
 *
 * **The four gestures are the klas's planning, and only whoever may plan it gets them** (E6-02, ADR-0030 §3, R7,
 * R15): admin and the leerkrachten of this klas. Anyone else reads the grid, every block still opens, and nothing
 * drags, stretches, lights up a quarter or invites a click into empty space.
 */
export function Tijdraster({
  dagen,
  fichemomenten,
  reeksenPerDag,
  vakken,
  schooluren,
  magPlannen,
  onVoegToe,
  onOpen,
  onOpenFiche,
  onVanDag,
  onKiesDag,
  onWijzigTijd,
  onPlanSubthema,
  onHaalSubthemaWeg,
}: {
  /** The days to draw, in order. One for the day view, three on a phone's week, seven on a desktop's. */
  dagen: Agendadag[];
  /** The occurrences of planned algemene fiches in the visible range, in one flat list; the grid picks each day's own. */
  fichemomenten: readonly Ficheblokje[];
  /** The subthema runs covering each day, for the band above the grid. */
  reeksenPerDag: Map<string, Subthemareeks[]>;
  /** The themaperiode each day sits in, for the same band. */
  vakken: readonly Themavak[];
  /**
   * The school's hours per weekday (FB-023), or undefined while they load or when none are set. Required, like
   * `magPlannen`, so a caller cannot forget them: a grid without them opens at 7:00 and shades nothing.
   */
  schooluren: readonly Schooldaguren[] | undefined;
  /** Whether this gebruiker may change this klas's planning (`mag.klasplanningBewerken`). Required, so no caller forgets. */
  magPlannen: boolean;
  /**
   * Asked for an activiteit on this day, starting at this minute of it. With an `einde`, the teacher dragged out the
   * stretch it should take; without one, the activiteit's own length decides where it ends.
   */
  onVoegToe: (datum: string, begin: number, einde?: number) => void;
  onOpen: (activiteit: GeplandeActiviteit, datum: string) => void;
  /** A fiche block was opened: its placement, and the one occurrence it was opened from. */
  onOpenFiche: (plaatsingId: string, momentId: string) => void;
  /**
   * The right-click menu's bin (TB-030): take this one block off its day. The screen decides whether that needs a yes
   * first, since only it can see what else would go.
   */
  onVanDag: (doel: Tijddoel, naam: string, datum: string) => void;
  /** Opens one day on its own. Left out in the day view, which is already that. */
  onKiesDag?: (datum: string) => void;
  /** A block was made longer or shorter by its bottom edge. */
  onWijzigTijd: (doel: Tijddoel, datum: string, begin: number, einde: number) => void;
  /** Opens the subthema planner for a thema placement, from its band (FB-087). Left out for whoever may not plan. */
  onPlanSubthema?: (plaatsingId: string) => void;
  /** Takes a subthema run out of the agenda, from its bar (FB-096). Left out for whoever may not plan. */
  onHaalSubthemaWeg?: (reeks: Subthemareeks, knop: HTMLElement) => void;
}) {
  // Grouped per day here, once, so every column gets the same array back until the blocks themselves change. A filter
  // per column made a new one on every render of the grid, the minute clock's included, and the overlap layout each
  // column memoises on it was recomputed every time (TB-071).
  const blokkenPerDag = useMemo(
    () => perDag(bouwBlokken(dagen, fichemomenten)),
    [dagen, fichemomenten],
  );
  // The whole day, always. What a teacher sees of it is the scroller below; see `HEEL_DE_DAG`. `bereik` is an alias,
  // not a seam: it is kept because it is the origin every position in the grid is measured from, and because
  // `tijdsleep` reads it back off the DOM. The school's own hours (FB-023) deliberately do NOT narrow it: they move
  // where the grid opens and shade what lies outside them, and a teacher can still plan the 7:45 opvang. Narrowing it
  // would also mean restoring the two range guards on the now-line, which are gone because nothing can fall outside
  // a whole day.
  const bereik = HEEL_DE_DAG;
  const hoogte = (bereik.tot - bereik.van) * PX_PER_MINUUT;

  const nu = useNu();
  const vandaagIso = vandaag();
  const toontVandaag = dagen.some((dag) => dag.datum === vandaagIso);

  // WHERE THE GRID OPENS. At the whole hour in which the earliest school day on screen begins (FB-023: "openen op het
  // begin van de schooldag"), so a day starting at 8:30 opens at 8:00 with its first half hour shaded above the start.
  // Without school hours, at 7:00, the start of the 7:00-18:00 the owner asked to see by default. How far down the
  // screen reaches depends on the screen (FB-092); every other hour is drawn and a scroll away, which is what makes
  // an early opvang or a 19:30 oudercontact plannable without a control that has to be found first.
  //
  // It moves the scroll only when the opening hour itself changes: when the hours first arrive, or when another week
  // starts earlier. A refetch that answers the same hours does not pull a teacher back from where she scrolled.
  const opening = openingsminuut(schooluren, dagen) ?? DAGBEGIN;
  const scrollvak = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (scrollvak.current) scrollvak.current.scrollTop = (opening - bereik.van) * PX_PER_MINUUT;
  }, [opening, bereik.van]);

  // More than one column: the thema and subthema run across them as continuous bars (FB-090). The day view keeps its
  // own per-day bands, which on one column already read as one bar with its name.
  const week = dagen.length > 1;
  const geenMaandag = !dagen.some((rij) => weekdagIndex(rij.datum) === 0);
  const naamdrager = dagen.some((rij) => weekdagIndex(rij.datum) === 0 && rij.isLesdag)
    ? undefined
    : dagen.find((rij) => rij.isLesdag)?.datum;

  return (
    // A column that takes the height its parent gives it (FB-092): the screen decides how tall the grid is, and the
    // hours scroll inside it. `min-h-80`, about four hours under the headings, is the floor below which a grid shows too
    // few hours to plan in; only a low phone reaches it, and there the page scrolls a little.
    <div className="flex min-h-80 flex-auto flex-col overflow-hidden rounded-kaart border border-lijn bg-kaart">
      {/* THE DAY HEADINGS AND THE ALL-DAY BAND, outside the scroller so they stay put while the hours move.
          What is in the band is what is true of a whole day and has no hour: which themaperiode it belongs to and
          which subthema runs on it.

          THE SAME GUTTER AS THE SCROLLER BELOW, so every heading sits over its own column. The scroller's scrollbar
          takes its width from the hour columns and not from these headings, which drifted each column a little further
          right than the one before it: a few pixels on Tuesday, nine by Friday (owner, 2026-09-15, TB-020). A gutter
          is only reserved on an element that can scroll, hence `overflow-hidden`. Sideways it clips where the card
          already did, at the last heading's right edge, and the row grows with its headings, so it cuts off nothing
          that was visible before. With overlay scrollbars both reserve nothing, which is equal too. */}
      <div className="rustige-schuifbalk flex shrink-0 overflow-hidden border-b border-lijn">
        <div className="w-12 shrink-0 border-r border-lijn sm:w-14" />
        {week ? (
          <Weekkop
            dagen={dagen}
            reeksenPerDag={reeksenPerDag}
            vakken={vakken}
            schooluren={schooluren}
            vandaagIso={vandaagIso}
            onKiesDag={onKiesDag}
            onPlanSubthema={onPlanSubthema}
            onHaalSubthemaWeg={onHaalSubthemaWeg}
          />
        ) : (
        <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${dagen.length}, minmax(0, 1fr))` }}>
          {dagen.map((dag, i) => (
            <Dagkop
              key={dag.datum}
              dag={dag}
              isVandaag={dag.datum === vandaagIso}
              reeksen={dag.buitenSchooljaar ? LEEG : (reeksenPerDag.get(dag.datum) ?? LEEG)}
              vak={dag.buitenSchooljaar ? undefined : vakOpDag(vakken, dag.datum)}
              uren={dag.isLesdag ? urenOp(schooluren, dag.datum) : undefined}
              // A band drops its label only when a day ON THIS ROW is carrying it, and the day that carries it is
              // Monday (`naamOpDezeDag`, and the same rule in `Themastroken`). So the question is whether a Monday is
              // rendered, not how many days are: the day view is one non-Monday, and the phone week view is three
              // days starting at the anchored day, which on a Thursday is Thu-Fri-Sat and has no Monday either. Both
              // showed two nameless grey bars, which is what the owner was looking at on 2026-09-11.
              // Only a teaching day draws bands, so a closed Monday carries nothing either: then the week's first
              // teaching day names them, and is the tab stop that takes a keyboard to their pages (FB-039).
              altijdNaam={geenMaandag || dag.datum === naamdrager}
              onKiesDag={onKiesDag}
              onPlanSubthema={onPlanSubthema}
              onHaalSubthemaWeg={onHaalSubthemaWeg}
              ruimte={subthemaruimte(dagen, i, reeksenPerDag)}
            />
          ))}
        </div>
        )}
      </div>

      {/* THE ONE THING ON THE SCREEN THAT SCROLLS (owner, 2026-09-23, FB-092). It fills what the card has left, so its
          height follows from the layout and never from a guess at what stands above the grid: that guess was 65
          pixels short on a laptop, and the page scrolled beside it. `contain: size` keeps the day's 24 hours out of
          the height the column asks for, so they cannot push the page past the viewport.

          A scroll region a keyboard reaches and a screen reader names (WCAG 2.2 SC 2.1.1): arrow keys and Page Down
          then move the hours without a mouse. */}
      <div
        ref={scrollvak}
        tabIndex={0}
        role="region"
        aria-label={t("tijdraster.uren")}
        className="rustige-schuifbalk min-h-0 flex-1 overflow-y-auto [contain:size] focus-visible:outline-offset-[-2px]"
      >
        <div className="flex" style={{ height: hoogte }}>
          {/* The hour gutter. Each label hangs just UNDER its own line, the way a paper timetable and every calendar
              app write it, so it labels the hour that follows. Centred on the line it half-hung above the line, which
              at the top of the scroller meant the first hour of the day was drawn cut in two (owner, 2026-09-11). */}
          {/* WHOLE HOURS ONLY (FB-092). A school day's edge at 12:30 is drawn in its own column (`Schooltijdlagen`),
              where it belongs to that day, rather than as a half-hour label just under "12:00", which read as a fault. */}
          <div className="relative w-12 shrink-0 border-r border-lijn sm:w-14">
            {UREN.map((uur) => (
              <span
                key={uur}
                className="absolute right-1.5 translate-y-0.5 text-micro text-inkt-zwak"
                style={{ top: (uur - bereik.van) * PX_PER_MINUUT }}
              >
                {toonTijd(uur)}
              </span>
            ))}

            {/* The current time, in words, beside the line that draws it. No range check any more: the grid draws
                every hour of the day, so there is no hour the now-line can fall outside of. */}
            {toontVandaag ? (
              <span
                className="absolute right-1 -translate-y-1/2 rounded bg-inkt px-1 py-0.5 text-[0.625rem] font-medium text-inkt-op"
                style={{ top: (nu - bereik.van) * PX_PER_MINUUT }}
              >
                {toonTijd(nu)}
              </span>
            ) : null}
          </div>

          <div
            className="relative grid min-w-0 flex-1"
            style={{ gridTemplateColumns: `repeat(${dagen.length}, minmax(0, 1fr))` }}
          >
            {/* The hour lines, drawn once across every column instead of per cell: a border per hour per day makes
                seven columns of stacked hairlines that read as a table. */}
            {UREN.map((uur) => (
              <span
                key={uur}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 border-t border-lijn"
                style={{ top: (uur - bereik.van) * PX_PER_MINUUT, gridColumn: "1 / -1" }}
              />
            ))}

            {dagen.map((dag) => (
              <Dagkolom
                key={dag.datum}
                dag={dag}
                blokken={blokkenPerDag.get(dag.datum) ?? GEEN_BLOKKEN}
                uren={dag.isLesdag ? urenOp(schooluren, dag.datum) : undefined}
                bereik={bereik}
                magPlannen={magPlannen}
                onVoegToe={onVoegToe}
                onOpen={onOpen}
                onOpenFiche={onOpenFiche}
                onVanDag={onVanDag}
                onWijzigTijd={onWijzigTijd}
              />
            ))}

            {/* THE LINE, above the blocks so it is not hidden by a busy morning, and never catching a click. */}
            {toontVandaag ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-inkt"
                style={{ top: (nu - bereik.van) * PX_PER_MINUUT, gridColumn: "1 / -1" }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A stable empty list, so a day with nothing running does not hand a new array down every render. */
const LEEG: Subthemareeks[] = [];

/** The same, for a day without blocks. */
const GEEN_BLOKKEN: Rasterblok[] = [];

/**
 * The stretches of one day outside the school day and in its middagpauze, in a very light flat tint (FB-023, FB-058,
 * ADR-0038).
 *
 * **Barely there, on purpose** (FB-058): the hatch this replaces was the loudest mark on the screen. The tint is the
 * ground colour, lighter than the tint of a closed day, so "no school today" still reads darker than "no school at
 * this hour", and a closed day keeps its name. Ink, not a hue (Art. XII).
 *
 * **Never the tint alone:** each stretch is edged, on the side that faces the school day, by a dashed line in that
 * day's own column (FB-092), so a day that ends at 12:30 shows it at 12:30 in its column and nowhere else; the day
 * heading says the hours to a screen reader. The gutter writes whole hours only.
 *
 * **It never catches a click.** Every hour stays plannable (ADR-0028), so a 7:45 opvang is placed on the tint exactly
 * as on any other hour.
 */
function Schooltijdlagen({ uren, rasterVan }: { uren: Schooldaguren; rasterVan: number }) {
  const begin = minuten(uren.begin);
  const einde = minuten(uren.einde);
  const pauze =
    uren.middagpauzeBegin && uren.middagpauzeEinde
      ? { begin: minuten(uren.middagpauzeBegin), einde: minuten(uren.middagpauzeEinde) }
      : null;
  const strook = (van: number, tot: number) => ({
    top: (van - rasterVan) * PX_PER_MINUUT,
    height: (tot - van) * PX_PER_MINUUT,
  });

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div data-schooltijd="voor" className={cn(STROOK, "border-b")} style={strook(HEEL_DE_DAG.van, begin)} />
      {pauze ? (
        <div data-schooltijd="pauze" className={cn(STROOK, "border-y")} style={strook(pauze.begin, pauze.einde)} />
      ) : null}
      <div data-schooltijd="na" className={cn(STROOK, "border-t")} style={strook(einde, HEEL_DE_DAG.tot)} />
    </div>
  );
}

// The ground colour at 70% on the white card: about 98% light, against a closed day's `bg-vlak-diep/60`. The edge is
// dashed so it never reads as one of the solid hour lines, and in `lijn-veld` so it holds 3:1 on the card.
const STROOK = "absolute inset-x-0 border-dashed border-lijn-veld bg-vlak/70";

/** The school's hours as the day heading says them to a screen reader, as a clause after the date. */
function urenZin(uren: Schooldaguren | undefined): string {
  if (!uren) return "";
  const dag = t("schooluren.dagZin", { begin: toonTijd(uren.begin), einde: toonTijd(uren.einde) });
  return uren.middagpauzeBegin && uren.middagpauzeEinde
    ? dag + t("schooluren.pauzeZin", { begin: toonTijd(uren.middagpauzeBegin), einde: toonTijd(uren.middagpauzeEinde) })
    : dag;
}

/**
 * The hour every row starts on, computed once: the range is a constant, so a `useMemo` per grid would be ceremony.
 *
 * The last boundary gets neither a line nor a label. A line on the very last pixel is the card's own bottom edge, and
 * a label under it would hang outside the scroller, which is the half-cut hour this replaces at the other end.
 */
const UREN = Array.from({ length: (HEEL_DE_DAG.tot - HEEL_DE_DAG.van) / 60 }, (_, i) => HEEL_DE_DAG.van + i * 60);

/** One line of an algemene fiche's day text on a block, in pixels: its `leading-[0.9375rem]` (FB-022). */
const TEKSTREGEL = 15;

/** Every block of every visible day, of both kinds, in one list the layout and the range can both read. */
function bouwBlokken(dagen: Agendadag[], fichemomenten: readonly Ficheblokje[]): Rasterblok[] {
  const uit: Rasterblok[] = [];

  for (const dag of dagen) {
    for (const activiteit of dag.activiteiten) {
      uit.push({
        id: activiteit.plaatsingId,
        datum: dag.datum,
        begin: minuten(activiteit.begin),
        einde: minuten(activiteit.einde),
        naam: activiteit.activiteitNaam,
        onder: activiteit.subthemaNaam,
        doel: { soort: "activiteit", plaatsingId: activiteit.plaatsingId },
        activiteit,
        // Codes only: the weekplanning row carries no goal text, and the info window fetches it when it opens.
        doelen: activiteit.doelcodes.map((code) => ({ code })),
      });
    }
  }

  const zichtbaar = new Set(dagen.map((dag) => dag.datum));
  for (const moment of fichemomenten) {
    if (!zichtbaar.has(moment.datum)) continue;
    uit.push({
      id: fichemomentSleepId(moment.plaatsingId, moment.momentId),
      datum: moment.datum,
      begin: minuten(moment.begin),
      einde: minuten(moment.einde),
      naam: moment.naam,
      doel: { soort: "fiche", plaatsingId: moment.plaatsingId, momentId: moment.momentId },
      doelen: moment.doelen,
      tekst: moment.tekst ?? undefined,
      stil: moment.terugkerend,
    });
  }

  return uit;
}

/** The blocks by the day they are on, each day's in the order `bouwBlokken` made them. */
function perDag(blokken: Rasterblok[]): Map<string, Rasterblok[]> {
  const uit = new Map<string, Rasterblok[]>();
  for (const blok of blokken) {
    const dag = uit.get(blok.datum);
    if (dag) dag.push(blok);
    else uit.set(blok.datum, [blok]);
  }
  return uit;
}

/** The current time in minutes, kept fresh. One timer for the whole grid rather than one per column. */
function useNu(): number {
  const [nu, setNu] = useState(() => minutenVanNu());

  useEffect(() => {
    const timer = window.setInterval(() => setNu(minutenVanNu()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return nu;
}

function minutenVanNu(): number {
  const nu = new Date();
  return nu.getHours() * 60 + nu.getMinutes();
}

/**
 * The date of one day, whether it is today, and, for someone who cannot see the bands, what runs on it.
 *
 * WHAT THE BANDS SAY, FOR SOMEONE WHO CANNOT SEE THEM. A band's link says where it goes, not what runs, and a blank
 * band is `aria-hidden`: both rely on the day announcing what runs on it, once. Only on a teaching day, which is the
 * only day the bands are drawn on.
 */
function Dagtitel({
  dag,
  isVandaag,
  reeksen,
  vak,
  uren,
  onKiesDag,
}: {
  dag: Agendadag;
  isVandaag: boolean;
  reeksen: readonly Subthemareeks[];
  vak: Themavak | undefined;
  /** The school's hours on this day, for the sentence a screen reader hears; the tint itself is `aria-hidden`. */
  uren: Schooldaguren | undefined;
  onKiesDag?: (datum: string) => void;
}) {
  const kop = (
    <span className="flex items-baseline justify-center gap-1.5">
      <span className="text-micro uppercase text-inkt-zwak">{weekdagKort(dag.datum)}</span>
      <span className={cn("font-display text-body", isVandaag ? "text-inkt" : "text-inkt-zacht")}>
        {dagNummer(dag.datum)}
      </span>
      {isVandaag ? (
        <span className="rounded bg-inkt px-1 py-0.5 text-[0.5625rem] font-medium text-inkt-op">
          {t("periode.vandaag")}
        </span>
      ) : null}
    </span>
  );

  const watErLooptZin = dag.isLesdag ? themaZin(vak) + subthemaZin(reeksen) + urenZin(uren) : "";

  return onKiesDag ? (
    <button
      type="button"
      onClick={() => onKiesDag(dag.datum)}
      aria-label={t("periode.openDag", { dag: volleDag(dag.datum) }) + watErLooptZin}
      className="block w-full rounded-veld py-0.5 transition-colors duration-150 hover:bg-vlak-diep"
    >
      {kop}
    </button>
  ) : (
    // No button to hang the clause on in the day view, so it is spoken after the date itself. The clauses open with a
    // comma and expect a subject in front of them, which the heading is.
    <p className="py-0.5">
      {kop}
      {watErLooptZin ? <span className="sr-only">{watErLooptZin}</span> : null}
    </p>
  );
}

/** What a closed day says in place of its bands, rather than in forty repetitions down the column. */
function Sluiting({ dag }: { dag: Agendadag }) {
  return (
    <p className="truncate px-1 pt-1 text-center text-[0.625rem] text-inkt-zacht">
      {dag.sluitingsnaam ?? t(dag.buitenSchooljaar ? "periode.buitenSchooljaar" : "periode.gesloten")}
    </p>
  );
}

/** The heading of the day view's one day: the date, and what runs on it all day as bands under it. */
function Dagkop({
  dag,
  isVandaag,
  reeksen,
  vak,
  uren,
  altijdNaam,
  onKiesDag,
  onPlanSubthema,
  onHaalSubthemaWeg,
  ruimte,
}: {
  dag: Agendadag;
  isVandaag: boolean;
  reeksen: readonly Subthemareeks[];
  vak: Themavak | undefined;
  uren: Schooldaguren | undefined;
  /** No row of days to carry a name instead, so the bands say what they are on this day too. */
  altijdNaam: boolean;
  onKiesDag?: (datum: string) => void;
  onPlanSubthema?: (plaatsingId: string) => void;
  onHaalSubthemaWeg?: (reeks: Subthemareeks, knop: HTMLElement) => void;
  ruimte: Subthemaruimte;
}) {
  return (
    <div
      aria-current={isVandaag ? "date" : undefined}
      // `px-0.5`, the same inset as a block below it (`Blok`), so the bands and the blocks of a column share one left
      // and one right edge (FB-092).
      className={cn("min-w-0 border-l border-lijn px-0.5 pb-1 pt-2 first:border-l-0", !dag.isLesdag && "bg-vlak-diep/60")}
    >
      <Dagtitel dag={dag} isVandaag={isVandaag} reeksen={reeksen} vak={vak} uren={uren} onKiesDag={onKiesDag} />
      {!dag.isLesdag ? (
        <Sluiting dag={dag} />
      ) : (
        <div className="flex flex-col pt-1">
          <Themastroken vak={vak} datum={dag.datum} dicht altijdNaam={altijdNaam}
            onPlanSubthema={onPlanSubthema}
            ruimte={ruimte}
          />
          <Subthemastroken
            reeksen={reeksen}
            datum={dag.datum}
            dicht
            altijdNaam={altijdNaam}
            onHaalWeg={onHaalSubthemaWeg}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The headings of several days, with the thema and the subthema's running across them as continuous bars (FB-090).
 *
 * ONE GRID FOR THE HEADINGS AND THE BARS, with the same columns as the hours below. Row one holds the dates; each row
 * after it holds bars, placed over the columns they cover. Each column's divider and closed-day tint is a cell that
 * spans every row, drawn first, so a bar crossing it hides the divider under it and reads as one piece, and a closed
 * day, which draws no bars, still shows its tint and its name down the whole band.
 */
function Weekkop({
  dagen,
  reeksenPerDag,
  vakken,
  schooluren,
  vandaagIso,
  onKiesDag,
  onPlanSubthema,
  onHaalSubthemaWeg,
}: {
  dagen: Agendadag[];
  reeksenPerDag: Map<string, Subthemareeks[]>;
  vakken: readonly Themavak[];
  schooluren: readonly Schooldaguren[] | undefined;
  vandaagIso: string;
  onKiesDag?: (datum: string) => void;
  onPlanSubthema?: (plaatsingId: string) => void;
  onHaalSubthemaWeg?: (reeks: Subthemareeks, knop: HTMLElement) => void;
}) {
  const reeksenOp = (dag: Agendadag) => (dag.buitenSchooljaar ? LEEG : (reeksenPerDag.get(dag.datum) ?? LEEG));
  const themas = themabalken(dagen, vakken);
  const subthemas = subthemabalken(dagen, reeksenPerDag);
  const heeftTeveel = subthemas.teveel.some((aantal) => aantal > 0);

  // The rows, numbered as the grid numbers them: the dates are row 1, the bars start at row 2.
  const themarij = 2;
  const eersteSubthemarij = themarij + (themas.length > 0 ? 1 : 0);
  const teveelrij = eersteSubthemarij + subthemas.rijen.length;
  // A closed day names itself in the band, so there is a row for it even in a week without a thema.
  const balkrijen = Math.max(teveelrij + (heeftTeveel ? 1 : 0) - themarij, dagen.some((dag) => !dag.isLesdag) ? 1 : 0);

  return (
    <div
      className="grid min-w-0 flex-1"
      style={{
        gridTemplateColumns: `repeat(${dagen.length}, minmax(0, 1fr))`,
        // A quarter rem under the last row of bars, where the per-day cell kept its bottom padding.
        gridTemplateRows: `auto repeat(${balkrijen}, 1.5rem) 0.25rem`,
      }}
    >
      {dagen.map((dag, i) => (
        <div
          key={`vlak-${dag.datum}`}
          aria-hidden="true"
          className={cn(i > 0 && "border-l border-lijn", !dag.isLesdag && "bg-vlak-diep/60")}
          style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
        />
      ))}
      {dagen.map((dag, i) => {
        const isVandaag = dag.datum === vandaagIso;
        return (
          <div
            key={dag.datum}
            aria-current={isVandaag ? "date" : undefined}
            className="min-w-0 px-1 pb-1 pt-2"
            style={{ gridColumn: i + 1, gridRow: 1 }}
          >
            <Dagtitel
              dag={dag}
              isVandaag={isVandaag}
              reeksen={reeksenOp(dag)}
              vak={dag.buitenSchooljaar ? undefined : vakOpDag(vakken, dag.datum)}
              uren={dag.isLesdag ? urenOp(schooluren, dag.datum) : undefined}
              onKiesDag={onKiesDag}
            />
          </div>
        );
      })}
      {dagen.map((dag, i) =>
        dag.isLesdag ? null : (
          <div key={`dicht-${dag.datum}`} className="min-w-0" style={{ gridColumn: i + 1, gridRow: `2 / span ${balkrijen}` }}>
            <Sluiting dag={dag} />
          </div>
        ),
      )}
      {themas.map((balk) => (
        <Themabalk
          key={`${balk.item.plaatsingId}-${balk.van}`}
          balk={balk}
          rij={themarij}
          // Only where there is room for a subthema: not over a stretch where one already runs on every day (FB-087).
          onPlanSubthema={
            dagen.slice(balk.van, balk.tot + 1).some((dag) => reeksenOp(dag).length === 0) ? onPlanSubthema : undefined
          }
        />
      ))}
      {subthemas.rijen.map((rij, r) =>
        rij.map((balk) => (
          <Subthemabalk
            key={`${balk.item.subthemaId}-${balk.item.van}-${balk.van}`}
            balk={balk}
            rij={eersteSubthemarij + r}
            onHaalWeg={onHaalSubthemaWeg}
          />
        )),
      )}
      {subthemas.teveel.map((aantal, i) =>
        aantal > 0 ? <Subthemateveel key={`teveel-${i}`} kolom={i} rij={teveelrij} aantal={aantal} /> : null,
      )}
    </div>
  );
}

/**
 * One day's column: a drop target, a place to click, and the blocks on it.
 *
 * A closed day takes no drop and offers no click, because the server refuses a placement on it and a target that leads
 * to a refusal should not accept.
 */
function Dagkolom({
  dag,
  blokken,
  uren,
  bereik,
  magPlannen,
  onVoegToe,
  onOpen,
  onOpenFiche,
  onVanDag,
  onWijzigTijd,
}: {
  dag: Agendadag;
  blokken: Rasterblok[];
  /** The school's hours on this day, or undefined on a closed day or a weekday without hours: then nothing is shaded. */
  uren: Schooldaguren | undefined;
  bereik: { van: number; tot: number };
  magPlannen: boolean;
  onVoegToe: (datum: string, begin: number, einde?: number) => void;
  onOpen: (activiteit: GeplandeActiviteit, datum: string) => void;
  onOpenFiche: (plaatsingId: string, momentId: string) => void;
  onVanDag: (doel: Tijddoel, naam: string, datum: string) => void;
  onWijzigTijd: (doel: Tijddoel, datum: string, begin: number, einde: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: kolomId(dag.datum), disabled: !dag.isLesdag || !magPlannen });
  const plekken = useMemo(() => kolommen(blokken), [blokken]);
  const voorbeeld = useSleepvoorbeeld(dag.datum);
  const leeg = useLegePlek(dag.datum, bereik, onVoegToe);

  return (
    <div
      ref={setNodeRef}
      {...{ [KOLOM_ATTRIBUUT]: dag.datum, [VAN_ATTRIBUUT]: bereik.van }}
      className={cn(
        // `first-of-type`, not `first`: the hour lines are spans before the columns, so `first` never matched, and the
        // first column drew a second line beside the gutter and sat its blocks a pixel right of its bands (FB-092).
        "relative min-w-0 border-l border-lijn first-of-type:border-l-0",
        !dag.isLesdag && "bg-vlak-diep/60",
        // The accent as its selected-row use: the day a moved block would land on (ADR-0024 amendment, 2026-09-14).
        isOver && dag.isLesdag && "bg-accent-zacht/60",
      )}
    >
      {/* THE EMPTY COLUMN IS THE INVITATION, and where it is pressed is the quarter it means; dragged across, the
          stretch it means (`useLegePlek`). Behind the blocks (z-0) because they are buttons themselves, and a button
          inside a button is invalid.

          Only for whoever may plan this klas; for anyone else the empty hours are just empty. Every gesture of
          `useLegePlek` is on this button, so without it no quarter lights up and no stretch is drawn either. */}
      {/* THE HOURS OUTSIDE THE SCHOOL DAY, before the button in the DOM so the transparent button lies over them and
          a press on the tint still plans (FB-023). */}
      {uren ? <Schooltijdlagen uren={uren} rasterVan={bereik.van} /> : null}
      {dag.isLesdag && magPlannen ? (
        <button
          type="button"
          {...leeg.gebaren}
          aria-label={t("periode.voegToeOp", { dag: volleDag(dag.datum) })}
          className="absolute inset-0 z-0 w-full cursor-copy"
        />
      ) : null}

      {/* THE QUARTER A CLICK WOULD PICK, under a mouse before it is pressed (owner, 2026-09-14). In ink rather than
          the accent, which is rationed to five uses and this is none of them, and with its own start time written in
          it: the band says which quarter, the time says which hour, so the answer never rests on the tint alone.
          Hidden while a block is being dragged over the column, where the landing spot below answers instead. */}
      {leeg.zweef !== null && voorbeeld === null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0.5 flex items-center rounded-veld bg-vlak-diep px-1.5"
          style={{ top: (leeg.zweef - bereik.van) * PX_PER_MINUUT, height: STAP * PX_PER_MINUUT }}
        >
          <span className="mono text-[0.625rem] font-medium leading-none text-inkt-zacht">{toonTijd(leeg.zweef)}</span>
        </div>
      ) : null}

      {/* Where the dragged block would land, drawn while it is in flight, or the stretch being dragged out on empty
          space. Without it a drag in a grid this fine is a guess: the pointer is somewhere over a column and neither
          it nor the block under it says which quarter of an hour it will take. */}
      {voorbeeld ? (
        <Landingsvak begin={voorbeeld.begin} einde={voorbeeld.einde} rasterVan={bereik.van} />
      ) : leeg.stuk ? (
        <Landingsvak begin={leeg.stuk.begin} einde={leeg.stuk.einde} rasterVan={bereik.van} />
      ) : null}

      {blokken.map((blok) => (
        <Blok
          key={blok.id}
          blok={blok}
          plek={plekken.get(blok.id) ?? { kolom: 0, kolommen: 1 }}
          rasterVan={bereik.van}
          magPlannen={magPlannen}
          onOpen={onOpen}
          onOpenFiche={onOpenFiche}
          onVanDag={onVanDag}
          onWijzigTijd={onWijzigTijd}
        />
      ))}
    </div>
  );
}

/**
 * Where the block being dragged would land in THIS column, or null when the drag is elsewhere.
 *
 * Reads the same module the drop handler reads (`tijdsleep`), so the preview and the mutation cannot disagree about
 * the landing spot: in a calendar that is the difference between a tool you can aim and one you cannot.
 */
function useSleepvoorbeeld(datum: string): { begin: number; einde: number } | null {
  const [voorbeeld, setVoorbeeld] = useState<{ begin: number; einde: number } | null>(null);

  useDndMonitor({
    onDragMove({ active, over }) {
      if (!over || over.id !== kolomId(datum)) {
        setVoorbeeld((vorig) => (vorig === null ? vorig : null));
        return;
      }

      const begin = doelTijd(datum);
      if (begin === null) {
        setVoorbeeld(null);
        return;
      }

      // An algemene fiche out of the panel has no duration yet, since its sheet asks for one, so the preview shows the
      // default the sheet will offer rather than a block of no height.
      const uitPaneel = leesAlgemeneFicheId(String(active.id)) !== null;
      const duur = uitPaneel ? STANDAARDDUUR : Number(active.data.current?.duur ?? STANDAARDDUUR);

      // The previous object while the quarter stays the same. The pointer moves far more often than the quarter it
      // is in, and a new object on every move re-rendered this column and every block in it on each one (TB-071).
      const einde = begin + duur;
      setVoorbeeld((vorig) => (vorig?.begin === begin && vorig.einde === einde ? vorig : { begin, einde }));
    },
    onDragEnd: () => setVoorbeeld(null),
    onDragCancel: () => setVoorbeeld(null),
  });

  return voorbeeld;
}

/** A stretch being dragged out: the quarter it was pressed in, and the quarter the pointer is in now. */
type Trek = { anker: number; nu: number };

/**
 * What the empty column does under a pointer: it lights up the quarter a press would pick, and turns a press and a
 * drag into a stretch of time (owner, 2026-09-14, TB-014).
 *
 * **The quarter the pointer is inside, rounded down** (`vloer`), not the nearest one. The band has to name the hour
 * the click asks for, and a nearest-quarter click asked for the next quarter from the lower half of every band.
 *
 * **A stretch covers both quarters it touches**, whichever way it was dragged, so pressing at 9:00 and letting go
 * inside the 10:15 quarter asks for 9:00 to 10:30. A press that never leaves its quarter is a click: one quarter is
 * not what anybody drags out, and a click gets the activiteit's own length.
 *
 * **Two limits at the end of the day, so that what the grid shows is what gets sent.** A click starts no later than
 * the last quarter that still fits an activiteit of the default length, and the band stops at that quarter too,
 * because it names what the click asks for. A stretch ends no later than a quarter before midnight: the wire format
 * stops at 23:59, so a stretch drawn to midnight would say one time and store another. Both limits bound the answer,
 * never the quarters the gesture is read from, so whether a press was a click or a stretch is decided on the quarters
 * the pointer was really in.
 *
 * **A mouse draws a stretch, a finger does not.** On a touchscreen a finger drawn down the grid scrolls the hours,
 * which a phone cannot give up, and there is no hover to show. A tap still picks its quarter, through the click. A pen
 * is handled as a mouse, which draws a stretch only where the platform does not pan the scroller under it instead.
 *
 * **Its own pointer handling, not dnd-kit**, for the reason `Rekgreep` gives: nothing moves from one place to another,
 * two numbers are chosen inside one column. Capture keeps the stretch following the pointer once it leaves the column,
 * and a stretch whose release never reaches the column (capture lost, the button let go elsewhere) is dropped rather
 * than left for some later release to finish. The stretch lives in a ref as well as in state because the release has
 * to read the last move, and a render need not have happened between the two.
 */
function useLegePlek(
  datum: string,
  bereik: { van: number; tot: number },
  onVoegToe: (datum: string, begin: number, einde?: number) => void,
) {
  const [zweef, setZweef] = useState<number | null>(null);
  const [trek, setTrek] = useState<Trek | null>(null);
  const lopend = useRef<Trek | null>(null);
  // Whether the coming click belongs to a primary mouse or pen press, whose click this column must not answer: its
  // release either answered it, or deliberately let it go (Escape, lost capture). Every primary press sets it. A tap
  // and a keyboard press are answered by the click alone, and a hover clears it: nothing is held, so no press is
  // waiting for its click.
  const doorAanwijzer = useRef(false);

  const zet = (volgende: Trek | null) => {
    lopend.current = volgende;
    setTrek(volgende);
  };

  // The two limits above: the latest quarter a click (and so the band) may name, and the latest end a stretch may have.
  const laatsteKlik = vloer(bereik.tot - STANDAARDDUUR);
  const laatsteEinde = bereik.tot - STAP;

  // The quarter the pointer is in, kept inside the grid and nothing more: the limits belong to the answer.
  const kwartier = (clientY: number, knop: HTMLElement) => {
    const vak = knop.getBoundingClientRect();
    return Math.min(Math.max(vloer((clientY - vak.top) / PX_PER_MINUUT + bereik.van), bereik.van), bereik.tot - STAP);
  };

  // What a stretch between two different quarters asks for: both of them, ended no later than `laatsteEinde`. Two
  // different quarters inside the grid put the earlier one at least two quarters before midnight, so the begin always
  // stays before that end.
  const bereikTussen = (a: number, b: number) => ({
    begin: Math.min(a, b),
    einde: Math.min(Math.max(a, b) + STAP, laatsteEinde),
  });

  // Escape lets go of a stretch the teacher did not mean. Listened for only while one is being drawn.
  const trekt = trek !== null;
  useEffect(() => {
    if (!trekt) return;
    const luister = (gebeurtenis: KeyboardEvent) => {
      if (gebeurtenis.key !== "Escape") return;
      lopend.current = null;
      setTrek(null);
    };
    window.addEventListener("keydown", luister);
    return () => window.removeEventListener("keydown", luister);
  }, [trekt]);

  const gebaren = {
    onPointerDown(gebeurtenis: ReactPointerEvent<HTMLButtonElement>) {
      const primair = gebeurtenis.pointerType !== "touch" && gebeurtenis.button === 0;
      doorAanwijzer.current = primair;
      if (!primair) return;
      // No text selected while the pointer crosses the hour labels on its way down the grid.
      gebeurtenis.preventDefault();
      const hier = kwartier(gebeurtenis.clientY, gebeurtenis.currentTarget);
      zet({ anker: hier, nu: hier });
      setZweef(null);
      gebeurtenis.currentTarget.setPointerCapture?.(gebeurtenis.pointerId);
    },
    onPointerMove(gebeurtenis: ReactPointerEvent<HTMLButtonElement>) {
      if (gebeurtenis.pointerType === "touch") return;
      const hier = kwartier(gebeurtenis.clientY, gebeurtenis.currentTarget);
      if (lopend.current && (gebeurtenis.buttons & 1) === 1) {
        if (hier !== lopend.current.nu) zet({ ...lopend.current, nu: hier });
        return;
      }
      // The primary button came up where this column never heard it, so the stretch it was drawing is over.
      if (lopend.current) zet(null);
      if (gebeurtenis.buttons === 0) {
        // Nothing is held, so no answered press is waiting for its click: a release and its click arrive together,
        // with no move between them.
        doorAanwijzer.current = false;
        setZweef(Math.min(hier, laatsteKlik));
      } else {
        // A button held down with no stretch of this column running is not asking which quarter a click would pick.
        setZweef(null);
      }
    },
    onPointerLeave() {
      setZweef(null);
    },
    onPointerUp() {
      const gesleept = lopend.current;
      if (!gesleept) return;
      zet(null);
      if (gesleept.anker === gesleept.nu) {
        onVoegToe(datum, Math.min(gesleept.anker, laatsteKlik));
        return;
      }
      const { begin, einde } = bereikTussen(gesleept.anker, gesleept.nu);
      onVoegToe(datum, begin, einde);
    },
    onPointerCancel() {
      zet(null);
    },
    // Capture is let go right after a release, which has already finished the stretch; any other loss ends it.
    onLostPointerCapture() {
      zet(null);
    },
    onClick(gebeurtenis: ReactMouseEvent<HTMLButtonElement>) {
      // A keyboard press has no position, so it falls back to the ordinary start of a morning rather than to whatever
      // hour the last pointer happened to be over. `detail === 0` is what says so.
      if (gebeurtenis.detail === 0) {
        onVoegToe(datum, STANDAARDBEGIN);
        return;
      }
      // Read once and cleared: it answers for the one click that follows a mouse's or pen's release, and a later click
      // with no press before it must still be heard.
      const alBeantwoord = doorAanwijzer.current;
      doorAanwijzer.current = false;
      if (alBeantwoord) return;
      onVoegToe(datum, Math.min(kwartier(gebeurtenis.clientY, gebeurtenis.currentTarget), laatsteKlik));
    },
  };

  // Drawn only once the press has left its first quarter. Until then it is a click, which gets the activiteit's own
  // length, and a one-quarter preview would promise a length it will not get.
  const stuk = trek && trek.anker !== trek.nu ? bereikTussen(trek.anker, trek.nu) : null;

  return { zweef, stuk, gebaren };
}

/**
 * Where something is about to be: a block in flight, or a stretch being dragged out on empty space. One look for both,
 * because to a teacher they answer the same question, and its hours written in it so the answer is not the shape alone.
 *
 * **In the accent, as the fifth of its five uses: a selected row.** What it draws is the stretch of time the teacher is
 * selecting, and only while she selects it (owner, 2026-09-14, TB-014; recorded above `--color-accent` in `index.css`
 * and in ADR-0024). The hover band is not a selection, which is why it stays ink.
 */
function Landingsvak({ begin, einde, rasterVan }: { begin: number; einde: number; rasterVan: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border-2 border-dashed border-accent bg-accent-zacht/70 px-2 py-1"
      style={{
        top: (begin - rasterVan) * PX_PER_MINUUT,
        height: Math.max(einde - begin, KORTSTE) * PX_PER_MINUUT,
      }}
    >
      <span className="mono text-[0.625rem] font-medium text-accent">{toonBereik(begin, einde)}</span>
    </div>
  );
}

/**
 * One block: an activiteit, or one occurrence of an algemene fiche.
 *
 * **The whole block drags and the whole block opens**, which is the pattern every card in this agenda uses: the
 * pointer sensor wants six pixels of travel before a press counts as a drag, so a press that does not move is a
 * click. On a keyboard the two are two keys, Enter opens and Space picks up (`sleep.ts`).
 *
 * **An algemene fiche carries no colour**, because the palette on a block means the activiteit's own colour and a fiche
 * has none. It is told apart by its glyph and by the word under its name, which is also what makes it readable without
 * colour at all (Art. XII, WCAG 2.2 AA).
 */
function Blok({
  blok,
  plek,
  rasterVan,
  magPlannen,
  onOpen,
  onOpenFiche,
  onVanDag,
  onWijzigTijd,
}: {
  blok: Rasterblok;
  plek: { kolom: number; kolommen: number };
  rasterVan: number;
  /** Without it the block only opens: no drag, no grip, no right-click menu, and no drag semantics on the button. */
  magPlannen: boolean;
  onOpen: (activiteit: GeplandeActiviteit, datum: string) => void;
  onOpenFiche: (plaatsingId: string, momentId: string) => void;
  onVanDag: (doel: Tijddoel, naam: string, datum: string) => void;
  onWijzigTijd: (doel: Tijddoel, datum: string, begin: number, einde: number) => void;
}) {
  // What pressing the block does, and what the right-click menu's "Bewerken" does too (TB-030): one sheet, two ways in.
  const open = () => {
    const doel = blok.doel;
    if (doel.soort === "activiteit") {
      if (blok.activiteit) onOpen(blok.activiteit, blok.datum);
    } else onOpenFiche(doel.plaatsingId, doel.momentId);
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: blok.id,
    data: { naam: blok.naam, duur: blok.einde - blok.begin },
    disabled: !magPlannen,
  });
  const [rekEinde, setRekEinde] = useState<number | null>(null);

  const einde = rekEinde ?? blok.einde;
  // An open proposal of a weekvoorstel (FB-027) wears the faint AI ring and the wand instead of its colour, so it
  // cannot be taken for a block she planned (ADR-0051); the strip above the grid says why it is there and decides it.
  const voorstel = blok.activiteit?.status === "Voorgesteld";
  const kleur = voorstel ? null : (blok.activiteit?.kleur ?? null);
  const breedte = 100 / plek.kolommen;

  /*
    HOW MUCH OF ITSELF A BLOCK CAN SAY, decided by its own height rather than by a single threshold.

    An hour of grid is 56 pixels, so the ordinary 50-minute block has 47 of them: three stacked lines do not fit
    and the third was drawn clipped in half, which a browser pass found and no test could. Three tiers instead:
    an hour or more gets the subtitle as well, half an hour or more puts the name and the time on ONE line, and
    anything shorter keeps the name alone. What a screen reader needs is not lost with it: the accessible name carries
    the name, the hours and, for an algemene fiche, the word that says which kind it is.
  */
  const duur = einde - blok.begin;
  const toont = duur >= 60 ? "alles" : duur >= 30 ? "tijd" : "naam";

  // A block that starts on the hour sits against the hour gutter's own label, so printing its start again says nothing
  // (FB-091): a half-hour block drops the time, a longer one keeps only its end. The accessible name keeps both.
  const opHeelUur = blok.begin % 60 === 0;

  /*
    AN ALGEMENE FICHE'S DAY TEXT, IN WHOLE LINES OF THE ROOM THAT IS LEFT (FB-022). The name line is 18 pixels and the
    time line under it 15.5, after 8 of padding, and the text sets its own 15-pixel leading so this sum holds. A
    45-minute block (42 pixels) has room for one line under the name-and-time line; an hour or more gives the text what
    is left under the time; the glyph and the accessible name say the kind. Whole lines, so no line is drawn cut in half; the rest of the text is in the sheet the block opens.
  */
  const hoogte = duur * PX_PER_MINUUT;
  const tekstregels = !blok.tekst
    ? 0
    : toont === "alles"
      ? Math.max(1, Math.floor((hoogte - 8 - 18 - 15.5) / TEKSTREGEL))
      : toont === "tijd" && hoogte - 8 - 18 >= TEKSTREGEL
        ? 1
        : 0;

  /*
    THE INFO ICON FROM HALF AN HOUR UP (FB-018). A half-hour block is 28 pixels tall, which holds the 24-pixel target
    WCAG 2.2 AA asks for; a quarter is 14, which holds nothing a finger can hit. Below half an hour the goals are in the
    sheet the block opens, which lists them for an activiteit and an algemene fiche alike, so no block's goals are out of
    reach. Measured on the saved length, not on an edge being pulled, so the icon does not blink in and out mid-resize.
  */
  const infodoelen = blok.doelen && blok.einde - blok.begin >= 30 ? blok.doelen : null;

  return (
    <div
      // Above its neighbours while its edge is being pulled, so the end-time tag hanging below it is never covered.
      className={cn("absolute px-0.5", rekEinde !== null ? "z-30" : "z-10")}
      style={{
        top: (blok.begin - rasterVan) * PX_PER_MINUUT,
        height: Math.max(einde - blok.begin, KORTSTE) * PX_PER_MINUUT,
        left: `${plek.kolom * breedte}%`,
        width: `${breedte}%`,
      }}
    >
      <div
        className={cn(
          "group/blok relative h-full overflow-hidden rounded-md border",
          voorstel ? "voorstel-ai" : kleur ? KLEURVLAK[kleur] : blok.doel.soort === "activiteit"
            ? // The same light grey as before, mixed with the card rather than laid over it, so nothing behind the
              // block shows through its name (FB-058).
              "border-lijn bg-[color-mix(in_srgb,var(--color-vlak-diep)_50%,var(--color-kaart))]"
            : // A fiche is paper rather than pigment, one plane deeper than any activiteit block (FB-077); a recurring
              // one is half as deep and has no edge, so the routine stands back behind what is planned (FB-091).
              blok.stil
              ? FICHEVLAK_STIL
              : FICHEVLAK,
          blok.activiteit?.valtBuitenThemaperiode && "border-l-2 border-l-attentie",
          isDragging && "opacity-40",
        )}
      >
        {/* The right-click menu (TB-030) hangs on the block's own button, so it answers wherever the block does. */}
        <Blokmenu
          naam={blok.naam}
          magPlannen={magPlannen}
          onBewerk={open}
          onVanDag={() => onVanDag(blok.doel, blok.naam, blok.datum)}
        >
        <button
          ref={setNodeRef}
          type="button"
          onClick={open}
          // The kind is spoken for a fiche: it carries no colour, so the word under the name is the only thing that
          // tells it from an activiteit, and a short block does not print it.
          aria-label={`${blok.naam}, ${toonBereik(blok.begin, einde)}${
            blok.doel.soort === "activiteit" ? "" : `, ${t("tijdraster.algemeneFiche")}`
          }${voorstel ? `, ${t("weekvoorstel.voorstel")}` : ""}${kleur ? `, ${t(kleurSleutel(kleur))}` : ""}${
            blok.activiteit?.valtBuitenThemaperiode ? `, ${t("periode.buitenPeriode")}` : ""
          }${blok.tekst ? `, ${blok.tekst}` : ""}`}
          // dnd-kit's attributes say "draggable" to a screen reader, so a block that cannot move does not get them.
          {...(magPlannen ? listeners : {})}
          {...(magPlannen ? attributes : {})}
          className={cn(
            "block h-full w-full px-2 py-1 text-left",
            magPlannen && "cursor-grab touch-none active:cursor-grabbing",
            // Room for the info icon in the corner, so the name and the time stop before it instead of under it.
            infodoelen && "pr-7",
          )}
        >
          {/* Clipped at its own edge, so in a block narrowed by a neighbour the time stops before the info icon rather
              than running under it (seen in the FB-018 browser pass). */}
          <span className="flex min-w-0 items-baseline gap-1 overflow-hidden">
            {blok.doel.soort === "fiche" ? (
              <IcoonFiche aria-hidden="true" className="h-3 w-3 shrink-0 self-center text-inkt-zwak" />
            ) : voorstel ? (
              <IcoonToverstok aria-hidden="true" className="h-3 w-3 shrink-0 self-center text-inkt-zacht" />
            ) : null}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-meta",
                blok.stil ? "font-normal text-inkt-zacht" : "font-medium text-inkt",
              )}
            >
              {blok.naam}
            </span>
            {/* Beside the name rather than under it on a half-hour block: stacked, this line is what got clipped.
                Not on a phone when the block also carries the info icon: a column there is about a hundred pixels,
                and the name was left one letter wide. What that costs is the start time for a sighted phone user: the
                hour gutter prints whole hours only, so a block at 9:15 shows its quarter nowhere on the grid. Accepted,
                because a name one letter wide says nothing at all; the time stays in the block's accessible name and
                in the sheet it opens. */}
            {toont === "tijd" && !opHeelUur ? (
              <span className={cn("mono shrink-0 text-[0.625rem] text-inkt-zacht", infodoelen && "max-sm:hidden")}>
                {toonTijd(blok.begin)}
              </span>
            ) : null}
          </span>

          {toont === "alles" ? (
            <>
              <span className="mono block truncate text-[0.625rem] text-inkt-zacht">
                {opHeelUur ? t("tijdraster.tot", { tijd: toonTijd(einde) }) : toonBereik(blok.begin, einde)}
              </span>
              {tekstregels === 0 && blok.onder ? (
                <span className="block truncate text-[0.625rem] text-inkt-zacht">{blok.onder}</span>
              ) : null}
            </>
          ) : null}

          {tekstregels > 0 ? (
            <span
              className="block break-words text-[0.625rem] leading-[0.9375rem] text-inkt"
              style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: tekstregels, overflow: "hidden" }}
            >
              {blok.tekst}
            </span>
          ) : null}
        </button>
        </Blokmenu>

        {/* A sibling of the block's button, above it in the corner: pressing it opens the goals and nothing else. For
            everyone who can see the block, since reading what a block works on is not planning.

            ABOVE THE RESIZE GRIP (z-20 over its z-10). On a half-hour block the grip's 8-pixel strip runs across the
            bottom of the 24-pixel icon, and as the later sibling at the same z it painted over it and took the press:
            the icon's lower third started a resize instead (antagonist, FB-018). The grip keeps the rest of the edge. */}
        {infodoelen ? (
          <Doelinfo naam={blok.naam} doelen={infodoelen} className="absolute right-0.5 top-0.5 z-20" />
        ) : null}

        {magPlannen ? (
          <Rekgreep
            onRek={(deltaPx) => setRekEinde(Math.max(blok.begin + KORTSTE, rond(blok.einde + deltaPx / PX_PER_MINUUT)))}
            onKlaar={() => {
              if (rekEinde !== null && rekEinde !== blok.einde) {
                onWijzigTijd(blok.doel, blok.datum, blok.begin, rekEinde);
              }
              setRekEinde(null);
            }}
            naam={blok.naam}
            actief={rekEinde !== null}
          />
        ) : null}
      </div>

      {/* The end it will get, while the edge is being pulled. A block under half an hour prints no time at all, so
          without this the only way to aim a resize at 10:15 would be to count gridlines. Outside the clipped box so
          it can hang over the edge it describes. */}
      {rekEinde !== null ? (
        <span
          aria-hidden="true"
          className="mono pointer-events-none absolute -bottom-2.5 right-1.5 rounded bg-inkt px-1 py-0.5 text-[0.625rem] font-medium text-inkt-op"
        >
          {toonTijd(rekEinde)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The bottom edge of a block, dragged to change when it ends.
 *
 * **A grip shows where to pull** (owner, 2026-09-11: "ik wil dat dat iets duidelijk wordt, bv als je hovert over de
 * onderkant van de blok dat je een tekentje ziet dat je er aan kan trekken"). Until then the edge was an invisible
 * strip that only the cursor gave away, so it was found by accident or not at all. Two short ink lines centred on the
 * edge, the mark a sheet handle uses for "pull here", in ink because the accent is rationed and none of its five uses
 * is this. They appear when the pointer is anywhere on the block and darken on the edge itself; on a touchscreen,
 * where no hover can reveal them, they stay faintly visible.
 *
 * **Its own pointer handling rather than a second dnd-kit draggable.** dnd-kit moves a thing from one place to
 * another; this changes one number and never leaves the block. It also has to stop the press from reaching the
 * draggable underneath, which is what `stopPropagation` on `pointerdown` does: without it, grabbing the edge would
 * start a move instead.
 *
 * **Pointer capture, so the edge keeps following the finger** once it has left the strip, which is what happens
 * immediately. Deliberately no keyboard role: an 8px edge is not a keyboard target. The same change is a pair of time
 * fields in the activiteit sheet; for an algemene fiche, its detail sheet opened from the block carries that one day's
 * hours as fields.
 */
function Rekgreep({
  onRek,
  onKlaar,
  naam,
  actief,
}: {
  onRek: (deltaPx: number) => void;
  onKlaar: () => void;
  naam: string;
  /** Being pulled right now, so the grip stays drawn even where the pointer has left the block. */
  actief: boolean;
}) {
  const start = useRef<number | null>(null);

  return (
    <span
      aria-hidden="true"
      data-rekgreep={naam}
      onPointerDown={(gebeurtenis) => {
        gebeurtenis.stopPropagation();
        gebeurtenis.preventDefault();
        start.current = gebeurtenis.clientY;
        gebeurtenis.currentTarget.setPointerCapture(gebeurtenis.pointerId);
      }}
      onPointerMove={(gebeurtenis) => {
        if (start.current === null) return;
        onRek(gebeurtenis.clientY - start.current);
      }}
      onPointerUp={(gebeurtenis) => {
        if (start.current === null) return;
        start.current = null;
        gebeurtenis.currentTarget.releasePointerCapture(gebeurtenis.pointerId);
        onKlaar();
      }}
      onPointerCancel={() => {
        start.current = null;
        onKlaar();
      }}
      className="group/greep absolute inset-x-0 bottom-0 z-10 flex h-2 cursor-ns-resize touch-none items-end justify-center pb-0.5"
    >
      <span
        className={cn(
          "block h-[5px] w-4 border-y transition-opacity duration-150 motion-reduce:transition-none",
          actief
            ? "border-inkt opacity-100"
            : // Full strength on a touchscreen, never a faded version: there the grip is the ONLY sign the edge moves,
              // and inkt-zacht at 60% composited to about 2.6:1, under the 3:1 a control needs (SC 1.4.11).
              "border-inkt-zacht opacity-0 group-hover/blok:opacity-100 group-hover/greep:border-inkt pointer-coarse:opacity-100",
        )}
      />
    </span>
  );
}
