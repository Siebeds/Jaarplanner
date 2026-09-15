import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Klaskiezer } from "../../app/Klaskiezer";
import { Segment } from "../../components/ui/Segment";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Leegte } from "../../components/ui/Leegte";
import { Laadlijst, Laadvlak } from "../../components/ui/Laadvlak";
import { IcoonChevron, IcoonPijlRechts } from "../../components/Iconen";
import { useDekking } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { useRechten } from "../../lib/rechten";
import { naarQuery } from "../../lib/api";
import type { Dekkingsbereik, Lacuneoorzaak, LeerplandoelDekking } from "../../lib/types";
import { t, telWoord, type Vertaalsleutel } from "../../i18n";
import { cn } from "../../lib/cn";
import {
  bepaalActies,
  groepeerPerDiscipline,
  sorteerDisciplines,
  type Acties,
  type Disciplinegroep,
  type Themaactiesoort,
} from "./overzicht";

type Toon = "alles" | "lacunes";

/**
 * Proof of coverage (FR-9): which leerplandoelen this class's plan teaches, and which it does not.
 *
 * Read from coarse to fine (TB-022): the one figure, then what is still missing as actions per thema, then one closed
 * row per discipline with the least covered first, and the goals only inside a discipline the teacher opens. The list
 * used to be every goal of the jaar/fase at once, which answered "what is missing" with several hundred rows and "where
 * do I start" not at all.
 */
export function DekkingScherm() {
  const { klasId } = useActieveSelectie();
  const { mag } = useRechten();
  const [bereik, setBereik] = useState<Dekkingsbereik>("EigenJaarFase");
  const [toon, setToon] = useState<Toon>("lacunes");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const { data, isPending, isError } = useDekking(klasId, bereik);

  // THE GATE, and the only one: the meter below reads it too rather than deciding again. While a stale placement is
  // unresolved the server withholds the total (directie 2026-07-28), and every count on this screen is a piece of it:
  // the tallies add up to it and the action counts partition its gaps. So none of them renders then, not merely the
  // headline. The rows keep their own verdict and reason, which is a per-goal fact and not a figure (E5-02, E5-05).
  const metCijfers = data !== undefined && data.aantalGedekt !== null && data.isBetrouwbaar && data.aantalLeerplandoelen > 0;

  const disciplines = useMemo(
    () => sorteerDisciplines(groepeerPerDiscipline(data?.doelen ?? []), metCijfers),
    [data, metCijfers],
  );
  const acties = useMemo(() => bepaalActies(data?.doelen ?? []), [data]);

  const zichtbaar = (doel: LeerplandoelDekking) => toon === "alles" || !doel.isGedekt;
  const heeftZichtbare = (data?.doelen ?? []).some(zichtbaar);

  // One jaar/fase measured means every row carries the same code, so printing it on each is noise.
  const toonFase = (data?.gemetenJaarFasen.length ?? 0) !== 1;

  const wissel = (nummer: string) =>
    setOpen((huidig) => {
      const nieuw = new Set(huidig);
      if (nieuw.has(nummer)) nieuw.delete(nummer);
      else nieuw.add(nummer);
      return nieuw;
    });

  return (
    <>
      <Schermkop
        titel={t("dekking.titel")}
        rechts={<Klaskiezer />}
        onder={
          <Segment
            label={t("dekking.bereik")}
            waarde={bereik}
            onKies={setBereik}
            className="w-full sm:w-auto"
            opties={[
              { waarde: "EigenJaarFase", label: t("dekking.eigenJaarFase") },
              { waarde: "HeelCurriculum", label: t("dekking.heelCurriculum") },
            ]}
          />
        }
      />

      <Schermvlak>
        {!klasId ? (
          <Leegte titel={t("dekking.geenKlas")} />
        ) : isError ? (
          <Leegte titel={t("dekking.fout")} />
        ) : isPending || !data ? (
          <div className="flex flex-col gap-5">
            <Laadvlak className="h-28" />
            <Laadlijst rijen={5} />
          </div>
        ) : (
          <>
            <Dekkingsmeter
              gedekt={metCijfers ? data.aantalGedekt : null}
              totaal={data.aantalLeerplandoelen}
              exportPad={`/api/klassen/${data.klasId}/dekking/export${naarQuery({ bereik })}`}
            />

            {metCijfers ? (
              <Actielijst acties={acties} magPlannen={mag.klasplanningBewerken(klasId)} magBeoordelen={mag.doelsuggestiesBeoordelen} />
            ) : null}

            <div className="mb-3 mt-6">
              <Segment
                label={t("dekking.toon")}
                waarde={toon}
                onKies={setToon}
                opties={[
                  { waarde: "lacunes", label: t("dekking.nogTeDoen") },
                  { waarde: "alles", label: t("dekking.alleDoelen") },
                ]}
              />
            </div>

            {!heeftZichtbare ? (
              <Leegte titel={toon === "lacunes" ? t("dekking.geenLacunes") : t("dekking.geenDoelen")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {disciplines.map((groep) =>
                  groep.domeinen.some((domein) => domein.doelen.some(zichtbaar)) ? (
                    <li key={groep.nummer}>
                      <Disciplinegroepkaart
                        groep={groep}
                        open={open.has(groep.nummer)}
                        onWissel={() => wissel(groep.nummer)}
                        metCijfers={metCijfers}
                        zichtbaar={zichtbaar}
                        toonFase={toonFase}
                      />
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </>
        )}
      </Schermvlak>
    </>
  );
}

/**
 * The one figure the whole screen exists to produce.
 *
 * `gedekt` is null whenever the screen's gate says the figure may not be shown, and then the fraction is not rendered
 * at all rather than shown with a caveat beside it, because a number on screen is read as a number no matter what is
 * written next to it.
 */
function Dekkingsmeter({ gedekt, totaal, exportPad }: { gedekt: number | null; totaal: number; exportPad: string }) {
  return (
    <section className="rounded-kaart border border-lijn bg-kaart p-5 shadow-licht">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {gedekt !== null ? (
            <p className="font-display text-[2.5rem] leading-none tracking-[-0.04em] text-inkt">
              <span className="mono">{gedekt}</span>
              <span className="text-inkt-zwak">/</span>
              <span className="mono text-inkt-zwak">{totaal}</span>
            </p>
          ) : (
            <p className="font-display text-[1.5rem] leading-none tracking-[-0.03em] text-inkt-zacht">
              {t("dekking.geenCijfer")}
            </p>
          )}
          <p className="mt-2 text-meta text-inkt-zacht">{t("dekking.gedekteDoelen")}</p>
        </div>

        <a
          href={exportPad}
          className="inline-flex h-9 items-center rounded-veld border border-lijn-veld px-3 text-meta font-medium text-inkt transition-colors duration-150 hover:border-inkt"
        >
          {t("dekking.export")}
        </a>
      </div>

      {gedekt !== null ? (
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-vlak-diep">
          <span
            aria-hidden="true"
            style={{ width: `${Math.round((gedekt / totaal) * 100)}%` }}
            className="h-full rounded-full bg-dekking-gedekt transition-[width] duration-300"
          />
        </div>
      ) : null}
    </section>
  );
}

const ACTIEZIN: Record<Themaactiesoort, Vertaalsleutel> = {
  WachtOpBeslissing: "dekking.actieVoorstel",
  PlaatsingGeweigerd: "dekking.actieWeigering",
  NietIngepland: "dekking.actieInplannen",
};

/**
 * What is still missing, as actions per thema, the largest first (TB-022).
 *
 * The heading says only what every reader may be told, since anyone may read any klas's dekking (I9). The sentence is
 * the link, so each one says where it goes in its own words, and it is a link only for whoever may change this class's
 * plan: for anyone else it would open a kalender that refuses them (the E3-06 rule). The two closing lines are not
 * thema actions, so they carry no "+N": one is decided on Thema's, and one no thema action closes.
 */
function Actielijst({ acties, magPlannen, magBeoordelen }: { acties: Acties; magPlannen: boolean; magBeoordelen: boolean }) {
  const kopId = useId();
  const heeftThemaacties = acties.themaacties.length > 0;
  const heeftSlot = acties.aantalOverig > 0 || acties.aantalOnbeslist > 0 || acties.aantalZonderThema > 0;

  if (!heeftThemaacties && !heeftSlot) return null;

  return (
    <section aria-labelledby={kopId} className="mt-4 rounded-kaart border border-lijn bg-kaart shadow-licht">
      <h2 id={kopId} className="px-4 pb-1 pt-4 font-display text-sectie text-inkt">
        {t("dekking.acties")}
      </h2>

      {heeftThemaacties ? (
        <ul className="divide-y divide-lijn px-4">
          {acties.themaacties.map((actie) => {
            const zin = t(ACTIEZIN[actie.soort], { thema: actie.thema });
            return (
              <li key={`${actie.soort}:${actie.thema}`} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  {magPlannen ? (
                    <Link
                      to="/agenda/periodes"
                      className="group inline-flex min-h-6 items-center gap-1 text-body font-medium text-inkt underline-offset-4 hover:underline"
                    >
                      {zin}
                      <IcoonPijlRechts
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-inkt-zwak transition-transform duration-150 group-hover:translate-x-0.5"
                      />
                    </Link>
                  ) : (
                    <span className="text-body text-inkt">{zin}</span>
                  )}
                </span>
                <span className="mono shrink-0 text-meta text-inkt-zacht">
                  {telWoord(actie.aantal, "dekking.winstEen", "dekking.winst")}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {heeftSlot ? (
        <div className={cn("flex flex-col gap-1.5 px-4 pb-4 text-meta text-inkt-zacht", heeftThemaacties ? "border-t border-lijn pt-3" : "pt-2")}>
          {acties.aantalOverig > 0 ? <p>{telWoord(acties.aantalOverig, "dekking.actiesOverigEen", "dekking.actiesOverig")}</p> : null}
          {acties.aantalOnbeslist > 0 ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{telWoord(acties.aantalOnbeslist, "dekking.onbeslistEen", "dekking.onbeslist")}</span>
              {magBeoordelen ? (
                <Link to="/themas" className="inline-flex min-h-6 items-center font-medium text-inkt underline underline-offset-4">
                  {t("dekking.naarThemas")}
                </Link>
              ) : null}
            </p>
          ) : null}
          {acties.aantalZonderThema > 0 ? (
            <p>{telWoord(acties.aantalZonderThema, "dekking.zonderThemaEen", "dekking.zonderThema")}</p>
          ) : null}
        </div>
      ) : (
        <div className="pb-2" />
      )}
    </section>
  );
}

/** "8/96" for the eye and "8 van 96 gedekt" for a screen reader, which reads a slash as nothing useful. */
function Telling({ gedekt, totaal, balk = false }: { gedekt: number; totaal: number; balk?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-3">
      <span className="mono text-meta text-inkt-zacht">
        <span aria-hidden="true">
          {gedekt}
          <span className="text-inkt-zwak">/{totaal}</span>
        </span>
        <span className="sr-only">{t("dekking.groepTelling", { gedekt, totaal })}</span>
      </span>
      {balk ? (
        <span aria-hidden="true" className="block h-1.5 w-14 overflow-hidden rounded-full bg-lijn sm:w-20">
          <span
            style={{ width: `${totaal > 0 ? Math.round((gedekt / totaal) * 100) : 0}%` }}
            className="block h-full rounded-full bg-dekking-gedekt"
          />
        </span>
      ) : null}
    </span>
  );
}

/**
 * One discipline, closed until the teacher opens it. Its tally counts the whole discipline whatever the view shows, so
 * switching to "Nog te doen" hides covered rows without turning 8/96 into 0/88.
 */
function Disciplinegroepkaart({
  groep,
  open,
  onWissel,
  metCijfers,
  zichtbaar,
  toonFase,
}: {
  groep: Disciplinegroep;
  open: boolean;
  onWissel: () => void;
  metCijfers: boolean;
  zichtbaar: (doel: LeerplandoelDekking) => boolean;
  toonFase: boolean;
}) {
  const inhoudId = useId();

  return (
    <section className="overflow-hidden rounded-kaart border border-lijn bg-kaart shadow-licht">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? inhoudId : undefined}
          onClick={onWissel}
          className="flex min-h-raak w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-vlak"
        >
          <IcoonChevron
            aria-hidden="true"
            className={cn("h-4 w-4 shrink-0 text-inkt-zwak transition-transform duration-150", open ? "" : "-rotate-90")}
          />
          <span className="min-w-0 flex-1 font-display text-sectie text-inkt">{groep.naam}</span>
          {metCijfers ? <Telling gedekt={groep.gedekt} totaal={groep.totaal} balk /> : null}
        </button>
      </h2>

      {open ? (
        <div id={inhoudId} className="border-t border-lijn">
          {groep.domeinen.map((domein) => {
            const rijen = domein.doelen.filter(zichtbaar);
            if (rijen.length === 0) return null;
            return (
              <div key={domein.naam}>
                <h3 className="flex items-center justify-between gap-3 bg-vlak px-4 py-2">
                  <span className="text-meta font-medium text-inkt-zacht">{domein.naam}</span>
                  {metCijfers ? <Telling gedekt={domein.gedekt} totaal={domein.totaal} /> : null}
                </h3>
                <ul className="divide-y divide-lijn">
                  {rijen.map((doel) => (
                    <li key={doel.code}>
                      <Dekkingsrij doel={doel} toonFase={toonFase} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

const OORZAAKZIN: Record<Lacuneoorzaak, Vertaalsleutel> = {
  WachtOpBeslissing: "dekking.oorzaakVoorstel",
  PlaatsingGeweigerd: "dekking.oorzaakWeigering",
  NietIngepland: "dekking.oorzaakNietIngepland",
  KoppelingNietBeslist: "dekking.oorzaakOnbeslist",
  GeenThema: "dekking.oorzaakGeenThema",
};

/**
 * Why a missing goal is missing, in one line. Nothing for a cause this client does not know, and nothing for a cause
 * that names thema's when none came with it: a sentence ending in a colon is worse than no sentence.
 */
function oorzaakzin(doel: LeerplandoelDekking): string | null {
  if (doel.isGedekt || doel.oorzaak === null) return null;
  const sleutel = OORZAAKZIN[doel.oorzaak] as Vertaalsleutel | undefined;
  if (!sleutel) return null;
  if (doel.oorzaak !== "GeenThema" && doel.kandidaatThemas.length === 0) return null;
  return t(sleutel, { themas: doel.kandidaatThemas.join(", ") });
}

function Dekkingsrij({ doel, toonFase }: { doel: LeerplandoelDekking; toonFase: boolean }) {
  const reden = oorzaakzin(doel);

  return (
    <div className="flex gap-3 px-4 py-3">
      <Doelsoortmerk soort={doel.doelsoort} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="mono truncate text-[0.6875rem] font-medium text-inkt-zacht">{doel.code}</span>
          {toonFase ? (
            <span className="mono shrink-0 rounded border border-lijn px-1 text-[0.625rem] text-inkt-zwak">{doel.jaarFase}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-body text-inkt">{doel.tekst}</p>
        {/* The evidence: the thema's first, then each covering fiche marked as one, because a bare
            "Turnen" beside "Herfst" reads as a second thema (owner ruling, 2026-09-11). */}
        {doel.dekkendeThemas.length > 0 || doel.dekkendeFiches.length > 0 ? (
          <p className="mt-1 text-meta text-inkt-zacht">
            {[...doel.dekkendeThemas, ...doel.dekkendeFiches.map((naam) => t("dekking.alsFiche", { naam }))].join(", ")}
          </p>
        ) : reden ? (
          <p className="mt-1 text-meta text-inkt-zacht">{reden}</p>
        ) : null}
      </div>

      {/* Filled versus hollow, not green versus red: the shape carries the state as well as the
          colour does, and the word travels to assistive technology. */}
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          doel.isGedekt ? "border-dekking-gedekt bg-dekking-gedekt" : "border-dekking-niet-gedekt bg-transparent",
        )}
      >
        <span className="sr-only">{doel.isGedekt ? t("dekking.gedekt") : t("dekking.nietGedekt")}</span>
      </span>
    </div>
  );
}
