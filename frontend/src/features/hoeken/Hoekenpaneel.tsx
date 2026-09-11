import { useDraggable } from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { Blad } from "../../components/ui/Blad";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonHoek, IcoonKruis } from "../../components/Iconen";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import { useMediaQuery, BREED } from "../../lib/scherm";
import { cn } from "../../lib/cn";
import { t } from "../../i18n";
import { useHoeken, type HoekWeergave } from "./gegevens";
import { FICHE_VOORVOEGSEL } from "./sleepids";

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
 * **A fiche says what a corner is, not when it runs** (owner, 2026-09-10). Each fiche used to carry a
 * row per run under it ("Ingepland 1 sep – 4 sep"), which cluttered a list whose job is showing the
 * corners side by side, and answered a question she only asks while planning. The runs are now in the
 * placement sheet, which a click on a fiche opens at every width, and each run opens from there.
 *
 * **A fiche is dragged onto a day of the agenda.** That is why this component is mounted inside the
 * agenda's `DndContext` even though it is `fixed` and paints nowhere near it: dnd-kit registers a
 * draggable through React context, not through the DOM tree.
 */
export function Hoekenpaneel({
  klasId,
  onKies,
}: {
  klasId: string | null;
  /**
   * A fiche was CHOSEN rather than dragged. The agenda opens the placement sheet with the day it is
   * standing on as the start, the one thing a click can say that a drag says with its landing point.
   *
   * **At every width since 2026-09-10.** It used to be the phone path only, and beside the agenda a
   * fiche could only be dragged. That was harmless while a corner's runs were listed under its fiche.
   * With the runs in the sheet instead, a corner that takes no lesuur would have had no way back to
   * them short of dropping its fiche on some arbitrary day.
   */
  onKies: (hoekId: string) => void;
}) {
  const open = useHoekenpaneel((s) => s.open);
  const zet = useHoekenpaneel((s) => s.zet);
  const breed = useMediaQuery(BREED);
  const { data: hoeken, isPending } = useHoeken(open ? klasId : null);

  // On a phone this panel is a sheet over the calendar and the placement sheet is about to open on top
  // of it, so it closes first rather than leaving her two sheets deep. Beside the agenda the column
  // stays: the placement sheet opens on the other side of the screen.
  function kies(hoekId: string) {
    if (!breed) zet(false);
    onKies(hoekId);
  }

  const inhoud = (
    <Fichelijst
      hoeken={hoeken}
      laadt={klasId !== null && isPending}
      heeftKlas={klasId !== null}
      sleepbaar={breed}
      onKies={kies}
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
  laadt,
  heeftKlas,
  sleepbaar,
  onKies,
}: {
  hoeken?: HoekWeergave[];
  laadt: boolean;
  heeftKlas: boolean;
  /** False on a phone, where the panel covers the calendar and there is nothing to drag onto. */
  sleepbaar: boolean;
  onKies: (hoekId: string) => void;
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
        <li key={hoek.id}>
          <Fiche hoek={hoek} sleepbaar={sleepbaar} onKies={onKies} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One hoekfiche: the thing a teacher drags onto a day, or clicks to plan from the day she is on.
 *
 * Deliberately quiet: a card in the chrome column, not a card competing with the calendar beside it.
 * The description is clamped to two lines, because a corner described in four sentences would push
 * the next fiche off the panel, and the whole point of the list is seeing the corners together.
 *
 * **Both gestures on one button, the arrangement `Hoekblok` in the lesurenraster already has.** A
 * press that travels six pixels is a drag (see `sleep.ts`), and dnd-kit swallows the click that follows
 * an activated drag, so a drop does not also open the sheet from the agenda's own day; a press that
 * does not travel is a click. On a keyboard Space picks the fiche up, as on every draggable in this
 * agenda. On a phone the panel is a sheet over the calendar, so there is nothing to drag onto and the
 * fiche is only tapped.
 *
 * The id is prefixed because the agenda's drop handler receives ids from two sources: a plaatsingId
 * for an activiteit already on the grid, and this. Without the prefix a drop would have to guess
 * which it got.
 */
function Fiche({
  hoek,
  sleepbaar,
  onKies,
}: {
  hoek: HoekWeergave;
  sleepbaar: boolean;
  onKies: (hoekId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${FICHE_VOORVOEGSEL}${hoek.id}`,
  });

  return (
    <button
      type="button"
      ref={sleepbaar ? setNodeRef : undefined}
      onClick={() => onKies(hoek.id)}
      {...(sleepbaar ? listeners : {})}
      {...(sleepbaar ? attributes : {})}
      className={cn(
        "w-full rounded-veld border border-lijn bg-vlak px-3 py-2.5 text-left",
        "transition-colors duration-150 hover:border-accent",
        // THE GRABBING HAND SAYS THIS CAN BE PICKED UP (owner, 2026-08-31). Dragging is the gesture
        // that says which day, so it is the one the cursor announces; a click is the shortcut to the
        // same sheet from the day the agenda is on. `touch-none` belongs with it, because without it a
        // touch drag scrolls the panel instead of lifting the fiche. Only where the fiche drags: on a
        // phone a grabbing hand would promise a gesture the sheet does not have.
        sleepbaar ? "cursor-grab touch-none active:cursor-grabbing" : null,
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
