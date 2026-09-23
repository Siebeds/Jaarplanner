import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "../../lib/cn";
import { IcoonToverstok } from "../Iconen";
import { knopklassen, type Rang } from "./knopklassen";

/**
 * Buttons. Three ranks, described where they are defined: `knopklassen.ts`.
 */
export function Knop({
  rang = "rustig",
  vol,
  bezig,
  className,
  type = "button",
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  rang?: Rang;
  vol?: boolean;
  /**
   * A save this button started is under way. The button then ignores every press but stays enabled, marked
   * `aria-disabled` and `aria-busy`, so the keyboard focus stays on it: `disabled` would drop that focus to the page
   * body mid-save, and the teacher would have to tab back from the top. A button that waits on its own save uses this;
   * one that cannot be pressed for another reason uses `disabled`.
   */
  bezig?: boolean;
}) {
  return (
    <button
      // `button`, not the HTML default of `submit`. A <button> with no type submits whatever form it
      // happens to sit in, and these are dropped into forms by callers who never see the <form> tag:
      // "Doel koppelen" inside the activiteit sheet silently saved the activiteit and closed the
      // sheet instead of opening the goal picker. Submitting is now something a caller asks for, and
      // the three forms that want it already pass type="submit" explicitly.
      type={type}
      aria-disabled={bezig || undefined}
      aria-busy={bezig || undefined}
      // `preventDefault` too, so a busy submit button does not submit its form again, also not through Enter in one of
      // its fields, which the browser turns into a click on this button.
      onClick={bezig ? (e) => e.preventDefault() : onClick}
      className={cn(
        knopklassen(rang, vol),
        "disabled:pointer-events-none disabled:opacity-45 aria-disabled:cursor-wait aria-disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A button that calls the model, so that what follows is a proposal rather than a result (Art. IV).
 *
 * It wears the rainbow ring of ADR-0039, and the wand in front of its label says the same thing without
 * colour (Art. XII). This is the one way to the `ai` look: a caller that wants the ring gets the wand with
 * it. `bezig` is the busy state of `Knop`, whose `aria-busy` also keeps the ring bright and sweeping
 * during the run.
 *
 * During a run the wand throws sparks in the five ring colours and three dots bounce after the label (TB-044), so a
 * wait of several seconds reads as thinking rather than as a button that stuck. Both are decoration, hidden from a
 * screen reader, which hears `aria-busy` and the caller's busy label instead. Under reduced motion the sparks do not
 * show and the dots stand still, so the label and its dots still say that the run is going.
 */
export function AiKnop({
  bezig,
  children,
  ...props
}: Omit<ComponentProps<typeof Knop>, "rang"> & { bezig?: boolean }) {
  return (
    <Knop rang="ai" bezig={bezig} {...props}>
      <span className="relative inline-flex shrink-0">
        <IcoonToverstok aria-hidden="true" className="h-4 w-4" />
        {bezig ? (
          <span aria-hidden="true" data-testid="ai-vonken" className="ai-vonken">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : null}
      </span>
      {children}
      {bezig ? (
        <span aria-hidden="true" data-testid="ai-puntjes" className="ai-puntjes">
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </Knop>
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
