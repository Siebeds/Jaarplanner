import { Fragment, useId, useState } from "react";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Knop } from "../../components/ui/Knop";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Keuze } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonPlus } from "../../components/Iconen";
import { useActieveSelectie } from "../../lib/selectie";
import { useJaarfasen } from "../../lib/queries";
import { ApiError } from "../../lib/api";
import type { KlasWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { Onderdeelwissel } from "./Instellingenindeling";
import { Rechtenblad } from "./Rechtenblad";
import { Uitnodigingsblad } from "./Uitnodigingsblad";
import { useGebruikersOverzicht, useVerwijderGebruiker, type GebruikerBeheer } from "./gebruikerbeheer";

/**
 * Instellingen, Gebruikers (E6-04, FA FR-12.2): who may log in, and what each person may do.
 * Directie only (ADR-0030 §3); the part is hidden for anyone else and the server refuses them.
 *
 * **Person-centric.** One row per gebruiker, name first, then the facts as quiet meta text: the
 * rights as words (never a colour), their klassen and hoofdleerkracht jaarfasen in the chosen
 * schooljaar, and "nog niet aangemeld" for an invitation no login has bound yet. That last state is
 * the residual risk of ADR-0031 decision 3 (a sign-in name reassigned before the first login binds to
 * whoever holds it then), and this text is the only place directie can see it. One button per row
 * opens one sheet where everything about that person is changed.
 *
 * **Once above the list**, never per row: the schooljaar, the one primary action, the hoofdleerkracht
 * of each jaarfase (ADR-0030 (c): a jaarfase without one leaves its subthema's to directie), and, for
 * a year that has ended, that its klassen and appointments no longer count (R20).
 */
export function GebruikersScherm() {
  const { schooljaar, schooljaren, klassen, kiesSchooljaar } = useActieveSelectie();
  const overzicht = useGebruikersOverzicht(true);
  const { data: jaarfasen } = useJaarfasen();
  const verwijder = useVerwijderGebruiker();

  const [uitnodigen, setUitnodigen] = useState(false);
  const [rechtenVoor, setRechtenVoor] = useState<string | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<GebruikerBeheer | null>(null);

  const gebruikers = overzicht.data?.gebruikers ?? [];
  const jaarId = schooljaar?.id ?? null;
  // From the server's clock, not the browser's: "voorbij" is the rights' own rule (R20).
  const voorbij = jaarId !== null && (overzicht.data?.voorbijeSchooljaarIds ?? []).includes(jaarId);
  // Read from the live list, so the sheet shows what the server answered after every tick.
  const geopend = rechtenVoor === null ? null : (gebruikers.find((g) => g.id === rechtenVoor) ?? null);

  return (
    <>
      <Schermkop titel={t("instellingen.gebruikers")} smal onder={<Onderdeelwissel />} />

      <Schermvlak smal>
        <div className="flex flex-col gap-3">
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

            <Knop
              rang="hoofd"
              className="h-9 min-h-9 px-3 text-meta"
              onClick={() => setUitnodigen(true)}
            >
              <IcoonPlus aria-hidden="true" className="h-4 w-4" />
              {t("gebruikers.uitnodigen")}
            </Knop>
          </div>

          {overzicht.isPending ? (
            <Laadlijst rijen={3} />
          ) : overzicht.isError ? (
            <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {t("gebruikers.laadMislukt")}
            </p>
          ) : (
            <>
              <Hoofdleerkrachtregels
                gebruikers={gebruikers}
                jaarId={jaarId}
                klassen={klassen}
                volgorde={jaarfasen ?? []}
              />

              {voorbij ? (
                <p className="rounded-veld border border-lijn bg-vlak-diep px-3 py-2 text-meta text-inkt-zacht">
                  {t("gebruikers.jaarVoorbij")}
                </p>
              ) : null}

              {gebruikers.length === 0 ? (
                <p className="text-body text-inkt-zacht">{t("gebruikers.geenGebruikers")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {gebruikers.map((gebruiker) => (
                    <li key={gebruiker.id}>
                      <Gebruikerrij
                        gebruiker={gebruiker}
                        jaarId={jaarId}
                        onRechten={() => setRechtenVoor(gebruiker.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* The removal the server refused, with its reason: the last directie (ADR-0031 decision 7). Under
              the list because the dialog is closed by then and the row it is about is still on screen. */}
          {verwijder.isError ? (
            <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {verwijder.error instanceof ApiError && verwijder.error.detail
                ? verwijder.error.detail
                : t("gebruikers.verwijderMislukt")}
            </p>
          ) : null}
        </div>
      </Schermvlak>

      {uitnodigen ? (
        <Uitnodigingsblad
          onSluit={() => setUitnodigen(false)}
          onUitgenodigd={(gebruiker) => {
            // Straight on to what the new person may do: an invitation with no rights is rarely the goal.
            setUitnodigen(false);
            setRechtenVoor(gebruiker.id);
          }}
        />
      ) : null}

      {geopend ? (
        <Rechtenblad
          key={geopend.id}
          gebruiker={geopend}
          schooljaar={schooljaar}
          klassen={klassen}
          jaarfasen={jaarfasen ?? []}
          voorbij={voorbij}
          onSluit={() => setRechtenVoor(null)}
          onVerwijder={() => {
            verwijder.reset();
            setRechtenVoor(null);
            setTeVerwijderen(geopend);
          }}
        />
      ) : null}

      <Bevestiging
        open={teVerwijderen !== null}
        titel={t("gebruikers.verwijderTitel", { naam: teVerwijderen?.naam ?? "" })}
        gevolg={t("gebruikers.verwijderGevolg", { naam: teVerwijderen?.naam ?? "" })}
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijder.isPending}
        onSluit={() => setTeVerwijderen(null)}
        onBevestig={() => {
          if (!teVerwijderen) return;
          verwijder.mutate(teVerwijderen.id, { onSettled: () => setTeVerwijderen(null) });
        }}
      />
    </>
  );
}

/**
 * One gebruiker: the name, the sign-in name, and what they hold in the chosen schooljaar. The
 * directie and themabeheer rights hold in every year, so they are shown whatever year is chosen.
 */
function Gebruikerrij({
  gebruiker,
  jaarId,
  onRechten,
}: {
  gebruiker: GebruikerBeheer;
  jaarId: string | null;
  onRechten: () => void;
}) {
  const feiten: string[] = [];
  if (gebruiker.isDirectie) feiten.push(t("gebruikers.directie"));
  if (gebruiker.heeftThemabeheer) feiten.push(t("gebruikers.themabeheer"));

  const klassen = gebruiker.klastoewijzingen.filter((k) => k.schooljaarId === jaarId).map((k) => k.klasNaam);
  if (klassen.length === 1) feiten.push(t("gebruikers.eenKlas", { namen: klassen[0] }));
  else if (klassen.length > 1) feiten.push(t("gebruikers.klassen", { namen: klassen.join(", ") }));

  const fasen = gebruiker.hoofdleerkrachtaanstellingen.filter((a) => a.schooljaarId === jaarId).map((a) => a.jaarfase);
  if (fasen.length > 0) feiten.push(t("gebruikers.hoofdleerkrachtVan", { fasen: fasen.join(", ") }));

  return (
    <div className="flex flex-col gap-3 rounded-kaart border border-lijn bg-kaart p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-inkt">{gebruiker.naam}</p>
        <p className="mt-0.5 text-meta text-inkt-zacht">
          <span className="break-all">{gebruiker.email}</span>
          {gebruiker.isAangemeld ? null : (
            <>
              {" · "}
              <span className="font-medium text-inkt">{t("gebruikers.nietAangemeld")}</span>
            </>
          )}
        </p>
        {feiten.length > 0 ? <p className="mt-0.5 text-meta text-inkt-zacht">{feiten.join(" · ")}</p> : null}
      </div>

      <Knop
        rang="rustig"
        className="h-9 min-h-9 shrink-0 self-start px-3 text-meta"
        aria-label={t("gebruikers.rechtenVan", { naam: gebruiker.naam })}
        onClick={onRechten}
      >
        {t("gebruikers.rechten")}
      </Knop>
    </div>
  );
}

/**
 * Who is hoofdleerkracht of each jaarfase in the chosen schooljaar, once above the list. Only a
 * jaarfase that has a klas this year, or an appointment, gets a line.
 *
 * **A jaarfase with nobody says so in two ways, and only one of them carries the (c) sentence.**
 * An appointment counts until its schooljaar ends, including next year's (R20), so a jaarfase with
 * nobody THIS year may still have a hoofdleerkracht today through another year. That line says
 * "niemand in dit schooljaar" and nothing more; only a jaarfase with no appointment that counts
 * anywhere says "geen hoofdleerkracht", and the sentence under the list is shown only when one does
 * (the E5-03 rule: it asserts only what its condition proves).
 */
function Hoofdleerkrachtregels({
  gebruikers,
  jaarId,
  klassen,
  volgorde,
}: {
  gebruikers: GebruikerBeheer[];
  jaarId: string | null;
  klassen: KlasWeergave[];
  volgorde: string[];
}) {
  const kopId = useId();
  if (jaarId === null) return null;

  const codes = new Set<string>();
  for (const klas of klassen) if (klas.jaarfase) codes.add(klas.jaarfase);
  for (const gebruiker of gebruikers) {
    for (const aanstelling of gebruiker.hoofdleerkrachtaanstellingen) {
      if (aanstelling.schooljaarId === jaarId) codes.add(aanstelling.jaarfase);
    }
  }
  if (codes.size === 0) return null;

  const geordend = [
    ...volgorde.filter((code) => codes.has(code)),
    ...[...codes].filter((code) => !volgorde.includes(code)).sort(),
  ];
  const regels = geordend.map((code) => {
    const namen = gebruikers
      .filter((g) => g.hoofdleerkrachtaanstellingen.some((a) => a.schooljaarId === jaarId && a.jaarfase === code))
      .map((g) => g.naam);
    const elders =
      namen.length === 0 &&
      gebruikers.some((g) => g.hoofdleerkrachtaanstellingen.some((a) => a.jaarfase === code && a.teltVoorGedeeldeInhoud));
    return { code, namen, elders };
  });
  const zonder = regels.some((regel) => regel.namen.length === 0 && !regel.elders);

  return (
    <section aria-labelledby={kopId} className="rounded-kaart border border-lijn bg-kaart p-4">
      <h2 id={kopId} className="text-meta font-medium text-inkt">
        {t("gebruikers.hoofdleerkrachten")}
      </h2>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-meta">
        {regels.map((regel) => (
          <Fragment key={regel.code}>
            <dt className="font-medium text-inkt">{regel.code}</dt>
            <dd className="text-inkt-zacht">
              {regel.namen.length > 0
                ? regel.namen.join(", ")
                : regel.elders
                  ? t("gebruikers.niemandDitJaar")
                  : t("gebruikers.geenHoofdleerkracht")}
            </dd>
          </Fragment>
        ))}
      </dl>
      {zonder ? <p className="mt-2 text-meta text-inkt-zacht">{t("gebruikers.zonderHoofdleerkracht")}</p> : null}
    </section>
  );
}
