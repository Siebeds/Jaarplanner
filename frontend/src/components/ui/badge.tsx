import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

/**
 * shadcn/ui Badge — copied into the repo per ADR-0017 and extended with the
 * Jaarplanner semantic variants (doelsoort / suggestiestatus / dekking) that read
 * straight from the design tokens (src/index.css ↔ tailwind.config.js).
 *
 * Colour is never the sole signal (WCAG 2.2 AA, ADR-0017 §4): every badge also
 * carries its label/abbreviation as text. Variant names use Dutch domain language.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        outline: "border-input text-foreground",

        // doelsoort — Op.stap goal types (Art. XII)
        md: "border-transparent bg-doelsoort-md text-doelsoort-md-foreground",
        gemeenschappelijk:
          "border-transparent bg-doelsoort-gemeenschappelijk text-doelsoort-gemeenschappelijk-foreground",
        verdieping:
          "border-transparent bg-doelsoort-verdieping text-doelsoort-verdieping-foreground",
        precurriculum:
          "border-transparent bg-doelsoort-precurriculum text-doelsoort-precurriculum-foreground",
        specifiek:
          "border-transparent bg-doelsoort-specifiek text-doelsoort-specifiek-foreground",
        anderstalige:
          "border-transparent bg-doelsoort-anderstalige text-doelsoort-anderstalige-foreground",

        // suggestiestatus — DoelKoppeling lifecycle (Art. IV)
        voorgesteld:
          "border-suggestie-voorgesteld bg-transparent text-suggestie-voorgesteld",
        aanvaard:
          "border-transparent bg-suggestie-aanvaard text-suggestie-aanvaard-foreground",
        geweigerd:
          "border-suggestie-geweigerd bg-transparent text-suggestie-geweigerd line-through",
        manueel:
          "border-transparent bg-suggestie-manueel text-suggestie-manueel-foreground",

        // dekking — coverage state (FR-9)
        gedekt:
          "border-transparent bg-dekking-gedekt text-dekking-gedekt-foreground",
        "niet-gedekt":
          "border-transparent bg-dekking-niet-gedekt text-dekking-niet-gedekt-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
