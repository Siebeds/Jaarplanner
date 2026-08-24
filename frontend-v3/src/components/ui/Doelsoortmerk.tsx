import { DOELSOORT_MARK, type Doelsoort } from "../../lib/types";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * The doelsoort of a leerplandoel, as a colour AND Op.stap's own mark ("MD", "G", "+", "P", "S",
 * "A"). Never the colour alone: Art. XII fixes the hues, and WCAG 2.2 AA 1.4.1 forbids colour as
 * the only carrier of a distinction.
 *
 * The class strings are written out per doelsoort rather than composed from the value, because
 * Tailwind scans source text: `bg-doelsoort-${soort}` generates no CSS at all and the mark would
 * ship transparent.
 */
const VLAK: Record<Doelsoort, string> = {
  Minimumdoel: "bg-doelsoort-md text-doelsoort-md-op",
  Gemeenschappelijk: "bg-doelsoort-gemeenschappelijk text-doelsoort-gemeenschappelijk-op",
  Verdieping: "bg-doelsoort-verdieping text-doelsoort-verdieping-op",
  Precurriculum: "bg-doelsoort-precurriculum text-doelsoort-precurriculum-op",
  Specifiek: "bg-doelsoort-specifiek text-doelsoort-specifiek-op",
  AnderstaligeNieuwkomers: "bg-doelsoort-anderstalige text-doelsoort-anderstalige-op",
};

export function Doelsoortmerk({ soort, className }: { soort: Doelsoort; className?: string }) {
  return (
    <span
      className={cn(
        "mono inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1",
        "text-[0.6875rem] font-medium leading-none",
        VLAK[soort],
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
