import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { GeplandeActiviteit } from "../../lib/types";
import type { Agendadag } from "./roosterdagen";
import { vandaag, volleDag } from "../../lib/datum";
import { t } from "../../i18n";
import { KLEURVLAK, kleurSleutel } from "../activiteiten/kleuren";
import { cn } from "../../lib/cn";
import { Dagplus } from "./Dagplus";
import { Subthemastroken } from "./Subthemastroken";
import { Hoekstroken } from "../hoeken/Hoekstroken";
import { hoekZin } from "../hoeken/hoekzin";
import { Themastroken } from "./Themastroken";
import { subthemaZin, type Subthemareeks } from "./subthemareeksen";
import type { HoekplaatsingWeergave } from "../hoeken/gegevens";
import { themaZin, type Themavak } from "./themavakken";

/**
 * One teaching day, with what is scheduled on it.
 *
 * The same component is a column in the week view and the whole screen in the day view; only its
 * height differs. That is deliberate: a day looks the same wherever a teacher meets it, so the
 * layout switch does not also change what a day means.
 *
 * **A column behaves like a month cell.** Pressing anywhere that is not a card or the plus opens
 * the day, through an overlay behind the content rather than a wrapper around it: the activiteiten
 * are themselves buttons, and a button inside a button is invalid and unreachable by keyboard. Only
 * the small date at the top used to be pressable, which made the same intention two different
 * targets depending on which view a teacher was standing in.
 *
 * A closed day (vakantie, vrije dag) shows the name of the closure, offers no add button and takes
 * no drop. The server refuses a placement on a closed day, and a target that leads to a refusal is a
 * target that should not accept.
 *
 * Today is marked with the word and with a darker border, never with the border alone: a teacher
 * scanning a week of near-identical columns should not have to compare edge weights to find the day
 * they are standing in.
 */
export function Dagcel({
  dag,
  kop,
  bovenkop,
  groot,
  reeksen = LEEG,
  hoekplaatsingen = GEEN_HOEKEN,
  vak,
  onVoegToe,
  onOpen,
  onKiesDag,
}: {
  dag: Agendadag;
  kop: string;
  bovenkop?: string;
  groot?: boolean;
  /** The subthema runs covering this day. */
  reeksen?: readonly Subthemareeks[];
  /**
   * The hoeken running in the range this cell belongs to.
   *
   * Defaulted, because the week view is not the only caller and a cell without them is a cell that
   * simply has none. It went missing here when the month view got its band: the week view was left
   * drawing nothing, so a placement made on a Tuesday was invisible on the very screen a teacher
   * plans a week in.
   */
  hoekplaatsingen?: readonly HoekplaatsingWeergave[];
  /** The themaperiode this day sits in, or undefined between two periods. */
  vak?: Themavak;
  onVoegToe: (datum: string) => void;
  onOpen: (activiteit: GeplandeActiviteit) => void;
  /** Opens this day on its own. Left out in the day view, which is already that. */
  onKiesDag?: (datum: string) => void;
}) {
  const isVandaag = dag.datum === vandaag();
  const { setNodeRef, isOver } = useDroppable({ id: dag.datum, disabled: !dag.isLesdag });

  // See the month cell: a day the school year does not contain has nothing running on it, and a
  // strip there would contradict the sentence the column itself prints.
  const stroken = dag.buitenSchooljaar ? LEEG : reeksen;
  const periode = dag.buitenSchooljaar ? undefined : vak;

  return (
    <div
      ref={setNodeRef}
      aria-current={isVandaag ? "date" : undefined}
      className={cn(
        // `overflow-hidden` for the subthema strip along the top edge, which runs to both sides of
        // the card and therefore has to be cut by the card's own corners.
        "group/cel relative flex h-full min-w-0 flex-col overflow-hidden rounded-kaart border bg-kaart transition-colors duration-100",
        dag.isLesdag ? "border-lijn" : "border-lijn bg-vlak-diep/60",
        isVandaag && "border-inkt",
        // The target says so while the pointer is over it. Fill AND border, because a border alone
        // on a grid that already borders every cell is a difference nobody sees mid-drag.
        isOver && "border-accent bg-accent-zacht",
        groot ? "min-h-64" : "min-h-40",
      )}
    >
      {/* The whole column, minus whatever is pressable on top of it. */}
      {onKiesDag ? (
        <button
          type="button"
          onClick={() => onKiesDag(dag.datum)}
          aria-label={
            (dag.activiteiten.length > 0
              ? t("periode.openDagMet", { dag: volleDag(dag.datum), aantal: dag.activiteiten.length })
              : t("periode.openDag", { dag: volleDag(dag.datum) })) +
            themaZin(periode) +
            subthemaZin(stroken) +
            hoekZin(hoekplaatsingen, dag.datum)
          }
          className="absolute inset-0 z-0 rounded-kaart transition-colors duration-150 hover:bg-vlak-diep/50"
        />
      ) : null}

      {/* What is running on this day, above the date rather than on each card. The cards name their
          own subthema, which answers "what is this activiteit part of"; the strip answers the other
          question, which is which days the subthema covers. On an empty Wednesday in the middle of a
          run the cards say nothing and the strip is the only thing that does. */}
      <div className="relative z-10 flex flex-col gap-px">
        <Themastroken vak={periode} datum={dag.datum} />
        <Subthemastroken reeksen={stroken} datum={dag.datum} />
        <Hoekstroken plaatsingen={hoekplaatsingen} datum={dag.datum} />
      </div>

      {/* Weekday over date, the way a calendar has always written it. One line of "ma 28" fits in
          less room and is harder to scan, which is the trade an agenda should not take. */}
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-2 border-b border-lijn px-3 py-2">
        <span className="flex min-w-0 items-baseline gap-2">
          {bovenkop ? <span className="text-micro uppercase text-inkt-zwak">{bovenkop}</span> : null}
          <span className="truncate font-display text-sectie leading-none text-inkt">{kop}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {isVandaag ? (
            <span className="rounded bg-inkt px-1.5 py-0.5 text-[0.625rem] font-medium text-inkt-op">
              {t("periode.vandaag")}
            </span>
          ) : null}
          {dag.activiteiten.length > 0 ? (
            <span className="mono text-[0.625rem] text-inkt-zwak">{dag.activiteiten.length}</span>
          ) : null}
          {dag.isLesdag ? (
            <Dagplus datum={dag.datum} onVoegToe={onVoegToe} className="pointer-events-auto -mr-1" />
          ) : null}
        </span>
      </div>

      {!dag.isLesdag ? (
        <p className="pointer-events-none relative z-10 flex flex-1 items-center justify-center px-3 py-4 text-center text-meta text-inkt-zwak">
          {dag.sluitingsnaam ?? t(dag.buitenSchooljaar ? "periode.buitenSchooljaar" : "periode.geenLesdag")}
        </p>
      ) : dag.activiteiten.length > 0 ? (
        <ul className="pointer-events-none relative z-10 flex flex-col gap-1.5 p-2">
          {dag.activiteiten.map((activiteit) => (
            <li key={activiteit.plaatsingId}>
              <Sleepbare activiteit={activiteit} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A stable empty list, so a day with nothing running does not hand a new array down every render. */
const LEEG: Subthemareeks[] = [];

/** One frozen empty list, so a cell without hoeken does not hand a new array to every render. */
const GEEN_HOEKEN: readonly HoekplaatsingWeergave[] = [];

/**
 * One activiteit on a day: a button that opens it, and a handle that drags it to another day.
 *
 * Both on the same element rather than a separate grip. The pointer sensor asks for six pixels of
 * travel before it calls a press a drag, so a click still opens the sheet, and a keyboard user gets
 * the same element with dnd-kit's own space-and-arrows binding.
 *
 * The dragged copy is not rendered here. It is a DragOverlay in the screen above, because a
 * transform on the original leaves a hole in the column it came from and drags nothing across a
 * cell that clips its overflow.
 */
export function Sleepbare({
  activiteit,
  onOpen,
}: {
  activiteit: GeplandeActiviteit;
  onOpen: (activiteit: GeplandeActiviteit) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: activiteit.plaatsingId,
    data: { naam: activiteit.activiteitNaam },
  });
  const kleur = activiteit.kleur;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(activiteit)}
      // See the note on the month chip: the wash takes the fill, the left border keeps its meaning,
      // and the colour's name travels in the accessible name because the card has no room for it.
      aria-label={
        kleur
          ? t("periode.activiteitMetKleur", { naam: activiteit.activiteitNaam, kleur: t(kleurSleutel(kleur)) })
          : undefined
      }
      {...listeners}
      {...attributes}
      className={cn(
        "pointer-events-auto w-full cursor-grab touch-none rounded-veld border-l-2 bg-vlak px-2.5 py-2 text-left transition-colors duration-150 hover:bg-vlak-diep",
        kleur && KLEURVLAK[kleur],
        activiteit.valtBuitenThemaperiode ? "border-attentie" : "border-accent",
        isDragging && "opacity-40",
      )}
    >
      <span className="block truncate text-meta font-medium text-inkt">{activiteit.activiteitNaam}</span>
      {/* The SUBTHEMA, not the thema. The chip above the grid already names the thema of the period,
          and a card that repeats it spends its second line on a fact that is the same on every card
          in view. What differs between them, and what the teacher asked to see, is the subthema. */}
      <span className="block truncate text-[0.6875rem] text-inkt-zacht">{activiteit.subthemaNaam}</span>
    </button>
  );
}
