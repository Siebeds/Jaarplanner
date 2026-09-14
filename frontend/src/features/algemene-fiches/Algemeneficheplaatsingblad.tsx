import { useId, useMemo, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer } from "../../components/ui/Veld";
import { IcoonChevron } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { maandagVan, periode as periodeTekst, verschuif, weekdagIndex, weekdagKort } from "../../lib/datum";
import { cn } from "../../lib/cn";
import { STANDAARDBEGIN, STANDAARDDUUR, alsTijd } from "../plan/tijd";
import { t } from "../../i18n";
import { IngeplandTeken, Periodekiezer, type Loopt } from "../hoeken/Periodekiezer";
import type { AlgemeneFicheplaatsingInvoer, AlgemeneFicheplaatsingWeergave } from "./gegevens";

/** "maandag", for the accessible name of a weekday toggle whose visible text is "ma". The locale's word, not ours. */
const WEEKDAG_LANG = new Intl.DateTimeFormat("nl-BE", { weekday: "long" });

/**
 * What happens after an algemene fiche lands on a day: over which days, on which weekdays, and at what time
 * (owner, 2026-09-11: "elke maandag turnen op dit uur"; ADR-0029 decision 3).
 *
 * **The hoek's sheet, with the one question a hoek does not have.** A hoek runs on every teaching day of its window;
 * a fiche recurs on the weekdays she picks. So the window, the "Al ingepland" list and the hours are the hoek's own
 * arrangement (`Hoekplaatsingblad` gives the reasons), and between them sits a row of five day toggles. There is no
 * verrijking: what happens in a fiche is its description, written once in Instellingen.
 *
 * **The day she dropped on decides two things, and only those.** It is the start of the window, and its weekday is
 * the first day switched on: dropping turnen on a Monday means Mondays far more often than not. The end stays empty,
 * because guessing it would be the tool choosing her year. The one shortcut is "tot het einde van het schooljaar",
 * because a fiche like the onthaal usually runs to June and reaching June in a month picker is nine clicks.
 *
 * **Weekends are not offered.** The server refuses a Saturday or Sunday with its own sentence, and a toggle that can
 * only lead to that refusal is a control that does nothing.
 */
export function Algemeneficheplaatsingblad({
  open,
  ficheNaam,
  ficheId,
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
  ficheNaam: string;
  ficheId: string;
  /** The day the fiche was dropped on, or the day the agenda stands on when it was clicked. */
  startdag: string;
  /** Minutes since midnight when the drop named an hour; null when it did not. */
  startuur?: number | null;
  /** The subthema runs, so the calendar can say what else is running. */
  loopt: Loopt[];
  /** This fiche's placements in the school year, in any order. */
  ingepland: readonly AlgemeneFicheplaatsingWeergave[];
  schooljaarVan: string;
  schooljaarTot: string;
  bezig: boolean;
  fout?: unknown;
  onPlaats: (invoer: AlgemeneFicheplaatsingInvoer) => void;
  onOpenPlaatsing: (plaatsingId: string) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const [van, setVan] = useState(startdag);
  const [tot, setTot] = useState("");
  // ISO numbers, 1 is maandag. A weekend drop starts with nothing switched on rather than with a day she did not mean.
  const [weekdagen, setWeekdagen] = useState<number[]>(() => {
    const index = weekdagIndex(startdag);
    return index < 5 ? [index + 1] : [];
  });
  const [begin, setBegin] = useState(() => alsTijd(startuur ?? STANDAARDBEGIN).slice(0, 5));
  const [einde, setEinde] = useState(() => alsTijd((startuur ?? STANDAARDBEGIN) + STANDAARDDUUR).slice(0, 5));
  const [eindFout, setEindFout] = useState(false);
  const [dagFout, setDagFout] = useState(false);
  // `HH:mm` sorts as it reads, so comparing the strings is comparing the times.
  const urenOngeldig = begin === "" || einde === "" || einde <= begin;

  const reeksen = useMemo(() => [...ingepland].sort((a, b) => a.van.localeCompare(b.van)), [ingepland]);

  // Monday to Friday of any week: only the weekday of each date is read, for its label.
  const dagen = useMemo(() => {
    const maandag = maandagVan(startdag);
    return [0, 1, 2, 3, 4].map((i) => {
      const datum = verschuif(maandag, i);
      return { nummer: i + 1, kort: weekdagKort(datum), lang: WEEKDAG_LANG.format(new Date(`${datum}T12:00:00`)) };
    });
  }, [startdag]);

  function wisselDag(nummer: number) {
    setWeekdagen((huidig) =>
      huidig.includes(nummer) ? huidig.filter((n) => n !== nummer) : [...huidig, nummer].sort((a, b) => a - b),
    );
    setDagFout(false);
  }

  function verstuur(event: FormEvent) {
    event.preventDefault();

    // Both half-made choices are said at once, so she does not fix one and press again to learn about the other.
    const geenEinde = tot === "";
    const geenDag = weekdagen.length === 0;
    setEindFout(geenEinde);
    setDagFout(geenDag);
    if (geenEinde || geenDag) return;

    onPlaats({
      algemeneFicheId: ficheId,
      van,
      tot,
      weekdagen,
      begin: `${begin}:00`,
      einde: `${einde}:00`,
    });
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={t("ficheplaatsing.titel", { naam: ficheNaam })}
      voet={
        <div className="flex items-center gap-2">
          <Knop
            rang="hoofd"
            vol
            form={id}
            type="submit"
            disabled={bezig || urenOngeldig}
            className="@sm:w-auto @sm:px-6"
          >
            {bezig ? t("ficheplaatsing.bezig") : t("ficheplaatsing.plaats")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
        {reeksen.length > 0 ? (
          <div>
            <p id={`${id}-ingepland`} className="text-meta font-medium text-inkt">
              {t("ficheplaatsing.alIngepland")}
            </p>
            <ul aria-labelledby={`${id}-ingepland`} className="mt-1 flex flex-col">
              {reeksen.map((plaatsing) => {
                const tekst = periodeTekst(plaatsing.van, plaatsing.tot);
                return (
                  <li key={plaatsing.id}>
                    <button
                      type="button"
                      onClick={() => onOpenPlaatsing(plaatsing.id)}
                      disabled={bezig}
                      aria-label={t("ficheplaatsing.bekijk", { periode: tekst })}
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
          <p className="text-meta font-medium text-inkt">{t("ficheplaatsing.periode")}</p>

          <p aria-live="polite" className="mt-0.5 text-meta text-inkt-zacht">
            {tot === "" ? t("ficheplaatsing.kiesEinddag") : periodeTekst(van, tot)}
          </p>

          <div className="mt-2">
            <Periodekiezer
              van={van}
              tot={tot}
              loopt={loopt}
              alIngepland={reeksen}
              bezetLabel={t("ficheplaatsing.kalenderAlIngepland")}
              schooljaarVan={schooljaarVan}
              schooljaarTot={schooljaarTot}
              onKies={(nieuwVan, nieuwTot) => {
                setVan(nieuwVan);
                setTot(nieuwTot);
                if (nieuwTot !== "") setEindFout(false);
              }}
            />
          </div>

          {/* Only while it would change something: once the window already ends on the last day, the button would
              press into a state she is already in. */}
          {van !== "" && van <= schooljaarTot && tot !== schooljaarTot ? (
            <Knop
              rang="stil"
              type="button"
              disabled={bezig}
              onClick={() => {
                setTot(schooljaarTot);
                setEindFout(false);
              }}
              className="mt-1"
            >
              {t("ficheplaatsing.totEindeSchooljaar")}
            </Knop>
          ) : null}

          {eindFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("ficheplaatsing.einddagVerplicht")}
            </p>
          ) : null}
        </div>

        <div>
          <p id={`${id}-dagen`} className="text-meta font-medium text-inkt">
            {t("ficheplaatsing.weekdagen")}
          </p>

          {/* Toggles rather than checkboxes: five short words side by side read as a week, and `aria-pressed` says the
              state in words as well as in the fill (Art. XII). The fill is the accent's "selected" use. */}
          <div role="group" aria-labelledby={`${id}-dagen`} className="mt-1.5 flex flex-wrap gap-1.5">
            {dagen.map((dag) => {
              const aan = weekdagen.includes(dag.nummer);
              return (
                <button
                  key={dag.nummer}
                  type="button"
                  aria-pressed={aan}
                  aria-label={dag.lang}
                  disabled={bezig}
                  onClick={() => wisselDag(dag.nummer)}
                  className={cn(
                    "inline-flex h-9 min-w-11 items-center justify-center rounded-veld border px-3 text-meta font-medium transition-colors duration-150",
                    aan
                      ? "border-accent bg-accent text-accent-op"
                      : "border-lijn-veld text-inkt-zacht hover:border-accent hover:text-accent",
                  )}
                >
                  {dag.kort}
                </button>
              );
            })}
          </div>

          {dagFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("ficheplaatsing.weekdagVerplicht")}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-meta font-medium text-inkt">{t("ficheplaatsing.wanneer")}</p>

          <div className="mt-1.5 flex flex-wrap items-end gap-2">
            <div className="min-w-28 flex-1">
              <label htmlFor={`${id}-begin`} className="text-micro text-inkt-zacht">
                {t("ficheplaatsing.van")}
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
                {t("ficheplaatsing.tot")}
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

          {/* Unconditional and true of every answer: the server writes one row per chosen weekday that is a teaching
              day, which is what skipping the vakanties and vrije dagen means (`Herhalingsdagen`). */}
          <p className="mt-1.5 text-micro text-inkt-zacht">{t("ficheplaatsing.uurUitleg")}</p>

          {urenOngeldig && begin !== "" && einde !== "" ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("ficheplaatsing.eindeVoorBegin")}
            </p>
          ) : null}
        </div>

        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("ficheplaatsing.mislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </form>
    </Blad>
  );
}
