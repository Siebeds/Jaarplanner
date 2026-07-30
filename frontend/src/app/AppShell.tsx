import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";

import { t } from "../i18n";
import { KlasKiezer } from "./KlasKiezer";
import { Merkteken } from "./Merkteken";
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
 * **Layout.** A sticky header carrying the mark, the class switcher and the primary navigation; then the
 * page. The switcher lives in the header rather than on each screen because the choice is cross-cutting:
 * Jaarplan, Dekking and Thema's all scope to the same class, and "which class am I planning?" is the one
 * question a teacher must never get wrong.
 *
 * **The chrome carries a single hue** (`petrol`) and no categorical colour at all. Art. XII spends six
 * hues on doelsoort and the tokens spend more on status and dekking; a second chrome accent would compete
 * with the signal the tool exists to send. See the palette note in `src/index.css`.
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
   *   header, including the class switcher a teacher needs first, sat *behind* the focus position,
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
    <div className="min-h-screen bg-background">
      {/*
        In flow when focused (`not-sr-only` restores `position: static`), so it pushes the page down
        instead of covering it. Absolutely positioned, it landed on top of the wordmark and hid half of it.
      */}
      <a
        href={`#${HOOFDINHOUD_ID}`}
        className="sr-only focus:not-sr-only focus:block focus:bg-petrol focus:px-6 focus:py-3 focus:text-sm focus:font-semibold focus:text-petrol-foreground"
      >
        {t("navigatie.overslaan")}
      </a>

      {/* Sticky, because the class switcher and the navigation are the two things a teacher reaches for
          mid-scroll on a long jaarplan. `backdrop-blur` keeps it legible over scrolled content. */}
      <header className="sticky top-0 z-40 border-b border-border bg-paper/85 backdrop-blur">
        <div className="mx-auto max-w-[100rem] px-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-4">
            <div className="flex items-center gap-3">
              <Merkteken className="h-9 w-9 shrink-0 text-petrol" />
              <div>
                {/* Behind the seam like everything else. An earlier revision hard-coded this and granted itself
                    an exemption on the ground that a brand name is not translatable copy. Art. X.3 says
                    "everything in nl.json" and carves out no proper-noun exception, and this repo has already
                    ruled that way once: see the Art. II.3 entry in backlog/README.md, which retracts a narrower
                    reading of the same article as "wrong in the direction that made the decision look cheaper".
                    The clincher is that the product name is an *open* Art. XIV decision, so the one string
                    guaranteed to change was the one string not behind the seam. */}
                <h1 className="text-lg font-bold text-ink">{t("app.naam")}</h1>
                <p className="text-xs text-ink-zacht">{t("app.ondertitel")}</p>
              </div>
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
        className="mx-auto max-w-[100rem] px-5 py-8 focus-visible:outline-none focus-visible:ring-0 sm:px-8 sm:py-10"
      >
        <Outlet />
      </main>
    </div>
  );
}
