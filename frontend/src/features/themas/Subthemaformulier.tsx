import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Keuze } from "../../components/ui/Veld";
import { IcoonKruis, IcoonPlus } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { useKlassen } from "../../lib/queries";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import type { SubthemaWeergave } from "../../lib/types";
import type { OnderzoeksvraagInvoer, SubthemaInvoer } from "./mutaties";

/**
 * Making or changing a subthema (FR-3.2).
 *
 * **Klas and leeftijd are required and they are the first thing asked.** A subthema cannot exist
 * school-wide (Art. IX.2): it is one class's derivation of a thema, at one age. The server rejects a
 * blank scope, so the form asks for it before anything else rather than letting a teacher fill in a
 * name and then discover the subthema had nowhere to live.
 *
 * **The leeftijd options come from the chosen klas.** A klas carries the jaar/fasen it covers, so a
 * graadklas offers more than one and a single-year class offers one. Listing all nine everywhere
 * would invite a subthema at an age the class does not have.
 *
 * **Onderzoeksvragen are edited as a whole list.** The API takes them as part of the subthema payload
 * rather than one at a time, so a removed row is removed by saving the subthema. Adding a row that
 * only exists after a save would be a control that lies about when it took effect.
 */
const GEWONE_DUUR = [1, 2, 3];

export function Subthemaformulier({
  open,
  subthema,
  onBewaar,
  onSluit,
  bezig,
  fout,
}: {
  open: boolean;
  /** The subthema being changed, or undefined when making a new one under this thema. */
  subthema?: SubthemaWeergave;
  onBewaar: (invoer: SubthemaInvoer) => void;
  onSluit: () => void;
  bezig: boolean;
  fout?: unknown;
}) {
  const id = useId();
  const { data: klassen } = useKlassen();
  const [naam, setNaam] = useState(subthema?.naam ?? "");
  const [duur, setDuur] = useState(subthema?.duurWeken ?? 2);
  const [andereDuur, setAndereDuur] = useState(
    subthema && !GEWONE_DUUR.includes(subthema.duurWeken) ? String(subthema.duurWeken) : "",
  );
  const [anders, setAnders] = useState(subthema ? !GEWONE_DUUR.includes(subthema.duurWeken) : false);
  const [klasId, setKlasId] = useState(subthema?.klasId ?? "");
  const [leeftijd, setLeeftijd] = useState(subthema?.leeftijd ?? "");
  const [vragen, setVragen] = useState<OnderzoeksvraagInvoer[]>(
    (subthema?.onderzoeksvragen ?? []).map((vraag) => ({
      vraag: vraag.vraag,
      probleemstelling: vraag.probleemstelling,
    })),
  );
  const [naamFout, setNaamFout] = useState(false);
  const [scopeFout, setScopeFout] = useState(false);

  const weken = anders ? Number.parseInt(andereDuur, 10) : duur;
  const gekozenKlas = (klassen ?? []).find((klas) => klas.id === klasId) ?? null;
  const fasen = gekozenKlas?.jaarFasen ?? [];

  function verstuur(event: FormEvent) {
    event.preventDefault();
    const naamLeeg = naam.trim().length === 0;
    // One check for both halves of the scope: they are one decision, and reporting them separately
    // would put two sentences under one pair of fields that are always filled in together.
    const scopeLeeg = klasId === "" || leeftijd.trim().length === 0;
    setNaamFout(naamLeeg);
    setScopeFout(scopeLeeg);
    if (naamLeeg || scopeLeeg || !Number.isFinite(weken) || weken < 1) return;

    onBewaar({
      naam: naam.trim(),
      duurWeken: weken,
      klasId,
      leeftijd: leeftijd.trim(),
      // A row whose question was emptied is a row the teacher deleted by clearing it.
      onderzoeksvragen: vragen
        .filter((vraag) => vraag.vraag.trim().length > 0)
        .map((vraag) => ({
          vraag: vraag.vraag.trim(),
          probleemstelling:
            vraag.probleemstelling && vraag.probleemstelling.trim() !== ""
              ? vraag.probleemstelling.trim()
              : null,
        })),
    });
  }

  const serverReden = fout instanceof ApiError ? fout.detail : undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      maat="breed"
      titel={subthema ? t("subthemabeheer.wijzigTitel") : t("subthemabeheer.nieuwTitel")}
      voet={
        <div className="flex items-center gap-2">
          <Knop rang="hoofd" vol form={id} type="submit" disabled={bezig} className="@sm:w-auto @sm:px-6">
            {bezig ? t("themabeheer.bewaarBezig") : t("themabeheer.bewaar")}
          </Knop>
          <Knop rang="stil" type="button" onClick={onSluit} disabled={bezig}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
        {/* The scope first, because it is the thing that makes this a subthema and not a thema. */}
        <fieldset className="rounded-veld bg-vlak-diep/60 p-3">
          <legend className="px-1 text-micro uppercase text-inkt-zwak">
            {t("subthemabeheer.voorWie")}
          </legend>
          {/* @md and not @sm: the query container is the panel, but these fields sit inside its 20px
              padding on both sides, so a breakpoint set at the panel width puts two 192px fields into
              152px less than that. Measured at 390, where @sm matched and seven elements ran off the
              right edge. */}
          <div className="flex flex-col gap-3 @md:flex-row">
            <div className="min-w-48 flex-1">
              <label htmlFor={`${id}-klas`} className="text-meta font-medium text-inkt">
                {t("subthemabeheer.klas")}
              </label>
              <Keuze
                id={`${id}-klas`}
                value={klasId}
                disabled={bezig}
                onChange={(e) => {
                  setKlasId(e.target.value);
                  // The old leeftijd may not exist in the new klas, so it is cleared rather than
                  // carried over into a scope the server would refuse.
                  setLeeftijd("");
                  setScopeFout(false);
                }}
                className="mt-1.5"
              >
                <option value="">{t("subthemabeheer.kiesKlas")}</option>
                {(klassen ?? []).map((klas) => (
                  <option key={klas.id} value={klas.id}>
                    {klas.naam}
                  </option>
                ))}
              </Keuze>
            </div>

            <div className="min-w-48 flex-1">
              <label htmlFor={`${id}-leeftijd`} className="text-meta font-medium text-inkt">
                {t("subthemabeheer.leeftijd")}
              </label>
              <Keuze
                id={`${id}-leeftijd`}
                value={leeftijd}
                disabled={bezig || klasId === ""}
                onChange={(e) => {
                  setLeeftijd(e.target.value);
                  setScopeFout(false);
                }}
                className="mt-1.5"
              >
                <option value="">
                  {klasId === "" ? t("subthemabeheer.eerstKlas") : t("subthemabeheer.kiesLeeftijd")}
                </option>
                {fasen.map((fase) => (
                  <option key={fase} value={fase}>
                    {fase}
                  </option>
                ))}
              </Keuze>
            </div>
          </div>
          {scopeFout ? (
            <p role="alert" className="mt-2 text-meta font-medium text-attentie-inkt">
              {t("subthemabeheer.scopeVerplicht")}
            </p>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-4 @md:flex-row @md:items-start">
          <div className="min-w-48 flex-1">
            <label htmlFor={`${id}-naam`} className="text-meta font-medium text-inkt">
              {t("themabeheer.naam")}
            </label>
            <Invoer
              id={`${id}-naam`}
              value={naam}
              disabled={bezig}
              aria-invalid={naamFout || undefined}
              onChange={(e) => {
                setNaam(e.target.value);
                if (naamFout) setNaamFout(false);
              }}
              className="mt-1.5"
            />
            {naamFout ? (
              <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
                {t("themabeheer.naamVerplicht")}
              </p>
            ) : null}
          </div>

          <fieldset className="shrink-0">
            <legend className="text-meta font-medium text-inkt">{t("themabeheer.duur")}</legend>
            <div className="mt-1.5 flex items-center gap-1.5">
              {GEWONE_DUUR.map((aantal) => {
                const gekozen = !anders && duur === aantal;
                return (
                  <button
                    key={aantal}
                    type="button"
                    disabled={bezig}
                    aria-pressed={gekozen}
                    onClick={() => {
                      setAnders(false);
                      setDuur(aantal);
                    }}
                    className={cn(
                      "mono h-raak w-11 rounded-veld border text-body font-medium transition-colors duration-150",
                      gekozen
                        ? "border-accent bg-accent text-accent-op"
                        : "border-lijn-veld bg-kaart text-inkt hover:border-inkt",
                    )}
                  >
                    {aantal}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={bezig}
                aria-pressed={anders}
                onClick={() => setAnders(true)}
                className={cn(
                  "h-raak rounded-veld border px-3 text-meta font-medium transition-colors duration-150",
                  anders
                    ? "border-accent bg-accent text-accent-op"
                    : "border-lijn-veld bg-kaart text-inkt-zacht hover:border-inkt hover:text-inkt",
                )}
              >
                {t("themabeheer.andere")}
              </button>
              {anders ? (
                <Invoer
                  type="number"
                  min={1}
                  value={andereDuur}
                  disabled={bezig}
                  aria-label={t("themabeheer.duurWeken")}
                  onChange={(e) => setAndereDuur(e.target.value)}
                  className="w-20"
                />
              ) : null}
              <span className="text-meta text-inkt-zacht">{t("themabeheer.weken")}</span>
            </div>
          </fieldset>
        </div>

        <section className="border-t border-lijn pt-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-micro uppercase text-inkt-zwak">{t("subthemabeheer.onderzoeksvragen")}</h3>
            <Knop
              rang="rustig"
              type="button"
              disabled={bezig}
              className="h-9 min-h-9 px-3 text-meta"
              onClick={() => setVragen([...vragen, { vraag: "", probleemstelling: null }])}
            >
              <IcoonPlus aria-hidden="true" className="h-4 w-4" />
              {t("subthemabeheer.vraagToevoegen")}
            </Knop>
          </div>

          {vragen.length === 0 ? (
            <p className="mt-3 text-meta text-inkt-zwak">{t("subthemabeheer.geenVragen")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {vragen.map((vraag, index) => (
                <li key={index} className="rounded-veld border border-lijn bg-kaart p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 flex-col">
                      <label htmlFor={`${id}-vraag-${index}`} className="text-meta font-medium text-inkt">
                        {t("subthemabeheer.vraag", { nummer: index + 1 })}
                      </label>
                      <Invoer
                        id={`${id}-vraag-${index}`}
                        value={vraag.vraag}
                        disabled={bezig}
                        onChange={(e) =>
                          setVragen(
                            vragen.map((ander, i) =>
                              i === index ? { ...ander, vraag: e.target.value } : ander,
                            ),
                          )
                        }
                        className="mt-1.5"
                      />
                      <Invoer
                        value={vraag.probleemstelling ?? ""}
                        disabled={bezig}
                        aria-label={t("subthemabeheer.probleemstelling", { nummer: index + 1 })}
                        placeholder={t("subthemabeheer.probleemstellingKort")}
                        onChange={(e) =>
                          setVragen(
                            vragen.map((ander, i) =>
                              i === index ? { ...ander, probleemstelling: e.target.value } : ander,
                            ),
                          )
                        }
                        className="mt-2"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={bezig}
                      aria-label={t("subthemabeheer.vraagWeg", { nummer: index + 1 })}
                      onClick={() => setVragen(vragen.filter((_, i) => i !== index))}
                      className="mt-6 inline-flex h-raak w-raak shrink-0 items-center justify-center rounded-veld border border-lijn-veld bg-kaart text-inkt-zacht transition-colors duration-150 hover:border-inkt hover:text-inkt"
                    >
                      <IcoonKruis aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {fout ? (
          <div role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("themabeheer.bewaarMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </form>
    </Blad>
  );
}
