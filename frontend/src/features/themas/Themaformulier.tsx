import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Blad } from "../../components/ui/Blad";
import { Gewijzigd } from "../../components/ui/Gewijzigd";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Tekstvlak } from "../../components/ui/Veld";
import { Woordchips } from "../../components/ui/Woordchips";
import { ApiError } from "../../lib/api";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";
import type { ThemaWeergave } from "../../lib/types";
import type { ThemaInvoer } from "./mutaties";
import { Emojikiezer } from "./Emojikiezer";
import { Leeftijdkeuze } from "./Leeftijdkeuze";
import { useJaarfasen } from "../../lib/queries";

/**
 * Making or changing a school-wide thema (FR-3.1).
 *
 * **No klas field, deliberately.** A thema belongs to the school; only its planning is per class (Art. IX.2). It
 * does hold the leeftijden it is meant for (FB-012, ADR-0069): all nine for a new thema, so limiting it is a choice
 * and never a step to forget. A leeftijd a jaarplan or a subthema still uses is refused by the server, which names
 * them; the form shows that sentence rather than guessing it.
 *
 * **One column, in the order a thema is thought up** (FB-061): naam, duur, invalshoeken, then the
 * woordenschat, whose two lists sit side by side once the sheet is wide enough. The owner rejected a
 * live preview card beside the fields as too busy, so nothing here repeats what the fields already say.
 *
 * **Duur is a choice, not a spinner.** The ratified default is four to six weeks (admin
 * 2026-07-14), so those three are buttons and anything else is one field behind "Andere". A numeric
 * stepper made the common case as much work as the rare one, and on a phone its arrows are below the
 * minimum target size.
 *
 * **Changing says what changed** (FB-061). While editing, a field that differs from the saved thema carries
 * "gewijzigd" beside its label, Bewaren is off until something differs, and closing with differences asks
 * first. A new thema asks too once anything is typed: losing a half-written thema to a stray Escape is the
 * same loss.
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
  const [begin] = useState(() => ({
    naam: thema?.naam ?? "",
    icoon: thema?.icoon ?? null,
    duur: thema?.duurWeken ?? 4,
    invalshoeken: thema?.invalshoeken ?? "",
    kern: thema?.kernwoordenschat ?? [],
    rijk: thema?.rijkeWoordenschat ?? [],
    leeftijden: thema?.leeftijden ?? null,
  }));
  const { data: jaarfasen } = useJaarfasen();
  // A new thema starts with every leeftijd, once the codes are known.
  const [eigenLeeftijden, setLeeftijden] = useState<string[] | null>(begin.leeftijden);
  const leeftijden = eigenLeeftijden ?? jaarfasen ?? [];
  const [leeftijdFout, setLeeftijdFout] = useState(false);
  const [naam, setNaam] = useState(begin.naam);
  const [icoon, setIcoon] = useState<string | null>(begin.icoon);
  const [duur, setDuur] = useState(begin.duur);
  // A string, because an <input type=number> is empty for a moment while it is being cleared and a
  // numeric state would turn that into 0 or NaN under the teacher's cursor.
  const [andereDuur, setAndereDuur] = useState(GEWONE_DUUR.includes(begin.duur) ? "" : String(begin.duur));
  const [anders, setAnders] = useState(!GEWONE_DUUR.includes(begin.duur));
  const [invalshoeken, setInvalshoeken] = useState(begin.invalshoeken);
  const [kern, setKern] = useState<string[]>(begin.kern);
  const [rijk, setRijk] = useState<string[]>(begin.rijk);
  const [naamFout, setNaamFout] = useState(false);
  const [duurFout, setDuurFout] = useState(false);
  const [sluitVraag, setSluitVraag] = useState(false);

  const weken = anders ? Number.parseInt(andereDuur, 10) : duur;

  // Trimmed where the saved value is trimmed, so a trailing space is not a change.
  const gewijzigd = {
    naam: naam.trim() !== begin.naam.trim(),
    icoon: icoon !== begin.icoon,
    duur: weken !== begin.duur,
    invalshoeken: invalshoeken.trim() !== begin.invalshoeken.trim(),
    kern: !zelfdeLijst(kern, begin.kern),
    rijk: !zelfdeLijst(rijk, begin.rijk),
    leeftijden: begin.leeftijden !== null && !zelfdeLijst(leeftijden, begin.leeftijden),
  };
  const vuil = Object.values(gewijzigd).some(Boolean);

  // While a save runs the sheet stays open: closing it then would still land the teacher on the new thema.
  function probeerSluiten() {
    if (bezig) return;
    if (vuil) setSluitVraag(true);
    else onSluit();
  }

  function verstuur(event: FormEvent) {
    event.preventDefault();
    // Checked here as well as server-side: a round trip to learn that a required field is empty is a
    // worse experience than a sentence under the field. The server stays the authority.
    const naamLeeg = naam.trim().length === 0;
    const duurOngeldig = !Number.isFinite(weken) || weken < 1;
    const geenLeeftijd = leeftijden.length === 0;
    setNaamFout(naamLeeg);
    setDuurFout(duurOngeldig);
    setLeeftijdFout(geenLeeftijd);
    if (naamLeeg || duurOngeldig || geenLeeftijd) return;

    setSluitVraag(false);
    onBewaar({
      naam: naam.trim(),
      duurWeken: weken,
      invalshoeken: invalshoeken.trim() === "" ? null : invalshoeken.trim(),
      kernwoordenschat: kern,
      rijkeWoordenschat: rijk,
      icoon,
      leeftijden,
    });
  }

  // The server's own sentence when it sent one a teacher can act on, framed rather than echoed:
  // nl.json says what kind of thing failed, the server says which value it was.
  const serverReden = fout instanceof ApiError ? fout.detail : undefined;
  const totaal = kern.length + rijk.length;
  const nieuw = thema === undefined;

  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && probeerSluiten()}
      maat="breed"
      titel={nieuw ? t("themabeheer.nieuwTitel") : t("themabeheer.wijzigTitel", { naam: begin.naam })}
      voet={
        <div className="flex flex-col gap-3">
          {sluitVraag ? (
            <Sluitvraag onWeggooien={onSluit} onVerder={() => setSluitVraag(false)} />
          ) : null}
          <div className="flex items-center gap-2">
            <Knop
              rang="hoofd"
              vol
              form={id}
              type="submit"
              bezig={bezig}
              disabled={!nieuw && !vuil}
              className="@sm:w-auto @sm:px-6"
            >
              {nieuw
                ? bezig
                  ? t("themabeheer.aanmakenBezig")
                  : t("themabeheer.aanmaken")
                : bezig
                  ? t("themabeheer.bewaarBezig")
                  : t("themabeheer.bewaar")}
            </Knop>
            <Knop rang="stil" type="button" onClick={probeerSluiten} disabled={bezig}>
              {t("themabeheer.annuleer")}
            </Knop>
          </div>
        </div>
      }
    >
      {/* The submit button lives in the sheet's footer, outside this element, so it reaches the form
          by id rather than by nesting. */}
      <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
        <div>
          <Label htmlFor={`${id}-naam`} gewijzigd={!nieuw && (gewijzigd.naam || gewijzigd.icoon)}>
            {t("themabeheer.naam")}
          </Label>
          <div className="mt-1.5 flex gap-2">
            <Emojikiezer waarde={icoon} onKies={setIcoon} uitgeschakeld={bezig} />
            <Invoer
              id={`${id}-naam`}
              value={naam}
              disabled={bezig}
              aria-invalid={naamFout || undefined}
              onChange={(e) => {
                setNaam(e.target.value);
                if (naamFout) setNaamFout(false);
              }}
            />
          </div>
          {naamFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("themabeheer.naamVerplicht")}
            </p>
          ) : null}
        </div>

        <fieldset>
          <legend className="flex items-baseline gap-2 text-meta font-medium text-inkt">
            {t("themabeheer.duur")}
            {!nieuw && gewijzigd.duur ? <Gewijzigd /> : null}
          </legend>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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

        <fieldset>
          <legend className="flex items-baseline gap-2 text-meta font-medium text-inkt">
            {t("themabeheer.leeftijden")}
            {!nieuw && gewijzigd.leeftijden ? <Gewijzigd /> : null}
          </legend>
          <p className="mt-0.5 text-meta text-inkt-zacht">{t("themabeheer.leeftijdenUitleg")}</p>
          <div className="mt-1.5">
            <Leeftijdkeuze
              jaarfasen={jaarfasen ?? []}
              gekozen={leeftijden}
              label={null}
              uitgeschakeld={bezig}
              onWijzig={(gekozen) => {
                setLeeftijden(gekozen);
                if (leeftijdFout) setLeeftijdFout(false);
              }}
            />
          </div>
          {leeftijdFout ? (
            <p role="alert" className="mt-1.5 text-meta font-medium text-attentie-inkt">
              {t("themabeheer.leeftijdVerplicht")}
            </p>
          ) : null}
        </fieldset>

        <div>
          <Label htmlFor={`${id}-invalshoeken`} gewijzigd={!nieuw && gewijzigd.invalshoeken}>
            {t("themabeheer.invalshoeken")}
          </Label>
          <Tekstvlak
            id={`${id}-invalshoeken`}
            value={invalshoeken}
            disabled={bezig}
            onChange={(e) => setInvalshoeken(e.target.value)}
            className="mt-1.5 resize-y"
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

          {/* Side by side from the width of the wide sheet, stacked on a phone. `@container` is the sheet. */}
          <div className="mt-3 grid gap-4 @xl:grid-cols-2">
            <Woordchips
              label={t("themabeheer.kernwoordenschat")}
              uitleg={t("themabeheer.kernUitleg")}
              woorden={kern}
              onWijzig={setKern}
              uitgeschakeld={bezig}
              gewijzigd={!nieuw && gewijzigd.kern}
              gevuld
            />
            <Woordchips
              label={t("themabeheer.rijkeWoordenschat")}
              uitleg={t("themabeheer.rijkUitleg")}
              woorden={rijk}
              onWijzig={setRijk}
              uitgeschakeld={bezig}
              gewijzigd={!nieuw && gewijzigd.rijk}
            />
          </div>
        </section>

        {fout ? (
          <div role="alert" className="rounded border border-attentie/40 bg-attentie-zacht p-3">
            <p className="text-body font-medium text-attentie-inkt">{t("themabeheer.bewaarMislukt")}</p>
            {serverReden ? <p className="mt-1 text-meta text-attentie-inkt">{serverReden}</p> : null}
          </div>
        ) : null}
      </form>
    </Blad>
  );
}

function zelfdeLijst(a: string[], b: string[]) {
  return a.length === b.length && a.every((woord, i) => woord === b[i]);
}

function Label({ htmlFor, gewijzigd, children }: { htmlFor: string; gewijzigd: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-meta font-medium text-inkt">
      {children}
      {gewijzigd ? <Gewijzigd /> : null}
    </label>
  );
}

/**
 * The question before unsaved changes are lost.
 *
 * Inline in the footer rather than a second dialog on top of the sheet: it is about the sheet's own buttons, and it
 * sits where the eye already is. Focus moves to "Verder bewerken", the safe answer, so an Escape pressed twice does
 * not throw work away.
 */
function Sluitvraag({ onWeggooien, onVerder }: { onWeggooien: () => void; onVerder: () => void }) {
  const vak = useRef<HTMLDivElement>(null);
  useEffect(() => {
    vak.current?.querySelector<HTMLButtonElement>("[data-verder]")?.focus();
  }, []);
  return (
    <div
      ref={vak}
      role="alert"
      className="flex flex-col gap-2 rounded border border-attentie/40 bg-attentie-zacht p-3 @md:flex-row @md:items-center"
    >
      <p className="flex-1 text-meta font-medium text-attentie-inkt">{t("themabeheer.nietBewaard")}</p>
      <div className="flex gap-2">
        <Knop type="button" rang="rustig" onClick={onWeggooien}>
          {t("themabeheer.weggooien")}
        </Knop>
        <Knop data-verder type="button" rang="rustig" onClick={onVerder}>
          {t("themabeheer.verderBewerken")}
        </Knop>
      </div>
    </div>
  );
}
