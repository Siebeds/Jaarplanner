import { DOELSOORTEN, type Doelsoort, type LeerplandoelFacetten } from "../../lib/types";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { cn } from "../../lib/cn";

/**
 * The mix of doelsoorten in whatever the teacher is currently looking at, as one bar, and the
 * control that narrows to one of them.
 *
 * This is the only place in the app where the palette is the point rather than a label. The whole
 * interface is achromatic so that these six hues mean something; showing them side by side, in
 * proportion, is what makes that vocabulary learnable. It also answers a question the tree cannot:
 * how much of this selection is decreed (MD) and how much is the school's own room to move.
 *
 * The bar is decorative and hidden from assistive technology. The row of marks under it carries
 * every bit of the same information as text, and it is the row that is operable, so nothing here
 * depends on seeing colour.
 */
const BALK: Record<Doelsoort, string> = {
  Minimumdoel: "bg-doelsoort-md",
  Gemeenschappelijk: "bg-doelsoort-gemeenschappelijk",
  Verdieping: "bg-doelsoort-verdieping",
  Precurriculum: "bg-doelsoort-precurriculum",
  Specifiek: "bg-doelsoort-specifiek",
  AnderstaligeNieuwkomers: "bg-doelsoort-anderstalige",
};

export function Doelsoortbalk({
  facetten,
  actief,
  onKies,
}: {
  facetten?: LeerplandoelFacetten;
  actief?: Doelsoort;
  onKies: (soort?: Doelsoort) => void;
}) {
  // Op.stap's own order, not the response order, so the bar does not reshuffle itself between two
  // filters and make the teacher re-read it.
  const soorten = DOELSOORTEN.map((soort) => ({
    soort,
    aantal: facetten?.doelsoorten.find((facet) => facet.doelsoort === soort)?.aantal ?? 0,
  })).filter((rij) => rij.aantal > 0);

  if (soorten.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <div aria-hidden="true" className="flex h-2 gap-[3px] overflow-hidden">
        {soorten.map(({ soort, aantal }) => (
          <span
            key={soort}
            style={{ flexGrow: aantal }}
            className={cn(
              "h-full rounded-full transition-opacity duration-200",
              BALK[soort],
              // Narrowing to one doelsoort dims the rest rather than removing them, so the shape of
              // the whole stays visible while one part of it is in focus.
              actief && actief !== soort ? "opacity-20" : "opacity-100",
            )}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {soorten.map(({ soort, aantal }) => {
          const gekozen = actief === soort;
          return (
            <li key={soort}>
              <button
                type="button"
                aria-pressed={gekozen}
                onClick={() => onKies(gekozen ? undefined : soort)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full border px-2 transition-colors duration-150",
                  gekozen ? "border-inkt bg-vlak-diep" : "border-lijn bg-kaart hover:border-lijn-veld",
                )}
              >
                <Doelsoortmerk soort={soort} />
                <span className="mono text-[0.6875rem] text-inkt-zacht">{aantal}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
