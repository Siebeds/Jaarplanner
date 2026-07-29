import { t } from "../../i18n";
import { Themakaart } from "./Themakaart";
import { formatteerPeriode, formatteerWeken, geplandeIn, isTeVol } from "./kalenderFormat";
import type { Planningsblok, Themaplaatsing } from "./types";

/**
 * One planning period, as a full-width band: its identity on the left, its thema's on the right.
 *
 * **Why a band and not a tile.** Two tile layouts were tried and both wasted the screen the same way. A
 * horizontal ribbon of proportional columns stretched every column to the height of the fullest one, so one
 * period with three thema's left its neighbours as tall empty troughs; a responsive grid of cards fixed the
 * stretching but still sized each *row* to its tallest card, leaving a few hundred pixels of nothing beside
 * a short period. A period is an entry in a sequence, not a tile in a mosaic — so it gets a row, the thema's
 * flow across the width available, and the year still reads strictly top to bottom. Proportional length
 * lives in the {@link Jaarspine} above, which is the view that is actually good at it.
 */
export interface PeriodeblokProps {
  blok: Planningsblok;
  plaatsingen: Themaplaatsing[];
}

export function Periodeblok({ blok, plaatsingen }: PeriodeblokProps) {
  const gepland = geplandeIn(plaatsingen);
  const teVol = isTeVol(plaatsingen);

  return (
    <li
      className={[
        "rounded-lg border bg-card shadow-card transition-shadow duration-150 ease-uit hover:shadow-lift",
        teVol ? "border-attentie" : "border-border",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-6 sm:p-5">
        <div className="sm:w-48 sm:shrink-0">
          <div className="flex items-baseline gap-3 sm:flex-col sm:gap-0.5">
            <h3 className="text-base font-bold text-ink">
              {t("kalender.periode", { ordinaal: blok.ordinaal })}
            </h3>
            <p className="text-xs text-ink-zacht">
              <time dateTime={blok.start}>{formatteerPeriode(blok.start, blok.eind)}</time>
            </p>
            <p className="text-xs font-medium text-ink-zacht" data-cijfers>
              {t("kalender.weken", { weken: formatteerWeken(blok.aantalOpenDagen) })}
            </p>
          </div>

          {teVol && (
            <div className="mt-3 rounded-md bg-attentie-zacht px-3 py-2.5">
              {/* Icon AND word, never colour alone (Art. XII, FR-6.4). */}
              <p className="text-xs font-semibold text-attentie-ink">
                <span aria-hidden="true">▲</span> {t("kalender.teVol", { aantal: gepland.length })}
              </p>
              {/* Visible, not a `title` tooltip. The threshold is a placeholder for review question C, and
                  a disclosure that only appears on hover is invisible on touch, unreachable by keyboard and
                  usually unread by screen readers — i.e. not a disclosure at the session it exists for. */}
              <p className="mt-1 text-xs leading-snug text-attentie-ink">
                {t("kalender.teVolUitleg")}
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {plaatsingen.length === 0 ? (
            // A recessed dashed well rather than a line of italic text: it reads as "there is room here",
            // which is what an empty period means, and it is where E3-07's drop target will land.
            <p className="flex min-h-[4.5rem] items-center justify-center rounded-md border border-dashed border-border bg-paper-diep/50 px-3 text-center text-xs text-ink-zacht">
              {t("kalender.legeperiode")}
            </p>
          ) : (
            // Flex-wrap with a basis and a max, not a fixed column count. A grid left a lone thema sitting
            // in a third of the band with two empty tracks beside it, and letting one card span the whole
            // width instead pushed its motivation text past 100 characters a line. So cards share the row
            // evenly, grow to a readable maximum, and wrap when there are more than the width allows.
            <ul className="flex flex-wrap items-start gap-3">
              {plaatsingen.map((plaatsing) => (
                <li key={plaatsing.id} className="min-w-0 flex-1 basis-80 sm:max-w-lg">
                  <Themakaart plaatsing={plaatsing} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
