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
  onKies,
}: {
  klasId: string | null;
  /**
   * A fiche was CHOSEN rather than dragged: the phone path.
   *
   * Below `lg` the panel is a sheet over the calendar, so there is nothing to drag onto and a
   * draggable fiche would be a control that does nothing. A tap opens the same placement sheet, with
   * the day the agenda is standing on as the start, which is the one thing a tap can say that a drag
   * says with its landing point.
   */
  onKies: (hoekId: string) => void;
}) {
  const open = useHoekenpaneel((s) => s.open);
  const zet = useHoekenpaneel((s) => s.zet);
  const breed = useMediaQuery(BREED);
  const { data: hoeken, isPending } = useHoeken(open ? klasId : null);

  const inhoud = (
    <Fichelijst
      hoeken={hoeken}
      laadt={klasId !== null && isPending}
      heeftKlas={klasId !== null}
      onKies={breed ? undefined : onKies}
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
  onKies,
}: {
  hoeken?: HoekWeergave[];
  laadt: boolean;
  heeftKlas: boolean;
  /** Set only where the fiche is tapped rather than dragged. */
  onKies?: (hoekId: string) => void;
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
          <Fiche hoek={hoek} onKies={onKies} />
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
