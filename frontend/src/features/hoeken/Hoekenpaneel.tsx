import { useDraggable } from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { Blad } from "../../components/ui/Blad";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonChevron, IcoonHoek, IcoonKruis } from "../../components/Iconen";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import { useMediaQuery, BREED } from "../../lib/scherm";
import { cn } from "../../lib/cn";
import { t } from "../../i18n";
import { periode as periodeTekst } from "../../lib/datum";
import { useHoeken, type HoekplaatsingWeergave, type HoekWeergave } from "./gegevens";
import { FICHE_VOORVOEGSEL } from "./fiche";

/**
 * The hoekenfiches, beside the agenda: the corners this class has, while she plans (owner, 2026-08-30).
 *
 * **Two shapes for one panel, because the app has two.** From `lg` it is a column standing in the
 * space the navigation's labels were using, which is why the navigation collapses to an icon rail
 * when this opens. On a phone there is no sidebar to stand beside, so it is a sheet from the bottom,
 * which is the shape every other secondary surface in this app already uses.
 *
 * **The choice is a media QUERY and not a `lg:hidden` class, and that is not a style preference.**
 * The sheet is a Radix dialog, which portals its content to `document.body`, so a wrapper with
 * `lg:hidden` hides the wrapper and nothing else: on a 1600px screen both shapes rendered at once and
 * the sheet's overlay dimmed the whole agenda behind the column. Found by looking at it, not by a
 * test.
 *
 * **A fiche is dragged onto a day of the agenda.** That is why this component is mounted inside the
 * agenda's `DndContext` even though it is `fixed` and paints nowhere near it: dnd-kit registers a
 * draggable through React context, not through the DOM tree.
 */
export function Hoekenpaneel({
  klasId,
  plaatsingen,
  onKies,
  onOpenPlaatsing,
}: {
  klasId: string | null;
  /**
   * The placements overlapping the range the agenda is showing.
   *
   * **This is what makes a placed hoek reachable at all.** The band on a month cell is
   * `pointer-events-none` and the day view only draws a hoek that took a lesuur, which is not the
   * default, so neither is a dependable way in. The panel is: a corner is listed here whether or not
   * it claims an hour, at every width, and its runs are listed under it.
   */
  plaatsingen: readonly HoekplaatsingWeergave[];
  /**
   * A fiche was CHOSEN rather than dragged: the phone path.
   *
   * Below `lg` the panel is a sheet over the calendar, so there is nothing to drag onto and a
   * draggable fiche would be a control that does nothing. A tap opens the same placement sheet, with
   * the day the agenda is standing on as the start, which is the one thing a tap can say that a drag
   * says with its landing point.
   */
  onKies: (hoekId: string) => void;
  /** One of the runs under a fiche was opened. */
  onOpenPlaatsing: (plaatsingId: string) => void;
}) {
  const open = useHoekenpaneel((s) => s.open);
  const zet = useHoekenpaneel((s) => s.zet);
  const breed = useMediaQuery(BREED);
  const { data: hoeken, isPending } = useHoeken(open ? klasId : null);

  const inhoud = (
    <Fichelijst
      hoeken={hoeken}
      plaatsingen={plaatsingen}
      laadt={klasId !== null && isPending}
      heeftKlas={klasId !== null}
      onKies={breed ? undefined : onKies}
      onOpenPlaatsing={onOpenPlaatsing}
    />
  );

  if (!breed) {
    return (
      <Blad open={open} onOpenChange={zet} titel={t("hoekenpaneel.titel")}>
        {inhoud}
      </Blad>
    );
  }

  /*
    THE COLUMN, FROM `lg`.

    `left-14` is the rail the navigation collapses to, and the two numbers are kept in step by
    `Schil`, which reserves 56 + 240 for the pair.

    It is `aria-hidden` and inert while closed rather than unmounted, so opening it does not refetch
    and the slide has something to animate from.
  */
  return (
    <aside
      aria-label={t("hoekenpaneel.titel")}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "fixed inset-y-0 left-14 z-20 flex w-60 flex-col border-r border-lijn bg-kaart",
        "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
        open ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-4 opacity-0",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-6">
        <h2 className="flex items-center gap-2 text-micro uppercase text-inkt-zwak">
          <IcoonHoek aria-hidden="true" className="h-4 w-4" />
          {t("hoekenpaneel.titel")}
        </h2>
        <button
          type="button"
          onClick={() => zet(false)}
          aria-label={t("hoekenpaneel.sluiten")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
        >
          <IcoonKruis aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{inhoud}</div>
    </aside>
  );
}

/** The corners themselves, or the reason there are none to show. */
function Fichelijst({
  hoeken,
  plaatsingen,
  laadt,
  heeftKlas,
  onKies,
  onOpenPlaatsing,
}: {
  hoeken?: HoekWeergave[];
  plaatsingen: readonly HoekplaatsingWeergave[];
  laadt: boolean;
  heeftKlas: boolean;
  /** Set only where the fiche is tapped rather than dragged. */
  onKies?: (hoekId: string) => void;
  onOpenPlaatsing: (plaatsingId: string) => void;
}) {
  if (!heeftKlas) {
    return <p className="text-meta text-inkt-zacht">{t("hoekenpaneel.geenKlas")}</p>;
  }

  if (laadt) {
    return <Laadlijst rijen={3} />;
  }

  if ((hoeken ?? []).length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-meta text-inkt-zacht">{t("hoekenpaneel.geenHoeken")}</p>
        {/* A real destination, not a sentence about one. This is where she makes them, and it is two
            clicks away otherwise. */}
        <Link
          to="/instellingen"
          className="text-meta font-medium text-accent underline-offset-2 hover:underline"
        >
          {t("hoekenpaneel.naarInstellingen")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {(hoeken ?? []).map((hoek) => (
        <li key={hoek.id} className="flex flex-col gap-1">
          <Fiche hoek={hoek} onKies={onKies} />

          {/* The runs of THIS corner that the agenda is currently showing. Each one opens, which is
              the only reliable route to reading a verrijking back or undoing a misplaced drop.

              THE ROW SAYS WHAT THE DATES ARE. It used to be a hairline and a bare range, and the
              owner read it as a stray date rather than as "this corner is in the agenda then"
              (2026-08-31): under a fiche whose card carries a name and a description, two dates with
              no verb are the only thing on the panel that does not say what it is. The chevron is the
              other half of the answer, because the row also opens something. */}
          {plaatsingen
            .filter((p) => p.hoekId === hoek.id)
            .map((plaatsing) => (
              <button
                key={plaatsing.id}
                type="button"
                onClick={() => onOpenPlaatsing(plaatsing.id)}
                className="ml-3 flex items-center gap-1 rounded-veld px-2 py-1 text-left text-micro text-inkt-zacht transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
              >
                <span className="truncate">
                  {t("hoekenpaneel.ingepland", { periode: periodeTekst(plaatsing.van, plaatsing.tot) })}
                </span>
                <IcoonChevron aria-hidden="true" className="h-3.5 w-3.5 shrink-0 -rotate-90" />
              </button>
            ))}
        </li>
      ))}
    </ul>
  );
}

/**
 * One hoekfiche: the thing a teacher drags onto a day.
 *
 * Deliberately quiet: a card in the chrome column, not a card competing with the calendar beside it.
 * The description is clamped to two lines, because a corner described in four sentences would push
 * the next fiche off the panel, and the whole point of the list is seeing the corners together.
 *
 * **A button, so it works without a mouse.** The pointer sensor needs a few pixels of travel before a
 * press counts as a drag, and on a keyboard Space picks the fiche up: the same two jobs on one
 * element that every draggable in this agenda already has (see `sleep.ts`). On a phone the panel is a
 * sheet over the calendar, so there is nothing to drag onto; the sheet is a reference there and the
 * fiche does not pretend otherwise.
 *
 * The id is prefixed because the agenda's drop handler receives ids from two sources: a plaatsingId
 * for an activiteit already on the grid, and this. Without the prefix a drop would have to guess
 * which it got.
 */
function Fiche({ hoek, onKies }: { hoek: HoekWeergave; onKies?: (hoekId: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${FICHE_VOORVOEGSEL}${hoek.id}`,
  });

  // The two paths are exclusive on purpose. A fiche that both dragged and opened a sheet on click
  // would fire the sheet at the end of every drag, and dnd-kit's pointer sensor deliberately lets a
  // press that does not travel through as a click.
  const tikt = onKies !== undefined;

  return (
    <button
      type="button"
      ref={tikt ? undefined : setNodeRef}
      {...(tikt ? { onClick: () => onKies(hoek.id) } : listeners)}
      {...(tikt ? {} : attributes)}
      className={cn(
        "w-full rounded-veld border border-lijn bg-vlak px-3 py-2.5 text-left",
        "transition-colors duration-150 hover:border-accent",
        // THE CURSOR IS THE ONLY THING THAT SAYS THIS CAN BE PICKED UP (owner, 2026-08-31). A card
        // that answers a press with a pointing finger reads as a link to somewhere, and the fiche
        // goes nowhere: it gets carried onto a day. `touch-none` belongs with it, because without it
        // a touch drag scrolls the panel instead of lifting the fiche. Only on the drag path: where
        // the fiche is tapped, a grabbing hand would promise a gesture the phone does not have.
        tikt ? null : "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <p className="text-meta font-medium text-inkt">{hoek.naam}</p>
      {hoek.omschrijving ? (
        <p className="mt-0.5 line-clamp-2 text-micro leading-snug text-inkt-zacht">{hoek.omschrijving}</p>
      ) : null}
    </button>
  );
}
