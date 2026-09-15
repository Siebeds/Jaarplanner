import type { Ref } from "react";
import { IcoonPlus } from "../../components/Iconen";
import { cn } from "../../lib/cn";

/**
 * The empty slot at the end of a list in the agenda's side panel: the shape of a card, drawn as an outline.
 *
 * **Dashed and unfilled, so it reads as a place for a card rather than one more card.** The cards above it are filled
 * with a solid edge; this one keeps their width, padding and corner, so the stack ends in the same rhythm, and gives up
 * their fill. No colour of its own: the accent it takes on hover is the one every card above it takes, and the plus
 * with the words says what it does without it.
 *
 * **Its edge is `lijn-veld`, darker than the line the cards use**, because without a fill the edge is the only thing
 * drawing the tile, and `index.css` keeps `lijn-veld` for an edge that carries a control: on this white panel
 * `lijn-sterk` measures 1.61:1 (antagonist, TB-015 round 1).
 *
 * Its own file since FB-017, when the activiteiten became a third list in the panel with the same tile.
 */
export function Toevoegtegel({
  ref,
  label,
  onKies,
}: {
  ref: Ref<HTMLButtonElement>;
  label: string;
  onKies: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onKies}
      className={cn(
        "flex w-full items-center gap-2 rounded-veld border border-dashed border-lijn-veld px-3 py-2.5 text-left",
        "text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-inkt",
      )}
    >
      <IcoonPlus aria-hidden="true" className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
