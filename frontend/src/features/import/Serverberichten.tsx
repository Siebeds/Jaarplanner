import { t, tAantal, type TranslationKey } from "../../i18n";
import type { SchoolcontentRijProbleem } from "./types";

/**
 * **The one place server-generated Dutch reaches the screen in this feature.** (E1-13, FR-1.2, Art. II.3.)
 *
 * The ratified Art. II.3 amendment of 2026-07-30 permits it: the language of a message follows who it is for,
 * so a per-row import diagnostic naming a row, a column and an offending value is Dutch and may be composed
 * server-side, because no static catalogue can assemble it. What the amendment does **not** license is
 * scattering that rendering. Everything here is deliberately confined to two components so that:
 * - the framing around a raw message stays consistent (a message never appears without a Dutch sentence from
 *   `nl.json` saying what kind of thing the reader is looking at, and what to do about it);
 * - the bounding, the row-0 case and the truncation are decided once rather than per call site;
 * - and if a future ruling ever reverses to the codes-plus-parameters option that Art. II.3 rejected, it is a
 *   change in one file rather than throughout the UI. That was this story's brief before the ruling landed,
 *   and it stays cheap enough to be worth keeping.
 *
 * The Op.stap side has its own rendering in `Opstapimport`, and it must stay separate: its `reden` is English
 * on purpose (an operator diagnostic about the *official* file), so the two cannot share a component without
 * one of them lying about its audience.
 */

/** How many entries a list shows before it collapses the remainder into a count. */
const MAX_REGELS = 30;

/**
 * The per-row problems: what could **not be read** (FR-1.2 clause 2).
 *
 * A `rijNummer` of 0 means the problem belongs to the file rather than to a row — no worksheet, no header
 * row. Printed verbatim that reads "rij 0", which is a lie about a file that has no row 0, so those entries
 * say "in het bestand" instead. Row numbers and the column name are the two things a reader uses to navigate
 * back to Excel, so they lead the line, and the row number is mono: it is an identifier compared character by
 * character.
 */
export function Rijproblemen({ problemen }: { problemen: readonly SchoolcontentRijProbleem[] }) {
  if (problemen.length === 0) {
    return null;
  }

  const getoond = problemen.slice(0, MAX_REGELS);
  const rest = problemen.length - getoond.length;

  return (
    <section className="rounded-md border border-suggestie-geweigerd/30 bg-card p-3.5">
      <h4 className="text-sm font-semibold text-suggestie-geweigerd">
        {tAantal(problemen.length, "import.problemenTitelEnkelvoud", "import.problemenTitel")}
      </h4>
      <p className="mt-1 text-xs leading-snug text-ink-zacht">{t("import.problemenUitleg")}</p>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {getoond.map((probleem, index) => (
          <li
            // Two problems can share a row and a column (a row can fail more than one check), so the index is
            // part of the key by necessity. The list is server-ordered and never reordered here.
            key={`${probleem.rijNummer}-${probleem.kolom ?? ""}-${index}`}
            className="flex flex-col gap-0.5 border-l-2 border-suggestie-geweigerd/40 pl-2.5 text-sm sm:flex-row sm:gap-2"
          >
            <span className="shrink-0 font-mono text-xs font-semibold leading-6 text-ink-zacht" data-cijfers>
              {probleem.rijNummer > 0
                ? t("import.rij", { nummer: probleem.rijNummer })
                : t("import.bestandNiveau")}
              {probleem.kolomLabel ? ` · ${t("import.kolom", { kolom: probleem.kolomLabel })}` : ""}
            </span>
            <span className="min-w-0 text-ink">{probleem.melding}</span>
          </li>
        ))}
      </ul>

      {rest > 0 ? (
        <p className="mt-2 text-xs text-ink-zacht">
          {tAantal(rest, "import.nogMeerEnkelvoud", "import.nogMeer")}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The opmerkingen: what **was** read and still got dropped (FR-1.2 clause 2, the other half).
 *
 * A different thing from a probleem, and the screen must not merge them: a probleem means a row could not be
 * read, an opmerking means it was read and something was lost anyway — an unknown leerplandoel code, a 4th
 * themadoel, a subthema pointing at a klas that does not exist. This list is what turns `isVolledigVerwerkt`
 * false, so it is the evidence behind the second verdict, and it is styled as a warning rather than a fault
 * for the same reason.
 *
 * Used by both importers, because both carry `diff.opmerkingen` as Dutch free text addressed to whoever runs
 * the import.
 */
export function Opmerkingen({
  opmerkingen,
  titelEnkelvoud,
  titel,
}: {
  opmerkingen: readonly string[];
  /** The heading in the singular, because Dutch inflects and one dropped item is the common case. */
  titelEnkelvoud: TranslationKey;
  titel: TranslationKey;
}) {
  if (opmerkingen.length === 0) {
    return null;
  }

  const getoond = opmerkingen.slice(0, MAX_REGELS);
  const rest = opmerkingen.length - getoond.length;

  return (
    <section className="rounded-md border border-attentie/50 bg-attentie-zacht p-3.5">
      <h4 className="text-sm font-semibold text-attentie-ink">
        {tAantal(opmerkingen.length, titelEnkelvoud, titel)}
      </h4>

      <ul className="mt-2 flex flex-col gap-1.5">
        {getoond.map((opmerking, index) => (
          <li
            // The notices are free text with no identity of their own, so the index is the only key available.
            key={`${index}-${opmerking.slice(0, 24)}`}
            className="border-l-2 border-attentie/60 pl-2.5 text-sm leading-snug text-ink"
          >
            {opmerking}
          </li>
        ))}
      </ul>

      {rest > 0 ? (
        <p className="mt-2 text-xs text-attentie-ink">
          {tAantal(rest, "import.nogMeerEnkelvoud", "import.nogMeer")}
        </p>
      ) : null}
    </section>
  );
}
