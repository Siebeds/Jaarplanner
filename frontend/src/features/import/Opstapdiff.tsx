import { useId } from "react";

import { t, tAantal } from "../../i18n";
import type { OpstapHerimportDiff } from "./types";

/**
 * The FR-2.5 review report for one discipline (E1-13 clause 6): what a re-import of the official Op.stap file
 * adds, changes, leaves alone, and no longer contains.
 *
 * **`ongewijzigd` is a count and never a list**, exactly as on the school-content side. A real discipline file
 * holds hundreds to thousands of goals and a re-import changes a handful, so listing the unchanged ones buries
 * the answer. `toegevoegd` and `gewijzigd` are listed, bounded, with the changed goals showing their old and new
 * field values: "NC-1.1 gewijzigd" is not something a directie member can review.
 *
 * **The disappearances get their own notice, and it is scoped to this run.** See {@link Verdwenen} for the trap
 * that shapes it.
 */

/** How many entries a list shows before it collapses the remainder into a count. */
const MAX_REGELS = 20;

export function Opstapdiff({
  diff,
  toegepast,
}: {
  diff: OpstapHerimportDiff;
  /** Whether this describes what happened or what would happen. Only the tense depends on it. */
  toegepast: boolean;
}) {
  const tellingen = [
    { aantal: diff.toegevoegd.length, woord: t("import.soort.toegevoegd") },
    { aantal: diff.gewijzigd.length, woord: t("import.soort.gewijzigd") },
    { aantal: diff.ongewijzigd.length, woord: t("import.soort.ongewijzigd") },
  ].filter((telling) => telling.aantal > 0);

  const toegevoegd = diff.toegevoegd.slice(0, MAX_REGELS);
  const gewijzigd = diff.gewijzigd.slice(0, MAX_REGELS);

  return (
    <section className="rounded-md border border-border bg-card p-3.5">
      <h4 className="text-sm font-semibold text-ink">
        {t(toegepast ? "import.opstap.diffTitelGedaan" : "import.opstap.diffTitel", {
          discipline: diff.disciplineNummer,
        })}
      </h4>

      {diff.overgeslagen ? (
        <p className="mt-1.5 text-sm font-medium text-attentie-ink">
          {t(toegepast ? "import.diffOvergeslagenGedaan" : "import.diffOvergeslagen")}
        </p>
      ) : diff.isLeeg ? (
        <p className="mt-1.5 text-sm text-ink-zacht">{t("import.opstap.diffOngewijzigd")}</p>
      ) : null}

      {tellingen.length > 0 ? (
        <p className="mt-1.5 text-sm text-ink-zacht" data-cijfers>
          {tellingen
            .map((telling) => t("import.telling", { aantal: telling.aantal, soort: telling.woord }))
            .join(" · ")}
        </p>
      ) : null}

      {toegevoegd.length > 0 ? (
        <div className="mt-2.5">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
            {t("import.opstap.toegevoegdTitel")}
          </h5>
          {/* Codes only, in mono, wrapped as chips: an added goal has no old value to compare, and its full
              text belongs on the Doelen screen (E1-16) rather than duplicated here. */}
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-xs text-ink" data-cijfers>
            {toegevoegd.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </p>
          {diff.toegevoegd.length > toegevoegd.length ? (
            <p className="mt-1 text-xs text-ink-zacht">
              {tAantal(
                diff.toegevoegd.length - toegevoegd.length,
                "import.nogMeerEnkelvoud",
                "import.nogMeer",
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      {gewijzigd.length > 0 ? (
        <div className="mt-3">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
            {t("import.opstap.gewijzigdTitel")}
          </h5>
          <ul className="mt-1 flex flex-col gap-2">
            {gewijzigd.map((wijziging) => (
              <li key={wijziging.code} className="text-sm">
                <span className="font-mono text-xs font-semibold text-ink" data-cijfers>
                  {wijziging.code}
                </span>
                <ul className="mt-0.5 flex flex-col gap-0.5 pl-3">
                  {wijziging.velden.map((veld) => (
                    <li key={veld.veld} className="text-xs leading-snug text-ink-zacht">
                      {/* The field name is a model identifier and is shown as one; only the school's own
                          beheerder ever reads this, and inventing a Dutch label per column would be a second
                          copy of the Op.stap mapping in the frontend (Art. III.3, VII.1). */}
                      <span className="font-mono text-ink">{veld.veld}</span>{" "}
                      {t("import.opstap.veldWijziging", {
                        oud: veld.oudeWaarde ?? t("import.opstap.veldLeeg"),
                        nieuw: veld.nieuweWaarde ?? t("import.opstap.veldLeeg"),
                      })}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {diff.gewijzigd.length > gewijzigd.length ? (
            <p className="mt-1 text-xs text-ink-zacht">
              {tAantal(
                diff.gewijzigd.length - gewijzigd.length,
                "import.nogMeerEnkelvoud",
                "import.nogMeer",
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The goals this file no longer contains (Art. III.4, FR-2.5).
 *
 * **This is where the story's second trap lives, so the reasoning is written down.** E1-15 handed over
 * `diff.vereistReview` as "the flag to key the notice on", and this component deliberately does **not** key on
 * it. Two reasons:
 *
 * 1. **It never clears.** `vereistReview` is true whenever `verdwenen`/`verdwenenMaarGekoppeld` is non-empty,
 *    and a flag-and-keep goal stays absent from every later file, so once a discipline has lost a goal every
 *    future re-import reports it again. Keyed to a standing, undismissable "te herzien" banner that is the
 *    E3-09 mistake in another flow.
 * 2. **It is also true for an ordinary change.** A reworded goal sets it, so a notice about *disappearances*
 *    keyed on it would fire when nothing disappeared.
 *
 * So the notice is derived from the two arrays and **scoped to the run in front of the reader**: it appears in
 * the result of the check or the import they just ran, it disappears the moment they pick another file, and its
 * copy says "bij deze inlezing" rather than asserting a durable state of the curriculum. Nothing is persisted
 * and no acknowledgement is invented: a *durable* "reviewed and accepted" state needs storage and therefore a
 * decision (Art. XIV), which is raised in the worklog rather than answered here.
 *
 * A `region` with a small `status` line, not one big `alert`: the same treatment as `TeHerzien` (E3-07) and the
 * threatened-decisions block, so a live region never wraps a control.
 */
export function Verdwenen({ diff }: { diff: OpstapHerimportDiff }) {
  const titelId = useId();
  const aantal = diff.verdwenen.length + diff.verdwenenMaarGekoppeld.length;

  if (aantal === 0) {
    return null;
  }

  const titel = tAantal(aantal, "import.opstap.verdwenenTitelEnkelvoud", "import.opstap.verdwenenTitel");

  return (
    <section
      role="region"
      aria-labelledby={titelId}
      className="rounded-md border border-attentie bg-attentie-zacht p-3.5"
    >
      <p role="status" className="sr-only">
        {titel}
      </p>
      <h4 id={titelId} className="text-sm font-semibold text-attentie-ink">
        <span aria-hidden="true">▲</span> {titel}
      </h4>
      <p className="mt-1 text-xs leading-snug text-attentie-ink">
        {t("import.opstap.verdwenenUitleg")}
      </p>

      <ul className="mt-2.5 flex flex-col gap-1">
        {/* The still-linked ones first: they are the ones a human has to decide about, because school content
            points at them (Art. IV.2). The others are only informative. */}
        {diff.verdwenenMaarGekoppeld.map((doel) => (
          <li key={doel.code} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-mono text-xs font-semibold text-ink" data-cijfers>
              {doel.code}
            </span>
            <span className="text-xs text-ink">
              {tAantal(
                doel.aantalKoppelingen,
                "import.opstap.verdwenenKoppelingenEnkelvoud",
                "import.opstap.verdwenenKoppelingen",
              )}
            </span>
          </li>
        ))}
        {diff.verdwenen.map((code) => (
          <li key={code} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-mono text-xs font-semibold text-ink" data-cijfers>
              {code}
            </span>
            <span className="text-xs text-ink-zacht">{t("import.opstap.verdwenenOngekoppeld")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
