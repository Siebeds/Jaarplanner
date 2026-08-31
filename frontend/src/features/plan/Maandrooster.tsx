import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { GeplandeActiviteit } from "../../lib/types";
import type { HoekplaatsingWeergave } from "../hoeken/gegevens";
import type { Agendadag } from "./roosterdagen";
import { dagNummer, maandVan, maandagVan, vandaag, verschuif, volleDag, weekdagIndex, weekdagKort } from "../../lib/datum";
import { t } from "../../i18n";
import { Dagplus } from "./Dagplus";
import { Subthemastroken } from "./Subthemastroken";
import { Hoekstroken } from "../hoeken/Hoekstroken";
import { hoekZin } from "../hoeken/hoekzin";
import { Themastroken } from "./Themastroken";
import { subthemaZin, type Subthemareeks } from "./subthemareeksen";
import { themaZin, vakOpDag, type Themavak } from "./themavakken";
import { KLEURVLAK, kleurSleutel } from "../activiteiten/kleuren";
import { cn } from "../../lib/cn";

/**
 * A month, as the grid everyone already knows: seven columns starting on Monday.
 *
 * This is the agenda's opening view, so it does more than answer where the work sits. The day number
 * is a button into that day, every activiteit on it is a button into that activiteit, and the cell
 * is a drop target. What it deliberately does NOT try to be is an editor: a 96 pixel cell cannot
 * hold a form, and trying is how month views become unusable.
 *
 * The cell used to be one big button. It cannot stay one: a draggable activiteit is itself a button,
 * and a button inside a button is invalid and unreachable by keyboard.
 *
 * Days outside the period the teacher is in are shown rather than blanked, and dimmed: a period
 * rarely starts on the first of the month, and hiding the surrounding days makes the grid lie about
 * what a week looks like.
 */
export function Maandrooster({
  dagen,
  ankerMaand,
  vakken,
  reeksenPerDag,
  hoekplaatsingen,
  onKiesDag,
  onOpen,
  onVoegToe,
}: {
  dagen: Agendadag[];
  ankerMaand: string;
  /**
   * Every themaperiode of the school year with the thema's in it.
   *
   * The WHOLE year rather than the one the teacher stands in, because each cell answers for its own
   * day. This prop used to be `periodeVan`/`periodeTot`, a single range derived from the anchored
   * day, and a month grid then dimmed every one of its cells as "outside the period" whenever that
   * anchor had drifted into the period before it. See `themavakken`.
   */
  vakken: readonly Themavak[];
  /** Which subthema runs cover each day, so a cell can name what is running on it. */
  reeksenPerDag: Map<string, Subthemareeks[]>;
  /**
   * The hoeken running in the visible range.
   *
   * A flat list rather than a map per day, unlike the subthema runs beside it: a hoekplaatsing is
   * already a window, so a cell answers "am I inside it" with a comparison instead of a lookup, and
   * there is no derivation step that could disagree with the calendar.
   */
  hoekplaatsingen: readonly HoekplaatsingWeergave[];
  onKiesDag: (datum: string) => void;
  onOpen: (activiteit: GeplandeActiviteit, datum: string) => void;
  /** Asked for an activiteit on this day, straight from the month. Lands in lesuur 1. */
  onVoegToe: (datum: string) => void;
}) {
  if (dagen.length === 0) return null;

  const maand = maandVan(ankerMaand);
  const nu = vandaag();

  // The column headers come from a whole week, not from the first seven days returned. The server
  // clamps a range to the school year, so a month whose grid starts before the first school day
  // comes back short at the front: reading the headers off the data then labelled Tuesday as Monday
  // and shifted every cell in the month by one column. Visible on the agenda's opening screen in
  // september, and by construction invisible in any month that starts mid-year.
  const eersteMaandag = maandagVan(dagen[0].datum);
  const kopdagen = Array.from({ length: 7 }, (_, i) => verschuif(eersteMaandag, i));

  // For the same reason the first cell is placed by its weekday rather than by its index.
  const voorloop = weekdagIndex(dagen[0].datum);

  return (
    <div>
      <ol className="mb-1 grid grid-cols-7 gap-1">
        {kopdagen.map((datum) => (
          <li key={datum} className="text-micro uppercase text-inkt-zwak">
            {weekdagKort(datum)}
          </li>
        ))}
      </ol>

      <ol className="grid grid-cols-7 gap-1">
        {Array.from({ length: voorloop }, (_, i) => (
          <li key={`leeg-${i}`} aria-hidden="true" />
        ))}
        {dagen.map((dag) => (
          <li key={dag.datum}>
            <Maandcel
              dag={dag}
              buitenMaand={maandVan(dag.datum) !== maand}
              vak={vakOpDag(vakken, dag.datum)}
              isVandaag={dag.datum === nu}
              reeksen={reeksenPerDag.get(dag.datum) ?? LEEG}
              hoekplaatsingen={hoekplaatsingen}
              onKiesDag={onKiesDag}
              onVoegToe={onVoegToe}
              onOpen={onOpen}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A stable empty list, so a day with nothing running does not hand a new array down every render. */
const LEEG: Subthemareeks[] = [];

function Maandcel({
  dag,
  buitenMaand,
  vak,
  isVandaag,
  reeksen,
  hoekplaatsingen,
  onKiesDag,
  onVoegToe,
  onOpen,
}: {
  dag: Agendadag;
  buitenMaand: boolean;
  vak: Themavak | undefined;
  isVandaag: boolean;
  reeksen: readonly Subthemareeks[];
  hoekplaatsingen: readonly HoekplaatsingWeergave[];
  onKiesDag: (datum: string) => void;
  onVoegToe: (datum: string) => void;
  onOpen: (activiteit: GeplandeActiviteit, datum: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dag.datum, disabled: !dag.isLesdag });

  // Outside the school year there is nothing running, and a strip on a cell that reads "Buiten het
  // schooljaar" would contradict it. The runs are derived from placements, so this cannot happen
  // from the data; it is stated because the derivation is one query away from changing.
  const stroken = dag.buitenSchooljaar ? LEEG : reeksen;

  // Same reasoning one line up: outside the school year there is no themaperiode to report either.
  const periode = dag.buitenSchooljaar ? undefined : vak;
  const inPeriode = periode !== undefined;

  return (
    <div
      ref={setNodeRef}
      aria-current={isVandaag ? "date" : undefined}
      className={cn(
        // `overflow-hidden` for the subthema strip: it runs to both edges of the cell, so the cell's
        // own rounded corners have to be the ones that cut it.
        "group/cel relative flex h-16 w-full flex-col gap-1 overflow-hidden rounded-veld border p-1.5 transition-colors duration-100 sm:h-28",
        // A day outside the month recedes by losing its card, NOT by opacity. `opacity-45` dimmed
        // the text with the surface and took the day number to 2.2:1, and it does it invisibly to
        // any check that reads colour without composing the alpha of every ancestor. Measured after
        // that check was fixed to parse Tailwind 4's oklab() alpha form, which it had been reading
        // as rgb and getting wrong in the other direction.
        buitenMaand ? "bg-vlak" : dag.isLesdag ? "bg-kaart" : "bg-vlak-diep/60",
        inPeriode && !buitenMaand ? "border-lijn" : "border-transparent",
        isVandaag && "border-inkt",
        isOver && "border-accent bg-accent-zacht opacity-100",
      )}
    >
      {/* The WHOLE cell opens the day, not just the number. A cell is a day: a teacher aiming at a
          40 pixel target to reach a day they can see the whole of is a teacher missing.

          It has to be an overlay behind the content rather than a button around it, because the
          activiteiten inside are themselves buttons and a button inside a button is invalid and
          unreachable by keyboard. Everything above it that is not itself pressable passes its clicks
          straight through. */}
      <button
        type="button"
        onClick={() => onKiesDag(dag.datum)}
        aria-label={
          (!dag.isLesdag
            ? t("periode.openDagGesloten", {
                dag: volleDag(dag.datum),
                naam: dag.sluitingsnaam ?? t("periode.gesloten"),
              })
            : dag.activiteiten.length > 0
              ? t("periode.openDagMet", { dag: volleDag(dag.datum), aantal: dag.activiteiten.length })
              : t("periode.openDag", { dag: volleDag(dag.datum) })) +
          themaZin(periode) +
          subthemaZin(stroken) +
          hoekZin(hoekplaatsingen, dag.datum)
        }
        className="absolute inset-0 z-0 rounded-veld transition-colors duration-150 hover:bg-vlak-diep/60"
      />

      {/* What is running here, along the top edge. Full bleed, so a run reads as a band across the
          days rather than as a chip inside each of them.

          Not on a phone: a column there is about 44 pixels, where a subthema name truncates to three
          letters, and a strip with no room for its name would carry its identity in hue alone. The
          week and day views print it in full, and the day's own button says it out loud. */}
      <div className="relative z-10 -mx-1.5 -mt-1.5 hidden flex-col gap-px sm:flex">
        <Themastroken vak={periode} datum={dag.datum} dicht />
        <Subthemastroken reeksen={stroken} datum={dag.datum} dicht />
        <Hoekstroken plaatsingen={hoekplaatsingen} datum={dag.datum} dicht />
      </div>

      {/* Adding straight from the month, without the detour through the day.

          Above the cell's overlay button (z-20) because it must be reachable, and quiet until the
          cell is hovered or the plus itself has focus: a grid of 30 always-loud plusses would be the
          first thing the eye lands on, and what a month is for is reading.

          On a phone it is visible rather than revealed, because there is no hover to reveal it with;
          `Dagplus` owns that switch. *This paragraph used to say the opposite* ("not on a phone"),
          and went on saying it after the plus was made unconditional, which is the failure mode a
          comment about layout has: nothing rechecks it.

          WHICH CORNER, and why it differs by breakpoint. From `sm` it is the bottom right, because
          the top right is where the thema band is: the band is full bleed and 16 pixels tall, the
          plus is 28, so hovering a cell put the plus straight over the name of the running thema.
          Below `sm` there is no band (the strip above is `hidden sm:flex`), so the top corner is the
          free one there and the plus stays in it.

          `sm:bg-kaart` because the bottom of a cell is where the activiteit chips sit. The plus is
          revealed over them rather than beside them, and a transparent 28 pixel square laid on a
          chip reads as one smudged label instead of two things. It masks instead. The cost is that
          on a full day the tail of the bottom chip is hidden WHILE the pointer is in the cell; the
          chip is still there, and the day button's own label carries the count either way. */}
      {dag.isLesdag ? (
        <Dagplus
          datum={dag.datum}
          onVoegToe={onVoegToe}
          className="absolute right-1 top-1 z-20 sm:bottom-1 sm:top-auto sm:bg-kaart"
        />
      ) : null}

      {/* Today is a filled pill, not another hue: this grid already spends colour on the activiteiten
          inside the cells, and a shape reads at 40 pixels where a tint does not. The word itself does
          not fit here, so the cell carries aria-current. */}
      <span
        className={cn(
          "pointer-events-none relative z-10 mono self-start rounded px-1.5 py-0.5 text-[0.6875rem]",
          isVandaag
            ? "bg-inkt font-medium text-inkt-op"
            : inPeriode && !buitenMaand
              ? "font-medium text-inkt"
              : // `inkt-zwak` measures 4.97:1 on white and 4.38:1 on a closed day's tint, which is
                // under the floor for 11px text. `inkt-zacht` clears it on both.
                "text-inkt-zacht",
        )}
      >
        {dagNummer(dag.datum)}
      </span>

      {!dag.isLesdag ? (
        /* Hidden on a phone, where a 44 pixel column truncates "Herfstvakantie" to "Her..." and a
           clipped word says less than the dimmed cell already does. The name is not lost: it is in
           the day button's own label, and the week and day views print it in full. */
        <span className="pointer-events-none relative z-10 hidden truncate px-1 text-[0.625rem] text-inkt-zacht sm:block">
          {dag.sluitingsnaam ?? t(dag.buitenSchooljaar ? "periode.buitenSchooljaar" : "periode.gesloten")}
        </span>
      ) : (
        <>
          {/* On a phone a column is about 44 pixels, where an activiteit's name truncates to two
              letters and says nothing. So the small screen gets presence instead of names: a dot per
              activiteit, and the day number beside it is the way in. Hidden from assistive
              technology because the button's own label already carries the count. */}
          <span aria-hidden="true" className="pointer-events-none relative z-10 flex flex-1 items-end gap-0.5 sm:hidden">
            {dag.activiteiten.slice(0, 3).map((activiteit) => (
              <span key={activiteit.plaatsingId} className="h-1.5 w-1.5 rounded-full bg-accent" />
            ))}
            {dag.activiteiten.length > 3 ? (
              <span className="mono text-[0.5625rem] text-inkt-zwak">{dag.activiteiten.length}</span>
            ) : null}
          </span>

          <ul className="pointer-events-none relative z-10 hidden flex-1 flex-col justify-end gap-0.5 overflow-hidden sm:flex">
            {dag.activiteiten.slice(0, 2).map((activiteit) => (
              <li key={activiteit.plaatsingId}>
                <Maandchip activiteit={activiteit} datum={dag.datum} onOpen={onOpen} />
              </li>
            ))}
            {dag.activiteiten.length > 2 ? (
              <li className="mono pointer-events-none text-[0.625rem] text-inkt-zacht">
                {t("periode.nogMeer", { aantal: dag.activiteiten.length - 2 })}
              </li>
            ) : null}
          </ul>
        </>
      )}
    </div>
  );
}

function Maandchip({
  activiteit,
  datum,
  onOpen,
}: {
  activiteit: GeplandeActiviteit;
  datum: string;
  onOpen: (activiteit: GeplandeActiviteit, datum: string) => void;
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
      onClick={() => onOpen(activiteit, datum)}
      // The colour is the teacher's own and means nothing the application reads, but it still may not
      // be carried by hue alone: at this size there is no room for the name beside it, so it travels
      // in the accessible name instead. The visible text is inside it, per SC 2.5.3.
      aria-label={
        kleur
          ? t("periode.activiteitMetKleur", { naam: activiteit.activiteitNaam, kleur: t(kleurSleutel(kleur)) })
          : undefined
      }
      {...listeners}
      {...attributes}
      className={cn(
        "pointer-events-auto block w-full cursor-grab touch-none truncate rounded border-l-2 bg-vlak px-1 py-0.5 text-left text-[0.625rem] text-inkt",
        // The wash takes the FILL. The left border is already spoken for: attentie there means the
        // activiteit falls outside its own themaperiode, and a teacher-chosen hue on the same edge
        // would overwrite that. Listed before the border classes so tailwind-merge keeps the border.
        kleur && KLEURVLAK[kleur],
        activiteit.valtBuitenThemaperiode ? "border-attentie" : "border-accent",
        isDragging && "opacity-40",
      )}
    >
      {activiteit.activiteitNaam}
    </button>
  );
}
