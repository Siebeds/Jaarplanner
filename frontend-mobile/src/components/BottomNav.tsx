import { NavLink } from "react-router-dom";
import { IconDekking, IconDoelen, IconKalender, IconThemas } from "./Icons";
import { cn } from "../lib/utils";

const TABS = [
  { to: "/doelen", label: "Doelen", Icon: IconDoelen },
  { to: "/themas", label: "Thema's", Icon: IconThemas },
  { to: "/kalender", label: "Kalender", Icon: IconKalender },
  { to: "/dekking", label: "Dekking", Icon: IconDekking },
];

/**
 * The four screens the ask names as "belangrijkste functionaliteiten", one thumb-reachable tap
 * away, always visible — the mobile-first alternative to the desktop app's sidebar nav.
 */
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rand bg-surface pb-[env(safe-area-inset-bottom)] shadow-navbar"
      aria-label="Hoofdnavigatie"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex h-touch flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold",
                  isActive ? "text-terra" : "text-ink-zwak",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("h-6 w-6", isActive && "stroke-[2.2]")} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
