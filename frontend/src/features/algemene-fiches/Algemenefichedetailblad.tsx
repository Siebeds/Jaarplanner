import { useId, useMemo, useState } from "react";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Verwijderknop } from "../../components/ui/Rijknoppen";
import { Tekstvlak } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst, volleDag, weekdagIndex } from "../../lib/datum";
import { toonBereik } from "../plan/tijd";
import { Dagvelden } from "../plan/Dagvelden";
import { Doelregels, type Infodoel } from "../plan/Doelinfo";
import { Doeldetailblad } from "../themas/Doeldetailblad";
import { t, telWoord } from "../../i18n";
import {
  MAX_DAGTEKST,
  useVerplaatsFichemoment,
  useZetFicheuren,
  useZetFichemomenttekst,
  type AlgemeneFichemomentWeergave,
  type AlgemeneFicheplaatsingWeergave,
} from "./gegevens";

/**
 * One planned algemene fiche: the day it was opened from, the period it belongs to, and its goals.
 *
 * **The day first, as one row and one text, saved by one button** (FB-100). Opened from a block, the sheet starts with
 * what she opened it for: that day's day, hours and text. The day, start and end are one row (`Dagvelden`), the
 * non-drag route to what the grid does by dragging (WCAG 2.2 SC 2.5.7), and Bewaren at the foot saves whatever of the
 * two she changed. There used to be a button per section and a filled delete, and the owner found the screen crowded
 * (2026-09-24). Opened from the placement sheet's "Al ingepland" list there is no particular day, so there is no such
 * section and no footer.
 *
 * **Taking the period out is a bin on the Periode heading**, bordered like the activiteit's bin on its day heading:
 * each bin sits on the heading of what it removes. It asks first when day texts would go with it, with the count, since
 * the texts of the other days are not on this sheet.
 *
 * **The hours for this day or for the whole period** (FB-101, owner 2026-09-24). "Alleen deze dag" is the default and
 * changes this one occurrence. "Alle dagen van deze periode" gives every occurrence the new hours in one request, each
 * on the day it is on, the ones already past and the ones moved by hand included; the day field is then locked to the
 * opened day, because a whole run cannot move to one date, and the hint says where a different day is chosen.
 *
 * **The delete says what it costs, and only where it is true.** When this is the fiche's only placement and the fiche
 * carries goals, taking it out stops the fiche counting for dekking (Art. V.1), and the sheet says so. It says nothing
 * about whether a goal stays gedekt: a thema may carry the same goal, which this sheet cannot see.
 *
 * **`alleenLezen` is the same sheet for a gebruiker who may not plan this klas** (E6-02, ADR-0030 §3, R7): the day's
 * text, the period and the hours as they are, without fields, bin, footer or the sentence about what the delete costs.
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
  /** The period is being taken out. */
  bezig: boolean;
  fout?: unknown;
  /** The gebruiker may read this klas's planning and not change it. */
  alleenLezen?: boolean;
  onVerwijder: () => void;
  onSluit: () => void;
}) {
  const id = useId();
  const groepen = useMemo(() => uurgroepen(plaatsing.momenten), [plaatsing.momenten]);
  const moment = momentId === null ? undefined : plaatsing.momenten.find((m) => m.id === momentId);
  const serverReden = fout instanceof ApiError ? fout.detail : undefined;
  const [doel, setDoel] = useState<{ code: string; knop: HTMLElement } | null>(null);
  const [bevestigen, setBevestigen] = useState(false);
  const aantalTeksten = plaatsing.momenten.filter((m) => m.tekst !== null).length;

  const bewerkt = moment !== undefined && !alleenLezen;
  const dag = useDagvorm(plaatsing.id, moment, bezig, onSluit);

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={plaatsing.ficheNaam}
      voet={
        bewerkt ? (
          <div className="flex items-center gap-2">
            <Knop
              rang="hoofd"
              vol
              type="button"
              bezig={dag.bezig}
              disabled={!dag.kanBewaren}
              onClick={dag.bewaar}
              className="@sm:w-auto @sm:px-6"
            >
              {dag.bezig ? t("fichedetail.bewarenBezig") : t("fichedetail.bewaren")}
            </Knop>
            <Knop rang="stil" type="button" onClick={onSluit} disabled={dag.bezig || bezig}>
              {t("fichedetail.sluiten")}
            </Knop>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        {moment ? (
          <section aria-labelledby={`${id}-kop`}>
            <h3 id={`${id}-kop`} className="text-micro uppercase text-inkt-zwak">
              {t("fichedetail.opDag", { dag: volleDag(moment.datum) })}
            </h3>

            {alleenLezen ? (
              <p className={`mt-1 whitespace-pre-line text-body ${moment.tekst ? "text-inkt" : "text-inkt-zacht"}`}>
                {moment.tekst ?? t("fichedetail.dagtekstLeeg")}
              </p>
            ) : (
              <>
                <div className="mt-2">
                  <Dagvelden
                    id={id}
                    datum={dag.datum}
                    begin={dag.begin}
                    einde={dag.einde}
                    // Bounded by the window: the server refuses a day outside it, so the picker does not offer one.
                    vroegste={plaatsing.van}
                    laatste={plaatsing.tot}
                    disabled={dag.bezig || bezig}
                    datumVergrendeld={dag.bereik === "periode"}
                    onDatum={dag.zetDatum}
                    onBegin={dag.zetBegin}
                    onEinde={dag.zetEinde}
                  />
                </div>

                <fieldset className="mt-3">
                  <legend className="text-micro text-inkt-zacht">{t("fichedetail.uurVoor")}</legend>
                  <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                    {(["dag", "periode"] as const).map((keuze) => (
                      <label key={keuze} className="inline-flex min-h-9 items-center gap-2 text-meta text-inkt">
                        <input
                          type="radio"
                          name={`${id}-bereik`}
                          value={keuze}
                          checked={dag.bereik === keuze}
                          disabled={dag.bezig || bezig}
                          onChange={() => dag.zetBereik(keuze)}
                          className="h-4 w-4 accent-accent"
                        />
                        {keuze === "dag" ? t("fichedetail.alleenDezeDag") : t("fichedetail.helePeriode")}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="mt-1 text-micro text-inkt-zacht">
                  {dag.bereik === "dag" ? t("fichedetail.momentUitleg") : t("fichedetail.periodeUitleg")}
                </p>

                {dag.weekend ? (
                  <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
                    {t("fichedetail.geenSchooldag")}
                  </p>
                ) : null}
                {dag.urenOngeldig && dag.begin !== "" && dag.einde !== "" ? (
                  <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
                    {t("fichedetail.eindeVoorBegin")}
                  </p>
                ) : null}

                <label htmlFor={`${id}-tekst`} className="mt-4 block text-micro text-inkt-zacht">
                  {t("fichedetail.dagtekst")}
                </label>
                <Tekstvlak
                  id={`${id}-tekst`}
                  value={dag.tekst}
                  maxLength={MAX_DAGTEKST}
                  placeholder={t("fichedetail.dagtekstPlaatshouder")}
                  aria-describedby={`${id}-hint`}
                  disabled={dag.bezig || bezig}
                  onChange={(e) => dag.zetTekst(e.target.value)}
                  className="mt-1"
                />
                <p id={`${id}-hint`} className="mt-1 text-micro text-inkt-zacht">
                  {t("fichedetail.dagtekstHint")}
                </p>

                {dag.fouten.map((melding) => (
                  <div
                    key={melding.titel}
                    role="alert"
                    className="mt-2 rounded-veld border border-attentie/40 bg-attentie-zacht p-3"
                  >
                    <p className="text-body font-medium text-attentie-inkt">{melding.titel}</p>
                    {melding.detail ? <p className="mt-1 text-meta text-attentie-inkt">{melding.detail}</p> : null}
                  </div>
                ))}
              </>
            )}
          </section>
        ) : null}

        <section aria-labelledby={`${id}-periode`}>
          <div className="flex items-center justify-between gap-2">
            <h3 id={`${id}-periode`} className="text-micro uppercase text-inkt-zwak">
              {t("fichedetail.periode")}
            </h3>
            {alleenLezen ? null : (
              <Verwijderknop
                omrand
                label={t("fichedetail.verwijderAria", { naam: plaatsing.ficheNaam })}
                titel={t("fichedetail.verwijder")}
                disabled={bezig || dag.bezig}
                onClick={() => (aantalTeksten > 0 ? setBevestigen(true) : onVerwijder())}
              />
            )}
          </div>
          <p className="mt-0.5 text-body text-inkt">{periodeTekst(plaatsing.van, plaatsing.tot)}</p>
          {/* Per stretch of hours, the most common first: after one Monday moved, "the run's hours" read off the first
              day would be false for the others. */}
          <div className="mt-0.5 flex flex-col">
            {groepen.map((groep) => (
              <p key={`${groep.begin}-${groep.einde}`} className="text-meta text-inkt-zacht">
                {t("fichedetail.opUur", {
                  periode: toonBereik(groep.begin, groep.einde),
                  dagen: telWoord(groep.dagen, "fichedetail.eenSchooldag", "fichedetail.aantalSchooldagen"),
                })}
              </p>
            ))}
          </div>
          {enigePeriodeMetDoelen && !alleenLezen ? (
            <p className="mt-1.5 text-meta text-inkt-zacht">{t("fichedetail.laatstePeriode")}</p>
          ) : null}
          {bezig ? (
            <p aria-live="polite" className="mt-1.5 text-meta text-inkt-zacht">
              {t("fichedetail.verwijderBezig")}
            </p>
          ) : null}
          {fout ? (
            <div role="alert" className="mt-2 rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
              <p className="text-body font-medium text-attentie-inkt">{t("fichedetail.verwijderMislukt")}</p>
              {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
            </div>
          ) : null}
        </section>

        {/* THE FICHE'S GOALS, for everyone who can open the sheet (FB-018). A block too short to hold the info icon keeps
            its goals here, so this is the one place they are reachable from every block. A goal opens its detail on
            top of this sheet, and closing that brings her back to it. */}
        {doelen ? (
          <section>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-micro uppercase text-inkt-zwak">{t("fichedetail.doelen")}</h3>
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
          </section>
        ) : null}
      </div>

      {alleenLezen ? null : (
        <Bevestiging
          open={bevestigen}
          titel={t("fichedetail.bevestigTitel")}
          gevolg={telWoord(aantalTeksten, "fichedetail.bevestigEenTekst", "fichedetail.bevestigTeksten")}
          bevestigLabel={t("fichedetail.bevestigLabel")}
          onBevestig={() => {
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
 * The opened day's fields and the one Bewaren that saves them.
 *
 * **Two endpoints behind one button.** The day and hours go where the drag goes, the text where FB-022 put it; only
 * what changed is sent, the move first, and the sheet closes when both arrived. A failure keeps the sheet open with
 * that part's own sentence, and editing a field clears it, since it was about the previous answer. An emptied text
 * clears the day, which is what every other day of the run looks like until someone writes about it.
 */
function useDagvorm(
  plaatsingId: string,
  moment: AlgemeneFichemomentWeergave | undefined,
  /** The period is being taken out; nothing else should start. */
  vergrendeld: boolean,
  onKlaar: () => void,
) {
  const verplaats = useVerplaatsFichemoment();
  const uren = useZetFicheuren();
  const zet = useZetFichemomenttekst();
  const [bereik, setBereik] = useState<"dag" | "periode">("dag");
  const [datum, setDatum] = useState(moment?.datum ?? "");
  const [begin, setBegin] = useState(moment?.begin.slice(0, 5) ?? "");
  const [einde, setEinde] = useState(moment?.einde.slice(0, 5) ?? "");
  const [tekst, setTekst] = useState(moment?.tekst ?? "");

  // `HH:mm` sorts as it reads, so comparing the strings is comparing the times.
  const urenOngeldig = begin === "" || einde === "" || einde <= begin;
  const weekend = datum !== "" && weekdagIndex(datum) >= 5;
  const momentGewijzigd =
    moment !== undefined &&
    (datum !== moment.datum || begin !== moment.begin.slice(0, 5) || einde !== moment.einde.slice(0, 5));
  const tekstGewijzigd = moment !== undefined && tekst.trim() !== (moment.tekst ?? "");
  const bezig = verplaats.isPending || uren.isPending || zet.isPending;
  const kanBewaren =
    !bezig &&
    !vergrendeld &&
    (momentGewijzigd || tekstGewijzigd) &&
    !(momentGewijzigd && (urenOngeldig || weekend || datum === ""));

  function wijzig(zetter: (waarde: string) => void) {
    return (waarde: string) => {
      verplaats.reset();
      uren.reset();
      zet.reset();
      zetter(waarde);
    };
  }

  function zetBereik(keuze: "dag" | "periode") {
    verplaats.reset();
    uren.reset();
    // The whole run keeps its days, so a date picked for this one day would be sent nowhere: it goes back.
    if (keuze === "periode" && moment) setDatum(moment.datum);
    setBereik(keuze);
  }

  async function bewaar() {
    if (!moment || !kanBewaren) return;
    try {
      if (momentGewijzigd && bereik === "periode") {
        await uren.mutateAsync({ plaatsingId, begin: `${begin}:00`, einde: `${einde}:00` });
      } else if (momentGewijzigd) {
        await verplaats.mutateAsync({
          plaatsingId,
          momentId: moment.id,
          datum,
          begin: `${begin}:00`,
          einde: `${einde}:00`,
        });
      }
      if (tekstGewijzigd) await zet.mutateAsync({ plaatsingId, momentId: moment.id, tekst: tekst.trim() });
      onKlaar();
    } catch {
      // The failed mutation holds its own error, which `fouten` says below the fields.
    }
  }

  const fouten: { titel: string; detail?: string }[] = [];
  if (verplaats.isError) {
    fouten.push({
      titel: t("fichedetail.momentMislukt"),
      detail: verplaats.error instanceof ApiError ? verplaats.error.detail : undefined,
    });
  }
  if (uren.isError) {
    fouten.push({
      titel: t("fichedetail.urenMislukt"),
      detail: uren.error instanceof ApiError ? uren.error.detail : undefined,
    });
  }
  if (zet.isError) {
    fouten.push({
      titel: t("fichedetail.dagtekstMislukt"),
      detail: zet.error instanceof ApiError ? zet.error.detail : undefined,
    });
  }

  return {
    datum,
    begin,
    einde,
    tekst,
    bereik,
    zetBereik,
    zetDatum: wijzig(setDatum),
    zetBegin: wijzig(setBegin),
    zetEinde: wijzig(setEinde),
    zetTekst: wijzig(setTekst),
    urenOngeldig,
    weekend,
    kanBewaren,
    bezig,
    bewaar: () => void bewaar(),
    fouten,
  };
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
