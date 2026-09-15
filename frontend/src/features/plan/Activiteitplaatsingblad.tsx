import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import { STANDAARDBEGIN, alsTijd } from "./tijd";

/**
 * Planning an activiteit from the side panel when the gesture did not say when (FB-017).
 *
 * A card dropped on the time grid names a day and an hour and is planned there without a question. A card that was
 * clicked, or dropped on a month cell, says at most a day, so this sheet asks the rest: which day, from when, until
 * when. It is also the route without a drag (WCAG 2.2 SC 2.5.7).
 *
 * **The end follows the activiteit's own length**, which is what a block made from the picker gets too, and she can
 * change it before saving. The start is the ordinary start of a morning unless the gesture brought one.
 */
export function Activiteitplaatsingblad({
  naam,
  startdag,
  startuur = null,
  duur,
  vroegste,
  laatste,
  bezig,
  fout,
  onPlaats,
  onSluit,
}: {
  naam: string;
  /** The day the card was dropped on, or the day the agenda stands on when it was clicked. */
  startdag: string;
  /** Minutes since midnight, or null when the gesture named no hour. */
  startuur?: number | null;
  /** The activiteit's default length, in minutes. */
  duur: number;
  vroegste: string;
  laatste: string;
  bezig: boolean;
  fout?: unknown;
  onPlaats: (plek: { datum: string; begin: string; einde: string }) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const [datum, setDatum] = useState(startdag);
  // `HH:mm`, which is what a time input reads and writes; the seconds are added on submit.
  const [begin, setBegin] = useState(() => alsTijd(startuur ?? STANDAARDBEGIN).slice(0, 5));
  const [einde, setEinde] = useState(() => alsTijd((startuur ?? STANDAARDBEGIN) + duur).slice(0, 5));
  // `HH:mm` sorts as it reads, so comparing the strings is comparing the times.
  const urenOngeldig = begin === "" || einde === "" || einde <= begin;

  function verstuur(event: FormEvent) {
    event.preventDefault();
    if (datum === "" || urenOngeldig) return;
    onPlaats({ datum, begin: `${begin}:00`, einde: `${einde}:00` });
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open
      onOpenChange={(o) => !o && onSluit()}
      titel={t("activiteitplaatsing.titel", { naam })}
      voet={
        <div className="flex items-center gap-2">
          <Knop
            rang="hoofd"
            vol
            form={id}
            type="submit"
            // Disabled on an impossible slot rather than sending it: a refusal for something the screen could see
            // coming is a round trip that teaches nothing.
            disabled={bezig || datum === "" || urenOngeldig}
            className="@sm:w-auto @sm:px-6"
          >
            {bezig ? t("activiteitplaatsing.bezig") : t("activiteitplaatsing.plaats")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={id} onSubmit={verstuur} className="flex flex-col gap-4">
        <div>
          <label htmlFor={`${id}-dag`} className="text-meta font-medium text-inkt">
            {t("activiteitplaatsing.dag")}
          </label>
          <Invoer
            id={`${id}-dag`}
            type="date"
            required
            min={vroegste}
            max={laatste}
            value={datum}
            disabled={bezig}
            onChange={(e) => setDatum(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-28 flex-1">
            <label htmlFor={`${id}-begin`} className="text-meta font-medium text-inkt">
              {t("activiteitplaatsing.van")}
            </label>
            <Invoer
              id={`${id}-begin`}
              type="time"
              step={900}
              value={begin}
              disabled={bezig}
              onChange={(e) => setBegin(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="min-w-28 flex-1">
            <label htmlFor={`${id}-einde`} className="text-meta font-medium text-inkt">
              {t("activiteitplaatsing.tot")}
            </label>
            <Invoer
              id={`${id}-einde`}
              type="time"
              step={900}
              value={einde}
              disabled={bezig}
              onChange={(e) => setEinde(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        {urenOngeldig && begin !== "" && einde !== "" ? (
          <p role="alert" className="text-meta font-medium text-attentie-inkt">
            {t("activiteitplaatsing.eindeVoorBegin")}
          </p>
        ) : null}

        {/* The server composes its refusals in Dutch for the teacher (a closed day, a day outside the school year, the
            same activiteit twice from the same start), so its reason is shown as it arrives. */}
        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("activiteitplaatsing.mislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </form>
    </Blad>
  );
}
