import { useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Veld, Invoer } from "../../components/ui/Veld";
import type { GeplandeActiviteit } from "../../lib/types";
import { t } from "../../i18n";

/**
 * One scheduled activiteit: where it comes from, and the two things a teacher can do to it.
 *
 * Moving is a date field rather than a drag. A drag is the nicer gesture on a desktop and it is
 * unusable on a phone, unreachable from a keyboard, and it cannot express "three weeks later"
 * without a scroll. The field works everywhere, and a drag can be added on top of it later without
 * taking it away.
 */
export function Activiteitblad({
  activiteit,
  vroegste,
  laatste,
  bezig,
  fout,
  onVerplaats,
  onVerwijder,
  onSluit,
}: {
  activiteit: GeplandeActiviteit | null;
  vroegste: string;
  laatste: string;
  bezig: boolean;
  fout: string | null;
  onVerplaats: (datum: string) => void;
  onVerwijder: () => void;
  onSluit: () => void;
}) {
  const [datum, setDatum] = useState("");

  return (
    <Blad
      // Remounting on every activiteit keeps the date field from carrying a value over from the one
      // that was open before, which would offer to move this activiteit to a day the teacher picked
      // for a different one.
      key={activiteit?.plaatsingId ?? "leeg"}
      open={activiteit !== null}
      onOpenChange={(open) => !open && onSluit()}
      titel={activiteit?.activiteitNaam ?? ""}
      voet={
        <div className="flex gap-2">
          <Knop rang="rustig" disabled={bezig} onClick={onVerwijder}>
            {t("periode.haalWeg")}
          </Knop>
          <Knop rang="hoofd" vol disabled={bezig || datum.length === 0} onClick={() => onVerplaats(datum)}>
            {t("periode.verplaats")}
          </Knop>
        </div>
      }
    >
      {activiteit ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <p className="text-meta text-inkt-zacht">
              {activiteit.themaNaam} / {activiteit.subthemaNaam}
            </p>
            <p className="mono text-[0.6875rem] text-inkt-zwak">{activiteit.activiteitType}</p>
          </div>

          {activiteit.valtBuitenThemaperiode ? (
            <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {t("periode.buitenPeriode")}
            </p>
          ) : null}

          {activiteit.doelcodes.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-micro uppercase text-inkt-zwak">{t("periode.doelen")}</h3>
              <ul className="flex flex-wrap gap-1">
                {activiteit.doelcodes.map((code) => (
                  <li
                    key={code}
                    className="mono rounded border border-lijn px-1.5 py-0.5 text-[0.625rem] text-inkt-zacht"
                  >
                    {code}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Veld label={t("periode.andereDag")}>
            {(id) => (
              <Invoer
                id={id}
                type="date"
                min={vroegste}
                max={laatste}
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
              />
            )}
          </Veld>

          {/* The server composes its refusals in Dutch for the person who can act on them (a closed
              day, a day outside the school year, the same activiteit twice on one day), so they are
              rendered as they arrive. */}
          {fout ? (
            <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">{fout}</p>
          ) : null}
        </div>
      ) : null}
    </Blad>
  );
}
