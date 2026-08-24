import { Outlet } from "react-router-dom";
import { Navigatie } from "./Navigatie";
import { t } from "../i18n";

/**
 * The frame every screen sits in.
 *
 * The bottom bar is fixed, so the main region reserves its height plus the safe area; from `lg` the
 * bar becomes a sidebar and the reservation moves to the inline start. Without the reservation the
 * last row of every list sits under the navigation and cannot be tapped, which no test notices.
 */
export function Schil() {
  return (
    <div className="min-h-dvh lg:pl-60">
      {/*
        The skip link is IN THE FLOW when it is focused, not floating over the page: it takes up
        space and pushes the screen down by its own height for as long as it has focus.

        The obvious version puts it at a fixed top-left corner, and that version shipped here and was
        wrong. At every width there is already something in that corner: the page title on a phone,
        and the page title again beside the sidebar on a desktop, where it landed exactly on top of
        "Doelen". Moving it to a different corner only moves the collision. In the flow it can
        collide with nothing at all, at any width, forever.
      */}
      <a
        href="#inhoud"
        className="sr-only focus:not-sr-only focus:m-4 focus:inline-block focus:rounded-veld focus:bg-accent focus:px-4 focus:py-2.5 focus:text-body focus:font-medium focus:text-accent-op"
      >
        {t("app.naarInhoud")}
      </a>

      {/*
        `tabIndex={-1}` so following the link actually MOVES focus here rather than only scrolling.
        Without it the next Tab press returns to the navigation the teacher just asked to skip, which
        makes the link look like it did nothing.
      */}
      <main id="inhoud" tabIndex={-1} className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] outline-none lg:pb-0">
        <Outlet />
      </main>

      <Navigatie />
    </div>
  );
}
