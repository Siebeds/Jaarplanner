import type { Dagweergave } from "../../lib/types";
import { dagNummer, maandVan, valtBinnen, weekdagKort } from "../../lib/datum";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * A month, as the grid everyone already knows: seven columns starting on Monday.
 *
 * The month view does not schedule anything. It answers one question, which is where the work sits
 * across the month, and pressing a day takes the teacher to that day where the actual placing
 * happens. Trying to make a 40 pixel cell into an editor is how month views become unusable.
 *
 * Days outside the period the teacher opened are shown rather than blanked, and dimmed: a period
 * rarely starts on the first of the month, and hiding the surrounding days makes the grid lie about
 * what a week looks like.
 */
export function Maandrooster({
  dagen,
  ankerMaand,
  periodeVan,
  periodeTot,
  onKiesDag,
}: {
  dagen: Dagweergave[];
  ankerMaand: string;
  periodeVan: string;
  periodeTot: string;
  onKiesDag: (datum: string) => void;
}) {
  if (dagen.length === 0) return null;

  const perDatum = new Map(dagen.map((dag) => [dag.datum, dag]));
  const maand = maandVan(ankerMaand);

  return (
    <div>
      <ol className="mb-1 grid grid-cols-7 gap-1">
        {dagen.slice(0, 7).map((dag) => (
          <li key={dag.datum} className="text-micro uppercase text-inkt-zwak">
            {weekdagKort(dag.datum)}
          </li>
        ))}
      </ol>

      <ol className="grid grid-cols-7 gap-1">
        {dagen.map((dag) => {
          const buitenMaand = maandVan(dag.datum) !== maand;
          const inPeriode = valtBinnen(dag.datum, periodeVan, periodeTot);
          const cel = perDatum.get(dag.datum);
          const aantal = cel?.activiteiten.length ?? 0;

          return (
            <li key={dag.datum}>
              <button
                type="button"
                onClick={() => onKiesDag(dag.datum)}
                className={cn(
                  "flex h-20 w-full flex-col gap-1 rounded-veld border p-1.5 text-left transition-colors duration-150 sm:h-24",
                  dag.isLesdag ? "bg-kaart hover:border-accent" : "bg-vlak-diep/60",
                  inPeriode && !buitenMaand ? "border-lijn" : "border-transparent",
                  buitenMaand && "opacity-45",
                )}
              >
                <span
                  className={cn(
                    "mono text-[0.6875rem]",
                    inPeriode && !buitenMaand ? "font-medium text-inkt" : "text-inkt-zwak",
                  )}
                >
                  {dagNummer(dag.datum)}
                </span>

                {!dag.isLesdag ? (
                  <span className="truncate text-[0.625rem] text-inkt-zwak">{dag.sluitingsnaam ?? t("periode.gesloten")}</span>
                ) : (
                  <span className="flex flex-1 flex-col justify-end gap-0.5 overflow-hidden">
                    {cel?.activiteiten.slice(0, 2).map((activiteit) => (
                      <span
                        key={activiteit.plaatsingId}
                        className={cn(
                          "truncate rounded border-l-2 bg-vlak px-1 text-[0.625rem] text-inkt",
                          activiteit.valtBuitenThemaperiode ? "border-attentie" : "border-accent",
                        )}
                      >
                        {activiteit.activiteitNaam}
                      </span>
                    ))}
                    {aantal > 2 ? (
                      <span className="mono text-[0.625rem] text-inkt-zwak">{t("periode.nogMeer", { aantal: aantal - 2 })}</span>
                    ) : null}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
