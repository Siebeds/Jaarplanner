import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Knop } from "../../components/ui/Knop";
import { Leegte } from "../../components/ui/Leegte";
import { Geenklasleegte } from "../../app/Geenklasleegte";
import { Laadvlak, Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonPlus } from "../../components/Iconen";
import { useGenereerJaarplan, useJaarplan, usePlaatsingacties, usePlaatsThema, useRooster } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { geenToegangZin, useRechten } from "../../lib/rechten";
import { ApiError } from "../../lib/api";
import { valtBinnen, vandaag } from "../../lib/datum";
import { t } from "../../i18n";
import { aiFout } from "../themas/plaatsingen";
import { Generatiebalk } from "./Generatiebalk";
import { Jaartijdlijn } from "./Jaartijdlijn";
import { Plaatsingkaart } from "./Plaatsingkaart";
import { Themaplaatsingblad } from "./Themaplaatsingblad";
import { weergaveZoek } from "./weergave";
import { Weergavekeuze } from "./Weergavekeuze";

/**
 * The year plan of one class: which thema runs from which day to which day, and every change a teacher makes to that
 * (FR-6, FR-7, ADR-0053).
 *
 * **The timeline is the overview and the way in.** Above it the year balance says how many lesweken have a thema.
 * Pressing a bar opens its card below the timeline, where its days are changed; dragging a bar moves it by whole
 * weeks.
 *
 * **The AI generation fills the free days** (ADR-0055): its proposals land on the timeline like any other placement,
 * wearing the proposal ring, and are decided on their card.
 *
 * **Changing the plan is admin's and this klas's leerkrachten'** (E6-02, ADR-0030 §3, R7, R15). Anyone else who may
 * read the klas (FB-013) reads its plan, with one quiet line that says so.
 */
export function PlanScherm() {
  const navigeer = useNavigate();
  const { klasId, schooljaarId, klas } = useActieveSelectie();
  const { mag, bekend: rechtenBekend } = useRechten();
  const magPlannen = mag.klasplanningBewerken(klasId);
  const [gekozenId, setGekozenId] = useState<string | null>(null);
  // The add sheet: the day it was opened for, and a number that gives every opening a fresh form.
  const [toevoegen, setToevoegen] = useState<{ begin: string | null } | null>(null);
  const [keer, setKeer] = useState(0);

  function openToevoegen(begin: string | null) {
    plaatsThema.reset();
    setKeer((vorige) => vorige + 1);
    setToevoegen({ begin });
  }

  const { data: plan, isPending: planLaadt, isError: planFout } = useJaarplan(klasId);
  const { data: rooster, isPending: roosterLaadt } = useRooster(schooljaarId);
  const acties = usePlaatsingacties(klasId ?? "");
  const plaatsThema = usePlaatsThema(klasId ?? "");
  const genereer = useGenereerJaarplan(klasId ?? "");

  const plaatsingen = useMemo(() => plan?.plaatsingen ?? [], [plan]);
  const gekozen = plaatsingen.find((p) => p.id === gekozenId) ?? null;
  const aantalVervallen = plaatsingen.filter((p) => p.isVervallen).length;

  const nu = vandaag();
  const vandaagInSchooljaar = plan ? valtBinnen(nu, plan.eersteSchooldag, plan.laatsteSchooldag) : false;

  const mutaties = [acties.beoordeel, acties.wijzigDatums, acties.verschuif, acties.verwijder];
  const bezig = mutaties.some((mutatie) => mutatie.isPending) || genereer.isPending;

  // A refused change: a 403 on a stale page says the right is gone; a 400 carries the server's own sentence, which is
  // written for the teacher (a day without school, another thema on those days).
  const geweigerd = [...mutaties, plaatsThema].map((mutatie) => geenToegangZin(mutatie.error)).find((zin) => zin !== null);
  const actiefout = mutaties.map((mutatie) => foutzin(mutatie.error)).find((zin) => zin !== null) ?? null;

  function reset() {
    for (const mutatie of mutaties) mutatie.reset();
  }

  return (
    <>
      <Schermkop
        titel={t("plan.titel")}
        onder={
          /* The way back to the agenda is the agenda's own view switch, with Jaar chosen, at the right as it stands
             there (owner, FB-089): one control for moving between the zooms, wherever you are. A view opens the
             agenda on its default day. */
          <div className="flex sm:justify-end">
            <Weergavekeuze
              waarde="jaar"
              onKies={(zicht) => {
                if (zicht !== "jaar") navigeer(`/agenda${weergaveZoek(zicht)}`);
              }}
              className="w-full sm:w-auto"
            />
          </div>
        }
      />

      <Schermvlak>
        {!klasId ? (
          <Geenklasleegte titel={t("plan.geenKlas")} />
        ) : planFout ? (
          <Leegte titel={t("plan.fout")} />
        ) : planLaadt || roosterLaadt || !plan ? (
          <div className="flex flex-col gap-5">
            <Laadvlak className="h-20" />
            <Laadlijst rijen={4} />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Once, and only when true: the rights have answered WITH a gebruiker, and that gebruiker may not plan the
                klas shown. A failed `/api/ik` proves nothing about rights, so it says nothing. */}
            {rechtenBekend && !magPlannen && klas ? (
              <p className="text-meta text-inkt-zacht">{t("rechten.planningAlleenBekijken", { klas: klas.naam })}</p>
            ) : null}

            <div className="flex flex-wrap items-end justify-between gap-3">
              <dl className="flex flex-wrap gap-2">
                <Balanstegel waarde={plan.balans.lesweken} label={t("plan.balansLesweken")} />
                <Balanstegel waarde={plan.balans.metThema} label={t("plan.balansMetThema")} />
                <Balanstegel waarde={plan.balans.zonderThema} label={t("plan.balansZonderThema")} />
              </dl>

              <div className="flex flex-wrap items-center gap-2">
                {vandaagInSchooljaar ? (
                  <Link
                    to={`/agenda/dag/${nu}`}
                    className="inline-flex h-raak items-center rounded-veld border border-lijn-veld px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
                  >
                    {t("plan.vandaagInDeAgenda")}
                  </Link>
                ) : null}
                {magPlannen ? (
                  <Knop onClick={() => openToevoegen(null)}>
                    <IcoonPlus aria-hidden="true" className="h-4 w-4" />
                    {t("plan.voegThemaToe")}
                  </Knop>
                ) : null}
              </div>
            </div>

            {magPlannen ? (
              <Generatiebalk
                plaatsingen={plaatsingen}
                bezig={genereer.isPending}
                resultaat={genereer.data ?? null}
                fout={genereer.isError ? aiFout(genereer.error, "plan.generatieMislukt") : null}
                onGenereer={() => {
                  reset();
                  setGekozenId(null);
                  genereer.mutate();
                }}
              />
            ) : null}

            {aantalVervallen > 0 ? (
              <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                {aantalVervallen === 1
                  ? t("plan.vervallenEen")
                  : t("plan.vervallenAantal", { aantal: aantalVervallen })}
              </p>
            ) : null}

            {geweigerd || actiefout ? (
              <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                {geweigerd ?? actiefout}
              </p>
            ) : null}

            <Jaartijdlijn
              lesweken={plan.lesweken}
              onderbrekingen={rooster?.onderbrekingen ?? []}
              plaatsingen={plaatsingen}
              gekozenId={gekozenId}
              magBewerken={magPlannen}
              bezig={bezig}
              onKies={(id) => {
                reset();
                setGekozenId(id === gekozenId ? null : id);
              }}
              onVerschuif={(plaatsing, van) => {
                reset();
                setGekozenId(plaatsing.id);
                acties.verschuif.mutate({ plaatsingId: plaatsing.id, van });
              }}
            />

            {gekozen ? (
              <Plaatsingkaart
                // A fresh card, and fresh date fields, whenever the placement's days change.
                key={`${gekozen.id}-${gekozen.van}-${gekozen.tot}`}
                plaatsing={gekozen}
                plaatsingen={plaatsingen}
                eersteSchooldag={plan.eersteSchooldag}
                laatsteSchooldag={plan.laatsteSchooldag}
                magBewerken={magPlannen}
                bezig={bezig}
                onAanvaard={() => {
                  reset();
                  acties.beoordeel.mutate({ plaatsingId: gekozen.id, status: "Aanvaard" });
                }}
                onWeiger={() => {
                  reset();
                  acties.verwijder.mutate(gekozen.id, { onSuccess: () => setGekozenId(null) });
                }}
                onBewaarDatums={(van, tot) => {
                  reset();
                  acties.wijzigDatums.mutate({ plaatsingId: gekozen.id, van, tot });
                }}
                onVerwijder={() => {
                  reset();
                  acties.verwijder.mutate(gekozen.id, { onSuccess: () => setGekozenId(null) });
                }}
              />
            ) : plaatsingen.length > 0 ? (
              <p className="text-meta text-inkt-zacht">{t("plan.kiesOpTijdlijn")}</p>
            ) : null}
          </div>
        )}
      </Schermvlak>

      {klasId && plan ? (
        <Themaplaatsingblad
          key={keer}
          // Closed once this gebruiker may not plan the klas (after a 403 the rights are refetched).
          open={magPlannen && toevoegen !== null}
          klasId={klasId}
          beginVoorstel={toevoegen?.begin ?? null}
          eersteSchooldag={plan.eersteSchooldag}
          laatsteSchooldag={plan.laatsteSchooldag}
          bezig={plaatsThema.isPending}
          fout={foutzin(plaatsThema.error)}
          onSluit={() => setToevoegen(null)}
          onPlaats={(keuze) =>
            plaatsThema.mutate(keuze, {
              onSuccess: (bijgewerkt) => {
                setToevoegen(null);
                const nieuw = bijgewerkt.plaatsingen.find((p) => p.themaId === keuze.themaId && p.van === keuze.van);
                if (nieuw) setGekozenId(nieuw.id);
              },
            })
          }
        />
      ) : null}
    </>
  );
}

/** One figure of the year balance: a number and what it counts. Neutral: an empty week is not marked (owner, 2026-09-16). */
function Balanstegel({ waarde, label }: { waarde: number; label: string }) {
  return (
    <div className="flex min-w-36 flex-col-reverse rounded-kaart border border-lijn bg-kaart px-4 py-2.5">
      <dt className="text-meta text-inkt-zacht">{label}</dt>
      <dd className="mono text-hoofdstuk text-inkt">{waarde}</dd>
    </div>
  );
}

/**
 * The server's sentence for a refused change, or null. A 403 is left to `geenToegangZin`; anything without a detail
 * says nothing rather than inventing a cause.
 */
function foutzin(fout: unknown): string | null {
  if (!(fout instanceof ApiError) || fout.status === 403) return null;
  return fout.detail ?? t("periode.mislukt");
}
