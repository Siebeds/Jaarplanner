import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";

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
 * **The chrome carries no colour, on purpose.** Art. XII gives six doelsoort hues a fixed meaning, and the
 * token set adds coverage and suggestion-status colours on top; a seventh accent for navigation would
 * compete with the one signal this tool exists to communicate. So the header separates itself from the
 * content tonally (a muted band against a white page) and the hierarchy is carried by type and structure.
 * Every hue stays available to mean something.
 */
export function AppShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const hoofdinhoud = useRef<HTMLElement>(null);
  const vorigPad = useRef(location.pathname);

  /**
   * Move focus to the main region after a navigation, so a keyboard or screen-reader user lands in the new
   * screen instead of staying on the link they just activated — a single-page app has no page load to do
   * this for us (WCAG 2.2 AA, E7-10).
   *
   * Two exclusions, both found by opening the app in a browser rather than by any test:
   *
   * - **Mount.** Focus belongs at the top of the document when the app opens; grabbing it would be the app
   *   stealing focus for no reason. Detected by comparing against the previous pathname — *not* by a
   *   "first render" flag, which is unsound: `StrictMode` deliberately runs effects twice on mount in
   *   development, so the first run cleared the flag and the second focused `main` regardless. That also
   *   made dev and production behave differently, which is worse than either behaviour on its own.
   * - **`REPLACE` navigations.** `/` redirects to `/jaarplan`, which is a pathname change like any other,
   *   so this effect fired on the very first visit and dropped focus into an empty `<main>` — the entire
   *   header, including the class selector a teacher needs first, sat *behind* the focus position,
   *   reachable only by Shift+Tab. A redirect is not something the user did. Selection changes are
   *   `REPLACE` too, so the dropdown being used can never lose focus mid-choice either.
   */
  useEffect(() => {
    if (vorigPad.current === location.pathname) {
      return;
    }

    vorigPad.current = location.pathname;

    if (navigationType === "REPLACE") {
      return;
    }

    hoofdinhoud.current?.focus();
  }, [location.pathname, navigationType]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/*
        In flow when focused (`not-sr-only` restores `position: static`), so it pushes the page down
        instead of covering it. Absolutely positioned, it landed on top of the wordmark and hid half of it.
      */}
      <a
        href={`#${HOOFDINHOUD_ID}`}
        className="sr-only focus:not-sr-only focus:block focus:bg-foreground focus:px-6 focus:py-2 focus:text-sm focus:font-medium focus:text-background"
      >
        {t("navigatie.overslaan")}
      </a>

      <header className="border-b border-border bg-muted/50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 pb-4 pt-5">
            <div>
              {/* Brand / proper noun, not translatable copy — exempt from the i18n guard. */}
              {/* eslint-disable-next-line no-restricted-syntax */}
              <h1 className="text-xl font-semibold tracking-tight">Jaarplanner</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("app.ondertitel")}</p>
            </div>
            <KlasKiezer />
          </div>

          {/* `-mb-px` lets an active tab's 2px rule sit over the header's hairline instead of beside it. */}
          <Navigatie className="-mb-px" />
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
