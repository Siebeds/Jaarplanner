import { fireEvent, screen } from "@testing-library/react";

/** The fold button of a list on the thema page: its count and what it counts ("3 activiteiten", "1 minimumdoel"). */
export const LIJSTKNOP = /^\d+ (minimumdoel|activiteit|subdoel|doel)(en)?$/;

/**
 * Opens every shut list on the thema page (TB-044) and pages each one out, for a test that reads the rows.
 *
 * The lists start shut and show five rows at a time; a test about what a row says or does is not about that, so it
 * opens them all first. Call it once the rows' data is on screen, and again after opening a chapter.
 */
export function openLijsten() {
  for (const knop of screen.queryAllByRole("button", { name: LIJSTKNOP, expanded: false })) fireEvent.click(knop);
  for (let meer = laadknoppen(); meer.length > 0; meer = laadknoppen()) {
    for (const knop of meer) fireEvent.click(knop);
  }
}

const laadknoppen = () => screen.queryAllByRole("button", { name: /^Laad \d+ meer/ });
