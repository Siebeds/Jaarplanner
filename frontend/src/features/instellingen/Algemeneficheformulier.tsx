import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Tekstvlak } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import type { AlgemeneFicheInvoer, AlgemeneFicheWeergave } from "../algemene-fiches/gegevens";

/**
 * Making or renaming an algemene fiche: what it is called and what happens in it.
 *
 * **The goals are not in this sheet.** They are linked on the fiche's row, one at a time and saved at
 * once, the way every other goal link in this app is made; putting a picker in a form that only saves
 * on "Bewaren" would make a linked goal something she can lose by closing the sheet.
 */
export function Algemeneficheformulier({
  open,
  fiche,
  bezig,
  fout,
  onBewaar,
  onSluit,
}: {
  open: boolean;
  /** The fiche being changed, or undefined when making a new one. */
  fiche?: AlgemeneFicheWeergave;
  bezig: boolean;
  fout?: unknown;
  onBewaar: (invoer: AlgemeneFicheInvoer) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const [naam, setNaam] = useState(fiche?.naam ?? "");
  const [omschrijving, setOmschrijving] = useState(fiche?.omschrijving ?? "");
  const [naamFout, setNaamFout] = useState(false);

  function verstuur(event: FormEvent) {
    event.preventDefault();
    const leeg = naam.trim().length === 0;
    setNaamFout(leeg);
    if (leeg) return;

    onBewaar({ naam: naam.trim(), omschrijving: omschrijving.trim() || null });
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={fiche ? t("algemeneFiches.wijzigTitel") : t("algemeneFiches.nieuwTitel")}
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
            {t("algemeneFiches.naam")}
          </label>
          <Invoer
            id={`${id}-naam`}
            value={naam}
            disabled={bezig}
            aria-invalid={naamFout || undefined}
            placeholder={t("algemeneFiches.naamVoorbeeld")}
            onChange={(e) => {
              setNaam(e.target.value);
              if (naamFout) setNaamFout(false);
            }}
            className="mt-1.5"
          />
          {naamFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("algemeneFiches.naamVerplicht")}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${id}-omschrijving`} className="text-meta font-medium text-inkt">
            {t("algemeneFiches.omschrijving")}
          </label>
          <Tekstvlak
            id={`${id}-omschrijving`}
            value={omschrijving}
            disabled={bezig}
            rows={3}
            placeholder={t("algemeneFiches.omschrijvingVoorbeeld")}
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
