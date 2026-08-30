import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * The thema fiche: a document with a margin, and the primitives every block on it is built from.
 *
 * **Why this file exists.** Three passes of correcting individual controls left the thema screen
 * still ugly, and the reason was not in the controls: the page had no composition, only a stack.
 * Every object began at the same x, every object was the same width, every gap was the same size,
 * so at 1440 an activiteit holding eight words was a box 1150 pixels wide, and three levels of
 * nesting were expressed by twenty pixels of indent. A stack cannot carry a hierarchy; it can only
 * indent one.
 *
 * **So the page gets a second vertical axis.** A narrow right-aligned margin runs down the left of
 * the whole fiche and carries the block's measure in figures: the thema's five weeks, the count of
 * themadoelen, a subthema's leeftijd and duration. The document itself starts at one hard left edge
 * to the right of it. Two edges facing each other are what makes a page read as designed rather than
 * as a list of things that happen to be stacked, and every one of them is achromatic: the hierarchy
 * here is spent in type, space and division, because Art. XII has already spent the colour.
 *
 * **The margin exists from `sm` up and becomes an eyebrow below it.** At 390 a margin wide enough
 * for the word "subthema's" would take a fifth of the screen and squeeze every activiteit row. On a
 * phone the same three tokens run as one small line above the block, which is the shape that screen
 * already had and that read cleanly.
 */

/**
 * One row of the fiche: its margin, and its content.
 *
 * Every block on the screen is one of these, and they are SIBLINGS rather than nested. A subthema is
 * not a card inside a "Subthema's" section; it is a chapter of the document, hanging off the same
 * axis as the thema's own facts and its doelen. That flatness is what lets a teacher see the level a
 * doel is being hung on, which is the one thing this screen has to make obvious (Art. IX.2).
 */
export function Blok({
  figuur,
  boven,
  onder,
  eerste,
  children,
}: {
  /** The block's measure, set large in the mono face: `5`, `L3`, a count. */
  figuur?: ReactNode;
  /** A caption above the figure, when the figure alone would be ambiguous. */
  boven?: string;
  /** A caption below the figure: its unit, or a second small fact. */
  onder?: string;
  /** The first block carries no rule above it: the screen title is already its boundary. */
  eerste?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "sm:grid sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-5 lg:grid-cols-[5.5rem_minmax(0,1fr)] lg:gap-x-8",
        eerste ? "mt-5" : "mt-7 border-t border-lijn pt-6",
      )}
    >
      <div className="mb-2 flex items-baseline gap-x-2 sm:mb-0 sm:flex-col sm:items-end sm:gap-x-0 sm:pt-1 sm:text-right">
        {boven ? (
          <span className="text-micro uppercase tracking-wide text-inkt-zwak">{boven}</span>
        ) : null}
        {figuur !== undefined ? (
          <span className="mono text-sectie font-medium text-inkt sm:text-hoofdstuk">{figuur}</span>
        ) : null}
        {onder ? (
          <>
            {/* A separator only where the phone line has THREE tokens to keep apart, which is the
                chapter's "Leeftijd L3 2 weken". On the two token blocks it would sit between a
                figure and its own unit and read as punctuation inside "5 weken". Never in the
                margin, where the tokens are already three stacked lines. */}
            {boven ? (
              <span aria-hidden="true" className="text-inkt-zwak sm:hidden">
                ·
              </span>
            ) : null}
            <span className="text-micro text-inkt-zwak">{onder}</span>
          </>
        ) : null}
      </div>

      <div className="min-w-0">{children}</div>
    </section>
  );
}

/**
 * A section heading inside a block, and whatever adds to the section.
 *
 * **The action stays under the heading** (owner, 2026-08-30: "kan je geen plusknop zetten onder de
 * subtitel? ik vind het zo onduidelijk als knop rechts in de subtitel"). What changed is not its
 * place but the thing above it. On the old screen this heading was the faintest line on the page and
 * the outlined button under it was the darkest object, so the chrome outranked the content at every
 * level. The heading is a step up in ink and weight now, and the block carries a figure in the
 * margin beside it, so the button is no longer the only thing with any presence.
 */
export function Kop({
  titel,
  acties,
  children,
}: {
  titel: string;
  acties?: ReactNode;
  /** Optional: the "Subthema's" heading introduces chapters that are siblings of its own block. */
  children?: ReactNode;
}) {
  return (
    <>
      <h2 className="text-meta font-semibold uppercase tracking-wide text-inkt-zacht">{titel}</h2>
      {acties ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{acties}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </>
  );
}

/**
 * A heading one rank below `Kop`, for the two lists inside a subthema chapter.
 *
 * Micro against `Kop`'s meta, and a hairline that runs the width of the content column rather than
 * the width of the fiche. Both differences are deliberate: a rule that spans the margin divides the
 * DOCUMENT, and these divide one chapter of it.
 */
export function Subkop({
  titel,
  acties,
  children,
}: {
  titel: string;
  acties?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-lijn pt-3">
      <h3 className="text-micro uppercase tracking-wide text-inkt-zwak">{titel}</h3>
      {acties ? <div className="mt-2 flex flex-wrap items-center gap-2">{acties}</div> : null}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/**
 * One fact about the thema: a label, and what it says.
 *
 * The labels sit in a column of their own from `sm` up, so the values all start at one edge. On the
 * old screen each label ran directly into its own value, which put four values at four different x
 * positions on four consecutive lines and read as a ransom note. That was the "slordig" complaint in
 * its second form: the first version fixed it with a column so wide that a lone value floated away
 * from its label, and the answer to both is a column sized to the labels this screen actually has.
 *
 * **The labels are left aligned, and that is the second correction rather than an oversight.** Right
 * aligning them put a second right-hand edge directly beside the fiche's margin, so the masthead had
 * three columns where the rest of the page has two and the two label columns read as one muddled
 * zone. Left aligned, they start at exactly the x where THEMADOELEN, SUBTHEMA'S and every chapter
 * title start, which gives the document one left edge from top to bottom.
 *
 * Still a `dl`: these are term and description, and a screen reader should get them paired.
 */
export function Feit({
  label,
  zacht,
  children,
}: {
  label: string;
  zacht?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-x-4 sm:flex-row sm:items-baseline">
      <dt className="text-micro uppercase tracking-wide text-inkt-zwak sm:w-40 sm:shrink-0 sm:pt-1">
        {label}
      </dt>
      <dd className={cn("min-w-0 text-body", zacht ? "text-inkt-zacht" : "text-inkt")}>{children}</dd>
    </div>
  );
}

/** A small remove control for a goal link, sitting next to the code it removes. */
export function Ontkoppel({
  label,
  bezig,
  onClick,
}: {
  label: string;
  bezig?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={bezig}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
    >
      <span aria-hidden="true" className="block h-[1.5px] w-3.5 bg-current" />
    </button>
  );
}

/**
 * A list of goal links: a code, its status, and the control that takes it off.
 *
 * Ruled rows rather than bordered boxes. Each of these used to be its own rounded card on a white
 * card on a grey page, which is three surfaces deep for a line holding a code and a word, and it is
 * why a page of read-only facts looked like a toolbar.
 */
export function Doellijst({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-lijn border-y border-lijn">{children}</ul>;
}

export function Doelregel({ children }: { children: ReactNode }) {
  return <li className="flex items-center gap-2 py-1.5">{children}</li>;
}
