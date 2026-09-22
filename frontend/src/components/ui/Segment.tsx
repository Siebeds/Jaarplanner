import { cn } from "../../lib/cn";

/**
 * A two-or-three way switch between views of the same screen. A radiogroup rather than tabs,
 * because the choice changes WHAT is listed, not which panel of one thing is showing, and a
 * radiogroup is what a screen reader user can arrow through.
 *
 * **The selected option lies flat in the track: a card fill and semibold ink, no border, no
 * shadow** (FB-086). An outline and a shadow made it float above the track. The weight and the
 * darker ink carry the state together with the fill, so it never rests on colour alone. Each label
 * reserves the width of its semibold form, so choosing an option does not shift its neighbours.
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
              "min-h-9 flex-1 whitespace-nowrap rounded-[0.5rem] px-3 text-meta transition-colors duration-150",
              gekozen ? "bg-kaart font-semibold text-inkt" : "font-medium text-inkt-zacht hover:text-inkt",
            )}
          >
            <span
              data-label={optie.label}
              className="inline-flex flex-col after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)_/_'']"
            >
              {optie.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
