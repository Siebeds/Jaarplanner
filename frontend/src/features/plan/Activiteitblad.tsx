import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { useInBeeld } from "../../components/ui/inBeeld";
import { Leegte } from "../../components/ui/Leegte";
import { Verwijderknop } from "../../components/ui/Rijknoppen";
import { useThemaVoorKlas } from "../../lib/queries";
import { useRechten } from "../../lib/rechten";
import type { GeplandeActiviteit } from "../../lib/types";
import { t } from "../../i18n";
import { Activiteitformulier, type ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import {
  useKoppelActiviteitdoel,
  useOntkoppelActiviteitdoel,
  useWijzigActiviteit,
} from "../themas/mutaties";

/**
 * Opening an activiteit from the agenda.
 *
 * **It is the same form as the thema page's, not a second one.** This used to be its own sheet with
 * its own fields, and the two drifted exactly where you would expect: the agenda offered a Hoek box
 * beside every soort, where a hoek only exists for the soort Hoek, and it printed the raw enum names
 * instead of the catalogue's. A teacher editing the same activiteit from two screens met two sets of
 * rules. `Activiteitformulier` is the one set; this file is only what the agenda adds to it.
 *
 * What it adds is the DAY, which belongs to the plaatsing and not to the activiteit. It therefore
 * sits in its own section with its own buttons, and deliberately does not ride along on Bewaren: the
 * same activiteit can be planned on several days, and saving a rename is not agreeing to move one of
 * them.
 *
 * The full record has to arrive before the form may open. The weekplanning row this sheet is opened
 * from carries a name and a type and nothing else, while the server's edit payload defaults hoek,
 * verwachteUitkomsten, onderzoeksvraagId and kleur to null, so a form that prefilled from the row
 * would erase four fields on the first save.
 *
 * **Two rights, two halves** (E6-02, ADR-0030 §3). The activiteit is shared content of its subthema's leeftijd: its
 * form for whoever may change that (R17, R23), its facts for anyone else, and its goal picker for admin and that
 * leeftijd's hoofdleerkrachten (R19). The day is this klas's planning: the day section only for whoever may plan the
 * klas (R7, R15). A teacher reading a colleague's agenda gets the facts and no day controls.
 */
export function Activiteitblad({
  activiteit,
  datum,
  klasId,
  magPlannen,
  vroegste,
  laatste,
  bezig,
  fout,
  onVerplaats,
  onVerwijder,
  onSluit,
}: {
  activiteit: GeplandeActiviteit | null;
  datum: string;
  klasId: string | null;
  /** Whether this gebruiker may change this klas's planning: the day section appears only then. */
  magPlannen: boolean;
  vroegste: string;
  laatste: string;
  /** A day action is running: placing, moving or removing. */
  bezig: boolean;
  /** What the server said about the last day action, in Dutch, already composed for the teacher. */
  fout: string | null;
  /** The day and the two times, together: this is also the non-drag route to both (WCAG 2.2 SC 2.5.7). */
  onVerplaats: (datum: string, begin: string, einde: string) => void;
  onVerwijder: () => void;
  onSluit: () => void;
}) {
  const themaId = activiteit?.themaId ?? "";
  const { data: thema, isPending, isError: themaFout } = useThemaVoorKlas(themaId, activiteit ? klasId : null);
  const qc = useQueryClient();
  const wijzig = useWijzigActiviteit(themaId);
  const koppel = useKoppelActiviteitdoel(themaId);
  const ontkoppel = useOntkoppelActiviteitdoel(themaId);
  const { mag } = useRechten();
  // Whether a day action was asked from this sheet. The sheet is keyed on the plaatsing, so this starts false on
  // every open, while `fout` is the agenda's and can belong to an earlier sheet.
  const [gevraagd, setGevraagd] = useState(false);

  const subthema = thema?.subthemas.find((sub) =>
    sub.activiteiten.some((kandidaat) => kandidaat.id === activiteit?.activiteitId),
  );
  const volledig = subthema?.activiteiten.find((kandidaat) => kandidaat.id === activiteit?.activiteitId) as
    | ActiviteitMetKleur
    | undefined;

  if (!activiteit) return null;

  if (!volledig) {
    /*
      THE THREE REASONS THERE IS NO FORM TO SHOW, kept apart because they need different answers.

      It used to be one branch printing "Niet gelukt", which for the third case was a whole panel
      holding two words and no way forward. The owner hit it (2026-08-31) on a row whose activiteit had
      been deleted while the page was open, and asked what the screen was.

      Only what THIS branch guarantees is asserted (the E5-03 rule): the thema loaded and does not hold
      this activiteit. It does not say who removed it or when, because the client cannot know, and it
      does not say "deleted", because a move to another thema produces the same absence.
    */
    const stale = !isPending && !themaFout && thema !== undefined;

    return (
      <Blad open onOpenChange={(o) => !o && onSluit()} maat="breed" titel={activiteit.activiteitNaam}>
        {isPending ? (
          <Laadlijst rijen={5} />
        ) : stale ? (
          <Leegte
            titel={t("periode.activiteitWeg")}
            /* A real control and not a sentence about one (the E3-06 rule). The row she clicked came
               from a cached answer, so refetching the agenda is what actually makes it go away. */
            actie={
              <Knop
                onClick={() => {
                  void qc.invalidateQueries({ queryKey: ["weekplanning"] });
                  onSluit();
                }}
              >
                {t("periode.agendaVernieuwen")}
              </Knop>
            }
          />
        ) : (
          <p className="text-body text-inkt-zacht">{t("periode.mislukt")}</p>
        )}
      </Blad>
    );
  }

  // `volledig` was found inside `subthema`, so the leeftijd is there whenever the form is.
  const leeftijd = subthema?.leeftijd ?? "";

  // THE DAY'S FAILURE, OUTSIDE THE DAY SECTION, as an alert (E6-02 slice 4, fix round 2, F7; WCAG 4.1.3). This sheet
  // stays open on a failure and is a modal dialog, so the agenda's own strip does not show a refusal that arrives while
  // it is open, and this line is where it is announced. After a refusal the refetched rights take the day section
  // away; the line stays, in the same place in the tree, and says why. It stays the same element, so it is not
  // announced twice, also when the content right goes with the refusal and the form turns into the facts:
  // `Activiteitformulier` keeps one dialog for both (fix round 3, F8). For a gebruiker without the day section it
  // shows only a failure asked from this sheet.
  const dagfout = fout !== null && (magPlannen || gevraagd) ? fout : null;

  return (
    <Activiteitformulier
      open
      activiteit={volledig}
      alleenLezen={!mag.activiteitInhoudBewerken({ ...volledig, leeftijd })}
      magDoelen={mag.activiteitDoelenKoppelen({ ...volledig, leeftijd })}
      themaId={themaId}
      onderzoeksvragen={subthema?.onderzoeksvragen ?? []}
      bezig={wijzig.isPending}
      fout={wijzig.isError ? wijzig.error : undefined}
      koppelenBezig={koppel.isPending || ontkoppel.isPending}
      onKoppel={(code) => koppel.mutate({ activiteitId: volledig.id, leerplandoelCode: code })}
      onOntkoppel={(koppelingId) => ontkoppel.mutate({ activiteitId: volledig.id, koppelingId })}
      onBewaar={(invoer) =>
        wijzig.mutate({ activiteitId: volledig.id, invoer }, { onSuccess: onSluit })
      }
      onSluit={onSluit}
      extra={
        magPlannen || dagfout ? (
          <>
            {magPlannen ? (
              <Dagsectie
                naam={volledig.naam}
                datum={datum}
                begin={activiteit.begin}
                einde={activiteit.einde}
                vroegste={vroegste}
                laatste={laatste}
                bezig={bezig}
                buitenPeriode={activiteit.valtBuitenThemaperiode}
                onVerplaats={(...dag) => {
                  setGevraagd(true);
                  onVerplaats(...dag);
                }}
                onVerwijder={() => {
                  setGevraagd(true);
                  onVerwijder();
                }}
              />
            ) : null}
            {/* The server composes its refusals in Dutch for the person who can act on them (a closed day, a day
                outside the school year, the same activiteit twice on one day, no right to plan this klas), so they
                are rendered as they arrive. */}
            {dagfout ? <Dagfout fout={dagfout} /> : null}
          </>
        ) : undefined
      }
    />
  );
}

/** The day's failure as an alert, brought into the sheet's view when it appears (fix round 2, F7). */
function Dagfout({ fout }: { fout: string }) {
  const ref = useInBeeld<HTMLParagraphElement>();
  return (
    <p
      ref={ref}
      role="alert"
      className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt"
    >
      {fout}
    </p>
  );
}

/**
 * When this activiteit happens, and the two things that can happen to it there.
 *
 * **Fields with a button rather than fields that commit on change**: a `type="date"` or `type="time"` input fires on
 * every complete value the browser can make of what has been typed so far, so committing on change would move the
 * activiteit to a day and an hour nobody chose on the way to the ones they did.
 *
 * **This is also the keyboard route to a gesture that is otherwise a drag** (ADR-0028, WCAG 2.2 SC 2.5.7). Moving a
 * block and making it longer are a drag and an edge-drag in the grid; here they are three fields and a button, which
 * is why the section takes all three rather than only the day it used to.
 *
 * **Taking it off the day is a bin on the section's own heading** (TB-025), bordered because it acts on the whole
 * plaatsing. Its label names the day: it takes off this one plaatsing, while the same activiteit may stay on other days
 * (ADR-0028) and always stays in its subthema.
 */
function Dagsectie({
  naam,
  datum,
  begin,
  einde,
  vroegste,
  laatste,
  bezig,
  buitenPeriode,
  onVerplaats,
  onVerwijder,
}: {
  /** The activiteit's name, for the label of the bin. */
  naam: string;
  datum: string;
  /** `HH:mm:ss` from the server; the inputs work in `HH:mm` and the seconds are put back on submit. */
  begin: string;
  einde: string;
  vroegste: string;
  laatste: string;
  bezig: boolean;
  buitenPeriode: boolean;
  onVerplaats: (datum: string, begin: string, einde: string) => void;
  onVerwijder: () => void;
}) {
  const [nieuweDag, setNieuweDag] = useState(datum);
  const [nieuwBegin, setNieuwBegin] = useState(begin.slice(0, 5));
  const [nieuwEinde, setNieuwEinde] = useState(einde.slice(0, 5));

  // `HH:mm` sorts as it reads, so comparing the strings is comparing the times.
  const ongeldig = nieuwBegin === "" || nieuwEinde === "" || nieuwEinde <= nieuwBegin;
  const gewijzigd =
    nieuweDag.length > 0 &&
    (nieuweDag !== datum || nieuwBegin !== begin.slice(0, 5) || nieuwEinde !== einde.slice(0, 5));

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-micro uppercase text-inkt-zwak">{t("periode.opDezeDag")}</h3>
        <Verwijderknop
          omrand
          label={t("periode.vanDagAria", { naam })}
          titel={t("periode.vanDag")}
          disabled={bezig}
          onClick={onVerwijder}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor="agenda-dag" className="text-meta font-medium text-inkt">
            {t("periode.opDag")}
          </label>
          <Invoer
            id="agenda-dag"
            type="date"
            min={vroegste}
            max={laatste}
            value={nieuweDag}
            disabled={bezig}
            onChange={(e) => setNieuweDag(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="min-w-24 flex-1">
          <label htmlFor="agenda-begin" className="text-meta font-medium text-inkt">
            {t("activiteitplaatsing.van")}
          </label>
          <Invoer
            id="agenda-begin"
            type="time"
            step={900}
            value={nieuwBegin}
            disabled={bezig}
            onChange={(e) => setNieuwBegin(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="min-w-24 flex-1">
          <label htmlFor="agenda-einde" className="text-meta font-medium text-inkt">
            {t("activiteitplaatsing.tot")}
          </label>
          <Invoer
            id="agenda-einde"
            type="time"
            step={900}
            value={nieuwEinde}
            disabled={bezig}
            onChange={(e) => setNieuwEinde(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <Knop
          rang="rustig"
          disabled={bezig || !gewijzigd || ongeldig}
          onClick={() => onVerplaats(nieuweDag, `${nieuwBegin}:00`, `${nieuwEinde}:00`)}
        >
          {t("periode.verplaats")}
        </Knop>
      </div>

      {ongeldig && nieuwBegin !== "" && nieuwEinde !== "" ? (
        <p role="alert" className="mt-2 text-meta font-medium text-attentie-inkt">
          {t("tijdraster.eindeVoorBegin")}
        </p>
      ) : null}

      {buitenPeriode ? (
        <p className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {t("periode.buitenPeriode")}
        </p>
      ) : null}
    </>
  );
}
