import { DOELSOORT_MARK, type Doelsoort } from "../../lib/types";
import { DOELSOORTVLAK } from "./doelsoortkleuren";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * The doelsoort of a leerplandoel, as a colour AND Op.stap's own mark ("MD", "G", "+", "P", "S",
 * "A"). Never the colour alone: Art. XII fixes the hues, and WCAG 2.2 AA 1.4.1 forbids colour as
 * the only carrier of a distinction.
 *
 * The hue tables live in `doelsoortkleuren.ts`, because a component file that also exports constants
 * breaks fast refresh for every file that imports it.
 */
export function Doelsoortmerk({ soort, className }: { soort: Doelsoort; className?: string }) {
  return (
    <span
      className={cn(
        "mono inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1",
        "text-[0.6875rem] font-medium leading-none",
        DOELSOORTVLAK[soort],
        className,
      )}
      // The mark is an abbreviation, so the full name goes to assistive technology and to a
      // hovering mouse. Both read the same string.
      title={t(`doelsoort.${soort}`)}
    >
      <span aria-hidden="true">{DOELSOORT_MARK[soort]}</span>
      <span className="sr-only">{t(`doelsoort.${soort}`)}</span>
    </span>
  );
}
