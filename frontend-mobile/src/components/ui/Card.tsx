import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn("rounded-2xl border border-rand bg-surface p-4 shadow-kaart", className)}
      {...props}
    >
      {children}
    </div>
  );
}
