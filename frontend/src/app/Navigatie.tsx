import { useLayoutEffect, type ReactNode, type SVGProps } from "react";
import { NavLink, useMatch } from "react-router-dom";
import { BESTEMMINGEN, ONDERAAN, RAPPORT, type Bestemming } from "./routes";
import { Merk } from "./Merk";
import { Aanmeldregel } from "./Aanmeldregel";
import { IcoonFiche, IcoonHoek } from "../components/Iconen";
import { useHoekenpaneel } from "../state/hoekenpaneel";
import { useActieveSelectie } from "../lib/selectie";
import { useRechten } from "../lib/rechten";
import { useZijkolom } from "./zijkolom";
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
 * and the labels come back as soon as no second column stands beside the navigation.
 *
 * *A phone has no sidebar to collapse, so this is an `lg` behaviour only and the bottom bar is
 * untouched. The panel becomes a sheet there instead; see `Hoekenpaneel`.*
 *
 * **It collapses the same way in Instellingen** (owner, 2026-09-11), whose parts stand in the column
 * the hoekenpaneel would use. Whether either is up is `useZijkolom`'s question rather than this
 * component's, so the rail here and the reservation in `Schil` cannot disagree. The hoekenfiches
 * switch still reads the panel alone, because that is the only thing it switches.
 *
 * **Instellingen is drawn apart from the four (owner, 2026-08-30).** In the sidebar it is pushed to
 * the bottom edge over a rule, because setting the school up is not one of the four things a teacher
 * does all year and a fifth item in the run would read as if it were. On a phone the bottom bar has
 * no bottom to push it to, so it is simply the last tab: five fit, and the alternative is a
 * destination that exists on a laptop and not on a phone.
 *
 * **The ontwikkelingsrapport has a section of its own at the bottom, above Instellingen** (FR-13.10; ADR-0035 R32,
 * D17; owner, 2026-09-15). It takes the push to the bottom edge and a rule of its own, so Instellingen follows it over
 * a second rule and stays last before the sign-in row. It is `lg` only: on a phone the bar keeps its five tabs and the
 * report is reached from the top of Instellingen (`Instellingenindeling`), which is the owner's choice over a sixth tab.
 * It shows to whoever may read a report (D18), and since 2026-09-15 also to a hoofdleerkracht of K3, who may view
 * the K3 set and scale though not the children (owner, after FB-002's antagonist round 1). See
 * `mag.ontwikkelingsrapportTab`.
 *
 * **The hoekenfiches switch lives here from `lg` (owner, 2026-08-31), under the four and over a
 * rule.** It is not a destination and must not read as one, so it is a `button` with `aria-pressed`,
 * it never takes the accent bar that stands for `aria-current`, and its open state is a neutral tint
 * rather than the accent the destinations own. What tells a sighted teacher the panel is open is the
 * panel: 240px of it, immediately to the right of this button. *Below `lg` the switch stays in the
 * agenda toolbar,* because a bottom bar of five tabs has no room for a sixth and the panel has to
 * stay reachable on a phone. One control per viewport, never two at once.
 *
 * **Since 2026-09-14 there are two switches** (owner: "ik wil twee secties in het meest linkse side bar, hoekenfiches
 * en algemene fiches, niet gegroepeerd als fiches"): Hoekenfiches and Algemene fiches, one under the other over the
 * same rule. Both open the same column, each on its own list; see `state/hoekenpaneel.ts`.
 *
 * **Leaving the agenda closes the panel** (owner, 2026-08-31): press a destination and the panel is
 * gone. That reset is not cosmetic. Only `Agendascherm` renders the panel, while the rail here and
 * the inline reservation in `Schil` both follow the store through `useZijkolom`, so without it a teacher who
 * navigated away kept a 56px rail and 296px of reserved width beside a screen with no panel in it.
 *
 * **The switches are only for whoever may plan the klas on screen** (E6-02, ADR-0030 §3, R7), because every fiche in
 * the panel plans a hoek or an algemene fiche, and `Agendascherm` renders no panel for anyone else. For the same reason as the reset
 * above, the panel is closed once the rights and the klas are known and say no: a picker switched to a colleague's
 * klas would otherwise leave the rail and the reservation dressed for a panel that no longer renders.
 */
export function Navigatie() {
  const paneelOpen = useHoekenpaneel((s) => s.open);
  const paneelSoort = useHoekenpaneel((s) => s.soort);
  const zetPaneel = useHoekenpaneel((s) => s.zet);
  const kiesPaneel = useHoekenpaneel((s) => s.kies);
  const smal = useZijkolom();
  const { klasId, laadt: selectieLaadt } = useActieveSelectie();
  const { mag, laadt: rechtenLaden } = useRechten();
  const magPlannen = mag.klasplanningBewerken(klasId);
  const toonRapport = mag.ontwikkelingsrapportTab;

  /*
    The two routes `Agendascherm` answers, and so the only two that mount a hoekenpaneel. Matched as
    route patterns rather than by a `/agenda` prefix on purpose: `/agenda/periodes` is a different
    screen with no panel, and a prefix test would offer the switch there.

    Both matches are read into their own const before they are combined. Inlining them into one `||`
    short-circuits the second hook on the agenda's bare address, which is a rules-of-hooks violation.
  */
  const opStart = useMatch("/agenda");
  const opDag = useMatch("/agenda/dag/:datum");
  const opAgenda = opStart !== null || opDag !== null;

  /*
    `useLayoutEffect` and not `useEffect`: this runs on every navigation away from the agenda, and an
    effect that fires after paint would let one frame through with the rail still collapsed and the
    padding still reserved. Before paint, the browser only ever sees the settled layout.
  */
  const magNiet = !rechtenLaden && !selectieLaadt && !magPlannen;
  useLayoutEffect(() => {
    if ((!opAgenda || magNiet) && paneelOpen) zetPaneel(false);
  }, [opAgenda, magNiet, paneelOpen, zetPaneel]);

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
        smal ? "lg:w-14" : "lg:w-60",
      )}
    >
      {/* The wordmark drops its word in the rail and keeps its bar (owner, 2026-08-31). The box holds
          the same height in both states, because the destinations below it are positioned by it: a
          shorter mark would slide the whole run of icons up as the panel opens. */}
      <div className={cn("hidden h-[4.375rem] lg:flex lg:items-center", smal ? "lg:justify-center" : "lg:px-5")}>
        <Merk compact={smal} />
      </div>

      {/* One list, both groups. The phone bar reads them as one run of tabs; the sidebar pushes the
          second group down with `lg:mt-auto` on its first item, which is why the two are separate
          arrays rather than one with a divider spliced in. */}
      <ul
        className={cn(
          "flex items-stretch lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0.5 lg:pb-4",
          smal ? "lg:px-2" : "lg:px-3",
        )}
      >
        {BESTEMMINGEN.map((bestemming) => (
          <Tab key={bestemming.pad} bestemming={bestemming} smal={smal} />
        ))}

        {/* Only on the routes that have a panel to switch. Never in the bottom bar, hence `hidden`
            with an `lg` opt-in: the phone keeps exactly its five tabs at every route. */}
        {opAgenda && magPlannen ? (
          <li className="hidden lg:mt-2 lg:flex lg:flex-col lg:gap-0.5 lg:border-t lg:border-lijn lg:pt-2">
            <Paneelschakelaar
              naam={t("hoekenpaneel.titel")}
              Icoon={IcoonHoek}
              aan={paneelOpen && paneelSoort === "hoeken"}
              smal={smal}
              onWissel={() => kiesPaneel("hoeken")}
            />
            <Paneelschakelaar
              naam={t("hoekenpaneel.algemeenTitel")}
              Icoon={IcoonFiche}
              aan={paneelOpen && paneelSoort === "algemeen"}
              smal={smal}
              onWissel={() => kiesPaneel("algemeen")}
            />
          </li>
        ) : null}

        {/* From `lg` only, and only for whoever may read a report: the phone keeps its five tabs. */}
        {toonRapport ? (
          <Tab
            bestemming={RAPPORT}
            smal={smal}
            className="hidden lg:mt-auto lg:block lg:border-t lg:border-lijn lg:pt-2"
          />
        ) : null}

        {ONDERAAN.map((bestemming, index) => (
          <Tab
            key={bestemming.pad}
            bestemming={bestemming}
            smal={smal}
            // Only the first of the group takes the rule, so a second settings destination would sit under this one
            // instead of starting a third group. It takes the push to the bottom edge too, unless the report above it
            // already has it: then the two stand together at the bottom, each over its own rule.
            className={
              index === 0
                ? cn(toonRapport ? "lg:mt-2" : "lg:mt-auto", "lg:border-t lg:border-lijn lg:pt-2")
                : undefined
            }
          />
        ))}

        {/* Who is signed in, and signing out (E6-01): below everything a teacher does all year, from
            `lg` only. The phone keeps its five tabs and finds the same row at the foot of
            Instellingen, so each viewport has one way out, never two. The rule belongs to the row
            rather than to this item, so it only appears once there is a name to put under it. */}
        <li className="hidden lg:block">
          <Aanmeldregel smal={smal} className="lg:mt-2 lg:border-t lg:border-lijn lg:pt-2" />
        </li>
      </ul>
    </nav>
  );
}

/**
 * A panel switch (Hoekenfiches, Algemene fiches): the shape of a sidebar item, deliberately not its behaviour.
 *
 * It borrows the geometry of a `Tab` so the sidebar reads as one family: the same height, the same
 * icon size, the same rounding and inset. What it does not borrow is the accent. A destination is
 * marked with `bg-accent-zacht` plus the 2px rule that stands for `aria-current`, and a switch
 * copying either would claim to be a place you are rather than a thing that is on.
 *
 * **Two facts, kept apart since there are two switches.** Whether the label shows follows the rail (`smal`): once
 * either list is open the navigation is 56px wide, so neither switch has room for words and `aria-label` carries
 * them, exactly as the destinations above do. Whether this one is pressed follows its own list (`aan`), so the rail
 * still says which of the two is showing.
 */
function Paneelschakelaar({
  naam,
  Icoon,
  aan,
  smal,
  onWissel,
}: {
  naam: string;
  Icoon: (props: SVGProps<SVGSVGElement>) => ReactNode;
  aan: boolean;
  smal: boolean;
  onWissel: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onWissel}
      aria-pressed={aan}
      aria-label={smal ? naam : undefined}
      title={smal ? naam : undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-veld px-3 text-body font-medium",
        "transition-colors duration-150",
        smal && "justify-center gap-0 px-0",
        aan ? "bg-vlak-diep text-inkt" : "text-inkt-zacht hover:bg-vlak hover:text-inkt",
      )}
    >
      <Icoon aria-hidden="true" className="h-5 w-5 shrink-0" />
      {smal ? null : <span className="truncate">{naam}</span>}
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
