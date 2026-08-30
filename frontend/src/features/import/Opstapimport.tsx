import { useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { Veld, Invoer } from "../../components/ui/Veld";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import { Bestandkiezer } from "./Bestandkiezer";
import { Beperkt, Foutvlak, Opmerkingen, Telling, Vak } from "./Meldingen";
import { importeerOpstap, voorbeeldOpstap } from "./api";
import type { OpstapImportAntwoord, OpstapRijProbleem } from "./types";

/**
 * Loading one discipline's official Op.stap goal file (FR-2.1, re-import FR-2.5).
 *
 * **This is reference data, so nothing here edits anything.** The importer adds and updates
 * leerplandoelen and it never deletes: a goal that vanished from the file is reported and kept, and a
 * goal that vanished while school content still links it is reported louder and still kept
 * (Art. IV.2). The screen therefore has no destructive control at all, which is why it has no opt-in
 * where the school-content side does.
 *
 * **`vereistReview` is not rendered as a standing state.** It is true whenever anything disappeared,
 * and a disappeared goal stays absent from every later file, so a banner keyed on it would be
 * permanent from the first gap onward. What is shown is scoped to the run in front of the reader.
 *
 * **The row problems stay English.** `reden` is an operator diagnostic about the OFFICIAL file:
 * nobody using this application can fix a malformed row in a file the school downloaded from
 * Op.stap. Translating it would be inventing Dutch for an audience that cannot act on it. So it sits
 * under a Dutch heading saying these are technical details, never as the primary sentence, and never
 * phrased as something the reader did wrong.
 */
export function Opstapimport() {
  const [bestand, setBestand] = useState<File | null>(null);
  const [discipline, setDiscipline] = useState("");
  const [voorbeeld, setVoorbeeld] = useState<OpstapImportAntwoord | null>(null);
  const [uitkomst, setUitkomst] = useState<OpstapImportAntwoord | null>(null);
  const [bezig, setBezig] = useState<"voorbeeld" | "import" | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  function herbegin(volgende: () => void) {
    setVoorbeeld(null);
    setUitkomst(null);
    setFout(null);
    volgende();
  }

  async function voerUit(soort: "voorbeeld" | "import") {
    if (!bestand || discipline.trim().length === 0) return;
    setBezig(soort);
    setFout(null);
    try {
      const invoer = { bestand, disciplineNummer: discipline.trim() };
      if (soort === "voorbeeld") {
        setVoorbeeld(await voorbeeldOpstap(invoer));
        setUitkomst(null);
      } else {
        setUitkomst(await importeerOpstap(invoer));
        setVoorbeeld(null);
      }
    } catch (e) {
      setFout(e instanceof ApiError && e.detail ? e.detail : t("importeren.mislukt"));
    } finally {
      setBezig(null);
    }
  }

  const getoond = uitkomst ?? voorbeeld;
  const diff = getoond?.diff ?? null;
  const klaar = bestand !== null && discipline.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Vak titel={t("importeren.opstap.titel")}>
        <div className="flex flex-col gap-4">
          <Bestandkiezer
            bestand={bestand}
            onKies={(nieuw) => herbegin(() => setBestand(nieuw))}
            uitgeschakeld={bezig !== null}
          />

          <Veld label={t("importeren.opstap.discipline")}>
            {(id) => (
              <Invoer
                id={id}
                inputMode="decimal"
                value={discipline}
                disabled={bezig !== null}
                onChange={(e) => herbegin(() => setDiscipline(e.target.value))}
              />
            )}
          </Veld>

          <div>
            <Knop rang="hoofd" disabled={!klaar || bezig !== null} onClick={() => voerUit("voorbeeld")}>
              {bezig === "voorbeeld" ? t("importeren.bezig") : t("importeren.bekijkVoorbeeld")}
            </Knop>
          </div>

          {fout ? <Foutvlak titel={t("importeren.mislukt")} tekst={fout} /> : null}
        </div>
      </Vak>

      {getoond && diff ? (
        <Vak
          titel={getoond.toegepast ? t("importeren.opstap.gedaan") : t("importeren.opstap.voorbeeld")}
          merk={<span className="mono shrink-0 text-micro uppercase text-inkt-zwak">{diff.disciplineNummer}</span>}
        >
          <div className="flex flex-col gap-4">
            {diff.isLeeg || diff.overgeslagen ? (
              <p className="text-body text-inkt-zacht">{t("importeren.opstap.leeg")}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-veld bg-vlak-diep/60 px-3 py-2.5">
                  <Telling label={t("importeren.nieuw")} aantal={diff.toegevoegd.length} />
                  <Telling label={t("importeren.gewijzigd")} aantal={diff.gewijzigd.length} />
                  <Telling label={t("importeren.ongewijzigd")} aantal={diff.ongewijzigd.length} stil />
                  <Telling label={t("importeren.opstap.verdwenen")} aantal={diff.verdwenen.length} />
                </div>

                {diff.gewijzigd.length > 0 ? (
                  <div>
                    <h3 className="text-micro uppercase text-inkt-zwak">{t("importeren.opstap.watVerandert")}</h3>
                    <div className="mt-2">
                      <Beperkt
                        items={diff.gewijzigd}
                        hoeveel={8}
                        render={(wijziging) => (
                          <li key={wijziging.code} className="flex flex-wrap items-baseline gap-x-2 text-meta">
                            <span className="mono shrink-0 font-medium text-inkt">{wijziging.code}</span>
                            <span className="min-w-0 text-inkt-zacht">
                              {wijziging.velden.map((veld) => veld.veld).join(", ")}
                            </span>
                          </li>
                        )}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Kept, never deleted, and the sentence says so: this is a list of what stays put. */}
                {diff.verdwenenMaarGekoppeld.length > 0 ? (
                  <div className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
                    <p className="text-meta font-medium text-attentie-inkt">
                      {t("importeren.opstap.verdwenenGekoppeld", { aantal: diff.verdwenenMaarGekoppeld.length })}
                    </p>
                    <div className="mt-2">
                      <Beperkt
                        items={diff.verdwenenMaarGekoppeld}
                        hoeveel={8}
                        render={(doel) => (
                          <li key={doel.code} className="flex flex-wrap items-baseline gap-x-2 text-meta text-attentie-inkt">
                            <span className="mono shrink-0 font-medium">{doel.code}</span>
                            <span>{t("importeren.opstap.koppelingen", { aantal: doel.aantalKoppelingen })}</span>
                          </li>
                        )}
                      />
                    </div>
                  </div>
                ) : null}

                <Opmerkingen titel={t("importeren.opmerkingen")} regels={diff.opmerkingen} />
              </>
            )}

            <Rijproblemen problemen={getoond.problemen} />

            {/* Same rule as the school-content side: nothing to load means no load button. */}
            {getoond.toegepast || diff.isLeeg || diff.overgeslagen ? null : (
              <div className="flex flex-wrap items-center gap-2">
                <Knop
                  rang="hoofd"
                  disabled={!getoond.isBestandGeldig || bezig !== null}
                  onClick={() => voerUit("import")}
                >
                  {bezig === "import" ? t("importeren.bezig") : t("importeren.voerUit")}
                </Knop>
                {!getoond.isBestandGeldig ? (
                  <p className="text-meta text-inkt-zacht">{t("importeren.opstap.eerstNakijken")}</p>
                ) : null}
              </div>
            )}
          </div>
        </Vak>
      ) : null}
    </div>
  );
}

/** Rows the parser could not read, in the language of whoever can act on them. */
function Rijproblemen({ problemen }: { problemen: OpstapRijProbleem[] }) {
  if (problemen.length === 0) return null;
  return (
    <div className="rounded-veld border border-lijn bg-vlak-diep/60 p-3">
      <p className="text-meta font-medium text-inkt">
        {t("importeren.problemen", { aantal: problemen.length })}
      </p>
      <p className="mt-0.5 text-meta text-inkt-zacht">{t("importeren.opstap.technisch")}</p>
      <div className="mt-2">
        <Beperkt
          items={problemen}
          render={(probleem, i) => (
            <li
              key={`${probleem.rijNummer}-${probleem.code ?? ""}-${i}`}
              className="flex flex-col gap-0.5 text-meta sm:flex-row sm:gap-2"
            >
              <span className="mono shrink-0 font-medium text-inkt-zacht">
                {t("importeren.rij", { nummer: probleem.rijNummer })}
                {probleem.code ? ` · ${probleem.code}` : ""}
              </span>
              {/* English, deliberately: see the component docstring. `lang` is set so a screen reader
                  switches voice instead of reading English with Dutch phonemes. */}
              <span lang="en" className="mono min-w-0 break-words text-inkt">
                {probleem.reden}
              </span>
            </li>
          )}
        />
      </div>
    </div>
  );
}
