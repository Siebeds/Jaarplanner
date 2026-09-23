import { useId, useMemo, useState } from "react";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Tekstvlak } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst, volleDag, weekdagIndex } from "../../lib/datum";
import { toonBereik } from "../plan/tijd";
import { Doelregels, type Infodoel } from "../plan/Doelinfo";
import { Doeldetailblad } from "../themas/Doeldetailblad";
import { t, telWoord } from "../../i18n";
import {
  MAX_DAGTEKST,
  useVerplaatsFichemoment,
  useZetFichemomenttekst,
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
 *
 * **`alleenLezen` is the same sheet for a gebruiker who may not plan this klas** (E6-02, ADR-0030 §3, R7): the
 * period and the hours as they are, with the delete, the moment's fields and the sentence about
 * what the delete costs left out, since all three are about changing the plan.
 *
 * **Opened from a block, it starts with that day's text** (FB-022): what the class does in this block today, the thing
 * she opens Tuesday's wero for. A reader sees the text; whoever may plan the klas gets a field for it.
 *
 * **Deleting a period that carries day texts asks first**, with the count (owner, 2026-09-15). The texts of the other
 * days are not on this sheet, so unlike the hoek's sheet it cannot rely on showing what would be lost.
 */
export function Algemenefichedetailblad({
  open,
  plaatsing,
  momentId,
  enigePeriodeMetDoelen,
  doelen,
  bezig,
  fout,
  alleenLezen = false,
  onVerwijder,
  onSluit,
}: {
  open: boolean;
  plaatsing: AlgemeneFicheplaatsingWeergave;
  /** The occurrence it was opened from, or null when it was opened from a list of whole periods. */
  momentId: string | null;
  /** This is the fiche's one placement AND the fiche has goals: the case in which deleting moves dekking. */
  enigePeriodeMetDoelen: boolean;
  /**
   * The fiche's goals (FB-018), or undefined while the fiche list has not arrived: the sheet then leaves the section
   * out rather than saying the fiche has none.
   */
  doelen: readonly Infodoel[] | undefined;
  bezig: boolean;
  fout?: unknown;
  /** The gebruiker may read this klas's planning and not change it. */
  alleenLezen?: boolean;
  onVerwijder: () => void;
  onSluit: () => void;
}) {
  const groepen = useMemo(() => uurgroepen(plaatsing.momenten), [plaatsing.momenten]);
  const moment = momentId === null ? undefined : plaatsing.momenten.find((m) => m.id === momentId);
  const serverReden = fout instanceof ApiError ? fout.detail : undefined;
  // The goal whose detail is open over this sheet, with the row that opened it, which gets focus back when it closes.
  const [doel, setDoel] = useState<{ code: string; knop: HTMLElement } | null>(null);
  const [bevestigen, setBevestigen] = useState(false);
  // Every occurrence of the run, not only the visible week's: the placement read carries all of them.
  const aantalTeksten = plaatsing.momenten.filter((m) => m.tekst !== null).length;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={plaatsing.ficheNaam}
      // No footer for a reader: its one button would be "Sluiten", the sheet's own close control a second time.
      voet={
        alleenLezen ? undefined : (
        <div className="flex flex-wrap items-center gap-2">
          {/* The house style for a destructive confirm, as `Bevestiging` does it: ink fill, not a danger hue. */}
          <Knop
            rang="stil"
            type="button"
            onClick={() => (aantalTeksten > 0 ? setBevestigen(true) : onVerwijder())}
            disabled={bezig}
            className="bg-inkt text-inkt-op hover:bg-inkt active:bg-inkt"
          >
            {bezig ? t("fichedetail.verwijderBezig") : t("fichedetail.verwijder")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("fichedetail.sluiten")}
          </Knop>
        </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {moment ? (
          alleenLezen ? (
            <div>
              <p className="text-micro uppercase text-inkt-zwak">
                {t("fichedetail.dagtekst", { dag: volleDag(moment.datum) })}
              </p>
              <p className={`mt-0.5 whitespace-pre-line text-body ${moment.tekst ? "text-inkt" : "text-inkt-zacht"}`}>
                {moment.tekst ?? t("fichedetail.dagtekstLeeg")}
              </p>
            </div>
          ) : (
            // Keyed on the saved text, so the refetch after a save refills the field with what the server kept.
            <Dagtekstvorm
              key={`${moment.id}-${moment.tekst ?? ""}`}
              plaatsingId={plaatsing.id}
              moment={moment}
              vergrendeld={bezig}
            />
          )
        ) : null}

        <div>
          <p className="text-micro uppercase text-inkt-zwak">{t("fichedetail.periode")}</p>
          <p className="mt-0.5 text-body text-inkt">{periodeTekst(plaatsing.van, plaatsing.tot)}</p>
        </div>

        <div>
          <p className="text-micro uppercase text-inkt-zwak">{t("fichedetail.uurrooster")}</p>
          {/* Per stretch of hours, the most common first: after one Monday moved, "the run's hours" read off the first day would be false for the others. */}
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

        {/* THE FICHE'S GOALS, for everyone who can open the sheet (FB-018). A block too short to hold the info icon keeps
            its goals here, so this is the one place they are reachable from every block. With the period and the
            hours, above the one day's fields: what the fiche is comes before what she can change about one day of it.
            A goal opens its detail on top of this sheet, and closing that brings her back to it. */}
        {doelen ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-micro uppercase text-inkt-zwak">{t("fichedetail.doelen")}</p>
              <span className="mono shrink-0 text-micro text-inkt-zwak">{doelen.length}</span>
            </div>
            {doelen.length === 0 ? (
              <p className="mt-0.5 text-body text-inkt-zacht">{t("doelinfo.geen")}</p>
            ) : (
              <div className="mt-1.5 overflow-hidden rounded-veld border border-lijn">
                <Doelregels doelen={doelen} onKies={(code, knop) => setDoel({ code, knop })} />
              </div>
            )}
            <Doeldetailblad code={doel?.code ?? null} terugNaar={doel?.knop} onSluit={() => setDoel(null)} />
          </div>
        ) : null}

        {moment && !alleenLezen ? (
          // Keyed on the moment's saved values, so a refetch after a save (or a drag in another view) refills the
          // fields instead of leaving the old answer in them.
          <Momentvorm
            key={`${moment.id}-${moment.datum}-${moment.begin}-${moment.einde}`}
            plaatsing={plaatsing}
            moment={moment}
            vergrendeld={bezig}
          />
        ) : null}

        {enigePeriodeMetDoelen && !alleenLezen ? <p className="text-meta text-inkt-zacht">{t("fichedetail.laatstePeriode")}</p> : null}

        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("fichedetail.verwijderMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </div>

      {alleenLezen ? null : (
        <Bevestiging
          open={bevestigen}
          titel={t("fichedetail.bevestigTitel")}
          gevolg={telWoord(aantalTeksten, "fichedetail.bevestigEenTekst", "fichedetail.bevestigTeksten")}
          bevestigLabel={t("fichedetail.bevestigLabel")}
          onBevestig={() => {
            // Back to the sheet, which shows the delete running and, if it fails, why.
            setBevestigen(false);
            onVerwijder();
          }}
          onSluit={() => setBevestigen(false)}
        />
      )}
    </Blad>
  );
}

/**
 * One day's text, as a field (FB-022). Saving an emptied field clears the day, which is what every other day of the
 * run looks like until someone writes about it.
 */
function Dagtekstvorm({
  plaatsingId,
  moment,
  vergrendeld,
}: {
  plaatsingId: string;
  moment: AlgemeneFichemomentWeergave;
  /** The delete is running; nothing else in the sheet should start. */
  vergrendeld: boolean;
}) {
  const id = useId();
  const zet = useZetFichemomenttekst();
  const opgeslagen = moment.tekst ?? "";
  const [tekst, setTekst] = useState(opgeslagen);
  const detail = zet.error instanceof ApiError ? zet.error.detail : undefined;

  return (
    <div>
      <label htmlFor={id} className="text-micro uppercase text-inkt-zwak">
        {t("fichedetail.dagtekst", { dag: volleDag(moment.datum) })}
      </label>
      <Tekstvlak
        id={id}
        value={tekst}
        maxLength={MAX_DAGTEKST}
        placeholder={t("fichedetail.dagtekstPlaatshouder")}
        aria-describedby={`${id}-hint`}
        disabled={zet.isPending || vergrendeld}
        onChange={(e) => {
          zet.reset();
          setTekst(e.target.value);
        }}
        className="mt-1"
      />
      <p id={`${id}-hint`} className="mt-1 text-micro text-inkt-zacht">
        {t("fichedetail.dagtekstHint")}
      </p>

      <Knop
        type="button"
        className="mt-2"
        bezig={zet.isPending}
        disabled={vergrendeld || tekst.trim() === opgeslagen}
        onClick={() => zet.mutate({ plaatsingId, momentId: moment.id, tekst: tekst.trim() })}
      >
        {zet.isPending ? t("fichedetail.bewarenBezig") : t("fichedetail.dagtekstBewaren")}
      </Knop>

      {zet.isError ? (
        <div role="alert" className="mt-2 rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
          <p className="text-body font-medium text-attentie-inkt">{t("fichedetail.dagtekstMislukt")}</p>
          {detail ? <p className="mt-1 text-meta text-attentie-inkt">{detail}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One occurrence's day and hours, as fields: the non-drag route to what the grid does by dragging.
 *
 * Not a `<form>`: this sheet may sit inside one on some screens, and a nested form is invalid HTML that submits the
 * wrong thing.
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

  // A refusal describes the answer she sent, not the one she is now typing: once a field changes it is cleared, or a
  // weekend warning ends up stacked on a vakantie refusal from the attempt before it.
  function wijzig(zet: (waarde: string) => void) {
    return (waarde: string) => {
      verplaats.reset();
      zet(waarde);
    };
  }

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
            onChange={(e) => wijzig(setDatum)(e.target.value)}
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
            onChange={(e) => wijzig(setBegin)(e.target.value)}
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
            onChange={(e) => wijzig(setEinde)(e.target.value)}
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
        bezig={verplaats.isPending}
        disabled={vergrendeld || urenOngeldig || ongewijzigd || datum === "" || weekend}
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
