import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Klaskiezer } from "../../app/Klaskiezer";
import { Knop } from "../../components/ui/Knop";
import { Blad } from "../../components/ui/Blad";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak, Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonPijlRechts, IcoonPlus } from "../../components/Iconen";
import { useGenereerJaarplan, useJaarplan, usePlaatsingacties, usePlaatsThema, useRooster } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { ApiError } from "../../lib/api";
import type { KoppelingStatus, Planningsblok } from "../../lib/types";
import { periode } from "../../lib/datum";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { Schooljaarlint } from "./Schooljaarlint";
import { Plaatsingkaart } from "./Plaatsingkaart";
import { Themakiezer } from "./Themakiezer";

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
  const [themakiezerBlok, setThemakiezerBlok] = useState<string | null>(null);

  const { data: plan, isPending: planLaadt, isError: planFout } = useJaarplan(klasId);
  const { data: rooster, isPending: roosterLaadt } = useRooster(schooljaarId);
  const acties = usePlaatsingacties(klasId ?? "");
  const generatie = useGenereerJaarplan(klasId ?? "");
  const plaatsThema = usePlaatsThema(klasId ?? "");

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
                    {/* Both actions on a period are BUTTONS with words on them.

                        They were not. The heading itself was the link into the period, with a small
                        chevron after it, and the owner could not find it. A heading looks like a
                        heading, so nobody presses it: being clever about not adding a second control
                        cost the feature its entrance. */}
                    <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          className={cn(
                            "font-display text-sectie",
                            gekozenBlok === blok.start ? "text-inkt" : "text-inkt-zacht",
                          )}
                        >
                          {periode(blok.start, blok.eind)}
                        </h2>
                        {moment ? (
                          <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
                            {moment}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setThemakiezerBlok(blok.start)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-lijn-veld px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-accent hover:text-accent"
                        >
                          <IcoonPlus aria-hidden="true" className="h-4 w-4" />
                          {t("plan.voegThemaToe")}
                        </button>

                        <Link
                          to={`/plan/periode/${blok.start}`}
                          className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3 text-meta font-medium text-accent-op transition-colors duration-150 hover:bg-accent-diep"
                        >
                          {t("plan.openPeriode")}
                          <IcoonPijlRechts
                            aria-hidden="true"
                            className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                          />
                        </Link>
                      </div>
                    </header>

                    {/* An empty period is the most natural place to put a thema, so the empty state
                        IS the control rather than a sentence sitting next to one. */}
                    {plaatsingen.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setThemakiezerBlok(blok.start)}
                        className="flex w-full items-center justify-center gap-2 rounded-kaart border border-dashed border-lijn-sterk px-4 py-5 text-meta text-inkt-zwak transition-colors duration-150 hover:border-accent hover:text-accent"
                      >
                        <IcoonPlus aria-hidden="true" className="h-4 w-4" />
                        {t("plan.voegThemaToe")}
                      </button>
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

      <Themakiezer
        blokStart={themakiezerBlok}
        blokEind={blokken.find((blok) => blok.start === themakiezerBlok)?.eind ?? null}
        reedsGepland={
          new Set(
            (plan?.plaatsingen ?? [])
              .filter((plaatsing) => plaatsing.blokStart === themakiezerBlok)
              .map((plaatsing) => plaatsing.themaId),
          )
        }
        bezig={plaatsThema.isPending}
        onSluit={() => setThemakiezerBlok(null)}
        onKies={(themaId) => {
          if (!themakiezerBlok) return;
          plaatsThema.mutate(
            { themaId, blokStart: themakiezerBlok },
            { onSuccess: () => setThemakiezerBlok(null) },
          );
        }}
      />
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
