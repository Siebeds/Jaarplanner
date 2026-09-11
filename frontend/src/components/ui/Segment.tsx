import { cn } from "../../lib/cn";

/**
 * A two-or-three way switch between views of the same screen. A radiogroup rather than tabs,
 * because the choice changes WHAT is listed, not which panel of one thing is showing, and a
 * radiogroup is what a screen reader user can arrow through.
 *
 * **The selected option is outlined in `inkt-zwak`, and that outline is the state.** It used to be
 * `lijn-sterk`, and with the white fill and the soft shadow that made three cues that all measured
 * under WCAG 1.4.11's 3:1 against the track: 1.18:1 for the fill, 1.39:1 for the border in the light
 * palette, and the shadow vanishes on slate. `inkt-zwak` measures 4.2:1 against the light track and
 * 6.8:1 against the dark one. Found by the dark-mode audit (ADR-0027), but it was a defect in both.
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
              gekozen ? "border border-inkt-zwak bg-kaart text-inkt shadow-licht" : "border border-transparent text-inkt-zacht hover:text-inkt",
            )}
          >
            {optie.label}
          </button>
        );
      })}
    </div>
  );
}
