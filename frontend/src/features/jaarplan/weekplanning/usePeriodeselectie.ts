import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Which themaperiode is open in the week view, read from and written to the **URL** (E9-04, ADR-0021 decision 2).
 *
 * **The URL is authoritative, like the klas/schooljaar selection.** Same reasoning `useSelectie` records: a deep link
 * has to open the period it names, and a value with two writable homes diverges. It also gives the drill-down its
 * back button for free, which is what makes "replaces the board in place" survivable without a modal.
 *
 * **The value is the period's `blokStart`, never its ordinal.** That is the same key a placement uses (ADR-0020 §3), and
 * for the same reason: an ordinal is a display position over a *derived* grid, so editing one vakantie re-points every
 * later number — a bookmarked `?periode=3` would silently open a different period. A date cannot drift that way. It can
 * stop being a block boundary, and the panel says so rather than guessing (`weekplanning.periodeOnbekend`).
 *
 * **Opening a period PUSHES a history entry**, unlike choosing a class, which replaces. Drilling into a period is a
 * navigation — a teacher who lands there expects Back to return to the year — where switching class is a filter on the
 * screen they are already on. Going back up replaces, so leaving and re-entering does not stack.
 */
export const PERIODE_PARAM = "periode";

export interface Periodeselectie {
  /** The open period's start date as ISO `yyyy-MM-dd`, or "" when the year board is showing. */
  periodeStart: string;
  /** Open one period's week view. */
  openPeriode: (blokStart: string) => void;
  /** Back to the year board. */
  sluitPeriode: () => void;
}

export function usePeriodeselectie(): Periodeselectie {
  const [searchParams, setSearchParams] = useSearchParams();

  const periodeStart = searchParams.get(PERIODE_PARAM) ?? "";

  const openPeriode = useCallback(
    (blokStart: string) => {
      const volgende = new URLSearchParams(searchParams);
      volgende.set(PERIODE_PARAM, blokStart);

      // Pushed: this is a navigation, so Back returns to the year board.
      setSearchParams(volgende);
    },
    [searchParams, setSearchParams],
  );

  const sluitPeriode = useCallback(() => {
    const volgende = new URLSearchParams(searchParams);
    volgende.delete(PERIODE_PARAM);

    // Replaced, so opening and closing a period twice does not leave four entries to press Back through.
    setSearchParams(volgende, { replace: true });
  }, [searchParams, setSearchParams]);

  return { periodeStart, openPeriode, sluitPeriode };
}
