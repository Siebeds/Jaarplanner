import { Badge } from "../../components/ui/badge";
import { t } from "../../i18n";
import type { Themaplaatsing } from "./types";

/**
 * One thema on the board (E3-06).
 *
 * **Compact by design.** On a board the card competes for a 288px column, and the first version put the
 * thema name, a status chip, a goal count and a full motivation paragraph in every one — seven of those on
 * screen read as a wall of prose. The motivation is clamped to two lines here; the full text belongs on the
 * thema detail page (**E1-14**), and until that exists a teacher can still see enough to judge whether the
 * suggestion is plausible, which is what Art. IV.3 asks of the surface.
 *
 * **Not yet draggable.** The wireframe shows a grip and the keyboard route, but both belong to E3-07, which
 * also owns the confirmation that protects an accepted or locked placement from being discarded. Rendering a
 * grip that does nothing would promise an interaction the draft cannot honour.
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
 * "gedekt" would be a false coverage claim in the one product whose purpose is provable coverage.
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
        <p
          // Clamped to two lines: the full motivation belongs on the thema detail page (E1-14). `title`
          // carries the rest for a mouse user, which is an addition here rather than the only route to it —
          // the clamped text is real, visible text, not a placeholder for a tooltip.
          className="mt-2.5 line-clamp-2 border-t border-border pt-2 text-xs leading-snug text-ink-zacht"
          title={plaatsing.aiMotivatie}
        >
          <span className="font-semibold text-ink">{t("kalender.motivatieLabel")} </span>
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
