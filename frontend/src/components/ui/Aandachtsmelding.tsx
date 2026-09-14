import { useEffect, useRef, type ReactNode } from "react";

/**
 * An alert that appears after the sheet, dialog or control it is about has gone: the Gebruikers list's "intussen
 * verwijderd" and the refusal of a removal under the list (E6-04), and the agenda's refusal of a planning write
 * (E6-02 slice 4, fix round 1).
 *
 * **It takes focus once, when it appears** (owner-approved mini-fix after the E6-04 audit round 4). The control that
 * had focus closed with its sheet, so focus would otherwise fall to the page body. On a phone, or below the fold of
 * the agenda at 1440, the alert sits above or below content the person may be far from, so it would render out of
 * view. Focusing it scrolls it into view and lets a screen reader land on it. `tabIndex={-1}` makes it focusable
 * without adding a tab stop.
 *
 * It focuses on mount only, never on a re-render, so it cannot take focus away later. The call is deferred one task,
 * because a closing Radix dialog hands focus back in a deferred step of its own, which would otherwise land after
 * this one.
 *
 * **It scrolls itself to the middle, not just into view.** Focus alone scrolls the least it can, which leaves the
 * alert flush against an edge of the screen, and whatever changes above it next pushes it out again. On the agenda
 * that happens every time: the refusal refetches the rights, and the quiet line that then appears above the grid
 * pushed the alert 30 px, 5 of them below the fold at 1440×1000 (browser pass, fix round 1). Centred, or as far as the
 * page lets it go, which at the page's end still leaves the screen's bottom padding as slack.
 *
 * *Moved here from `GebruikersScherm.tsx` in E6-02 slice 4 fix round 1, when the agenda needed it too; the centred
 * scroll was added in the same round.*
 */
export function Aandachtsmelding({ children }: { children: ReactNode }) {
  const melding = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const taak = window.setTimeout(() => {
      const element = melding.current;
      if (!element) return;
      element.focus({ preventScroll: true });
      // Optional call: jsdom has no scrollIntoView, and a test there is about focus.
      element.scrollIntoView?.({ block: "center" });
    }, 0);
    return () => window.clearTimeout(taak);
  }, []);
  return (
    <p
      ref={melding}
      role="alert"
      tabIndex={-1}
      className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt"
    >
      {children}
    </p>
  );
}
