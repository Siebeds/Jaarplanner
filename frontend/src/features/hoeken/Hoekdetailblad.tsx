import { useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Tekstvlak } from "../../components/ui/Veld";
import { IcoonPlus } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst } from "../../lib/datum";
import { LESUREN } from "../activiteiten/lesuren";
import { t, telWoord } from "../../i18n";
import {
  useBewaarHoekverrijking,
  useVerwijderHoekverrijking,
  type HoekplaatsingWeergave,
} from "./gegevens";

/**
 * One placed hoek: which days it runs, what is in it, and the three sizes of undo.
 *
 * **THIS SHEET EXISTS BECAUSE THE FEATURE SHIPPED WITHOUT IT AND WAS BROKEN BY ITS ABSENCE.** An
 * antagonist audit found two things that were the same missing screen twice. A teacher could drop a
 * fiche on the wrong fortnight and had no way back: `DELETE /api/hoekplaatsingen/{id}` existed, the
 * mutation existed, and nothing called it. And the verrijking, the field the model calls the one that
 * carries the pedagogy, was write-only: she typed it, the server stored it, and no screen ever showed
 * it to her again.
 *
 * **It edits the verrijking since 2026-08-31** (owner: "ik wil ook de verrijking kunnen aanpassen, nu
 * is het read-only nadat ik opgeslagen heb"). Showing it and never letting her change it was the same
 * defect one step further on: a typo in the one field carrying the pedagogy was permanent unless the
 * whole placement was deleted and redone.
 *
 * **What it still does not offer is a SECOND verrijking for a later stretch of the window.** The
 * domain and the endpoint take one, and a second one needs its own two dates, which is a control this
 * sheet has no room for yet. So "toevoegen" appears only where there is nothing to edit, and an
 * existing verrijking keeps the window it has. Deliberately no sentence about the missing half: the
 * window each one covers is printed, so nothing on the screen claims otherwise.
 *
 * **EACH DELETE SAYS HOW MUCH IT DELETES.** The owner looked at this sheet and reported not seeing a
 * way to delete (2026-08-31): the one button read "Uit de agenda halen" while it removed the whole run
 * with everything in it, which is not what a teacher standing on one Tuesday expects those words to
 * mean. The scope is in the label now: one verrijking, or the whole period.
 *
 * **Taking ONE day out of the timetable is deliberately not here**, though the aggregate has the verb
 * and the endpoint exists. There is no way to put a day back, so it would be a one way door, and this
 * sheet exists because of a one way door. The pair is worth building; half of it is not.
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
  const bewaar = useBewaarHoekverrijking();
  const verwijderVerrijking = useVerwijderHoekverrijking();

  /**
   * Which verrijking is open in the form: its id, `"nieuw"`, or nothing.
   *
   * One piece of state and not a flag per row, so two rows can never be in edit mode at once. The draft
   * lives beside it rather than inside the row, for the same reason.
   */
  const [bewerkt, setBewerkt] = useState<string | null>(null);
  const [tekst, setTekst] = useState("");
  const [leegFout, setLeegFout] = useState(false);

  const lesuur = plaatsing.momenten[0]?.volgorde;
  const nummer = LESUREN.find((u) => u.slot === lesuur)?.nummer;
  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  const drukBezig = bezig || bewaar.isPending || verwijderVerrijking.isPending;

  function beginBewerken(id: string, huidige: string) {
    bewaar.reset();
    setLeegFout(false);
    setBewerkt(id);
    setTekst(huidige);
  }

  function bewaarTekst() {
    const schoon = tekst.trim();
    if (schoon.length === 0) {
      // Not an error until she tries to save it, and not a silent delete either: clearing the field is
      // a plausible way to mean "remove this", and guessing which she meant would throw away her text.
      setLeegFout(true);
      return;
    }

    const bestaande = plaatsing.verrijkingen.find((v) => v.id === bewerkt);
    bewaar.mutate(
      {
        plaatsingId: plaatsing.id,
        verrijkingId: bestaande?.id,
        // A new one covers the whole run; an edited one keeps the window it has, since this sheet
        // offers no control for changing it.
        van: bestaande?.van ?? plaatsing.van,
        tot: bestaande?.tot ?? plaatsing.tot,
        tekst: schoon,
      },
      { onSuccess: () => setBewerkt(null) },
    );
  }

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={plaatsing.hoekNaam}
      voet={
        <div className="flex flex-wrap items-center gap-2">
          {/* The widest undo, in the house style for a destructive confirm: ink fill, not a danger hue,
              exactly as `Bevestiging` does it. There is no second "are you sure" over this one, because
              this sheet already shows the thing that would be lost, and the label now says how much of
              it that is. */}
          <Knop
            rang="stil"
            type="button"
            onClick={onVerwijder}
            disabled={drukBezig}
            className="bg-inkt text-inkt-op hover:bg-inkt active:bg-inkt"
          >
            {bezig ? t("hoekdetail.verwijderBezig") : t("hoekdetail.verwijder")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={drukBezig}>
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

          {plaatsing.verrijkingen.length === 0 && bewerkt !== "nieuw" ? (
            <div className="mt-1 flex flex-col items-start gap-2">
              <p className="text-body text-inkt-zacht">{t("hoekdetail.geenVerrijking")}</p>
              <Knop
                rang="stil"
                type="button"
                disabled={drukBezig}
                onClick={() => beginBewerken("nieuw", "")}
              >
                <IcoonPlus aria-hidden="true" className="mr-1.5 h-4 w-4" />
                {t("hoekdetail.verrijkingToevoegen")}
              </Knop>
            </div>
          ) : null}

          <ul className="mt-1 flex flex-col gap-2">
            {plaatsing.verrijkingen.map((verrijking) => {
              const venster = periodeTekst(verrijking.van, verrijking.tot);
              return (
                <li key={verrijking.id} className="rounded-veld border border-lijn bg-vlak px-3 py-2">
                  {/* The window is printed even when it equals the run's own, which is the normal case
                      today: a second verrijking for a later fortnight is the thing this list is shaped
                      for, and a reader should not have to learn a new layout the day it appears. */}
                  <p className="text-micro text-inkt-zwak">{venster}</p>

                  {bewerkt === verrijking.id ? (
                    <Verrijkingsvorm
                      tekst={tekst}
                      onTekst={setTekst}
                      leegFout={leegFout}
                      bezig={bewaar.isPending}
                      fout={bewaar.isError ? bewaar.error : undefined}
                      onBewaar={bewaarTekst}
                      onAnnuleer={() => setBewerkt(null)}
                    />
                  ) : (
                    <>
                      <p className="mt-0.5 whitespace-pre-line text-body text-inkt">{verrijking.tekst}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Knop
                          rang="stil"
                          type="button"
                          disabled={drukBezig}
                          aria-label={t("hoekdetail.verrijkingBewerkVan", { periode: venster })}
                          onClick={() => beginBewerken(verrijking.id, verrijking.tekst)}
                        >
                          {t("hoekdetail.verrijkingBewerk")}
                        </Knop>
                        <Knop
                          rang="stil"
                          type="button"
                          disabled={drukBezig}
                          aria-label={t("hoekdetail.verrijkingWegVan", { periode: venster })}
                          onClick={() => {
                            verwijderVerrijking.reset();
                            verwijderVerrijking.mutate({
                              plaatsingId: plaatsing.id,
                              verrijkingId: verrijking.id,
                            });
                          }}
                        >
                          {t("hoekdetail.verrijkingWeg")}
                        </Knop>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {/* The form for a brand new one, outside the list because there is no row to sit in yet. */}
          {bewerkt === "nieuw" ? (
            <div className="mt-1 rounded-veld border border-lijn bg-vlak px-3 py-2">
              <p className="text-micro text-inkt-zwak">{periodeTekst(plaatsing.van, plaatsing.tot)}</p>
              <Verrijkingsvorm
                tekst={tekst}
                onTekst={setTekst}
                leegFout={leegFout}
                bezig={bewaar.isPending}
                fout={bewaar.isError ? bewaar.error : undefined}
                onBewaar={bewaarTekst}
                onAnnuleer={() => setBewerkt(null)}
              />
            </div>
          ) : null}

          {verwijderVerrijking.isError ? (
            <Melding titel={t("hoekdetail.verrijkingWegMislukt")} reden={verwijderVerrijking.error} />
          ) : null}
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

/**
 * The one form, for a new verrijking and for rewriting one.
 *
 * Not a `<form>`: this sheet already sits inside one on some screens and a nested form is invalid HTML
 * that submits the wrong thing. The buttons are explicit for the same reason.
 */
function Verrijkingsvorm({
  tekst,
  onTekst,
  leegFout,
  bezig,
  fout,
  onBewaar,
  onAnnuleer,
}: {
  tekst: string;
  onTekst: (waarde: string) => void;
  leegFout: boolean;
  bezig: boolean;
  fout?: unknown;
  onBewaar: () => void;
  onAnnuleer: () => void;
}) {
  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <Tekstvlak
        aria-label={t("hoekdetail.verrijkingLabel")}
        placeholder={t("hoekdetail.verrijkingVoorbeeld")}
        value={tekst}
        onChange={(e) => onTekst(e.target.value)}
      />
      {leegFout ? <p className="text-meta text-attentie-inkt">{t("hoekdetail.verrijkingLeeg")}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Knop type="button" onClick={onBewaar} disabled={bezig}>
          {bezig ? t("hoekdetail.bewarenBezig") : t("hoekdetail.bewaren")}
        </Knop>
        <Knop rang="stil" type="button" onClick={onAnnuleer} disabled={bezig}>
          {t("hoekdetail.annuleren")}
        </Knop>
      </div>
      {fout ? <Melding titel={t("hoekdetail.verrijkingMislukt")} reden={fout} /> : null}
    </div>
  );
}

/** A refusal, with the server's own Dutch under it when it sent one. */
function Melding({ titel, reden }: { titel: string; reden: unknown }) {
  const detail = reden instanceof ApiError ? reden.detail : undefined;
  return (
    <div role="alert" className="mt-2 rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
      <p className="text-body font-medium text-attentie-inkt">{titel}</p>
      {detail ? <p className="mt-1 text-meta text-attentie-inkt">{detail}</p> : null}
    </div>
  );
}
