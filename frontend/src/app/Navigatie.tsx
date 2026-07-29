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
 * 3. **The active tab is marked by weight and a rule, not by a filled block.** The first build used a solid
 *    dark pill, which made the navigation the heaviest thing on the page — and on `/dekking` it meant the
 *    boldest object on screen was advertising a screen that does not work yet. A 2px rule reads as
 *    position, which is all it should say, and it echoes the year-ribbon the kalender is built on.
 *
 * `NavLink` supplies `aria-current="page"`, so the active state is never carried by styling alone
 * (Art. XII, WCAG 2.2 AA, E7-10).
 */
export function Navigatie({ className }: { className?: string }) {
  const location = useLocation();

  return (
    <nav aria-label={t("navigatie.hoofdnavigatie")} className={className}>
      <ul className="flex flex-wrap gap-x-6">
        {NAVIGATIE.map((bestemming) => (
          <li key={bestemming.pad}>
            <NavLink
              // Carrying `search` is what keeps the chosen class across screens.
              to={{ pathname: bestemming.pad, search: location.search }}
              className={({ isActive }) =>
                [
                  "inline-flex items-baseline gap-1.5 border-b-2 py-2.5 text-sm",
                  "focus-visible:rounded-t-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                ].join(" ")
              }
            >
              {t(bestemming.labelKey)}
              {bestemming.isGebouwd ? null : (
                <span className="text-[11px] font-normal tracking-wide text-muted-foreground">
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
