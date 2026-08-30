import { cn } from "../../lib/cn";

/**
 * A two-or-three way switch between views of the same screen. A radiogroup rather than tabs,
 * because the choice changes WHAT is listed, not which panel of one thing is showing, and a
 * radiogroup is what a screen reader user can arrow through.
 */
export function Segment<T extends string>({
  label,
  waarde,
  opties,
  onKies,
  className,
}: {
  label: string;
  waarde: T;
  opties: { waarde: T; label: string }[];
  onKies: (waarde: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-veld border border-lijn bg-vlak-diep p-1", className)}
    >
      {opties.map((optie) => {
        const gekozen = optie.waarde === waarde;
        return (
          <button
            key={optie.waarde}
            type="button"
            role="radio"
            aria-checked={gekozen}
            onClick={() => onKies(optie.waarde)}
            className={cn(
              "min-h-9 flex-1 whitespace-nowrap rounded-[0.5rem] px-3 text-meta font-medium transition-colors duration-150",
              gekozen ? "border border-lijn-sterk bg-kaart text-inkt shadow-licht" : "border border-transparent text-inkt-zacht hover:text-inkt",
            )}
          >
            {optie.label}
          </button>
        );
      })}
    </div>
  );
}
