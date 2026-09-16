import { Blad } from "../../components/ui/Blad";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Doelmerk } from "../../components/ui/Doelmerk";
import { useThemasVoorKlas } from "../../lib/queries";
import { isEigenVan, useRechten } from "../../lib/rechten";
import { useIk } from "../../lib/aanmelding";
import { Eigenaarmerk } from "../activiteiten/Eigenaarmerk";
import { useGebruikActiviteit } from "../themas/mutaties";
import { volleDag } from "../../lib/datum";
import { t } from "../../i18n";
import { IcoonPlus } from "../../components/Iconen";
import { STANDAARDDUUR } from "./tijd";

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
 * twice from the same START TIME (a unique index on jaarplan, activiteit, date and begin) and returns
 * a Dutch refusal naming that time, and hiding the row would leave a teacher wondering where their
 * activiteit went. Twice on one day at two different hours is allowed and normal: that is what a
 * reading moment in the morning and again after lunch looks like.
 */
export function Activiteitkiezer({
  datum,
  tijd,
  eindtijd,
  klasId,
  themaIds,
  bezig,
  onKies,
  onNieuw,
  onSluit,
}: {
  datum: string | null;
  /**
   * The time this will start at, as a teacher reads it ("9:15"), or undefined when the caller does
   * not mean a particular one. Named in the title: a teacher who clicked the grid at quarter past
   * nine has to be able to see that quarter past nine is where it goes, and the day alone does not
   * say that.
   */
  tijd?: string;
  /**
   * The time it will end at, when the teacher dragged out a stretch of the grid rather than clicking one quarter;
   * undefined when the chosen activiteit's own length decides. Named in the title for the reason the start is.
   */
  eindtijd?: string;
  klasId: string | null;
  themaIds: string[];
  bezig: boolean;
  /** The chosen activiteit, with how long it runs by default, which the screen turns into an end time. */
  onKies: (activiteitId: string, duurInMinuten: number) => void;
  /** Make one that does not exist yet. The screen owns the sheet that does it. */
  onNieuw: () => void;
  onSluit: () => void;
}) {
  const { themas, laadt } = useThemasVoorKlas(themaIds, klasId);
  const { mag } = useRechten();
  const { data: ik } = useIk();
  const gebruik = useGebruikActiviteit();

  // Offered only when there is somewhere to put it. An activiteit belongs to a subthema, so a period
  // whose thema's have none cannot take one, and a row that opens a sheet with an empty dropdown is a
  // control that does nothing. It also keeps the sentence under the row true: it promises a subthema
  // of this period, and this is the condition that makes one exist.
  //
  // "Somewhere" means a subthema this gebruiker may make an activiteit in (E6-02: R17, R23, the leerkrachten and
  // hoofdleerkrachten of its leeftijd, and directie). The sheet then offers only those.
  const kanNieuw = themas.some((thema) => thema.subthemas.some((sub) => mag.activiteitMaken(sub.leeftijd)));

  return (
    <Blad
      open={datum !== null}
      onOpenChange={(open) => !open && onSluit()}
      titel={
        datum
          ? tijd === undefined
            ? volleDag(datum)
            : eindtijd === undefined
              ? t("tijdraster.kiezerTitel", { dag: volleDag(datum), tijd })
              : t("tijdraster.kiezerTitelBereik", { dag: volleDag(datum), begin: tijd, einde: eindtijd })
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
                        {subthema.activiteiten.map((activiteit) => {
                          // A colleague's own activiteit is used first (ADR-0049 D5, D6): choosing it takes an own copy
                          // and plans that copy. Without the right to copy it, it is listed and not offered.
                          const vanCollega = activiteit.eigenaarId != null && !isEigenVan(ik, activiteit);
                          const magGebruiken = mag.activiteitGebruiken({ ...activiteit, leeftijd: subthema.leeftijd });
                          const duur = (activiteit.lengteInLesuren ?? 1) * STANDAARDDUUR;
                          if (vanCollega && !magGebruiken) {
                            return (
                              <li
                                key={activiteit.id}
                                className="flex items-center justify-between gap-3 rounded-veld border border-lijn px-3 py-2.5"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-body text-inkt-zacht">{activiteit.naam}</span>
                                  <Eigenaarmerk activiteit={activiteit} className="flex" />
                                </span>
                                <Doelmerk aantal={activiteit.doelkoppelingen.length} />
                              </li>
                            );
                          }
                          return (
                          <li key={activiteit.id}>
                            <button
                              type="button"
                              disabled={bezig || gebruik.isPending}
                              aria-label={
                                vanCollega
                                  ? t("activiteit.gebruikAria", {
                                      naam: activiteit.naam,
                                      eigenaar: activiteit.eigenaarNaam ?? t("activiteit.vanEenCollega"),
                                    })
                                  : undefined
                              }
                              // The default length travels with the choice: the screen knows where the block
                              // starts, and only the activiteit knows how long it usually runs.
                              onClick={() =>
                                vanCollega
                                  ? gebruik.mutate(activiteit.id, { onSuccess: (kopie) => onKies(kopie.id, duur) })
                                  : onKies(activiteit.id, duur)
                              }
                              className="flex w-full items-center justify-between gap-3 rounded-veld border border-lijn bg-kaart px-3 py-2.5 text-left transition-colors duration-150 hover:border-accent disabled:opacity-50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-body text-inkt">{activiteit.naam}</span>
                                {activiteit.activiteitType ? (
                                  <span className="mono block text-[0.625rem] text-inkt-zwak">
                                    {activiteit.activiteitType}
                                  </span>
                                ) : null}
                                <Eigenaarmerk activiteit={activiteit} className="flex" />
                                {vanCollega ? (
                                  <span className="block text-meta font-medium text-inkt underline decoration-dotted underline-offset-2">
                                    {gebruik.isPending ? t("activiteit.gebruikBezig") : t("activiteit.gebruik")}
                                  </span>
                                ) : null}
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
                          );
                        })}
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
