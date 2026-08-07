import { Link, useLocation } from "react-router-dom";

import { JAARPLAN_PAD, THEMAS_PAD } from "../../app/routes";
import { t, tAantal, type TranslationKey } from "../../i18n";
import type { Lacunetelling } from "./dekkingFormat";
import type { Lacuneoorzaak } from "./types";

/**
 * What each cause is called above the list, and where it is closed (E5-05, FR-9).
 *
 * **`GeenThema` has no route, deliberately, and that is the E3-06 rule rather than an unbuilt half.** It is the one
 * cause planning cannot close: the school teaches nothing that maps onto the goal, so neither the kalender nor the
 * thema-screen has anything to offer. A link to either would be a control that does not do what it says. The line
 * still renders, because "we cannot close these by planning" is the single most useful thing this block can tell a
 * directie about Art. V.2.
 *
 * The two kalender causes keep separate lines despite sharing a destination: the tasks differ (decide a proposal
 * versus put a thema in a period), and one merged sentence would be false for whichever half it did not describe.
 */
const ROUTES: Record<
  Lacuneoorzaak,
  { meervoud: TranslationKey; enkelvoud: TranslationKey; pad?: string; linkKey?: TranslationKey }
> = {
  WachtOpBeslissing: {
    meervoud: "dekking.lacuneWachtOpBeslissing",
    enkelvoud: "dekking.lacuneWachtOpBeslissingEnkelvoud",
    pad: JAARPLAN_PAD,
    linkKey: "dekking.lacuneNaarKalender",
  },
  NietIngepland: {
    meervoud: "dekking.lacuneNietIngepland",
    enkelvoud: "dekking.lacuneNietIngeplandEnkelvoud",
    pad: JAARPLAN_PAD,
    linkKey: "dekking.lacuneNaarKalender",
  },
  KoppelingNietBeslist: {
    meervoud: "dekking.lacuneKoppelingNietBeslist",
    enkelvoud: "dekking.lacuneKoppelingNietBeslistEnkelvoud",
    pad: THEMAS_PAD,
    linkKey: "dekking.lacuneNaarThemas",
  },
  GeenThema: {
    meervoud: "dekking.lacuneGeenThema",
    enkelvoud: "dekking.lacuneGeenThemaEnkelvoud",
  },
};

/**
 * The gap-analyse's action half: how many doelen sit behind each cause, and one link per cause to where it is closed
 * (E5-05, FR-9, Art. V.3).
 *
 * **Why the routes are here and not on the rows.** The per-doel cause line sits on the row, where the doel is; the
 * *action* is aggregated here, because a teacher does not close gaps one goal at a time. Placing one thema covers
 * every doel that thema carries, so "31 doelen zitten in thema's die in geen enkele periode staan" is both the truer
 * description of the work and one link instead of thirty-one. The row-level argument is on `Doeldekkingregel`.
 *
 * **It renders nothing while the figure is withheld, and that is this component's one real rule.** The four counts
 * are additive over exactly the gaps in view, so printing them hands back a total the directie ruling of 2026-07-28
 * says may not be shown, in the same way E5-02's group tallies did before that defect was found: a teacher could add
 * them up. Two alternatives were rejected. Rendering the lines *without* counts would need a second copy family that
 * says the same things less precisely, and E5-03's rule is to say less rather than to say something else, which is
 * what an absence already does. Rendering with counts and a caveat would be the contradiction E4-06 catalogued: a
 * warning that the figure cannot be trusted, beside figures.
 *
 * The state is not left silent either: while a placement is unresolved the summary above already states it and links
 * to the one action that matters, which is resolving it. Every route here stays reachable the moment it does.
 */
export function Lacuneroutes({ tellingen }: { tellingen: readonly Lacunetelling[] }) {
  const location = useLocation();

  if (tellingen.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="lacuneroutes-kop"
      className="rounded-lg border border-border bg-card px-4 py-3"
    >
      <h3 id="lacuneroutes-kop" className="text-sm font-semibold text-ink">
        {t("dekking.lacuneKop")}
      </h3>

      <ul className="mt-2 flex flex-col gap-1.5">
        {tellingen.map(({ oorzaak, aantal }) => {
          const route = ROUTES[oorzaak];

          return (
            <li
              key={oorzaak}
              // `flex-wrap` with a baseline alignment rather than a fixed two-column row: at 390px the sentence and
              // its link stack, and a link that had to share a line with a full sentence would either wrap mid-phrase
              // or push the sentence into a two-character column.
              className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-ink"
            >
              <span>{tAantal(aantal, route.enkelvoud, route.meervoud)}</span>

              {route.pad && route.linkKey && (
                <Link
                  // `search` travels, like every cross-screen link in this app (ADR-0021): `useSelectie` reads the
                  // klas and schooljaar only from the URL, so a bare path would drop the class whose gaps these are
                  // and land the teacher on someone else's kalender.
                  to={{ pathname: route.pad, search: location.search }}
                  // 24px minimum target (SC 2.5.8) measured rather than argued, the same call `Doeldekkingregel`
                  // makes for its vervallen marker: the text is 14px on a 1.5 line-height, so it computes to 21px.
                  className="inline-flex min-h-6 items-center text-sm font-semibold text-petrol underline decoration-petrol/40 underline-offset-2 hover:decoration-petrol"
                >
                  {t(route.linkKey)}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
