import { t } from "../i18n";

/**
 * The wordmark: the product name over a three segment bar.
 *
 * The bar is the school year, cut into periods, which is the one shape this whole application is
 * about. It is the same figure the Plan screen enlarges into its year strip, so the mark is a
 * miniature of the product rather than an ornament stuck beside it.
 */
export function Merk() {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-display text-[1.0625rem] font-bold leading-none tracking-[-0.03em] text-inkt">
        {t("app.naam")}
      </span>
      <span aria-hidden="true" className="flex h-[3px] w-[104px] gap-[3px]">
        <span className="h-full flex-[4] rounded-full bg-inkt" />
        <span className="h-full flex-[3] rounded-full bg-lijn-sterk" />
        <span className="h-full flex-[5] rounded-full bg-lijn-sterk" />
      </span>
    </div>
  );
}
