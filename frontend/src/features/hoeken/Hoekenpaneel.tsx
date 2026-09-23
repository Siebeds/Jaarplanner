import { useId, useRef, useState, type ReactNode, type Ref, type SVGProps } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Link } from "react-router-dom";
import { Blad } from "../../components/ui/Blad";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonActiviteit, IcoonFiche, IcoonHoek, IcoonKruis } from "../../components/Iconen";
import { useHoekenpaneel, type Paneelsoort } from "../../state/hoekenpaneel";
import { useMediaQuery, BREED } from "../../lib/scherm";
import { cn } from "../../lib/cn";
import { t } from "../../i18n";
import { useHoeken, useMaakHoek, type SubthemaperiodeVerrijkingen } from "./gegevens";
import { alsInfodoelen, useAlgemeneFiches, useMaakAlgemeneFiche } from "../algemene-fiches/gegevens";
import { Doelinfo, type Infodoel } from "../plan/Doelinfo";
import { ALGEMENE_FICHE_VOORVOEGSEL } from "../algemene-fiches/sleepids";
import { FICHEVLAK } from "../algemene-fiches/merk";
import { Hoekformulier } from "../instellingen/Hoekformulier";
import { Algemeneficheformulier } from "../instellingen/Algemeneficheformulier";
import {
  Activiteitensectie,
  Paneelactiviteitformulier,
  type Activiteitbestemming,
  type Activiteitenweek,
  type GekozenActiviteit,
} from "../plan/Activiteitensectie";
import { Toevoegtegel } from "./Toevoegtegel";
import { Hoekverrijkingblad } from "./Hoekverrijkingblad";
import { Hoekenlijst } from "./Hoekenlijst";
import { Subthemaverrijkingblad } from "./Subthemaverrijkingblad";
import type { Verrijkingenweek, Verrijkingsreeks, Volgendsubthema } from "./verrijkingenweek";

/**
 * The side panel beside the agenda: the corners this class has, or its algemene fiches, while she plans (owner,
 * 2026-08-30 for the hoeken; 2026-09-11 for the algemene fiches).
 *
 * **One list at a time, each behind its own switch** (owner, 2026-09-14: "ik wil twee secties in het meest linkse
 * side bar, hoekenfiches en algemene fiches, niet gegroepeerd als fiches"). A first version grouped both under one
 * "Fiches" panel with two headings; he found that not overzichtelijk. So the store says which list is showing
 * (`soort`), the navigation has a switch for each, and this component draws the one that is on, under that list's own
 * name and glyph. **A third list, the activiteiten, since 2026-09-15** (owner, FB-017): the same column, cards and tile,
 * with a subthema to choose above its cards, because an activiteit belongs to a subthema and a klas has many
 * (`Activiteitensectie`).
 *
 * **Two shapes for one panel, because the app has two.** From `lg` it is a column standing in the space the
 * navigation's labels were using, which is why the navigation collapses to an icon rail when this opens. On a phone
 * there is no sidebar to stand beside, so it is a sheet from the bottom.
 *
 * **The choice is a media QUERY and not a `lg:hidden` class, and that is not a style preference.** The sheet is a
 * Radix dialog, which portals its content to `document.body`, so a wrapper with `lg:hidden` hides the wrapper and
 * nothing else: on a 1600px screen both shapes rendered at once and the sheet's overlay dimmed the whole agenda.
 *
 * **An algemene fiche is planned from here; a hoek is not** (ADR-0044). An algemene fiche is dragged onto a day of the
 * agenda, or clicked to plan it from the day the agenda stands on, which is why this component is mounted inside the
 * agenda's `DndContext`. A hoek is never in the agenda: its row shows what it holds while the subthema's of the
 * agenda's week run, one block per subthema (FB-098, `Hoekenlijst`), and a press opens the sheet that writes it (owner,
 * 2026-09-15, FB-038: "de hoekenverrijking wil ik zien hier in de sidepane"). So the hoeken are for everyone who reads the agenda, as the activiteiten are, and only
 * the algemene fiches are for whoever may plan the klas.
 *
 * **The last tile makes a new one** (owner, 2026-09-14, TB-015). A teacher who notices mid-plan that a corner is
 * missing used to have to leave the agenda for Instellingen. The tile opens the same form Instellingen uses, and the
 * list refetches when it saves, so the new fiche lands in this panel. Changing and deleting a fiche, and a fiche's
 * goals, stay in Instellingen.
 */
export function Hoekenpaneel({
  klasId,
  onKiesAlgemeneFiche,
  magPlannen,
  activiteitenWeek,
  verrijkingenWeek,
  volgendSubthema,
  onKiesActiviteit,
}: {
  klasId: string | null;
  /**
   * An algemene fiche was CHOSEN rather than dragged. The agenda opens the placement sheet with the day it is standing
   * on as the start, the one thing a click can say that a drag says with its landing point.
   */
  onKiesAlgemeneFiche: (ficheId: string) => void;
  /**
   * Whether this gebruiker may plan the klas. The algemene fiches are only for whoever may (every fiche in that list
   * plans one); the hoeken and the activiteiten are for everyone who reads the agenda, and without the right they
   * write and plan nothing (owner, 2026-09-15, FB-017 and FB-038).
   */
  magPlannen: boolean;
  /** The week the agenda stands in, which the activiteiten list opens on. */
  activiteitenWeek: Activiteitenweek;
  /** What the hoeken hold while the subthema's of that same week run (FB-038), and whether that is known yet. */
  verrijkingenWeek: Verrijkingenweek;
  /** The klas's subthema after that week, for the hoeken's "Hierna" (FB-098). */
  volgendSubthema: Volgendsubthema;
  /** An activiteit card was chosen rather than dragged; the agenda asks the day and the hours. */
  onKiesActiviteit: (activiteit: GekozenActiviteit) => void;
}) {
  const open = useHoekenpaneel((s) => s.open);
  const soort = useHoekenpaneel((s) => s.soort);
  const zet = useHoekenpaneel((s) => s.zet);
  const breed = useMediaQuery(BREED);
  const hoeken = useHoeken(open && soort === "hoeken" ? klasId : null);
  const algemeneFiches = useAlgemeneFiches(open && magPlannen && soort === "algemeen" ? klasId : null);
  const maakHoek = useMaakHoek(klasId);
  const maakFiche = useMaakAlgemeneFiche(klasId);

  /**
   * Which kind the create form is making, or null while it is closed.
   *
   * Its own state rather than read from `soort`, because on a phone the panel closes while the form is open and the
   * form must not depend on anything the closed panel still says.
   */
  const [nieuw, setNieuw] = useState<Paneelsoort | null>(null);
  // The activiteit's form needs more than which kind: the subthema it is made in.
  const [nieuweActiviteit, setNieuweActiviteit] = useState<Activiteitbestemming | null>(null);
  // The hoek whose fiche is open (FB-038), with the row she pressed for focus to return to. Its name and description
  // travel with it: on a phone the list is not read while the panel's own sheet is closed.
  const [gekozenHoek, setGekozenHoek] = useState<{
    id: string;
    naam: string;
    omschrijving: string | null;
    terugId: string;
  } | null>(null);
  // The subthema whose corners she prepares ahead, from "Al voorbereiden" (FB-098), with the windows it reads.
  const [voorbereiden, setVoorbereiden] = useState<{
    reeks: Verrijkingsreeks;
    periodes: readonly SubthemaperiodeVerrijkingen[];
    hoeken: readonly { id: string; naam: string }[];
  } | null>(null);
  const tegelRef = useRef<HTMLButtonElement>(null);
  // The cards' ids, so focus can go back to the card she pressed once its sheet closes.
  const kaartBasis = useId();
  const kaartId = (id: string) => `${kaartBasis}-${id}`;
  // A hoek stands once per subthema of the week, so its row's id names the block too.
  const rijId = (blok: string, hoekId: string) => `${kaartBasis}-${blok}-${hoekId}`;
  const voorbereidenId = `${kaartBasis}-voorbereiden`;

  // On a phone this panel is a sheet over the calendar and another sheet is about to open on top of it, so it closes
  // first rather than leaving her two sheets deep. Beside the agenda the column stays.
  function kies(kiezer: (id: string) => void, id: string) {
    if (!breed) zet(false);
    kiezer(id);
  }

  // The same rule for the create form and a hoek's sheet, with one difference: she came here to add to THIS list, or to
  // go round its corners, so on a phone the panel comes back when the sheet closes, saved or not.
  function openNieuw(welke: "hoeken" | "algemeen") {
    if (!breed) zet(false);
    if (welke === "hoeken") maakHoek.reset();
    else maakFiche.reset();
    setNieuw(welke);
  }

  function openNieuweActiviteit(bestemming: Activiteitbestemming) {
    if (!breed) zet(false);
    setNieuweActiviteit(bestemming);
  }

  function openHoek(id: string, terugId: string) {
    const hoek = hoeken.data?.find((h) => h.id === id);
    if (!hoek) return;
    if (!breed) zet(false);
    setGekozenHoek({ id: hoek.id, naam: hoek.naam, omschrijving: hoek.omschrijving, terugId });
  }

  function openVoorbereiden(reeks: Verrijkingsreeks, periodes: readonly SubthemaperiodeVerrijkingen[]) {
    if (!breed) zet(false);
    setVoorbereiden({ reeks, periodes, hoeken: hoeken.data ?? [] });
  }

  /**
   * Closes whichever sheet this panel opened. `Blad` is a Radix dialog without a Radix trigger, so Radix has nothing to
   * return focus to, and a keyboard user who saves would land on <body> and tab in again from the top of the page. So
   * focus goes back to what she pressed: the tile, the hoek's row, or "Al voorbereiden". After a frame, so the sheet has
   * unmounted first.
   */
  function sluitBlad() {
    const terugId = gekozenHoek?.terugId ?? (voorbereiden ? voorbereidenId : null);
    setNieuw(null);
    setNieuweActiviteit(null);
    setGekozenHoek(null);
    setVoorbereiden(null);
    if (!breed) {
      zet(true);
      return;
    }
    requestAnimationFrame(() => {
      const terug = terugId ? document.getElementById(terugId) : tegelRef.current;
      terug?.focus();
    });
  }

  // The algemene fiches are a list of cards; the hoeken (FB-098) and the activiteiten are drawn by their own components.
  const lijst: Lijst | null =
    soort === "algemeen"
      ? {
          titel: t("hoekenpaneel.algemeenTitel"),
          sluiten: t("hoekenpaneel.algemeenSluiten"),
          Icoon: IcoonFiche,
          laadt: klasId !== null && algemeneFiches.isPending,
          mislukt: algemeneFiches.isError && algemeneFiches.data === undefined,
          fiches: (algemeneFiches.data ?? []).map((fiche) => ({
            id: fiche.id,
            sleepId: `${ALGEMENE_FICHE_VOORVOEGSEL}${fiche.id}`,
            naam: fiche.naam,
            omschrijving: fiche.omschrijving,
            doelen: alsInfodoelen(fiche.doelen),
          })),
          leeg: t("hoekenpaneel.geenAlgemeneFiches"),
          naarInstellingen: { pad: "/instellingen/algemene-fiches", label: t("hoekenpaneel.naarAlgemeneFiches") },
          toevoegen: t("algemeneFiches.toevoegen"),
          onKies: (id) => kies(onKiesAlgemeneFiche, id),
          onNieuw: () => openNieuw("algemeen"),
        }
      : null;

  const kop =
    lijst ??
    (soort === "hoeken"
      ? { titel: t("hoekenpaneel.titel"), sluiten: t("hoekenpaneel.sluiten"), Icoon: IcoonHoek }
      : { titel: t("hoekenpaneel.activiteitenTitel"), sluiten: t("hoekenpaneel.activiteitenSluiten"), Icoon: IcoonActiviteit });

  const inhoud =
    klasId === null ? (
      <p className="text-meta text-inkt-zacht">{t("hoekenpaneel.geenKlas")}</p>
    ) : lijst ? (
      <Fichelijst lijst={lijst} sleepbaar={breed} tegelRef={tegelRef} kaartId={kaartId} />
    ) : soort === "hoeken" ? (
      <Hoekenlijst
        laadt={hoeken.isPending}
        mislukt={hoeken.isError && hoeken.data === undefined}
        hoeken={hoeken.data ?? []}
        week={verrijkingenWeek}
        volgende={volgendSubthema}
        magPlannen={magPlannen}
        tegelRef={tegelRef}
        rijId={rijId}
        onKiesHoek={openHoek}
        onVoorbereiden={openVoorbereiden}
        voorbereidenId={voorbereidenId}
        onNieuw={() => openNieuw("hoeken")}
      />
    ) : open ? (
      <Activiteitensectie
        klasId={klasId}
        week={activiteitenWeek}
        magPlannen={magPlannen}
        sleepbaar={breed && magPlannen}
        tegelRef={tegelRef}
        onKies={(activiteit) => {
          // As a fiche does: on a phone the panel's sheet closes before the agenda's sheet opens over it.
          if (!breed) zet(false);
          onKiesActiviteit(activiteit);
        }}
        onNieuw={openNieuweActiviteit}
      />
    ) : (
      // Closed, the column only fades: the list stops asking, as the fiche lists do, and the fade shows loading rows.
      <Laadlijst rijen={3} />
    );

  /*
    THE SHEETS THIS PANEL OPENS, OUTSIDE BOTH SHAPES.

    Siblings of the panel rather than children, because on a phone the panel's own sheet closes while one of them is
    open, and a sheet inside it would close with it. All of them are portalled dialogs, so where they sit in this tree
    owes nothing to where they paint.
  */
  const blad =
    nieuw === "hoeken" ? (
      <Hoekformulier
        open
        bezig={maakHoek.isPending}
        fout={maakHoek.error}
        onSluit={sluitBlad}
        onBewaar={(invoer) => maakHoek.mutate(invoer, { onSuccess: sluitBlad })}
      />
    ) : nieuw === "algemeen" ? (
      <Algemeneficheformulier
        open
        bezig={maakFiche.isPending}
        fout={maakFiche.error}
        onSluit={sluitBlad}
        onBewaar={(invoer) => maakFiche.mutate(invoer, { onSuccess: sluitBlad })}
      />
    ) : nieuweActiviteit ? (
      <Paneelactiviteitformulier bestemming={nieuweActiviteit} onSluit={sluitBlad} />
    ) : gekozenHoek && klasId ? (
      // Keyed on the hoek, so a second corner's sheet starts from its own stored texts, not the first one's draft.
      <Hoekverrijkingblad
        key={gekozenHoek.id}
        klasId={klasId}
        hoek={gekozenHoek}
        week={verrijkingenWeek}
        magPlannen={magPlannen}
        onSluit={sluitBlad}
      />
    ) : voorbereiden && klasId ? (
      <Subthemaverrijkingblad
        klasId={klasId}
        reeks={voorbereiden.reeks}
        hoeken={voorbereiden.hoeken}
        periodes={voorbereiden.periodes}
        onSluit={sluitBlad}
      />
    ) : null;

  // The algemene fiches for someone who may not plan the klas: nothing to draw. The navigation closes such a panel as
  // soon as the rights say no; this covers the render before it does.
  if (!magPlannen && soort === "algemeen") return null;

  if (!breed) {
    return (
      <>
        <Blad open={open} onOpenChange={zet} titel={kop.titel}>
          {inhoud}
        </Blad>
        {blad}
      </>
    );
  }

  /*
    THE COLUMN, FROM `lg`.

    `left-14` is the rail the navigation collapses to, and the two numbers are kept in step by `Schil`, which reserves
    56 + 240 for the pair. `aria-hidden` and inert while closed rather than unmounted, so the slide has something to
    animate from.
  */
  return (
    <>
      <aside
        aria-label={kop.titel}
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
            <kop.Icoon aria-hidden="true" className="h-4 w-4" />
            {kop.titel}
          </h2>
          <button
            type="button"
            onClick={() => zet(false)}
            aria-label={kop.sluiten}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
          >
            <IcoonKruis aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{inhoud}</div>
      </aside>
      {blad}
    </>
  );
}

/** What the algemene fiches list needs of a fiche. */
interface Paneelfiche {
  id: string;
  /** The prefixed id dnd-kit carries: an algemene fiche is dragged onto the agenda. */
  sleepId: string;
  naam: string;
  omschrijving: string | null;
  /** The goals, for the card's info icon (FB-018). */
  doelen: readonly Infodoel[];
}

/** The algemene fiches list, with what the panel's head and its empty state say. */
interface Lijst {
  titel: string;
  sluiten: string;
  Icoon: (props: SVGProps<SVGSVGElement>) => ReactNode;
  laadt: boolean;
  /**
   * The request failed AND there is nothing loaded to show. Not the same as an empty list, and the panel must not say
   * it is. A failed background refetch keeps the list she was using: in TanStack Query v5 `isError` is also true then,
   * and after every placement the fiche list IS refetched with the panel still open (antagonist, round 3).
   */
  mislukt: boolean;
  fiches: Paneelfiche[];
  leeg: string;
  /** Where the list's fiches are set up. */
  naarInstellingen: { pad: string; label: string };
  /** The create tile's label, the words Instellingen's own button uses so one action has one name. */
  toevoegen: string;
  onKies: (id: string) => void;
  onNieuw: () => void;
}

/** The fiches themselves, or the reason there are none to show, and after either the tile that makes one. */
function Fichelijst({
  lijst,
  sleepbaar,
  tegelRef,
  kaartId,
}: {
  lijst: Lijst;
  sleepbaar: boolean;
  /** The create tile, so focus can return to it when the form closes. */
  tegelRef: Ref<HTMLButtonElement>;
  kaartId: (id: string) => string;
}) {
  if (lijst.laadt) {
    return <Laadlijst rijen={3} />;
  }

  // A failed request is not an empty class: "nog geen fiches" here would send her to Instellingen to make fiches she
  // already has (antagonist, E10-03 round 2). So it says only what it knows, and offers no link. Nor the create tile,
  // for the same reason: a list it could not read is no ground for offering to add to it.
  if (lijst.mislukt) {
    return (
      <p role="alert" className="text-meta text-attentie-inkt">
        {t("hoekenpaneel.mislukt")}
      </p>
    );
  }

  // Both branches below return the same `div` with the tile as its second child, so when a class's first fiche turns the
  // empty branch into the list branch, React keeps the tile's DOM node and with it the focus `sluitBlad` returned. In a
  // browser the refetch usually lands after that focus, and a remounted tile would then drop it to <body>. The key keeps the node
  // too if the siblings are ever reordered.
  const tegel = <Toevoegtegel key="toevoegen" ref={tegelRef} label={lijst.toevoegen} onKies={lijst.onNieuw} />;

  if (lijst.fiches.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-meta text-inkt-zacht">{lijst.leeg}</p>
        {tegel}
        {/* A real destination, not a sentence about one: Instellingen is also where she changes and deletes what
            she makes here. */}
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
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {lijst.fiches.map((fiche) => (
          <li key={fiche.id}>
            <Fiche fiche={fiche} kaartId={kaartId(fiche.id)} sleepbaar={sleepbaar} onKies={lijst.onKies} />
          </li>
        ))}
      </ul>
      {/* After the list and outside it: it is not a fiche, and a screen reader counting the list's items should
          count only the fiches. */}
      {tegel}
    </div>
  );
}

/**
 * One algemene fiche: a teacher drags it onto a day or clicks to plan it from the day she is on.
 *
 * Deliberately quiet: a card in the chrome column, not a card competing with the calendar beside it. The description
 * is clamped to two lines, because the point of the list is seeing the fiches together.
 *
 * **Both gestures on one button.** A press that travels six pixels is a drag (see `sleep.ts`), and dnd-kit swallows the
 * click that follows an activated drag, so a drop does not also open the sheet from the agenda's own day; a press that
 * does not travel is a click. On a keyboard Space picks the fiche up, as on every draggable in this agenda. On a phone
 * the card is only pressed.
 *
 * **Its goals behind an info icon in the corner, beside the button and not in it** (FB-018): pressing the fiche plans
 * it, pressing the icon only shows what it works on.
 */
function Fiche({
  fiche,
  kaartId,
  sleepbaar,
  onKies,
}: {
  fiche: Paneelfiche;
  kaartId: string;
  sleepbaar: boolean;
  onKies: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: fiche.sleepId,
    disabled: !sleepbaar,
  });

  return (
    <div className="relative">
      <button
        id={kaartId}
        type="button"
        ref={sleepbaar ? setNodeRef : undefined}
        onClick={() => onKies(fiche.id)}
        {...(sleepbaar ? listeners : {})}
        {...(sleepbaar ? attributes : {})}
        className={cn(
          // The wash it will wear as a block in the agenda (FB-077), so she recognises what she is about to drag.
          "w-full rounded-veld border px-3 py-2.5 pr-9 text-left",
          FICHEVLAK,
          "transition-colors duration-150 hover:border-accent",
          // The grabbing hand says this can be picked up (owner, 2026-08-31); `touch-none` so a touch drag lifts the
          // fiche instead of scrolling the panel. Only where it drags.
          sleepbaar ? "cursor-grab touch-none active:cursor-grabbing" : null,
          isDragging && "opacity-40",
        )}
      >
        {/* The icon stands beside the name here as it does on the block (FB-077), so the wash is never the only thing
            saying what this card is. */}
        <p className="flex items-baseline gap-1.5 text-meta font-medium text-inkt">
          <IcoonFiche aria-hidden="true" className="h-3 w-3 shrink-0 translate-y-px text-inkt-zwak" />
          <span className="min-w-0">{fiche.naam}</span>
        </p>
        {fiche.omschrijving ? (
          <p className="mt-0.5 line-clamp-2 text-micro leading-snug text-inkt-zacht">{fiche.omschrijving}</p>
        ) : null}
      </button>

      <Doelinfo naam={fiche.naam} doelen={fiche.doelen} className="absolute right-1.5 top-1.5" />
    </div>
  );
}
