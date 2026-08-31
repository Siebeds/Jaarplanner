import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Keuze } from "../../components/ui/Veld";
import { IcoonKruis, IcoonPlus } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { useJaarfasen } from "../../lib/queries";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import type { SubthemaWeergave } from "../../lib/types";
import type { OnderzoeksvraagInvoer, SubthemaInvoer } from "./mutaties";

/**
 * Making or changing a subthema (FR-3.2).
 *
 * **The leeftijd is required, and it is asked AFTER the naam** (owner, 2026-08-31). A subthema
 * cannot exist without an age (Art. IX.2 as amended 2026-08-30): it is the school's content FOR a
 * year group, and it holds for every klas that teaches that year, and the server rejects a blank or
 * unknown one. So it stays a required field with a visible label.
 *
 * It opened this form until 2026-08-31, on the argument that the age is what makes this a subthema at
 * all. That argument was about the schema, not about the person filling the form in: a teacher
 * reaches this sheet from a class she has already chosen, so the age is settled before she starts
 * typing, and putting it first put the one field she will not touch above the one she came here for.
 * The order now follows what she is doing rather than what the model needs.
 *
 * **The klas field is gone, and its absence is the change** (owner, 2026-08-30). It used to sit
 * beside the leeftijd and made the subthema one class's, so a teacher who built "de speelhoek" under
 * K3 groen found it unreachable from K3 blauw. A klas is now what a teacher plans IN, on the agenda,
 * and no longer what content belongs to.
 *
 * **That change is NOT explained on the screen**, and the attempt to do so was cut by the owner the
 * same day: two sentences under this select saying a subthema belongs to an age rather than a class.
 * They were written for teachers used to the old field, which is a need that lasts a week, and they
 * were sitting permanently under a nine-option control that already carries its own label inside a
 * fieldset headed VOOR WIE. Explanatory prose is the first thing this interface cuts.
 *
 * **The nine codes come from `GET /api/jaarfasen`**, for the same reason Jaarfasen is not restated
 * anywhere else in this frontend: a list spelled out here would be a second answer to what a year
 * group can be. Deliberately NOT read off a klas, which is where they used to come from: a subthema
 * stopped depending on a klas on 2026-08-30, and a form that needed one to offer its ages would have
 * kept that dependency alive in the one place it is hardest to see.
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
  const { data: jaarfasen } = useJaarfasen();
  const [naam, setNaam] = useState(subthema?.naam ?? "");
  const [duur, setDuur] = useState(subthema?.duurWeken ?? 2);
  const [andereDuur, setAndereDuur] = useState(
    subthema && !GEWONE_DUUR.includes(subthema.duurWeken) ? String(subthema.duurWeken) : "",
  );
  const [anders, setAnders] = useState(subthema ? !GEWONE_DUUR.includes(subthema.duurWeken) : false);
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

  const fasen = jaarfasen ?? [];

  function verstuur(event: FormEvent) {
    event.preventDefault();
    const naamLeeg = naam.trim().length === 0;
    const scopeLeeg = leeftijd.trim().length === 0;
    setNaamFout(naamLeeg);
    setScopeFout(scopeLeeg);
    if (naamLeeg || scopeLeeg || !Number.isFinite(weken) || weken < 1) return;

    onBewaar({
      naam: naam.trim(),
      duurWeken: weken,
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

        {/* THE LEEFTIJD IS NOT AT THE TOP ANY MORE (owner, 2026-08-31: "leeftijd is voor mij niet de
            prioriteit en hoeft niet vanboven te staan, zet dat maar iets meer naar onder en zet naam
            vanboven, normaal zal een juf nooit de leeftijd moeten veranderen eens dat ze haar klas
            geselecteerd heeft").

            It used to open the form, and the argument for that was the model's: the leeftijd is what
            makes this a subthema rather than a thema (Art. IX.2), and it is required. True, and it
            still is, but it was an argument about the schema and not about the person filling the
            form in. She reaches this sheet from a class she already chose, so the age is settled
            before she starts typing and asking it first put a field she will not touch above the one
            she came here for. It stays required and it stays visible; it just stops going first. */}
        <fieldset className="rounded-veld bg-vlak-diep/60 p-3">
          <legend className="px-1 text-micro uppercase text-inkt-zwak">
            {t("subthemabeheer.voorWie")}
          </legend>
          <div className="min-w-48">
            <label htmlFor={`${id}-leeftijd`} className="text-meta font-medium text-inkt">
              {t("subthemabeheer.leeftijd")}
            </label>
            {fasen.length === 0 ? (
              <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
                {t("klasbeheer.leeftijdenOnbekend")}
              </p>
            ) : (
              <Keuze
                id={`${id}-leeftijd`}
                value={leeftijd}
                disabled={bezig}
                onChange={(e) => {
                  setLeeftijd(e.target.value);
                  setScopeFout(false);
                }}
                className="mt-1.5"
              >
                <option value="">{t("subthemabeheer.kiesLeeftijd")}</option>
                {fasen.map((fase) => (
                  <option key={fase} value={fase}>
                    {fase}
                  </option>
                ))}
              </Keuze>
            )}
          </div>
          {scopeFout ? (
            <p role="alert" className="mt-2 text-meta font-medium text-attentie-inkt">
              {t("subthemabeheer.scopeVerplicht")}
            </p>
          ) : null}
        </fieldset>

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
