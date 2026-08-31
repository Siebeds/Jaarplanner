import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Leegte } from "../../components/ui/Leegte";
import { useThemaVoorKlas } from "../../lib/queries";
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
 */
export function Activiteitblad({
  activiteit,
  datum,
  klasId,
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
  vroegste: string;
  laatste: string;
  /** A day action is running: placing, moving or removing. */
  bezig: boolean;
  /** What the server said about the last day action, in Dutch, already composed for the teacher. */
  fout: string | null;
  onVerplaats: (datum: string) => void;
  onVerwijder: () => void;
  onSluit: () => void;
}) {
  const themaId = activiteit?.themaId ?? "";
  const { data: thema, isPending, isError: themaFout } = useThemaVoorKlas(themaId, activiteit ? klasId : null);
  const qc = useQueryClient();
  const wijzig = useWijzigActiviteit(themaId);
  const koppel = useKoppelActiviteitdoel(themaId);
  const ontkoppel = useOntkoppelActiviteitdoel(themaId);

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

  return (
    <Activiteitformulier
      open
      activiteit={volledig}
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
        <Dagsectie
          datum={datum}
          vroegste={vroegste}
          laatste={laatste}
          bezig={bezig}
          fout={fout}
          buitenPeriode={activiteit.valtBuitenThemaperiode}
          onVerplaats={onVerplaats}
          onVerwijder={onVerwijder}
        />
      }
    />
  );
}

/**
 * The day this activiteit is planned on, and the two things that can happen to it there.
 *
 * A date field with a button rather than a field that commits on change: a `type="date"` input fires
 * on every complete value the browser can make of what has been typed so far, so committing on change
 * moves the activiteit to a day nobody chose on the way to the one they did.
 */
function Dagsectie({
  datum,
  vroegste,
  laatste,
  bezig,
  fout,
  buitenPeriode,
  onVerplaats,
  onVerwijder,
}: {
  datum: string;
  vroegste: string;
  laatste: string;
  bezig: boolean;
  fout: string | null;
  buitenPeriode: boolean;
  onVerplaats: (datum: string) => void;
  onVerwijder: () => void;
}) {
  const [nieuweDag, setNieuweDag] = useState(datum);
  const verplaatst = nieuweDag !== datum && nieuweDag.length > 0;

  return (
    <>
      <h3 className="text-micro uppercase text-inkt-zwak">{t("periode.opDezeDag")}</h3>

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
        <Knop rang="rustig" disabled={bezig || !verplaatst} onClick={() => onVerplaats(nieuweDag)}>
          {t("periode.verplaats")}
        </Knop>
        <Knop rang="stil" disabled={bezig} onClick={onVerwijder}>
          {t("periode.haalWeg")}
        </Knop>
      </div>

      {buitenPeriode ? (
        <p className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {t("periode.buitenPeriode")}
        </p>
      ) : null}

      {/* The server composes its refusals in Dutch for the person who can act on them (a closed day,
          a day outside the school year, the same activiteit twice on one day), so they are rendered
          as they arrive. */}
      {fout ? (
        <p className="mt-2 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {fout}
        </p>
      ) : null}
    </>
  );
}
