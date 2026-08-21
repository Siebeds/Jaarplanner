import type { ReactNode } from "react";
import type { Doelsoort, KoppelingStatus } from "../../lib/types";
import { DOELSOORT_CODE } from "../../lib/types";
import { cn } from "../../lib/utils";

const DOELSOORT_KLASSEN: Record<Doelsoort, string> = {
  Minimumdoel: "bg-doelsoort-md text-doelsoort-md-foreground",
  Gemeenschappelijk: "bg-doelsoort-gemeenschappelijk text-doelsoort-gemeenschappelijk-foreground",
  Verdieping: "bg-doelsoort-verdieping text-doelsoort-verdieping-foreground",
  Precurriculum: "bg-doelsoort-precurriculum text-doelsoort-precurriculum-foreground",
  Specifiek: "bg-doelsoort-specifiek text-doelsoort-specifiek-foreground",
  AnderstaligeNieuwkomers: "bg-doelsoort-anderstalige text-doelsoort-anderstalige-foreground",
};

/** Doelsoort badge: colour token + short code, never colour alone (Art. XII / WCAG 2.2 AA). */
export function DoelsoortBadge({ doelsoort }: { doelsoort: Doelsoort }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide",
        DOELSOORT_KLASSEN[doelsoort],
      )}
    >
      {DOELSOORT_CODE[doelsoort]}
    </span>
  );
}

const STATUS_KLASSEN: Record<KoppelingStatus, string> = {
  Voorgesteld: "bg-suggestie-voorgesteld text-suggestie-voorgesteld-foreground",
  Aanvaard: "bg-suggestie-aanvaard text-suggestie-aanvaard-foreground",
  Geweigerd: "bg-suggestie-geweigerd text-suggestie-geweigerd-foreground",
  Manueel: "bg-suggestie-manueel text-suggestie-manueel-foreground",
};

const STATUS_LABEL: Record<KoppelingStatus, string> = {
  Voorgesteld: "AI-voorstel",
  Aanvaard: "Aanvaard",
  Geweigerd: "Geweigerd",
  Manueel: "Manueel",
};

export function StatusBadge({ status }: { status: KoppelingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        STATUS_KLASSEN[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function DekkingBadge({ isGedekt }: { isGedekt: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        isGedekt
          ? "bg-dekking-gedekt text-dekking-gedekt-foreground"
          : "bg-dekking-niet-gedekt text-dekking-niet-gedekt-foreground",
      )}
    >
      {isGedekt ? "✓ gedekt" : "niet gedekt"}
    </span>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-terra-zacht px-2 py-0.5 text-xs font-semibold text-terra-diep",
        className,
      )}
    >
      {children}
    </span>
  );
}
