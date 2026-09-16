import { useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Klaskiezer } from "../../app/Klaskiezer";
import { Segment } from "../../components/ui/Segment";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Leegte } from "../../components/ui/Leegte";
import { Geenklasleegte } from "../../app/Geenklasleegte";
import { Laadlijst, Laadvlak } from "../../components/ui/Laadvlak";
import { IcoonChevron, IcoonPijlRechts } from "../../components/Iconen";
import { useDekking } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { useRechten } from "../../lib/rechten";
import { naarQuery } from "../../lib/api";
import type {
  Dekkingsbereik,
  Dekkingsstap,
  Lacuneoorzaak,
  LeerplandoelDekking,
  MinimumdoelDekking,
} from "../../lib/types";
import { t, telWoord, type Vertaalsleutel } from "../../i18n";
import { cn } from "../../lib/cn";
import {
  bepaalActies,
  groepeerPerDiscipline,
  groepeerPerLeergebied,
  sorteerDisciplines,
  type Acties,
  type Disciplinegroep,
  type Lacunerij,
  type Leergebiedgroep,
  type Stappen,
  type Themaactiesoort,
} from "./overzicht";

type Toon = "alles" | "lacunes";
type Niveau = "minimumdoelen" | "leerplandoelen";

/**
 * Proof of coverage (FR-9): which goals this class aims at and which its agenda holds, at the two levels of Art. V.2.
 *
 * **Two steps per goal** (Art. V.1, ADR-0047): the *dekkingsprognose*, what the school's thema's and subthema's aim at,
 * and the *dekking*, what the klas's agenda holds. Both are shown, because a school does not plan its whole year at
 * once; the meter carries both per level, and every row says in words which step it is in.
 *
 * **The minimumdoelen first.** They are what the onderwijsinspectie tests, and a minimumdoel counts only through a thema
 * it is a themadoel of (FB-043). The leerplandoelen are the second level, one switch away.
 *
 * Read from coarse to fine (TB-022): the figures, then what is still missing as actions, then one closed group per
 * leergebied or discipline, and the goals only inside a group the teacher opens.
 */
export function DekkingScherm() {
  const { klasId } = useActieveSelectie();
  const { mag } = useRechten();
  const [bereik, setBereik] = useState<Dekkingsbereik>("EigenJaarFase");
  const [niveau, setNiveau] = useState<Niveau>("minimumdoelen");
  const [toon, setToon] = useState<Toon>("lacunes");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const { data, isPending, isError } = useDekking(klasId, bereik);

  // THE GATE, and the only one. While a stale placement is unresolved the server withholds every figure (directie
  // 2026-07-28), and every count on this screen is a piece of one: the tallies add up to it and the action counts
  // partition its gaps. So none of them renders then. The rows keep their own step, which is a per-goal fact.
  const metCijfers = data !== undefined && data.aantalGedekt !== null && data.isBetrouwbaar;

  const disciplines = useMemo(
    () => sorteerDisciplines(groepeerPerDiscipline(data?.doelen ?? []), metCijfers),
    [data, metCijfers],
  );
  const leergebieden = useMemo(() => groepeerPerLeergebied(data?.minimumdoelen ?? []), [data]);
  const rijen = useMemo<readonly Lacunerij[]>(
    () => (niveau === "minimumdoelen" ? (data?.minimumdoelen ?? []) : (data?.doelen ?? [])),
    [data, niveau],
  );
  const acties = useMemo(() => bepaalActies(rijen), [rijen]);

  const zichtbaar = (doel: { isGedekt: boolean }) => toon === "alles" || !doel.isGedekt;
  const heeftZichtbare = rijen.some(zichtbaar);

  // One jaar/fase measured means every row carries the same code, so printing it on each is noise.
  const toonFase = (data?.gemetenJaarFasen.length ?? 0) !== 1;

  const wissel = (sleutel: string) =>
    setOpen((huidig) => {
      const nieuw = new Set(huidig);
      if (nieuw.has(sleutel)) nieuw.delete(sleutel);
      else nieuw.add(sleutel);
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
          <Geenklasleegte titel={t("dekking.geenKlas")} />
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
              minimumdoelen={
                metCijfers
                  ? {
                      gedekt: data.aantalMinimumdoelenGedekt ?? 0,
                      prognose: data.aantalMinimumdoelenInPrognose ?? 0,
                      totaal: data.aantalMinimumdoelen,
                    }
                  : null
              }
              leerplandoelen={
                metCijfers
                  ? { gedekt: data.aantalGedekt ?? 0, prognose: data.aantalInPrognose ?? 0, totaal: data.aantalLeerplandoelen }
                  : null
              }
              exportPad={`/api/klassen/${data.klasId}/dekking/export${naarQuery({ bereik })}`}
            />

            <div className="mb-3 mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Segment
                label={t("dekking.niveau")}
                waarde={niveau}
                onKies={setNiveau}
                opties={[
                  { waarde: "minimumdoelen", label: t("dekking.minimumdoelen") },
                  { waarde: "leerplandoelen", label: t("dekking.leerplandoelen") },
                ]}
              />
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

            {metCijfers ? (
              <Actielijst
                acties={acties}
                niveau={niveau}
                magPlannen={mag.klasplanningBewerken(klasId)}
                magBeoordelen={mag.doelsuggestiesBeoordelen}
              />
            ) : null}

            <div className="mt-4">
              {!heeftZichtbare ? (
                <Leegte titel={leegtezin(niveau, toon)} />
              ) : niveau === "minimumdoelen" ? (
                <ul className="flex flex-col gap-2">
                  {leergebieden.map((groep) => {
                    const sleutel = `md:${groep.naam ?? ""}`;
                    return groep.doelen.some(zichtbaar) ? (
                      <li key={sleutel}>
                        <Leergebiedkaart
                          groep={groep}
                          open={open.has(sleutel)}
                          onWissel={() => wissel(sleutel)}
                          metCijfers={metCijfers}
                          zichtbaar={zichtbaar}
                        />
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : (
                <ul className="flex flex-col gap-2">
                  {disciplines.map((groep) =>
                    groep.domeinen.some((domein) => domein.doelen.some(zichtbaar)) ? (
                      <li key={groep.nummer}>
                        <Disciplinegroepkaart
                          groep={groep}
                          open={open.has(`lp:${groep.nummer}`)}
                          onWissel={() => wissel(`lp:${groep.nummer}`)}
                          metCijfers={metCijfers}
                          zichtbaar={zichtbaar}
                          toonFase={toonFase}
                        />
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
            </div>
          </>
        )}
      </Schermvlak>
    </>
  );
}

function leegtezin(niveau: Niveau, toon: Toon): string {
  if (niveau === "minimumdoelen") {
    return toon === "lacunes" ? t("dekking.geenMinimumdoelLacunes") : t("dekking.geenMinimumdoelen");
  }
  return toon === "lacunes" ? t("dekking.geenLacunes") : t("dekking.geenDoelen");
}

/**
 * The figures, one line per level: what is gedekt and what is in the prognose, of how many. The bar shows the two as
 * one solid and one pale segment of the same hue, not a new colour (Art. XII), and the words beside it carry the
 * numbers, so the bar is never the only way to read them.
 */
function Dekkingsmeter({
  minimumdoelen,
  leerplandoelen,
  exportPad,
}: {
  minimumdoelen: Stappen | null;
  leerplandoelen: Stappen | null;
  exportPad: string;
}) {
  return (
    <section className="rounded-kaart border border-lijn bg-kaart p-5 shadow-licht">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {minimumdoelen && leerplandoelen ? (
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Meterregel soort={t("dekking.minimumdoelen")} stappen={minimumdoelen} groot />
            <Meterregel soort={t("dekking.leerplandoelen")} stappen={leerplandoelen} />
          </div>
        ) : (
          <p className="font-display text-[1.5rem] leading-none tracking-[-0.03em] text-inkt-zacht">
            {t("dekking.geenCijfer")}
          </p>
        )}
        <a
          href={exportPad}
          className="inline-flex h-9 items-center rounded-veld border border-lijn-veld px-3 text-meta font-medium text-inkt transition-colors duration-150 hover:border-inkt"
        >
          {t("dekking.export")}
        </a>
      </div>

      {minimumdoelen && leerplandoelen ? (
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-inkt-zacht">
          <span className="flex items-center gap-1.5">
            <Stapmerk stap="Gedekt" />
            {t("dekking.stapGedekt")}
          </span>
          <span className="flex items-center gap-1.5">
            <Stapmerk stap="Prognose" />
            {t("dekking.stapPrognose")}
          </span>
          <span className="flex items-center gap-1.5">
            <Stapmerk stap="Geen" />
            {t("dekking.stapGeen")}
          </span>
        </p>
      ) : null}
    </section>
  );
}

function Meterregel({ soort, stappen, groot = false }: { soort: string; stappen: Stappen; groot?: boolean }) {
  const { gedekt, prognose, totaal } = stappen;
  const deel = (aantal: number) => `${totaal > 0 ? (aantal / totaal) * 100 : 0}%`;

  return (
    <div>
      <p className="sr-only">{t("dekking.meterAria", { soort, gedekt, prognose, totaal })}</p>
      <div aria-hidden="true" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-meta font-medium uppercase tracking-wide text-inkt-zacht">{soort}</span>
        <span
          className={cn(
            "mono font-display leading-none tracking-[-0.04em] text-inkt",
            groot ? "text-[2.25rem]" : "text-[1.5rem]",
          )}
        >
          {gedekt}
          <span className="text-inkt-zwak">/{totaal}</span>
        </span>
        <span className="text-meta text-inkt-zacht">
          {t("dekking.meterGedekt", { aantal: gedekt })} · {t("dekking.meterPrognose", { aantal: prognose })}
        </span>
      </div>
      <div aria-hidden="true" className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-vlak-diep">
        <span style={{ width: deel(gedekt) }} className="h-full bg-dekking-gedekt transition-[width] duration-300" />
        <span style={{ width: deel(prognose) }} className="h-full bg-dekking-gedekt/35 transition-[width] duration-300" />
      </div>
    </div>
  );
}

const ACTIEZIN: Record<Themaactiesoort, Vertaalsleutel> = {
  WachtOpBeslissing: "dekking.actieVoorstel",
  PlaatsingGeweigerd: "dekking.actieWeigering",
  NietIngepland: "dekking.actieInplannen",
};

/**
 * Where an action is done: a thema's placement on the periodes, a subthema's in the agenda. A leerplandoel that is not
 * in the agenda yet usually waits on a subthema, so its action opens the agenda; a minimumdoel only ever waits on a
 * thema.
 */
function actiepad(soort: Themaactiesoort, niveau: Niveau): string {
  return soort === "NietIngepland" && niveau === "leerplandoelen" ? "/agenda" : "/agenda/periodes";
}

/**
 * What would close the most gaps, the largest first (TB-022). Sits under the level switch because its lines are about
 * the level shown.
 */
function Actielijst({
  acties,
  niveau,
  magPlannen,
  magBeoordelen,
}: {
  acties: Acties;
  niveau: Niveau;
  magPlannen: boolean;
  magBeoordelen: boolean;
}) {
  const kopId = useId();
  const heeftThemaacties = acties.themaacties.length > 0;
  const heeftSlot = acties.aantalOverig > 0 || acties.aantalOnbeslist > 0 || acties.aantalZonderThema > 0;
  if (!heeftThemaacties && !heeftSlot) return null;

  return (
    <section aria-labelledby={kopId} className="rounded-kaart border border-lijn bg-kaart shadow-licht">
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
                      to={actiepad(actie.soort, niveau)}
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
            <p>
              {niveau === "minimumdoelen"
                ? telWoord(acties.aantalZonderThema, "dekking.zonderThemaMinimumdoelEen", "dekking.zonderThemaMinimumdoel")
                : telWoord(acties.aantalZonderThema, "dekking.zonderThemaEen", "dekking.zonderThema")}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="pb-2" />
      )}
    </section>
  );
}

/** A group's tally: how many are gedekt, and a thin bar of that share. */
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

/** A closed group with a heading button; the content only while open. */
function Groepkaart({
  titel,
  open,
  onWissel,
  telling,
  children,
}: {
  titel: string;
  open: boolean;
  onWissel: () => void;
  telling: ReactNode;
  children: ReactNode;
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
          <span className="min-w-0 flex-1 font-display text-sectie text-inkt">{titel}</span>
          {telling}
        </button>
      </h2>

      {open ? (
        <div id={inhoudId} className="border-t border-lijn">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** One leergebied of the decree with its minimumdoelen. Its tally counts the whole group whatever the view shows. */
function Leergebiedkaart({
  groep,
  open,
  onWissel,
  metCijfers,
  zichtbaar,
}: {
  groep: Leergebiedgroep;
  open: boolean;
  onWissel: () => void;
  metCijfers: boolean;
  zichtbaar: (doel: MinimumdoelDekking) => boolean;
}) {
  return (
    <Groepkaart
      titel={groep.naam ?? t("dekking.zonderOrdening")}
      open={open}
      onWissel={onWissel}
      telling={metCijfers ? <Telling gedekt={groep.gedekt} totaal={groep.totaal} balk /> : null}
    >
      <ul className="divide-y divide-lijn">
        {groep.doelen.filter(zichtbaar).map((doel) => (
          <li key={doel.ref}>
            <Minimumdoelrij doel={doel} />
          </li>
        ))}
      </ul>
    </Groepkaart>
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
  return (
    <Groepkaart
      titel={groep.naam}
      open={open}
      onWissel={onWissel}
      telling={metCijfers ? <Telling gedekt={groep.gedekt} totaal={groep.totaal} balk /> : null}
    >
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
    </Groepkaart>
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
function oorzaakzin(doel: Lacunerij, geenThemaZin: Vertaalsleutel): string | null {
  if (doel.isGedekt || doel.oorzaak === null) return null;
  const sleutel = (doel.oorzaak === "GeenThema" ? geenThemaZin : OORZAAKZIN[doel.oorzaak]) as Vertaalsleutel | undefined;
  if (!sleutel) return null;
  if (doel.oorzaak !== "GeenThema" && doel.kandidaatThemas.length === 0) return null;
  return t(sleutel, { themas: doel.kandidaatThemas.join(", ") });
}

const STAPWOORD: Record<Dekkingsstap, Vertaalsleutel> = {
  Gedekt: "dekking.stapGedekt",
  Prognose: "dekking.stapPrognose",
  Geen: "dekking.stapGeen",
};

/**
 * A goal's step as a shape, not as a colour alone: filled for gedekt, half-filled for the prognose, hollow for nowhere.
 * The word travels to assistive technology; the row's line says it in full.
 */
function Stapmerk({ stap, metWoord = false }: { stap: Dekkingsstap; metWoord?: boolean }) {
  return (
    <span
      className={cn(
        "block h-4 w-4 shrink-0 rounded-full border-2",
        stap === "Gedekt" && "border-dekking-gedekt bg-dekking-gedekt",
        stap === "Prognose" && "border-dekking-gedekt",
        stap === "Geen" && "border-dekking-niet-gedekt bg-transparent",
      )}
      style={
        stap === "Prognose"
          ? { background: "linear-gradient(90deg, var(--color-dekking-gedekt) 50%, transparent 50%)" }
          : undefined
      }
    >
      {metWoord ? <span className="sr-only">{t(STAPWOORD[stap])}</span> : null}
    </span>
  );
}

/** A minimumdoel: its ref in the minimumdoel hue, the decreed text, and what carries or would carry it. */
function Minimumdoelrij({ doel }: { doel: MinimumdoelDekking }) {
  const reden = oorzaakzin(doel, "dekking.oorzaakMinimumdoelGeenThema");

  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono inline-block rounded bg-doelsoort-md px-1.5 py-0.5 text-[0.6875rem] font-medium text-doelsoort-md-op">
            {doel.ref}
          </span>
          {doel.nietMeerInOpstap ? (
            <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
              {t("doel.vervallen")}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-3 whitespace-pre-line text-body text-inkt">{doel.omschrijving}</p>
        <Staplijn
          stap={doel.stap}
          dekkend={doel.dekkendeThemas}
          prognose={doel.prognoseThemas}
          reden={reden}
          nietIngepland={doel.oorzaak === "NietIngepland"}
        />
      </div>
      <span className="mt-1">
        <Stapmerk stap={doel.stap} metWoord />
      </span>
    </div>
  );
}

/**
 * The line under a goal that says its step in words: what covers it, or what aims at it and why that is not enough
 * yet, or why nothing does.
 */
function Staplijn({
  stap,
  dekkend,
  prognose,
  reden,
  nietIngepland,
}: {
  stap: Dekkingsstap;
  dekkend: string[];
  prognose: string[];
  reden: string | null;
  nietIngepland: boolean;
}) {
  if (stap === "Gedekt" && dekkend.length > 0) {
    return <p className="mt-1 text-meta text-inkt-zacht">{t("dekking.gedektDoor", { bronnen: dekkend.join(", ") })}</p>;
  }
  if (stap === "Prognose" && prognose.length > 0) {
    // "Not in the agenda yet" is what the prognose step means, and its names are these; a proposal or a refusal on
    // the kalender is news, so that reason is added.
    return (
      <p className="mt-1 text-meta text-inkt-zacht">
        {t("dekking.prognoseVia", { bronnen: prognose.join(", ") })}
        {reden && !nietIngepland ? <span className="block">{reden}</span> : null}
      </p>
    );
  }
  return reden ? <p className="mt-1 text-meta text-inkt-zacht">{reden}</p> : null;
}

function Dekkingsrij({ doel, toonFase }: { doel: LeerplandoelDekking; toonFase: boolean }) {
  const reden = oorzaakzin(doel, "dekking.oorzaakGeenThema");
  // The evidence: the thema's and subthema's first, then each covering fiche marked as one, because a bare "Turnen"
  // beside "Herfst" reads as a second thema (owner ruling, 2026-09-11).
  const dekkend = [...doel.dekkendeThemas, ...doel.dekkendeFiches.map((naam) => t("dekking.alsFiche", { naam }))];

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
        <Staplijn
          stap={doel.stap}
          dekkend={dekkend}
          prognose={doel.prognoseBronnen}
          reden={reden}
          nietIngepland={doel.oorzaak === "NietIngepland"}
        />
      </div>

      <span className="mt-1">
        <Stapmerk stap={doel.stap} metWoord />
      </span>
    </div>
  );
}
