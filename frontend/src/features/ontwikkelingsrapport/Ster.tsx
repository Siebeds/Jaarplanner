import { sterkleur } from "./sterkleuren";
import { cn } from "../../lib/cn";

/**
 * A gradatie's star (ADR-0035 R5): a fill and a deeper edge from the fixed palette.
 *
 * Decorative on its own, so hidden from assistive technology: wherever it stands, its label stands beside it
 * (`Sterlabel`), because a star is never the only carrier of a rating (Art. XII). The shape is the same five points as
 * the Ontwikkelingsrapport icon, filled, so the destination and what it holds read as one thing.
 */
export function Ster({ kleur, hol, className }: { kleur: string; hol?: boolean; className?: string }) {
  const tint = sterkleur(kleur);
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("h-5 w-5 shrink-0", className)}>
      <polygon
        points="12,2 14.47,8.6 21.51,8.91 15.99,13.3 17.88,20.09 12,16.2 6.12,20.09 8.01,13.3 2.49,8.91 9.53,8.6"
        // A style rather than presentation attributes: `var()` is honoured there in every browser. `hol` draws the
        // outline only: a star offered but not chosen, so the chosen one is the one filled in.
        style={{ fill: hol ? "none" : (tint?.vul ?? "none"), stroke: tint?.rand ?? "currentColor" }}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A star with its label: how a gradatie appears everywhere, on screen and later on the parents' report. */
export function Sterlabel({ kleur, label, groot }: { kleur: string; label: string; groot?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Ster kleur={kleur} className={groot ? "h-6 w-6" : undefined} />
      <span className="min-w-0 break-words text-body font-medium text-inkt">{label}</span>
    </span>
  );
}
