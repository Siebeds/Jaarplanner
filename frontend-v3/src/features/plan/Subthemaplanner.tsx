import { useMemo, useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Segment } from "../../components/ui/Segment";
import { Veld, Keuze, Invoer } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { useThemasVoorKlas } from "../../lib/queries";
import type { Dagweergave } from "../../lib/types";
import { dagMaand } from "../../lib/datum";
import { t, telWoord } from "../../i18n";

type Verdeling = "achterElkaar" | "verspreid";

interface Voorstel {
  activiteitId: string;
  activiteitNaam: string;
  datum: string;
}

/**
 * A whole subthema onto the calendar in one go.
 *
 * Placing activiteiten one day at a time is the obvious way to build this and the wrong one: a
 * subthema is planned as a unit, so the unit is what the teacher should be able to move onto the
 * week.
 *
 * There is no bulk endpoint on the server and this deliberately does not ask for one. It issues the
 * same POST per activiteit that a single placement issues, one after the other, and reports what
 * actually happened. That keeps the server contract untouched, and it means a partial result is a
 * partial result: whatever landed stays landed, and the rows that failed are named with the reason
 * the server gave.
 */
export function Subthemaplanner({
  open,
  klasId,
  themaIds,
  dagen,
  bezig,
  resultaat,
  onPlan,
  onSluit,
}: {
  open: boolean;
  klasId: string | null;
  themaIds: string[];
  dagen: Dagweergave[];
  bezig: boolean;
  resultaat: { gelukt: number; totaal: number; fouten: string[] } | null;
  onPlan: (voorstellen: Voorstel[]) => void;
  onSluit: () => void;
}) {
  const { themas, laadt } = useThemasVoorKlas(themaIds, klasId);
  const [subthemaId, setSubthemaId] = useState("");
  const [verdeling, setVerdeling] = useState<Verdeling>("achterElkaar");
  const [startdag, setStartdag] = useState("");

  // Only teaching days can carry an activiteit; the server refuses a closed one. Vakanties are
  // therefore skipped rather than counted, which is what makes "achter elkaar" mean five school
  // days instead of five calendar days across a holiday.
  const lesdagen = useMemo(() => dagen.filter((dag) => dag.isLesdag).map((dag) => dag.datum), [dagen]);

  const subthemas = useMemo(
    () =>
      themas.flatMap((thema) =>
        thema.subthemas
          .filter((sub) => sub.activiteiten.length > 0)
          .map((sub) => ({ ...sub, themaNaam: thema.naam })),
      ),
    [themas],
  );

  const gekozen = subthemas.find((sub) => sub.id === subthemaId) ?? null;
  const eersteDag = startdag || lesdagen[0] || "";

  // Memoised because it is a dependency of the preview below, and a fresh array on every render
  // would recompute the preview on every keystroke elsewhere in the sheet.
  const beschikbaar = useMemo(() => {
    const vanaf = lesdagen.indexOf(eersteDag);
    return vanaf >= 0 ? lesdagen.slice(vanaf) : [];
  }, [lesdagen, eersteDag]);

  const voorstellen = useMemo<Voorstel[]>(() => {
    if (!gekozen || beschikbaar.length === 0) return [];
    const aantal = gekozen.activiteiten.length;
    // "Verspreid" walks the available teaching days in equal steps so the last activiteit lands near
    // the end of the period; "achter elkaar" takes them one after the other from the first day.
    const stap = verdeling === "verspreid" ? Math.max(1, Math.floor(beschikbaar.length / aantal)) : 1;
    return gekozen.activiteiten
      .map((activiteit, i) => ({
        activiteitId: activiteit.id,
        activiteitNaam: activiteit.naam,
        datum: beschikbaar[i * stap],
      }))
      .filter((voorstel): voorstel is Voorstel => voorstel.datum !== undefined);
  }, [gekozen, beschikbaar, verdeling]);

  const tekort = gekozen ? gekozen.activiteiten.length - voorstellen.length : 0;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={t("periode.planSubthema")}
      voet={
        <Knop
          rang="hoofd"
          vol
          disabled={bezig || voorstellen.length === 0 || tekort > 0}
          onClick={() => onPlan(voorstellen)}
        >
          {bezig ? t("periode.bezig") : telWoord(voorstellen.length, "periode.planEen", "periode.planAantal")}
        </Knop>
      }
    >
      {laadt ? (
        <Laadlijst rijen={4} />
      ) : subthemas.length === 0 ? (
        <p className="text-body text-inkt-zacht">{t("periode.geenSubthemas")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Veld label={t("periode.subthema")}>
            {(id) => (
              <Keuze id={id} value={subthemaId} onChange={(e) => setSubthemaId(e.target.value)}>
                <option value="">{t("periode.kiesSubthema")}</option>
                {subthemas.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.themaNaam} / {sub.naam} ({sub.activiteiten.length})
                  </option>
                ))}
              </Keuze>
            )}
          </Veld>

          <Veld label={t("periode.eersteDag")}>
            {(id) => (
              <Invoer
                id={id}
                type="date"
                min={lesdagen[0]}
                max={lesdagen[lesdagen.length - 1]}
                value={eersteDag}
                onChange={(e) => setStartdag(e.target.value)}
              />
            )}
          </Veld>

          {/* Not wrapped in Veld: that renders a <label for=...>, and a radiogroup has no single
              form control for a label to point at. The radiogroup names itself instead. */}
          <Segment
            label={t("periode.verdeling")}
            waarde={verdeling}
            onKies={setVerdeling}
            className="w-full"
            opties={[
              { waarde: "achterElkaar", label: t("periode.achterElkaar") },
              { waarde: "verspreid", label: t("periode.verspreid") },
            ]}
          />

          {gekozen ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-micro uppercase text-inkt-zwak">{t("periode.voorbeeld")}</h3>

              {voorstellen.length === 0 ? (
                <p className="text-meta text-inkt-zwak">{t("periode.geenLesdagenNa")}</p>
              ) : (
                <ol className="flex flex-col gap-1">
                  {voorstellen.map((voorstel) => (
                    <li
                      key={voorstel.activiteitId}
                      className="flex items-center justify-between gap-3 rounded-veld border border-lijn bg-kaart px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-body text-inkt">{voorstel.activiteitNaam}</span>
                      <span className="mono shrink-0 text-[0.6875rem] text-inkt-zacht">{dagMaand(voorstel.datum)}</span>
                    </li>
                  ))}
                </ol>
              )}

              {tekort > 0 ? (
                <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                  {t("periode.pastNiet", { tekort })}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* What actually happened, after the fact. It names the rows that failed with the reason
              the server gave, and it never says everything worked when some of it did not. */}
          {resultaat ? (
            <section className="flex flex-col gap-2">
              <p className="text-meta text-inkt-zacht">
                {t("periode.deelsGelukt", { gelukt: resultaat.gelukt, totaal: resultaat.totaal })}
              </p>
              {resultaat.fouten.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {resultaat.fouten.map((fout) => (
                    <li
                      key={fout}
                      className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt"
                    >
                      {fout}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {gekozen ? (
            <p className="text-meta text-inkt-zwak">
              {telWoord(lesdagen.length, "periode.eenLesdag", "periode.aantalLesdagen")}
            </p>
          ) : null}
        </div>
      )}
    </Blad>
  );
}

export type { Voorstel };
