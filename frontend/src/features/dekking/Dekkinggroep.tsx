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
 * a stale placement's doelen count as niet gedekt here while what is actually unknown is which period they sit in. The
 * row-level chips stay, because "this doel is covered by thema X" is a per-doel fact that is true either way; what the
 * ruling forbids is a *figure* for the plan, and a per-group count is one. No extra sentence is added to explain the
 * absence: the summary already says it, and it is now true.
 *
 * The header is **sticky** so a teacher scrolling a long subdomein always knows which one they are in. `top-0` inside
 * the list rather than the page: the app shell already owns a sticky header, and two competing sticky offsets is how
 * the register's filter panel ended up covering its own list.
 */
export interface DekkinggroepProps {
  groep: Dekkingsgroep;
  /** Whether a coverage figure may be shown at all; false while a stale placement is unresolved. */
  magTellingTonen: boolean;
}

export function Dekkinggroep({ groep, magTellingTonen }: DekkinggroepProps) {
  return (
    <section aria-labelledby={`groep-${groep.sleutel}`}>
      <h4
        id={`groep-${groep.sleutel}`}
        className="sticky top-0 z-10 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border bg-paper-diep px-3 py-1.5"
      >
        <span className="text-sm font-semibold text-ink">
          {t("ongekoppeld.domeinKop", { domein: groep.domein, subdomein: groep.subdomein })}
        </span>
        {magTellingTonen && (
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
