import { t } from "../i18n";
import { cn } from "../lib/cn";

/**
 * The Vizier logo (FB-083, ADR-0063): the mark with the name beside it, or the mark alone.
 *
 * **The files are the brand, this component only places them.** It loads them from `public/merk/` by
 * fixed name, so a new logo is a copy of four files with the same names and not a code change
 * (`assets/merk/README.md`). Only the box sizes below assume the delivered proportions.
 *
 * **Both colourways are in the DOM and the `dark:` variant picks one.** That variant follows the
 * explicit choice under Instellingen (`data-weergave`) as well as the device, which a `<picture>` with a
 * `prefers-color-scheme` media query could not: someone who chose dark on a light device would get the
 * light logo. The hidden one is `display: none`, so it is neither painted nor read.
 *
 * **The images are decorative and the name is text.** One `sr-only` span carries "Vizier" in both
 * states, so collapsing the sidebar to the mark does not take the product's name out of the
 * accessibility tree, and a screen reader hears the name once rather than twice.
 *
 * `compact` is the mark for the 56px rail; `groot` the size above a sign-in screen's heading.
 */
export function Merk({ compact = false, groot = false }: { compact?: boolean; groot?: boolean }) {
  const vorm = compact ? "beeldmerk" : "horizontaal";
  const maat = compact ? "h-7 w-7" : groot ? "h-10 w-auto" : "h-8 w-auto";
  return (
    <div className={cn("flex", compact && "justify-center")}>
      <span className="sr-only">{t("app.naam")}</span>
      <img src={`/merk/merk-${vorm}.svg`} alt="" aria-hidden="true" className={cn(maat, "dark:hidden")} />
      <img
        src={`/merk/merk-${vorm}-donker.svg`}
        alt=""
        aria-hidden="true"
        className={cn(maat, "hidden dark:block")}
      />
    </div>
  );
}
