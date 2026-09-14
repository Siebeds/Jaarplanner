import type { LeeftijdFacet } from "../../lib/types";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import { MIJLPAAL } from "./mijlpaal";

/**
 * The minimumdoelen's own first cut (TB-010): the three mijlpalen the decree sets them at, each with how many
 * minimumdoelen the rest of the filter leaves it. Press one to narrow, press it again to see all three.
 *
 * The pressed state is drawn in ink, not in the accent: ADR-0024 rations the accent to five uses and a pressed filter
 * is not one of them. The chip carries the mijlpaal's code and its name, and `aria-pressed` says which one is on, so
 * nothing here depends on seeing a colour.
 */
export function Mijlpaalkeuze({
  leeftijden,
  actief,
  onKies,
}: {
  leeftijden?: LeeftijdFacet[];
  actief: string | null;
  onKies: (leeftijd: string | null) => void;
}) {
  if (!leeftijden || leeftijden.length === 0) return null;

  return (
    <div role="group" aria-label={t("doelen.mijlpaal")} className="flex flex-wrap items-center gap-1.5">
      <span aria-hidden="true" className="mr-1 text-micro uppercase text-inkt-zwak">
        {t("doelen.mijlpaal")}
      </span>
      {leeftijden.map(({ leeftijd, aantal }) => {
        const gekozen = actief === leeftijd;
        return (
          <button
            key={leeftijd}
            type="button"
            aria-pressed={gekozen}
            onClick={() => onKies(gekozen ? null : leeftijd)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-veld border px-2.5 text-meta transition-colors duration-150",
              gekozen ? "border-inkt bg-vlak-diep text-inkt" : "border-lijn bg-kaart text-inkt-zacht hover:border-lijn-veld",
            )}
          >
            <span className="mono font-medium text-inkt">{leeftijd.replace("-", "")}</span>
            <span>{MIJLPAAL[leeftijd] ? t(MIJLPAAL[leeftijd]) : leeftijd}</span>
            <span className="mono text-[0.6875rem] text-inkt-zwak">{aantal}</span>
          </button>
        );
      })}
    </div>
  );
}
