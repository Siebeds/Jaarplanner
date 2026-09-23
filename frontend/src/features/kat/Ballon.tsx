import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Towards whom the tail points: his head beside it, or below it. */
export type Staart = "links" | "rechts" | "onder";

const PAD: Record<Staart, { viewBox: string; d: string }> = {
  links: { viewBox: "0 0 18 14", d: "M18 1 C 12 6, 6 10, 0 13 C 7 12.5, 13 11, 18 9" },
  rechts: { viewBox: "0 0 18 14", d: "M18 1 C 12 6, 6 10, 0 13 C 7 12.5, 13 11, 18 9" },
  onder: { viewBox: "0 0 16 16", d: "M3 1 C 4 7, 2.5 12, 0 16 C 6 12.5, 10 7, 13 1" },
};

/**
 * What Chuck says: a comic balloon with an ink outline and a tail to his head (FB-071). The comic is in the shape, not
 * in the letter: the text stays IBM Plex Sans, because a comic face would lean towards babytaal. What a teacher types
 * stays a plain box, so it is always clear who is speaking.
 *
 * The tail's fill covers the border where it joins, so balloon and tail read as one outline.
 */
export function Ballon({
  staart,
  children,
  className,
  pop,
  als: Tag = "p",
}: {
  staart: Staart;
  children: ReactNode;
  className?: string;
  /** A `div` when the balloon holds lists or links, as a chat answer does (FB-031). */
  als?: "p" | "div";
  /** Appear with a small pop: when he starts to say something, not on every render. */
  pop?: boolean;
}) {
  const pad = PAD[staart];
  return (
    <Tag data-staart={staart} className={cn("ballon px-3 py-1.5 text-meta leading-snug", pop && "pop", className)}>
      {children}
      <svg className="ballon-staart" viewBox={pad.viewBox} aria-hidden="true" focusable="false">
        <path d={pad.d} />
      </svg>
    </Tag>
  );
}
