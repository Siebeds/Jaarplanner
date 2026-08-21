import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Variant = "primair" | "secundair" | "geest" | "gevaar";
type Grootte = "normaal" | "klein" | "icoon";

const VARIANT_KLASSEN: Record<Variant, string> = {
  primair: "bg-terra text-terra-foreground shadow-kaart active:bg-terra-diep disabled:bg-ink-zwak/40",
  secundair: "bg-surface-verhoogd text-ink border border-rand active:bg-terra-zacht",
  geest: "bg-transparent text-terra active:bg-terra-zacht",
  gevaar: "bg-suggestie-geweigerd text-suggestie-geweigerd-foreground active:opacity-90",
};

const GROOTTE_KLASSEN: Record<Grootte, string> = {
  normaal: "h-touch px-4 text-sm font-semibold",
  klein: "h-9 px-3 text-xs font-semibold",
  icoon: "h-touch w-touch",
};

export function Button({
  variant = "primair",
  size = "normaal",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Grootte; children: ReactNode }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-2xl transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_KLASSEN[variant],
        GROOTTE_KLASSEN[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
