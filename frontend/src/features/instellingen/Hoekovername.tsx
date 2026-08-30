import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Keuze } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import type { KlasWeergave } from "../../lib/types";

/**
 * Taking over another class's corners.
 *
 * **It says "overnemen" and not "kopiëren", and the word is doing work.** What happens is a copy, but
 * what a teacher is doing is taking over a colleague's list: the rows become hers, and renaming one
 * here changes nothing in the room it came from. "Kopiëren" invites the question this sheet must not
 * leave open, which is whether the two stay in step.
 *
 * **The only classes offered are the other ones.** Taking over from yourself is not a mistake worth a
 * validation message when it can simply not be on the list. The server refuses it anyway, because a
 * screen is not a guard.
 *
 * **No preview of what will be taken over.** It was drawn and cut: the sheet listed the source's
 * corners with checkboxes, which turned a one-decision action into a form, and the decision it added
 * ("not that one") is one she can make afterwards in two clicks on a list she now owns.
 */
export function Hoekovername({
  open,
  klassen,
  bezig,
  fout,
  onNeemOver,
  onSluit,
}: {
  open: boolean;
  /** The classes to choose from: every one except the class being filled. */
  klassen: KlasWeergave[];
  bezig: boolean;
  fout?: unknown;
  onNeemOver: (vanKlasId: string) => void;
  onSluit: () => void;
}) {
  const id = useId();
  const [vanKlasId, setVanKlasId] = useState("");
  const [keuzeFout, setKeuzeFout] = useState(false);

  function verstuur(event: FormEvent) {
    event.preventDefault();
    if (vanKlasId === "") {
      setKeuzeFout(true);
      return;
    }

    onNeemOver(vanKlasId);
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={t("hoeken.overnemenTitel")}
      voet={
        <div className="flex items-center gap-2">
          <Knop
            rang="hoofd"
            vol
            form={id}
            type="submit"
            disabled={bezig || klassen.length === 0}
            className="@sm:w-auto @sm:px-6"
          >
            {bezig ? t("hoeken.overnemenBezig") : t("hoeken.overnemen")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
        {/* A school with one class has nowhere to take over from. That is a fact about the school and
            not a fault, so it is said plainly and the control above is disabled rather than absent:
            a button that vanishes leaves the teacher wondering what she did. */}
        {klassen.length === 0 ? (
          <p className="text-body text-inkt-zacht">{t("hoeken.geenAndereKlas")}</p>
        ) : (
          <div>
            <label htmlFor={`${id}-klas`} className="text-meta font-medium text-inkt">
              {t("hoeken.overnemenVan")}
            </label>
            <Keuze
              id={`${id}-klas`}
              value={vanKlasId}
              disabled={bezig}
              aria-invalid={keuzeFout || undefined}
              onChange={(e) => {
                setVanKlasId(e.target.value);
                if (keuzeFout) setKeuzeFout(false);
              }}
              className="mt-1.5"
            >
              <option value="">{t("hoeken.kiesKlas")}</option>
              {klassen.map((klas) => (
                <option key={klas.id} value={klas.id}>
                  {klas.naam}
                </option>
              ))}
            </Keuze>
            {keuzeFout ? (
              <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
                {t("hoeken.kiesKlasVerplicht")}
              </p>
            ) : null}

            {/* What "overnemen" does, in one line, because the word alone does not say that the
                corners she already has are left alone. It is the one sentence in this sheet. */}
            <p className="mt-2 text-meta text-inkt-zacht">{t("hoeken.overnemenUitleg")}</p>
          </div>
        )}

        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("hoeken.overnemenMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </form>
    </Blad>
  );
}
