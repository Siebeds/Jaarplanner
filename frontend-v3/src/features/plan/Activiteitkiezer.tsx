import { Blad } from "../../components/ui/Blad";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Doelmerk } from "../../components/ui/Doelmerk";
import { useThemasVoorKlas } from "../../lib/queries";
import { volleDag } from "../../lib/datum";
import { t } from "../../i18n";
import { IcoonPlus } from "../../components/Iconen";

/**
 * The activiteiten a teacher can put on one day.
 *
 * It offers the activiteiten of the thema's that are PLANNED IN THIS PERIOD, not every activiteit
 * the school owns. That is the honest default: an activiteit belongs to a subthema, a subthema to a
 * thema, and a thema runs in a period. Offering the whole library here would mostly offer things
 * that do not belong on that day, and the server's own "valt buiten themaperiode" flag exists
 * precisely because doing it anyway is a decision worth marking.
 *
 * **It also offers the way out of itself.** What the school owns is not what a teacher does, and the
 * list used to be the whole answer: an activiteit that was not in it had to be made on the thema
 * page, three navigations away from the day it was needed on, after which the calendar had forgotten
 * where you were standing. The row at the bottom makes it here instead, in the subthema this period
 * is running, and plans it on the day in the same press.
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
  onNieuw,
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
  /** Make one that does not exist yet. The screen owns the sheet that does it. */
  onNieuw: () => void;
  onSluit: () => void;
}) {
  const { themas, laadt } = useThemasVoorKlas(themaIds, klasId);

  // Offered only when there is somewhere to put it. An activiteit belongs to a subthema, so a period
  // whose thema's have none cannot take one, and a row that opens a sheet with an empty dropdown is a
  // control that does nothing. It also keeps the sentence under the row true: it promises a subthema
  // of this period, and this is the condition that makes one exist.
  const kanNieuw = themas.some((thema) => thema.subthemas.length > 0);

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
                              {/* Unconditional, and labelled. This used to be a bare mono figure
                                  rendered only when it was above zero, so an activiteit with no
                                  doelen looked exactly like one whose count happened to be off
                                  screen, and the number itself said nothing about what it counted.
                                  Placing an activiteit with no doelen is allowed and sometimes
                                  right; it just cannot contribute to dekking, which is worth
                                  knowing before you place it rather than after. */}
                              <Doelmerk aantal={activiteit.doelkoppelingen.length} />
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

          {kanNieuw ? (
            <div className="border-t border-lijn pt-4">
              {/* A dashed edge and the plus, so it reads as "make one" rather than as the last row of
                  the list above it. Full width and at the bottom: in a period this is a handful of
                  activiteiten, so the end of the list is on screen, and putting it first would put
                  the rarer intention above the choice a teacher came here to make. */}
              <button
                type="button"
                disabled={bezig}
                onClick={onNieuw}
                className="flex w-full items-center gap-3 rounded-veld border border-dashed border-lijn-veld bg-kaart px-3 py-2.5 text-left transition-colors duration-150 hover:border-accent hover:bg-accent-zacht/40 disabled:opacity-50"
              >
                <IcoonPlus aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-accent">{t("periode.nieuweActiviteit")}</span>
                  <span className="block text-meta text-inkt-zacht">{t("periode.nieuweActiviteitUitleg")}</span>
                </span>
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Blad>
  );
}
