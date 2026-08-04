import { Link, useLocation } from "react-router-dom";

import { DoelsoortBadge } from "../../components/DoelsoortBadge";
import { doelsoortBadgeSoort } from "../../components/doelsoort";
import { t } from "../../i18n";
import type { DoelDekking } from "./types";

/**
 * One leerplandoel and whether this class's plan covers it (E5-02, FR-9.1).
 *
 * **A register row, not a card**, and deliberately the same row language as the Doelen-register (E1-16): the code in
 * mono as a left spine, the doelsoort badge, the jaar/fase, the goal text. A teacher who has browsed `/doelen` should
 * not have to learn a second way of reading a leerplandoel.
 *
 * **What differs is which axis owns the left edge.** In the register it carries the doelsoort hue, because that is
 * what a teacher scans a subdomein for. Here it carries the **dekking** state, because that is what this screen is
 * for; the doelsoort keeps its letter badge, so Art. XII's colour-plus-label redundancy is intact either way.
 *
 * **Covered is the loud state, not the gap.** The green fill goes on "Gedekt" and "Niet gedekt" stays a quiet outline.
 * That is the opposite of the obvious choice and the reason is the data: in September a freshly planned class is
 * legitimately uncovered almost everywhere, so a solid red chip per row would paint the normal state as an emergency
 * and, by covering the whole screen, would stop signalling anything at all. Coverage is the thing being recorded;
 * absence is the default it starts from.
 *
 * **Never colour alone** (Art. XII, WCAG 2.2 AA): every row carries the word "Gedekt" or "Niet gedekt", so the hue is
 * reinforcement. The row is also **not a link**: there is nothing to open here (the read-only detail lives in the
 * register, and sending a teacher out of the overview to read one goal is a worse trade than showing the text inline).
 */
export function Doeldekkingregel({ doel }: { doel: DoelDekking }) {
  const soort = doelsoortBadgeSoort[doel.doelsoort];
  const location = useLocation();

  return (
    <li
      className={[
        "flex flex-col gap-1 border-l-4 border-b border-b-border/70 py-2.5 pl-3 pr-3",
        "sm:flex-row sm:items-baseline sm:gap-3",
        doel.isGedekt ? "border-l-dekking-gedekt" : "border-l-dekking-niet-gedekt",
      ].join(" ")}
    >
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-sm font-semibold text-ink" data-cijfers>
          {doel.code}
        </span>
        <DoelsoortBadge doelsoort={soort} />
        <span className="text-xs font-medium text-ink-zacht">{doel.jaarFase}</span>
        {doel.nietMeerInOpstap && (
          // Text, not a colour and not a tooltip: a state a teacher must act on says so out loud (E3-06). The key is
          // the register's, reused rather than duplicated — it is the same fact about the same field.
          //
          // **A LINK, unlike in the register** (antagonist MINOR-7). There the marker sits inside a row that is itself
          // a link to `Doeldetail`, which renders `doelen.vervallenUitleg`, so a teacher can find out what to check.
          // Here the row is deliberately not a link and that explanation is on no screen, so the word "nakijken" was an
          // instruction with no route to its own meaning. Making the marker itself the link keeps the row unclickable
          // (nothing else on it opens anything) while giving the one thing on it that demands follow-up somewhere to go.
          // Inline prose per row was the alternative, and this screen's rule is that prose is the first thing to cut.
          <Link
            // `search` is carried along, like every other cross-screen link in this app (ADR-0021). Without it,
            // following the marker emptied the shell's klas/schooljaar pickers — `useSelectie` reads the selection
            // *only* from the URL — and at desktop width `Doeldetail`'s way back is `lg:hidden`, so a teacher was
            // stranded with no in-app route back to their own class. A defect introduced by making this a link at all,
            // found by the round-2 audit enumerating every `to={` in the app: this was the only one missing it.
            to={{ pathname: `/doelen/${encodeURIComponent(doel.code)}`, search: location.search }}
            // `min-h-6` for SC 2.5.8 (Target Size Minimum, AA in WCAG 2.2), which begins to apply the moment this
            // becomes interactive: the text is 11px on a 1.5 line-height with `py-0.5`, so it computed to ~20px. The
            // Inline and Spacing exceptions each plausibly excused it, and this project's rule is to measure rather
            // than to argue, so it is simply made 24px instead.
            className="inline-flex min-h-6 items-center rounded-full bg-attentie-zacht px-2 text-[0.6875rem] font-semibold text-attentie-ink underline decoration-attentie-ink/40 underline-offset-2 hover:decoration-attentie-ink"
          >
            {t("doelen.vervallenMarkering")}
          </Link>
        )}
      </span>

      <span className="min-w-0 flex-1 text-sm text-ink">
        {/* Not truncated, unlike the register's row. There a teacher is looking a known code up and the text is a
            hint; here they are deciding whether an uncovered goal is one they already teach, which needs the whole
            sentence. */}
        {doel.tekst}

        {/* THE EVIDENCE HALF OF ART. V, inline under the goal it justifies. A screen that claims coverage has to be
            able to say through what, and this is the only place that can: an export (E5-06) reads the same field. */}
        {doel.isGedekt && (
          <span className="mt-0.5 block text-xs text-ink-zacht">
            {t("dekking.dekkendeThemas", { themas: doel.dekkendeThemas.join(", ") })}
          </span>
        )}
      </span>

      <span
        className={[
          "shrink-0 self-start rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
          doel.isGedekt
            ? "bg-dekking-gedekt text-dekking-gedekt-foreground"
            : "border border-dekking-niet-gedekt text-dekking-niet-gedekt",
        ].join(" ")}
      >
        {doel.isGedekt ? t("dekking.gedekt") : t("dekking.nietGedekt")}
      </span>
    </li>
  );
}
