import type { DragStartEvent } from "@dnd-kit/core";
import { PX_PER_MINUUT, STAP, rond } from "./tijd";

/**
 * Where a drag would land in the time grid: which day, and at what time (ADR-0028).
 *
 * **Why this is a module with state rather than a hook.** Two places need the same answer and they are in different
 * components: the grid draws a preview of the landing spot while the drag is in flight, and the screen above it fires
 * the mutation when the drag ends. Deriving it twice is how the two would come to disagree, which in a calendar means
 * the block lands somewhere other than where the preview said.
 *
 * **It reads the pointer rather than dnd-kit's delta, on purpose.** A delta can only move something that already had
 * a position in the grid, and one of the three draggable kinds does not: a hoekfiche comes out of the panel beside the
 * agenda. The pointer is the only thing all three have in common. dnd-kit does not hand it to us, so a listener holds
 * the last position while a drag is running; it is added on drag start and removed on drag end, never left on.
 */

/** The id of a day column as a drop target. Prefixed, because the month and week views drop onto a bare date. */
export const kolomId = (datum: string) => `tijd:${datum}`;

/** The day a column drop id names, or null when the id is not one. */
export function leesKolomId(id: string): string | null {
  return id.startsWith("tijd:") ? id.slice("tijd:".length) : null;
}

/** The attribute the grid puts on a column, so this module can find its live rectangle. */
export const KOLOM_ATTRIBUUT = "data-tijdkolom";

/**
 * The attribute carrying the minute the column's top edge stands for.
 *
 * The grid widens its own range to hold an early trip or a late one, so the top is not always 7:00. Reading it off
 * the element keeps one source of truth: the screen firing the mutation does not have to re-derive a number the grid
 * already computed, which is exactly how a preview and a drop come to disagree.
 */
export const VAN_ATTRIBUUT = "data-tijdvan";

let laatsteY: number | null = null;
/** Pixels between the pointer and the top of the thing being dragged, so a block does not jump under the cursor. */
let greep = 0;

function onthoud(gebeurtenis: PointerEvent) {
  laatsteY = gebeurtenis.clientY;
}

/**
 * Starts following the pointer, and works out where inside the dragged block it was grabbed.
 *
 * A teacher who picks a block up by its middle expects it to keep that offset: without this, every drag would snap the
 * block's start to the pointer and move it half an hour earlier than she aimed.
 */
export function beginSleep(gebeurtenis: DragStartEvent) {
  const activator = gebeurtenis.activatorEvent;
  const start = gebeurtenis.active.rect.current.initial;

  laatsteY = activator instanceof PointerEvent ? activator.clientY : null;
  greep = activator instanceof PointerEvent && start ? activator.clientY - start.top : 0;

  window.addEventListener("pointermove", onthoud, { passive: true });
}

/** Stops following. Called on both drag end and drag cancel, so the listener never outlives a drag. */
export function eindigSleep() {
  window.removeEventListener("pointermove", onthoud);
  laatsteY = null;
  greep = 0;
}

/**
 * The time the dragged thing would start at in `datum`'s column, rounded to a quarter of an hour.
 *
 * `null` when the pointer is unknown: a keyboard drag moves between columns without ever naming a time. The
 * callers answer that by keeping the time the thing already had, which is the only honest reading of a gesture that
 * said nothing about it.
 */
export function doelTijd(datum: string): number | null {
  if (laatsteY === null) return null;

  const kolom = document.querySelector(`[${KOLOM_ATTRIBUUT}="${datum}"]`);
  if (!kolom) return null;

  const rasterVan = Number(kolom.getAttribute(VAN_ATTRIBUUT));
  if (!Number.isFinite(rasterVan)) return null;

  // The LIVE rectangle, read at drop time rather than measured at drag start: the grid scrolls under the pointer
  // while dragging (dnd-kit auto-scrolls near the edges), and a stale top would place the block by an offset that
  // was true a second ago.
  const vak = kolom.getBoundingClientRect();
  return rond((laatsteY - greep - vak.top) / PX_PER_MINUUT + rasterVan, STAP);
}
