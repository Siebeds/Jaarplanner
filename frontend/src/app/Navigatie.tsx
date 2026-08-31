import { useLayoutEffect } from "react";
import { NavLink, useMatch } from "react-router-dom";
import { BESTEMMINGEN, ONDERAAN, type Bestemming } from "./routes";
import { Merk } from "./Merk";
import { IcoonHoek } from "../components/Iconen";
import { useHoekenpaneel } from "../state/hoekenpaneel";
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
 * **From `lg` it collapses to an icon rail while the agenda's hoekenpaneel is open** (owner,
 * 2026-08-30). The panel needs the width the labels are using, and the alternative the owner rejected
 * was covering the navigation entirely: a teacher who opens a panel has not asked to lose her way
 * around the app. The destinations stay where they were, in the same order, at the same vertical
 * positions; only the words go. `aria-label` carries each one, so nothing is lost to a screen reader,
 * and the label is restored the moment the panel closes.
 *
 * *A phone has no sidebar to collapse, so this is an `lg` behaviour only and the bottom bar is
 * untouched. The panel becomes a sheet there instead; see `Hoekenpaneel`.*
 *
 * **Instellingen is drawn apart from the four (owner, 2026-08-30).** In the sidebar it is pushed to
 * the bottom edge over a rule, because setting the school up is not one of the four things a teacher
 * does all year and a fifth item in the run would read as if it were. On a phone the bottom bar has
 * no bottom to push it to, so it is simply the last tab: five fit, and the alternative is a
 * destination that exists on a laptop and not on a phone.
 *
 * **The hoekenfiches switch lives here from `lg` (owner, 2026-08-31), under the four and over a
 * rule.** It is not a destination and must not read as one, so it is a `button` with `aria-pressed`,
 * it never takes the accent bar that stands for `aria-current`, and its open state is a neutral tint
 * rather than the accent the destinations own. What tells a sighted teacher the panel is open is the
 * panel: 240px of it, immediately to the right of this button. *Below `lg` the switch stays in the
 * agenda toolbar,* because a bottom bar of five tabs has no room for a sixth and the panel has to
 * stay reachable on a phone. One control per viewport, never two at once.
 *
 * **Leaving the agenda closes the panel** (owner, 2026-08-31): press a destination and the sidebar is
 * a sidebar again. That reset is not cosmetic. Only `Agendascherm` renders the panel, while the rail
 * here and the inline reservation in `Schil` both follow the store, so without it a teacher who
 * navigated away kept a 56px rail and 296px of reserved width beside a screen with no panel in it.
 */
export function Navigatie() {
  const paneelOpen = useHoekenpaneel((s) => s.open);
  const zetPaneel = useHoekenpaneel((s) => s.zet);
  const wisselPaneel = useHoekenpaneel((s) => s.wissel);

  /*
    The two routes `Agendascherm` answers, and so the only two that mount a hoekenpaneel. Matched as
    route patterns rather than by a `/agenda` prefix on purpose: `/agenda/periodes` is a different
    screen with no panel, and a prefix test would offer the switch there.

    Both matches are read into their own const before they are combined. Inlining them into one `||`
    short-circuits the second hook on the month view, which is a rules-of-hooks violation.
  */
  const opMaand = useMatch("/agenda");
  const opDag = useMatch("/agenda/dag/:datum");
  const opAgenda = opMaand !== null || opDag !== null;

  /*
    `useLayoutEffect` and not `useEffect`: this runs on every navigation away from the agenda, and an
    effect that fires after paint would let one frame through with the rail still collapsed and the
    padding still reserved. Before paint, the browser only ever sees the settled layout.
  */
  useLayoutEffect(() => {
    if (!opAgenda && paneelOpen) zetPaneel(false);
  }, [opAgenda, paneelOpen, zetPaneel]);

  return (
    <nav
      aria-label={t("navigatie.aria")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-lijn bg-kaart/95 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
        // `lg:flex` is load-bearing and was missing: `lg:flex-col` alone sets a direction on a block
        // box, which does nothing, and without a flex column the Instellingen item has no free space
        // to be pushed into by `mt-auto`.
        "lg:inset-y-0 lg:right-auto lg:flex lg:flex-col lg:border-r lg:border-t-0 lg:pb-0 lg:backdrop-blur-none",
        // The width is the whole animation. Everything inside is laid out from the leading edge, so
        // the labels are clipped away rather than reflowed, and the icons do not move a pixel.
        "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        paneelOpen ? "lg:w-14" : "lg:w-60",
      )}
    >
      {/* The wordmark goes with the labels: it is a word. Kept mounted rather than unmounted so the
          rail does not jump when it returns. */}
      <div className={cn("hidden px-5 pb-5 pt-6 lg:block", paneelOpen && "lg:invisible")}>
        <Merk />
      </div>

      {/* One list, both groups. The phone bar reads them as one run of tabs; the sidebar pushes the
          second group down with `lg:mt-auto` on its first item, which is why the two are separate
          arrays rather than one with a divider spliced in. */}
      <ul
        className={cn(
          "flex items-stretch lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0.5 lg:pb-4",
          paneelOpen ? "lg:px-2" : "lg:px-3",
        )}
      >
        {BESTEMMINGEN.map((bestemming) => (
          <Tab key={bestemming.pad} bestemming={bestemming} smal={paneelOpen} />
        ))}

        {/* Only on the routes that have a panel to switch. Never in the bottom bar, hence `hidden`
            with an `lg` opt-in: the phone keeps exactly its five tabs at every route. */}
        {opAgenda ? (
          <li className="hidden lg:mt-2 lg:block lg:border-t lg:border-lijn lg:pt-2">
            <Hoekenschakelaar open={paneelOpen} onWissel={wisselPaneel} />
          </li>
        ) : null}

        {ONDERAAN.map((bestemming, index) => (
          <Tab
            key={bestemming.pad}
            bestemming={bestemming}
            smal={paneelOpen}
            // Only the first of the group takes the push and the rule, so a second settings
            // destination would sit under this one instead of starting a third group.
            className={index === 0 ? "lg:mt-auto lg:border-t lg:border-lijn lg:pt-2" : undefined}
          />
        ))}
      </ul>
    </nav>
  );
}

/**
 * The hoekenfiches switch: the shape of a sidebar item, deliberately not its behaviour.
 *
 * It borrows the geometry of a `Tab` so the sidebar reads as one family: the same height, the same
 * icon size, the same rounding and inset. What it does not borrow is the accent. A destination is
 * marked with `bg-accent-zacht` plus the 2px rule that stands for `aria-current`, and a switch
 * copying either would claim to be a place you are rather than a thing that is on.
 *
 * When the panel is open this sits in the 56px rail, so the label is gone and `aria-label` carries
 * it, exactly as the destinations above do.
 */
function Hoekenschakelaar({ open, onWissel }: { open: boolean; onWissel: () => void }) {
  const naam = t("hoekenpaneel.titel");

  return (
    <button
      type="button"
      onClick={onWissel}
      aria-pressed={open}
      aria-label={open ? naam : undefined}
      title={open ? naam : undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-veld px-3 text-body font-medium",
        "transition-colors duration-150",
        open ? "justify-center gap-0 bg-vlak-diep px-0 text-inkt" : "text-inkt-zacht hover:bg-vlak hover:text-inkt",
      )}
    >
      <IcoonHoek aria-hidden="true" className="h-5 w-5 shrink-0" />
      {open ? null : <span className="truncate">{naam}</span>}
    </button>
  );
}

/**
 * One destination, in whichever of the shapes the viewport is currently in.
 *
 * `smal` is the `lg` rail: the label is hidden, and the link takes its accessible name from
 * `aria-label` instead. It is set on every tab at once rather than read from the store here, so one
 * subscription drives the whole nav and the tabs stay pure.
 */
function Tab({ bestemming, className, smal }: { bestemming: Bestemming; className?: string; smal?: boolean }) {
  const { pad, labelSleutel, Icoon } = bestemming;

  return (
    <li className={cn("flex-1 lg:flex-none", className)}>
      <NavLink
        to={pad}
        aria-label={smal ? t(labelSleutel) : undefined}
        title={smal ? t(labelSleutel) : undefined}
        className={({ isActive }) =>
          cn(
            "group relative flex min-h-14 flex-col items-center justify-center gap-1 text-micro tracking-normal",
            "lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-veld lg:px-3 lg:text-body lg:font-medium",
            smal && "lg:justify-center lg:gap-0 lg:px-0",
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
            {/* Hidden from `lg` only: the phone bar keeps its labels, because a bottom bar of five
                unlabelled icons is a guessing game and it has the room. */}
            <span className={cn(smal && "lg:hidden")}>{t(labelSleutel)}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}
