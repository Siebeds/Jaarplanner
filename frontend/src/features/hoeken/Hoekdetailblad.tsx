import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst } from "../../lib/datum";
import { LESUREN } from "../activiteiten/lesuren";
import { t, telWoord } from "../../i18n";
import type { HoekplaatsingWeergave } from "./gegevens";

/**
 * One placed hoek, read back: which days it runs, what is in it, and the way to undo it.
 *
 * **THIS SHEET EXISTS BECAUSE THE FEATURE SHIPPED WITHOUT IT AND WAS BROKEN BY ITS ABSENCE.** An
 * antagonist audit found two things that were the same missing screen twice. A teacher could drop a
 * fiche on the wrong fortnight and had no way back: `DELETE /api/hoekplaatsingen/{id}` existed, the
 * mutation existed, and nothing called it. And the verrijking, the field the model calls the one that
 * carries the pedagogy, was write-only: she typed it, the server stored it, and no screen ever showed
 * it to her again.
 *
 * It compounded into a trap. Deleting the hoek itself is refused while it is placed, with a message
 * telling her to take it out of the agenda first, which was an instruction for something that could
 * not be done anywhere in the product. That is verbatim the failure `KlasBeheerService` records this
 * repository shipping once before.
 *
 * **It reads rather than edits, deliberately.** Changing a window, adding a second verrijking for a
 * later fortnight, moving one Thursday to another lesuur: the domain has verbs for all of it and this
 * sheet offers none of them yet. What it offers is the two things whose absence was a defect, seeing
 * and undoing. A sheet that edits is worth building next; a sheet that only edits would have left the
 * trap open.
 */
export function Hoekdetailblad({
  open,
  plaatsing,
  bezig,
  fout,
  onVerwijder,
  onSluit,
}: {
  open: boolean;
  plaatsing: HoekplaatsingWeergave;
  bezig: boolean;
  fout?: unknown;
  onVerwijder: () => void;
  onSluit: () => void;
}) {
  const lesuur = plaatsing.momenten[0]?.volgorde;
  const nummer = LESUREN.find((u) => u.slot === lesuur)?.nummer;
  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={plaatsing.hoekNaam}
      voet={
        <div className="flex items-center gap-2">
          {/* The way back out of a mistake, in the house style for a destructive confirm: ink fill,
              not a danger hue, exactly as `Bevestiging` does it. There is no second "are you sure"
              dialog over this one, because this sheet already shows the thing that would be lost. */}
          <Knop
            rang="stil"
            type="button"
            onClick={onVerwijder}
            disabled={bezig}
            className="bg-inkt text-inkt-op hover:bg-inkt active:bg-inkt"
          >
            {bezig ? t("hoekdetail.verwijderBezig") : t("hoekdetail.verwijder")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("hoekdetail.sluiten")}
          </Knop>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-micro uppercase text-inkt-zwak">{t("hoekdetail.periode")}</p>
          <p className="mt-0.5 text-body text-inkt">{periodeTekst(plaatsing.van, plaatsing.tot)}</p>
        </div>

        <div>
          <p className="text-micro uppercase text-inkt-zwak">{t("hoekdetail.uurrooster")}</p>
          {/* Each branch says only what it knows. "Niet in het uurrooster" is not a gap to apologise
              for: it is the ordinary answer, and most corners are placed that way. */}
          <p className="mt-0.5 text-body text-inkt">
            {nummer === undefined
              ? t("hoekplaatsing.nietInUurrooster")
              : t("hoekdetail.opLesuur", {
                  nummer,
                  dagen: telWoord(
                    plaatsing.momenten.length,
                    "hoekdetail.eenSchooldag",
                    "hoekdetail.aantalSchooldagen",
                  ),
                })}
          </p>
        </div>

        <div>
          <p className="text-micro uppercase text-inkt-zwak">{t("hoekdetail.verrijking")}</p>
          {plaatsing.verrijkingen.length === 0 ? (
            <p className="mt-0.5 text-body text-inkt-zacht">{t("hoekdetail.geenVerrijking")}</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-2">
              {plaatsing.verrijkingen.map((verrijking) => (
                <li key={verrijking.id} className="rounded-veld border border-lijn bg-vlak px-3 py-2">
                  {/* The window is printed even when it equals the placement's own, which is the
                      normal case today: a second verrijking for a later fortnight is the thing this
                      list is shaped for, and a reader should not have to learn a new layout the day
                      it appears. */}
                  <p className="text-micro text-inkt-zwak">
                    {periodeTekst(verrijking.van, verrijking.tot)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-body text-inkt">{verrijking.tekst}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Said only where it is true. A placement with no verrijking loses nothing a teacher typed,
            and warning about it anyway would train her to ignore the warning. */}
        {plaatsing.verrijkingen.length > 0 ? (
          <p className="text-meta text-inkt-zacht">
            {telWoord(
              plaatsing.verrijkingen.length,
              "hoekdetail.verwijderGevolgEen",
              "hoekdetail.verwijderGevolgAantal",
            )}
          </p>
        ) : null}

        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("hoekdetail.verwijderMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </div>
    </Blad>
  );
}
