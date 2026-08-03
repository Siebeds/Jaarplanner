import { t, tAantal, type TranslationKey } from "../../i18n";
import type {
  ActiviteitWijziging,
  SchoolcontentImportDiff,
  SubthemaWijziging,
  ThemaWijziging,
  WijzigingSoort,
} from "./types";

/**
 * What an import does, or did, per level (E1-13 clause 4, FR-1.3).
 *
 * **`Ongewijzigd` is the majority and the least interesting**, so it is a count and never a list. A
 * re-import of a school's own file is mostly unchanged rows; listing hundreds of them above the two that
 * changed buries the answer the reader came for. The changed entries *are* listed, bounded (see
 * {@link MAX_REGELS}), because "3 subthema's bijgewerkt" without their names is not reviewable.
 *
 * **No colour for `Toegevoegd`/`Bijgewerkt`/`Ongewijzigd`.** Art. XII already spends six hues on doelsoort
 * plus more on suggestiestatus and dekking; a fourth categorical set would compete with the signal this tool
 * exists to send. They are distinguished by weight, a sign and the word itself, which also means they survive
 * a print-out and a colour-blind reader (Art. XII, WCAG 2.2 AA).
 *
 * **The mode is stated here, from the response** rather than from the form's state. They should agree, and
 * reading the response is what makes that observable instead of assumed.
 */

/** How many changed entries one level lists before collapsing the remainder into a count. */
const MAX_REGELS = 20;

/** The Dutch word per level, and the singular/plural pair for its count. */
const NIVEAULABEL: Record<"themas" | "subthemas" | "activiteiten", TranslationKey> = {
  themas: "import.niveau.themas",
  subthemas: "import.niveau.subthemas",
  activiteiten: "import.niveau.activiteiten",
};

/**
 * The bare Dutch word per change kind.
 *
 * Bare on purpose: a count is rendered through `import.telling` (`"{aantal} {soort}"`), which keeps the word
 * order in the catalogue while needing only **one** count string for three kinds. All three are participles
 * and do not inflect with the number, so "1 toegevoegd" and "9 toegevoegd" are both correct Dutch; that is the
 * documented reason `import.telling` is exempt from the singular-form guard in `catalogus.test.ts`.
 */
const SOORTWOORD: Record<WijzigingSoort, TranslationKey> = {
  Toegevoegd: "import.soort.toegevoegd",
  Bijgewerkt: "import.soort.bijgewerkt",
  Ongewijzigd: "import.soort.ongewijzigd",
};

/** The sign beside a changed entry. Redundant with the word next to it, on purpose. */
const SOORTTEKEN: Record<WijzigingSoort, string> = {
  Toegevoegd: "+",
  Bijgewerkt: "~",
  Ongewijzigd: "=",
};

export function Schoolcontentdiff({
  diff,
  toegepast,
}: {
  diff: SchoolcontentImportDiff;
  /**
   * Whether this diff describes what **happened** or what **would** happen.
   *
   * It only changes tense, and that is not cosmetic: a preview heading reading "Wat er is toegevoegd" claims an
   * import nobody has confirmed. Passed in from the response's own `toegepast` rather than inferred from the
   * mutation that produced it.
   */
  toegepast: boolean;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-3.5">
      <h4 className="text-sm font-semibold text-ink">
        {t(
          diff.modus === "Bijwerken"
            ? toegepast
              ? "import.diffTitelBijwerkenGedaan"
              : "import.diffTitelBijwerken"
            : toegepast
              ? "import.diffTitelToevoegenGedaan"
              : "import.diffTitelToevoegen",
        )}
      </h4>

      {/* A skipped import and an import that changes nothing are different facts, and both need saying out
          loud: the first means the file was unusable, the second means the file matches what is already
          there. Left implicit, both render as three lines of zeros that read like a bug.

          `diffOngewijzigd` names the three content levels rather than saying "niets aan wat er al staat",
          because `isLeeg` is computed from those three only. Seen in the browser beside a non-empty
          `bedreigdeBeslissingen`, the broader sentence read as "nothing at all will change" while two teacher
          decisions were at stake one panel below. */}
      {diff.overgeslagen ? (
        <p className="mt-1.5 text-sm font-medium text-attentie-ink">
          {t(toegepast ? "import.diffOvergeslagenGedaan" : "import.diffOvergeslagen")}
        </p>
      ) : diff.isLeeg ? (
        <p className="mt-1.5 text-sm text-ink-zacht">{t("import.diffOngewijzigd")}</p>
      ) : null}

      <div className="mt-2.5 flex flex-col gap-3">
        <Niveau
          niveau="themas"
          regels={diff.themas}
          naam={(wijziging: ThemaWijziging) => wijziging.naam}
          context={() => null}
        />
        <Niveau
          niveau="subthemas"
          regels={diff.subthemas}
          naam={(wijziging: SubthemaWijziging) => wijziging.naam}
          // A subthema belongs to one klas and one leeftijd (Art. IX.2), and its identity in the diff includes
          // both. Two rows reading "Bladeren, bijgewerkt" for two different classes would be indistinguishable.
          context={(wijziging: SubthemaWijziging) =>
            t("import.subthemaContext", {
              thema: wijziging.themaNaam,
              klas: wijziging.klas,
              leeftijd: wijziging.leeftijd,
            })
          }
        />
        <Niveau
          niveau="activiteiten"
          regels={diff.activiteiten}
          naam={(wijziging: ActiviteitWijziging) => wijziging.naam}
          context={(wijziging: ActiviteitWijziging) =>
            t("import.activiteitContext", {
              thema: wijziging.themaNaam,
              subthema: wijziging.subthemaNaam,
            })
          }
        />
      </div>
    </section>
  );
}

/** One level: its counts, always complete, and its changed entries, bounded. */
function Niveau<T extends { soort: WijzigingSoort }>({
  niveau,
  regels,
  naam,
  context,
}: {
  niveau: keyof typeof NIVEAULABEL;
  regels: readonly T[];
  naam: (regel: T) => string;
  context: (regel: T) => string | null;
}) {
  const gewijzigd = regels.filter((regel) => regel.soort !== "Ongewijzigd");
  const getoond = gewijzigd.slice(0, MAX_REGELS);
  const rest = gewijzigd.length - getoond.length;

  const tellingen = (["Toegevoegd", "Bijgewerkt", "Ongewijzigd"] as const)
    .map((soort) => ({ soort, aantal: regels.filter((regel) => regel.soort === soort).length }))
    .filter((telling) => telling.aantal > 0);

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold text-ink">{t(NIVEAULABEL[niveau])}</span>
        {tellingen.length === 0 ? (
          <span className="text-ink-zacht">{t("import.niveauLeeg")}</span>
        ) : (
          <span className="text-ink-zacht" data-cijfers>
            {/* The counts are always complete, whatever the bounded list below shows: they are the summary,
                the list is the detail. */}
            {tellingen
              .map((telling) =>
                t("import.telling", {
                  aantal: telling.aantal,
                  soort: t(SOORTWOORD[telling.soort]),
                }),
              )
              .join(" · ")}
          </span>
        )}
      </p>

      {getoond.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-0.5">
          {getoond.map((regel, index) => (
            <li
              // Names are the only identity these entries have, and two levels can legitimately repeat one
              // (the same subthema naam under two klassen), so the index completes the key.
              key={`${naam(regel)}-${index}`}
              className="flex flex-wrap items-baseline gap-x-2 pl-3 text-sm"
            >
              <span aria-hidden="true" className="font-mono text-xs text-ink-zacht">
                {SOORTTEKEN[regel.soort]}
              </span>
              <span
                className={
                  regel.soort === "Toegevoegd" ? "font-semibold text-ink" : "font-medium text-ink"
                }
              >
                {naam(regel)}
              </span>
              {/* The word, always, beside the sign. The sign alone would be a glyph carrying meaning on its
                  own, which is the same failure mode as colour alone. */}
              <span className="text-xs text-ink-zacht">{t(SOORTWOORD[regel.soort])}</span>
              {context(regel) ? (
                <span className="text-xs text-ink-zacht">{context(regel)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {rest > 0 ? (
        <p className="mt-1 pl-3 text-xs text-ink-zacht">
          {tAantal(rest, "import.nogMeerEnkelvoud", "import.nogMeer")}
        </p>
      ) : null}
    </div>
  );
}
