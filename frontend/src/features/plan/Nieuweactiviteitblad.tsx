import { useId, useMemo, useState, type ReactNode } from "react";
import { Blad } from "../../components/ui/Blad";
import { Keuze } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { useInBeeld } from "../../components/ui/inBeeld";
import { useThemasVoorKlas } from "../../lib/queries";
import { geenToegangZin, useRechten } from "../../lib/rechten";
import { volleDag } from "../../lib/datum";
import { t } from "../../i18n";
import type { ActiviteitInvoer } from "../activiteiten/Activiteitformulier";
import { NieuweActiviteit } from "../activiteiten/NieuweActiviteit";
import { useMaakActiviteit } from "../themas/mutaties";
import { STANDAARDDUUR } from "./tijd";

/**
 * Making an activiteit that does not exist yet, from the day it is needed on.
 *
 * The picker offers what the school already owns, and a teacher standing on a Tuesday with something
 * they actually do that afternoon had nowhere to put it: the way to add one ran through the thema
 * page, which meant leaving the day, finding the thema, finding the subthema, and coming back to a
 * calendar that had forgotten where you were.
 *
 * **It is the same form as everywhere else.** `NieuweActiviteit` owns what an activiteit is; this
 * file owns only what the agenda adds, which is the subthema it lands in and the day it lands on.
 * That is the lesson `Activiteitblad` was written to record: the agenda once had a second form of its
 * own, and it drifted from the thema page's within one story.
 *
 * **BEWAREN DOES TWO THINGS HERE, SO IT SAYS SO.** It creates the activiteit and then plans it on the
 * day, in that order and as two requests, because the server has one endpoint for each and this asks
 * for no new one. Everywhere else in this app saving a form saves a form; here the second step is the
 * whole reason a teacher pressed the plus, so the section states it rather than leaving them to infer
 * it from what appears in the calendar afterwards. If the second request fails the first is not
 * rolled back: the activiteit exists, unplanned, and the sheet says exactly that instead of closing
 * on a half-finished job. It is then in the picker, one drag away.
 */
export function Nieuweactiviteitblad({
  datum,
  tijd,
  eindtijd,
  klasId,
  themaIds,
  /** The subthema running on this day, if one is. Used as the default, never as the only option. */
  voorstelSubthemaId,
  planBezig,
  planFout,
  planGeweigerd,
  onPlan,
  onSluit,
}: {
  datum: string | null;
  /** The time the new activiteit will start at, as a teacher reads it ("9:15"). */
  tijd?: string;
  /** The time it will end at, when the teacher dragged out a stretch; undefined when its own length decides. */
  eindtijd?: string;
  klasId: string | null;
  themaIds: string[];
  voorstelSubthemaId?: string;
  planBezig: boolean;
  /** What the server said about the placement, in Dutch, already composed for the teacher. */
  planFout: string | null;
  /** The placement was refused for want of a right (a 403): the activiteit exists, and this klas may not be planned. */
  planGeweigerd: boolean;
  /**
   * Hand the freshly made activiteit to the screen, which owns the placement.
   *
   * Its default length travels with it: the screen knows the hour the teacher pressed, and only the activiteit she
   * just described knows how long it runs.
   */
  onPlan: (activiteitId: string, duurInMinuten: number) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const { themas, laadt } = useThemasVoorKlas(themaIds, klasId);
  const { mag } = useRechten();

  // Every subthema of every thema running in this period, in the order the picker lists them, so the
  // dropdown and the list above it do not disagree about what this period contains. Subthema's with
  // no activiteiten are in here and deliberately so: an empty subthema is precisely the one a teacher
  // is most likely to be filling, and the picker cannot show it because it has nothing to show.
  //
  // Only those this gebruiker may make an activiteit in (E6-02: R17, R23). The picker offers this sheet only when
  // there is at least one.
  const keuzes = useMemo(
    () =>
      themas.flatMap((thema) =>
        thema.subthemas
          .filter((sub) => mag.activiteitMaken(sub.leeftijd))
          .map((sub) => ({
            id: sub.id,
            naam: sub.naam,
            leeftijd: sub.leeftijd,
            themaId: thema.id,
            themaNaam: thema.naam,
            onderzoeksvragen: sub.onderzoeksvragen,
            subdoelen: sub.subdoelen,
          })),
      ),
    [themas, mag],
  );

  // Null means "whatever the day suggests", which is not the same as a copy of that suggestion: a
  // copy taken at mount would survive the teacher moving the sheet to another day.
  const [gekozen, setGekozen] = useState<string | null>(null);
  const actief =
    keuzes.find((keuze) => keuze.id === gekozen) ??
    keuzes.find((keuze) => keuze.id === voorstelSubthemaId) ??
    keuzes[0];

  const maak = useMaakActiviteit(actief?.themaId ?? "");

  async function bewaarEnPlan(invoer: ActiviteitInvoer) {
    if (!actief) return;
    // Caught and not rethrown: a failed create is the mutation's error, which this sheet shows (fix round 3).
    const nieuw = await maak.mutateAsync({ subthemaId: actief.id, invoer }).catch(() => null);
    if (!nieuw) return;
    onPlan(nieuw.id, (nieuw.lengteInLesuren ?? 1) * STANDAARDDUUR);
  }

  // Handed to the form rather than rendered here: it already has a place for what went wrong with
  // the activiteit itself, and a second copy of the same sentence in `extra` would appear beside it.
  const maakFout = maak.isError ? maak.error : undefined;

  // A REFUSAL ENDS WHAT THIS SHEET CAN DO (E6-02 slice 4, fix round 3). A refused create made nothing. A refused plan
  // made the activiteit, and this klas may not be planned. Either way Bewaren would be refused again, or after a
  // refused plan make a second activiteit, and the day line would promise a plan. So from the refusal on, the sheet
  // shows the refusal as its only alert, and its close control. Decided on the refusal itself rather than on the rights
  // it refetches, so the form never shows it first and it is announced once.
  const maakWeigering = geenToegangZin(maak.error);
  const weigering =
    maakWeigering ?? (planGeweigerd && planFout ? `${t("periode.gemaaktNietGepland")} ${planFout}` : null);

  if (datum === null) return null;

  if (laadt || !actief || weigering) {
    return (
      <Blad open onOpenChange={(open) => !open && onSluit()} maat="breed" titel={t("activiteit.nieuwTitel")}>
        {/* "No subthema" only when nothing failed: after a refusal, or a placement that failed once the activiteit was
            made, the failure is what this sheet has to say. */}
        {weigering ? (
          <Bladfout>{weigering}</Bladfout>
        ) : laadt ? (
          <Laadlijst rijen={4} />
        ) : planFout ? (
          <Bladfout>
            {t("periode.gemaaktNietGepland")} {planFout}
          </Bladfout>
        ) : (
          <p className="text-body text-inkt-zacht">{t("periode.geenSubthemaOmIn")}</p>
        )}
      </Blad>
    );
  }

  return (
    <NieuweActiviteit
      open
      // The leeftijd decides "voor wie" and the goal picker of the new activiteit (ADR-0049 D1, E3; R19). Keyed on the
      // subthema, so switching to one of another leeftijd starts the choice again.
      key={actief.id}
      leeftijd={actief.leeftijd}
      onderzoeksvragen={actief.onderzoeksvragen}
      subdoelen={actief.subdoelen}
      bezig={maak.isPending || planBezig}
      fout={maakFout}
      onBewaar={(invoer) => void bewaarEnPlan(invoer)}
      onSluit={onSluit}
      extra={
        <>
          <h3 className="text-micro uppercase text-inkt-zwak">{t("periode.komtHier")}</h3>

          {/* One subthema is a SENTENCE, not a dropdown. A select with a single option is a control
              that does nothing, which this app forbids, and the teacher still needs to be told where
              their activiteit is going. The form applies the same rule to onderzoeksvragen. */}
          {keuzes.length === 1 ? (
            <p className="mt-2 text-body text-inkt">
              {t("periode.subthemaInThema", { subthema: actief.naam, thema: actief.themaNaam })}
            </p>
          ) : (
            <div className="mt-2">
              <label htmlFor={`${id}-subthema`} className="text-meta font-medium text-inkt">
                {t("periode.subthema")}
              </label>
              <Keuze
                id={`${id}-subthema`}
                value={actief.id}
                disabled={maak.isPending || planBezig}
                onChange={(e) => setGekozen(e.target.value)}
                className="mt-1.5"
              >
                {keuzes.map((keuze) => (
                  <option key={keuze.id} value={keuze.id}>
                    {/* The thema travels with the subthema: two thema's in one period can both have a
                        subthema called "de speelhoek", and an option list of bare subthema names would
                        make the teacher guess which. */}
                    {t("periode.subthemaInThema", { subthema: keuze.naam, thema: keuze.themaNaam })}
                  </option>
                ))}
              </Keuze>
            </div>
          )}

          {/* What Bewaren is about to do, said before it happens rather than shown afterwards. */}
          <p className="mt-3 text-meta text-inkt-zacht">
            {tijd === undefined
              ? t("periode.enOpDeze", { dag: volleDag(datum) })
              : eindtijd === undefined
                ? t("tijdraster.enOpDitUur", { dag: volleDag(datum), tijd })
                : t("tijdraster.enOpDitBereik", { dag: volleDag(datum), begin: tijd, einde: eindtijd })}
          </p>

          {/* The activiteit was made and the placement was refused, so the two halves of Bewaren
              landed differently. Rendered under the day line because that is the half that failed. */}
          {planFout ? (
            <Bladfout>
              {t("periode.gemaaktNietGepland")} {planFout}
            </Bladfout>
          ) : null}
        </>
      }
    />
  );
}

/**
 * A failure in this sheet, said as an alert (E6-02 slice 4, fix rounds 2 and 3, F7; WCAG 4.1.3). The sheet stays open
 * on a failure and is a modal dialog, so this is the only place it can be announced: the agenda's own strip does not
 * show a refusal that arrives while this sheet is open. Brought into the sheet's view when it appears, since on a
 * phone it lands below the visible part of the form.
 */
function Bladfout({ children }: { children: ReactNode }) {
  const ref = useInBeeld<HTMLParagraphElement>();
  return (
    <p
      ref={ref}
      role="alert"
      className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt"
    >
      {children}
    </p>
  );
}
