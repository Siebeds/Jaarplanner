import { Link, useLocation } from "react-router-dom";

import { DoelsoortBadge } from "../../components/DoelsoortBadge";
import { t } from "../../i18n";
import { badgeSoort, doelsoortRand } from "./doelenfilter";
import type { DoelRegel } from "./types";

/**
 * One row of the Doelen register (E1-16 clause 1).
 *
 * **A register, not a card grid.** E2-06's cards are right for a short gap list and wrong here: after a full
 * import this is thousands of rows, and a teacher looking one doel up scans a column of codes. So it is one
 * dense row: the code in mono as a left spine, the doelsoort badge, the jaar/fase, `domein · subdomein`, and
 * the goal text clamped to one line.
 *
 * **The coloured left edge is the register's one bold element**, in the doelsoort hue, so scrolling a
 * subdomein reveals its composition at a glance. It is redundant with the letter badge on purpose (Art. XII,
 * WCAG 2.2 AA: colour is never the only signal), so a colour-blind reader loses nothing and a printed page
 * still works.
 *
 * **No edit affordance** (Art. III.1). The whole row is one link to the read-only detail, and there is
 * nothing else to press.
 */
export function Doelregel({ doel, isGekozen }: { doel: DoelRegel; isGekozen: boolean }) {
  const location = useLocation();
  const soort = badgeSoort(doel.doelsoort);

  return (
    <li>
      <Link
        // The search is carried along so opening a doel keeps the filters (and the klas selection) in the
        // URL: sharing the resulting link shares the same filtered view (ADR-0021).
        to={{ pathname: `/doelen/${encodeURIComponent(doel.code)}`, search: location.search }}
        aria-label={t("doelen.openDoel", { code: doel.code })}
        aria-current={isGekozen ? "true" : undefined}
        className={[
          "flex flex-col gap-1 border-l-4 border-b border-b-border/70 py-2.5 pl-3 pr-3",
          "transition-colors duration-150 ease-uit sm:flex-row sm:items-baseline sm:gap-3",
          doelsoortRand[soort],
          isGekozen ? "bg-petrol-wash" : "hover:bg-muted",
        ].join(" ")}
      >
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-sm font-semibold text-ink" data-cijfers>
            {doel.code}
          </span>
          <DoelsoortBadge doelsoort={soort} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="shrink-0 text-xs font-medium text-ink-zacht">{doel.jaarFase}</span>
          <span className="truncate text-sm text-ink">{doel.tekst}</span>
        </span>

        {doel.nietMeerInOpstap ? (
          // Text, not a colour or a tooltip: an unbuilt/expired state says so out loud (E3-06).
          <span className="shrink-0 rounded-full bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-semibold text-attentie-ink">
            {t("doelen.vervallenMarkering")}
          </span>
        ) : null}

        <span className="shrink-0 text-xs text-ink-zacht">
          {t("ongekoppeld.domeinKop", { domein: doel.domein, subdomein: doel.subdomein })}
        </span>
      </Link>
    </li>
  );
}
