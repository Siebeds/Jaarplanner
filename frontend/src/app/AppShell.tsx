import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { t } from "../i18n";
import { KlasKiezer } from "./KlasKiezer";
import { Navigatie } from "./Navigatie";

/** The id the skip-link targets, and the element that takes focus after a navigation. */
const HOOFDINHOUD_ID = "hoofdinhoud";

/**
 * The application frame every screen renders inside (E0-10).
 *
 * Before this existed, `App.tsx` stacked each built feature in one flex column and a class was chosen by
 * pasting a GUID into a text input. That was a deliberate trade at the time — a reachable screen beats an
 * unreachable one — but it meant no story had anywhere to put a *second* screen.
 *
 * Layout: a skip-link, then a header carrying the brand, the primary navigation and the klas/schooljaar
 * selector, then `<main>`. The selector sits in the header rather than on each screen because the choice
 * is cross-cutting: Jaarplan, Dekking and Thema's all scope to the same class.
 */
export function AppShell() {
  const location = useLocation();
  const hoofdinhoud = useRef<HTMLElement>(null);
  const isEersteWeergave = useRef(true);

  /**
   * Move focus to the main region after a navigation, so a keyboard or screen-reader user lands in the
   * new screen instead of staying on the nav link they just activated — a single-page app has no page
   * load to do this for us (WCAG 2.2 AA, E7-10).
   *
   * Skipped on first render: focus belongs at the top of the document when the app opens, and grabbing
   * it there would be the app stealing focus for no reason. Keyed on `pathname` only — selection changes
   * rewrite the query string (ADR-0021) and must not yank focus out of the dropdown being used.
   */
  useEffect(() => {
    if (isEersteWeergave.current) {
      isEersteWeergave.current = false;
      return;
    }

    hoofdinhoud.current?.focus();
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href={`#${HOOFDINHOUD_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
      >
        {t("navigatie.overslaan")}
      </a>

      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              {/* Brand / proper noun, not translatable copy — exempt from the i18n guard. */}
              {/* eslint-disable-next-line no-restricted-syntax */}
              <h1 className="text-2xl font-bold tracking-tight">Jaarplanner</h1>
              <p className="text-sm text-muted-foreground">{t("app.ondertitel")}</p>
            </div>
            <KlasKiezer />
          </div>
          <Navigatie />
        </div>
      </header>

      <main
        id={HOOFDINHOUD_ID}
        ref={hoofdinhoud}
        // Focusable only as a script target: -1 keeps it out of the tab order (E3-06's audit removed a
        // tabIndex that made every inert card a tab stop) while allowing the focus() call above.
        tabIndex={-1}
        className="mx-auto max-w-7xl px-6 py-8 focus-visible:outline-none"
      >
        <Outlet />
      </main>
    </div>
  );
}
