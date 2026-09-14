import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { Aanmeldregel } from "../../app/Aanmeldregel";
import { Schermvlak } from "../../app/Schermkop";
import { IcoonKruis } from "../../components/Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { padVan, useZichtbareOnderdelen } from "./onderdelen";

/**
 * The frame of Instellingen: its parts in a column of their own from `lg`, and the part itself.
 *
 * **The column is the hoekenpaneel's shape on purpose** (owner, 2026-09-11: "zoals we switchen bij
 * de hoekenfiches"). The navigation collapses to its rail and the parts take the 240px the labels
 * were using, so the app's one way of opening a second column is the same everywhere. Unlike the
 * hoekenpaneel it has no switch: it is not something the teacher opened, it is where she is, and it
 * goes when she leaves Instellingen. `useZijkolom` is what tells `Navigatie` and `Schil` to make room
 * for it.
 *
 * **It does have the hoekenpaneel's cross** (owner, 2026-09-11: "terug in het default scherm
 * agenda"). The agenda became the app's start route on the same day (`App.tsx`), so the cross and
 * a fresh visit land on the same screen. Closing this column means leaving Instellingen, so the
 * cross is a link rather than a button: it changes the address, and it gets the middle-click and
 * the link semantics that come with that. Same size and
 * rounding as the panel's, in the same corner, so the two read as one control; it sits a few pixels
 * higher than the panel's because this header lines up with the wordmark in the rail.
 *
 * **Its items are destinations and are marked like the main navigation's**: `aria-current`, the
 * accent tint and the 2px rule on the leading edge. That is one of the accent's five uses (active
 * destination), not a sixth.
 *
 * Before the page in the DOM, so a keyboard user who skipped to the content reaches the other parts
 * in two presses rather than after every control on the page.
 *
 * **It lists only the parts this person may see** (E6-04): Gebruikers is directie only, so for
 * anyone else it is not in the column and not in the phone switch. Both read
 * `useZichtbareOnderdelen`, so they cannot disagree.
 */
export function Instellingenindeling() {
  const onderdelen = useZichtbareOnderdelen();
  return (
    <>
      <nav
        aria-labelledby="instellingen-kolom"
        className="fixed inset-y-0 left-14 z-20 hidden w-60 flex-col border-r border-lijn bg-kaart lg:flex"
      >
        {/* The height of the wordmark's box in the rail beside it, so the label lines up with the
            mark and the first item with the first destination. The label is a paragraph and not a
            heading: the page's h1 comes after this in the DOM, and a heading here would put an h2
            before it. */}
        <div className="flex h-[4.375rem] shrink-0 items-center justify-between gap-2 pl-5 pr-3">
          <p id="instellingen-kolom" className="font-display text-sectie text-inkt">
            {t("instellingen.titel")}
          </p>
          <Link
            to="/agenda"
            aria-label={t("instellingen.sluiten")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
          >
            <IcoonKruis aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <ul className="flex flex-col gap-0.5 px-3">
          {onderdelen.map((onderdeel) => (
            <li key={onderdeel.deel}>
              <NavLink
                to={padVan(onderdeel.deel)}
                className={({ isActive }) =>
                  cn(
                    "relative flex min-h-11 items-center rounded-veld px-3 text-body font-medium transition-colors duration-150",
                    isActive ? "bg-accent-zacht text-accent" : "text-inkt-zacht hover:bg-vlak hover:text-inkt",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-accent transition-opacity duration-150",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {t(onderdeel.labelSleutel)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />

      {/* Who is signed in, and signing out, below `lg` only (E6-01). A phone's bottom bar has no room
          for a sixth tab and no sidebar to put this in, so it sits at the foot of Instellingen; from
          `lg` the sidebar carries it instead, so a viewport never offers two ways out. In a
          `Schermvlak` of its own so it takes the page's gutter and measure. */}
      <div className="lg:hidden">
        <Schermvlak smal>
          <Aanmeldregel className="border-t border-lijn pt-2" />
        </Schermvlak>
      </div>
    </>
  );
}

/**
 * The same parts below `lg`, where there is no column to put them in: a row of links under the
 * page title, drawn like `Segment` because it answers the same question ("which of these am I
 * looking at").
 *
 * Links and not `Segment` itself: that is a radiogroup that changes what one screen lists, and these
 * change the address. It scrolls sideways rather than wrapping once the parts outgrow a phone.
 *
 * **It gives focus back after a switch.** Each part renders its own copy in its own header, so
 * pressing the other part unmounts the link that had focus and the browser drops focus to the top of
 * the document: on screen the switch has not moved, while a keyboard or screen reader user starts
 * over. The link says it came from here through router state, and the copy on the new page focuses
 * its active link, on that navigation only: never on a reload or on back/forward. The column needs
 * none of this, because it lives in the frame and stays mounted.
 *
 * Hidden from `lg` with `lg:hidden`, which is `display: none`, so the column and this row are never
 * in the accessibility tree together although both carry the same name.
 */
export function Onderdeelwissel() {
  const { pathname, state } = useLocation();
  const navigatietype = useNavigationType();
  const lijst = useRef<HTMLUListElement>(null);
  // A PUSH or REPLACE only. `BrowserRouter` keeps router state in `history.state`, which survives a
  // reload and comes back on back/forward (both POP); acting on it there would pull focus into this
  // row on page load, past the skip link and the navigation.
  const vanWissel = navigatietype !== "POP" && (state as { vanWissel?: boolean } | null)?.vanWissel === true;
  const onderdelen = useZichtbareOnderdelen();

  useEffect(() => {
    // The link NavLink itself marked active, rather than one matched here by string: a trailing
    // slash matches the route while failing a `pathname === pad` test, and that loss would be silent.
    if (vanWissel) lijst.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')?.focus();
  }, [vanWissel, pathname]);

  return (
    <nav aria-label={t("instellingen.titel")} className="lg:hidden">
      <ul ref={lijst} className="inline-flex max-w-full overflow-x-auto rounded-veld border border-lijn bg-vlak-diep p-1">
        {onderdelen.map((onderdeel) => {
          const pad = padVan(onderdeel.deel);
          return (
            <li key={onderdeel.deel} className="shrink-0">
              <NavLink
                to={pad}
                state={{ vanWissel: true }}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-9 items-center whitespace-nowrap rounded-[0.5rem] border px-3 text-meta font-medium transition-colors duration-150",
                    isActive
                      ? "border-lijn-sterk bg-kaart text-inkt shadow-licht"
                      : "border-transparent text-inkt-zacht hover:text-inkt",
                  )
                }
              >
                {t(onderdeel.labelSleutel)}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
