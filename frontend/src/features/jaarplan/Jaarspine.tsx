import { t, type TranslationKey } from "../../i18n";
import type { Ribbonsegment } from "./kalenderFormat";
import { PERIODELABEL, formatteerDatum } from "./kalenderFormat";
import type { Planningsblokniveau } from "./types";

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
 * The trade to watch when you strip a legend is WCAG 2.2 AA SC 1.4.1 (Art. VIII, ADR-0017): colour may never be the
 * sole carrier. So state is encoded twice over: a planned period is a **filled** bar, an empty one is an **outline**,
 * and an over-full one is filled *and* carries a visible `▲`. Fill-versus-outline is a shape difference, so the strip
 * still reads in greyscale, in print, and for someone who cannot tell petrol from amber. That is what the legend used
 * to buy, bought more cheaply.
 *
 * *Two corrections here, both E3-09 (2026-08-04).* The glyph was `!` until this story unified it with the board's; and
 * this paragraph cited **Art. XII**, which is the constitution's **glossary** and fixes no colour rule at all. The
 * WCAG target lives in Art. VIII and ADR-0017. That miscitation is repo-wide (`CLAUDE.md` carries it too) and is filed
 * rather than swept here.
 *
 * Purely presentational: no click targets. **The zoom (E3-08) deliberately did not turn these bars into buttons** —
 * a segment is 40px wide and carries no label a teacher could aim at, and "click a period to zoom into it" would be
 * a *different* feature (one period at a time) from the one the story asks for (the whole year at a finer grain).
 * The tier is chosen by the named control above instead, and this strip re-renders at that tier.
 */
export interface JaarspineProps {
  segmenten: Ribbonsegment[];
  /**
   * Ordinals holding at least one planned thema, so the strip shows where the year is filled.
   *
   * An ordinal is safe here, unlike {@link teVolleStarts} below: this set is derived from the **same** `/rooster`
   * answer that produced `segmenten`, so the two cannot be a version apart.
   */
  gevuldeOrdinalen: ReadonlySet<number>;
  /**
   * Block **start dates** flagged as over-full, matching the board columns below.
   *
   * **Start dates and not ordinals** (antagonist MINOR, E3-09 fix round 1), because this set crosses a query boundary:
   * the te-vol verdict comes from the *jaarplan* response while `segmenten` come from *`/rooster`*, and those are two
   * caches that can be a beat apart — `kalender.roosterVerversenMislukt` exists for precisely that window. An ordinal
   * is a position in a grid, so if the two answers disagree about the grid the strip marks the wrong segment; a start
   * date is the placement key (ADR-0020 §3) and simply fails to match. E3-09 introduced the cross-response join and
   * first made it on the ordinal, one file after writing "keyed on `start` and not on `ordinaal`, like everything else
   * that has to survive a vakantie edit" in `belastingPerStart`.
   */
  teVolleStarts: ReadonlySet<string>;
  /**
   * The tier these segments belong to (E3-08).
   *
   * The strip zooms **with** the board rather than staying pinned to the year: one `/rooster` answer feeds both, so
   * the two can never disagree about which period an ordinal means. The visible strip is unchanged by the tier (it
   * is dates and bars either way); what has to follow it is the sr-only ordinal, because "Periode 12" would name a
   * themaperiode that does not exist while pointing at a subthemaperiode.
   */
  niveau: Planningsblokniveau;
}

/**
 * The strip's own title per tier (E3-08 fix round 4, MINOR-4b).
 *
 * A `Record` rather than a ternary for the reason its siblings are: this sentence is the **first** thing a
 * screen-reader user hears about the strip, so a tier added later inheriting *"in themaperiodes"* would contradict
 * every ordinal underneath it before anyone noticed. The ordinal itself comes from the shared
 * {@link PERIODELABEL}, which the board column reads too.
 */
const SPINETITEL: Record<Planningsblokniveau, TranslationKey> = {
  Themaperiode: "spine.titel",
  Subthemaperiode: "spine.titelFijn",
};

export function Jaarspine({
  segmenten,
  gevuldeOrdinalen,
  teVolleStarts,
  niveau,
}: JaarspineProps) {
  const periodeSleutel = PERIODELABEL[niveau];

  return (
    <figure className="border-b border-border pb-4">
      {/* The heading earns no visual weight here — the strip explains itself — but a screen-reader user
          still needs to know what this row of bars is.
          It names the tier (E3-08 fix round 2, MINOR-5): "het schooljaar in periodes" was the fourth name for an
          object whose columns and ordinals say "themaperiode" or "subthemaperiode", and it is the FIRST thing a
          screen-reader user hears about this strip, immediately before ordinals that use the other word. */}
      <figcaption className="sr-only">{t(SPINETITEL[niveau])}</figcaption>

      <div className="flex items-end gap-1" role="presentation">
        {segmenten.map((segment) => {
          if (segment.soort !== "blok") {
            // The gap is the point: no teaching happens here, so nothing is drawn in it. The vakantie is
            // named on the board below, where there is room for the word.
            return <div key={`spine-gat-${segment.onderbreking.start}`} className="w-2.5 shrink-0" />;
          }

          const teVol = teVolleStarts.has(segment.blok.start);
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
                {/*
                  Only the date is shown. The period ordinal used to sit here too and produced labels like
                  "4 4 jan" and "1 1 sep" — two numbers jammed together, where the first could be read as a
                  day. The ordinal was also pure duplication: every board column below is headed
                  "Periode 4" directly above "4 jan – 14 feb", so the start date already links a segment to
                  its column, and a timeline is better anchored by *when* than by an internal number.
                  Screen readers still get the ordinal, because they cannot use position to infer it.
                */}
                <span className="sr-only">
                  {t(periodeSleutel, { ordinaal: segment.blok.ordinaal })}:{" "}
                </span>
                {/* Hidden below `sm` at the fine tier, and that came out of looking at a phone: 19 segments across
                    390px leaves each label about 18px, so every date truncated to "1… 1… 2…" — fragments where the
                    first number reads as a day. The bar itself still carries filled-versus-outline, the sr-only
                    ordinal above is untouched, and every board column below states its own dates in full. At `sm`
                    and up the dates fit and are the anchor of the strip, so they stay. */}
                <time
                  dateTime={segment.blok.start}
                  className={
                    niveau === "Subthemaperiode" ? "hidden truncate sm:inline" : "truncate"
                  }
                >
                  {formatteerDatum(segment.blok.start)}
                </time>
                {teVol && (
                  // The second, non-colour carrier for "te vol" (Art. XII). A proportional segment can be
                  // 40px wide, so visually there is only room to point — but a screen reader announcing a
                  // bare glyph would learn nothing, so the word rides along invisibly. The full sentence is on
                  // the board column below.
                  //
                  // The glyph is `▲`, the same one the board column and the explanation above it use (E3-09). It was
                  // `!` while te vol was two loosely related things; now that the rule has one definition, one signal
                  // wearing two glyphs on the same screen reads as two different problems. The width argument that
                  // justified a bare marker still holds and is untouched: `▲` is no wider than `!`.
                  <span className="font-bold text-attentie-ink">
                    ▲<span className="sr-only"> {t("spine.teVol")}</span>
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
