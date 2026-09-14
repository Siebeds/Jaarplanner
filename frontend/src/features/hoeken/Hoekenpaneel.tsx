import type { ReactNode, SVGProps } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { Blad } from "../../components/ui/Blad";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonFiche, IcoonHoek, IcoonKruis } from "../../components/Iconen";
import { useHoekenpaneel } from "../../state/hoekenpaneel";
import { useMediaQuery, BREED } from "../../lib/scherm";
import { cn } from "../../lib/cn";
import { t } from "../../i18n";
import { useHoeken } from "./gegevens";
import { FICHE_VOORVOEGSEL } from "./sleepids";
import { useAlgemeneFiches } from "../algemene-fiches/gegevens";
import { ALGEMENE_FICHE_VOORVOEGSEL } from "../algemene-fiches/sleepids";

/**
 * The side panel beside the agenda: the corners this class has, or its algemene fiches, while she plans (owner,
 * 2026-08-30 for the hoeken; 2026-09-11 for the algemene fiches).
 *
 * **One list at a time, each behind its own switch** (owner, 2026-09-14: "ik wil twee secties in het meest linkse
 * side bar, hoekenfiches en algemene fiches, niet gegroepeerd als fiches"). A first version grouped both under one
 * "Fiches" panel with two headings; he found that not overzichtelijk. So the store says which list is showing
 * (`soort`), the navigation has a switch for each, and this component draws the one that is on, under that list's own
 * name and glyph.
 *
 * **Two shapes for one panel, because the app has two.** From `lg` it is a column standing in the space the
 * navigation's labels were using, which is why the navigation collapses to an icon rail when this opens. On a phone
 * there is no sidebar to stand beside, so it is a sheet from the bottom.
 *
 * **The choice is a media QUERY and not a `lg:hidden` class, and that is not a style preference.** The sheet is a
 * Radix dialog, which portals its content to `document.body`, so a wrapper with `lg:hidden` hides the wrapper and
 * nothing else: on a 1600px screen both shapes rendered at once and the sheet's overlay dimmed the whole agenda.
 *
 * **A fiche says what it is, not when it runs** (owner, 2026-09-10). The runs are in the placement sheet, which a
 * click on a fiche opens at every width, and each run opens from there.
 *
 * **A fiche is dragged onto a day of the agenda.** That is why this component is mounted inside the agenda's
 * `DndContext` even though it is `fixed` and paints nowhere near it: dnd-kit registers a draggable through React
 * context, not through the DOM tree.
 */
export function Hoekenpaneel({
  klasId,
  onKies,
  onKiesAlgemeneFiche,
}: {
  klasId: string | null;
  /**
   * A hoekfiche was CHOSEN rather than dragged. The agenda opens the placement sheet with the day it is standing on
   * as the start, the one thing a click can say that a drag says with its landing point.
   */
  onKies: (hoekId: string) => void;
  /** The same, for an algemene fiche. */
  onKiesAlgemeneFiche: (ficheId: string) => void;
}) {
  const open = useHoekenpaneel((s) => s.open);
  const soort = useHoekenpaneel((s) => s.soort);
  const zet = useHoekenpaneel((s) => s.zet);
  const breed = useMediaQuery(BREED);
  const hoeken = useHoeken(open && soort === "hoeken" ? klasId : null);
  const algemeneFiches = useAlgemeneFiches(open && soort === "algemeen" ? klasId : null);

  // On a phone this panel is a sheet over the calendar and the placement sheet is about to open on top of it, so it
  // closes first rather than leaving her two sheets deep. Beside the agenda the column stays.
  function kies(kiezer: (id: string) => void, id: string) {
    if (!breed) zet(false);
    kiezer(id);
  }

  const lijst: Lijst =
    soort === "hoeken"
      ? {
          titel: t("hoekenpaneel.titel"),
          sluiten: t("hoekenpaneel.sluiten"),
          Icoon: IcoonHoek,
          laadt: klasId !== null && hoeken.isPending,
          fiches: (hoeken.data ?? []).map((hoek) => ({
            id: hoek.id,
            sleepId: `${FICHE_VOORVOEGSEL}${hoek.id}`,
            naam: hoek.naam,
            omschrijving: hoek.omschrijving,
          })),
          leeg: t("hoekenpaneel.geenHoeken"),
          naarInstellingen: { pad: "/instellingen/hoeken", label: t("hoekenpaneel.naarInstellingen") },
          onKies: (id) => kies(onKies, id),
        }
      : {
          titel: t("hoekenpaneel.algemeenTitel"),
          sluiten: t("hoekenpaneel.algemeenSluiten"),
          Icoon: IcoonFiche,
          laadt: klasId !== null && algemeneFiches.isPending,
          fiches: (algemeneFiches.data ?? []).map((fiche) => ({
            id: fiche.id,
            sleepId: `${ALGEMENE_FICHE_VOORVOEGSEL}${fiche.id}`,
            naam: fiche.naam,
            omschrijving: fiche.omschrijving,
          })),
          leeg: t("hoekenpaneel.geenAlgemeneFiches"),
          naarInstellingen: { pad: "/instellingen/algemene-fiches", label: t("hoekenpaneel.naarAlgemeneFiches") },
          onKies: (id) => kies(onKiesAlgemeneFiche, id),
        };

  const inhoud =
    klasId === null ? (
      <p className="text-meta text-inkt-zacht">{t("hoekenpaneel.geenKlas")}</p>
    ) : (
      <Fichelijst lijst={lijst} sleepbaar={breed} />
    );

  if (!breed) {
    return (
      <Blad open={open} onOpenChange={zet} titel={lijst.titel}>
        {inhoud}
      </Blad>
    );
  }

  /*
    THE COLUMN, FROM `lg`.

    `left-14` is the rail the navigation collapses to, and the two numbers are kept in step by `Schil`, which reserves
    56 + 240 for the pair. `aria-hidden` and inert while closed rather than unmounted, so the slide has something to
    animate from.
  */
  return (
    <aside
      aria-label={lijst.titel}
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
          <lijst.Icoon aria-hidden="true" className="h-4 w-4" />
          {lijst.titel}
        </h2>
        <button
          type="button"
          onClick={() => zet(false)}
          aria-label={lijst.sluiten}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
        >
          <IcoonKruis aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{inhoud}</div>
    </aside>
  );
}

/** What one list in the panel needs of a fiche, whichever kind it is. */
interface Paneelfiche {
  id: string;
  /** The prefixed id dnd-kit carries, which is what tells the agenda's drop handler the kind. */
  sleepId: string;
  naam: string;
  omschrijving: string | null;
}

/** The list the panel is showing, with everything that differs between the two kinds. */
interface Lijst {
  titel: string;
  sluiten: string;
  Icoon: (props: SVGProps<SVGSVGElement>) => ReactNode;
  laadt: boolean;
  fiches: Paneelfiche[];
  leeg: string;
  naarInstellingen: { pad: string; label: string };
  onKies: (id: string) => void;
}

/** The fiches themselves, or the reason there are none to show. */
function Fichelijst({ lijst, sleepbaar }: { lijst: Lijst; sleepbaar: boolean }) {
  if (lijst.laadt) {
    return <Laadlijst rijen={3} />;
  }

  if (lijst.fiches.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-meta text-inkt-zacht">{lijst.leeg}</p>
        {/* A real destination, not a sentence about one: this is where she makes them. */}
        <Link
          to={lijst.naarInstellingen.pad}
          className="text-meta font-medium text-accent underline-offset-2 hover:underline"
        >
          {lijst.naarInstellingen.label}
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {lijst.fiches.map((fiche) => (
        <li key={fiche.id}>
          <Fiche fiche={fiche} sleepbaar={sleepbaar} onKies={lijst.onKies} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One fiche: the thing a teacher drags onto a day, or clicks to plan from the day she is on.
 *
 * Deliberately quiet: a card in the chrome column, not a card competing with the calendar beside it. The description
 * is clamped to two lines, because the point of the list is seeing the fiches together.
 *
 * **Both gestures on one button.** A press that travels six pixels is a drag (see `sleep.ts`), and dnd-kit swallows
 * the click that follows an activated drag, so a drop does not also open the sheet from the agenda's own day; a press
 * that does not travel is a click. On a keyboard Space picks the fiche up, as on every draggable in this agenda. On a
 * phone the fiche is only tapped.
 */
function Fiche({
  fiche,
  sleepbaar,
  onKies,
}: {
  fiche: Paneelfiche;
  sleepbaar: boolean;
  onKies: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: fiche.sleepId });

  return (
    <button
      type="button"
      ref={sleepbaar ? setNodeRef : undefined}
      onClick={() => onKies(fiche.id)}
      {...(sleepbaar ? listeners : {})}
      {...(sleepbaar ? attributes : {})}
      className={cn(
        "w-full rounded-veld border border-lijn bg-vlak px-3 py-2.5 text-left",
        "transition-colors duration-150 hover:border-accent",
        // The grabbing hand says this can be picked up (owner, 2026-08-31); `touch-none` so a touch drag lifts the
        // fiche instead of scrolling the panel. Only where it drags.
        sleepbaar ? "cursor-grab touch-none active:cursor-grabbing" : null,
        isDragging && "opacity-40",
      )}
    >
      <p className="text-meta font-medium text-inkt">{fiche.naam}</p>
      {fiche.omschrijving ? (
        <p className="mt-0.5 line-clamp-2 text-micro leading-snug text-inkt-zacht">{fiche.omschrijving}</p>
      ) : null}
    </button>
  );
}
