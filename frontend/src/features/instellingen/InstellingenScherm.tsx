import { useState } from "react";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Knop } from "../../components/ui/Knop";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Keuze } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonPlus } from "../../components/Iconen";
import { useActieveSelectie } from "../../lib/selectie";
import { useJaarfasen } from "../../lib/queries";
import { ApiError } from "../../lib/api";
import { t, telWoord } from "../../i18n";
import type { KlasWeergave } from "../../lib/types";
import { Klasformulier } from "./Klasformulier";
import { Hoekensectie } from "./Hoekensectie";
import { useMaakKlas, useVerwijderKlas, useWijzigKlasVolledig } from "./mutaties";

/**
 * Where the school says what it is: one screen, sections, and Klassen is the first of them.
 *
 * **A klas is defined here and chosen everywhere else.** The Klaskiezer in the header answers "which
 * class am I looking at"; this answers "which classes exist and what is each one". Keeping the two
 * apart is why this screen is not a sheet hanging off the picker.
 *
 * **The leeftijd is the reason this section exists** (owner, 2026-08-30). It couples a klas to an
 * age, and an age is what a subthema is scoped to: a subthema on K3 holds for every K3 class, while
 * each of those classes keeps its own dagplanning. A class whose age is unset cannot be told which
 * subthema's are its own, so an unset one is not merely blank here, it is called out.
 *
 * **A klas states its leeftijd and nothing else about its level.** The leerjaar is derived from it
 * server-side, so it appears nowhere on this screen: printing both would be one fact twice.
 */
export function InstellingenScherm() {
  const { schooljaar, schooljaren, klassen, laadt, kiesSchooljaar } = useActieveSelectie();
  const [formulier, setFormulier] = useState<{ klas?: KlasWeergave } | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<KlasWeergave | null>(null);

  const { data: jaarfasen } = useJaarfasen();
  const maak = useMaakKlas(schooljaar?.id ?? null);
  const wijzig = useWijzigKlasVolledig();
  const verwijder = useVerwijderKlas();

  const bezig = formulier?.klas ? wijzig.isPending : maak.isPending;
  const fout = formulier?.klas ? wijzig.error : maak.error;

  return (
    <>
      <Schermkop titel={t("instellingen.titel")} />

      <Schermvlak>
        {/* Sections, separated by space rather than by a rule. Each already opens with its own
            uppercase micro heading, and a hairline between two of them would be a second answer to a
            question the headings have already answered. */}
        <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-micro uppercase text-inkt-zwak">{t("instellingen.klassen")}</h2>
            <Knop
              rang="rustig"
              className="h-9 min-h-9 px-3 text-meta"
              disabled={schooljaar === null}
              onClick={() => {
                maak.reset();
                setFormulier({});
              }}
            >
              <IcoonPlus aria-hidden="true" className="h-4 w-4" />
              {t("klasbeheer.toevoegen")}
            </Knop>
          </div>

          {/* Once above the list, never per row: which school year these classes belong to is the
              same fact for every one of them. Changing it here changes it for the whole app, which is
              what the header's picker does too, so there is one context and not two. */}
          <label className="flex flex-wrap items-center gap-2 text-meta text-inkt-zacht">
            {t("instellingen.schooljaar")}
            <Keuze
              value={schooljaar?.id ?? ""}
              disabled={schooljaren.length === 0}
              onChange={(e) => kiesSchooljaar(e.target.value)}
              className="w-auto"
            >
              {schooljaren.map((jaar) => (
                <option key={jaar.id} value={jaar.id}>
                  {jaar.naam}
                </option>
              ))}
            </Keuze>
          </label>

          {laadt ? (
            <Laadlijst rijen={3} />
          ) : klassen.length === 0 ? (
            <p className="text-body text-inkt-zacht">{t("klasbeheer.geenKlassen")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {klassen.map((klas) => (
                <li key={klas.id}>
                  <Klasrij
                    klas={klas}
                    onBewerk={() => {
                      wijzig.reset();
                      setFormulier({ klas });
                    }}
                    onVerwijder={() => {
                      verwijder.reset();
                      setTeVerwijderen(klas);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* The delete the server refused, with the reason it gave. It sits under the list rather
              than in the dialog because the dialog is closed by then, and the refusal names a count
              of subthema's, which is a fact about a row that is still on screen. */}
          {verwijder.isError ? (
            <p
              role="alert"
              className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt"
            >
              {verwijder.error instanceof ApiError && verwijder.error.detail
                ? verwijder.error.detail
                : t("klasbeheer.verwijderMislukt")}
            </p>
          ) : null}
        </section>

        <Hoekensectie klassen={klassen} laadt={laadt} />
        </div>
      </Schermvlak>

      {formulier ? (
        <Klasformulier
          open
          // From the vocabulary endpoint, not from a klas: the first klas of a school has none to read off.
          keuzes={jaarfasen ?? []}
          // Keyed on the klas, so reopening the sheet for another one refills the fields instead of
          // showing the previous class's half-edited name.
          key={formulier.klas?.id ?? "nieuw"}
          klas={formulier.klas}
          bezig={bezig}
          fout={fout}
          onSluit={() => setFormulier(null)}
          onBewaar={(invoer) => {
            if (formulier.klas) {
              wijzig.mutate(
                { klasId: formulier.klas.id, invoer },
                { onSuccess: () => setFormulier(null) },
              );
            } else {
              maak.mutate(invoer, { onSuccess: () => setFormulier(null) });
            }
          }}
        />
      ) : null}

      <Bevestiging
        open={teVerwijderen !== null}
        titel={t("klasbeheer.verwijderTitel", { naam: teVerwijderen?.naam ?? "" })}
        gevolg={t("klasbeheer.verwijderGevolg")}
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijder.isPending}
        onSluit={() => setTeVerwijderen(null)}
        onBevestig={() => {
          if (!teVerwijderen) return;
          verwijder.mutate(teVerwijderen.id, { onSuccess: () => setTeVerwijderen(null) });
        }}
      />
    </>
  );
}

/**
 * One klas: what it is called, which age it teaches, and how much content that hands it.
 *
 * **A missing age is the one state this row raises its voice for.** Everything else is a fact to
 * read. Since the leeftijd became required on 2026-08-30 it can only be missing on a klas that
 * predates the rule, and it matters more than it did: it is no longer just the coverage denominator,
 * it is what decides which subthema's and activiteiten the class holds at all (Art. IX.2).
 */
function Klasrij({
  klas,
  onBewerk,
  onVerwijder,
}: {
  klas: KlasWeergave;
  onBewerk: () => void;
  onVerwijder: () => void;
}) {
  // Every klas states a leeftijd now, so a missing one means exactly one thing: a row written before that was
  // required, which nobody has edited since. `mogelijkeJaarfasen` no longer distinguishes anything (it is the
  // nine codes for every class), so it is not part of this condition any more.
  const teZetten = klas.jaarfase === null;

  return (
    // Stacked on a phone and side by side from `sm`, rather than wrapped. Wrapping kept the two
    // controls on the name's line and let the name break around them, so "L3 derde leerjaar (demo)"
    // read as two lines with a button wedged between them. Measured at 390.
    <div className="flex flex-col gap-3 rounded-kaart border border-lijn bg-kaart p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-inkt">{klas.naam}</p>
        {/* The leeftijd leads, because it is what this row is about: it decides which subthema's and
            activiteiten the class holds. The leerjaar is gone from this line entirely: it is derived from the
            leeftijd now, so printing both would be the same fact twice. */}
        {teZetten ? (
          <>
            <p className="mt-0.5 text-meta text-inkt-zacht">
              {telWoord(klas.aantalSubthemas, "klasbeheer.eenSubthema", "klasbeheer.aantalSubthemas")}
            </p>
            <p className="mt-1.5 inline-flex rounded-veld bg-attentie-zacht px-2 py-1 text-meta font-medium text-attentie-inkt">
              {t("klasbeheer.leeftijdOntbreekt")}
            </p>
          </>
        ) : (
          /* `jaarFasen` and not `jaarfase`: this says what the class is MEASURED against, which for a class
             written before the leeftijd was required is whatever its leerjaar can still say. The two are the
             same string exactly when the school has recorded one. */
          <p className="mt-0.5 text-meta text-inkt-zacht">
            {t("klasbeheer.leeftijdIs", { fasen: klas.jaarFasen.join(", ") })}
            {" · "}
            {telWoord(klas.aantalSubthemas, "klasbeheer.eenSubthema", "klasbeheer.aantalSubthemas")}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Knop rang="rustig" className="h-9 min-h-9 px-3 text-meta" onClick={onBewerk}>
          {teZetten ? t("klasbeheer.leeftijdInstellen") : t("themabeheer.bewerk")}
        </Knop>
        <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={onVerwijder}>
          {t("themabeheer.verwijder")}
        </Knop>
      </div>
    </div>
  );
}
