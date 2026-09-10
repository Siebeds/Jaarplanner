import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Keuze } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import type { KlasWeergave } from "../../lib/types";
import type { KlasInvoer } from "./mutaties";

/**
 * Making or renaming a klas: a name and the age it teaches.
 *
 * **Two fields, where there were three** (owner, 2026-08-30). The form used to ask for a leerjaar first
 * ("Kleutergroep, Leerjaar 1, …") and then, only for a kleutergroep, for a leeftijd on top. That asked the same
 * fact twice in the lager onderwijs, where the ordinal already names the code, and asked the useful half second
 * for the kleuters, where the ordinal cannot say which of the three years a group is. The leerjaar is now derived
 * from the leeftijd on the server, so the screen asks the thing that decides everything and nothing else.
 *
 * **The leeftijd decides which content the class gets**, not merely how its dekking is measured: a subthema and
 * its activiteiten hang on an age (Art. IX.2), so this field is what hands a class its year's work. That is written
 * here and NOT on the screen: a sentence saying it sat under this field until the owner cut it on 2026-08-30, along
 * with its twin in Subthemaformulier. Explanatory prose is the first thing this interface cuts, and a select with
 * nine options under its own label does not need a paragraph.
 *
 * **The nine codes come from `GET /api/jaarfasen`**, not from the klas being edited. Spelling them out here would
 * be a second answer to what a class may teach, and it would drift from `Jaarfasen` the first time the graadklas
 * decision (Art. XIV) changes one of them. Reading them off an existing klas was the first attempt and it had a
 * bootstrap hole: the very first klas of a school had none to read, so the field disabled itself and the school
 * could never create one.
 *
 * **A field that cannot be opened says why.** An empty list is now an API that could not answer, which is not a
 * teacher's mistake and must not look like one, so the sheet reports it instead of rendering a dead control.
 */
export function Klasformulier({
  open,
  klas,
  keuzes,
  bezig,
  fout,
  onBewaar,
  onSluit,
}: {
  open: boolean;
  /** The klas being changed, or undefined when making a new one. */
  klas?: KlasWeergave;
  /** The ages on offer, as the server names them. Empty only when the API could not answer. */
  keuzes: string[];
  bezig: boolean;
  fout?: unknown;
  onBewaar: (invoer: KlasInvoer) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const [naam, setNaam] = useState(klas?.naam ?? "");
  const [jaarfase, setJaarfase] = useState(klas?.jaarfase ?? "");
  const [naamFout, setNaamFout] = useState(false);
  const [leeftijdFout, setLeeftijdFout] = useState(false);

  function verstuur(event: FormEvent) {
    event.preventDefault();
    const naamLeeg = naam.trim().length === 0;
    const leeftijdLeeg = jaarfase === "";
    setNaamFout(naamLeeg);
    setLeeftijdFout(leeftijdLeeg);
    if (naamLeeg || leeftijdLeeg) return;

    onBewaar({ naam: naam.trim(), jaarfase });
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={klas ? t("klasbeheer.wijzigTitel") : t("klasbeheer.nieuwTitel")}
      voet={
        <div className="flex items-center gap-2">
          <Knop rang="hoofd" vol form={id} type="submit" disabled={bezig} className="@sm:w-auto @sm:px-6">
            {bezig ? t("themabeheer.bewaarBezig") : t("themabeheer.bewaar")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
        <div>
          <label htmlFor={`${id}-naam`} className="text-meta font-medium text-inkt">
            {t("klasbeheer.naam")}
          </label>
          <Invoer
            id={`${id}-naam`}
            value={naam}
            disabled={bezig}
            aria-invalid={naamFout || undefined}
            placeholder={t("klasbeheer.naamVoorbeeld")}
            onChange={(e) => {
              setNaam(e.target.value);
              if (naamFout) setNaamFout(false);
            }}
            className="mt-1.5"
          />
          {naamFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("klasbeheer.naamVerplicht")}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${id}-fase`} className="text-meta font-medium text-inkt">
            {t("klasbeheer.leeftijd")}
          </label>
          {keuzes.length === 0 ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("klasbeheer.leeftijdenOnbekend")}
            </p>
          ) : (
            <Keuze
              id={`${id}-fase`}
              aria-invalid={leeftijdFout || undefined}
              value={jaarfase}
              disabled={bezig}
              onChange={(e) => {
                setJaarfase(e.target.value);
                if (leeftijdFout) setLeeftijdFout(false);
              }}
              className="mt-1.5"
            >
              <option value="">{t("klasbeheer.kiesLeeftijd")}</option>
              {keuzes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Keuze>
          )}

          {leeftijdFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("klasbeheer.leeftijdVerplicht")}
            </p>
          ) : null}
        </div>

        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("themabeheer.bewaarMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </form>
    </Blad>
  );
}
