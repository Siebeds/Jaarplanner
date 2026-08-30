import type { KoppelingStatus } from "../../lib/types";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * The lifecycle status of a link or a placement (Art. IV): voorgesteld, aanvaard, geweigerd, manueel.
 *
 * A dot in the status colour AND the word, always both. The distinction between "the AI proposed
 * this" and "I decided this" is the one a teacher is accountable for, so it may never rest on a hue.
 */
const STIP: Record<KoppelingStatus, string> = {
  Voorgesteld: "bg-suggestie-voorgesteld",
  Aanvaard: "bg-suggestie-aanvaard",
  Geweigerd: "bg-suggestie-geweigerd",
  Manueel: "bg-suggestie-manueel",
};

export function Statusmerk({ status, className }: { status: KoppelingStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-lijn bg-kaart py-0.5 pl-1.5 pr-2 text-[0.6875rem] font-medium text-inkt-zacht",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", STIP[status])} />
      {t(`status.${status}`)}
    </span>
  );
}
