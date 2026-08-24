import type { ReactNode } from "react";
import { cn } from "../lib/cn";

const MAAT = "max-w-[80rem]";
const BREED = "max-w-[104rem]";

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
  boven,
  rechts,
  onder,
  breed,
}: {
  titel: string;
  boven?: string;
  rechts?: ReactNode;
  onder?: ReactNode;
  breed?: boolean;
}) {
  const meet = breed ? BREED : MAAT;
  return (
    <header className="sticky top-0 z-20 bg-vlak/85 backdrop-blur-md">
      <div
        className={cn(
          "mx-auto flex items-end justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 lg:pt-8",
          meet,
        )}
      >
        <div className="min-w-0">
          {/* An eyebrow, not a longer title: "1 sep - 1 okt" says WHEN and not WHAT, and a teacher
              deep in a week needs to be told which period those dates belong to. */}
          {boven ? <p className="text-micro uppercase text-inkt-zwak">{boven}</p> : null}
          <h1 className="font-display text-scherm text-inkt sm:text-[2rem]">{titel}</h1>
        </div>
        {rechts}
      </div>
      {onder ? <div className={cn("mx-auto px-4 pb-3 sm:px-6", meet)}>{onder}</div> : null}
    </header>
  );
}

/**
 * The body of a screen, on the same measure as the header above it.
 *
 * `breed` widens both. The default measure keeps prose and lists readable; a week of seven day
 * columns is the opposite problem, where the reading unit is the column and the leftover margin on a
 * wide screen is width the calendar could have used.
 */
export function Schermvlak({ children, breed }: { children: ReactNode; breed?: boolean }) {
  return <div className={cn("mx-auto px-4 pb-16 sm:px-6", breed ? BREED : MAAT)}>{children}</div>;
}
