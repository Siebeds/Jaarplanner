import { t, telWoord } from "../../i18n";
import { periode, verschuif } from "../../lib/datum";
import type { OverslagenWeekend } from "./werkweek";

/**
 * What the werkweek leaves out, said once above the grid (FB-040): per weekend of the weeks in view that holds
 * something, how much, and a link that opens that week with its Saturday and Sunday. Nothing at all for an empty
 * weekend, which is nearly every one, so the line is news when it appears.
 *
 * Ink, not the accent: the accent is spent on five things and a link is not one of them.
 */
export function Weekendaanwijzing({
  weekends,
  onToonWeek,
}: {
  weekends: readonly OverslagenWeekend[];
  onToonWeek: (zaterdag: string) => void;
}) {
  if (weekends.length === 0) return null;

  return (
    <div className="mb-2 flex flex-col gap-1">
      {weekends.map((weekend) => {
        const delen = [
          weekend.activiteiten > 0
            ? telWoord(weekend.activiteiten, "periode.weekendActiviteit", "periode.weekendActiviteiten")
            : null,
          weekend.fiches > 0 ? telWoord(weekend.fiches, "periode.weekendFiche", "periode.weekendFiches") : null,
        ].filter((deel): deel is string => deel !== null);
        const wat = delen.length === 2 ? t("periode.weekendEn", { een: delen[0]!, twee: delen[1]! }) : delen[0]!;

        return (
          <p key={weekend.zaterdag} className="flex flex-wrap items-baseline gap-x-2 text-meta text-inkt-zacht">
            <span>
              {t("periode.weekendAanwijzing", {
                weekend: periode(weekend.zaterdag, verschuif(weekend.zaterdag, 1)),
                wat,
              })}
            </span>
            <button
              type="button"
              onClick={() => onToonWeek(weekend.zaterdag)}
              className="inline-flex min-h-6 items-center font-medium text-inkt underline underline-offset-4 transition-colors duration-150 hover:decoration-2"
            >
              {t("periode.weekendToonWeek")}
            </button>
          </p>
        );
      })}
    </div>
  );
}
