import { Blad } from "../../components/ui/Blad";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { useThemasVoorKlas } from "../../lib/queries";
import { volleDag } from "../../lib/datum";
import { t } from "../../i18n";

/**
 * The activiteiten a teacher can put on one day.
 *
 * It offers the activiteiten of the thema's that are PLANNED IN THIS PERIOD, not every activiteit
 * the school owns. That is the honest default: an activiteit belongs to a subthema, a subthema to a
 * thema, and a thema runs in a period. Offering the whole library here would mostly offer things
 * that do not belong on that day, and the server's own "valt buiten themaperiode" flag exists
 * precisely because doing it anyway is a decision worth marking.
 *
 * Nothing is filtered out for already being scheduled. The server refuses only the same activiteit
 * twice in the same LESUUR (a unique index on jaarplan, activiteit, date and volgorde) and returns a
 * Dutch refusal naming that hour, and hiding the row would leave a teacher wondering where their
 * activiteit went. Twice on one day in two different hours is allowed and normal: that is what a hoek
 * running two hours looks like.
 */
export function Activiteitkiezer({
  datum,
  lesuur,
  klasId,
  themaIds,
  bezig,
  onKies,
  onSluit,
}: {
  datum: string | null;
  /**
   * The lesuur this will land in, 1-based, or undefined when the caller does not mean a particular
   * one. Named in the title: a teacher who pressed the plus on the fourth hour has to be able to see
   * that the fourth hour is where it goes, and the day alone does not say that.
   */
  lesuur?: number;
  klasId: string | null;
  themaIds: string[];
  bezig: boolean;
  onKies: (activiteitId: string) => void;
  onSluit: () => void;
}) {
  const { themas, laadt } = useThemasVoorKlas(themaIds, klasId);

  return (
    <Blad
      open={datum !== null}
      onOpenChange={(open) => !open && onSluit()}
      titel={
        datum
          ? lesuur === undefined
            ? volleDag(datum)
            : t("lesuur.kiezerTitel", { dag: volleDag(datum), nummer: lesuur })
          : t("periode.voegToe")
      }
    >
      {themaIds.length === 0 ? (
        <p className="text-body text-inkt-zacht">{t("periode.geenThemaInPeriode")}</p>
      ) : laadt ? (
        <Laadlijst rijen={4} />
      ) : (
        <div className="flex flex-col gap-5">
          {themas.map((thema) => (
            <section key={thema.id} className="flex flex-col gap-2">
              <h3 className="text-micro uppercase text-inkt-zwak">{thema.naam}</h3>

              {thema.subthemas.every((sub) => sub.activiteiten.length === 0) ? (
                <p className="text-meta text-inkt-zwak">{t("periode.geenActiviteiten")}</p>
              ) : (
                thema.subthemas.map((subthema) =>
                  subthema.activiteiten.length === 0 ? null : (
                    <div key={subthema.id} className="flex flex-col gap-1">
                      <p className="text-meta font-medium text-inkt-zacht">{subthema.naam}</p>
                      <ul className="flex flex-col gap-1">
                        {subthema.activiteiten.map((activiteit) => (
                          <li key={activiteit.id}>
                            <button
                              type="button"
                              disabled={bezig}
                              onClick={() => onKies(activiteit.id)}
                              className="flex w-full items-center justify-between gap-3 rounded-veld border border-lijn bg-kaart px-3 py-2.5 text-left transition-colors duration-150 hover:border-accent disabled:opacity-50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-body text-inkt">{activiteit.naam}</span>
                                <span className="mono block text-[0.625rem] text-inkt-zwak">
                                  {activiteit.activiteitType}
                                </span>
                              </span>
                              {activiteit.doelkoppelingen.length > 0 ? (
                                <span className="mono shrink-0 text-[0.625rem] text-inkt-zwak">
                                  {activiteit.doelkoppelingen.length}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )
              )}
            </section>
          ))}
        </div>
      )}
    </Blad>
  );
}
