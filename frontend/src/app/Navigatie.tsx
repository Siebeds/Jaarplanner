import { NavLink, useLocation } from "react-router-dom";

import { t } from "../i18n";
import { NAVIGATIE } from "./routes";

/**
 * The primary navigation (E0-10 clause 2), per the information architecture in
 * `docs/ux/ui-ux-approach.md` §3.
 *
 * Three properties worth stating, because each is easy to lose later:
 *
 * 1. **Every link preserves the query string.** The klas/schooljaar selection lives there (ADR-0021), so a
 *    raw `<Link to="/dekking">` would silently drop the chosen class. Routing all nav through this one
 *    component is what keeps that rule in a single place.
 * 2. **An unbuilt destination says so, in visible text.** Not a tooltip: E3-06's audit found a `title`
 *    disclosure was invisible on touch, unreachable by keyboard and unread by most screen readers, while
 *    the story claimed the UI "said it out loud".
 * 3. **The active tab is a filled `petrol-wash` pill, and unbuilt items are quieter than built ones.**
 *    Both matter for honesty as much as looks: the first draft made the active tab the heaviest object on
 *    the page, so on `/dekking` the boldest thing on screen advertised a screen that does not work.
 *
 * `NavLink` supplies `aria-current="page"`, so the active state is never carried by styling alone
 * (Art. XII, WCAG 2.2 AA, E7-10).
 */
export function Navigatie() {
  const location = useLocation();

  return (
    <nav aria-label={t("navigatie.hoofdnavigatie")} className="subtle-scrollbar -mx-1.5 overflow-x-auto pb-2">
      <ul className="flex items-center gap-0.5">
        {NAVIGATIE.map((bestemming) => (
          <li key={bestemming.pad}>
            <NavLink
              // Carrying `search` is what keeps the chosen class across screens.
              to={{ pathname: bestemming.pad, search: location.search }}
              className={({ isActive }) =>
                [
                  "flex items-baseline gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm",
                  "transition-colors duration-150 ease-uit",
                  isActive
                    ? "bg-petrol-wash font-semibold text-petrol"
                    : bestemming.isGebouwd
                      ? "font-medium text-ink-zacht hover:bg-muted hover:text-ink"
                      // Unbuilt items are quieter by WEIGHT, not by a lighter colour:
                      // `text-ink-zacht/80` measures 3.66:1 on paper, under the 4.5:1
                      // floor at this size. Opacity on already-muted text is the exact
                      // trap E3-06's audit caught, and jsdom/axe cannot see it.
                      : "font-normal text-ink-zacht hover:bg-muted hover:text-ink",
                ].join(" ")
              }
            >
              {t(bestemming.labelKey)}
              {bestemming.isGebouwd ? null : (
                <span className="text-[0.6875rem] font-normal">
                  {t("navigatie.binnenkort")}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
