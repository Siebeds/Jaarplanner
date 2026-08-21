import { useId, useState } from "react";

import { t } from "../../../i18n";
import {
  bouwMaandrooster,
  inSchooljaar,
  maandVan,
  verschuifMaand,
  weekVan,
} from "./weekIndeling";

/**
 * A month grid that jumps the week view to any week (E9-05, CR3).
 *
 * The owner supplied an Outlook screenshot as the reference: a compact month beside the week, with the shown week
 * highlighted and a month stepper. This follows that shape and diverges from it in three places, each because a
 * generic picker would be wrong about a school year.
 *
 * **1. It marks the school's own year.** Days outside the schooljaar are not offerable at all, and closures are drawn
 * as such. A generic month grid would happily send a teacher to 14 July, which is the whole reason not to reach for an
 * off-the-shelf date picker here.
 *
 * **2. Weeks start on Monday and the initials are Dutch.** The reference is an English Outlook; its S/M/T/W/T/F/S is
 * not part of what was asked for. The initials come from `Intl` rather than the catalogue, so they stay correct
 * without a translation entry per day.
 *
 * **3. It is a `grid` of `gridcell`s, not a table of buttons.** A screen reader then announces it as a date grid and
 * arrow keys mean what they look like they mean. `aria-selected` carries the shown week, so the highlight is never
 * colour alone (Art. XII).
 *
 * **One accent, no new hue.** `petrol` marks the shown week and *today* is a ring rather than a second colour — the
 * chrome gets one structural hue and this grid does not get to spend a second one.
 */

/** Dutch two-letter weekday initials, Monday first. From `Intl` so they need no catalogue entry. */
const DAGKOPPEN = (() => {
  const formatter = new Intl.DateTimeFormat("nl-BE", { weekday: "short" });

  // 2026-09-07 is a Monday; seven consecutive days from it give the week in display order.
  return Array.from({ length: 7 }, (_, i) => {
    const datum = new Date(2026, 8, 7 + i);

    return { kort: formatter.format(datum).replace(/\.$/, ""), isWeekend: i >= 5 };
  });
})();

const maandNaam = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });
const volleDatum = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", year: "numeric" });

function formatteerMaand(jaar: number, maand: number): string {
  return maandNaam.format(new Date(jaar, maand - 1, 1));
}

function formatteerVol(isoDatum: string): string {
  const [jaar, maand, dag] = isoDatum.split("-").map(Number);

  // Built from the parts, never `new Date(iso)`: that parses as UTC and renames the day west of Greenwich.
  return volleDatum.format(new Date(jaar, maand - 1, dag));
}

export interface MinikalenderProps {
  /** Any day in the week currently shown by the week view. Its own week is the one highlighted. */
  gekozenDag: string;
  /** First day of the school year; days before it are not offerable. */
  schooljaarStart: string;
  /** Last day of the school year. */
  schooljaarEind: string;
  /** Jump to the week containing this day. */
  onKies: (datum: string) => void;
}

export function Minikalender({
  gekozenDag,
  schooljaarStart,
  schooljaarEind,
  onKies,
}: MinikalenderProps) {
  /**
   * The month on show, which is **not** the same thing as the chosen week.
   *
   * Its own state so a teacher can look ahead at October without the week view jumping under them — stepping the month
   * is browsing, choosing a day is acting. Initialised from the chosen day so the grid opens on the week it highlights.
   */
  const [maand, setMaand] = useState(() => maandVan(gekozenDag));

  /**
   * **The month follows the week when the week moves from outside** (the 2026-08-20 audit's fourth frontend MAJOR).
   *
   * `useState`'s initialiser runs once, so the month was pinned to whatever `gekozenDag` was on first render. Stepping
   * the week view with *"Volgende week"* or the period's own week list — the primary navigation of this screen — changed
   * `gekozenDag` and left the grid on the old month. Week 3 of October then rendered under a **September** header, and
   * because no cell fell inside the chosen week, **not one `gridcell` carried `aria-selected`**: the highlight that is
   * this grid's whole contribution disappeared, and a screen reader was told nothing was selected.
   *
   * **Adjusted during render on a changed prop, not in an effect** — React's own documented pattern for exactly this.
   * An effect would paint the wrong month first and then correct it, and the E9-06 audit already recorded what goes
   * wrong when this kind of sync is written as one: the guard has to compare against the *previous* value, because
   * `setState` is batched and a handler-time ref reads null.
   *
   * **It keys on `gekozenDag`, so browsing still works.** Stepping the month changes `maand` alone and this branch does
   * not fire; only a new chosen day pulls the grid back. That leaves one honest state — browsed away from the shown
   * week, nothing selected — which the notice below names rather than leaving it to look like the defect above.
   */
  const [vorigeGekozenDag, setVorigeGekozenDag] = useState(gekozenDag);
  if (gekozenDag !== vorigeGekozenDag) {
    setVorigeGekozenDag(gekozenDag);
    setMaand(maandVan(gekozenDag));
  }

  const labelId = useId();

  const rooster = bouwMaandrooster(maand.jaar, maand.maand);
  const gekozenWeek = weekVan(gekozenDag);

  /**
   * Whether the shown week overlaps the month on screen at all.
   *
   * A week straddling a month boundary counts as inside **both**, which is why this is an overlap test rather than a
   * comparison of month numbers: the grid draws neighbouring months' days too, so half of such a week is genuinely
   * visible and selected here.
   */
  const weekIsZichtbaar = rooster.some(
    (cel) => cel.datum >= gekozenWeek.van && cel.datum <= gekozenWeek.tot,
  );

  return (
    <div className="rounded-lg border border-border bg-card p-3" role="group" aria-labelledby={labelId}>
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => setMaand((h) => verschuifMaand(h.jaar, h.maand, -1))}
          aria-label={t("minikalender.vorigeMaand")}
          className="rounded px-2 py-1 text-sm text-ink-zacht hover:bg-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {/* `aria-hidden` on the glyph: the button's accessible name is the aria-label, and a screen reader
              announcing "‹" as well would say the control twice. */}
          <span aria-hidden="true">‹</span>
        </button>

        {/* The month name is the group's accessible name, so the grid below announces which month it is. */}
        <span id={labelId} className="text-xs font-semibold text-ink">
          {formatteerMaand(maand.jaar, maand.maand)}
        </span>

        <button
          type="button"
          onClick={() => setMaand((h) => verschuifMaand(h.jaar, h.maand, 1))}
          aria-label={t("minikalender.volgendeMaand")}
          className="rounded px-2 py-1 text-sm text-ink-zacht hover:bg-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div role="grid" className="mt-2">
        {/* The initials are decorative for assistive tech: every cell already carries its full date as an accessible
            name, so a column header would be read out on top of it. `aria-hidden` rather than `role="columnheader"`
            for that reason. */}
        <div role="row" aria-hidden="true" className="grid grid-cols-7 gap-0.5">
          {DAGKOPPEN.map((kop, index) => (
            <span
              key={index}
              className={[
                "py-1 text-center text-[0.625rem] font-medium",
                kop.isWeekend ? "text-ink-zacht/70" : "text-ink-zacht",
              ].join(" ")}
            >
              {kop.kort}
            </span>
          ))}
        </div>

        {/* Six rows of seven, always, so the week view below never jumps when a teacher steps a month. */}
        {Array.from({ length: 6 }, (_, rij) => (
          <div role="row" key={rij} className="grid grid-cols-7 gap-0.5">
            {rooster.slice(rij * 7, rij * 7 + 7).map((cel) => {
              const bruikbaar = inSchooljaar(cel.datum, schooljaarStart, schooljaarEind);
              const inGekozenWeek = cel.datum >= gekozenWeek.van && cel.datum <= gekozenWeek.tot;
              const dagNummer = Number(cel.datum.slice(8, 10));

              return (
                <div role="gridcell" key={cel.datum} aria-selected={inGekozenWeek}>
                  <button
                    type="button"
                    disabled={!bruikbaar}
                    onClick={() => onKies(cel.datum)}
                    // The full date, so a screen reader never has to infer the month from a bare number, and the
                    // out-of-year reason is said rather than left to the disabled state (the E3-06 rule).
                    aria-label={
                      bruikbaar
                        ? formatteerVol(cel.datum)
                        : `${formatteerVol(cel.datum)}, ${t("minikalender.buitenSchooljaar")}`
                    }
                    className={[
                      "w-full rounded py-1 text-center text-[0.6875rem] tabular-nums transition-colors",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                      !bruikbaar
                        ? // Not `opacity`: dimming already-muted text drops it under the contrast floor, which is the
                          // trap E3-06's audit caught. `cursor-not-allowed` plus the spoken reason carries it instead.
                          "cursor-not-allowed text-ink-zacht/70"
                        : inGekozenWeek
                          ? "bg-petrol font-semibold text-petrol-foreground"
                          : cel.inDezeMaand
                            ? "font-medium text-ink hover:bg-petrol-wash hover:text-petrol"
                            : // Neighbouring months stay clickable (that is why they are not blanked) but recede by
                              // weight rather than by a lighter colour.
                              "font-normal text-ink-zacht hover:bg-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {dagNummer}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Reachable **only** by stepping the month away from the shown week, which is a thing a teacher did on purpose.
          Said rather than left implicit, because the alternative is a grid with no highlight in it — indistinguishable
          from the defect this component just had. The sentence asserts exactly what the condition guarantees (the E5-03
          rule): that the shown week is not in this month, and nothing about which week that is. */}
      {!weekIsZichtbaar && (
        <div className="mt-2 border-t border-border pt-2">
          <p className="text-[0.6875rem] text-ink-zacht">{t("minikalender.andereMaand")}</p>
          <button
            type="button"
            onClick={() => setMaand(maandVan(gekozenDag))}
            className="mt-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium text-petrol hover:bg-petrol-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("minikalender.terugNaarWeek")}
          </button>
        </div>
      )}
    </div>
  );
}
