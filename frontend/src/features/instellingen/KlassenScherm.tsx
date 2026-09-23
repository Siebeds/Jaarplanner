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
import { useGeenKlassenZin, useRechten } from "../../lib/rechten";
import { t, telWoord } from "../../i18n";
import type { KlasWeergave } from "../../lib/types";
import { Klasformulier } from "./Klasformulier";
import { Onderdeelwissel } from "./Instellingenindeling";
import { useGebruikersOverzicht, type GebruikerBeheer } from "./gebruikerbeheer";
import { useMaakKlas, useVerwijderKlas, useWijzigKlasVolledig } from "./mutaties";

/**
 * Instellingen, Klassen: which classes the school has and which age each one teaches.
 *
 * **Its own page since 2026-09-11**, when the owner split Instellingen into parts and asked for
 * bigger titles. It was the first section of one long screen, under an 11px uppercase label; the
 * part's name is now the page title, in the display face. The other parts are one press away: in the
 * column beside it from `lg`, in the switch under the title below that.
 *
 * **A klas is defined here and chosen everywhere else.** The Klaskiezer in the navigation answers "which
 * class am I looking at"; this answers "which classes exist and what is each one". Keeping the two
 * apart is why this screen is not a sheet hanging off the picker.
 *
 * **The leeftijd is the reason this part exists** (owner, 2026-08-30). It couples a klas to an age,
 * and an age is what a subthema is scoped to: a subthema on K3 holds for every K3 class, while each
 * of those classes keeps its own dagplanning. A class whose age is unset cannot be told which
 * subthema's are its own, so an unset one is not merely blank here, it is called out.
 *
 * **A klas states its leeftijd and nothing else about its level.** The leerjaar is derived from it
 * server-side, so it appears nowhere on this screen: printing both would be one fact twice.
 *
 * **Admin defines the klassen; everyone else reads them** (E6-04, ADR-0030 §3 "Gebruikers,
 * klassen en schooljaren beheren", admin only). For anyone else there is no add, edit or delete:
 * the matrix gives those to admin alone, and the server refuses them on the klas routes (E6-02
 * slice 3). A button the matrix does not grant would be a control that does nothing (the E3-06
 * rule). Admin also sees who teaches each klas, read from the beheer data, which only admin
 * may read. The answer is `mag.beheer` from `lib/rechten.ts` (slice 4). *Until slice 3 this said the
 * routes still admitted any session; that clause is struck because it stopped being true.*
 */
export function KlassenScherm() {
  const { schooljaar, schooljaren, klassen, laadt, kiesSchooljaar } = useActieveSelectie();
  const [formulier, setFormulier] = useState<{ klas?: KlasWeergave } | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<KlasWeergave | null>(null);

  const { mag } = useRechten();
  // The list holds only the klassen this gebruiker may read (FB-013), so "no klassen" is said for them.
  const geenKlassenZin = useGeenKlassenZin(t("klasbeheer.geenKlassen"));
  const isAdmin = mag.beheer;
  const beheer = useGebruikersOverzicht(isAdmin);
  const leerkrachten = leerkrachtenPerKlas(beheer.data?.gebruikers);

  const { data: jaarfasen } = useJaarfasen();
  const maak = useMaakKlas(schooljaar?.id ?? null);
  const wijzig = useWijzigKlasVolledig();
  const verwijder = useVerwijderKlas();

  const bezig = formulier?.klas ? wijzig.isPending : maak.isPending;
  const fout = formulier?.klas ? wijzig.error : maak.error;

  return (
    <>
      <Schermkop titel={t("instellingen.klassen")} smal onder={<Onderdeelwissel />} />

      <Schermvlak smal>
        <div className="flex flex-col gap-3">
          {/* The context on the left and the action on the right, the same row Hoeken opens with.
              Once above the list, never per row: which school year these classes belong to is the
              same fact for every one of them. Changing it here changes it for the whole app, which is
              what the header's picker does too, so there is one context and not two. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
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

            {isAdmin ? (
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
            ) : null}
          </div>

          {laadt ? (
            <Laadlijst rijen={3} />
          ) : klassen.length === 0 ? (
            <p className="text-body text-inkt-zacht">{geenKlassenZin}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {klassen.map((klas) => (
                <li key={klas.id}>
                  <Klasrij
                    klas={klas}
                    leerkrachten={leerkrachten ? (leerkrachten.get(klas.id) ?? []) : undefined}
                    onBewerk={
                      isAdmin
                        ? () => {
                            wijzig.reset();
                            setFormulier({ klas });
                          }
                        : undefined
                    }
                    onVerwijder={
                      isAdmin
                        ? () => {
                            verwijder.reset();
                            setTeVerwijderen(klas);
                          }
                        : undefined
                    }
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
 * it is what decides which subthema's and activiteiten the class holds at all (Art. IX.2). Since
 * E6-04 it also decides rights: a klas without a stated leeftijd gives its leerkrachten no right on
 * the shared content (ADR-0030 I12), which the same callout says rather than a second one.
 */
function Klasrij({
  klas,
  leerkrachten,
  onBewerk,
  onVerwijder,
}: {
  klas: KlasWeergave;
  /** Who teaches it, by name; undefined when this person may not see that (not admin). */
  leerkrachten?: string[];
  /** Absent for anyone but admin: the row is then read-only. */
  onBewerk?: () => void;
  onVerwijder?: () => void;
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
            <div className="mt-1.5 inline-flex flex-col rounded-veld bg-attentie-zacht px-2 py-1 text-meta text-attentie-inkt">
              <p className="font-medium">{t("klasbeheer.leeftijdOntbreekt")}</p>
              <p>{t("klasbeheer.geenLeeftijdsrechten")}</p>
            </div>
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
        {leerkrachten ? (
          <p className="mt-0.5 text-meta text-inkt-zacht">
            {leerkrachten.length === 0
              ? t("klasbeheer.geenLeerkracht")
              : leerkrachten.length === 1
                ? t("klasbeheer.eenLeerkracht", { namen: leerkrachten[0] })
                : t("klasbeheer.leerkrachten", { namen: leerkrachten.join(", ") })}
          </p>
        ) : null}
      </div>

      {onBewerk || onVerwijder ? (
        <div className="flex shrink-0 items-center gap-2">
          {onBewerk ? (
            <Knop rang="rustig" className="h-9 min-h-9 px-3 text-meta" onClick={onBewerk}>
              {teZetten ? t("klasbeheer.leeftijdInstellen") : t("themabeheer.bewerk")}
            </Knop>
          ) : null}
          {onVerwijder ? (
            <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={onVerwijder}>
              {t("themabeheer.verwijder")}
            </Knop>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Who teaches each klas, by name, in the order the server sorts gebruikers (by name). `undefined`
 * when the beheer data is not there, which for anyone but admin is always: the row then says
 * nothing about leerkrachten rather than "nog geen leerkracht", which would be false.
 */
function leerkrachtenPerKlas(gebruikers: GebruikerBeheer[] | undefined): Map<string, string[]> | undefined {
  if (!gebruikers) return undefined;
  const perKlas = new Map<string, string[]>();
  for (const gebruiker of gebruikers) {
    for (const toewijzing of gebruiker.klastoewijzingen) {
      perKlas.set(toewijzing.klasId, [...(perKlas.get(toewijzing.klasId) ?? []), gebruiker.naam]);
    }
  }
  return perKlas;
}
