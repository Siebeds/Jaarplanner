import { fireEvent, screen } from "@testing-library/react";
import { t } from "../i18n";

/** "Alle 12 bekijken": what shows the rest of an opened subthema's activiteiten (FB-094). */
export const ALLE_ACTIVITEITEN = /^Alle \d+ bekijken$/;

const vouwknoppen = () => [ALLE_ACTIVITEITEN, t("thema.subdoelenBekijken")];

/**
 * Shows everything an opened subthema holds (FB-094) and pages every list out, for a test that reads the rows.
 *
 * An opened subthema shows its first activiteiten and a link to its subdoelen, and the lists show five rows at a time;
 * a test about what a row says or does is not about that, so it opens them all first. Call it once the rows' data is on
 * screen, and again after opening a subthema.
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
