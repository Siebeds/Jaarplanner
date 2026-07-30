import { t } from "../../i18n";
import { Themakaart } from "./Themakaart";
import { formatteerPeriode, formatteerWeken, geplandeIn, isTeVol } from "./kalenderFormat";
import type { Planningsblok, Themaplaatsing } from "./types";

/** One column of the board. Fixed width, so every period is equally readable. */
export interface PeriodekolomProps {
  blok: Planningsblok;
  plaatsingen: Themaplaatsing[];
}

/**
 * A planning period as a board column (owner's choice, 2026-07-29).
 *
 * **This is the approved E3-10 picture, minus the two things that broke it.** The wireframe put the periods
 * side by side left to right with the vakanties as literal gaps, which is right: the year has a direction,
 * and a teacher reads it that way. Two properties of the first build made it unusable, and both are gone:
 *
 * - *Proportional widths* made a 4-week period too narrow to read a thema name in. Proportionality now lives
 *   in the {@link Jaarspine} strip above, which is the view that is actually good at it; columns here are
 *   equal width so every period is equally legible.
 * - *Stretching.* Flex `items-stretch` sized every column to the tallest, so one period with three thema's
 *   left its six neighbours as tall empty troughs. The board uses `items-start`.
 *
 * The column is deliberately not a drop target yet: dragging is **E3-07**, which also owns the confirmation
 * protecting an accepted or locked placement. The empty well is shaped to be that target when it arrives.
 */
export function Periodekolom({ blok, plaatsingen }: PeriodekolomProps) {
  const gepland = geplandeIn(plaatsingen);
  const teVol = isTeVol(plaatsingen);

  return (
    <li className="flex w-72 shrink-0 flex-col">
      <div
        className={[
          "rounded-t-lg border border-b-0 px-3.5 py-3",
          teVol ? "border-attentie bg-attentie-zacht" : "border-border bg-card",
        ].join(" ")}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">
            {t("kalender.periode", { ordinaal: blok.ordinaal })}
          </h3>
          <span className="shrink-0 text-xs font-medium text-ink-zacht" data-cijfers>
            {t("kalender.weken", { weken: formatteerWeken(blok.aantalOpenDagen) })}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-zacht">
          <time dateTime={blok.start}>{formatteerPeriode(blok.start, blok.eind)}</time>
        </p>

        {teVol && (
          // Icon AND word, never colour alone (Art. XII, FR-6.4). The *explanation* of what "te vol" means
          // is shown once above the board rather than repeated in every flagged column — the same disclosure
          // seven times over is what made the first version unreadable.
          <p className="mt-2 text-xs font-semibold text-attentie-ink">
            <span aria-hidden="true">▲</span> {t("kalender.teVol", { aantal: gepland.length })}
          </p>
        )}
      </div>

      <div
        className={[
          "flex flex-1 flex-col gap-2 rounded-b-lg border border-t-0 bg-paper/70 p-2.5",
          teVol ? "border-attentie" : "border-border",
        ].join(" ")}
      >
        {plaatsingen.length === 0 ? (
          // A recessed dashed well rather than a line of italic text: it reads as "there is room here",
          // which is what an empty period means, and it is where E3-07's drop target will land.
          <p className="flex min-h-[5rem] items-center justify-center rounded-md border border-dashed border-border bg-paper-diep/50 px-3 text-center text-xs text-ink-zacht">
            {t("kalender.legeperiode")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plaatsingen.map((plaatsing) => (
              <li key={plaatsing.id}>
                <Themakaart plaatsing={plaatsing} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * A vakantie, as a literal gap in the board.
 *
 * Carried over from the approved wireframe and kept deliberately narrow: no teaching happens here, so there
 * is nothing to plan into it. The name is rendered vertically because a 40px column cannot hold
 * "Krokusvakantie" horizontally, and it is **visible text rather than a `title`** — a hover-only label is
 * invisible on touch and unread by most screen readers (E3-06). This is also the only place the vakantie
 * names appear now; the spine above shows the gaps but not the words, so removing this would lose them.
 */
export function Vakantiegat({ naam }: { naam: string }) {
  return (
    // A dashed rule rather than a filled slab: as a grey block it was heavier than the period columns it
    // separates, and next to a short column it read as a tall empty thing you might be able to plan into.
    <li className="flex w-9 shrink-0 justify-center self-stretch border-l border-dashed border-border">
      <span className="whitespace-nowrap pt-2 text-[0.6875rem] font-medium tracking-wide text-ink-zacht [writing-mode:vertical-rl]">
        {naam}
      </span>
    </li>
  );
}
