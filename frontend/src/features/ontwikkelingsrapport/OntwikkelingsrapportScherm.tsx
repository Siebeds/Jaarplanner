import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Aandachtsmelding } from "../../components/ui/Aandachtsmelding";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Knop } from "../../components/ui/Knop";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Leegte } from "../../components/ui/Leegte";
import { Bewerkknop, Verwijderknop } from "../../components/ui/Rijknoppen";
import { Invoer, Keuze, Veld } from "../../components/ui/Veld";
import { IcoonPlus } from "../../components/Iconen";
import { geenToegangZin, useRechten } from "../../lib/rechten";
import { useActieveSelectie } from "../../lib/selectie";
import type { KlasWeergave } from "../../lib/types";
import { t, telWoord, type Vertaalsleutel } from "../../i18n";
import {
  useLeerlingen,
  useMaakLeerling,
  useVerwijderLeerling,
  useWijzigLeerling,
  type Leerling,
  type LeerlingInvoer,
} from "./leerlingen";
import { Foutregel } from "./Foutregel";
import { rapportadres } from "./rapportdelen";
import { foutzin } from "./rapporthulp";
import { Rapportwissel } from "./Rapportwissel";

/**
 * The K3 ontwikkelingsrapport (FR-13, ADR-0035), starting where it starts: the children of the klas (FR-13.1, FB-001).
 *
 * **Only a klas that can hold children, and only one this gebruiker may read.** The klas choice here lists exactly
 * those: a klas the server says can hold children (`kanLeerlingenHebben`, from its one klas→leeftijden mapping, D9),
 * that the gebruiker teaches or, for directie, any. The screen never compares a jaarfase to "K3" itself: that would be
 * a second mapping, and directie's graadklas decision (Art. XIV) would then have to change this file as well
 * (antagonist round 1). It is not the header's Klaskiezer, which lists every klas, because a colleague's klas
 * here would be a klas whose children this person may not see (R17). Choosing one still sets the app's one klas, so
 * the agenda opens on it afterwards.
 *
 * **Typing twenty names at the start of the year is the job this screen is shaped around** (R15: by hand, one at a
 * time). The two fields sit above the list, and after each child they empty and take the focus again, so the next name
 * follows without reaching for the mouse.
 *
 * **Nothing about a child but the two names** (Art. VI.7): no other field, and the fields ask the browser not to
 * remember what was typed in them.
 *
 * **After the schooljaar the klas's leerkrachten only read** (R26); directie still does everything. The one sentence
 * that explains it is shown only when that is the reason (`mag.rapportAlleenNogLezen`).
 */
export function OntwikkelingsrapportScherm() {
  const { mag, laadt: rechtenLaden, bekend } = useRechten();
  const { schooljaar, schooljaren, klassen, klasId, laadt, fout, kiesSchooljaar, kiesKlas } = useActieveSelectie();

  const rapportklassen = klassen.filter(
    (kandidaat) => kandidaat.kanLeerlingenHebben && mag.ontwikkelingsrapportLezen(kandidaat.id),
  );
  const klas = rapportklassen.find((kandidaat) => kandidaat.id === klasId) ?? rapportklassen[0] ?? null;
  const toegang = bekend && mag.ontwikkelingsrapportZien;

  return (
    <>
      <Schermkop
        titel={t("ontwikkelingsrapport.titel")}
        smal
        onder={
          <div className="flex flex-col gap-3">
            <Rapportwissel />
            {toegang ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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
              {klas ? (
                <label className="flex flex-wrap items-center gap-2 text-meta text-inkt-zacht">
                  {t("context.klas")}
                  <Keuze value={klas.id} onChange={(e) => kiesKlas(e.target.value)} className="w-auto">
                    {rapportklassen.map((kandidaat) => (
                      <option key={kandidaat.id} value={kandidaat.id}>
                        {kandidaat.naam}
                      </option>
                    ))}
                  </Keuze>
                </label>
              ) : null}
            </div>
            ) : null}
          </div>
        }
      />

      <Schermvlak smal>
        {rechtenLaden || (toegang && laadt) ? (
          <Laadlijst rijen={4} />
        ) : !bekend ? (
          // `/api/ik` failed, so nothing is known about this person: saying they have no access would be a guess.
          <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
            {t("ontwikkelingsrapport.rechtenOnbekend")}
          </p>
        ) : !mag.ontwikkelingsrapportZien ? (
          <Leegte titel={t("ontwikkelingsrapport.geenToegang")} />
        ) : fout ? (
          // The schooljaren or the klassen failed their first load: an empty list then proves nothing, so neither
          // sentence below may be said (antagonist round 2, the E5-03 rule). The sentence names neither list, since
          // either one may be the failed one (round 3). A failed refetch keeps its data and does not land here.
          <Foutregel zin={t("ontwikkelingsrapport.selectieLaadFout")} />
        ) : schooljaren.length === 0 ? (
          // No schooljaar at all: "dit schooljaar" below would refer to nothing (antagonist round 1).
          <Leegte titel={t("ontwikkelingsrapport.geenSchooljaar")} />
        ) : klas === null ? (
          // Directie reads every klas that can hold children, so for directie an empty list means the year has none.
          // Anyone else reads only their own, so for them it means they teach none this year.
          <Leegte
            titel={mag.beheer ? t("ontwikkelingsrapport.geenK3Klas") : t("ontwikkelingsrapport.geenEigenK3Klas")}
          />
        ) : (
          <Kinderen key={klas.id} klas={klas} />
        )}
      </Schermvlak>
    </>
  );
}

/** The children of one klas: the list, and for whoever may manage them, adding, renaming and deleting. */
function Kinderen({ klas }: { klas: KlasWeergave }) {
  const { mag } = useRechten();
  const magBeheren = mag.leerlingenBeheren(klas.id);
  const alleenNogLezen = mag.rapportAlleenNogLezen(klas.id);
  const lijst = useLeerlingen(klas.id, true);
  const verwijder = useVerwijderLeerling(klas.id);

  const [bewerkt, setBewerkt] = useState<string | null>(null);
  // The row whose edit just closed, so focus goes back to its own buttons rather than to the top of the page.
  const [terugNaar, setTerugNaar] = useState<string | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<Leerling | null>(null);
  const kinderen = lijst.data ?? [];

  return (
    <section aria-labelledby="kinderen-titel" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="kinderen-titel" className="font-display text-hoofdstuk text-inkt">
          {t("ontwikkelingsrapport.kinderen")}
        </h2>
        {/* Not at nought: the empty list below already says there are none, and "0 kinderen" beside it says it twice. */}
        {lijst.isSuccess && kinderen.length > 0 ? (
          <p className="text-meta text-inkt-zacht">
            {telWoord(kinderen.length, "ontwikkelingsrapport.eenKind", "ontwikkelingsrapport.aantalKinderen")}
          </p>
        ) : null}
      </div>

      {magBeheren ? <Nieuwkind klasId={klas.id} /> : null}
      {alleenNogLezen ? <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.alleenLezen")}</p> : null}

      {lijst.isPending ? (
        <Laadlijst rijen={4} />
      ) : lijst.isError ? (
        <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
          {geenToegangZin(lijst.error) ?? t("ontwikkelingsrapport.laadFout")}
        </p>
      ) : kinderen.length === 0 ? (
        <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.geenKinderen")}</p>
      ) : (
        // One card with a rule between the children, not a card per child: a class list is read down, and twenty
        // bordered boxes would be louder than the names in them.
        <ul className="divide-y divide-lijn rounded-kaart border border-lijn bg-kaart">
          {kinderen.map((kind) => (
            <li key={kind.id}>
              {magBeheren && bewerkt === kind.id ? (
                <Kindbewerking
                  kind={kind}
                  klasId={klas.id}
                  onKlaar={() => {
                    setBewerkt(null);
                    setTerugNaar(kind.id);
                  }}
                />
              ) : (
                <Kindrij
                  kind={kind}
                  focus={terugNaar === kind.id}
                  onBewerk={
                    magBeheren
                      ? () => {
                          setTerugNaar(null);
                          setBewerkt(kind.id);
                        }
                      : undefined
                  }
                  onVerwijder={
                    magBeheren
                      ? () => {
                          verwijder.reset();
                          setTeVerwijderen(kind);
                        }
                      : undefined
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Under the list rather than in the dialog: the dialog has closed by the time the server answers. */}
      {verwijder.isError ? (
        <Aandachtsmelding>{foutzin(verwijder.error, "ontwikkelingsrapport.verwijderenMislukt")}</Aandachtsmelding>
      ) : null}

      <Bevestiging
        open={teVerwijderen !== null}
        titel={t("ontwikkelingsrapport.verwijderTitel", { naam: teVerwijderen ? naamVan(teVerwijderen) : "" })}
        gevolg={t("ontwikkelingsrapport.verwijderGevolg")}
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijder.isPending}
        onSluit={() => setTeVerwijderen(null)}
        onBevestig={() => {
          if (!teVerwijderen) return;
          verwijder.mutate(teVerwijderen.id, { onSettled: () => setTeVerwijderen(null) });
        }}
      />
    </section>
  );
}

/** One child, read-only, with its two row controls for whoever may manage the klas's children. */
function Kindrij({
  kind,
  focus,
  onBewerk,
  onVerwijder,
}: {
  kind: Leerling;
  /** Whether this row's controls take focus: its edit has just closed. */
  focus: boolean;
  onBewerk?: () => void;
  onVerwijder?: () => void;
}) {
  const knoppen = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus) knoppen.current?.querySelector("button")?.focus();
  }, [focus]);
  const naam = naamVan(kind);

  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
      {/* The voornaam carries the weight: it is the name a kleuterleerkracht says all day. */}
      <p className="min-w-0 break-words text-body text-inkt">
        {/* The name opens the child's report (FB-003), with the underline that says it is a link. */}
        <Link
          to={rapportadres(kind.id, 1)}
          className="underline decoration-lijn-sterk underline-offset-4 transition-colors duration-150 hover:decoration-inkt"
        >
          <span className="font-medium">{kind.voornaam}</span> {kind.achternaam}
        </Link>
      </p>
      {onBewerk || onVerwijder ? (
        <div ref={knoppen} className="flex shrink-0 items-center gap-1">
          {onBewerk ? <Bewerkknop label={t("ontwikkelingsrapport.wijzigKind", { naam })} onClick={onBewerk} /> : null}
          {onVerwijder ? (
            <Verwijderknop label={t("ontwikkelingsrapport.verwijderKind", { naam })} onClick={onVerwijder} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Adding a child: two fields and one button, above the list. After a child is added the fields empty and the focus
 * goes back to the voornaam, and a screen reader hears who was added, because the new row appears somewhere in a
 * sorted list rather than where the teacher is looking.
 */
function Nieuwkind({ klasId }: { klasId: string }) {
  const maak = useMaakLeerling(klasId);
  const [invoer, setInvoer] = useState<LeerlingInvoer>({ voornaam: "", achternaam: "" });
  const [fout, setFout] = useState<string | null>(null);
  const [gemeld, setGemeld] = useState("");
  const voornaamVeld = useRef<HTMLInputElement>(null);
  const achternaamVeld = useRef<HTMLInputElement>(null);

  function voegToe(e: FormEvent) {
    e.preventDefault();
    const schoon = { voornaam: invoer.voornaam.trim(), achternaam: invoer.achternaam.trim() };
    const ontbreekt = ontbrekend(schoon);
    if (ontbreekt) {
      setFout(t(ontbreekt.zin));
      (ontbreekt.veld === "voornaam" ? voornaamVeld : achternaamVeld).current?.focus();
      return;
    }
    setFout(null);
    setGemeld("");
    maak.mutate(schoon, {
      onSuccess: () => {
        setInvoer({ voornaam: "", achternaam: "" });
        setGemeld(t("ontwikkelingsrapport.toegevoegd", { naam: naamVan(schoon) }));
        voornaamVeld.current?.focus();
      },
    });
  }

  const zin = fout ?? (maak.isError ? foutzin(maak.error, "ontwikkelingsrapport.toevoegenMislukt") : null);

  return (
    <form onSubmit={voegToe} noValidate className="flex flex-col gap-3 rounded-kaart border border-lijn bg-kaart p-4">
      <Naamvelden
        invoer={invoer}
        onInvoer={setInvoer}
        voornaamVeld={voornaamVeld}
        achternaamVeld={achternaamVeld}
        knoppen={
          <Knop rang="hoofd" type="submit" disabled={maak.isPending}>
            <IcoonPlus aria-hidden="true" className="h-4 w-4" />
            {maak.isPending ? t("algemeen.bezig") : t("ontwikkelingsrapport.toevoegen")}
          </Knop>
        }
      />
      {zin ? <Foutregel zin={zin} /> : null}
      <p aria-live="polite" className="sr-only">
        {gemeld}
      </p>
    </form>
  );
}

/** Renaming a child, in place of its row. Escape or Annuleren puts the row back unchanged. */
function Kindbewerking({ kind, klasId, onKlaar }: { kind: Leerling; klasId: string; onKlaar: () => void }) {
  const wijzig = useWijzigLeerling(klasId);
  const [invoer, setInvoer] = useState<LeerlingInvoer>({ voornaam: kind.voornaam, achternaam: kind.achternaam });
  const [fout, setFout] = useState<string | null>(null);
  const voornaamVeld = useRef<HTMLInputElement>(null);
  const achternaamVeld = useRef<HTMLInputElement>(null);
  useEffect(() => {
    voornaamVeld.current?.focus();
  }, []);

  function bewaar(e: FormEvent) {
    e.preventDefault();
    const schoon = { voornaam: invoer.voornaam.trim(), achternaam: invoer.achternaam.trim() };
    const ontbreekt = ontbrekend(schoon);
    if (ontbreekt) {
      setFout(t(ontbreekt.zin));
      (ontbreekt.veld === "voornaam" ? voornaamVeld : achternaamVeld).current?.focus();
      return;
    }
    setFout(null);
    wijzig.mutate({ leerlingId: kind.id, invoer: schoon }, { onSuccess: onKlaar });
  }

  const zin = fout ?? (wijzig.isError ? foutzin(wijzig.error, "ontwikkelingsrapport.wijzigenMislukt") : null);

  return (
    <form
      onSubmit={bewaar}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onKlaar();
        }
      }}
      noValidate
      className="flex flex-col gap-3 bg-vlak px-4 py-3"
    >
      <Naamvelden
        invoer={invoer}
        onInvoer={setInvoer}
        voornaamVeld={voornaamVeld}
        achternaamVeld={achternaamVeld}
        knoppen={
          <div className="flex items-center gap-2">
            <Knop rang="hoofd" type="submit" disabled={wijzig.isPending}>
              {wijzig.isPending ? t("algemeen.bezig") : t("themabeheer.bewaar")}
            </Knop>
            <Knop rang="stil" disabled={wijzig.isPending} onClick={onKlaar}>
              {t("themabeheer.annuleer")}
            </Knop>
          </div>
        }
      />
      {zin ? <Foutregel zin={zin} /> : null}
    </form>
  );
}

/**
 * The two names, side by side from `sm` with the form's button(s) at the end of the row, stacked on a phone.
 * `autoComplete="off"`: a child's name is not something the browser should offer again in another field.
 */
function Naamvelden({
  invoer,
  onInvoer,
  voornaamVeld,
  achternaamVeld,
  knoppen,
}: {
  invoer: LeerlingInvoer;
  onInvoer: (invoer: LeerlingInvoer) => void;
  voornaamVeld: RefObject<HTMLInputElement | null>;
  achternaamVeld: RefObject<HTMLInputElement | null>;
  knoppen: ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Veld label={t("ontwikkelingsrapport.voornaam")}>
        {(id) => (
          <Invoer
            id={id}
            ref={voornaamVeld}
            value={invoer.voornaam}
            onChange={(e) => onInvoer({ ...invoer, voornaam: e.target.value })}
            autoComplete="off"
            maxLength={100}
          />
        )}
      </Veld>
      <Veld label={t("ontwikkelingsrapport.achternaam")}>
        {(id) => (
          <Invoer
            id={id}
            ref={achternaamVeld}
            value={invoer.achternaam}
            onChange={(e) => onInvoer({ ...invoer, achternaam: e.target.value })}
            autoComplete="off"
            maxLength={100}
          />
        )}
      </Veld>
      {knoppen}
    </div>
  );
}

function naamVan(kind: LeerlingInvoer): string {
  return `${kind.voornaam} ${kind.achternaam}`;
}

/**
 * The first empty name, with the sentence for it. The server refuses an empty name too, with its own sentence, which
 * `foutzin` shows if one ever gets past this check.
 */
function ontbrekend(invoer: LeerlingInvoer): { veld: "voornaam" | "achternaam"; zin: Vertaalsleutel } | null {
  if (invoer.voornaam === "") return { veld: "voornaam", zin: "ontwikkelingsrapport.voornaamVerplicht" };
  if (invoer.achternaam === "") return { veld: "achternaam", zin: "ontwikkelingsrapport.achternaamVerplicht" };
  return null;
}
