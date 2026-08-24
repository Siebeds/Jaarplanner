import { useId, useState, type FormEvent } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer } from "../../components/ui/Veld";
import { Woordchips } from "../../components/ui/Woordchips";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import type { ThemaWeergave } from "../../lib/types";
import type { ThemaInvoer } from "./mutaties";

/**
 * Making or changing a school-wide thema (FR-3.1).
 *
 * **No klas and no leeftijd field, deliberately.** A thema belongs to the school; only its subthema's
 * are per class (Art. IX.2). A scope field here would offer a choice the server rejects, so the level
 * rule is visible in the shape of the form rather than only in a validation message.
 *
 * **The shape says what a thema is.** Naam and duur are one line of administration; the two
 * woordenschat lists are the substance, and they get the room. The previous version gave all five
 * fields the same weight, which read as a form to be filled in rather than as a thema to be built.
 *
 * **Duur is a choice, not a spinner.** The ratified default is four to six weeks (directie
 * 2026-07-14), so those three are buttons and anything else is one field behind "Andere". A numeric
 * stepper made the common case as much work as the rare one, and on a phone its arrows are below the
 * minimum target size.
 */
const GEWONE_DUUR = [4, 5, 6];

export function Themaformulier({
  open,
  thema,
  onBewaar,
  onSluit,
  bezig,
  fout,
}: {
  open: boolean;
  /** The thema being changed, or undefined when making a new one. */
  thema?: ThemaWeergave;
  onBewaar: (invoer: ThemaInvoer) => void;
  onSluit: () => void;
  bezig: boolean;
  /** The caller's failed mutation, so the form can explain it beside its own fields. */
  fout?: unknown;
}) {
  const id = useId();
  const [naam, setNaam] = useState(thema?.naam ?? "");
  const [duur, setDuur] = useState(thema?.duurWeken ?? 4);
  // A string, because an <input type=number> is empty for a moment while it is being cleared and a
  // numeric state would turn that into 0 or NaN under the teacher's cursor.
  const [andereDuur, setAndereDuur] = useState(
    thema && !GEWONE_DUUR.includes(thema.duurWeken) ? String(thema.duurWeken) : "",
  );
  const [anders, setAnders] = useState(thema ? !GEWONE_DUUR.includes(thema.duurWeken) : false);
  const [invalshoeken, setInvalshoeken] = useState(thema?.invalshoeken ?? "");
  const [kern, setKern] = useState<string[]>(thema?.kernwoordenschat ?? []);
  const [rijk, setRijk] = useState<string[]>(thema?.rijkeWoordenschat ?? []);
  const [naamFout, setNaamFout] = useState(false);
  const [duurFout, setDuurFout] = useState(false);

  const weken = anders ? Number.parseInt(andereDuur, 10) : duur;

  function verstuur(event: FormEvent) {
    event.preventDefault();
    // Checked here as well as server-side: a round trip to learn that a required field is empty is a
    // worse experience than a sentence under the field. The server stays the authority.
    const naamLeeg = naam.trim().length === 0;
    const duurOngeldig = !Number.isFinite(weken) || weken < 1;
    setNaamFout(naamLeeg);
    setDuurFout(duurOngeldig);
    if (naamLeeg || duurOngeldig) return;

    onBewaar({
      naam: naam.trim(),
      duurWeken: weken,
      invalshoeken: invalshoeken.trim() === "" ? null : invalshoeken.trim(),
      kernwoordenschat: kern,
      rijkeWoordenschat: rijk,
    });
  }

  // The server's own sentence when it sent one a teacher can act on, framed rather than echoed:
  // nl.json says what kind of thing failed, the server says which value it was.
  const serverReden = fout instanceof ApiError ? fout.detail : undefined;
  const totaal = kern.length + rijk.length;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      maat="breed"
      titel={thema ? t("themabeheer.wijzigTitel") : t("themabeheer.nieuwTitel")}
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
      {/* The submit button lives in the sheet's footer, outside this element, so it reaches the form
          by id rather than by nesting. */}
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
                      setDuurFout(false);
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
                onClick={() => {
                  setAnders(true);
                  setDuurFout(false);
                }}
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
                  onChange={(e) => {
                    setAndereDuur(e.target.value);
                    if (duurFout) setDuurFout(false);
                  }}
                  className="w-20"
                />
              ) : null}
              <span className="text-meta text-inkt-zacht">{t("themabeheer.weken")}</span>
            </div>
            {duurFout ? (
              <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
                {t("themabeheer.duurOngeldig")}
              </p>
            ) : null}
          </fieldset>
        </div>

        <div>
          <label htmlFor={`${id}-invalshoeken`} className="text-meta font-medium text-inkt">
            {t("themabeheer.invalshoeken")}
          </label>
          <Invoer
            id={`${id}-invalshoeken`}
            value={invalshoeken}
            disabled={bezig}
            onChange={(e) => setInvalshoeken(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <section className="border-t border-lijn pt-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-micro uppercase text-inkt-zwak">{t("themabeheer.woordenschat")}</h3>
            {/* Only where both lists are on screen, so the figure is of what the reader can see. */}
            {totaal > 0 ? (
              <span className="mono shrink-0 text-micro text-inkt-zwak">
                {t("themabeheer.woordenTotaal", { aantal: totaal })}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-4">
            <Woordchips
              label={t("themabeheer.kernwoordenschat")}
              woorden={kern}
              onWijzig={setKern}
              uitgeschakeld={bezig}
              gevuld
            />
            <Woordchips
              label={t("themabeheer.rijkeWoordenschat")}
              woorden={rijk}
              onWijzig={setRijk}
              uitgeschakeld={bezig}
            />
          </div>
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
