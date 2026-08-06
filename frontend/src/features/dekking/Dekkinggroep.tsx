import { t, tAantal } from "../../i18n";
import { Doeldekkingregel } from "./Doeldekkingregel";
import type { Dekkingsgroep } from "./dekkingFormat";

/**
 * One (domein, subdomein) group of the dekkingslijst, with its own tally (E5-02).
 *
 * **Grouping is the whole reason this screen is readable.** The API returns one flat list ordered by
 * (domein, subdomein, code), which for a real curriculum is hundreds of rows of near-identical shape. A teacher
 * asking "where are my gaps" needs the answer per subdomein, because that is the unit they plan in.
 *
 * **The per-group tally is the closest this story comes to a percentage, and it stops there on purpose.** "3 van 8
 * gedekt" is a count over rows the group itself renders, so it cannot disagree with them. The dekkingspercentage, the
 * doelsoort filter and the ontbrekende-doelenlijst are **E5-03**; tracing a gap to where it should be planned is
 * **E5-05**. Neither is anticipated here, because both need the Art. XIV denominator question settled further than
 * the 2026-08-04 ruling settles it.
 *
 * **The tally disappears when the summary withholds its figure, and that is a fix rather than a refinement.** Found by
 * opening the screen with a stale placement: the summary said *"Zolang dat zo is, geeft dit overzicht geen cijfer"* and
 * two lines below it every group printed one. The group counts are additive, so a teacher could add them up and
 * reconstruct precisely the total the ruling of 2026-07-28 forbids showing, and it would be the *misleading* version:
 * a stale placement's doelen count as niet gedekt here while what is actually unknown is which period they sit in. No
 * extra sentence is added to explain the absence: the summary already says it, and it is now true.
 *
 * **The row chips stay, and the reason first given for that was self-contradicting** (antagonist, open question 2). It
 * claimed they are "a per-doel fact that is true either way" while the sentence beside it said a stale placement's
 * doelen read as niet gedekt when what is unknown is their period. Both cannot hold, and the chips are just as additive
 * as the tally, so the withheld total is still reconstructible by counting them. **The honest reason is narrower:** the
 * directie ruling of 2026-07-28 as recorded speaks of *the figure*, and removing the per-doel verdicts would leave this
 * screen with nothing on it at all in the one state where a teacher most needs to see which thema's are affected. That
 * is a judgement call, not a ruling. **Whether the affected rows must be marked provisional is the owner's to decide**
 * and is recorded in the Art. XIV list; do not read the current behaviour as settled.
 *
 * **The header is not sticky, and a previous version of this comment claimed it was** (antagonist MINOR-2). It carried
 * `sticky top-0`, which cannot work here: the list wrapper has `overflow-hidden` for its rounded corners, that makes it
 * the nearest scroll container, and a sticky child of a box that never scrolls does not stick as the page scrolls. Even
 * if it had, `top-0` would have placed it under the app shell's own `sticky top-0` header, which the same comment
 * claimed to be avoiding. Removed rather than fixed with an offset: group headers recur every few rows, so the cost of
 * not sticking is small, and a hard-coded offset to another component's height is the kind of coupling that breaks
 * silently when that header changes.
 */
export interface DekkinggroepProps {
  groep: Dekkingsgroep;
  /** Whether a coverage figure may be shown at all; false while a stale placement is unresolved. */
  magTellingTonen: boolean;
  /**
   * Stable, DOM-safe id for the heading this group's region is named by.
   *
   * **Not derived from `groep.sleutel`** (antagonist MINOR-1). That key is `JSON.stringify([domein, subdomein])`, so for
   * a real curriculum it renders `id="groep-[\"Natuur\",\"Levende natuur\"]"`: HTML forbids ASCII whitespace in an `id`,
   * and `aria-labelledby` is an ID-reference **list** parsed on whitespace, so it resolved to two non-existent ids and
   * every group silently lost its accessible name. Nothing caught it because the demo seed uses single-word names and
   * axe does not flag an unresolvable `aria-labelledby` on a `section`.
   */
  kopId: string;
  /**
   * The list is showing only the gaps (E5-03), so this group holds a subset of its own rows and its tally is
   * suppressed.
   *
   * **Suppressed rather than recomputed over the whole group.** The tally's one guarantee is that it counts the rows
   * the group renders (*"derived from the same rows the group renders or the two can disagree"*), and in this view
   * those rows are all uncovered: the honest count would be "0 van 5 gedekt", which reads as a subdomein with no
   * coverage at all rather than as a filtered view of one. Restoring the true "3 van 8" would mean counting rows that
   * are not on screen, breaking that guarantee in the other direction. The missing total is stated once above the
   * list instead, where it is a property of the view rather than of a group.
   */
  toonAlleenOntbrekende?: boolean;
}

export function Dekkinggroep({
  groep,
  magTellingTonen,
  kopId,
  toonAlleenOntbrekende = false,
}: DekkinggroepProps) {
  return (
    <section aria-labelledby={kopId}>
      <h4
        id={kopId}
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border bg-paper-diep px-3 py-1.5"
      >
        <span className="text-sm font-semibold text-ink">
          {t("ongekoppeld.domeinKop", { domein: groep.domein, subdomein: groep.subdomein })}
        </span>
        {magTellingTonen && !toonAlleenOntbrekende && (
          <span className="text-xs font-medium text-ink-zacht" data-cijfers>
            {tAantal(groep.doelen.length, "dekking.groepTellingEnkelvoud", "dekking.groepTelling", {
              gedekt: groep.aantalGedekt,
            })}
          </span>
        )}
      </h4>

      <ul>
        {groep.doelen.map((doel) => (
          <Doeldekkingregel key={doel.code} doel={doel} />
        ))}
      </ul>
    </section>
  );
}
