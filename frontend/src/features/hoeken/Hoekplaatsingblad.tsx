import { useId, useMemo, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer } from "../../components/ui/Veld";
import { IcoonChevron } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst } from "../../lib/datum";
import { STANDAARDBEGIN, STANDAARDDUUR, alsTijd } from "../plan/tijd";
import { t } from "../../i18n";
import { IngeplandTeken, Periodekiezer, type Loopt } from "./Periodekiezer";
import type { HoekplaatsingInvoer, HoekplaatsingWeergave } from "./gegevens";

/**
 * What happens after a hoekfiche lands on a day: over which days, with what in it, and at which
 * lesuur (owner, 2026-08-30).
 *
 * **Two questions in one sheet because she decided them in one gesture.** Dragging the boekenhoek
 * onto 12 october is not "place a corner"; it is "the boekenhoek runs these weeks, during hoekenwerk".
 * The server takes both in one call for the same reason. What is IN the corner is no longer asked here
 * (FB-020): that belongs to the subthema that runs, and she writes it from the subthemabalk.
 *
 * **What this corner already runs comes first** (owner, 2026-09-10). It used to hang under the fiche
 * in the hoekenpaneel, where it cluttered a list meant for seeing the corners side by side, and it
 * answers a question she only asks here: "when did I already put this one in the agenda?". So the runs
 * of the whole school year are listed above the calendar, each one opening its detail sheet, and the
 * calendar outlines their days. Those rows are also the way back to a run that takes no lesuur, which
 * the day view never draws.
 *
 * **The day she dropped on is the START, and only the start.** It is the one fact the gesture
 * actually carries. Guessing an end (a fortnight? the rest of the subthema?) would be the tool
 * deciding the pedagogy, and she would have to notice and undo the guess. So the end is empty and
 * the calendar waits for a second click.
 *
 * **Every hoek gets a time** (owner, 2026-09-11, ADR-0028). "Niet in het uurrooster" was an answer until then, and
 * it left a corner running over its days with no hour and therefore no block on any day of the new time grid. The
 * two fields are required, and the server writes one row per teaching day of the window at exactly these hours.
 *
 * **The drop decides the hour when it named one** (`startuur`). Dropping a fiche at half past one in the grid is a
 * teacher saying when, in the same gesture that says which day. A month cell and a click on the fiche say nothing
 * about an hour, so they pass null and the sheet offers the ordinary start of a morning, which she can overwrite
 * before saving.
 */
export function Hoekplaatsingblad({
  open,
  hoekNaam,
  hoekId,
  startdag,
  startuur = null,
  loopt,
  ingepland,
  schooljaarVan,
  schooljaarTot,
  bezig,
  fout,
  onPlaats,
  onOpenPlaatsing,
  onSluit,
}: {
  open: boolean;
  hoekNaam: string;
  hoekId: string;
  /** The day the fiche was dropped on, or the day the agenda stands on when it was clicked. */
  startdag: string;
  /**
   * The minute of the day the fiche was dropped at, or null when the gesture named no hour.
   *
   * Minutes since midnight, which is what the time grid works in; midnight itself is 0, so the check below is
   * against null rather than falsy.
   */
  startuur?: number | null;
  /** The subthema runs, so the calendar can say what she is aiming at. */
  loopt: Loopt[];
  /** This corner's runs in the school year, in any order. */
  ingepland: readonly HoekplaatsingWeergave[];
  schooljaarVan: string;
  schooljaarTot: string;
  bezig: boolean;
  fout?: unknown;
  onPlaats: (invoer: HoekplaatsingInvoer) => void;
  /** One of the runs listed above the calendar was opened. */
  onOpenPlaatsing: (plaatsingId: string) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const [van, setVan] = useState(startdag);
  const [tot, setTot] = useState("");
  // `HH:mm`, which is what a time input reads and writes; the seconds are added on submit, where the wire format
  // is decided once.
  const [begin, setBegin] = useState(() => alsTijd(startuur ?? STANDAARDBEGIN).slice(0, 5));
  const [einde, setEinde] = useState(() => alsTijd((startuur ?? STANDAARDBEGIN) + STANDAARDDUUR).slice(0, 5));
  const [eindFout, setEindFout] = useState(false);
  // `HH:mm` sorts as it reads, so comparing the strings is comparing the times.
  const urenOngeldig = begin === "" || einde === "" || einde <= begin;

  // In calendar order, whatever order the server answered in: she reads the list as a timeline.
  const reeksen = useMemo(() => [...ingepland].sort((a, b) => a.van.localeCompare(b.van)), [ingepland]);

  function verstuur(event: FormEvent) {
    event.preventDefault();

    // A start with no end is a half-made choice, not an error until she tries to save it.
    if (tot === "") {
      setEindFout(true);
      return;
    }

    onPlaats({
      hoekId,
      van,
      tot,
      begin: `${begin}:00`,
      einde: `${einde}:00`,
    });
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={t("hoekplaatsing.titel", { naam: hoekNaam })}
      voet={
        <div className="flex items-center gap-2">
          <Knop
            rang="hoofd"
            vol
            form={id}
            type="submit"
            // Disabled on an impossible window rather than sending it: the server would refuse it in Dutch, and a
            // refusal for something the screen could see coming is a round trip that teaches nothing.
            disabled={bezig || urenOngeldig}
            className="@sm:w-auto @sm:px-6"
          >
            {bezig ? t("hoekplaatsing.bezig") : t("hoekplaatsing.plaats")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
        {/* Nothing at all when the corner runs nowhere yet. A sentence saying so would be the one line
            in the sheet about something that is not there, above the calendar she came to use. */}
        {reeksen.length > 0 ? (
          <div>
            <p id={`${id}-ingepland`} className="text-meta font-medium text-inkt">
              {t("hoekplaatsing.alIngepland")}
            </p>
            <ul aria-labelledby={`${id}-ingepland`} className="mt-1 flex flex-col">
              {reeksen.map((plaatsing) => {
                const tekst = periodeTekst(plaatsing.van, plaatsing.tot);
                return (
                  <li key={plaatsing.id}>
                    {/* The row opens the run, so the chevron says it goes somewhere. Pulled out by the
                        padding it adds, so the dates line up with the labels above and below. */}
                    <button
                      type="button"
                      onClick={() => onOpenPlaatsing(plaatsing.id)}
                      disabled={bezig}
                      aria-label={t("hoekplaatsing.bekijk", { periode: tekst })}
                      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-veld px-2 py-1.5 text-left text-meta text-inkt transition-colors duration-150 hover:bg-vlak-diep"
                    >
                      <IngeplandTeken />
                      <span className="min-w-0 flex-1 truncate">{tekst}</span>
                      <IcoonChevron aria-hidden="true" className="h-3.5 w-3.5 shrink-0 -rotate-90 text-inkt-zwak" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="text-meta font-medium text-inkt">{t("hoekplaatsing.periode")}</p>

          {/* The chosen window, said in words above the grid. The calendar shows it in tint, and a
              tint is not a sentence: this is the line she reads back before pressing the button. */}
          <p aria-live="polite" className="mt-0.5 text-meta text-inkt-zacht">
            {tot === ""
              ? t("hoekplaatsing.kiesEinddag")
              : periodeTekst(van, tot)}
          </p>

          <div className="mt-2">
            <Periodekiezer
              van={van}
              tot={tot}
              loopt={loopt}
              alIngepland={reeksen}
              schooljaarVan={schooljaarVan}
              schooljaarTot={schooljaarTot}
              onKies={(nieuwVan, nieuwTot) => {
                setVan(nieuwVan);
                setTot(nieuwTot);
                if (eindFout && nieuwTot !== "") setEindFout(false);
              }}
            />
          </div>

          {eindFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("hoekplaatsing.einddagVerplicht")}
            </p>
          ) : null}
        </div>


        <div>
          <p className="text-meta font-medium text-inkt">{t("hoekplaatsing.wanneer")}</p>

          <div className="mt-1.5 flex flex-wrap items-end gap-2">
            <div className="min-w-28 flex-1">
              <label htmlFor={`${id}-begin`} className="text-micro text-inkt-zacht">
                {t("hoekplaatsing.van")}
              </label>
              <Invoer
                id={`${id}-begin`}
                type="time"
                step={900}
                value={begin}
                disabled={bezig}
                onChange={(e) => setBegin(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="min-w-28 flex-1">
              <label htmlFor={`${id}-einde`} className="text-micro text-inkt-zacht">
                {t("hoekplaatsing.tot")}
              </label>
              <Invoer
                id={`${id}-einde`}
                type="time"
                step={900}
                value={einde}
                disabled={bezig}
                onChange={(e) => setEinde(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* What these two fields actually do, which is not obvious: they are not one appointment but one hour on
              every teaching day of the window. Said unconditionally, because there is no longer a state in which
              the hoek takes no hour. */}
          <p className="mt-1.5 text-micro text-inkt-zacht">{t("hoekplaatsing.uurUitleg")}</p>

          {urenOngeldig && begin !== "" && einde !== "" ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("hoekplaatsing.eindeVoorBegin")}
            </p>
          ) : null}
        </div>

        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("hoekplaatsing.mislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </form>
    </Blad>
  );
}
