import { NavLink } from "react-router-dom";
import { BESTEMMINGEN } from "./routes";
import { Merk } from "./Merk";
import { t } from "../i18n";
import { cn } from "../lib/cn";

/**
 * One navigation element, two shapes.
 *
 * On a phone it is a bottom bar in the thumb zone; from `lg` it is a sidebar. Deliberately the same
 * DOM rather than two components behind a media query: duplicating the nav would put every
 * destination in the accessibility tree twice, and a screen reader would read the whole app's
 * navigation, then read it again.
 *
 * The active destination is marked three ways over the two shapes: `aria-current`, ink weight, and
 * a rule (above the tab on a phone, beside the item in the sidebar). Never colour, since this
 * interface has none to spend.
 */
export function Navigatie() {
  return (
    <nav
      aria-label={t("navigatie.aria")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-lijn bg-kaart/95 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
        "lg:inset-y-0 lg:right-auto lg:w-60 lg:flex-col lg:border-r lg:border-t-0 lg:pb-0 lg:backdrop-blur-none",
      )}
    >
      <div className="hidden px-5 pb-5 pt-6 lg:block">
        <Merk />
      </div>

      <ul className="flex items-stretch lg:flex-col lg:gap-0.5 lg:px-3">
        {BESTEMMINGEN.map(({ pad, labelSleutel, Icoon }) => (
          <li key={pad} className="flex-1 lg:flex-none">
            <NavLink
              to={pad}
              className={({ isActive }) =>
                cn(
                  "group relative flex min-h-14 flex-col items-center justify-center gap-1 text-micro tracking-normal",
                  "lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-veld lg:px-3 lg:text-body lg:font-medium",
                  "transition-colors duration-150",
                  isActive ? "text-accent lg:bg-accent-zacht" : "text-inkt-zacht hover:text-inkt lg:hover:bg-vlak",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* The rule. On a phone it caps the tab; in the sidebar it sits on the leading
                      edge. Hidden from assistive technology because aria-current already says it. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute rounded-full bg-accent transition-opacity duration-150",
                      "inset-x-5 top-0 h-[2px] lg:inset-x-auto lg:inset-y-1.5 lg:left-0 lg:h-auto lg:w-[2px]",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icoon className={cn("h-[22px] w-[22px] shrink-0 lg:h-5 lg:w-5", isActive && "[&_*]:stroke-[1.9]")} />
                  {t(labelSleutel)}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
