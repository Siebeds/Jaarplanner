import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

/** Shared shell: page content (each page renders its own TopBar) plus the persistent bottom nav. */
export function Layout() {
  return (
    <div className="min-h-dvh pb-24">
      <Outlet />
      <BottomNav />
    </div>
  );
}
