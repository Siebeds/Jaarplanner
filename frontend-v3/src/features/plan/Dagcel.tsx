import type { Dagweergave, GeplandeActiviteit } from "../../lib/types";
import { IcoonPlus } from "../../components/Iconen";
import { volleDag } from "../../lib/datum";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * One teaching day, with what is scheduled on it.
 *
 * The same component is a column in the week view and the whole screen in the day view; only its
 * height differs. That is deliberate: a day looks the same wherever a teacher meets it, so the
 * layout switch does not also change what a day means.
 *
 * A closed day (vakantie, vrije dag) shows the name of the closure and offers no add button. The
 * server refuses a placement on a closed day, and a button that leads to a refusal is a button that
 * should not be there.
 */
export function Dagcel({
  dag,
  kop,
  groot,
  onVoegToe,
  onOpen,
}: {
  dag: Dagweergave;
  kop: string;
  groot?: boolean;
  onVoegToe: (datum: string) => void;
  onOpen: (activiteit: GeplandeActiviteit) => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-kaart border bg-kaart",
        dag.isLesdag ? "border-lijn" : "border-lijn bg-vlak-diep/60",
        groot ? "min-h-64" : "min-h-40",
      )}
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-lijn px-3 py-2">
        <span className={cn("truncate", groot ? "font-display text-sectie text-inkt" : "text-meta font-medium text-inkt")}>
          {kop}
        </span>
        {dag.activiteiten.length > 0 ? (
          <span className="mono shrink-0 text-[0.625rem] text-inkt-zwak">{dag.activiteiten.length}</span>
        ) : null}
      </div>

      {!dag.isLesdag ? (
        <p className="flex flex-1 items-center justify-center px-3 py-4 text-center text-meta text-inkt-zwak">
          {dag.sluitingsnaam ?? t("periode.geenLesdag")}
        </p>
      ) : (
        <>
          <ul className="flex flex-1 flex-col gap-1.5 p-2">
            {dag.activiteiten.map((activiteit) => (
              <li key={activiteit.plaatsingId}>
                <button
                  type="button"
                  onClick={() => onOpen(activiteit)}
                  className={cn(
                    "w-full rounded-veld border-l-2 bg-vlak px-2.5 py-2 text-left transition-colors duration-150 hover:bg-vlak-diep",
                    activiteit.valtBuitenThemaperiode ? "border-attentie" : "border-accent",
                  )}
                >
                  <span className="block truncate text-meta font-medium text-inkt">{activiteit.activiteitNaam}</span>
                  <span className="block truncate text-[0.6875rem] text-inkt-zacht">{activiteit.themaNaam}</span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => onVoegToe(dag.datum)}
            aria-label={t("periode.voegToeOp", { dag: volleDag(dag.datum) })}
            className="m-2 mt-0 flex min-h-9 items-center justify-center gap-1.5 overflow-hidden rounded-veld border border-dashed border-lijn-sterk px-2 text-meta text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            <IcoonPlus aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("periode.voegToe")}</span>
          </button>
        </>
      )}
    </div>
  );
}
