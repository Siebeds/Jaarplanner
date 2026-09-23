import { useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
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
  Doelsoort,
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
  percentage,
  sorteerDisciplines,
  telDoelsoorten,
  telStappen,
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
 * The figures of both levels, or nothing at all.
 *
 * **One object rather than two numbers per level, because the gate is what it encodes.** While a stale placement is
 * unresolved the server withholds its totals, and every count on this screen is a piece of one; a component that is
 * handed `null` cannot print a tally, where a component handed a boolean can forget to read it. The server's own
 * payload makes the same move (`aantalGedekt` is nullable), and E5-03 recorded the route around it: a client-side
 * count over the rows reconstructs exactly the withheld total. That route is closed here, once, for every figure.
 */
type Cijfers = { minimumdoelen: Stappen; leerplandoelen: Stappen } | null;

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
  const [doelsoort, setDoelsoort] = useState<Doelsoort>();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const { data, isPending, isError } = useDekking(klasId, bereik);

  // THE GATE, and the only one. While a stale placement is unresolved the server withholds every figure (admin
  // 2026-07-28), and every count on this screen is a piece of one: the tallies add up to it and the action counts
  // partition its gaps. So none of them renders then. The rows keep their own step, which is a per-goal fact.
  const metCijfers = data !== undefined && data.aantalGedekt !== null && data.isBetrouwbaar;

  const alleDoelen = useMemo(() => data?.doelen ?? [], [data]);
  /**
   * The doelsoort filter narrows the leerplandoelen everywhere on the screen, and it is the only filter that may.
   * **It changes what is measured; "Nog te doen" changes only what is listed** (E5-03), and a figure that followed
   * that one would report 0% every time a teacher asked to see her gaps. Because it moves the figures, the meter
   * names the narrowing beside them.
   */
  const doelen = useMemo(
    () => (doelsoort ? alleDoelen.filter((doel) => doel.doelsoort === doelsoort) : alleDoelen),
    [alleDoelen, doelsoort],
  );
  /** The control counts the whole scope, so choosing a soort does not empty or reshuffle the control that chose it. */
  const soorten = useMemo(() => telDoelsoorten(alleDoelen), [alleDoelen]);

  /**
   * Every figure on the screen comes from these two lists, so the parts add up to the whole by construction rather
   * than by two counters agreeing: the meter, the discipline tallies and the domein tallies are all counts over the
   * same array. The server counts that same array (`doelen.Count(...)` in `DekkingService`) and its payload is
   * deliberately unpaged, so this reproduces its totals rather than competing with them.
   */
  const cijfers = useMemo<Cijfers>(
    () => (metCijfers && data ? { minimumdoelen: telStappen(data.minimumdoelen), leerplandoelen: telStappen(doelen) } : null),
    [data, doelen, metCijfers],
  );

  const disciplines = useMemo(() => sorteerDisciplines(groepeerPerDiscipline(doelen), metCijfers), [doelen, metCijfers]);
  const leergebieden = useMemo(() => groepeerPerLeergebied(data?.minimumdoelen ?? []), [data]);
  const rijen = useMemo<readonly Lacunerij[]>(
    () => (niveau === "minimumdoelen" ? (data?.minimumdoelen ?? []) : doelen),
    [data, doelen, niveau],
  );
  const acties = useMemo(() => bepaalActies(rijen), [rijen]);

  // A doelsoort narrows leerplandoelen only, and its control lives on that level. Leaving the level therefore clears
  // it rather than parking it: a narrowing nobody can see is one nobody can undo, and it would keep moving the
  // leerplandoelen figure in the meter from a control that is no longer on the screen.
  const kiesNiveau = (gekozen: Niveau) => {
    setNiveau(gekozen);
    if (gekozen === "minimumdoelen") setDoelsoort(undefined);
  };

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
              cijfers={cijfers}
              doelsoort={doelsoort}
              exportPad={`/api/klassen/${data.klasId}/dekking/export${naarQuery({ bereik })}`}
            />

            <div className="mb-3 mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Segment
                label={t("dekking.niveau")}
                waarde={niveau}
                onKies={kiesNiveau}
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

            {niveau === "leerplandoelen" ? (
              <Doelsoortfilter soorten={soorten} actief={doelsoort} onKies={setDoelsoort} />
            ) : null}

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
                          stappen={cijfers ? groep.stappen : null}
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
                          stappen={cijfers ? groep.stappen : null}
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
function Dekkingsmeter({ cijfers, doelsoort, exportPad }: { cijfers: Cijfers; doelsoort?: Doelsoort; exportPad: string }) {
  return (
    <section className="rounded-kaart border border-lijn bg-kaart p-5 shadow-licht">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {cijfers ? (
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Meterregel soort={t("dekking.minimumdoelen")} stappen={cijfers.minimumdoelen} groot />
            {/* Narrowed to one doelsoort, this row measures something else, so it says which (E5-02: a figure that
                does not name its scope is not evidence). The minimumdoelen row above is untouched by that filter. */}
            <Meterregel
              soort={
                doelsoort
                  ? t("dekking.leerplandoelenSoort", { soort: t(`doelsoort.${doelsoort}`) })
                  : t("dekking.leerplandoelen")
              }
              stappen={cijfers.leerplandoelen}
            />
          </div>
        ) : (
          <p className="font-display text-[1.5rem] leading-none tracking-[-0.03em] text-inkt-zacht">
            {t("dekking.geenCijfer")}
          </p>
        )}
        {/* The export takes the bereik but not the doelsoort, so while one is chosen it says so: the figures in the
            file are the whole scope's, not the ones beside this button (Art. V.4). */}
        <span className="flex shrink-0 flex-col items-end gap-1">
          <a
            href={exportPad}
            className="inline-flex h-9 items-center rounded-veld border border-lijn-veld px-3 text-meta font-medium text-inkt transition-colors duration-150 hover:border-inkt"
          >
            {t("dekking.export")}
          </a>
          {doelsoort ? <span className="text-meta text-inkt-zacht">{t("dekking.exportAlleSoorten")}</span> : null}
        </span>
      </div>

      {cijfers ? (
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
      <p className="sr-only">{t("dekking.meterAria", { soort, gedekt, totaal, deel: percentage(gedekt, totaal), prognose })}</p>
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
          {t("dekking.deelGedekt", { deel: percentage(gedekt, totaal) })} ·{" "}
          {t("dekking.meterPrognose", { aantal: prognose })}
        </span>
      </div>
      <div aria-hidden="true" className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-vlak-diep">
        <span style={{ width: deel(gedekt) }} className="h-full bg-dekking-gedekt transition-[width] duration-300" />
        <span style={{ width: deel(prognose) }} className="h-full bg-dekking-gedekt/35 transition-[width] duration-300" />
      </div>
    </div>
  );
}

/**
 * Which doelsoort the leerplandoelen figures are measured over: all of them, or one.
 *
 * A radiogroup rather than a row of toggles, because it is one choice out of a fixed set and *Alle* is a real member
 * of that set: a teacher who narrowed to MD must be able to see the way back, which a pressed toggle does not offer.
 * Each option carries Op.stap's own mark and its count, so nothing here is read from colour alone (Art. XII, WCAG
 * 1.4.1). The counts are over the whole scope, not the narrowed list, and they are denominators rather than coverage:
 * they stay honest while a stale placement withholds the figures.
 *
 * Not the `Doelsoortbalk` of the Doelen screen, deliberately: its proportional stripe would be the second horizontal
 * bar on this screen, beside bars that mean dekking.
 */
function Doelsoortfilter({
  soorten,
  actief,
  onKies,
}: {
  soorten: readonly { doelsoort: Doelsoort; aantal: number }[];
  actief?: Doelsoort;
  onKies: (soort?: Doelsoort) => void;
}) {
  if (soorten.length < 2) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div role="radiogroup" aria-label={t("dekking.doelsoort")} className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          role="radio"
          aria-checked={actief === undefined}
          onClick={() => onKies(undefined)}
          className={cn(
            "flex h-8 items-center rounded-veld border px-2.5 text-meta font-medium transition-colors duration-150",
            actief === undefined ? "border-inkt-zwak bg-kaart text-inkt" : "border-lijn bg-kaart text-inkt-zacht hover:border-lijn-veld",
          )}
        >
          {t("dekking.alleSoorten")}
        </button>

        {soorten.map(({ doelsoort, aantal }) => {
          const gekozen = actief === doelsoort;
          return (
            <button
              key={doelsoort}
              type="button"
              role="radio"
              aria-checked={gekozen}
              onClick={() => onKies(doelsoort)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-veld border px-2 transition-colors duration-150",
                gekozen ? "border-inkt-zwak bg-kaart" : "border-lijn bg-kaart hover:border-lijn-veld",
              )}
            >
              <Doelsoortmerk soort={doelsoort} />
              {/* The bare number would read as an accessible name like "Minimumdoel 2" on a screen whose other
                  figures are deliberately blank; the word says which number this is. */}
              <span className="mono text-[0.6875rem] text-inkt-zacht">
                <span aria-hidden="true">{aantal}</span>
                <span className="sr-only">{telWoord(aantal, "doelen.eenDoel", "doelen.aantalDoelen")}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Only while MD is the chosen soort, and it says exactly what that choice does: these are leerplandoelen of
          the soort minimumdoel, which is not the dekking of the minimumdoelen themselves (Art. V.1, ADR-0047 D2). */}
      {actief === "Minimumdoel" ? <p className="text-meta text-inkt-zacht">{t("dekking.soortMinimumdoel")}</p> : null}
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

/**
 * A group's figures (FB-080), in the meter's own words: how many of the group are gedekt, as a fraction **and** a
 * percentage, and how many stand in the dekkingsprognose. Because every count on this screen is taken over the same
 * array, the groups add up to the meter above them.
 *
 * The bar repeats the two steps as one solid and one pale segment of the same hue rather than adding a colour
 * (Art. XII), and it carries nothing the words do not: a group is fully readable without seeing it.
 */
function Groepstelling({ stappen }: { stappen: Stappen }) {
  const { gedekt, prognose, totaal } = stappen;
  const deel = (aantal: number) => `${totaal > 0 ? (aantal / totaal) * 100 : 0}%`;

  return (
    <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
      <span className="sr-only">
        {t("dekking.groepTelling", { gedekt, totaal, deel: percentage(gedekt, totaal), prognose })}
      </span>
      <span aria-hidden="true" className="mono text-meta text-inkt-zacht">
        {gedekt}
        <span className="text-inkt-zwak">/{totaal}</span>
      </span>
      <span aria-hidden="true" className="text-meta text-inkt-zacht">
        {t("dekking.deelGedekt", { deel: percentage(gedekt, totaal) })} ·{" "}
        {t("dekking.meterPrognose", { aantal: prognose })}
      </span>
      <span aria-hidden="true" className="flex h-1.5 w-14 overflow-hidden rounded-full bg-lijn sm:w-20">
        <span style={{ width: deel(gedekt) }} className="h-full bg-dekking-gedekt" />
        <span style={{ width: deel(prognose) }} className="h-full bg-dekking-gedekt/35" />
      </span>
    </span>
  );
}

/** A domein's tally inside an opened discipline: the fraction alone, because the discipline above it says the rest. */
function Domeintelling({ stappen }: { stappen: Stappen }) {
  const { gedekt, totaal } = stappen;
  return (
    <span className="mono shrink-0 text-meta text-inkt-zacht">
      <span aria-hidden="true">
        {gedekt}
        <span className="text-inkt-zwak">/{totaal}</span>
      </span>
      <span className="sr-only">{t("dekking.domeinTelling", { gedekt, totaal })}</span>
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
          {/* Two lines on a phone, one from sm up. Measured at 390px: side by side, the figures leave a discipline
              like "Lichamelijke opvoeding en motoriek" four words on four lines, and a title that cannot shrink
              further overruns them. */}
          <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="font-display text-sectie text-inkt">{titel}</span>
            {telling}
          </span>
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
  stappen,
  zichtbaar,
}: {
  groep: Leergebiedgroep;
  open: boolean;
  onWissel: () => void;
  /** Null while the figures are withheld: a card that was handed no figures cannot print one. */
  stappen: Stappen | null;
  zichtbaar: (doel: MinimumdoelDekking) => boolean;
}) {
  return (
    <Groepkaart
      titel={groep.naam ?? t("dekking.zonderOrdening")}
      open={open}
      onWissel={onWissel}
      telling={stappen ? <Groepstelling stappen={stappen} /> : null}
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
  stappen,
  zichtbaar,
  toonFase,
}: {
  groep: Disciplinegroep;
  open: boolean;
  onWissel: () => void;
  /** Null while the figures are withheld, for the discipline and for every domein under it. */
  stappen: Stappen | null;
  zichtbaar: (doel: LeerplandoelDekking) => boolean;
  toonFase: boolean;
}) {
  return (
    <Groepkaart
      titel={groep.naam}
      open={open}
      onWissel={onWissel}
      telling={stappen ? <Groepstelling stappen={stappen} /> : null}
    >
      {groep.domeinen.map((domein) => {
        const rijen = domein.doelen.filter(zichtbaar);
        if (rijen.length === 0) return null;
        return (
          <div key={domein.naam}>
            <h3 className="flex items-center justify-between gap-3 bg-vlak px-4 py-2">
              <span className="text-meta font-medium text-inkt-zacht">{domein.naam}</span>
              {stappen ? <Domeintelling stappen={domein.stappen} /> : null}
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
  // beside "Herfst" reads as a second thema (owner ruling, 2026-09-11). An own activiteit says what it is too (ADR-0049).
  const dekkend = [
    ...doel.dekkendeThemas,
    ...doel.dekkendeFiches.map((naam) => t("dekking.alsFiche", { naam })),
    ...(doel.dekkendeActiviteiten ?? []).map((naam) => t("dekking.alsEigenActiviteit", { naam })),
  ];

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
