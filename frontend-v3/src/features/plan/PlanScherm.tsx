import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Klaskiezer } from "../../app/Klaskiezer";
import { Knop } from "../../components/ui/Knop";
import { Blad } from "../../components/ui/Blad";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak, Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonPijlRechts } from "../../components/Iconen";
import { useGenereerJaarplan, useJaarplan, usePlaatsingacties, useRooster } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { ApiError } from "../../lib/api";
import type { KoppelingStatus, Planningsblok } from "../../lib/types";
import { periode } from "../../lib/datum";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { Schooljaarlint } from "./Schooljaarlint";
import { Plaatsingkaart } from "./Plaatsingkaart";

/**
 * The year plan of one class: which thema runs in which period, and every change a teacher makes to
 * that (FR-6, FR-7, FR-8).
 *
 * The strip at the top is both the overview and the navigation. Below it the same year is a vertical
 * list of periods, because that is where a placement can actually be read and acted on. The two are
 * one selection: pressing a period in the strip scrolls to its section.
 */
export function PlanScherm() {
  const { klasId, schooljaarId, klas } = useActieveSelectie();
  const [gekozenBlok, setGekozenBlok] = useState<string | null>(null);
  const [generatieOpen, setGeneratieOpen] = useState(false);

  const { data: plan, isPending: planLaadt, isError: planFout } = useJaarplan(klasId);
  const { data: rooster, isPending: roosterLaadt } = useRooster(schooljaarId);
  const acties = usePlaatsingacties(klasId ?? "");
  const generatie = useGenereerJaarplan(klasId ?? "");

  const blokken: Planningsblok[] = useMemo(() => rooster?.blokken ?? [], [rooster]);

  const perBlok = useMemo(() => {
    const kaart = new Map<string, typeof plan extends undefined ? never : NonNullable<typeof plan>["plaatsingen"]>();
    for (const blok of blokken) kaart.set(blok.start, []);
    for (const plaatsing of plan?.plaatsingen ?? []) {
      const bestaand = kaart.get(plaatsing.blokStart);
      if (bestaand) bestaand.push(plaatsing);
      else kaart.set(plaatsing.blokStart, [plaatsing]);
    }
    return kaart;
  }, [plan, blokken]);

  const geblokkeerd = useMemo(
    () => new Map((plan?.geblokkeerdePeriodes ?? []).map((p) => [p.blokStart, p.momentNaam])),
    [plan],
  );

  const bezig =
    acties.beoordeel.isPending || acties.vergrendel.isPending || acties.verplaats.isPending || acties.verwijder.isPending;

  function springNaar(blokStart: string) {
    setGekozenBlok(blokStart);
    document.getElementById(`periode-${blokStart}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <Schermkop titel={t("plan.titel")} rechts={<Klaskiezer />} />

      <Schermvlak>
        {!klasId ? (
          <Leegte titel={t("plan.geenKlas")} />
        ) : planFout ? (
          <Leegte titel={t("plan.fout")} />
        ) : planLaadt || roosterLaadt || !plan ? (
          <div className="flex flex-col gap-5">
            <Laadvlak className="h-20" />
            <Laadlijst rijen={4} />
          </div>
        ) : (
          <>
            <Schooljaarlint
              blokken={blokken}
              spreiding={plan.blokken}
              gekozenBlokStart={gekozenBlok}
              onKies={springNaar}
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="mono text-meta text-inkt-zwak">
                {telWoord(plan.plaatsingen.length, "plan.eenPlaatsing", "plan.aantalPlaatsingen")}
              </p>
              <Knop rang="hoofd" className="h-9 min-h-9 px-4 text-meta" onClick={() => setGeneratieOpen(true)}>
                {t("plan.genereer")}
              </Knop>
            </div>

            {generatie.isError ? (
              <p className="mt-3 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                {foutregel(generatie.error)}
              </p>
            ) : null}

            <ul className="mt-6 flex flex-col gap-6">
              {blokken.map((blok) => {
                const plaatsingen = perBlok.get(blok.start) ?? [];
                const moment = geblokkeerd.get(blok.start);
                return (
                  <li key={blok.start} id={`periode-${blok.start}`} className="scroll-mt-44">
                    <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      {/* The heading is the way into the period. A separate "open" button beside it
                          would be a second control for the thing the teacher already pressed. */}
                      <h2>
                        <Link
                          to={`/plan/periode/${blok.start}`}
                          className={cn(
                            "group inline-flex items-baseline gap-1.5 font-display text-sectie transition-colors duration-150 hover:text-accent",
                            gekozenBlok === blok.start ? "text-inkt" : "text-inkt-zacht",
                          )}
                        >
                          {periode(blok.start, blok.eind)}
                          <IcoonPijlRechts
                            aria-hidden="true"
                            className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                          />
                          <span className="sr-only">{t("plan.openPeriode")}</span>
                        </Link>
                      </h2>
                      {moment ? (
                        <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
                          {moment}
                        </span>
                      ) : null}
                    </header>

                    {plaatsingen.length === 0 ? (
                      <p className="rounded-kaart border border-dashed border-lijn-sterk px-4 py-5 text-center text-meta text-inkt-zwak">
                        {t("plan.leegPeriode")}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {plaatsingen.map((plaatsing) => (
                          <li key={plaatsing.id}>
                            <Plaatsingkaart
                              plaatsing={plaatsing}
                              blokken={blokken}
                              bezig={bezig}
                              onBeoordeel={(status: KoppelingStatus) =>
                                acties.beoordeel.mutate({ plaatsingId: plaatsing.id, status })
                              }
                              onVergrendel={(vergrendeld) =>
                                acties.vergrendel.mutate({ plaatsingId: plaatsing.id, vergrendeld })
                              }
                              onVerplaats={(blokStart) => acties.verplaats.mutate({ plaatsingId: plaatsing.id, blokStart })}
                              onVerwijder={() => acties.verwijder.mutate(plaatsing.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Schermvlak>

      <Blad
        open={generatieOpen}
        onOpenChange={setGeneratieOpen}
        titel={t("plan.genereer")}
        voet={
          <div className="flex gap-2">
            <Knop rang="rustig" onClick={() => setGeneratieOpen(false)}>
              {t("plan.annuleer")}
            </Knop>
            <Knop
              rang="hoofd"
              vol
              disabled={generatie.isPending}
              onClick={() => {
                generatie.mutate(undefined, { onSettled: () => setGeneratieOpen(false) });
              }}
            >
              {generatie.isPending ? t("plan.bezig") : t("plan.genereerNu")}
            </Knop>
          </div>
        }
      >
        {/* The consequence, stated before the button rather than discovered after it. It says only
            what the server's rule guarantees: a run discards placements that are still Voorgesteld
            and not locked, and leaves everything the teacher has decided on (Art. IX.3). */}
        <p className="text-body text-inkt">{t("plan.generatieGevolg", { klas: klas?.naam ?? "" })}</p>
      </Blad>
    </>
  );
}

/**
 * What to show a teacher when a generation fails.
 *
 * `detail` on a ProblemDetails from this backend is composed for the person who can act on it, so it
 * is rendered as is. With nothing there, a generic line: saying "something went wrong" is better
 * than inventing a cause.
 */
function foutregel(fout: unknown): string {
  if (fout instanceof ApiError && fout.detail) return fout.detail;
  return t("plan.generatieMislukt");
}
