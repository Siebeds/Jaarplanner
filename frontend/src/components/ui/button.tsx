import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

/**
 * shadcn/ui Button — copied into the repo per ADR-0017 ("copied in", no remote
 * registry at runtime) and styled with our Tailwind design tokens. Radix `Slot`
 * powers `asChild` so the button styles can wrap a custom element (e.g. a link)
 * while keeping accessible focus/keyboard behaviour. WCAG 2.2 AA focus ring.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold",
    "transition-[background-color,box-shadow,transform] duration-150 ease-uit",
    // A 1px lift on press is the whole interaction feedback budget: enough to feel
    // physical, not enough to read as decoration.
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-petrol text-petrol-foreground shadow-card hover:bg-petrol-helder",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        outline: "border border-input bg-card text-ink shadow-card hover:bg-petrol-wash",
        ghost: "text-ink hover:bg-petrol-wash hover:text-petrol",
        // Confirming something unrecoverable (E3-07: taking a decided or locked thema out of a period).
        //
        // Built from the **attentie** hue, not a new red. Art. XII already spends six hues on doelsoort and
        // more on suggestiestatus and dekking, so chrome gets petrol plus one attention hue and nothing else —
        // a bespoke destructive red would be the second chrome accent that competes with the signal this tool
        // exists to send.
        //
        // Specifically `attentie-ink` (`rgb(103,54,20)`) rather than `attentie` (`rgb(179,97,15)`), on two
        // grounds — **margin** and **hierarchy**, not a contrast failure:
        //   white on `attentie-ink` = 9.93:1;  white on `attentie` = 4.53:1;  hover (brightness-110) = 8.98:1.
        // `attentie` *passes* the 4.5:1 floor, by 0.03. E7-10's entry records why that is not good enough to
        // build on: a value clearing a threshold by hundredths is "too thin to cite as evidence later", and
        // `--attentie` has already been re-tuned once. `attentie-ink` also reads heavier than the warning tint it
        // sits beside in the same panel, which is the right hierarchy for the card's one irreversible action.
        //
        // *Correction, recorded because this comment gets cited elsewhere:* an earlier revision claimed white on
        // `attentie` measured **4.31:1** and therefore FAILED. That was an arithmetic slip in the green channel,
        // caught by the E3-07 antagonist audit and re-derived twice since. The choice held; the stated reason did
        // not. Colour is never the only carrier either way — this button reads "Ja, verwijderen" under a question
        // naming the thema and the period.
        destructive: "bg-attentie-ink text-white shadow-card hover:brightness-110",
        // **Triggering** something unrecoverable, where `destructive` above *confirms* it (E4-06 fix round 1,
        // owner ruling 2026-07-31).
        //
        // The kalender's edit panel stacks reversible and unrecoverable actions in one column — "Losmaken" and
        // "Weigering terugdraaien" directly above "Uit deze periode halen" — and at 390px a hairline rule was the
        // only thing between them, all three in `outline`. E4-06 made that worse by putting a lock control on the
        // most common card, the one where deleting an untouched proposal fires on a single click with no
        // confirmation (the ratified E3-07 rule). So the trigger gets its own weight.
        //
        // Same `attentie-ink` as `destructive`, deliberately **no new hue**: Art. XII spends six on doelsoort plus
        // more on suggestiestatus and dekking, so chrome is petrol plus one attention hue. Lighter than
        // `destructive` because it is not yet the point of no return, and it must not look like the confirm button
        // it leads to. Composited and measured in a browser, not jsdom: label `rgb(103,54,20)` on the `bg-card`
        // white = 9.74:1 (needs 4.5); the border against the panel well `paper-diep/60` over card,
        // `rgb(248,247,244)`, = 9.07:1 (SC 1.4.11 needs 3). It is also **not colour alone** (Art. XII): the border
        // is a solid dark rule where the neutral `outline` sits on the pale `input` token, a luminance difference
        // that survives monochrome, and the label says what it does.
        destructiveOutline:
          "border border-attentie-ink bg-card text-attentie-ink shadow-card hover:bg-attentie-zacht",
      },
      size: {
        // Comfortable targets: these are used by non-technical adults, sometimes on a
        // laptop trackpad (NFR-2). 36px was the old default and read as cramped.
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-3.5 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
