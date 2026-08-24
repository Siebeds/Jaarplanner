import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

/**
 * Buttons. Three ranks, and the ranking is carried by weight and surface rather than by hue: this
 * interface has no brand colour to spend on a call to action (see the note at the top of index.css).
 *
 * `hoofd` is the ink itself, which makes it the darkest thing on the page and therefore the most
 * obviously pressable. Everything else steps back.
 */
type Rang = "hoofd" | "rustig" | "stil";

const RANG: Record<Rang, string> = {
  hoofd: "bg-accent text-accent-op hover:bg-accent-diep active:bg-accent-diep",
  rustig: "bg-kaart text-inkt border border-lijn-veld hover:border-inkt hover:bg-vlak active:bg-vlak-diep",
  stil: "text-inkt-zacht hover:bg-vlak-diep hover:text-inkt active:bg-vlak-diep",
};

export function Knop({
  rang = "rustig",
  vol,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { rang?: Rang; vol?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-raak items-center justify-center gap-2 rounded-veld px-4 text-body font-medium",
        "transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-45",
        RANG[rang],
        vol && "w-full",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A square icon-only control. Always needs an `aria-label`, since it carries no text; the type is
 * widened to require one rather than trusting everyone to remember.
 */
export function IcoonKnop({
  className,
  "aria-label": label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex h-raak w-raak shrink-0 items-center justify-center rounded-veld",
        "border border-lijn-veld bg-kaart text-inkt-zacht",
        "transition-colors duration-150 hover:border-inkt hover:text-inkt active:bg-vlak-diep",
        className,
      )}
      {...props}
    />
  );
}
