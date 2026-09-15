import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Tekstvlak } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { ApiError } from "../../lib/api";
import { periode as periodeTekst, volleDag } from "../../lib/datum";
import { toonBereik } from "../plan/tijd";
import { t, telWoord } from "../../i18n";
import {
  MAXIMALE_VERRIJKING,
  useBewaarHoekverrijkingen,
  useHoekverrijkingen,
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
 * **It shows and edits the corner's verrijking per subthemaperiode** (FB-020; owner, 2026-09-15: also editable
 * here, not only from the subthemabalk). A verrijking belongs to the hoek and a stored window of a subthema, not to
 * this placement, so the sheet lists every stored window touching the placement's days, each with what the corner
 * holds then. Taking the placement out of the agenda leaves them standing.
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
 * **EACH DELETE SAYS HOW MUCH IT DELETES.** The owner looked at this sheet and reported not seeing a
 * way to delete (2026-08-31): the one button read "Uit de agenda halen" while it removed the whole run
 * with everything in it, which is not what a teacher standing on one Tuesday expects those words to
 * mean. The scope is in the label now: one verrijking, or the whole period.
 *
 * **Taking ONE day out of the timetable is deliberately not here**, though the aggregate has the verb
 * and the endpoint exists. There is no way to put a day back, so it would be a one way door, and this
 * sheet exists because of a one way door. The pair is worth building; half of it is not.
 *
 * **`alleenLezen` is the same sheet for a gebruiker who may not plan this klas** (E6-02, ADR-0030 §3, R7): the
 * period, the hours and the verrijking as they are, with every button that would change them left out. That includes
 * the doubled-day sentence, which is an instruction for changing the hours.
 */
export function Hoekdetailblad({
  open,
  klasId,
  plaatsing,
  bezig,
  fout,
  alleenLezen = false,
  onVerwijder,
  onSluit,
}: {
  open: boolean;
  /** The klas the placement is in, whose subthemaperiodes the verrijkingen hang on. */
  klasId: string;
  plaatsing: HoekplaatsingWeergave;
  bezig: boolean;
  fout?: unknown;
  /** The gebruiker may read this klas's planning and not change it. */
  alleenLezen?: boolean;
  onVerwijder: () => void;
  onSluit: () => void;
}) {
  const id = useId();
  // Every stored subthemaperiode touching the placement's days, with what each hoek holds then (FB-020).
  const verrijkingen = useHoekverrijkingen(klasId, plaatsing.van, plaatsing.tot);
  const bewaar = useBewaarHoekverrijkingen(klasId);
  const zetUren = useZetHoekuren();

  /**
   * Which subthemaperiode's verrijking is open in the form, by the window's id, or nothing.
   *
   * One piece of state and not a flag per row, so two rows can never be in edit mode at once. The draft
   * lives beside it rather than inside the row, for the same reason.
   */
  const [bewerkt, setBewerkt] = useState<string | null>(null);
  const [tekst, setTekst] = useState("");

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
  const drukBezig = bezig || bewaar.isPending || zetUren.isPending;

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
  // browser then drops focus to the page, or, in some browsers, leaves it on the disabled button. So focus moves to
  // the reason only when the last control focused was one of those two AND focus now sits on the page or on that
  // disabled button. Anywhere else it stays where she put it. Only on the change to a doubled run, never on opening.
  //
  // The last focused control is remembered from `focusin` because removal fires no event of its own: by the time this
  // effect runs, the button that had focus is already gone, and only this record still says it was there.
  //
  // ONE ORDERING ASSUMPTION, written down because nothing checks it: this effect runs before Radix's FocusScope reacts
  // to the removal. It does today, because the query update reaches this component through useSyncExternalStore, which
  // commits on a sync lane and flushes passive effects before the MutationObserver's microtask. If that order ever
  // flipped (a transition, useDeferredValue), Radix would park the dropped focus on the dialog first, its focusin
  // would overwrite the record, and nothing here would recover it. That is also why a focus on the dialog itself is
  // never treated as lost: when it sits there, the record says so.
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
      (actief.id === `${id}-bewaar` && actief instanceof HTMLButtonElement && actief.disabled);
    if (verloren) document.getElementById(`${id}-dubbel`)?.focus();
  }, [dubbeleZin, id]);

  function beginBewerken(periodeId: string, huidige: string) {
    bewaar.reset();
    setBewerkt(periodeId);
    setTekst(huidige);
  }

  /**
   * Writes this hoek's text for one window, and only this hoek's: the other corners of the same window are not in the
   * request, so they stay as they are. A blank text removes it, the rule the subthemabalk's sheet follows too.
   */
  function bewaarVoor(periodeId: string, waarde: string, daarna?: () => void) {
    bewaar.mutate(
      { subthemaperiodeId: periodeId, verrijkingen: [{ hoekId: plaatsing.hoekId, tekst: waarde.trim() }] },
      { onSuccess: daarna },
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
      // No footer for a reader: its one button would be "Sluiten", the sheet's own close control a second time.
      voet={
        alleenLezen ? undefined : (
        <div className="flex flex-wrap items-center gap-2">
          {/* The widest undo, in the house style for a destructive confirm: ink fill, not a danger hue,
              exactly as `Bevestiging` does it. There is no second "are you sure" over this one, because
              this sheet already shows the thing that would be lost, and the label now says how much of
              it that is. */}
          {alleenLezen ? null : (
            <Knop
              rang="stil"
              type="button"
              onClick={onVerwijder}
              disabled={drukBezig}
              className="bg-inkt text-inkt-op hover:bg-inkt active:bg-inkt"
            >
              {bezig ? t("hoekdetail.verwijderBezig") : t("hoekdetail.verwijder")}
            </Knop>
          )}
          <Knop rang="stil" type="button" onClick={onSluit} disabled={drukBezig}>
            {t("hoekdetail.sluiten")}
          </Knop>
        </div>
        )
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
                  hours, in place of a button that would open a form she cannot save. Neither for a reader: both
                  are about changing the hours. */}
              {alleenLezen ? null : dubbeleZin ? (
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

          {/* Each branch says only what it knows: "no window in these days" needs a read that succeeded, and a failed
              read keeps a list it already had rather than claiming it is empty. */}
          {verrijkingen.isPending ? (
            <div className="mt-1">
              <Laadlijst rijen={2} />
            </div>
          ) : verrijkingen.data === undefined ? (
            <p role="alert" className="mt-1 text-meta text-attentie-inkt">
              {t("hoekdetail.verrijkingenMislukt")}
            </p>
          ) : verrijkingen.data.length === 0 ? (
            <p className="mt-1 text-body text-inkt-zacht">{t("hoekdetail.geenSubthemaperiode")}</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-2">
              {verrijkingen.data.map((periode) => {
                const eigen = periode.verrijkingen.find((v) => v.hoekId === plaatsing.hoekId);
                const naam = periode.subthemaNaam;
                return (
                  <li key={periode.subthemaperiodeId} className="rounded-veld border border-lijn bg-vlak px-3 py-2">
                    <p className="text-micro text-inkt-zwak">
                      {t("hoekdetail.tijdens", { naam, periode: periodeTekst(periode.van, periode.tot) })}
                    </p>

                    {bewerkt === periode.subthemaperiodeId ? (
                      <Verrijkingsvorm
                        tekst={tekst}
                        onTekst={setTekst}
                        bezig={bewaar.isPending}
                        fout={bewaar.isError ? bewaar.error : undefined}
                        onBewaar={() => bewaarVoor(periode.subthemaperiodeId, tekst, () => setBewerkt(null))}
                        onAnnuleer={() => setBewerkt(null)}
                      />
                    ) : (
                      <>
                        <p
                          className={
                            eigen ? "mt-0.5 whitespace-pre-line text-body text-inkt" : "mt-0.5 text-body text-inkt-zacht"
                          }
                        >
                          {eigen?.tekst ?? t("hoekdetail.geenVerrijking")}
                        </p>
                        {alleenLezen ? null : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Knop
                              rang="stil"
                              type="button"
                              disabled={drukBezig}
                              aria-label={
                                eigen
                                  ? t("hoekdetail.verrijkingBewerkVan", { naam })
                                  : t("hoekdetail.verrijkingInvullenVan", { naam })
                              }
                              onClick={() => beginBewerken(periode.subthemaperiodeId, eigen?.tekst ?? "")}
                            >
                              {eigen ? t("hoekdetail.verrijkingBewerk") : t("hoekdetail.verrijkingInvullen")}
                            </Knop>
                            {eigen ? (
                              <Knop
                                rang="stil"
                                type="button"
                                disabled={drukBezig}
                                aria-label={t("hoekdetail.verrijkingWegVan", { naam })}
                                onClick={() => {
                                  bewaar.reset();
                                  bewaarVoor(periode.subthemaperiodeId, "");
                                }}
                              >
                                {t("hoekdetail.verrijkingWeg")}
                              </Knop>
                            ) : null}
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* A failed removal has no open form to show it in. */}
          {bewaar.isError && bewerkt === null ? (
            <Melding titel={t("hoekdetail.verrijkingMislukt")} reden={bewaar.error} />
          ) : null}
        </div>

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
 * The one form, for filling in a verrijking and for rewriting one. Saving it blank removes it.
 *
 * Not a `<form>`: this sheet already sits inside one on some screens and a nested form is invalid HTML
 * that submits the wrong thing. The buttons are explicit for the same reason.
 */
function Verrijkingsvorm({
  tekst,
  onTekst,
  bezig,
  fout,
  onBewaar,
  onAnnuleer,
}: {
  tekst: string;
  onTekst: (waarde: string) => void;
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
        maxLength={MAXIMALE_VERRIJKING}
        onChange={(e) => onTekst(e.target.value)}
      />
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
