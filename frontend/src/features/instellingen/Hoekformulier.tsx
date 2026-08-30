import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Tekstvlak } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import type { HoekInvoer, HoekWeergave } from "./hoeken";

/**
 * Making or changing a corner: what it is called, and what is permanently in it.
 *
 * **The description is the field that needs the care, because it is the one a teacher will fill in
 * with the wrong thing.** What she puts in the boekenhoek for these two weeks is a verrijking and
 * belongs on the agenda, not here; what belongs here is the part that does not change all year. The
 * placeholder carries that distinction by showing the permanent kind ("vaste kast met prentenboeken")
 * rather than by explaining it in a sentence above the field. Explanatory prose is the first thing
 * this interface cuts, and a label plus one example does the same work in a tenth of the space.
 *
 * **A textarea and not an input**, because the answer is a sentence more often than a phrase, and a
 * single-line field that scrolls sideways hides what she already typed.
 */
export function Hoekformulier({
  open,
  hoek,
  bezig,
  fout,
  onBewaar,
  onSluit,
}: {
  open: boolean;
  /** The corner being changed, or undefined when making a new one. */
  hoek?: HoekWeergave;
  bezig: boolean;
  fout?: unknown;
  onBewaar: (invoer: HoekInvoer) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const [naam, setNaam] = useState(hoek?.naam ?? "");
  const [omschrijving, setOmschrijving] = useState(hoek?.omschrijving ?? "");
  const [naamFout, setNaamFout] = useState(false);

  function verstuur(event: FormEvent) {
    event.preventDefault();
    const leeg = naam.trim().length === 0;
    setNaamFout(leeg);
    if (leeg) return;

    // An empty description is absent, not an empty string: the row renders nothing for it either way,
    // and sending "" would store a value that reads as "she described it as nothing".
    onBewaar({ naam: naam.trim(), omschrijving: omschrijving.trim() || null });
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={hoek ? t("hoeken.wijzigTitel") : t("hoeken.nieuwTitel")}
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
            {t("hoeken.naam")}
          </label>
          <Invoer
            id={`${id}-naam`}
            value={naam}
            disabled={bezig}
            aria-invalid={naamFout || undefined}
            placeholder={t("hoeken.naamVoorbeeld")}
            onChange={(e) => {
              setNaam(e.target.value);
              if (naamFout) setNaamFout(false);
            }}
            className="mt-1.5"
          />
          {naamFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("hoeken.naamVerplicht")}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${id}-omschrijving`} className="text-meta font-medium text-inkt">
            {t("hoeken.omschrijving")}
          </label>
          <Tekstvlak
            id={`${id}-omschrijving`}
            value={omschrijving}
            disabled={bezig}
            rows={3}
            placeholder={t("hoeken.omschrijvingVoorbeeld")}
            onChange={(e) => setOmschrijving(e.target.value)}
            className="mt-1.5"
          />
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
