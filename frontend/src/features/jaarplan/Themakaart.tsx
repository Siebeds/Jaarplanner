import { Badge } from "../../components/ui/badge";
import { t } from "../../i18n";
import type { Themaplaatsing } from "./types";

/**
 * One thema on the plan (E3-06).
 *
 * **Not yet draggable.** The wireframe shows a grip and the keyboard route, but both belong to E3-07,
 * which also owns the confirmation that protects an accepted or locked placement from being discarded.
 * Rendering a grip that does nothing would promise an interaction the draft cannot honour, so the card is
 * inert and the review is told plainly what is missing.
 *
 * **The doelsoort mix from the wireframe (`MD 4 · G 6 · + 1`) is deliberately absent.** The jaarplan API
 * returns `doelcodes` — the codes a thema carries — but not each code's doelsoort, so the mix cannot be
 * computed here without inventing it. The honest count is shown instead, and the gap is a review item
 * against question E ("what belongs on a card?") rather than a fabricated chip row.
 *
 * **The count says *gekoppeld*, never *gedekt*.** `doelcodes` is the set of leerplandoelen linked to the
 * thema (themadoelen + aanvaarde/manuele koppelingen). Under Art. V.1 a doel is only *gedekt* once that
 * thema is placed in the plan — so for a **stale** placement, which by definition sits in no period, the
 * count proves nothing about coverage and the card says so instead of printing a number. Calling a link
 * "gedekt" would be a false coverage claim in the one product whose purpose is provable coverage, and it
 * would contradict the notice directly above the stale cards (Art. V.2, directie 2026-07-28).
 */
export interface ThemakaartProps {
  plaatsing: Themaplaatsing;
}

export function Themakaart({ plaatsing }: ThemakaartProps) {
  const aantal = plaatsing.doelcodes.length;

  const koppeling = plaatsing.isVervallen
    ? t("kalender.dekkingOnbekend")
    : aantal === 0
      ? t("kalender.geenDoelen")
      : aantal === 1
        ? t("kalender.eenDoelGekoppeld")
        : t("kalender.doelenGekoppeld", { aantal });

  return (
    <article className="rounded-md border border-border bg-card p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-snug text-ink">{plaatsing.themaNaam}</h4>

        {plaatsing.vergrendeld && (
          /* Icon AND word — colour or a glyph alone is never the sole carrier (Art. XII, WCAG 2.2 AA). */
          <Badge variant="outline" className="shrink-0" title={t("kalender.vergrendeldUitleg")}>
            <span aria-hidden="true">🔒</span> {t("kalender.vergrendeld")}
          </Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {/* The status token variants carry the same colours as the matching screen, so a "voorgesteld"
            thema reads identically wherever a teacher meets it. */}
        <Badge variant={statusSleutel(plaatsing.status)}>
          {t(`suggestieStatus.${statusSleutel(plaatsing.status)}`)}
        </Badge>
        <span className="text-xs text-ink-zacht" data-cijfers>
          {koppeling}
        </span>
      </div>

      {plaatsing.aiMotivatie && (
        // The motivation is the AI's argument, so it is set apart as a quote rather than run on as another
        // paragraph — a teacher deciding accept/reject needs to see where the tool's reasoning starts and
        // stops (Art. IV.3).
        <div className="mt-3 rounded-md bg-paper px-3 py-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-zacht">
            {t("kalender.motivatieLabel")}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-ink">{plaatsing.aiMotivatie}</p>
        </div>
      )}
    </article>
  );
}

/** Maps the API's PascalCase status onto the nl.json key for it. */
function statusSleutel(status: Themaplaatsing["status"]) {
  return status.toLowerCase() as Lowercase<Themaplaatsing["status"]>;
}
