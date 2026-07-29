import { NavLink, useLocation } from "react-router-dom";

import { t } from "../i18n";
import { NAVIGATIE } from "./routes";

/**
 * The primary navigation (E0-10 clause 2), per the information architecture in
 * `docs/ux/ui-ux-approach.md` §3.
 *
 * Two properties worth stating, because both are easy to lose later:
 *
 * 1. **Every link preserves the query string.** The klas/schooljaar selection lives there (ADR-0021), so
 *    a raw `<Link to="/dekking">` would silently drop the chosen class on navigation. Routing all nav
 *    through this one component is what keeps that rule in a single place.
 * 2. **An unbuilt destination says so, in visible text.** Not a tooltip: E3-06's audit found a `title`
 *    disclosure was invisible on touch, unreachable by keyboard and unread by most screen readers, while
 *    the story claimed the UI "said it out loud".
 *
 * `NavLink` supplies `aria-current="page"` on the active item, which is the WCAG 2.2 AA requirement
 * (Art. XII, E7-10) — the styling below is deliberately not the only signal.
 */
export function Navigatie() {
  const location = useLocation();

  return (
    <nav aria-label={t("navigatie.hoofdnavigatie")}>
      <ul className="flex flex-wrap gap-1">
        {NAVIGATIE.map((bestemming) => (
          <li key={bestemming.pad}>
            <NavLink
              // Carrying `search` is what keeps the chosen class across screens.
              to={{ pathname: bestemming.pad, search: location.search }}
              className={({ isActive }) =>
                [
                  "flex items-baseline gap-1.5 rounded-md px-3 py-2 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-foreground font-semibold text-background"
                    : "text-foreground hover:bg-muted",
                ].join(" ")
              }
            >
              {t(bestemming.labelKey)}
              {bestemming.isGebouwd ? null : (
                <span className="text-xs font-normal opacity-80">
                  {t("navigatie.nogNietBeschikbaar")}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
