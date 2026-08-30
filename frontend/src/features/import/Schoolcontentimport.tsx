import { useId, useState } from "react";
import { Knop, Knoplink } from "../../components/ui/Knop";
import { Segment } from "../../components/ui/Segment";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import { Bestandkiezer } from "./Bestandkiezer";
import { Beperkt, Foutvlak, Opmerkingen, Telling, Vak } from "./Meldingen";
import { SJABLOON_PAD, importeerSchoolcontent, voorbeeldSchoolcontent } from "./api";
import type {
  SchoolcontentImportAntwoord,
  SchoolcontentImportModus,
  SchoolcontentRijProbleem,
  WijzigingSoort,
} from "./types";

/**
 * Uploading the school's own thema's, subthema's and activiteiten (FR-1).
 *
 * **Preview, then commit, always in that order.** The commit button does not exist until a preview
 * has been shown, and the preview writes nothing. That is not a nicety: in "bijwerken" mode the
 * import can discard goal links a teacher decided by hand, and Art. IV.2 lets it only on an explicit
 * opt-in. An opt-in offered before the preview would be a teacher agreeing to a number nobody has
 * counted yet, which is why the checkbox sits under the list of what is at stake and nowhere else.
 *
 * **Changing anything throws the preview away.** A diff belongs to one file in one mode; keeping it
 * on screen after either changed would let a teacher commit a file they never previewed.
 */
export function Schoolcontentimport() {
  const opruimId = useId();
  const [bestand, setBestand] = useState<File | null>(null);
  const [modus, setModus] = useState<SchoolcontentImportModus>("Toevoegen");
  const [opruimen, setOpruimen] = useState(false);
  const [voorbeeld, setVoorbeeld] = useState<SchoolcontentImportAntwoord | null>(null);
  const [uitkomst, setUitkomst] = useState<SchoolcontentImportAntwoord | null>(null);
  const [bezig, setBezig] = useState<"voorbeeld" | "import" | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  function herbegin(volgende: () => void) {
    setVoorbeeld(null);
    setUitkomst(null);
    setFout(null);
    setOpruimen(false);
    volgende();
  }

  async function voerUit(soort: "voorbeeld" | "import") {
    if (!bestand) return;
    setBezig(soort);
    setFout(null);
    try {
      const invoer = { bestand, modus, menselijkeBeslissingenVerwijderen: opruimen };
      if (soort === "voorbeeld") {
        setVoorbeeld(await voorbeeldSchoolcontent(invoer));
        setUitkomst(null);
      } else {
        const antwoord = await importeerSchoolcontent(invoer);
        setUitkomst(antwoord);
        setVoorbeeld(null);
      }
    } catch (e) {
      // The server's own Dutch when it sent some: a wrong extension or an unreadable workbook is
      // something the uploader fixes, and its sentence names the fix. Otherwise one line from the
      // catalogue, because "Request failed with 500" is not a sentence for a teacher.
      setFout(e instanceof ApiError && e.detail ? e.detail : t("importeren.mislukt"));
    } finally {
      setBezig(null);
    }
  }

  const getoond = uitkomst ?? voorbeeld;
  const diff = getoond?.diff ?? null;
  const bedreigd = diff?.bedreigdeBeslissingen ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Vak titel={t("importeren.school.titel")}>
        <div className="flex flex-col gap-4">
          <Bestandkiezer
            bestand={bestand}
            onKies={(nieuw) => herbegin(() => setBestand(nieuw))}
            uitgeschakeld={bezig !== null}
          />

          <Segment
            label={t("importeren.school.modus")}
            waarde={modus}
            onKies={(nieuw) => herbegin(() => setModus(nieuw))}
            opties={[
              { waarde: "Toevoegen", label: t("importeren.school.toevoegen") },
              { waarde: "Bijwerken", label: t("importeren.school.bijwerken") },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Knop
              rang="hoofd"
              disabled={!bestand || bezig !== null}
              onClick={() => voerUit("voorbeeld")}
            >
              {bezig === "voorbeeld" ? t("importeren.bezig") : t("importeren.bekijkVoorbeeld")}
            </Knop>
            {/* A real download, so it is a link and not a button. `download` names the file the API
                names it too; without it a browser can save "sjabloon" with no extension. */}
            <Knoplink href={SJABLOON_PAD} download>
              {t("importeren.school.sjabloon")}
            </Knoplink>
          </div>

          {fout ? <Foutvlak titel={t("importeren.mislukt")} tekst={fout} /> : null}
        </div>
      </Vak>

      {getoond && diff ? (
        <Vak
          titel={getoond.toegepast ? t("importeren.school.gedaan") : t("importeren.school.voorbeeld")}
          merk={
            <span className="mono shrink-0 text-micro uppercase text-inkt-zwak">
              {diff.modus === "Bijwerken" ? t("importeren.school.bijwerken") : t("importeren.school.toevoegen")}
            </span>
          }
        >
          <div className="flex flex-col gap-4">
            {diff.isLeeg || diff.overgeslagen ? (
              <p className="text-body text-inkt-zacht">{t("importeren.school.leeg")}</p>
            ) : (
              <>
                <Niveaus diff={diff} />
                <Opmerkingen titel={t("importeren.opmerkingen")} regels={diff.opmerkingen} />
              </>
            )}

            <Rijproblemen problemen={getoond.problemen} />

            {bedreigd.length > 0 ? (
              <div className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
                <p className="text-meta font-medium text-attentie-inkt">
                  {t("importeren.school.bedreigd", { aantal: bedreigd.length })}
                </p>
                <div className="mt-2">
                  <Beperkt
                    items={bedreigd}
                    hoeveel={8}
                    render={(beslissing, i) => (
                      <li
                        key={`${beslissing.leerplandoelCode}-${beslissing.contentNaam}-${i}`}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-attentie-inkt"
                      >
                        <span className="mono shrink-0">{beslissing.leerplandoelCode}</span>
                        <span className="min-w-0 break-words">{beslissing.contentNaam}</span>
                        <Statusmerk status={beslissing.status} />
                      </li>
                    )}
                  />
                </div>

                {/* The opt-in itself, and only where the count is on screen. Unchecked by default,
                    and re-checking it after a change is deliberate: it is consent to this list. */}
                {!getoond.toegepast ? (
                  <label htmlFor={opruimId} className="mt-3 flex items-start gap-2.5">
                    <input
                      id={opruimId}
                      type="checkbox"
                      checked={opruimen}
                      onChange={(e) => setOpruimen(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-lijn-veld accent-attentie"
                    />
                    <span className="text-meta font-medium text-attentie-inkt">
                      {t("importeren.school.opruimen")}
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}

            {/* No commit action for a file that changes nothing, and none after one that already
                ran: a button whose only possible outcome is "nothing happened" is the E3-06 rule in
                miniature. The sentence above it already said so. */}
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
                  <p className="text-meta text-inkt-zacht">{t("importeren.school.eerstHerstellen")}</p>
                ) : null}
              </div>
            )}
          </div>
        </Vak>
      ) : null}
    </div>
  );
}

/** The three levels, each counted by what happens to it. */
function Niveaus({ diff }: { diff: NonNullable<SchoolcontentImportAntwoord["diff"]> }) {
  const tel = (items: { soort: WijzigingSoort }[], soort: WijzigingSoort) =>
    items.filter((item) => item.soort === soort).length;

  const rijen = [
    { label: t("importeren.school.themas"), items: diff.themas },
    { label: t("importeren.school.subthemas"), items: diff.subthemas },
    { label: t("importeren.school.activiteiten"), items: diff.activiteiten },
  ];

  return (
    <ul className="flex flex-col gap-2">
      {rijen.map((rij) => (
        <li
          key={rij.label}
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-veld bg-vlak-diep/60 px-3 py-2.5"
        >
          <p className="text-body font-medium text-inkt">{rij.label}</p>
          <div className="flex shrink-0 gap-6">
            <Telling label={t("importeren.nieuw")} aantal={tel(rij.items, "Toegevoegd")} />
            <Telling label={t("importeren.gewijzigd")} aantal={tel(rij.items, "Bijgewerkt")} />
            <Telling label={t("importeren.ongewijzigd")} aantal={tel(rij.items, "Ongewijzigd")} stil />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Rows the parser could not read.
 *
 * `melding` is the server's Dutch and it is printed as it came: it names a row, a column and a value,
 * and no catalogue entry can do that. Row 0 means the problem is about the file rather than a row, so
 * it gets no row number instead of the nonsense "rij 0".
 */
function Rijproblemen({ problemen }: { problemen: SchoolcontentRijProbleem[] }) {
  if (problemen.length === 0) return null;
  return (
    <div className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
      <p className="text-meta font-medium text-attentie-inkt">
        {t("importeren.problemen", { aantal: problemen.length })}
      </p>
      <div className="mt-2">
        <Beperkt
          items={problemen}
          render={(probleem, i) => (
            <li
              key={`${probleem.rijNummer}-${probleem.kolom ?? ""}-${i}`}
              className="flex flex-col gap-0.5 text-meta text-attentie-inkt sm:flex-row sm:gap-2"
            >
              {probleem.rijNummer > 0 ? (
                <span className="mono shrink-0 font-medium">
                  {t("importeren.rij", { nummer: probleem.rijNummer })}
                  {probleem.kolomLabel ? ` · ${probleem.kolomLabel}` : ""}
                </span>
              ) : null}
              <span className="min-w-0 break-words">{probleem.melding}</span>
            </li>
          )}
        />
      </div>
    </div>
  );
}
