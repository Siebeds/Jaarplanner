import { NavLink } from "react-router-dom";
import { BESTEMMINGEN, ONDERAAN, type Bestemming } from "./routes";
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
 *
 * **Instellingen is drawn apart from the four (owner, 2026-08-30).** In the sidebar it is pushed to
 * the bottom edge over a rule, because setting the school up is not one of the four things a teacher
 * does all year and a fifth item in the run would read as if it were. On a phone the bottom bar has
 * no bottom to push it to, so it is simply the last tab: five fit, and the alternative is a
 * destination that exists on a laptop and not on a phone.
 */
export function Navigatie() {
  return (
    <nav
      aria-label={t("navigatie.aria")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-lijn bg-kaart/95 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
        // `lg:flex` is load-bearing and was missing: `lg:flex-col` alone sets a direction on a block
        // box, which does nothing, and without a flex column the Instellingen item has no free space
        // to be pushed into by `mt-auto`.
        "lg:inset-y-0 lg:right-auto lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-t-0 lg:pb-0 lg:backdrop-blur-none",
      )}
    >
      <div className="hidden px-5 pb-5 pt-6 lg:block">
        <Merk />
      </div>

      {/* One list, both groups. The phone bar reads them as one run of tabs; the sidebar pushes the
          second group down with `lg:mt-auto` on its first item, which is why the two are separate
          arrays rather than one with a divider spliced in. */}
      <ul className="flex items-stretch lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0.5 lg:px-3 lg:pb-4">
        {BESTEMMINGEN.map((bestemming) => (
          <Tab key={bestemming.pad} bestemming={bestemming} />
        ))}
        {ONDERAAN.map((bestemming, index) => (
          <Tab
            key={bestemming.pad}
            bestemming={bestemming}
            // Only the first of the group takes the push and the rule, so a second settings
            // destination would sit under this one instead of starting a third group.
            className={index === 0 ? "lg:mt-auto lg:border-t lg:border-lijn lg:pt-2" : undefined}
          />
        ))}
      </ul>
    </nav>
  );
}

/** One destination, in whichever of the two shapes the viewport is currently in. */
function Tab({ bestemming, className }: { bestemming: Bestemming; className?: string }) {
  const { pad, labelSleutel, Icoon } = bestemming;

  return (
    <li className={cn("flex-1 lg:flex-none", className)}>
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
  );
}
