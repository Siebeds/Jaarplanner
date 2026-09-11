import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDndMonitor, useDraggable, useDroppable } from "@dnd-kit/core";
import { IcoonHoek } from "../../components/Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { dagNummer, vandaag, volleDag, weekdagKort } from "../../lib/datum";
import type { GeplandeActiviteit } from "../../lib/types";
import { KLEURVLAK, kleurSleutel } from "../activiteiten/kleuren";
import { leesFicheId, momentSleepId } from "../hoeken/sleepids";
import { Subthemastroken } from "./Subthemastroken";
import { Themastroken } from "./Themastroken";
import type { Subthemareeks } from "./subthemareeksen";
import { vakOpDag, type Themavak } from "./themavakken";
import type { Agendadag } from "./roosterdagen";
import {
  KORTSTE,
  OPENEN_OP,
  PX_PER_MINUUT,
  STANDAARDBEGIN,
  STANDAARDDUUR,
  STAP,
  type Blokje,
  kolommen,
  minuten,
  rasterbereik,
  rond,
  toonBereik,
  toonTijd,
} from "./tijd";
import { KOLOM_ATTRIBUUT, VAN_ATTRIBUUT, doelTijd, kolomId } from "./tijdsleep";

/** One appearance of a placed hoek on a day, as the grid draws it. */
export interface Hoekblokje {
  plaatsingId: string;
  momentId: string;
  naam: string;
  datum: string;
  begin: string;
  einde: string;
}

/** What a resize asks the screen to save. The two kinds live behind two endpoints; the grid knows which is which. */
export type Tijddoel =
  | { soort: "activiteit"; plaatsingId: string }
  | { soort: "hoek"; plaatsingId: string; momentId: string };

/** A block on the grid, of either kind, with what it takes to draw and address it. */
type Rasterblok = Blokje & {
  datum: string;
  naam: string;
  onder: string;
  doel: Tijddoel;
  activiteit?: GeplandeActiviteit;
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
 * **Three gestures, and each one says something the others cannot.** Dragging a block moves it in both axes at once
 * (another day, another hour). Dragging its bottom edge changes when it ends. Clicking empty space makes something at
 * that hour. The keyboard has the first through dnd-kit and the second through the activiteit sheet's time fields,
 * which is the non-drag route WCAG 2.2 SC 2.5.7 asks for.
 *
 * **The now-line is ink, not a hue** (Art. XII): the accent is rationed to five uses and none of them is this. It
 * carries the current time as text in the hour gutter, so it is never colour alone.
 */
export function Tijdraster({
  dagen,
  hoekmomenten,
  reeksenPerDag,
  vakken,
  onVoegToe,
  onOpen,
  onOpenHoek,
  onKiesDag,
  onWijzigTijd,
}: {
  /** The days to draw, in order. One for the day view, three on a phone's week, seven on a desktop's. */
  dagen: Agendadag[];
  /** The hoek appearances of the visible range, in one flat list; the grid picks each day's own. */
  hoekmomenten: readonly Hoekblokje[];
  /** The subthema runs covering each day, for the band above the grid. */
  reeksenPerDag: Map<string, Subthemareeks[]>;
  /** The themaperiode each day sits in, for the same band. */
  vakken: readonly Themavak[];
  /** Asked for an activiteit on this day, starting at this minute of it. */
  onVoegToe: (datum: string, begin: number) => void;
  onOpen: (activiteit: GeplandeActiviteit, datum: string) => void;
  onOpenHoek: (plaatsingId: string) => void;
  /** Opens one day on its own. Left out in the day view, which is already that. */
  onKiesDag?: (datum: string) => void;
  /** A block was made longer or shorter by its bottom edge. */
  onWijzigTijd: (doel: Tijddoel, datum: string, begin: number, einde: number) => void;
}) {
  const blokken = useMemo(() => bouwBlokken(dagen, hoekmomenten), [dagen, hoekmomenten]);
  const bereik = useMemo(() => rasterbereik(blokken), [blokken]);
  const hoogte = (bereik.tot - bereik.van) * PX_PER_MINUUT;
  const uren = useMemo(
    () => Array.from({ length: (bereik.tot - bereik.van) / 60 + 1 }, (_, i) => bereik.van + i * 60),
    [bereik],
  );

  const nu = useNu();
  const vandaagIso = vandaag();
  const toontVandaag = dagen.some((dag) => dag.datum === vandaagIso);

  // The grid opens on the school day rather than at its first drawn hour: 7:00 is there for the rare early trip, and
  // a teacher should not have to scroll past an empty hour to reach the morning.
  const scrollvak = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (scrollvak.current) scrollvak.current.scrollTop = (OPENEN_OP - bereik.van) * PX_PER_MINUUT;
  }, [bereik.van]);

  return (
    <div className="overflow-hidden rounded-kaart border border-lijn bg-kaart">
      {/* THE DAY HEADINGS AND THE ALL-DAY BAND, outside the scroller so they stay put while the hours move.
          What is in the band is what is true of a whole day and has no hour: which themaperiode it belongs to and
          which subthema runs on it. The hoeken used to be here too and are in the grid now, on their own time. */}
      <div className="flex border-b border-lijn">
        <div className="w-12 shrink-0 border-r border-lijn sm:w-14" />
        <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${dagen.length}, minmax(0, 1fr))` }}>
          {dagen.map((dag) => (
            <Dagkop
              key={dag.datum}
              dag={dag}
              isVandaag={dag.datum === vandaagIso}
              reeksen={dag.buitenSchooljaar ? LEEG : (reeksenPerDag.get(dag.datum) ?? LEEG)}
              vak={dag.buitenSchooljaar ? undefined : vakOpDag(vakken, dag.datum)}
              onKiesDag={onKiesDag}
            />
          ))}
        </div>
      </div>

      <div ref={scrollvak} className="max-h-[clamp(24rem,calc(100dvh-21rem),46rem)] overflow-y-auto">
        <div className="flex" style={{ height: hoogte }}>
          {/* The hour gutter. Each label sits ON its line rather than inside the hour below it, so the eye reads the
              line as the moment the hour starts. */}
          <div className="relative w-12 shrink-0 border-r border-lijn sm:w-14">
            {uren.map((uur) => (
              <span
                key={uur}
                className="absolute right-1.5 -translate-y-1/2 text-micro text-inkt-zwak"
                style={{ top: (uur - bereik.van) * PX_PER_MINUUT }}
              >
                {toonTijd(uur)}
              </span>
            ))}

            {/* The current time, in words, beside the line that draws it. */}
            {toontVandaag && nu >= bereik.van && nu <= bereik.tot ? (
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
            {uren.map((uur) => (
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
                blokken={blokken.filter((blok) => blok.datum === dag.datum)}
                bereik={bereik}
                onVoegToe={onVoegToe}
                onOpen={onOpen}
                onOpenHoek={onOpenHoek}
                onWijzigTijd={onWijzigTijd}
              />
            ))}

            {/* THE LINE, above the blocks so it is not hidden by a busy morning, and never catching a click. */}
            {toontVandaag && nu >= bereik.van && nu <= bereik.tot ? (
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

/** Every block of every visible day, of both kinds, in one list the layout and the range can both read. */
function bouwBlokken(dagen: Agendadag[], hoekmomenten: readonly Hoekblokje[]): Rasterblok[] {
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
      });
    }
  }

  const zichtbaar = new Set(dagen.map((dag) => dag.datum));
  for (const moment of hoekmomenten) {
    if (!zichtbaar.has(moment.datum)) continue;
    uit.push({
      id: momentSleepId(moment.plaatsingId, moment.momentId),
      datum: moment.datum,
      begin: minuten(moment.begin),
      einde: minuten(moment.einde),
      naam: moment.naam,
      onder: t("tijdraster.hoekenwerk"),
      doel: { soort: "hoek", plaatsingId: moment.plaatsingId, momentId: moment.momentId },
    });
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

/** The heading of one day: the date, whether it is today, and what runs on it all day. */
function Dagkop({
  dag,
  isVandaag,
  reeksen,
  vak,
  onKiesDag,
}: {
  dag: Agendadag;
  isVandaag: boolean;
  reeksen: readonly Subthemareeks[];
  vak: Themavak | undefined;
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

  return (
    <div
      aria-current={isVandaag ? "date" : undefined}
      className={cn("min-w-0 border-l border-lijn px-1 pb-1 pt-2 first:border-l-0", !dag.isLesdag && "bg-vlak-diep/60")}
    >
      {onKiesDag ? (
        <button
          type="button"
          onClick={() => onKiesDag(dag.datum)}
          aria-label={t("periode.openDag", { dag: volleDag(dag.datum) })}
          className="block w-full rounded-veld py-0.5 transition-colors duration-150 hover:bg-vlak-diep"
        >
          {kop}
        </button>
      ) : (
        <p className="py-0.5">{kop}</p>
      )}

      {/* A closed day says so here rather than in forty repetitions down the column. */}
      {!dag.isLesdag ? (
        <p className="truncate px-1 pt-1 text-center text-[0.625rem] text-inkt-zacht">
          {dag.sluitingsnaam ?? t(dag.buitenSchooljaar ? "periode.buitenSchooljaar" : "periode.gesloten")}
        </p>
      ) : (
        <div className="flex flex-col gap-px pt-1">
          <Themastroken vak={vak} datum={dag.datum} dicht />
          <Subthemastroken reeksen={reeksen} datum={dag.datum} dicht />
        </div>
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
  bereik,
  onVoegToe,
  onOpen,
  onOpenHoek,
  onWijzigTijd,
}: {
  dag: Agendadag;
  blokken: Rasterblok[];
  bereik: { van: number; tot: number };
  onVoegToe: (datum: string, begin: number) => void;
  onOpen: (activiteit: GeplandeActiviteit, datum: string) => void;
  onOpenHoek: (plaatsingId: string) => void;
  onWijzigTijd: (doel: Tijddoel, datum: string, begin: number, einde: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: kolomId(dag.datum), disabled: !dag.isLesdag });
  const plekken = useMemo(() => kolommen(blokken), [blokken]);
  const voorbeeld = useSleepvoorbeeld(dag.datum);

  return (
    <div
      ref={setNodeRef}
      {...{ [KOLOM_ATTRIBUUT]: dag.datum, [VAN_ATTRIBUUT]: bereik.van }}
      className={cn(
        "relative min-w-0 border-l border-lijn first:border-l-0",
        !dag.isLesdag && "bg-vlak-diep/60",
        isOver && dag.isLesdag && "bg-accent-zacht/60",
      )}
    >
      {/* THE EMPTY COLUMN IS THE INVITATION, and where it is pressed is the hour it means. Behind the blocks
          (z-0) because they are buttons themselves, and a button inside a button is invalid.

          A keyboard press has no position, so it falls back to the ordinary start of a morning rather than to
          whatever hour the last pointer happened to be over. `detail === 0` is what says so. */}
      {dag.isLesdag ? (
        <button
          type="button"
          onClick={(gebeurtenis) => {
            const vak = gebeurtenis.currentTarget.getBoundingClientRect();
            const geklikt =
              gebeurtenis.detail === 0
                ? STANDAARDBEGIN
                : rond((gebeurtenis.clientY - vak.top) / PX_PER_MINUUT + bereik.van, STAP);
            onVoegToe(dag.datum, Math.min(geklikt, bereik.tot - STANDAARDDUUR));
          }}
          aria-label={t("periode.voegToeOp", { dag: volleDag(dag.datum) })}
          className="absolute inset-0 z-0 w-full cursor-copy"
        />
      ) : null}

      {/* Where the dragged block would land, drawn while it is in flight. Without it a drag in a grid this fine is
          a guess: the pointer is somewhere over a column and the block is under the cursor, and neither says which
          quarter of an hour it will take. */}
      {voorbeeld ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 z-10 rounded-veld border-2 border-dashed border-accent bg-accent-zacht/70 px-2 py-1"
          style={{
            top: (voorbeeld.begin - bereik.van) * PX_PER_MINUUT,
            height: Math.max(voorbeeld.einde - voorbeeld.begin, KORTSTE) * PX_PER_MINUUT,
          }}
        >
          <span className="mono text-[0.625rem] font-medium text-accent">
            {toonBereik(voorbeeld.begin, voorbeeld.einde)}
          </span>
        </div>
      ) : null}

      {blokken.map((blok) => (
        <Blok
          key={blok.id}
          blok={blok}
          plek={plekken.get(blok.id) ?? { kolom: 0, kolommen: 1 }}
          rasterVan={bereik.van}
          onOpen={onOpen}
          onOpenHoek={onOpenHoek}
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

      // A fiche out of the hoekenpaneel has no duration yet, since the sheet asks for one, so the preview shows the
      // default the sheet will offer rather than a block of no height.
      const duur = leesFicheId(String(active.id)) !== null
        ? STANDAARDDUUR
        : Number(active.data.current?.duur ?? STANDAARDDUUR);

      setVoorbeeld({ begin, einde: begin + duur });
    },
    onDragEnd: () => setVoorbeeld(null),
    onDragCancel: () => setVoorbeeld(null),
  });

  return voorbeeld;
}

/**
 * One block: an activiteit or one appearance of a hoek.
 *
 * **The whole block drags and the whole block opens**, which is the pattern every card in this agenda uses: the
 * pointer sensor wants six pixels of travel before a press counts as a drag, so a press that does not move is a
 * click. On a keyboard the two are two keys, Enter opens and Space picks up (`sleep.ts`).
 *
 * **A hoek carries no colour**, because the palette on a block means the activiteit's own colour and a corner does
 * not have one. It is told apart by its glyph and by the word under its name, which is also what makes it readable
 * without colour at all (Art. XII, WCAG 2.2 AA).
 */
function Blok({
  blok,
  plek,
  rasterVan,
  onOpen,
  onOpenHoek,
  onWijzigTijd,
}: {
  blok: Rasterblok;
  plek: { kolom: number; kolommen: number };
  rasterVan: number;
  onOpen: (activiteit: GeplandeActiviteit, datum: string) => void;
  onOpenHoek: (plaatsingId: string) => void;
  onWijzigTijd: (doel: Tijddoel, datum: string, begin: number, einde: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: blok.id,
    data: { naam: blok.naam, duur: blok.einde - blok.begin },
  });
  const [rekEinde, setRekEinde] = useState<number | null>(null);

  const einde = rekEinde ?? blok.einde;
  const kleur = blok.activiteit?.kleur ?? null;
  const breedte = 100 / plek.kolommen;

  /*
    HOW MUCH OF ITSELF A BLOCK CAN SAY, decided by its own height rather than by a single threshold.

    An hour of grid is 56 pixels, so the ordinary 50-minute block has 47 of them: three stacked lines do not fit
    and the third was drawn clipped in half, which a browser pass found and no test could. Three tiers instead:
    an hour or more gets the subtitle as well, half an hour or more puts the name and the time on ONE line, and
    anything shorter keeps the name alone. Nothing is lost either way, because the accessible name on the button
    carries the whole of it.
  */
  const duur = einde - blok.begin;
  const toont = duur >= 60 ? "alles" : duur >= 30 ? "tijd" : "naam";

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
          "group/blok relative h-full overflow-hidden rounded-veld border",
          kleur ? KLEURVLAK[kleur] : blok.doel.soort === "hoek" ? "border-lijn bg-vlak" : "border-lijn bg-vlak-diep/50",
          blok.activiteit?.valtBuitenThemaperiode && "border-l-2 border-l-attentie",
          isDragging && "opacity-40",
        )}
      >
        <button
          ref={setNodeRef}
          type="button"
          onClick={() =>
            blok.doel.soort === "activiteit" && blok.activiteit
              ? onOpen(blok.activiteit, blok.datum)
              : onOpenHoek(blok.doel.plaatsingId)
          }
          aria-label={`${blok.naam}, ${toonBereik(blok.begin, einde)}${
            kleur ? `, ${t(kleurSleutel(kleur))}` : ""
          }${blok.activiteit?.valtBuitenThemaperiode ? `, ${t("periode.buitenPeriode")}` : ""}`}
          {...listeners}
          {...attributes}
          className="block h-full w-full cursor-grab touch-none px-2 py-1 text-left active:cursor-grabbing"
        >
          <span className="flex min-w-0 items-baseline gap-1">
            {blok.doel.soort === "hoek" ? (
              <IcoonHoek aria-hidden="true" className="h-3 w-3 shrink-0 self-center text-inkt-zwak" />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-meta font-medium text-inkt">{blok.naam}</span>
            {/* Beside the name rather than under it on a half-hour block: stacked, this line is what got clipped. */}
            {toont === "tijd" ? (
              <span className="mono shrink-0 text-[0.625rem] text-inkt-zacht">{toonTijd(blok.begin)}</span>
            ) : null}
          </span>

          {toont === "alles" ? (
            <>
              <span className="mono block truncate text-[0.625rem] text-inkt-zacht">
                {toonBereik(blok.begin, einde)}
              </span>
              <span className="block truncate text-[0.625rem] text-inkt-zacht">{blok.onder}</span>
            </>
          ) : null}
        </button>

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
 * fields in the activiteit sheet; for a hoek, the detail sheet sets the hours of the whole run rather than of one day.
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
            : "border-inkt-zacht opacity-0 group-hover/blok:opacity-100 group-hover/greep:border-inkt pointer-coarse:opacity-60",
        )}
      />
    </span>
  );
}
