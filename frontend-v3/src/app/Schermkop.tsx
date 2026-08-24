import type { ReactNode } from "react";

/**
 * The title row of a screen.
 *
 * Sticky, and the blur is what makes it work: content scrolling under a solid bar looks like it is
 * being erased, where content scrolling under a blurred one looks like it is passing behind. The
 * title is the only place the display face is used at size, which is what makes it read as a
 * heading without needing a rule under it.
 */
export function Schermkop({ titel, rechts, onder }: { titel: string; rechts?: ReactNode; onder?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-vlak/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[80rem] items-end justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 lg:pt-8">
        <h1 className="font-display text-scherm text-inkt sm:text-[2rem]">{titel}</h1>
        {rechts}
      </div>
      {onder ? <div className="mx-auto max-w-[80rem] px-4 pb-3 sm:px-6">{onder}</div> : null}
    </header>
  );
}

/** The body of a screen, on the same measure as the header above it. */
export function Schermvlak({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[80rem] px-4 pb-16 sm:px-6">{children}</div>;
}
