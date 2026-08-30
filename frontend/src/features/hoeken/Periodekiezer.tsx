import { useMemo, useState } from "react";
import { IcoonPijlLinks, IcoonPijlRechts } from "../../components/Iconen";
import {
  dagNummer,
  dagMaand,
  datumsTussen,
  eersteVanMaand,
  laatsteVanMaand,
  maandJaar,
  maandVan,
  maandagVan,
  valtBinnen,
  verschuif,
  verschuifMaanden,
  volleDag,
  weekdagKort,
} from "../../lib/datum";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/** One subthema run, reduced to what this picker draws: a name and the days it covers. */
export interface Loopt {
  naam: string;
  van: string;
  tot: string;
}

/**
 * A month at a glance, for picking the stretch of days a hoek runs.
 *
 * **It shows when the subthema's run, because that is what the teacher is aiming at** (owner,
 * 2026-08-30). A hoek is enriched for a subthema, so "which fortnight" is really "which subthema",
 * and a bare calendar would make her leave the sheet to look it up. The runs are drawn twice, on
 * purpose and at two densities: a hairline under every day they cover, so the shape is visible while
 * she is choosing, and a named line under the grid, because a 32 pixel cell cannot hold "De bomen in
 * het park" and a colour alone would say nothing (Art. XII).
 *
 * **Two clicks, not two date fields.** The first click sets the start and clears the end; the second
 * sets the end. Clicking before the start begins again there rather than refusing, which is what a
 * teacher who changed her mind actually means. Every state is legal and none of them is an error
 * message.
 *
 * **Days outside the school year are disabled rather than hidden**, so the grid stays a month.
 */
export function Periodekiezer({
  van,
  tot,
  loopt,
  schooljaarVan,
  schooljaarTot,
  onKies,
}: {
  van: string;
  /** Empty while she has clicked once: a start without an end is a legal half-made choice. */
  tot: string;
  /** The subthema runs to draw, typically those of the visible months. */
  loopt: Loopt[];
  schooljaarVan: string;
  schooljaarTot: string;
  onKies: (van: string, tot: string) => void;
}) {
  const [maandAnker, setMaandAnker] = useState(van);

  // Whole weeks, so the grid is rectangular: back to the Monday on or before the first, on to the
  // Sunday on or after the last. The same shape the agenda's own month grid uses.
  const cellen = useMemo(() => {
    const eerste = maandagVan(eersteVanMaand(maandAnker));
    const laatste = verschuif(maandagVan(laatsteVanMaand(maandAnker)), 6);
    return datumsTussen(eerste, laatste);
  }, [maandAnker]);

  const zichtbaar = useMemo(() => {
    const eerste = cellen[0];
    const laatste = cellen[cellen.length - 1];
    return loopt.filter((r) => r.van <= laatste && r.tot >= eerste);
  }, [loopt, cellen]);

  function kies(datum: string) {
    // A start with no end yet, and a click on or after it: that click is the end.
    if (van !== "" && tot === "" && datum >= van) {
      onKies(van, datum);
      return;
    }

    // Everything else starts a new window here. That includes a click before the start, which is a
    // teacher moving her start rather than making a mistake.
    onKies(datum, "");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={t("periodekiezer.vorigeMaand")}
          onClick={() => setMaandAnker(verschuifMaanden(maandAnker, -1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
        >
          <IcoonPijlLinks aria-hidden="true" className="h-4 w-4" />
        </button>
        <p aria-live="polite" className="text-body font-medium text-inkt">
          {maandJaar(maandAnker)}
        </p>
        <button
          type="button"
          aria-label={t("periodekiezer.volgendeMaand")}
          onClick={() => setMaandAnker(verschuifMaanden(maandAnker, 1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
        >
          <IcoonPijlRechts aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {/* Weekday initials, from the first week of the grid so they cannot drift out of step with
            the columns underneath them. */}
        {cellen.slice(0, 7).map((datum) => (
          <span key={datum} className="pb-1 text-center text-micro uppercase text-inkt-zwak">
            {weekdagKort(datum)}
          </span>
        ))}

        {cellen.map((datum) => {
          const binnenJaar = valtBinnen(datum, schooljaarVan, schooljaarTot);
          const buitenMaand = maandVan(datum) !== maandVan(maandAnker);
          const isStart = datum === van;
          const isEind = datum === tot;
          const inBereik = tot !== "" && van < datum && datum < tot;
          const draagtReeks = zichtbaar.some((r) => valtBinnen(datum, r.van, r.tot));

          return (
            <button
              key={datum}
              type="button"
              disabled={!binnenJaar}
              aria-pressed={isStart || isEind || inBereik}
              aria-label={volleDag(datum)}
              onClick={() => kies(datum)}
              className={cn(
                "relative flex h-9 flex-col items-center justify-center rounded-veld text-meta transition-colors duration-150",
                !binnenJaar && "cursor-not-allowed text-inkt-zwak/50",
                binnenJaar && buitenMaand && "text-inkt-zwak",
                binnenJaar && !buitenMaand && "text-inkt",
                binnenJaar && !isStart && !isEind && !inBereik && "hover:bg-vlak-diep",
                inBereik && "bg-accent-zacht",
                (isStart || isEind) && "bg-accent font-medium text-accent-op",
              )}
            >
              {dagNummer(datum)}
              {/* The hairline that says a subthema runs on this day. Two pixels of ink under the
                  number, never colour on its own: the named lines below carry the meaning. */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute bottom-1 h-0.5 w-3 rounded-full",
                  draagtReeks ? (isStart || isEind ? "bg-accent-op/70" : "bg-inkt-zwak/60") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* WHAT IS RUNNING IN THIS MONTH, NAMED. The hairlines above show the shape; this says whose it
          is. Only the runs the visible weeks actually touch, so the list stays as short as the month. */}
      {zichtbaar.length > 0 ? (
        <ul className="flex flex-col gap-0.5 border-t border-lijn pt-2">
          {zichtbaar.map((reeks) => (
            <li key={`${reeks.naam}-${reeks.van}`} className="flex items-baseline gap-2 text-micro text-inkt-zacht">
              <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full bg-inkt-zwak/60" />
              <span className="min-w-0 truncate font-medium text-inkt">{reeks.naam}</span>
              <span className="shrink-0">
                {t("periodekiezer.loopt", { van: dagMaand(reeks.van), tot: dagMaand(reeks.tot) })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-lijn pt-2 text-micro text-inkt-zacht">
          {t("periodekiezer.geenSubthema")}
        </p>
      )}
    </div>
  );
}
