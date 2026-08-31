import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * **When a heading here gets an icon, and when it does not.** The owner asked on 2026-08-31 whether
 * the sections could carry icons. A set of four would have been decoration: THEMADOELEN, SUBTHEMA'S,
 * ACTIVITEITEN and SUBDOELEN are unambiguous Dutch words, each block already carries a figure in the
 * margin as its mark, and this screen's whole problem was chrome outranking content.
 *
 * So an icon marks the two things on this page that are **not the school's own content**: an Op.stap
 * doel, and the AI. That is the constitution's own dividing line (Art. III): decreed, read-only
 * reference data on one side, and thema's, subthema's and activiteiten the school is free to write on
 * the other. Everything a teacher authored stays bare, because it is the norm here and needs no mark;
 * what gets marked is what came from somewhere else.
 *
 * It earns its keep twice over. The target is the same mark as the Doelen destination in the
 * navigation, so a teacher can see that these codes are the same objects as the ones in that
 * register. And it appears identically on themadoelen and on subdoelen, which says "same kind of
 * thing, different level" about the one distinction this screen exists to make legible (Art. IX.2).
 */

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
 * **Each block is a card, and the margin stays outside it** (owner, 2026-08-31: "kan je van de
 * verschillende secties iets meer cards maken, duidelijk opgedeelde cards"). The first version drew
 * the divisions with hairline rules across the full width. Rules divide a page for a reader who is
 * reading it top to bottom; a teacher arrives at this screen to work on one part of it, and for that
 * a boundary you can see the whole of beats a line you have to trace. Keeping the figures out in the
 * page margin rather than inside the card is what stops the card from becoming a header row again,
 * and it leaves the second axis intact: paper panels on the left column of the eye, annotations on
 * the right column of the margin.
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
  acties,
  kaal,
  strak,
  children,
}: {
  /** The block's measure, set large in the mono face: `5`, `L3`, a count. */
  figuur?: ReactNode;
  /** A caption above the figure, when the figure alone would be ambiguous. */
  boven?: string;
  /** A caption below the figure: its unit, or a second small fact. */
  onder?: string;
  /**
   * What acts on this card as a whole, set top right inside it.
   *
   * Bordered controls, deliberately, and the argument is in `Rijknoppen.tsx`: bare is right for a
   * control that repeats down a list and wrong for the single control that owns a card.
   */
  acties?: ReactNode;
  /**
   * No card. For a block that only LABELS the cards under it, such as the heading that introduces
   * the subthema chapters: wrapping a heading and one quiet button in their own panel would put an
   * almost empty card between two full ones.
   */
  kaal?: boolean;
  /** No top margin: this block opens a `Groep`, whose own padding is already the space above it. */
  strak?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn(
      strak ? "" : "mt-4",
      "sm:grid sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-5 lg:grid-cols-[5.5rem_minmax(0,1fr)] lg:gap-x-8",
    )}>
      <div
        className={cn(
          "mb-2 flex items-baseline gap-x-2 sm:mb-0 sm:flex-col sm:items-end sm:gap-x-0 sm:text-right",
          // Lines the figure up with the card's first line of text rather than with its top edge.
          kaal ? "sm:pt-1" : "sm:pt-5",
        )}
      >
        {boven ? (
          <span className="text-micro uppercase tracking-wide text-inkt-zacht">{boven}</span>
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
              <span aria-hidden="true" className="text-inkt-zacht sm:hidden">
                ·
              </span>
            ) : null}
            <span className="text-micro text-inkt-zacht">{onder}</span>
          </>
        ) : null}
      </div>

      <div
        className={cn(
          "min-w-0",
          kaal ? "" : "rounded-kaart border border-lijn bg-kaart p-4 shadow-kaart sm:p-5",
        )}
      >
        {acties ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{children}</div>
            <div className="flex shrink-0 items-center gap-2">{acties}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * A tray holding a heading and the cards it introduces, so the group reads as one thing.
 *
 * **The subthema's needed this and the first version did not give it to them** (owner, 2026-08-31:
 * "ik vind het wat verwarrend dat de subthemas niet een sectie is, zou je een subtiele card kader
 * rond het hele subthema gedoe kunnen trekken zodat het duidelijk is dat dat een geheel is"). Their
 * heading sat bare on the page and each chapter was its own white card, so a screen where every
 * other section was a panel had one section that was a loose label followed by loose panels. It read
 * as three unrelated things.
 *
 * A tray rather than a card, and the difference is the point: a shade DOWN from the page instead of
 * up to paper. Cards on this screen are white and hold content; making the group white too would put
 * paper on paper and cost the chapters their own boundary, which is the thing that just got fixed.
 * A recessed surface holds cards without competing with them, and it stays inside the palette: this
 * is `vlak-diep`, the neutral one shade below the page, not a new hue (Art. XII).
 *
 * It spans the whole fiche, margin included, because the leeftijd of a chapter is part of that
 * chapter and belongs inside the boundary drawn around the group.
 *
 * **This tray is why every label on the fiche is `inkt-zacht` and not `inkt-zwak`.** Measured in a
 * browser with the tint composited, the 11 pixel labels in the margin fell to 4.46:1 the moment they
 * sat on it, which is under the 4.5 AA floor for text that size. They read 4.64 on the page and 4.97
 * on a white card, so the failure only existed on this one surface and only after it was added: the
 * exact shape of bug this project has shipped twice, and the reason contrast here is measured rather
 * than reasoned about. One darker grey for every label removes the dependency on which surface a
 * label happens to land on, and it let the tray get MORE visible rather than less.
 */
export function Groep({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-blad border border-lijn bg-vlak-diep/60 px-3 py-4 sm:px-4 sm:py-5">
      {children}
    </div>
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
  icoon,
  acties,
  children,
}: {
  titel: string;
  /** Only for a section holding Op.stap doelen. See the note at the top of this file. */
  icoon?: ReactNode;
  acties?: ReactNode;
  /** Optional: the "Subthema's" heading introduces chapters that are siblings of its own block. */
  children?: ReactNode;
}) {
  return (
    <>
      <h2 className="flex items-center gap-2 text-meta font-semibold uppercase tracking-wide text-inkt-zacht">
        {icoon}
        {titel}
      </h2>
      {acties ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{acties}</div> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </>
  );
}

/**
 * A heading one rank below `Kop`, for the two lists inside a subthema chapter.
 *
 * Micro against `Kop`'s meta, and a hairline rather than a card. Both differences are deliberate and
 * they say the same thing twice: a CARD is how this fiche divides one section of the document from
 * the next, so a rule is what is left to divide one chapter into its parts. Nesting a card inside a
 * card would flatten that distinction back out.
 */
export function Subkop({
  titel,
  icoon,
  acties,
  children,
}: {
  titel: string;
  /** Only for a section holding Op.stap doelen. See the note at the top of this file. */
  icoon?: ReactNode;
  acties?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-lijn pt-3">
      <h3 className="flex items-center gap-1.5 text-micro uppercase tracking-wide text-inkt-zacht">
        {icoon}
        {titel}
      </h3>
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
      <dt className="text-micro uppercase tracking-wide text-inkt-zacht sm:w-40 sm:shrink-0 sm:pt-1">
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
 * **One frame around the whole list, with the rows divided inside it** (owner, 2026-08-31, about the
 * activiteiten: "zou je de activiteiten volledig kunnen omkaderen ipv wat lijntjes?"). It was a rule
 * above and a rule below, which says "a list starts here and ends here" only if you notice both and
 * connect them. A closed border says it in one glance. Still not one card per row: that was the
 * three-surfaces-deep version this replaced, and it made a page of read-only facts look like a
 * toolbar.
 *
 * The subdoelen get the same frame as the activiteiten even though only the activiteiten were named.
 * They are the same kind of object at the same depth of the same card, and framing one of the two is
 * the sort of near-miss consistency the owner has reported three times.
 */
export function Doellijst({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-lijn overflow-hidden rounded-veld border border-lijn">{children}</ul>
  );
}

export function Doelregel({ children }: { children: ReactNode }) {
  return <li className="flex items-center gap-2 px-3 py-2">{children}</li>;
}
