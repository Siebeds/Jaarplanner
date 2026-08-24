import { cn } from "../../lib/cn";

/**
 * The three button ranks and the shape they share.
 *
 * In its own module because a react-router `<Link>` has to look identical to a `Knop` without
 * being one, and a helper exported from a component file breaks fast refresh for that whole file.
 * The alternative was the same class string copied into every screen that navigates: it was in two
 * before this existed, and the second copy had already drifted.
 *
 * The ranking is carried by weight and surface, not by hue. The one accent this interface has is
 * spent on `hoofd` and on four other things, and nothing else (see the note at the top of
 * index.css); everything below `hoofd` steps back rather than picking up a second colour.
 */
export type Rang = "hoofd" | "rustig" | "stil";

export const RANG: Record<Rang, string> = {
  hoofd: "bg-accent text-accent-op hover:bg-accent-diep active:bg-accent-diep",
  rustig: "bg-kaart text-inkt border border-lijn-veld hover:border-inkt hover:bg-vlak active:bg-vlak-diep",
  stil: "text-inkt-zacht hover:bg-vlak-diep hover:text-inkt active:bg-vlak-diep",
};

export function knopklassen(rang: Rang = "rustig", vol?: boolean): string {
  return cn(
    "inline-flex min-h-raak items-center justify-center gap-2 rounded-veld px-4 text-body font-medium",
    "transition-colors duration-150",
    RANG[rang],
    vol && "w-full",
  );
}
