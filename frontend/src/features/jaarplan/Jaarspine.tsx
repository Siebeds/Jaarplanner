import { t } from "../../i18n";
import type { Ribbonsegment } from "./kalenderFormat";
import { formatteerDatum, formatteerPeriode } from "./kalenderFormat";
import type { Planningsonderbreking } from "./types";

/**
 * The school year as one proportional strip — the whole September→June stretch at a glance.
 *
 * **This is where the ribbon lives now.** The approved E3-10 wireframe's structural claim is that the year
 * is *a sequence of unequal periods with the vakanties as literal gaps*, so a teacher sees why periode 1
 * is shorter than periode 3 instead of being told. That claim is kept exactly: segment width is
 * proportional to `aantalOpenDagen`, and every vakantie is a real opening in the strip.
 *
 * What changed is where proportionality is *spent*. When the period cards themselves were the ribbon,
 * proportional widths made short periods too narrow to read, and every column stretched to the height of
 * the fullest one — one period holding three thema's left six neighbours as tall empty troughs. So the
 * proportional view became this strip, which is the thing it is genuinely good at, and the planning
 * surface below became uniform, readable cards. **Flagged for the directie review as the one structural
 * change to the approved wireframe.**
 *
 * Two things it must not do. It must not become the *only* place vakanties appear — losing their names
 * would be information loss dressed up as cleanliness, so they are listed in full underneath. And it must
 * not carry meaning in colour alone (Art. XII, WCAG 2.2 AA), hence the legend.
 *
 * Purely presentational: no click targets, because selecting a period does nothing yet (E3-08 owns zoom,
 * E3-07 the dragging). A control that does nothing teaches a review the wrong thing.
 */
export interface JaarspineProps {
  segmenten: Ribbonsegment[];
  /** Every closure of the year, including any at its edges — those are absent from the strip by design. */
  onderbrekingen: readonly Planningsonderbreking[];
  /** Ordinals holding at least one planned thema, so the strip shows where the year is filled. */
  gevuldeOrdinalen: ReadonlySet<number>;
  /** Ordinals flagged as over-full, matching the period cards below. */
  teVolleOrdinalen: ReadonlySet<number>;
}

export function Jaarspine({
  segmenten,
  onderbrekingen,
  gevuldeOrdinalen,
  teVolleOrdinalen,
}: JaarspineProps) {
  return (
    <figure className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="text-sm font-semibold text-ink">{t("spine.titel")}</span>
        <span className="text-xs text-ink-zacht">{t("spine.uitleg")}</span>
      </figcaption>

      <div className="flex items-stretch gap-1" role="presentation">
        {segmenten.map((segment) =>
          segment.soort === "blok" ? (
            <div
              key={`spine-blok-${segment.blok.start}`}
              // Width proportional to open days — the wireframe's central claim (ADR-0013, Art. IX.3).
              // `flexGrow` is an inline style because the value is data, not design.
              style={{ flexGrow: segment.blok.aantalOpenDagen }}
              className="min-w-0 basis-0"
            >
              <div
                className={[
                  "h-2.5 rounded-full transition-colors duration-150 ease-uit",
                  teVolleOrdinalen.has(segment.blok.ordinaal)
                    ? "bg-attentie"
                    : gevuldeOrdinalen.has(segment.blok.ordinaal)
                      ? "bg-petrol"
                      : "bg-paper-diep ring-1 ring-inset ring-border",
                ].join(" ")}
              />
              <p className="mt-1.5 truncate text-[0.6875rem] font-semibold text-ink" data-cijfers>
                {segment.blok.ordinaal}
              </p>
              {/* Hidden below `sm`: at phone width these truncate to "1 s…", which is noise rather than
                  information. The ordinal still anchors each segment to its card below. */}
              <p className="hidden truncate text-[0.6875rem] text-ink-zacht sm:block">
                <time dateTime={segment.blok.start}>{formatteerDatum(segment.blok.start)}</time>
              </p>
            </div>
          ) : (
            // The gap is the point: no teaching happens here, so nothing is drawn in it. Deliberately no
            // `title` — a hover-only disclosure is invisible on touch and unread by screen readers
            // (E3-06), so the vakantie is named in the list below instead.
            <div key={`spine-gat-${segment.onderbreking.start}`} className="w-3 shrink-0" />
          ),
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
        <Legende klasse="bg-petrol" label={t("spine.legendeGevuld")} />
        <Legende klasse="bg-paper-diep ring-1 ring-inset ring-border" label={t("spine.legendeLeeg")} />
        <Legende klasse="bg-attentie" label={t("spine.legendeTeVol")} />
      </div>

      {onderbrekingen.length > 0 && (
        <div className="mt-3 text-xs text-ink-zacht">
          <span className="font-semibold text-ink">{t("spine.vakantiesLabel")}: </span>
          {onderbrekingen.map((onderbreking, index) => (
            <span key={onderbreking.start}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              {/* The vakantie name is school-owned data, not UI copy, so it is rendered as-is. */}
              {onderbreking.naam}{" "}
              <span className="text-ink-zacht" data-cijfers>
                ({formatteerPeriode(onderbreking.start, onderbreking.eind)})
              </span>
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}

/** One legend swatch. The label is what carries the meaning; the colour only repeats it. */
function Legende({ klasse, label }: { klasse: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-zacht">
      <span aria-hidden="true" className={`h-2.5 w-5 rounded-full ${klasse}`} />
      {label}
    </span>
  );
}
