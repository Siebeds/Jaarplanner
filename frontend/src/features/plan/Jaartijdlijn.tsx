import { Fragment, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { CollisionDetection, DragEndEvent, DragStartEvent, KeyboardCoordinateGetter } from "@dnd-kit/core";
import type { Lesweek, Planningsonderbreking, Themaplaatsing } from "../../lib/types";
import { dagMaand, maandagVan, periode, verschuif, volleDag } from "../../lib/datum";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { IcoonInfo } from "../../components/Iconen";
import { kalenderMeldingen, sleepUitleg } from "./sleep";
import { bouwRaster, dagenVerschil, volgendDeel, type Weekkolomdata } from "./jaarraster";

/**
 * The school year as a timeline, one column per lesweek (FB-035, ADR-0049, owner's choice of 2026-09-16).
 *
 * **Every column is five day tracks wide**, so a thema that starts on a Wednesday starts on the Wednesday. A week
 * without a schooldag is not a column: consecutive ones fold into one narrow hatched gap that names the vacation.
 *
 * **One lane**, because no two thema's share a day. The parts of one thema around a vacation are joined by a dashed
 * rule across the gap and say which part they are.
 *
 * **Less is more** (owner, 2026-09-16): an empty lesweek is simply empty, and a changed end is not marked. The one
 * state that needs attention, a placement that no longer fits the vacations, carries an icon beside its attention
 * border and its own sentence on the card (WCAG 2.2 AA, Art. XII).
 *
 * **A bar is a button that opens the card and a handle that drags** (Enter opens, Space picks up, as everywhere in
 * the agenda). Dropping on another week moves the thema by whole weeks; the server keeps its number of schooldagen.
 *
 * **The week that moves is the week under the pointer**, not the week under the bar's middle: a bar of five weeks
 * grabbed on its first week and nudged a few pixels stays where it was. The drop target is therefore found at the
 * pointer's place on the dragged bar (`grijpX`), and the move is the number of weeks between the week grabbed and the
 * week dropped on. A keyboard grabs the bar's first day and moves it one week per arrow.
 */
export function Jaartijdlijn({
  lesweken,
  onderbrekingen,
  plaatsingen,
  gekozenId,
  magBewerken,
  bezig,
  onKies,
  onVerschuif,
}: {
  lesweken: Lesweek[];
  onderbrekingen: Planningsonderbreking[];
  plaatsingen: Themaplaatsing[];
  gekozenId: string | null;
  magBewerken: boolean;
  bezig: boolean;
  onKies: (plaatsingId: string) => void;
  onVerschuif: (plaatsing: Themaplaatsing, van: string) => void;
}) {
  const [gesleept, setGesleept] = useState<Themaplaatsing | null>(null);
  // Where on the bar it was grabbed, in pixels from its left edge, and the week that was under that point.
  const grijpX = useRef(1);
  const bronWeek = useRef<string | null>(null);
  const weekBreedte = useRef(80);

  // The agenda's three sensors (see `useSleepSensors`), with arrows that step one week column instead of 25 pixels.
  const weekStap: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
    if (event.code === "ArrowRight") return { ...currentCoordinates, x: currentCoordinates.x + weekBreedte.current };
    if (event.code === "ArrowLeft") return { ...currentCoordinates, x: currentCoordinates.x - weekBreedte.current };
    return undefined;
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
      coordinateGetter: weekStap,
    }),
  );

  // The week column under the grabbed point of the dragged bar.
  const onderGrijppunt: CollisionDetection = ({ collisionRect, droppableContainers, droppableRects }) => {
    const x = collisionRect.left + grijpX.current;
    for (const container of droppableContainers) {
      const rect = droppableRects.get(container.id);
      if (rect && x >= rect.left && x < rect.left + rect.width) return [{ id: container.id }];
    }
    return [];
  };
  const raster = useMemo(() => bouwRaster(lesweken, onderbrekingen), [lesweken, onderbrekingen]);
  const zichtbaar = useMemo(() => plaatsingen.filter((p) => p.status !== "Geweigerd"), [plaatsingen]);
  const perId = useMemo(() => new Map(zichtbaar.map((p) => [p.id, p])), [zichtbaar]);

  if (raster.kolommen.length === 0) return null;

  function naamVan(id: string) {
    return perId.get(id)?.themaNaam ?? "";
  }

  function beginSleep(event: DragStartEvent) {
    const plaatsing = perId.get(String(event.active.id)) ?? null;
    setGesleept(plaatsing);

    // Measured on the bar's own element, in viewport pixels like the pointer: dnd-kit's initial rect is not measured
    // yet when a drag starts, and a scrolled timeline makes any guess wrong by the scrolled distance.
    const balk = document.querySelector<HTMLElement>(`[data-balk="${String(event.active.id)}"]`);
    const balkRect = balk?.getBoundingClientRect();
    const aanzet = event.activatorEvent;
    const pointerX =
      aanzet instanceof MouseEvent
        ? aanzet.clientX
        : "touches" in aanzet && (aanzet as TouchEvent).touches.length > 0
          ? (aanzet as TouchEvent).touches[0].clientX
          : undefined;
    // A keyboard grabs the bar on its first day.
    const x = pointerX ?? (balkRect ? balkRect.left + 1 : undefined);
    grijpX.current = balkRect && x !== undefined ? x - balkRect.left : 1;

    const kolommen = [...document.querySelectorAll<HTMLElement>("[data-lesweek]")];
    weekBreedte.current = kolommen[0]?.getBoundingClientRect().width || 80;
    const onder =
      x === undefined
        ? undefined
        : kolommen.find((kolom) => {
            const rect = kolom.getBoundingClientRect();
            return x >= rect.left && x < rect.right;
          });
    bronWeek.current = onder?.dataset.lesweek ?? (plaatsing ? maandagVan(plaatsing.van) : null);
  }

  function eindigSleep(event: DragEndEvent) {
    setGesleept(null);
    const plaatsing = perId.get(String(event.active.id));
    if (!plaatsing || !event.over || !bronWeek.current) return;
    const doelMaandag = String(event.over.id);
    const bronMaandag = bronWeek.current;
    const weken = Math.round(dagenVerschil(bronMaandag, doelMaandag) / 7);
    if (weken === 0) return;
    onVerschuif(plaatsing, verschuif(plaatsing.van, weken * 7));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={onderGrijppunt}
      accessibility={{ announcements: kalenderMeldingen(naamVan), screenReaderInstructions: sleepUitleg }}
      onDragStart={beginSleep}
      onDragEnd={eindigSleep}
      onDragCancel={() => setGesleept(null)}
    >
      <section
        aria-label={t("plan.tijdlijn")}
        className="-mx-4 overflow-x-auto rounded-none border-y border-lijn bg-kaart px-4 py-3 sm:mx-0 sm:rounded-kaart sm:border sm:px-3"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: raster.sporen,
            gridTemplateRows: "1.25rem 1.5rem 3.5rem",
          }}
        >
          {raster.maanden.map((maand) => (
            <div
              key={maand.maandag}
              className="whitespace-nowrap pl-1 font-display text-meta font-semibold capitalize text-inkt"
              style={{ gridRow: 1, gridColumn: `${maand.spoor} / span 5` }}
            >
              {maand.naam}
            </div>
          ))}

          {raster.kolommen.map((kolom) =>
            kolom.soort === "week" ? (
              <Weekkolom key={kolom.maandag} kolom={kolom} />
            ) : (
              <div
                key={kolom.van}
                className="vakantiegat flex items-center justify-center border-l border-lijn"
                style={{ gridRow: "1 / 4", gridColumn: kolom.spoor }}
              >
                <span className="text-micro normal-case tracking-normal text-inkt-zacht [writing-mode:vertical-rl] rotate-180">
                  {kolom.naam}
                </span>
              </div>
            ),
          )}

          {zichtbaar.map((plaatsing) => {
            const volgende = volgendDeel(plaatsing, zichtbaar);
            const begin = raster.spoorVan(plaatsing.van);
            const einde = raster.spoorVan(plaatsing.tot);
            return (
              <Fragment key={plaatsing.id}>
                <Balk
                  plaatsing={plaatsing}
                  kolommen={`${begin} / ${einde + 1}`}
                  gekozen={plaatsing.id === gekozenId}
                  sleepbaar={magBewerken && !bezig}
                  onKies={() => onKies(plaatsing.id)}
                />
                {volgende && raster.spoorVan(volgende.van) > einde + 1 ? (
                  <div
                    aria-hidden="true"
                    className="relative z-10 flex items-center"
                    style={{ gridRow: 3, gridColumn: `${einde + 1} / ${raster.spoorVan(volgende.van)}` }}
                  >
                    <div className="w-full border-t-[3px] border-dashed border-inkt-zacht" />
                  </div>
                ) : null}
              </Fragment>
            );
          })}

        </div>
      </section>

      <DragOverlay dropAnimation={null}>
        {gesleept ? (
          <div className="rounded-veld border-2 border-accent bg-accent-zacht px-2 py-1 text-meta font-semibold text-inkt shadow-licht">
            {gesleept.themaNaam}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** A week's background: its date on top, its left rule, and the drop target a dragged bar lands on. */
function Weekkolom({ kolom }: { kolom: Weekkolomdata }) {
  const { setNodeRef, isOver } = useDroppable({ id: kolom.maandag });

  return (
    <div
      ref={setNodeRef}
      data-lesweek={kolom.maandag}
      className={cn(
        "border-l border-lijn pl-1 pt-0.5 transition-colors duration-100",
        isOver && "bg-accent-zacht",
      )}
      style={{ gridRow: "2 / 4", gridColumn: `${kolom.spoor} / span 5` }}
    >
      <span className="mono block whitespace-nowrap text-[0.6875rem] text-inkt-zwak">{dagMaand(kolom.maandag)}</span>
    </div>
  );
}

/** One placement: its name, its part or its days, and whether its end or its fit needs a look. */
function Balk({
  plaatsing,
  kolommen,
  gekozen,
  sleepbaar,
  onKies,
}: {
  plaatsing: Themaplaatsing;
  kolommen: string;
  gekozen: boolean;
  sleepbaar: boolean;
  onKies: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: plaatsing.id,
    disabled: !sleepbaar,
  });
  const reeks = plaatsing.reeks;
  const plaats =
    reeks && reeks.aantalDelen > 1
      ? t("plan.deel", { deel: reeks.deel, aantal: reeks.aantalDelen })
      : periode(plaatsing.van, plaatsing.tot);
  // An open proposal says so on the bar, not only on its card: it is the one bar still waiting for a decision.
  const onderregel = plaatsing.status === "Voorgesteld" ? `${t("status.Voorgesteld")} · ${plaats}` : plaats;

  const toelichting = [
    t("plan.balkAria", {
      naam: plaatsing.themaNaam,
      van: volleDag(plaatsing.van),
      tot: volleDag(plaatsing.tot),
    }),
    reeks && reeks.aantalDelen > 1 ? t("plan.deel", { deel: reeks.deel, aantal: reeks.aantalDelen }) : null,
    t(`status.${plaatsing.status}`),
    plaatsing.isVervallen ? t("plan.vervallen") : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div className="min-w-0 px-0.5 py-1" style={{ gridRow: 3, gridColumn: kolommen }}>
      <button
        ref={setNodeRef}
        type="button"
        data-balk={plaatsing.id}
        onClick={onKies}
        // The drag attributes only on a bar that drags: dnd-kit marks a disabled draggable aria-disabled, and this bar
        // still opens its card for a reader.
        {...(sleepbaar ? attributes : {})}
        {...(sleepbaar ? listeners : {})}
        aria-label={toelichting}
        aria-pressed={gekozen}
        className={cn(
          "flex h-full w-full min-w-0 flex-col justify-center gap-0.5 overflow-hidden rounded-veld border bg-vlak-diep px-2 text-left transition-colors duration-150",
          gekozen ? "border-2 border-accent bg-accent-zacht" : "border-lijn-sterk hover:border-inkt-zacht",
          plaatsing.isVervallen && !gekozen && "border-attentie",
          isDragging && "opacity-40",
        )}
      >
        <span className="flex min-w-0 items-center gap-1">
          {plaatsing.isVervallen ? (
            <IcoonInfo aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-attentie-inkt" />
          ) : null}
          <span className="truncate text-meta font-semibold text-inkt">{plaatsing.themaNaam}</span>
        </span>
        <span className="mono truncate text-[0.625rem] text-inkt-zacht">{onderregel}</span>
      </button>
    </div>
  );
}
