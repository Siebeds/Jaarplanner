import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Keuze, Tekstvlak } from "../../components/ui/Veld";
import { LESUREN } from "../activiteiten/lesuren";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst } from "../../lib/datum";
import { t } from "../../i18n";
import { Periodekiezer, type Loopt } from "./Periodekiezer";
import type { HoekplaatsingInvoer } from "./gegevens";

/**
 * What happens after a hoekfiche lands on a day: over which days, with what in it, and at which
 * lesuur (owner, 2026-08-30).
 *
 * **Three questions in one sheet because she decided them in one gesture.** Dragging the boekenhoek
 * onto 12 october is not "place a corner"; it is "the boekenhoek runs these weeks, with the autumn
 * books in it, during hoekenwerk". Asking them one at a time would turn one decision into three
 * screens, and a placement that got its window but lost its verrijking to a second failed request is
 * worse than one that never happened. The server takes all three in one call for the same reason.
 *
 * **The day she dropped on is the START, and only the start.** It is the one fact the gesture
 * actually carries. Guessing an end (a fortnight? the rest of the subthema?) would be the tool
 * deciding the pedagogy, and she would have to notice and undo the guess. So the end is empty and
 * the calendar waits for a second click.
 *
 * **"Not in the uurrooster" is the default and the first option.** A hoek that claims no lesuur still
 * runs; it just does not take an hour. Most corners are like that, and defaulting to a lesuur would
 * write a row on every teaching day of the window for a teacher who never asked for one.
 *
 * **Unless the drop itself named an hour** (`startSlot`, owner 2026-08-31). Dropping a fiche on the
 * third lesuur of the day view is a teacher saying which hour, in the same gesture that says which
 * day, and the sheet used to answer "Niet in het uurrooster" and make her say it again. The default
 * above still holds everywhere the gesture is silent about the hour: the month and the week drop onto
 * a bare day, and they pass null.
 */
export function Hoekplaatsingblad({
  open,
  hoekNaam,
  hoekId,
  startdag,
  startSlot = null,
  loopt,
  schooljaarVan,
  schooljaarTot,
  bezig,
  fout,
  onPlaats,
  onSluit,
}: {
  open: boolean;
  hoekNaam: string;
  hoekId: string;
  /** The day the fiche was dropped on. The window opens here. */
  startdag: string;
  /**
   * The lesuur the fiche was dropped on, or null when the drop was onto a day rather than an hour.
   *
   * A `volgorde`, so 0 is lesuur 1. Null and 0 are therefore different answers and the check below
   * has to be against null rather than falsy.
   */
  startSlot?: number | null;
  /** The subthema runs, so the calendar can say what she is aiming at. */
  loopt: Loopt[];
  schooljaarVan: string;
  schooljaarTot: string;
  bezig: boolean;
  fout?: unknown;
  onPlaats: (invoer: HoekplaatsingInvoer) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const [van, setVan] = useState(startdag);
  const [tot, setTot] = useState("");
  const [verrijking, setVerrijking] = useState("");
  // "" is "not in the uurrooster". A string because it comes from a select; it becomes null or a
  // number exactly once, on submit.
  const [lesuur, setLesuur] = useState(startSlot === null ? "" : String(startSlot));
  const [eindFout, setEindFout] = useState(false);

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
      verrijking: verrijking.trim() || null,
      lesuur: lesuur === "" ? null : Number(lesuur),
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
          <Knop rang="hoofd" vol form={id} type="submit" disabled={bezig} className="@sm:w-auto @sm:px-6">
            {bezig ? t("hoekplaatsing.bezig") : t("hoekplaatsing.plaats")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
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
          <label htmlFor={`${id}-verrijking`} className="text-meta font-medium text-inkt">
            {t("hoekplaatsing.verrijking")}
          </label>
          <Tekstvlak
            id={`${id}-verrijking`}
            value={verrijking}
            disabled={bezig}
            rows={3}
            placeholder={t("hoekplaatsing.verrijkingVoorbeeld")}
            onChange={(e) => setVerrijking(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <label htmlFor={`${id}-lesuur`} className="text-meta font-medium text-inkt">
            {t("hoekplaatsing.uurrooster")}
          </label>
          <Keuze
            id={`${id}-lesuur`}
            value={lesuur}
            disabled={bezig}
            onChange={(e) => setLesuur(e.target.value)}
            className="mt-1.5"
          >
            <option value="">{t("hoekplaatsing.nietInUurrooster")}</option>
            {LESUREN.map((uur) => (
              <option key={uur.slot} value={String(uur.slot)}>
                {t("hoekplaatsing.lesuurN", { nummer: uur.nummer })}
              </option>
            ))}
          </Keuze>

          {/* What choosing a lesuur actually does, said only when she has chosen one. Above it the
              sentence would be describing a thing that is not happening. */}
          {lesuur !== "" ? (
            <p className="mt-1.5 text-micro text-inkt-zacht">{t("hoekplaatsing.lesuurUitleg")}</p>
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
