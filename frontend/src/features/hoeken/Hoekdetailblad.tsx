import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Tekstvlak } from "../../components/ui/Veld";
import { IcoonPlus } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst, volleDag } from "../../lib/datum";
import { toonBereik } from "../plan/tijd";
import { t, telWoord } from "../../i18n";
import {
  useBewaarHoekverrijking,
  useVerwijderHoekverrijking,
  useZetHoekuren,
  type HoekmomentWeergave,
  type HoekplaatsingWeergave,
} from "./gegevens";

/**
 * One placed hoek: which days it runs, at which hours, what is in it, and the three sizes of undo.
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
 * **It edits the hours of the run since 2026-09-11** (owner: "ik wil op het detailscherm van de hoeken
 * de mogelijkheid om de uren aan te passen"). Two rulings of the same day shape it. Every day gets the
 * new hours, the ones she moved by hand included, and when a day currently differs the form says so
 * before she saves rather than after. And a day that holds the hoek more than once (days dragged onto
 * another) blocks new hours altogether, with that day named: at the same hours they would be one row
 * written several times, and the owner chose refusing over quietly folding them into one. Then the
 * reason stands where she reads the hours and there is no button, rather than a form she cannot save.
 *
 * **The hours are printed per group, not read off the first day.** This line used to take the first
 * appearance and present it as the run's: after she shortened only the Monday it said "8:00 - 10:00, op
 * 4 schooldagen" while three of the four still ran to 11:50. Each distinct stretch of hours now has its
 * own line and its own count, so the line is true whatever she dragged.
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
  const id = useId();
  const bewaar = useBewaarHoekverrijking();
  const verwijderVerrijking = useVerwijderHoekverrijking();
  const zetUren = useZetHoekuren();

  /**
   * Which verrijking is open in the form: its id, `"nieuw"`, or nothing.
   *
   * One piece of state and not a flag per row, so two rows can never be in edit mode at once. The draft
   * lives beside it rather than inside the row, for the same reason.
   */
  const [bewerkt, setBewerkt] = useState<string | null>(null);
  const [tekst, setTekst] = useState("");
  const [leegFout, setLeegFout] = useState(false);

  // The hours form. `HH:mm`, which is what a time input reads and writes; the seconds are added on save.
  const [urenOpen, setUrenOpen] = useState(false);
  const [begin, setBegin] = useState("");
  const [einde, setEinde] = useState("");
  // `HH:mm` sorts as it reads, so comparing the strings is comparing the times.
  const urenOngeldig = begin === "" || einde === "" || einde <= begin;

  const groepen = useMemo(() => uurgroepen(plaatsing.momenten), [plaatsing.momenten]);
  const dubbeleDagen = useMemo(() => dagenMeerDanEenKeer(plaatsing.momenten), [plaatsing.momenten]);
  // The server refuses the same case in the same words (`Hoekplaatsing.ZetUren`); both tests pin the literal.
  const dubbeleZin =
    dubbeleDagen.length > 0
      ? t("hoekdetail.dubbeleDag", { dagen: DAGENLIJST.format(dubbeleDagen.map(volleDag)) })
      : null;
  const gewoon = groepen[0];
  const dagen = new Set(plaatsing.momenten.map((m) => m.datum)).size;
  const afwijkendeDagen = gewoon
    ? new Set(
        plaatsing.momenten.filter((m) => m.begin !== gewoon.begin || m.einde !== gewoon.einde).map((m) => m.datum),
      ).size
    : 0;

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;
  const drukBezig = bezig || bewaar.isPending || verwijderVerrijking.isPending || zetUren.isPending;

  // Focus follows the form: into its first field when it opens, back to the button that opened it when it closes.
  // Without the second half a keyboard user who saves lands on the top of the page, because the control that had
  // focus is gone. When the run gained a doubled day while the form was open, that button is no longer rendered and
  // the reason stands in its place, so focus goes there. By id rather than ref because neither `Knop` nor `Invoer`
  // passes a ref through.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (urenOpen) document.getElementById(`${id}-begin`)?.focus();
    else if (wasOpen.current) {
      (document.getElementById(`${id}-uren`) ?? document.getElementById(`${id}-dubbel`))?.focus();
    }
    wasOpen.current = urenOpen;
  }, [urenOpen, id]);

  // The same guarantee when a doubled day arrives by refetch under a control that has focus. Two controls lose it that
  // way: "Uren aanpassen", which is swapped for the reason, and Bewaren, which turns disabled in an open form. The
  // browser then drops focus to the page (Radix parks a dropped focus on the dialog itself), or, in some browsers,
  // leaves it on the disabled button. So focus moves to the reason only when the last control focused was one of those
  // two AND focus now sits on the page, the dialog, or that disabled button. Anywhere else, Sluiten or a time field,
  // it stays where she put it. Only on the change to a doubled run, never when the sheet opens on one.
  //
  // The last focused control is remembered from `focusin` because removal fires no event of its own: by the time this
  // effect runs, the button that had focus is already gone, and only this record still says it was there.
  const laatsteFocus = useRef<Element | null>(null);
  useEffect(() => {
    const onthoud = (gebeurtenis: FocusEvent) => {
      laatsteFocus.current = gebeurtenis.target instanceof Element ? gebeurtenis.target : null;
    };
    document.addEventListener("focusin", onthoud);
    return () => document.removeEventListener("focusin", onthoud);
  }, []);

  const vorigeZin = useRef(dubbeleZin);
  useEffect(() => {
    const zojuistDubbel = vorigeZin.current === null && dubbeleZin !== null;
    vorigeZin.current = dubbeleZin;
    if (!zojuistDubbel) return;

    const laatste = laatsteFocus.current?.id;
    if (laatste !== `${id}-uren` && laatste !== `${id}-bewaar`) return;

    const actief = document.activeElement;
    const verloren =
      actief === null ||
      actief === document.body ||
      actief.getAttribute("role") === "dialog" ||
      (actief.id === `${id}-bewaar` && actief instanceof HTMLButtonElement && actief.disabled);
    if (verloren) document.getElementById(`${id}-dubbel`)?.focus();
  }, [dubbeleZin, id]);

  function beginBewerken(verrijkingId: string, huidige: string) {
    bewaar.reset();
    setLeegFout(false);
    setBewerkt(verrijkingId);
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

  function beginUren() {
    if (!gewoon) return;
    zetUren.reset();
    // Filled with the hours most days have, which is what she is most likely adjusting from.
    setBegin(gewoon.begin.slice(0, 5));
    setEinde(gewoon.einde.slice(0, 5));
    setUrenOpen(true);
  }

  function bewaarUren() {
    zetUren.mutate(
      { plaatsingId: plaatsing.id, begin: `${begin}:00`, einde: `${einde}:00` },
      { onSuccess: () => setUrenOpen(false) },
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

          {/* Each branch says only what it knows. A placement with no rows is one made before every hoek had to
              have a time (ADR-0028), so the sentence says that rather than inventing an hour for it, and offers no
              hours to change: there is no row for them to land on. */}
          {gewoon === undefined ? (
            <p className="mt-0.5 text-body text-inkt">{t("hoekdetail.geenUur")}</p>
          ) : urenOpen ? (
            <div className="mt-1.5 flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-28 flex-1">
                  <label htmlFor={`${id}-begin`} className="text-micro text-inkt-zacht">
                    {t("hoekdetail.van")}
                  </label>
                  <Invoer
                    id={`${id}-begin`}
                    type="time"
                    step={900}
                    value={begin}
                    disabled={zetUren.isPending}
                    aria-describedby={dubbeleZin ? `${id}-dubbel` : undefined}
                    onChange={(e) => setBegin(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="min-w-28 flex-1">
                  <label htmlFor={`${id}-einde`} className="text-micro text-inkt-zacht">
                    {t("hoekdetail.tot")}
                  </label>
                  <Invoer
                    id={`${id}-einde`}
                    type="time"
                    step={900}
                    value={einde}
                    disabled={zetUren.isPending}
                    aria-describedby={dubbeleZin ? `${id}-dubbel` : undefined}
                    onChange={(e) => setEinde(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <p className="text-micro text-inkt-zacht">
                {t("hoekdetail.geldtVoor", {
                  dagen: telWoord(dagen, "hoekdetail.eenSchooldag", "hoekdetail.aantalSchooldagen"),
                })}
              </p>

              {/* Said before she saves, never after, and only where true. The form is only reachable with a doubled
                  day when the run changed under it (another tab dragged a block while this one was open), so the
                  reason is also tied to both fields: a keyboard user who never reaches the disabled button still
                  hears why. The overwrite warning gives way to it, since saving cannot happen. Focusable by script
                  only, as the place focus returns to when the button it would go back to is gone. */}
              {dubbeleZin ? (
                <p id={`${id}-dubbel`} tabIndex={-1} className="text-meta font-medium text-attentie-inkt outline-none">
                  {dubbeleZin}
                </p>
              ) : afwijkendeDagen > 0 ? (
                <p className="text-meta font-medium text-attentie-inkt">
                  {telWoord(afwijkendeDagen, "hoekdetail.afwijkendEen", "hoekdetail.afwijkendAantal")}
                </p>
              ) : null}

              {urenOngeldig && begin !== "" && einde !== "" ? (
                <p role="alert" className="text-meta font-medium text-attentie-inkt">
                  {t("hoekdetail.eindeVoorBegin")}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {/* Disabled on an impossible pair or a doubled day rather than sending it: each has its reason
                    printed just above, and a refusal would teach nothing that sentence does not already say. */}
                <Knop
                  id={`${id}-bewaar`}
                  type="button"
                  onClick={bewaarUren}
                  disabled={zetUren.isPending || urenOngeldig || dubbeleZin !== null}
                >
                  {zetUren.isPending ? t("hoekdetail.bewarenBezig") : t("hoekdetail.bewaren")}
                </Knop>
                <Knop rang="stil" type="button" onClick={() => setUrenOpen(false)} disabled={zetUren.isPending}>
                  {t("hoekdetail.annuleren")}
                </Knop>
              </div>

              {zetUren.isError ? <Melding titel={t("hoekdetail.urenMislukt")} reden={zetUren.error} /> : null}
            </div>
          ) : (
            <div className="mt-0.5 flex flex-col items-start">
              {groepen.map((groep) => (
                <p key={`${groep.begin}-${groep.einde}`} className="text-body text-inkt">
                  {t("hoekdetail.opUur", {
                    periode: toonBereik(groep.begin, groep.einde),
                    dagen: telWoord(groep.dagen, "hoekdetail.eenSchooldag", "hoekdetail.aantalSchooldagen"),
                  })}
                </p>
              ))}

              {/* A doubled day blocks new hours (owner, 2026-09-11), so the reason stands here, where she reads the
                  hours, in place of a button that would open a form she cannot save. */}
              {dubbeleZin ? (
                <p
                  id={`${id}-dubbel`}
                  tabIndex={-1}
                  className="mt-1.5 text-meta font-medium text-attentie-inkt outline-none"
                >
                  {dubbeleZin}
                </p>
              ) : (
                <Knop
                  id={`${id}-uren`}
                  rang="stil"
                  type="button"
                  disabled={drukBezig}
                  onClick={beginUren}
                  className="mt-2"
                >
                  {t("hoekdetail.urenAanpassen")}
                </Knop>
              )}
            </div>
          )}
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

/** `maandag 14 september en woensdag 16 september`: the locale's own "and", so no Dutch word lives in this file. */
const DAGENLIJST = new Intl.ListFormat("nl", { style: "long", type: "conjunction" });

/** One stretch of hours and how many days run at it. */
interface Uurgroep {
  begin: string;
  einde: string;
  dagen: number;
}

/**
 * The run's appearances grouped by their hours, the most common first.
 *
 * Counting rows within a group is counting days: the aggregate refuses the same hoek starting twice at one time on
 * one day, so two rows with the same hours always sit on two different days.
 */
function uurgroepen(momenten: readonly HoekmomentWeergave[]): Uurgroep[] {
  const perUren = new Map<string, Uurgroep>();

  for (const moment of momenten) {
    const sleutel = `${moment.begin}-${moment.einde}`;
    const groep = perUren.get(sleutel);
    if (groep) groep.dagen += 1;
    else perUren.set(sleutel, { begin: moment.begin, einde: moment.einde, dagen: 1 });
  }

  return [...perUren.values()].sort((a, b) => b.dagen - a.dagen || a.begin.localeCompare(b.begin));
}

/**
 * The days holding this hoek more than once, in calendar order: the case that blocks new hours for the run.
 *
 * "More than once" and not "twice": the aggregate only refuses a second row with the same start, so days dragged onto
 * one Monday at different hours can leave it three rows.
 */
function dagenMeerDanEenKeer(momenten: readonly HoekmomentWeergave[]): string[] {
  const perDag = new Map<string, number>();
  for (const moment of momenten) perDag.set(moment.datum, (perDag.get(moment.datum) ?? 0) + 1);
  return [...perDag].filter(([, aantal]) => aantal > 1).map(([datum]) => datum).sort();
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
