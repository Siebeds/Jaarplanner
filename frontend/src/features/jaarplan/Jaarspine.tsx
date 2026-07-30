import { t } from "../../i18n";
import type { Ribbonsegment } from "./kalenderFormat";
import { formatteerDatum } from "./kalenderFormat";

/**
 * The school year as one proportional strip — the whole September→June stretch at a glance.
 *
 * **This is where proportionality lives.** The approved E3-10 wireframe's structural claim is that the year
 * is a sequence of unequal periods with the vakanties as literal gaps, so a teacher sees why periode 1 is
 * shorter than periode 3 instead of being told. That claim is kept exactly: segment width is proportional to
 * `aantalOpenDagen`, and every vakantie is a real opening. The board below carries the *planning* view in
 * equal-width columns, which is what makes each period readable.
 *
 * **Deliberately quiet, after review feedback that it was "too right in your face".** It is a reference
 * strip, not the headline: no card, no border, no shadow, thin bars, no legend block, and the explanatory
 * sentence is gone.
 *
 * The trade to watch when you strip a legend is Art. XII — colour may never be the sole carrier — so state
 * is encoded twice over: a planned period is a **filled** bar, an empty one is an **outline**, and an
 * over-full one is filled *and* carries a visible `!`. Fill-versus-outline is a shape difference, so the
 * strip still reads in greyscale, in print, and for someone who cannot tell petrol from amber. That is what
 * the legend used to buy, bought more cheaply.
 *
 * Purely presentational: no click targets, because selecting a period does nothing yet (E3-08 owns zoom,
 * E3-07 the dragging). A control that does nothing teaches a review the wrong thing.
 */
export interface JaarspineProps {
  segmenten: Ribbonsegment[];
  /** Ordinals holding at least one planned thema, so the strip shows where the year is filled. */
  gevuldeOrdinalen: ReadonlySet<number>;
  /** Ordinals flagged as over-full, matching the board columns below. */
  teVolleOrdinalen: ReadonlySet<number>;
}

export function Jaarspine({ segmenten, gevuldeOrdinalen, teVolleOrdinalen }: JaarspineProps) {
  return (
    <figure className="border-b border-border pb-4">
      {/* The heading earns no visual weight here — the strip explains itself — but a screen-reader user
          still needs to know what this row of bars is. */}
      <figcaption className="sr-only">{t("spine.titel")}</figcaption>

      <div className="flex items-end gap-1" role="presentation">
        {segmenten.map((segment) => {
          if (segment.soort !== "blok") {
            // The gap is the point: no teaching happens here, so nothing is drawn in it. The vakantie is
            // named on the board below, where there is room for the word.
            return <div key={`spine-gat-${segment.onderbreking.start}`} className="w-2.5 shrink-0" />;
          }

          const teVol = teVolleOrdinalen.has(segment.blok.ordinaal);
          const gevuld = gevuldeOrdinalen.has(segment.blok.ordinaal);

          return (
            <div
              key={`spine-blok-${segment.blok.start}`}
              // Width proportional to open days — the wireframe's central claim (ADR-0013, Art. IX.3).
              // `flexGrow` is an inline style because the value is data, not design.
              style={{ flexGrow: segment.blok.aantalOpenDagen }}
              className="min-w-0 basis-0"
            >
              <p className="flex items-baseline gap-1 truncate text-[0.6875rem] leading-4 text-ink-zacht">
                <span className="font-semibold text-ink" data-cijfers>
                  {segment.blok.ordinaal}
                </span>
                <time dateTime={segment.blok.start} className="hidden truncate sm:inline">
                  {formatteerDatum(segment.blok.start)}
                </time>
                {teVol && (
                  // The second, non-colour carrier for "te vol" (Art. XII). A proportional segment can be
                  // 40px wide, so visually there is only room to point — but a screen reader announcing a
                  // bare "!" would learn nothing, so the word rides along invisibly. The full sentence is on
                  // the board column below.
                  <span className="font-bold text-attentie-ink">
                    !<span className="sr-only"> {t("spine.teVol")}</span>
                  </span>
                )}
              </p>

              <div
                className={[
                  "mt-1 h-1.5 rounded-full",
                  teVol
                    ? "bg-attentie"
                    : gevuld
                      ? "bg-petrol"
                      : // Outline rather than a fill: the shape says "nothing here yet" without depending on
                        // the colour being distinguishable.
                        //
                        // Measured at 1.25:1 against the page, i.e. deliberately below the 3:1 of WCAG
                        // 1.4.11 — and that is the right call rather than an oversight. The state is not
                        // carried by this bar's contrast with the page; it is carried by the *absence of a
                        // fill* beside siblings that sit at 8.4:1, which is a far larger difference than 3:1.
                        // A teacher who cannot see this outline at all still reads "this period is empty",
                        // which is exactly true, and the board column below says "Nog niets gepland" in
                        // words. Darkening it to clear the number would make emptiness louder than planning.
                        "border border-border bg-transparent",
                ].join(" ")}
              />
            </div>
          );
        })}
      </div>
    </figure>
  );
}
