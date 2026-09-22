import { useId, useMemo, useState, type FormEvent } from "react";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Aandachtsmelding } from "../../components/ui/Aandachtsmelding";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Blad } from "../../components/ui/Blad";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Knop } from "../../components/ui/Knop";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Bewerkknop, Verwijderknop } from "../../components/ui/Rijknoppen";
import { Invoer, Veld } from "../../components/ui/Veld";
import { IcoonPlus } from "../../components/Iconen";
import { useRechten } from "../../lib/rechten";
import { t, telWoord } from "../../i18n";
import { Foutregel } from "./Foutregel";
import { foutzin } from "./rapporthulp";
import { Rapportwissel } from "./Rapportwissel";
import {
  useKandidaatsubdoelen,
  useMaakRapportdoel,
  useOrdenRapportdoelen,
  useRapportdoelen,
  useVerwijderRapportdoel,
  useWijzigRapportdoel,
  verschoven,
  type Rapportdoel,
  type Rapportsubdoel,
} from "./rapportset";
import { Verschuifknop } from "./Verschuifknop";

/**
 * The one K3 set of rapportdoelen (FB-002, FR-13.2, ADR-0035 R3, R4, R7): each a titel and the decided K3 subdoelen it
 * bundles, in the order the report will show them.
 *
 * **What a parent sees is the titel; the subdoelen are for the teacher** (R11). So a row leads with the titel and keeps
 * its subdoelen folded under a count, opened when someone wants to check what the titel covers.
 *
 * **Only decided K3 subdoelen can be chosen, and one that stops being that leaves** (D11, D12, D3). The server filters
 * both the picker and the list, so this screen shows what it is given and adds no rule of its own.
 *
 * **Rights as the sterrenschaal:** a K3 leerkracht in a running schooljaar changes the set, everyone else views it (R6,
 * R31, D4). Picking is done in a sheet: the pool of subdoelen can run to a hundred, which a row cannot hold.
 */
export function RapportdoelenScherm() {
  const { mag, bekend } = useRechten();
  const magBewerken = mag.rapportsetBewerken;
  const rapportdoelen = useRapportdoelen();
  const orden = useOrdenRapportdoelen();
  const verwijder = useVerwijderRapportdoel();

  const [blad, setBlad] = useState<{ rapportdoel?: Rapportdoel } | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<Rapportdoel | null>(null);
  const lijst = rapportdoelen.data ?? [];

  const verschuif = (index: number, richting: -1 | 1) => {
    const volgorde = verschoven(
      lijst.map((rapportdoel) => rapportdoel.id),
      index,
      richting,
    );
    if (volgorde) orden.mutate(volgorde);
  };

  const melding = verwijder.isError
    ? foutzin(verwijder.error, "ontwikkelingsrapport.verwijderMislukt")
    : orden.isError
      ? foutzin(orden.error, "ontwikkelingsrapport.ordenMislukt")
      : null;

  return (
    <>
      <Schermkop titel={t("ontwikkelingsrapport.titel")} smal zonderKat onder={<Rapportwissel />} />

      <Schermvlak smal>
        <section aria-labelledby="set-titel" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="set-titel" className="font-display text-hoofdstuk text-inkt">
                {t("ontwikkelingsrapport.rapportdoelen")}
              </h2>
              <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.setUitleg")}</p>
              {bekend && !magBewerken ? (
                <p className="text-meta text-inkt-zacht">{t("ontwikkelingsrapport.setAlleenBekijken")}</p>
              ) : null}
            </div>
            {magBewerken ? (
              <Knop rang="rustig" className="h-9 min-h-9 px-3 text-meta" onClick={() => setBlad({})}>
                <IcoonPlus aria-hidden="true" className="h-4 w-4" />
                {t("ontwikkelingsrapport.rapportdoelToevoegen")}
              </Knop>
            ) : null}
          </div>

          {rapportdoelen.isPending ? (
            <Laadlijst rijen={3} />
          ) : rapportdoelen.isError ? (
            <Foutregel zin={t("ontwikkelingsrapport.setLaadFout")} />
          ) : lijst.length === 0 ? (
            <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.geenRapportdoelen")}</p>
          ) : (
            <ol className="divide-y divide-lijn rounded-kaart border border-lijn bg-kaart">
              {lijst.map((rapportdoel, index) => (
                // The titel and the row buttons share the first line; the subdoelen span the whole row below them.
                // Beside the buttons the unfolded list squeezed into a column a word wide at 390px.
                <li key={rapportdoel.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3">
                  <p className="break-words text-body font-medium text-inkt">{rapportdoel.titel}</p>
                  {magBewerken ? (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Verschuifknop
                        richting="hoger"
                        label={t("ontwikkelingsrapport.hogerZetten", { naam: rapportdoel.titel })}
                        disabled={index === 0 || orden.isPending}
                        onClick={() => verschuif(index, -1)}
                      />
                      <Verschuifknop
                        richting="lager"
                        label={t("ontwikkelingsrapport.lagerZetten", { naam: rapportdoel.titel })}
                        disabled={index === lijst.length - 1 || orden.isPending}
                        onClick={() => verschuif(index, 1)}
                      />
                      <Bewerkknop
                        label={t("ontwikkelingsrapport.wijzigRapportdoel", { naam: rapportdoel.titel })}
                        onClick={() => setBlad({ rapportdoel })}
                      />
                      <Verwijderknop
                        label={t("ontwikkelingsrapport.verwijderRapportdoel", { naam: rapportdoel.titel })}
                        onClick={() => {
                          verwijder.reset();
                          setTeVerwijderen(rapportdoel);
                        }}
                      />
                    </div>
                  ) : null}
                  {rapportdoel.subdoelen.length === 0 ? (
                    <p className="col-span-full mt-0.5 text-meta text-inkt-zacht">{t("ontwikkelingsrapport.geenSubdoelen")}</p>
                  ) : (
                    <details className="col-span-full mt-0.5">
                      <summary className="cursor-pointer text-meta text-inkt-zacht hover:text-inkt">
                        {telWoord(
                          rapportdoel.subdoelen.length,
                          "ontwikkelingsrapport.eenSubdoel",
                          "ontwikkelingsrapport.aantalSubdoelen",
                        )}
                      </summary>
                      <ul className="mt-2 flex flex-col gap-2">
                        {rapportdoel.subdoelen.map((subdoel) => (
                          <li key={subdoel.id}>
                            <Subdoelregel subdoel={subdoel} />
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}

          {melding ? <Aandachtsmelding>{melding}</Aandachtsmelding> : null}
        </section>
      </Schermvlak>

      {blad && magBewerken ? (
        <Rapportdoelblad
          // Keyed on the rapportdoel, so reopening the sheet for another one starts from its own titel and subdoelen.
          key={blad.rapportdoel?.id ?? "nieuw"}
          rapportdoel={blad.rapportdoel}
          onSluit={() => setBlad(null)}
        />
      ) : null}

      <Bevestiging
        open={teVerwijderen !== null}
        titel={t("ontwikkelingsrapport.verwijderRapportdoelTitel", { naam: teVerwijderen?.titel ?? "" })}
        gevolg={t("ontwikkelingsrapport.verwijderRapportdoelGevolg")}
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
 * One subdoel: its doelsoort, code and text, and where in the school's own content it comes from. No status dot. Also
 * what a report shows under a rapportdoel, for the teacher (FB-003).
 */
export function Subdoelregel({ subdoel }: { subdoel: Rapportsubdoel }) {
  return (
    <div className="flex items-start gap-2">
      <Doelsoortmerk soort={subdoel.doelsoort} className="mt-0.5" />
      <div className="min-w-0">
        <p className="break-words text-meta text-inkt">
          <span className="mono text-inkt-zacht">{subdoel.leerplandoelCode}</span> {subdoel.leerplandoelTekst}
        </p>
        <p className="text-micro text-inkt-zwak">
          {t("ontwikkelingsrapport.plaats", { thema: subdoel.themaNaam, subthema: subdoel.subthemaNaam })}
        </p>
      </div>
    </div>
  );
}

/**
 * A rapportdoel's titel and its subdoelen, new or existing, in a sheet. The pool is every decided K3 subdoel, grouped by
 * thema and subthema as a teacher knows them, with a search over code, text and names.
 */
function Rapportdoelblad({ rapportdoel, onSluit }: { rapportdoel?: Rapportdoel; onSluit: () => void }) {
  const formulier = useId();
  const kandidaten = useKandidaatsubdoelen(true);
  const maak = useMaakRapportdoel();
  const wijzig = useWijzigRapportdoel();
  const actie = rapportdoel ? wijzig : maak;

  const [titel, setTitel] = useState(rapportdoel?.titel ?? "");
  const [gekozen, setGekozen] = useState<Set<string>>(
    () => new Set(rapportdoel?.subdoelen.map((subdoel) => subdoel.id) ?? []),
  );
  const [zoek, setZoek] = useState("");
  const [fout, setFout] = useState<string | null>(null);

  const groepen = useMemo(() => groepeer(kandidaten.data ?? [], zoek), [kandidaten.data, zoek]);

  function wissel(id: string) {
    // "Kies minstens één subdoel." stops being true the moment one is ticked, so it goes; a titel error stays.
    setFout((vorig) => (vorig === t("ontwikkelingsrapport.subdoelVerplicht") ? null : vorig));
    setGekozen((vorig) => {
      const nieuw = new Set(vorig);
      if (nieuw.has(id)) nieuw.delete(id);
      else nieuw.add(id);
      return nieuw;
    });
  }

  function bewaar(e: FormEvent) {
    e.preventDefault();
    const schoon = titel.trim();
    if (schoon === "") {
      setFout(t("ontwikkelingsrapport.titelVerplicht"));
      return;
    }
    // At least one subdoel, on a new rapportdoel and on an existing one (owner, 2026-09-15). The server refuses it in
    // the same words; this only saves the round trip.
    if (gekozen.size === 0) {
      setFout(t("ontwikkelingsrapport.subdoelVerplicht"));
      return;
    }
    setFout(null);
    const invoer = { titel: schoon, subdoelIds: [...gekozen] };
    if (rapportdoel) wijzig.mutate({ id: rapportdoel.id, invoer }, { onSuccess: onSluit });
    else maak.mutate(invoer, { onSuccess: onSluit });
  }

  const zin = fout ?? (actie.isError ? foutzin(actie.error, "ontwikkelingsrapport.bewaarMislukt") : null);

  return (
    <Blad
      open
      onOpenChange={(open) => !open && onSluit()}
      titel={rapportdoel ? t("ontwikkelingsrapport.rapportdoelWijzigen") : t("ontwikkelingsrapport.nieuwRapportdoel")}
      maat="breed"
      voet={
        <div className="flex items-center gap-2">
          <Knop rang="hoofd" type="submit" form={formulier} disabled={actie.isPending}>
            {actie.isPending ? t("algemeen.bezig") : t("themabeheer.bewaar")}
          </Knop>
          <Knop rang="stil" disabled={actie.isPending} onClick={onSluit}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <form id={formulier} onSubmit={bewaar} noValidate className="flex flex-col gap-4">
        <Veld label={t("ontwikkelingsrapport.titelVeld")}>
          {(id) => <Invoer id={id} value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={120} />}
        </Veld>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-meta font-medium text-inkt-zacht">
            <span>{t("ontwikkelingsrapport.subdoelenKiezen")}</span>
            <span className="font-normal">{t("ontwikkelingsrapport.gekozen", { aantal: gekozen.size })}</span>
          </legend>
          <Veld label={t("ontwikkelingsrapport.zoekSubdoel")}>
            {(id) => <Invoer id={id} type="search" value={zoek} onChange={(e) => setZoek(e.target.value)} />}
          </Veld>

          {kandidaten.isPending ? (
            <Laadlijst rijen={3} />
          ) : kandidaten.isError ? (
            <Foutregel zin={t("ontwikkelingsrapport.kandidatenLaadFout")} />
          ) : (kandidaten.data ?? []).length === 0 ? (
            <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.geenKandidaten")}</p>
          ) : groepen.length === 0 ? (
            <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.geenZoekresultaat")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {groepen.map((groep) => (
                <div key={groep.sleutel} className="flex flex-col gap-1">
                  <p className="text-micro font-semibold text-inkt-zacht">
                    {t("ontwikkelingsrapport.plaats", { thema: groep.thema, subthema: groep.subthema })}
                  </p>
                  <ul className="flex flex-col">
                    {groep.subdoelen.map((subdoel) => (
                      <li key={subdoel.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-veld px-2 py-2 hover:bg-vlak">
                          <input
                            type="checkbox"
                            checked={gekozen.has(subdoel.id)}
                            onChange={() => wissel(subdoel.id)}
                            className="mt-1 h-4 w-4 shrink-0 accent-inkt"
                          />
                          <span className="flex min-w-0 items-start gap-2">
                            <Doelsoortmerk soort={subdoel.doelsoort} className="mt-0.5" />
                            <span className="min-w-0 break-words text-meta text-inkt">
                              <span className="mono text-inkt-zacht">{subdoel.leerplandoelCode}</span>{" "}
                              {subdoel.leerplandoelTekst}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        {zin ? <Foutregel zin={zin} /> : null}
      </form>
    </Blad>
  );
}

/** The pool grouped by thema and subthema in the server's order, narrowed to what matches the search. */
function groepeer(kandidaten: readonly Rapportsubdoel[], zoek: string) {
  const woord = zoek.trim().toLocaleLowerCase("nl");
  const past = (subdoel: Rapportsubdoel) =>
    woord === "" ||
    [subdoel.leerplandoelCode, subdoel.leerplandoelTekst, subdoel.themaNaam, subdoel.subthemaNaam].some((veld) =>
      veld.toLocaleLowerCase("nl").includes(woord),
    );

  const groepen: { sleutel: string; thema: string; subthema: string; subdoelen: Rapportsubdoel[] }[] = [];
  for (const subdoel of kandidaten.filter(past)) {
    // The pair as JSON, so no separator character can collide with a name and no control byte sits in the source.
    const sleutel = JSON.stringify([subdoel.themaNaam, subdoel.subthemaNaam]);
    const laatste = groepen[groepen.length - 1];
    if (laatste?.sleutel === sleutel) laatste.subdoelen.push(subdoel);
    else groepen.push({ sleutel, thema: subdoel.themaNaam, subthema: subdoel.subthemaNaam, subdoelen: [subdoel] });
  }
  return groepen;
}
