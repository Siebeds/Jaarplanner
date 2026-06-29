import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — the shadcn/ui class-name helper (ADR-0017). Merges conditional class
 * lists (clsx) and de-duplicates conflicting Tailwind utilities (tailwind-merge),
 * so later tokens win, e.g. `cn("bg-muted", isActive && "bg-doelsoort-md")`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
