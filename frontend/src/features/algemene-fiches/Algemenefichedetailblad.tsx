import { useId, useMemo, useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst, volleDag, weekdagIndex } from "../../lib/datum";
import { toonBereik } from "../plan/tijd";
import { t, telWoord } from "../../i18n";
import {
  useVerplaatsFichemoment,
  type AlgemeneFichemomentWeergave,
  type AlgemeneFicheplaatsingWeergave,
} from "./gegevens";

/**
 * One planned algemene fiche: which days it runs, at which hours, and the two sizes of change.
 *
 * **One day without dragging** (WCAG 2.2 SC 2.5.7). In the time grid a moment moves by a drag and ends later by
 * pulling its edge, and neither is a keyboard or single-pointer gesture. Opened from a block, this sheet therefore
 * carries that block's own day and hours as three fields, saved through the same endpoint the drag uses. Opened from
 * the placement sheet's "Al ingepland" list there is no particular day, so there is no such section.
 *
 * **No "uren van de hele periode"**, unlike the hoek's sheet: the server has no verb for it yet, and a form that
 * would send fifteen single-day requests of which the eighth fails is the half-saved run `useZetHoekuren` exists to
 * avoid.
 *
 * **The delete says what it costs, and only where it is true.** When this is the fiche's only placement and the
 * fiche carries goals, taking it out stops the fiche counting for dekking (Art. V.1 as amended), and the sheet says
 * so before she presses. It says nothing about whether a goal stays gedekt: a thema may carry the same goal, which
 * this sheet cannot see.
 */
export function Algemenefichedetailblad({
  open,
  plaatsing,
  momentId,
  enigePeriodeMetDoelen,
  bezig,
  fout,
  onVerwijder,
  onSluit,
}: {
  open: boolean;
  plaatsing: AlgemeneFicheplaatsingWeergave;
  /** The occurrence it was opened from, or null when it was opened from a list of whole periods. */
  momentId: string | null;
  /** This is the fiche's one placement AND the fiche has goals: the case in which deleting moves dekking. */
  enigePeriodeMetDoelen: boolean;
  bezig: boolean;
  fout?: unknown;
  onVerwijder: () => void;
  onSluit: () => void;
}) {
  const groepen = useMemo(() => uurgroepen(plaatsing.momenten), [plaatsing.momenten]);
  const moment = momentId === null ? undefined : plaatsing.momenten.find((m) => m.id === momentId);
  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={plaatsing.ficheNaam}
      voet={
        <div className="flex flex-wrap items-center gap-2">
          {/* The house style for a destructive confirm, as in `Hoekdetailblad`: ink fill, not a danger hue. */}
          <Knop
            rang="stil"
            type="button"
            onClick={onVerwijder}
            disabled={bezig}
            className="bg-inkt text-inkt-op hover:bg-inkt active:bg-inkt"
          >
            {bezig ? t("fichedetail.verwijderBezig") : t("fichedetail.verwijder")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("fichedetail.sluiten")}
          </Knop>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-micro uppercase text-inkt-zwak">{t("fichedetail.periode")}</p>
          <p className="mt-0.5 text-body text-inkt">{periodeTekst(plaatsing.van, plaatsing.tot)}</p>
        </div>

        <div>
          <p className="text-micro uppercase text-inkt-zwak">{t("fichedetail.uurrooster")}</p>
          {/* Per stretch of hours, the most common first, for the reason `Hoekdetailblad` prints them that way: after
              one Monday moved, "the run's hours" read off the first day would be false for the others. */}
          <div className="mt-0.5 flex flex-col">
            {groepen.map((groep) => (
              <p key={`${groep.begin}-${groep.einde}`} className="text-body text-inkt">
                {t("fichedetail.opUur", {
                  periode: toonBereik(groep.begin, groep.einde),
                  dagen: telWoord(groep.dagen, "fichedetail.eenSchooldag", "fichedetail.aantalSchooldagen"),
                })}
              </p>
            ))}
          </div>
        </div>

        {moment ? (
          // Keyed on the moment's saved values, so a refetch after a save (or a drag in another view) refills the
          // fields instead of leaving the old answer in them.
          <Momentvorm
            key={`${moment.id}-${moment.datum}-${moment.begin}-${moment.einde}`}
            plaatsing={plaatsing}
            moment={moment}
            vergrendeld={bezig}
          />
        ) : null}

        {enigePeriodeMetDoelen ? <p className="text-meta text-inkt-zacht">{t("fichedetail.laatstePeriode")}</p> : null}

        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("fichedetail.verwijderMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </div>
    </Blad>
  );
}

/**
 * One occurrence's day and hours, as fields: the non-drag route to what the grid does by dragging.
 *
 * Not a `<form>`, for the reason `Hoekdetailblad`'s verrijking form gives: a sheet may sit inside one.
 */
function Momentvorm({
  plaatsing,
  moment,
  vergrendeld,
}: {
  plaatsing: AlgemeneFicheplaatsingWeergave;
  moment: AlgemeneFichemomentWeergave;
  /** The delete is running; nothing else in the sheet should start. */
  vergrendeld: boolean;
}) {
  const id = useId();
  const verplaats = useVerplaatsFichemoment();
  const [datum, setDatum] = useState(moment.datum);
  const [begin, setBegin] = useState(moment.begin.slice(0, 5));
  const [einde, setEinde] = useState(moment.einde.slice(0, 5));

  const urenOngeldig = begin === "" || einde === "" || einde <= begin;
  // A weekend the sheet can see coming; a vakantie it cannot, so that one is the server's refusal, shown below.
  const weekend = datum !== "" && weekdagIndex(datum) >= 5;
  const ongewijzigd =
    datum === moment.datum && begin === moment.begin.slice(0, 5) && einde === moment.einde.slice(0, 5);
  const detail = verplaats.error instanceof ApiError ? verplaats.error.detail : undefined;

  return (
    <div>
      <p className="text-micro uppercase text-inkt-zwak">{t("fichedetail.ditMoment", { dag: volleDag(moment.datum) })}</p>

      <div className="mt-1.5 flex flex-wrap items-end gap-2">
        <div className="min-w-36 flex-[2]">
          <label htmlFor={`${id}-dag`} className="text-micro text-inkt-zacht">
            {t("fichedetail.dag")}
          </label>
          {/* Bounded by the window: the server refuses a day outside it, so the picker does not offer one. */}
          <Invoer
            id={`${id}-dag`}
            type="date"
            min={plaatsing.van}
            max={plaatsing.tot}
            value={datum}
            disabled={verplaats.isPending || vergrendeld}
            onChange={(e) => setDatum(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="min-w-28 flex-1">
          <label htmlFor={`${id}-begin`} className="text-micro text-inkt-zacht">
            {t("fichedetail.van")}
          </label>
          <Invoer
            id={`${id}-begin`}
            type="time"
            step={900}
            value={begin}
            disabled={verplaats.isPending || vergrendeld}
            onChange={(e) => setBegin(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="min-w-28 flex-1">
          <label htmlFor={`${id}-einde`} className="text-micro text-inkt-zacht">
            {t("fichedetail.tot")}
          </label>
          <Invoer
            id={`${id}-einde`}
            type="time"
            step={900}
            value={einde}
            disabled={verplaats.isPending || vergrendeld}
            onChange={(e) => setEinde(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <p className="mt-1.5 text-micro text-inkt-zacht">{t("fichedetail.momentUitleg")}</p>

      {weekend ? (
        <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
          {t("fichedetail.geenSchooldag")}
        </p>
      ) : null}

      {urenOngeldig && begin !== "" && einde !== "" ? (
        <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
          {t("fichedetail.eindeVoorBegin")}
        </p>
      ) : null}

      <Knop
        type="button"
        className="mt-2"
        disabled={verplaats.isPending || vergrendeld || urenOngeldig || ongewijzigd || datum === "" || weekend}
        onClick={() => {
          verplaats.reset();
          verplaats.mutate({
            plaatsingId: plaatsing.id,
            momentId: moment.id,
            datum,
            begin: `${begin}:00`,
            einde: `${einde}:00`,
          });
        }}
      >
        {verplaats.isPending ? t("fichedetail.bewarenBezig") : t("fichedetail.bewaren")}
      </Knop>

      {verplaats.isError ? (
        <div role="alert" className="mt-2 rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
          <p className="text-body font-medium text-attentie-inkt">{t("fichedetail.momentMislukt")}</p>
          {detail ? <p className="mt-1 text-meta text-attentie-inkt">{detail}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** One stretch of hours and how many occurrences run at it. */
interface Uurgroep {
  begin: string;
  einde: string;
  dagen: number;
}

/**
 * The occurrences grouped by their hours, the most common first.
 *
 * Counting rows is counting days only because one placement cannot start twice at one time on one day
 * (`AlgemeneFicheplaatsing.BewaakDag`); two rows of a group are therefore always on two days.
 */
function uurgroepen(momenten: readonly AlgemeneFichemomentWeergave[]): Uurgroep[] {
  const perUren = new Map<string, Uurgroep>();

  for (const moment of momenten) {
    const sleutel = `${moment.begin}-${moment.einde}`;
    const groep = perUren.get(sleutel);
    if (groep) groep.dagen += 1;
    else perUren.set(sleutel, { begin: moment.begin, einde: moment.einde, dagen: 1 });
  }

  return [...perUren.values()].sort((a, b) => b.dagen - a.dagen || a.begin.localeCompare(b.begin));
}
