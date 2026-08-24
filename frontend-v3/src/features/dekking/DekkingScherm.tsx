import { useMemo, useState } from "react";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Klaskiezer } from "../../app/Klaskiezer";
import { Segment } from "../../components/ui/Segment";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Leegte } from "../../components/ui/Leegte";
import { Laadlijst, Laadvlak } from "../../components/ui/Laadvlak";
import { useDekking } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { naarQuery } from "../../lib/api";
import type { Dekkingsbereik, LeerplandoelDekking } from "../../lib/types";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";

type Toon = "alles" | "lacunes";

/**
 * Proof of coverage (FR-9): which leerplandoelen this class's plan teaches, and which it does not.
 *
 * The gap is the point of the screen, so the number that dominates is the fraction and the list can
 * be narrowed to the goals that are NOT covered. A teacher does not come here to admire what is
 * already done; they come to find what is missing before the inspection does.
 */
export function DekkingScherm() {
  const { klasId } = useActieveSelectie();
  const [bereik, setBereik] = useState<Dekkingsbereik>("EigenJaarFase");
  const [toon, setToon] = useState<Toon>("alles");

  const { data, isPending, isError } = useDekking(klasId, bereik);

  const zichtbaar = useMemo(
    () => (data?.doelen ?? []).filter((doel) => (toon === "lacunes" ? !doel.isGedekt : true)),
    [data, toon],
  );

  const groepen = useMemo(() => groepeerPerDomein(zichtbaar), [zichtbaar]);

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
              gedekt={data.aantalGedekt}
              totaal={data.aantalLeerplandoelen}
              betrouwbaar={data.isBetrouwbaar}
              exportPad={`/api/klassen/${data.klasId}/dekking/export${naarQuery({ bereik })}`}
            />

            <div className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-3">
              <Segment
                label={t("dekking.toon")}
                waarde={toon}
                onKies={setToon}
                opties={[
                  { waarde: "alles", label: t("dekking.alleDoelen") },
                  { waarde: "lacunes", label: t("dekking.enkelLacunes") },
                ]}
              />
              <p aria-live="polite" className="mono text-meta text-inkt-zwak">
                {telWoord(zichtbaar.length, "dekking.eenGetoond", "dekking.aantalGetoond")}
              </p>
            </div>

            {zichtbaar.length === 0 ? (
              <Leegte titel={toon === "lacunes" ? t("dekking.geenLacunes") : t("dekking.geenDoelen")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {groepen.map(([domein, doelen]) => (
                  <li key={domein} className="overflow-hidden rounded-kaart border border-lijn bg-kaart shadow-licht">
                    <h2 className="flex items-center justify-between gap-3 border-b border-lijn px-4 py-3">
                      <span className="font-display text-sectie text-inkt">{domein}</span>
                      <span className="mono text-meta text-inkt-zwak">
                        {doelen.filter((d) => d.isGedekt).length}/{doelen.length}
                      </span>
                    </h2>
                    <ul className="divide-y divide-lijn">
                      {doelen.map((doel) => (
                        <li key={doel.code}>
                          <Dekkingsrij doel={doel} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
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
 * `aantalGedekt` is nullable on purpose: the server returns null when it cannot stand behind the
 * number. In that case the fraction is not rendered at all rather than shown with a caveat beside
 * it, because a number on screen is read as a number no matter what is written next to it.
 */
function Dekkingsmeter({
  gedekt,
  totaal,
  betrouwbaar,
  exportPad,
}: {
  gedekt: number | null;
  totaal: number;
  betrouwbaar: boolean;
  exportPad: string;
}) {
  const meetbaar = gedekt !== null && betrouwbaar && totaal > 0;
  const deel = meetbaar ? gedekt / totaal : 0;

  return (
    <section className="rounded-kaart border border-lijn bg-kaart p-5 shadow-licht">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {meetbaar ? (
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
          className="inline-flex h-9 items-center rounded-full border border-lijn-veld px-3 text-meta font-medium text-inkt transition-colors duration-150 hover:border-inkt"
        >
          {t("dekking.export")}
        </a>
      </div>

      {meetbaar ? (
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-vlak-diep">
          <span
            aria-hidden="true"
            style={{ width: `${Math.round(deel * 100)}%` }}
            className="h-full rounded-full bg-dekking-gedekt transition-[width] duration-300"
          />
        </div>
      ) : null}
    </section>
  );
}

function Dekkingsrij({ doel }: { doel: LeerplandoelDekking }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <Doelsoortmerk soort={doel.doelsoort} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="mono truncate text-[0.6875rem] font-medium text-inkt-zacht">{doel.code}</span>
          <span className="mono shrink-0 rounded border border-lijn px-1 text-[0.625rem] text-inkt-zwak">
            {doel.jaarFase}
          </span>
        </div>
        <p className="mt-0.5 text-body text-inkt">{doel.tekst}</p>
        {doel.dekkendeThemas.length > 0 ? (
          <p className="mt-1 text-meta text-inkt-zacht">{doel.dekkendeThemas.join(", ")}</p>
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

/** Groups in the order the backend already sorted them in. */
function groepeerPerDomein(doelen: LeerplandoelDekking[]): [string, LeerplandoelDekking[]][] {
  const groepen = new Map<string, LeerplandoelDekking[]>();
  for (const doel of doelen) {
    const bestaand = groepen.get(doel.domein);
    if (bestaand) bestaand.push(doel);
    else groepen.set(doel.domein, [doel]);
  }
  return [...groepen.entries()];
}
