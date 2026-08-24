import type { ReactNode } from "react";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * The three shapes a message takes on this screen, kept apart on purpose.
 *
 * A refusal, a warning and a list of notices are not the same thing to the reader: one means nothing
 * happened, one means something will be lost, one means something already was. They get one hue
 * between them (attentie) and are told apart by their heading, because the palette is spent on
 * doelsoort and dekking and a second warning colour here would compete with the signal the tool
 * exists to send.
 */

/** A section on the page. One heading, no explanatory paragraph. */
export function Vak({
  titel,
  merk,
  children,
}: {
  titel: string;
  merk?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-kaart border border-lijn bg-kaart p-4 shadow-licht">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sectie text-inkt">{titel}</h2>
        {merk}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Something went wrong and nothing happened.
 *
 * `tekst` is the server's own sentence when there is one. The backend composes Dutch for what a
 * teacher can act on, and a wrong worksheet or a corrupt workbook is exactly that, so it is rendered
 * verbatim rather than swapped for a generic line that says less.
 */
export function Foutvlak({ titel, tekst }: { titel: string; tekst?: string }) {
  return (
    <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
      <p className="text-body font-medium text-attentie-inkt">{titel}</p>
      {tekst ? <p className="mt-1 text-meta text-attentie-inkt">{tekst}</p> : null}
    </div>
  );
}

/**
 * Dutch notices from the server about content that was read and still dropped.
 *
 * Verbatim, and never summarised into a count: each line names a specific thema, klas or doelcode,
 * and the count alone would leave the reader with no way to find out which.
 */
export function Opmerkingen({ titel, regels }: { titel: string; regels: string[] }) {
  if (regels.length === 0) return null;
  return (
    <div className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
      <p className="text-meta font-medium text-attentie-inkt">{titel}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {regels.map((regel, i) => (
          <li key={`${i}-${regel}`} className="text-meta text-attentie-inkt">
            {regel}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A count with its label, for the diff.
 *
 * The number is the loud part and it is set in the mono face, which is what lets a column of them be
 * compared down the page instead of read one by one.
 */
export function Telling({ label, aantal, stil }: { label: string; aantal: number; stil?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn("mono text-sectie", stil || aantal === 0 ? "text-inkt-zwak" : "text-inkt")}>{aantal}</p>
      <p className="text-micro uppercase text-inkt-zwak">{label}</p>
    </div>
  );
}

/**
 * The first N of a list, with an honest tail line for the rest.
 *
 * The cap exists because a first import of a whole school runs to hundreds of rows and a page that
 * long is a page nobody reads. What it hides it says out loud: a silent truncation reads as "that
 * was everything".
 */
export function Beperkt<T>({
  items,
  hoeveel = 12,
  render,
}: {
  items: T[];
  hoeveel?: number;
  render: (item: T, index: number) => ReactNode;
}) {
  const rest = items.length - hoeveel;
  return (
    <>
      <ul className="flex flex-col gap-1.5">{items.slice(0, hoeveel).map(render)}</ul>
      {rest > 0 ? <p className="mt-2 text-meta text-inkt-zwak">{t("importeren.nogMeer", { aantal: rest })}</p> : null}
    </>
  );
}
