import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { knopklassen, type Rang } from "./knopklassen";

/**
 * Buttons. Three ranks, described where they are defined: `knopklassen.ts`.
 */
export function Knop({
  rang = "rustig",
  vol,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { rang?: Rang; vol?: boolean }) {
  return (
    <button
      // `button`, not the HTML default of `submit`. A <button> with no type submits whatever form it
      // happens to sit in, and these are dropped into forms by callers who never see the <form> tag:
      // "Doel koppelen" inside the activiteit sheet silently saved the activiteit and closed the
      // sheet instead of opening the goal picker. Submitting is now something a caller asks for, and
      // the three forms that want it already pass type="submit" explicitly.
      type={type}
      className={cn(knopklassen(rang, vol), "disabled:pointer-events-none disabled:opacity-45", className)}
      {...props}
    />
  );
}

/**
 * A link that looks like a button.
 *
 * Separate from `Knop` and not a prop on it: this renders an `<a>`, and the difference is not
 * cosmetic. A destination belongs in the address bar, gets a middle-click and a right-click menu,
 * and reads to a screen reader as a link rather than as something that acts on this page. Anything
 * that navigates uses this; anything that changes data uses `Knop`.
 *
 * `href` stays untyped on purpose: some of these go to a router path and some to an API download,
 * and the caller is the only one that knows which.
 */
export function Knoplink({
  rang = "rustig",
  vol,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { rang?: Rang; vol?: boolean }) {
  return (
    <a
      className={cn(knopklassen(rang, vol), className)}
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
  type = "button",
  "aria-label": label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type={type}
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
