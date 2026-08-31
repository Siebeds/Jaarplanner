import { t } from "../i18n";
import { cn } from "../lib/cn";

/**
 * The wordmark: the product name over a three segment bar.
 *
 * The bar is the school year, cut into periods, which is the one shape this whole application is
 * about. It is the same figure the Plan screen enlarges into its year strip, so the mark is a
 * miniature of the product rather than an ornament stuck beside it.
 *
 * **`compact` is the mark for the 56px rail** (owner, 2026-08-31): the bar alone, at a third of its
 * width and slightly thicker so it still reads as a mark rather than as a stray hairline. The word is
 * what goes, which is exactly what the rail does to every label beneath it, and the bar is the half
 * that survives shrinking. The name stays available to a screen reader, so collapsing the sidebar
 * does not take the product's name out of the accessibility tree.
 */
export function Merk({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1.5", compact && "items-center gap-0")}>
      {compact ? (
        <span className="sr-only">{t("app.naam")}</span>
      ) : (
        <span className="font-display text-[1.0625rem] font-bold leading-none tracking-[-0.03em] text-inkt">
          {t("app.naam")}
        </span>
      )}
      <span
        aria-hidden="true"
        className={cn("flex gap-[3px]", compact ? "h-[4px] w-[32px]" : "h-[3px] w-[104px]")}
      >
        <span className="h-full flex-[4] rounded-full bg-accent" />
        <span className="h-full flex-[3] rounded-full bg-lijn-sterk" />
        <span className="h-full flex-[5] rounded-full bg-lijn-sterk" />
      </span>
    </div>
  );
}
