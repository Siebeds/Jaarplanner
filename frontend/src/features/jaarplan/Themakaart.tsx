import { Badge } from "../../components/ui/badge";
import { t } from "../../i18n";
import type { Themaplaatsing } from "./types";

/**
 * One thema on the ribbon (E3-06).
 *
 * **Not yet draggable.** The wireframe shows a grip and the keyboard route, but both belong to E3-07,
 * which also owns the confirmation that protects an accepted or locked placement from being discarded.
 * Rendering a grip that does nothing would promise an interaction the draft cannot honour, so the card
 * is a plain focusable element and the review is told plainly what is missing.
 *
 * **The doelsoort mix from the wireframe (`MD 4 · G 6 · + 1`) is deliberately absent.** The jaarplan API
 * returns `doelcodes` — the codes a thema carries — but not each code's doelsoort, so the mix cannot be
 * computed here without inventing it. The honest count is shown instead, and the gap is a review item
 * against question E ("what belongs on a card?") rather than a fabricated chip row.
 */
export interface ThemakaartProps {
  plaatsing: Themaplaatsing;
}

export function Themakaart({ plaatsing }: ThemakaartProps) {
  const aantal = plaatsing.doelcodes.length;

  const dekking =
    aantal === 0
      ? t("kalender.geenDoelen")
      : aantal === 1
        ? t("kalender.eenDoelGedekt")
        : t("kalender.doelenGedekt", { aantal });

  return (
    <article
      tabIndex={0}
      className="rounded-md border border-slate-300 bg-white p-2 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1"
    >
      <h4 className="text-sm font-medium leading-tight text-slate-900">
        {plaatsing.themaNaam}
      </h4>

      <p className="mt-1 text-xs text-slate-500">{dekking}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {/* The status token variants carry the same colours as the matching screen, so a
            "voorgesteld" thema reads identically wherever a teacher meets it. */}
        <Badge variant={statusSleutel(plaatsing.status)}>
          {t(`suggestieStatus.${statusSleutel(plaatsing.status)}`)}
        </Badge>

        {plaatsing.vergrendeld && (
          /* Icon AND word — colour or a glyph alone is never the sole carrier (Art. XII, WCAG 2.2 AA). */
          <Badge variant="outline" title={t("kalender.vergrendeldUitleg")}>
            <span aria-hidden="true">🔒</span> {t("kalender.vergrendeld")}
          </Badge>
        )}
      </div>

      {plaatsing.aiMotivatie && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs italic text-slate-500">
          <span className="not-italic font-medium">{t("kalender.motivatieLabel")} </span>
          {plaatsing.aiMotivatie}
        </p>
      )}
    </article>
  );
}

/** Maps the API's PascalCase status onto the nl.json key for it. */
function statusSleutel(status: Themaplaatsing["status"]) {
  return status.toLowerCase() as Lowercase<Themaplaatsing["status"]>;
}
