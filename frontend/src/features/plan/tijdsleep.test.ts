import type { DragStartEvent } from "@dnd-kit/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KOLOM_ATTRIBUUT, VAN_ATTRIBUUT, beginSleep, doelTijd, eindigSleep } from "./tijdsleep";
import { PX_PER_MINUUT } from "./tijd";

/**
 * Where a drag lands keeps the offset at which the thing was picked up (FB-017).
 *
 * dnd-kit fills `active.rect.current.initial` only after `onDragStart`, so a landing read from it put the carried
 * block's top under the pointer instead of where the card the teacher saw was. These tests hand `beginSleep` exactly
 * that: a rect ref that is still empty.
 */

// jsdom has no PointerEvent; `beginSleep` tests for one, as a browser's pointer sensor hands it.
class Aanwijzer extends MouseEvent {}

function vak(el: Element, top: number, hoogte: number) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top, bottom: top + hoogte, left: 0, right: 100, width: 100, height: hoogte, x: 0, y: top, toJSON: () => ({}),
  } as DOMRect);
}

function start(activator: Event): DragStartEvent {
  return {
    activatorEvent: activator,
    active: { id: "kaart", data: { current: {} }, rect: { current: { initial: null, translated: null } } },
  } as unknown as DragStartEvent;
}

let kolom: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("PointerEvent", Aanwijzer);
  kolom = document.createElement("div");
  kolom.setAttribute(KOLOM_ATTRIBUUT, "2026-09-15");
  kolom.setAttribute(VAN_ATTRIBUUT, String(7 * 60));
  document.body.append(kolom);
  vak(kolom, 100, 1000);
});

afterEach(() => {
  eindigSleep();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("tijdsleep: de grijpafstand", () => {
  it("laat een kaart landen waar haar bovenrand staat, ook al heeft dnd-kit haar rechthoek nog niet", () => {
    const kaart = document.createElement("button");
    kaart.setAttribute("aria-roledescription", "draggable");
    const naam = document.createElement("p");
    kaart.append(naam);
    document.body.append(kaart);
    vak(kaart, 300, 70);

    // Picked up 30 pixels below its top edge, on the name inside it.
    const druk = new PointerEvent("pointerdown", { clientY: 330, bubbles: true });
    naam.dispatchEvent(druk);
    beginSleep(start(druk));

    // The pointer travels to where the card's top edge is on 10:00, thirty pixels above the pointer.
    const bovenrand = 100 + (10 * 60 - 7 * 60) * PX_PER_MINUUT;
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: bovenrand + 30 }));

    expect(doelTijd("2026-09-15")).toBe(10 * 60);
  });

  it("valt terug op de aanwijzer zelf wanneer het opgepakte element niet te vinden is", () => {
    const druk = new PointerEvent("pointerdown", { clientY: 330 });
    beginSleep(start(druk));

    window.dispatchEvent(new PointerEvent("pointermove", { clientY: 100 + (10 * 60 - 7 * 60) * PX_PER_MINUUT }));

    expect(doelTijd("2026-09-15")).toBe(10 * 60);
  });
});
