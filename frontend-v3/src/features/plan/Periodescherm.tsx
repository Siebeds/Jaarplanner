import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Segment } from "../../components/ui/Segment";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { IcoonPijlLinks, IcoonPijlRechts } from "../../components/Iconen";
import { useDagacties, useJaarplan, useRooster, useWeekplanning } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { ApiError } from "../../lib/api";
import type { GeplandeActiviteit } from "../../lib/types";
import {
  eersteVanMaand,
  laatsteVanMaand,
  maandJaar,
  maandagVan,
  periode as periodeTekst,
  verschuif,
  verschuifMaanden,
  volleDag,
  weekdagKort,
  dagNummer,
} from "../../lib/datum";
import { t } from "../../i18n";
import { Dagcel } from "./Dagcel";
import { Maandrooster } from "./Maandrooster";
import { Activiteitkiezer } from "./Activiteitkiezer";
import { Activiteitblad } from "./Activiteitblad";

type Weergave = "maand" | "week" | "dag";

/**
 * One themaperiode from the inside: month, week or day, and the day is where an activiteit actually
 * lands on the calendar (FR-6.2, FR-7.2).
 *
 * Everything here is persisted server side. That is worth stating because the obvious shortcut is
 * not: the other candidate frontend keeps its day agenda in localStorage, where it belongs to one
 * browser and is shared with nobody, which for a plan a school is inspected on is worse than not
 * having it.
 */
export function Periodescherm() {
  const { datum: periodeStart } = useParams<{ datum: string }>();
  const { klasId, schooljaarId } = useActieveSelectie();

  const [weergave, setWeergave] = useState<Weergave>("week");
  const [anker, setAnker] = useState<string>(periodeStart ?? "");
  const [kiezerDatum, setKiezerDatum] = useState<string | null>(null);
  const [geopend, setGeopend] = useState<GeplandeActiviteit | null>(null);

  const { data: rooster } = useRooster(schooljaarId);
  const { data: plan } = useJaarplan(klasId);
  const acties = useDagacties(klasId ?? "");

  const blok = useMemo(
    () => rooster?.blokken.find((b) => b.start === periodeStart),
    [rooster, periodeStart],
  );

  // The range the current view needs. The server clamps it to the school year, so a month that
  // starts before the first school day is a legal request rather than an error.
  const [van, tot] = useMemo<[string, string]>(() => {
    if (!anker) return ["", ""];
    if (weergave === "maand") {
      // Whole weeks, so the grid is rectangular: back to the Monday on or before the first, and on
      // to the Sunday on or after the last.
      const eersteMaandag = maandagVan(eersteVanMaand(anker));
      const laatsteZondag = verschuif(maandagVan(laatsteVanMaand(anker)), 6);
      return [eersteMaandag, laatsteZondag];
    }
    if (weergave === "week") {
      const maandag = maandagVan(anker);
      return [maandag, verschuif(maandag, 6)];
    }
    return [anker, anker];
  }, [anker, weergave]);

  const { data: planning, isPending } = useWeekplanning(klasId, van, tot);

  // The thema's running in this period are what the activity picker may offer.
  const themaIdsInPeriode = useMemo(() => {
    const ids = (plan?.plaatsingen ?? [])
      .filter((plaatsing) => plaatsing.blokStart === periodeStart && plaatsing.status !== "Geweigerd")
      .map((plaatsing) => plaatsing.themaId);
    return [...new Set(ids)];
  }, [plan, periodeStart]);

  const bezig = acties.plaats.isPending || acties.verplaats.isPending || acties.verwijder.isPending;

  function schuif(richting: -1 | 1) {
    if (weergave === "maand") setAnker(verschuifMaanden(anker, richting));
    else if (weergave === "week") setAnker(verschuif(anker, richting * 7));
    else setAnker(verschuif(anker, richting));
  }

  const ankerLabel =
    weergave === "maand" ? maandJaar(anker) : weergave === "week" ? periodeTekst(van, tot) : volleDag(anker);

  const foutTekst = (fout: unknown) =>
    fout instanceof ApiError && fout.detail ? fout.detail : fout ? t("periode.mislukt") : null;

  if (!klasId || !periodeStart) {
    return (
      <>
        <Schermkop titel={t("periode.titel")} />
        <Schermvlak>
          <Leegte titel={t("plan.geenKlas")} actie={<TerugNaarPlan />} />
        </Schermvlak>
      </>
    );
  }

  return (
    <>
      <Schermkop
        titel={blok ? periodeTekst(blok.start, blok.eind) : t("periode.titel")}
        onder={
          <div className="flex flex-wrap items-center gap-2">
            <Segment
              label={t("periode.weergave")}
              waarde={weergave}
              onKies={setWeergave}
              opties={[
                { waarde: "maand", label: t("periode.maand") },
                { waarde: "week", label: t("periode.week") },
                { waarde: "dag", label: t("periode.dag") },
              ]}
            />

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t("periode.vorige")}
                onClick={() => schuif(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-veld border border-lijn-veld text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
              >
                <IcoonPijlLinks className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={t("periode.volgende")}
                onClick={() => schuif(1)}
                className="flex h-9 w-9 items-center justify-center rounded-veld border border-lijn-veld text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
              >
                <IcoonPijlRechts className="h-4 w-4" />
              </button>
              <span className="ml-1 text-meta text-inkt-zacht">{ankerLabel}</span>
            </div>
          </div>
        }
      />

      <Schermvlak>
        <TerugNaarPlan />

        <div className="mt-4">
          {isPending || !planning ? (
            <Laadvlak className="h-72" />
          ) : weergave === "maand" ? (
            <Maandrooster
              dagen={planning.dagen}
              ankerMaand={anker}
              periodeVan={blok?.start ?? van}
              periodeTot={blok?.eind ?? tot}
              onKiesDag={(datum) => {
                setAnker(datum);
                setWeergave("dag");
              }}
            />
          ) : (
            <ul
              className={
                weergave === "week"
                  ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
                  : "grid grid-cols-1 gap-2"
              }
            >
              {planning.dagen.map((dag) => (
                <li key={dag.datum}>
                  <Dagcel
                    dag={dag}
                    kop={weergave === "dag" ? volleDag(dag.datum) : `${weekdagKort(dag.datum)} ${dagNummer(dag.datum)}`}
                    groot={weergave === "dag"}
                    onVoegToe={setKiezerDatum}
                    onOpen={setGeopend}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {acties.plaats.isError ? (
          <p className="mt-4 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
            {foutTekst(acties.plaats.error)}
          </p>
        ) : null}
      </Schermvlak>

      <Activiteitkiezer
        datum={kiezerDatum}
        klasId={klasId}
        themaIds={themaIdsInPeriode}
        bezig={bezig}
        onSluit={() => setKiezerDatum(null)}
        onKies={(activiteitId) => {
          if (!kiezerDatum) return;
          acties.plaats.mutate(
            { activiteitId, datum: kiezerDatum },
            { onSuccess: () => setKiezerDatum(null) },
          );
        }}
      />

      <Activiteitblad
        activiteit={geopend}
        vroegste={rooster?.start ?? ""}
        laatste={rooster?.eind ?? ""}
        bezig={bezig}
        fout={foutTekst(acties.verplaats.error ?? acties.verwijder.error)}
        onSluit={() => setGeopend(null)}
        onVerplaats={(datum) => {
          if (!geopend) return;
          acties.verplaats.mutate(
            { plaatsingId: geopend.plaatsingId, datum },
            {
              onSuccess: () => {
                setGeopend(null);
                // Follow the activiteit to its new day. Without this the day view keeps showing the
                // day it LEFT, so a successful move looks exactly like the activiteit being deleted:
                // the sheet closes and the card is gone. Measured by doing it.
                setAnker(datum);
              },
            },
          );
        }}
        onVerwijder={() => {
          if (!geopend) return;
          acties.verwijder.mutate(geopend.plaatsingId, { onSuccess: () => setGeopend(null) });
        }}
      />
    </>
  );
}

function TerugNaarPlan() {
  return (
    <Link
      to="/plan"
      className="inline-flex h-9 items-center rounded-full border border-lijn px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
    >
      {t("periode.terug")}
    </Link>
  );
}
