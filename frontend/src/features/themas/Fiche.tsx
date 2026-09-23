import type { ReactNode } from "react";
import { IcoonChevron } from "../../components/Iconen";
import { cn } from "../../lib/cn";

/**
 * The thema page's primitives (FB-094).
 *
 * **The page reads top to bottom in the order a teacher uses it**: the kop and what the thema is, then its subthema's,
 * then its doelen. Each of the two main sections has a real heading in the display face; everything under it is a
 * sentence-case label, a step down in size and ink. The figures sit once, in one line under the title, instead of in a
 * margin beside every block, so no count appears twice.
 *
 * **An icon marks what is not the school's own content**: an Op.stap doel (the target), and the AI (the wand). What a
 * teacher authored stays bare (Art. III).
 */

/** One of the page's main sections: a heading in the display face, and what adds to it on the same line. */
export function Sectie({
  id,
  titel,
  onder,
  acties,
  children,
}: {
  /** The heading's id, which names the section for a screen reader. */
  id: string;
  titel: string;
  /** One quiet line under the heading. */
  onder?: ReactNode;
  acties?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-10 flex flex-col gap-4 sm:mt-12">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className="font-display text-hoofdstuk text-inkt">
            {titel}
          </h2>
          {onder ? <div className="mt-1 text-meta text-inkt-zacht">{onder}</div> : null}
        </div>
        {acties ? <div className="flex flex-wrap items-center gap-2">{acties}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** The white card a group of content sits on. */
export function Kaart({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 rounded-kaart border border-lijn bg-kaart shadow-kaart", className)}>{children}</div>
  );
}

/**
 * A small heading inside an opened subthema: the onderzoeksvraag, the woordweb, the activiteiten. Sentence case in the
 * quiet ink, so it labels what follows without competing with the subthema's own name.
 */
export function Subkop({
  titel,
  icoon,
  acties,
  children,
}: {
  titel: string;
  /** Only for a section holding Op.stap doelen. */
  icoon?: ReactNode;
  acties?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h5 className="flex items-center gap-1.5 text-meta font-semibold text-inkt-zacht">
          {icoon}
          {titel}
        </h5>
        {acties ? <div className="flex flex-wrap items-center gap-2">{acties}</div> : null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * The fold arrow, LEFT of what it opens, everywhere on the page (FB-094): pointing right while shut, down once open.
 * Decorative: the button around it carries `aria-expanded`, which is what a screen reader announces.
 */
export function Vouwpijl({ open, className }: { open: boolean; className?: string }) {
  return (
    <IcoonChevron
      aria-hidden="true"
      className={cn(
        "h-5 w-5 shrink-0 text-inkt-zacht transition-transform duration-200 motion-reduce:transition-none",
        !open && "-rotate-90",
        className,
      )}
    />
  );
}

/**
 * One fact about something: a label, and what it says. Still a `dl` row, so a screen reader gets them paired. Used by
 * the activiteit sheet.
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

/** A small remove control for a goal link, sitting next to the code it removes. 44 pixels on a phone, 32 from `sm`. */
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
      className="inline-flex h-raak w-raak shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt disabled:opacity-45 sm:h-8 sm:w-8"
    >
      <span aria-hidden="true" className="block h-[1.5px] w-3.5 bg-current" />
    </button>
  );
}

/** A list of goal links in one frame, the rows divided inside it. */
export function Doellijst({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-lijn overflow-hidden rounded-veld border border-lijn">{children}</ul>
  );
}
