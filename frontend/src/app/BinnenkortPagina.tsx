import { t, type TranslationKey } from "../i18n";
import { Merkteken } from "./Merkteken";

/**
 * The honest placeholder behind a nav item whose screen is not built yet (E0-10 clause 2).
 *
 * E0-10 allowed two options — leave the destination out of the nav, or label it explicitly as unavailable.
 * Labelling it won: the six-item information architecture (`ui-ux-approach.md` §3) is itself something the
 * directie/teacher review should see and react to, and a menu that hides four of its six entries shows a
 * smaller tool than the one being built. What is not allowed is the third option — a nav item that looks
 * ready and quietly does nothing.
 *
 * So this page says plainly that nothing works here yet, then says what will. It deliberately offers no
 * controls at all: "a control that does nothing teaches a review the wrong thing" (E3-06).
 */
export function BinnenkortPagina({ uitlegKey }: { uitlegKey: TranslationKey }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center rounded-lg border border-dashed border-border bg-card/70 px-6 py-14 text-center">
      <Merkteken className="h-10 w-10 text-border" />
      <h2 className="mt-5 text-xl font-bold text-ink">{t("binnenkort.titel")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-zacht">{t("binnenkort.uitleg")}</p>
      <p className="mt-5 max-w-md border-t border-border pt-5 text-sm leading-relaxed text-ink">
        {t(uitlegKey)}
      </p>
    </section>
  );
}
