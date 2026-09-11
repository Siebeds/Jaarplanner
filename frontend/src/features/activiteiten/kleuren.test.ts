import { describe, expect, it } from "vitest";
import { KLEURVLAK } from "./kleuren";

/**
 * The washes live outside `index.css`, so the guard that gives every colour token a dark value
 * (`state/weergave.test.ts`) cannot see them. A wash without its `dark:` half keeps its 93% light
 * tint on a dark screen, under ink that is 92% light, and the text on it disappears.
 */
describe("de activiteitkleuren", () => {
  it("hebben elk een donkere vlakkleur en rand", () => {
    const zonder = Object.entries(KLEURVLAK)
      .filter(([, klassen]) => !klassen.includes("dark:bg-") || !klassen.includes("dark:border-"))
      .map(([kleur]) => kleur);
    expect(zonder).toEqual([]);
  });
});
