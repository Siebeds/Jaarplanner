import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Katmand } from "../features/kat/Katmand";
import { cn } from "../lib/cn";
import { useSchermtitel } from "../lib/useSchermtitel";

const MAAT = "max-w-[80rem]";
const BREED = "max-w-[104rem]";
/**
 * A document measure, for a screen whose content is prose and lists rather than columns.
 *
 * It exists because the thema fiche looked off centre and was (owner, 2026-08-31: "ligt het aan mij
 * of staat het scherm niet helemaal centraal?"). That screen keeps its own 54rem measure so its rows
 * stop stretching to the width of the window, but it was doing so INSIDE the default 80rem, which is
 * left aligned. On a 1900 pixel window that left a 128 pixel gap on one side and 540 on the other,
 * and the eye reads the bigger gap as a mistake rather than as a margin.
 *
 * The fix belongs here rather than an `mx-auto` on the screen's own wrapper: centring the body alone
 * would leave the title behind at the old left edge, and the title lining up with the fiche's margin
 * is what makes the whole thing read as one column. One measure, applied to the header and the body
 * together, is what a page IS.
 */
const SMAL = "max-w-[57.5rem]";

/**
 * The title row of a screen.
 *
 * Sticky, and the blur is what makes it work: content scrolling under a solid bar looks like it is
 * being erased, where content scrolling under a blurred one looks like it is passing behind. The
 * title is the only place the display face is used at size, which is what makes it read as a
 * heading without needing a rule under it.
 */
export function Schermkop({
  titel,
  icoon,
  boven,
  kruimelpad,
  rechts,
  onder,
  breed,
  smal,
  zonderKat,
}: {
  titel: string;
  /** An emoji before the title, decorative (a thema's, FB-060). */
  icoon?: string | null;
  boven?: string;
  /** Where this screen sits, above the title in place of `boven`: "Thema's / Herfst" (FB-094). */
  kruimelpad?: ReactNode;
  rechts?: ReactNode;
  onder?: ReactNode;
  breed?: boolean;
  /** A document measure, centred rather than left aligned. See `SMAL`. */
  smal?: boolean;
  /** No Chuck on this screen: the ontwikkelingsrapport carries no cat (FB-071, ADR-0059 D7). */
  zonderKat?: boolean;
}) {
  const meet = breed ? BREED : smal ? SMAL : MAAT;
  const kop = useRef<HTMLElement>(null);
  useSchermtitel(titel);
  useKopruimte(kop);
  return (
    <header ref={kop} className="sticky top-0 z-20 bg-vlak/85 backdrop-blur-md">
      {/* A grid, so Chuck can stand beside the whole header rather than stick out above it: from `sm` he spans the
          title and the rows under it, his top level with the title's. On a phone the rows under the title
          need the full width, so there he stays beside the title. */}
      <div
        className={cn(
          "mx-auto grid gap-y-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 lg:pt-8",
          zonderKat ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_auto] gap-x-6",
          meet,
        )}
      >
        <div className="col-start-1 row-start-1 flex min-w-0 items-end justify-between gap-3 self-end">
          <div className="min-w-0">
            {/* An eyebrow, not a longer title: "1 sep - 1 okt" says WHEN and not WHAT, and a teacher
                deep in a week needs to be told which period those dates belong to. */}
            {kruimelpad ? (
              <div className="mb-1.5">{kruimelpad}</div>
            ) : boven ? (
              <p className="text-micro uppercase text-inkt-zwak">{boven}</p>
            ) : null}
            <h1 className="font-display text-scherm text-inkt sm:text-[2rem]">
              {icoon ? (
                <span aria-hidden="true" className="mr-[0.3em]">
                  {icoon}
                </span>
              ) : null}
              {titel}
            </h1>
          </div>
          {/* On a phone the screen's control gives up its width before the title does: it truncates, the title stays. */}
          {rechts ? <div className={cn("flex min-w-0 shrink-[8]", !zonderKat && "pb-1")}>{rechts}</div> : null}
        </div>
        {zonderKat ? null : (
          // Chuck lies at the right, after whatever the screen puts there (FB-071, ADR-0059 K4), with what he says
          // above or under him.
          <div className={cn("col-start-2 row-start-1 self-start", onder && "sm:row-span-2")}>
            <Katmand />
          </div>
        )}
        {onder ? (
          <div className={cn("row-start-2 min-w-0", zonderKat ? "col-start-1" : "col-span-2 sm:col-span-1")}>{onder}</div>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Keeps a focused field out from under the sticky header (WCAG 2.4.11).
 *
 * The page scrolls the document, and the browser scrolls a field that receives focus only just into view: tabbing back
 * up, that is under the header. `scroll-padding-top` on the document tells it where the view really starts. It is
 * measured rather than fixed, because the header grows with its `onder` row, with a wrapping title on a phone and with
 * the safe area, and a fixed guess is exactly one of those short.
 */
function useKopruimte(kop: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = kop.current;
    if (!element) return;
    const wortel = document.documentElement;
    const zet = () => {
      // A little air under the header, so the focus ring of the field is not flush against it.
      wortel.style.scrollPaddingTop = `${element.offsetHeight + 8}px`;
    };
    zet();
    // jsdom has no ResizeObserver; the first measurement above is then all there is.
    const waarnemer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(zet);
    waarnemer?.observe(element);
    return () => {
      waarnemer?.disconnect();
      wortel.style.scrollPaddingTop = "";
    };
  }, [kop]);
}

/**
 * The body of a screen, on the same measure as the header above it.
 *
 * `breed` widens both. The default measure keeps prose and lists readable; a week of seven day
 * columns is the opposite problem, where the reading unit is the column and the leftover margin on a
 * wide screen is width the calendar could have used.
 */
export function Schermvlak({
  children,
  breed,
  smal,
}: {
  children: ReactNode;
  breed?: boolean;
  /** A document measure, centred rather than left aligned. See `SMAL`. */
  smal?: boolean;
}) {
  return (
    <div className={cn("mx-auto px-4 pb-16 sm:px-6", breed ? BREED : smal ? SMAL : MAAT)}>
      {children}
    </div>
  );
}
