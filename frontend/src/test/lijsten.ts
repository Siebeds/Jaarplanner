import { fireEvent, screen } from "@testing-library/react";
import { t } from "../i18n";

/** The fold button of the thema's minimumdoelen: its count and what it counts ("70 minimumdoelen"). */
export const LIJSTKNOP = /^\d+ minimumdoel(en)?$/;

/** The fold button of a list in a subthema chapter: its heading and its count ("Activiteiten 5"). */
export const hoofdstuklijst = (titel: string) => new RegExp(`^${titel} \\d+$`);

const vouwknoppen = () => [
  LIJSTKNOP,
  hoofdstuklijst(t("thema.activiteitenTitel")),
  hoofdstuklijst(t("thema.subdoelenTitel")),
  hoofdstuklijst(t("thema.andereDoelenTitel")),
];

/**
 * Opens every shut list on the thema page (TB-051) and pages each one out, for a test that reads the rows.
 *
 * The lists start shut and show five rows at a time; a test about what a row says or does is not about that, so it
 * opens them all first. Call it once the rows' data is on screen, and again after opening a chapter.
 */
export function openLijsten() {
  for (const naam of vouwknoppen()) {
    for (const knop of screen.queryAllByRole("button", { name: naam, expanded: false })) fireEvent.click(knop);
  }
  for (let meer = laadknoppen(); meer.length > 0; meer = laadknoppen()) {
    for (const knop of meer) fireEvent.click(knop);
  }
}

const laadknoppen = () => screen.queryAllByRole("button", { name: /^Laad \d+ meer/ });
