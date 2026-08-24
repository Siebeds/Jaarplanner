import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes so a caller's override actually wins over a component's default. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
