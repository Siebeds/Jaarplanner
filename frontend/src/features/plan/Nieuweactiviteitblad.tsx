import { useId, useMemo, useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Keuze } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { useThemasVoorKlas } from "../../lib/queries";
import { volleDag } from "../../lib/datum";
import { t } from "../../i18n";
import { Activiteitformulier, type ActiviteitInvoer } from "../activiteiten/Activiteitformulier";
import { useMaakActiviteit } from "../themas/mutaties";

/**
 * Making an activiteit that does not exist yet, from the day it is needed on.
 *
 * The picker offers what the school already owns, and a teacher standing on a Tuesday with something
 * they actually do that afternoon had nowhere to put it: the way to add one ran through the thema
 * page, which meant leaving the day, finding the thema, finding the subthema, and coming back to a
 * calendar that had forgotten where you were.
 *
 * **It is the same form as everywhere else.** `Activiteitformulier` owns what an activiteit is; this
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
  lesuur,
  klasId,
  themaIds,
  /** The subthema running on this day, if one is. Used as the default, never as the only option. */
  voorstelSubthemaId,
  planBezig,
  planFout,
  onPlan,
  onSluit,
}: {
  datum: string | null;
  lesuur?: number;
  klasId: string | null;
  themaIds: string[];
  voorstelSubthemaId?: string;
  planBezig: boolean;
  /** What the server said about the placement, in Dutch, already composed for the teacher. */
  planFout: string | null;
  /** Hand the freshly made activiteit to the screen, which owns the placement. */
  onPlan: (activiteitId: string) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const { themas, laadt } = useThemasVoorKlas(themaIds, klasId);

  // Every subthema of every thema running in this period, in the order the picker lists them, so the
  // dropdown and the list above it do not disagree about what this period contains. Subthema's with
  // no activiteiten are in here and deliberately so: an empty subthema is precisely the one a teacher
  // is most likely to be filling, and the picker cannot show it because it has nothing to show.
  const keuzes = useMemo(
    () =>
      themas.flatMap((thema) =>
        thema.subthemas.map((sub) => ({
          id: sub.id,
          naam: sub.naam,
          themaId: thema.id,
          themaNaam: thema.naam,
          onderzoeksvragen: sub.onderzoeksvragen,
        })),
      ),
    [themas],
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
    const nieuw = await maak.mutateAsync({ subthemaId: actief.id, invoer });
    onPlan(nieuw.id);
  }

  // Handed to the form rather than rendered here: it already has a place for what went wrong with
  // the activiteit itself, and a second copy of the same sentence in `extra` would appear beside it.
  const maakFout = maak.isError ? maak.error : undefined;

  if (datum === null) return null;

  if (laadt || !actief) {
    return (
      <Blad open onOpenChange={(open) => !open && onSluit()} maat="breed" titel={t("activiteit.nieuwTitel")}>
        {laadt ? <Laadlijst rijen={4} /> : <p className="text-body text-inkt-zacht">{t("periode.geenSubthemaOmIn")}</p>}
      </Blad>
    );
  }

  return (
    <Activiteitformulier
      open
      onderzoeksvragen={actief.onderzoeksvragen}
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
            {lesuur === undefined
              ? t("periode.enOpDeze", { dag: volleDag(datum) })
              : t("periode.enOpDezeLesuur", { dag: volleDag(datum), nummer: lesuur })}
          </p>

          {/* The activiteit was made and the placement was refused, so the two halves of Bewaren
              landed differently. Rendered under the day line because that is the half that failed. */}
          {planFout ? (
            <p className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {t("periode.gemaaktNietGepland")} {planFout}
            </p>
          ) : null}
        </>
      }
    />
  );
}
