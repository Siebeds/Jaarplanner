import { KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";
import { volleDag } from "../../lib/datum";
import { leesSlotId } from "../activiteiten/lesuren";
import { t } from "../../i18n";

/**
 * The sensors every drag in the agenda uses, and the Dutch a screen reader hears while it happens.
 *
 * Three sensors rather than one, because the three input kinds fail differently. A pointer needs a
 * few pixels of travel before a press counts as a drag, or a plain click on an activiteit stops
 * opening its sheet. A touch needs a delay instead of a distance: a finger that has to move first
 * cannot tell the page apart from the card, so the page stops scrolling. And a keyboard needs its
 * own sensor or the whole feature is mouse-only, which for a plan a school is inspected on is not a
 * feature at all.
 */
export function useSleepSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Space picks up, Escape cancels, Space drops. Enter is deliberately NOT a drag key.
    //
    // Every draggable in this calendar is a button that also OPENS the thing it holds, which is what
    // lets a teacher drag from anywhere on a card instead of aiming at a handle. dnd-kit's default
    // start keys are Space and Enter, and it calls preventDefault when it starts, so with the default
    // a keyboard user could pick a card up and never open one. Splitting the two keys gives the same
    // card both jobs: Enter opens, Space moves.
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
}

/** Spoken once, when a draggable takes focus. dnd-kit's own text is English. */
export const sleepUitleg: ScreenReaderInstructions = {
  draggable: t("slepen.uitleg"),
};

/**
 * What a screen reader says while an activiteit is moved across the calendar.
 *
 * The identifiers dnd-kit hands back are the values this app already keys on: a draggable is a
 * plaatsingId and a droppable is an ISO date, so the date is spoken in full rather than as the
 * "2026-11-11" that is on the wire.
 */
export function kalenderMeldingen(naamVan: (plaatsingId: string) => string): Announcements {
  // A drop target in the day grid is a day AND a lesuur, so its id carries both. Spoken as both:
  // "woensdag 14 oktober, lesuur 3" is the whole target, and reading the raw id aloud would not be.
  const dag = (id: string | number) => {
    const rauw = String(id);
    const plek = leesSlotId(rauw);
    return plek
      ? t("lesuur.kiezerTitel", { dag: volleDag(plek.datum), nummer: plek.slot + 1 })
      : volleDag(rauw);
  };
  return {
    onDragStart: ({ active }) => t("slepen.opgepakt", { naam: naamVan(String(active.id)) }),
    onDragOver: ({ active, over }) =>
      over ? t("slepen.boven", { naam: naamVan(String(active.id)), dag: dag(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("slepen.neer", { naam: naamVan(String(active.id)), dag: dag(over.id) })
        : t("slepen.afgebroken", { naam: naamVan(String(active.id)) }),
    onDragCancel: ({ active }) => t("slepen.afgebroken", { naam: naamVan(String(active.id)) }),
  };
}

/** The same, for reordering a list where what changes is a position rather than a date. */
export function lijstMeldingen(naamVan: (id: string) => string, totaal: number): Announcements {
  const positie = (over: { data: { current?: { sortable?: { index: number } } } } | null) =>
    (over?.data.current?.sortable?.index ?? 0) + 1;
  return {
    onDragStart: ({ active }) => t("slepen.lijstOpgepakt", { naam: naamVan(String(active.id)), totaal }),
    onDragOver: ({ active, over }) =>
      over
        ? t("slepen.lijstBoven", { naam: naamVan(String(active.id)), positie: positie(over), totaal })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("slepen.lijstNeer", { naam: naamVan(String(active.id)), positie: positie(over), totaal })
        : t("slepen.afgebroken", { naam: naamVan(String(active.id)) }),
    onDragCancel: ({ active }) => t("slepen.afgebroken", { naam: naamVan(String(active.id)) }),
  };
}
