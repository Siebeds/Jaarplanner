import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The custom font sizes have to be declared here.
 *
 * tailwind-merge groups `text-*` by what it recognises, and it does not know that `text-meta` is a
 * SIZE in this theme, so it files it under text-colour and drops whatever colour came before it.
 * That is not theoretical: passing `text-meta` to a primary button deleted its `text-inkt-op` and
 * shipped white-on-near-black as near-black on near-black, which reads on screen as a button with
 * no label at all. Found by looking at the Plan screen, not by any test.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["scherm", "sectie", "body", "meta", "micro"] }],
    },
  },
});

/** Merge Tailwind classes so a caller's override actually wins over a component's default. */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
