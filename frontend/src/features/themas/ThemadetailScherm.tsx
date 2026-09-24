import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SUBTHEMA_PARAMETER } from "./themapagina";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { AiKnop, Knop } from "../../components/ui/Knop";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak, Laadlijst } from "../../components/ui/Laadvlak";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Actiemenu } from "../../components/ui/Actiemenu";
import { Toevoegknop } from "../../components/ui/Toevoegknop";
import { IcoonDoelen, IcoonPotlood } from "../../components/Iconen";
import {
  useBeoordeelSuggestie,
  useDoelsuggesties,
  useGenereerDoelsuggesties,
  useJaarfasen,
  useThema,
  useThemaDoelenoverzicht,
} from "../../lib/queries";
import { ApiError } from "../../lib/api";
import { geenToegangZin, useRechten } from "../../lib/rechten";
import type { DoelMatchResultaat, LeeftijdPlaatsing, SubthemaWeergave } from "../../lib/types";
import { t, telWoord, type Vertaalsleutel } from "../../i18n";
import { useAantalHoekverrijkingen } from "../hoeken/gegevens";
import type { ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import { BestaandeActiviteit } from "../activiteiten/BestaandeActiviteit";
import { NieuweActiviteit } from "../activiteiten/NieuweActiviteit";
import { Themaformulier } from "./Themaformulier";
import { Subthemaformulier } from "./Subthemaformulier";
import { Subthemahoofdstuk } from "./Subthemahoofdstuk";
import { Plaatsingsbalk, Subthemavoorstelkaart } from "./Subdoelplaatsing";
import { Voorstellijst } from "./Voorstellijst";
import { beslisFout, useBeslisSubdoelvoorstel, useSubdoelplaatsing } from "./plaatsingen";
import { Kaart, Sectie } from "./Fiche";
import { Leeftijdkeuze } from "./Leeftijdkeuze";
import { Doeldetailblad } from "./Doeldetailblad";
import { Themadoelenoverzicht } from "./Themadoelenoverzicht";
import { Minimumdoelkoppelaar, Themaminimumdoelen } from "./Themaminimumdoelen";
import { MIJLPAAL } from "../doelen/mijlpaal";
import { aantalLeerplandoelen, themabalans } from "./themabalans";
import { beslist, subthemabalans } from "./subthemabalans";
import { useWoordwebs } from "./woordwebs";
import {
  useKoppelActiviteitdoel,
  useKoppelMinimumdoel,
  useKoppelSubdoel,
  useGebruikActiviteit,
  useMaakActiviteit,
  useMaakSubthema,
  useOntkoppelActiviteitdoel,
  useOntkoppelMinimumdoel,
  useOntkoppelSubdoel,
  useVerwijderActiviteit,
  useVerwijderSubthema,
  useVerwijderThema,
  useWijzigActiviteit,
  useWijzigSubthema,
  useWijzigThema,
} from "./mutaties";

/**
 * One thema, read top to bottom in the order a teacher uses it (FB-094): the kop with its four figures and what the thema
 * is, then its subthema's, then its doelen.
 *
 * **Each figure stands once**, in one line under the title; the counts no longer sit in a margin beside every block and
 * again on the block. **The two main sections have real headings** in the display face, and every label under them is
 * in sentence case, a step down. **The actions are one "Bewerken" and one "…"** beside the title, and one "…" per
 * subthema, so deleting is never as loud as editing.
 *
 * **The subthema's are ordered by leeftijd** (the server's own order, from `/api/jaarfasen`), one list per leeftijd. A
 * thema is school-wide and its subthema's are per age: two of them are usually two ages side by side, not a sequence.
 *
 * **Nothing here claims anything about dekking.** A doel is gedekt when it is linked AND the thema is placed in a plan
 * (Art. V.1), and this screen knows nothing about any plan, so it counts links and says "gekoppeld".
 *
 * **Each control is drawn only for whoever holds its row of the ADR-0030 §3 matrix** (E6-02), decided in
 * `lib/rechten.ts`. The thema, its themadoelen and the doelsuggesties are admin's and themabeheer's. Deleting the
 * thema is admin's, and themabeheer's while the thema is empty (I26). Each subthema asks about its own leeftijd. Everyone
 * reads the whole page, and no sentence explains a missing control. Open doelsuggesties are shown only to whoever may
 * decide them (owner, 2026-09-14).
 */
export function ThemadetailScherm() {
  const { themaId } = useParams<{ themaId: string }>();
  const id = themaId ?? "";
  const { data: thema, isPending, isError } = useThema(themaId);
  const { data: suggesties } = useDoelsuggesties(themaId);
  const { data: jaarfasen } = useJaarfasen();
  // The same read as "Leerplandoelen voor …" below, for the one figure under the title.
  const { data: overzicht } = useThemaDoelenoverzicht(themaId);
  const genereer = useGenereerDoelsuggesties(id);
  const beoordeel = useBeoordeelSuggestie(id);
  const navigeer = useNavigate();
  const { mag } = useRechten();
  // The subthema a link from the agenda asked for (FB-037): its chapter opens on arrival.
  const [zoek] = useSearchParams();
  const gevraagdSubthema = zoek.get(SUBTHEMA_PARAMETER);

  // The leeftijden a doelsuggestie run searches, once the gebruiker touched the buttons; null follows the subthema's.
  const [leeftijdkeuze, setLeeftijdkeuze] = useState<string[] | null>(null);
  // Whether that choice is showing (FB-042): "Vraag suggesties" only opens it, the send button inside asks the model.
  const [vraagOpen, setVraagOpen] = useState(false);
  // Focus follows the swap: into the choice when it opens, back to "Vraag suggesties" when it closes. Null on the
  // first render, so arriving on the page moves nothing.
  const vraagRef = useRef<HTMLDivElement>(null);
  const vorigeVraagOpen = useRef<boolean | null>(null);
  useEffect(() => {
    if (vorigeVraagOpen.current !== null && vorigeVraagOpen.current !== vraagOpen) {
      vraagRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }
    vorigeVraagOpen.current = vraagOpen;
  }, [vraagOpen]);
  const [bewerkOpen, setBewerkOpen] = useState(false);
  const [verwijderOpen, setVerwijderOpen] = useState(false);
  // One piece of state per sheet, holding what it is editing. `{}` means "a new one"; two booleans
  // would allow the state where both are true.
  const [subthemaBlad, setSubthemaBlad] = useState<{ subthema?: SubthemaWeergave } | null>(null);
  const [teVerwijderenSubthema, setTeVerwijderenSubthema] = useState<SubthemaWeergave | null>(null);
  // What deleting it takes along from the klassen's agenda (FB-020; owner, 2026-09-15: "mee weg, met aantal").
  const verrijkingenWeg = useAantalHoekverrijkingen(teVerwijderenSubthema?.id ?? null);
  // The woordwebs a subthema delete takes with it (ADR-0043 D4), read only while the confirmation is open. Until they
  // have arrived the sentence names only what the reads above guarantee.
  const { data: teVerwijderenWoordwebs } = useWoordwebs(teVerwijderenSubthema?.id ?? null);
  const [activiteitBlad, setActiviteitBlad] = useState<{
    subthemaId: string;
    activiteitId?: string;
  } | null>(null);
  const [teVerwijderenActiviteit, setTeVerwijderenActiviteit] = useState<ActiviteitMetKleur | null>(null);
  // The leerplandoel whose detail is open (TB-016), from any list on the page, and the row button that opened it, which
  // gets focus back when the sheet closes.
  // An unlink waits for a confirmation that names what it does to dekking (owner, 2026-09-16, TB-051). Ids only, for
  // the reason the sheets above give: the objects are looked up in the current thema on every render.
  const [teOntkoppelenMinimumdoel, setTeOntkoppelenMinimumdoel] = useState<string | null>(null);
  const [teOntkoppelenSubdoel, setTeOntkoppelenSubdoel] = useState<{ subthemaId: string; subdoelId: string } | null>(
    null,
  );
  const [getoondDoel, setGetoondDoel] = useState<{ code: string; knop: HTMLElement } | null>(null);
  const toonDoel = (code: string, knop: HTMLElement) => setGetoondDoel({ code, knop });

  const wijzig = useWijzigThema(id);
  const verwijder = useVerwijderThema();
  const maakSubthema = useMaakSubthema(id);
  const wijzigSubthema = useWijzigSubthema(id);
  const verwijderSubthema = useVerwijderSubthema(id);
  const maakActiviteit = useMaakActiviteit(id);
  const wijzigActiviteit = useWijzigActiviteit(id);
  const gebruikActiviteit = useGebruikActiviteit(id);
  const verwijderActiviteit = useVerwijderActiviteit(id);
  const koppelMinimumdoel = useKoppelMinimumdoel(id);
  const ontkoppelMinimumdoel = useOntkoppelMinimumdoel(id);
  const koppelSubdoel = useKoppelSubdoel(id);
  const ontkoppelSubdoel = useOntkoppelSubdoel(id);
  const koppelActiviteitdoel = useKoppelActiviteitdoel(id);
  const ontkoppelActiviteitdoel = useOntkoppelActiviteitdoel(id);
  // FB-057: per leeftijd the open count and the AI's open proposals of where those doelen go.
  const { data: plaatsing } = useSubdoelplaatsing(themaId);
  const beslisSubdoel = useBeslisSubdoelvoorstel(id);

  if (isError) {
    return (
      <>
        <Schermkop smal titel={t("themas.titel")} />
        <Schermvlak smal>
          <Leegte titel={t("thema.fout")} actie={<Terug />} />
        </Schermvlak>
      </>
    );
  }

  if (isPending || !thema) {
    return (
      <>
        <Schermkop smal titel={t("themas.titel")} />
        <Schermvlak smal>
          <Laadvlak className="mb-4 h-24" />
          <Laadlijst rijen={5} />
        </Schermvlak>
      </>
    );
  }

  // A verdict has been recorded on everything that is no longer Voorgesteld, so only the open ones
  // are waiting for the teacher.
  const openSuggesties = (suggesties ?? []).filter((s) => s.status === "Voorgesteld");

  const balans = themabalans(thema);
  const leerplandoelen = overzicht ? aantalLeerplandoelen(overzicht.leeftijden) : null;
  const subthemas = opLeeftijd(thema.subthemas, jaarfasen);

  // WHICH GOALS A DOELSUGGESTIE RUN SEARCHES (TB-007). The server never sends the whole Op.stap catalogue, so the run
  // is for chosen leeftijden: pre-set to the leeftijden of the subthema's until the gebruiker changes them. While
  // `/api/jaarfasen` has not answered, no choice is shown or sent and the server takes the subthema's leeftijden
  // itself, so the button never waits on that list. Only a shown choice with nothing pressed disables it.
  const standaardLeeftijden = (jaarfasen ?? []).filter((fase) => thema.subthemas.some((s) => s.leeftijd === fase));
  const gekozenLeeftijden = leeftijdkeuze ?? standaardLeeftijden;
  const geenLeeftijd = jaarfasen !== undefined && gekozenLeeftijden.length === 0;
  // Closing forgets the choice, so the next opening is pre-set to the subthema's leeftijden again.
  const sluitVraag = () => {
    setVraagOpen(false);
    setLeeftijdkeuze(null);
  };
  const verstuurVraag = () => genereer.mutate(gekozenLeeftijden, { onSuccess: sluitVraag });

  // The sheet holds IDS, not objects, and the objects are looked up from the freshly invalidated
  // thema on every render. Holding the object would freeze the goal list at the moment the sheet
  // opened, and that list is exactly what changes while it is open.
  const bladSubthema = activiteitBlad
    ? (thema.subthemas.find((s) => s.id === activiteitBlad.subthemaId) ?? null)
    : null;
  const bladActiviteit =
    activiteitBlad?.activiteitId && bladSubthema
      ? ((bladSubthema.activiteiten.find((a) => a.id === activiteitBlad.activiteitId) as
          | ActiviteitMetKleur
          | undefined) ?? undefined)
      : undefined;

  /*
    A refusal from a control on this page that has no error line of its own: the goal links at three levels, a verdict
    on a doelsuggestie, and the two deletes behind a confirmation. It can only happen when the page went stale, since
    none of these is drawn without its right; the query client then refetches (`lib/queryClient.ts`), so the control
    goes, and this says why nothing happened. The forms and "Vraag suggesties" show their own.
  */
  /*
    The subthema form stays open only while this gebruiker may still use it: at least one leeftijd to make a subthema
    at, or the right at the one being edited. After a 403 the rights are refetched, and a form left open with no
    leeftijd to offer would be a Bewaren that can only be refused (fix round 1, F4). It then closes, like the agenda's
    pickers, and its refusal moves to the line below.
  */
  const ontkoppelMd = thema.minimumdoelen.find((m) => m.id === teOntkoppelenMinimumdoel) ?? null;
  const ontkoppelSubthema = teOntkoppelenSubdoel
    ? (thema.subthemas.find((s) => s.id === teOntkoppelenSubdoel.subthemaId) ?? null)
    : null;
  const ontkoppelSd = ontkoppelSubthema?.subdoelen.find((s) => s.id === teOntkoppelenSubdoel?.subdoelId) ?? null;

  const magSubthemaBlad =
    subthemaBlad !== null &&
    (subthemaBlad.subthema ? mag.subthemaBeheren(subthemaBlad.subthema.leeftijd) : mag.subthemaToevoegen);

  const geweigerd = [
    koppelMinimumdoel,
    ontkoppelMinimumdoel,
    koppelSubdoel,
    ontkoppelSubdoel,
    koppelActiviteitdoel,
    ontkoppelActiviteitdoel,
    beoordeel,
    beslisSubdoel,
    verwijder,
    verwijderSubthema,
    // The form shows its own refusal while it is open; once the rights closed it, this line does.
    ...(magSubthemaBlad ? [] : [maakSubthema, wijzigSubthema]),
  ]
    .map((mutatie) => geenToegangZin(mutatie.error))
    .find((zin) => zin !== null);

  // THE THEMA'S ACTIONS SIT BESIDE ITS TITLE (FB-094): "Bewerken", and the rest in one "…", so deleting is no louder
  // than editing. Only what this gebruiker holds; no menu at all without anything in it.
  const themamenu = (
    <Actiemenu
      omrand
      label={t("themabeheer.menuAria", { naam: thema.naam })}
      acties={
        mag.themaVerwijderen(thema)
          ? [
              {
                label: t("themabeheer.verwijder"),
                soort: "verwijder",
                onSelect: () => {
                  verwijder.reset();
                  setVerwijderOpen(true);
                },
              },
            ]
          : []
      }
    />
  );
  const openBewerken = () => {
    wijzig.reset();
    setBewerkOpen(true);
  };

  // One mijlpaal for every themadoel is said once, at their heading, instead of on each row (FB-094).
  const mijlpalen = [...new Set(thema.minimumdoelen.map((m) => mijlpaalVan(m.minimumdoelRef)))];
  const gedeeldeMijlpaal = mijlpalen.length === 1 && MIJLPAAL[mijlpalen[0]] ? t(MIJLPAAL[mijlpalen[0]]) : null;

  const groepen = leeftijdsgroepen(subthemas, plaatsing?.leeftijden, jaarfasen);

  return (
    <>
      <Schermkop
        smal
        titel={thema.naam}
        icoon={thema.icoon}
        kruimelpad={<Kruimelpad naam={thema.naam} />}
        rechts={
          <div className="flex items-center gap-2">
            {/* On a phone "Bewerken" moves under the thema's facts, so the title keeps its width. */}
            {mag.themaBewerken ? (
              <Knop className="hidden sm:inline-flex" onClick={openBewerken}>
                <IcoonPotlood aria-hidden="true" className="h-[18px] w-[18px]" />
                {t("themabeheer.bewerk")}
              </Knop>
            ) : null}
            {themamenu}
          </div>
        }
      />

      <Schermvlak smal>
        {/* THE FOUR FIGURES, ONCE (FB-094). Each used to stand in a margin beside its block and again on that block. */}
        <dl aria-label={t("thema.samenvatting")} className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-body sm:flex sm:flex-wrap sm:gap-x-8">
          <Cijfer aantal={thema.duurWeken} een="themas.weekEen" meer="themas.weekMeer" />
          <Cijfer aantal={thema.minimumdoelen.length} een="themas.minimumdoelEen" meer="themas.minimumdoelMeer" />
          {leerplandoelen !== null ? (
            <Cijfer
              aantal={leerplandoelen}
              een="thema.overzichtLeerplandoelWoordEen"
              meer="thema.overzichtLeerplandoelWoordMeer"
            />
          ) : null}
          <Cijfer aantal={thema.subthemas.length} een="themas.subthemaEen" meer="themas.subthemaMeer" />
        </dl>

        {/* WHAT THIS THEMA IS: label and value, no card of its own. The two vocabulary lists keep Op.stap's own names,
            the ones a teacher meets in the thema form. */}
        {thema.invalshoeken || thema.kernwoordenschat.length > 0 || thema.rijkeWoordenschat.length > 0 ? (
          <dl className="mt-5 grid gap-y-3 border-t border-lijn pt-5 text-body sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-6 sm:gap-y-2.5">
            {thema.invalshoeken ? (
              <Gegeven label={t("themabeheer.invalshoeken")}>{thema.invalshoeken}</Gegeven>
            ) : null}
            {thema.kernwoordenschat.length > 0 ? (
              <Gegeven label={t("themabeheer.kernwoordenschat")}>{thema.kernwoordenschat.join(", ")}</Gegeven>
            ) : null}
            {thema.rijkeWoordenschat.length > 0 ? (
              <Gegeven label={t("themabeheer.rijkeWoordenschat")}>{thema.rijkeWoordenschat.join(", ")}</Gegeven>
            ) : null}
          </dl>
        ) : null}

        {mag.themaBewerken ? (
          <Knop className="mt-5 sm:hidden" onClick={openBewerken}>
            <IcoonPotlood aria-hidden="true" className="h-[18px] w-[18px]" />
            {t("themabeheer.bewerkThema")}
          </Knop>
        ) : null}

        {/* THE SUBTHEMA'S COME BEFORE THE DOELEN (FB-094): a teacher comes to this page for them. Per leeftijd, in the
            order of `/api/jaarfasen`, each leeftijd one list. A leeftijd the subdoelplaatsing lists without a subthema
            (FB-062) holds just its count, the AI button and what the AI proposed. */}
        <Sectie
          id="thema-subthemas"
          titel={t("thema.subthemasTitel")}
          acties={
            // At SOME leeftijd; the form then offers only the leeftijden this gebruiker may use.
            mag.subthemaToevoegen ? (
              <Toevoegknop
                label={t("subthemabeheer.toevoegen")}
                onClick={() => {
                  maakSubthema.reset();
                  setSubthemaBlad({});
                }}
              />
            ) : undefined
          }
        >
          {groepen.length === 0 ? <p className="text-meta text-inkt-zacht">{t("thema.geenSubthemas")}</p> : null}
          {groepen.map((groep) => {
            const plaatsen = plaatsing?.leeftijden.find((l) => l.leeftijd === groep.leeftijd);
            // A refusal other than a 403 (decided elsewhere, subthema gone) is shown at the leeftijd it happened in.
            const beslisFoutHier =
              beslisSubdoel.isError &&
              geenToegangZin(beslisSubdoel.error) === null &&
              plaatsen?.subdoelvoorstellen.some((v) => v.id === beslisSubdoel.variables?.voorstelId);
            return (
              <section key={groep.leeftijd} aria-label={t("thema.voorLeeftijd", { leeftijd: groep.leeftijd })} className="flex flex-col gap-2">
                <h3 className="text-meta font-semibold text-inkt-zacht">
                  {t("thema.voorLeeftijd", { leeftijd: groep.leeftijd })}
                </h3>
                {plaatsen ? (
                  <Plaatsingsbalk
                    themaId={id}
                    leeftijd={plaatsen.leeftijd}
                    aantalOpen={plaatsen.aantalOpen}
                    magVragen={mag.subdoelplaatsingVragen(plaatsen.leeftijd)}
                  />
                ) : null}
                {beslisFoutHier ? (
                  <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                    {beslisFout(beslisSubdoel.error)}
                  </p>
                ) : null}
                {groep.subthemas.length > 0 ? (
                  <Kaart>
                    <ul className="divide-y divide-lijn">
                      {groep.subthemas.map((subthema) => (
                        <li key={subthema.id}>
                          <Subthemahoofdstuk
                            subthema={subthema}
                            mag={mag}
                            gevraagd={subthema.id === gevraagdSubthema}
                            koppelenBezig={koppelSubdoel.isPending || ontkoppelSubdoel.isPending}
                            onBewerk={() => {
                              wijzigSubthema.reset();
                              setSubthemaBlad({ subthema });
                            }}
                            onVerwijder={() => {
                              verwijderSubthema.reset();
                              setTeVerwijderenSubthema(subthema);
                            }}
                            onNieuweActiviteit={() => {
                              maakActiviteit.reset();
                              setActiviteitBlad({ subthemaId: subthema.id });
                            }}
                            onBewerkActiviteit={(activiteit) => {
                              wijzigActiviteit.reset();
                              setActiviteitBlad({ subthemaId: subthema.id, activiteitId: activiteit.id });
                            }}
                            onVerwijderActiviteit={(activiteit) => {
                              verwijderActiviteit.reset();
                              setTeVerwijderenActiviteit(activiteit);
                            }}
                            onKoppelSubdoel={(code) =>
                              koppelSubdoel.mutate({ subthemaId: subthema.id, leerplandoelCode: code })
                            }
                            onOntkoppelSubdoel={(subdoelId) => {
                              ontkoppelSubdoel.reset();
                              setTeOntkoppelenSubdoel({ subthemaId: subthema.id, subdoelId });
                            }}
                            onToonDoel={toonDoel}
                            voorstellen={plaatsen?.subdoelvoorstellen.filter((v) => v.subthemaId === subthema.id)}
                            beslisBezig={beslisSubdoel.isPending}
                            onBeslisVoorstel={
                              plaatsen?.magBeslissen
                                ? (voorstelId, status) => beslisSubdoel.mutate({ voorstelId, status })
                                : undefined
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </Kaart>
                ) : null}
                {plaatsen?.subthemavoorstellen.map((voorstel) => (
                  <Subthemavoorstelkaart
                    key={voorstel.id}
                    themaId={id}
                    voorstel={voorstel}
                    magBeslissen={plaatsen.magBeslissen}
                    onToon={toonDoel}
                  />
                ))}
              </section>
            );
          })}
        </Sectie>

        {/* THE DOELEN, where they hang: on the thema, on subthema's, on activiteiten. `gekoppeld`, never `gedekt`:
            dekking belongs to a klas with a plan (Art. V.1), and this page knows none (`themabalans.ts`). */}
        <Sectie
          id="thema-doelen"
          titel={t("thema.doelenTitel")}
          onder={
            <>
              {balans.totaal === 0 ? (
                t("thema.geenDoelenGekoppeldZin")
              ) : (
                // Only the levels that carry something: "2 op het thema, 0 op subthema's, 0 op activiteiten" would spend
                // three facts to state one.
                t("thema.gekoppeld", {
                  lijst: [
                    [balans.themadoelen, "thema.doelenOpThema"] as const,
                    [balans.subdoelen, "thema.doelenOpSubthemas"] as const,
                    [balans.activiteitdoelen, "thema.doelenOpActiviteiten"] as const,
                  ]
                    .filter(([aantal]) => aantal > 0)
                    .map(([aantal, woord]) => `${aantal} ${t(woord)}`)
                    .join(", "),
                })
              )}
              {/* An activiteit with no doel can never count, which earns `attentie`; the words carry it without the
                  colour (Art. XII). */}
              {balans.activiteitenZonderDoel > 0 ? (
                <span className="font-medium text-attentie-inkt">
                  {" "}
                  {t("thema.zonderDoelZin", {
                    activiteiten: telWoord(balans.activiteitenZonderDoel, "thema.zonderDoelEen", "thema.zonderDoelMeer"),
                  })}
                </span>
              ) : null}
            </>
          }
        >
          {/* THEMADOELEN AND DOELSUGGESTIES ARE ONE CARD. A themadoel is a minimumdoel (FB-043); the doelsuggesties
              propose minimumdoelen too (FB-053), so a proposal wears the MD chip of the themadoel it would become. Every
              suggestion is shown with its motivation and accepted or rejected by hand (Art. IV). */}
          <Kaart className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 font-display text-sectie text-inkt">
                  <IcoonDoelen aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zacht" />
                  {t("thema.themadoelen")}
                </h3>
                {gedeeldeMijlpaal ? <p className="mt-0.5 text-meta text-inkt-zacht">{gedeeldeMijlpaal}</p> : null}
              </div>
              {mag.themaBewerken || mag.doelsuggestiesMaken ? (
                <div className="flex flex-wrap items-center gap-2 has-[>.w-full]:basis-full">
                  {mag.themaBewerken ? (
                    <Minimumdoelkoppelaar
                      onKies={(ref) => koppelMinimumdoel.mutate(ref)}
                      bezig={koppelMinimumdoel.isPending}
                      alGekozen={thema.minimumdoelen.map((m) => m.minimumdoelRef)}
                    />
                  ) : null}
                  {/* FB-042: "Vraag suggesties" asks nothing yet: it swaps itself for the choice of leeftijden, then
                      the send button that does call the model and so is the one ring on show (ADR-0039). */}
                  {mag.doelsuggestiesMaken ? (
                    <div ref={vraagRef} className="contents">
                      {vraagOpen ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-meta text-inkt-zacht">{t("thema.suggestiesVragenVoor")}</span>
                          {jaarfasen ? (
                            <Leeftijdkeuze jaarfasen={jaarfasen} gekozen={gekozenLeeftijden} onWijzig={setLeeftijdkeuze} />
                          ) : null}
                          <AiKnop
                            className="px-2.5 text-meta sm:h-9 sm:min-h-9"
                            bezig={genereer.isPending}
                            disabled={geenLeeftijd}
                            aria-describedby={geenLeeftijd ? "doelsuggesties-kies-leeftijd" : undefined}
                            onClick={verstuurVraag}
                          >
                            {genereer.isPending ? t("thema.suggestiesBezig") : t("thema.suggestiesVersturen")}
                          </AiKnop>
                          <Knop className="px-2.5 text-meta sm:h-9 sm:min-h-9" disabled={genereer.isPending} onClick={sluitVraag}>
                            {t("thema.suggestiesAnnuleren")}
                          </Knop>
                        </div>
                      ) : (
                        <AiKnop className="px-2.5 text-meta sm:h-9 sm:min-h-9" onClick={() => setVraagOpen(true)}>
                          {t("thema.suggestiesVragen")}
                        </AiKnop>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Why the AI button is disabled, directly under it, and only while it is. */}
            {mag.doelsuggestiesMaken && vraagOpen && geenLeeftijd ? (
              <p id="doelsuggesties-kies-leeftijd" className="mt-2 text-meta text-inkt-zacht">{t("thema.kiesLeeftijd")}</p>
            ) : null}

            {/* A refusal's own Dutch sentence where the server wrote one. A 422 is a bad model answer and its detail is
                an English operator diagnostic (Art. II.3), so the catalogue line stands in for it. */}
            {genereer.isError ? (
              <p className="mt-3 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                {genereer.error instanceof ApiError && genereer.error.status !== 422 && genereer.error.detail
                  ? genereer.error.detail
                  : t("thema.suggestiesMislukt")}
              </p>
            ) : null}

            {/* Mounted before any run, with only its text swapped: several screen readers do not announce a live region
                that appears with its content already in it (WCAG 4.1.3). */}
            <p role="status" className={genereer.isSuccess ? "mt-3 text-meta text-inkt-zacht" : "sr-only"}>
              {genereer.isSuccess ? resultaatZin(genereer.data) : null}
            </p>

            {/* Open suggestions, as one list under the AI button and above the themadoelen (TB-076), only for whoever may
                decide them (R14: admin and themabeheer; owner, 2026-09-14: kept hidden from everyone else). */}
            {mag.doelsuggestiesBeoordelen && openSuggesties.length > 0 ? (
              <>
                <h4 className="mt-4 text-meta font-semibold text-inkt-zacht">{t("thema.suggesties")}</h4>
                <div className="mt-2">
                  <Voorstellijst
                    label={t("voorstellijst.doelenLabel")}
                    voorstellen={openSuggesties.map((suggestie) => ({
                      id: suggestie.id,
                      naam: suggestie.minimumdoelRef,
                      // The MD chip the themadoel rows wear, and the mijlpaal (FB-053): the goal it would become.
                      kop: (
                        <>
                          <span className="mono inline-block rounded bg-doelsoort-md px-1.5 py-0.5 text-[0.6875rem] font-medium text-doelsoort-md-op">
                            {suggestie.minimumdoelRef}
                          </span>
                          {suggestie.mijlpaal ? (
                            <span className="text-meta text-inkt-zacht">
                              {MIJLPAAL[suggestie.mijlpaal] ? t(MIJLPAAL[suggestie.mijlpaal]) : suggestie.mijlpaal}
                            </span>
                          ) : null}
                        </>
                      ),
                      inhoud: suggestie.omschrijving ?? suggestie.minimumdoelRef,
                      motivatie: suggestie.aiMotivatie,
                    }))}
                    onBeslis={(suggestieId, status) => beoordeel.mutateAsync({ suggestieId, status })}
                  />
                </div>
              </>
            ) : null}

            <div className="mt-3">
              {thema.minimumdoelen.length === 0 ? (
                <p className="text-meta text-inkt-zacht">{t("thema.geenThemadoelen")}</p>
              ) : (
                <Themaminimumdoelen
                  koppelingen={thema.minimumdoelen}
                  toonMijlpaal={gedeeldeMijlpaal === null}
                  ontkoppelBezig={ontkoppelMinimumdoel.isPending}
                  onOntkoppel={
                    mag.themaBewerken
                      ? (koppelingId) => {
                          ontkoppelMinimumdoel.reset();
                          setTeOntkoppelenMinimumdoel(koppelingId);
                        }
                      : undefined
                  }
                  onToonDoel={toonDoel}
                />
              )}
            </div>

            {/* A link that did not happen, other than a refusal (the page's line below says that): an already linked
                minimumdoel or one no longer loaded. The server's own Dutch sentence. */}
            {koppelMinimumdoel.isError && geenToegangZin(koppelMinimumdoel.error) === null ? (
              <p role="alert" className="mt-3 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                {koppelMinimumdoel.error instanceof ApiError && koppelMinimumdoel.error.detail
                  ? koppelMinimumdoel.error.detail
                  : t("thema.minimumdoelKoppelMislukt")}
              </p>
            ) : null}

          </Kaart>

          {/* THE LEERPLANDOELEN PER LEEFTIJD (FB-009), shut, under the themadoelen they are the concordance of. */}
          <Themadoelenoverzicht themaId={id} onToonDoel={toonDoel} />
        </Sectie>
      </Schermvlak>

      <Doeldetailblad
        code={getoondDoel?.code ?? null}
        terugNaar={getoondDoel?.knop}
        onSluit={() => setGetoondDoel(null)}
      />

      {bewerkOpen ? (
        <Themaformulier
          open
          thema={thema}
          bezig={wijzig.isPending}
          fout={wijzig.isError ? wijzig.error : undefined}
          onSluit={() => setBewerkOpen(false)}
          onBewaar={(invoer) => wijzig.mutate(invoer, { onSuccess: () => setBewerkOpen(false) })}
        />
      ) : null}

      {/* The consequence sentence carries the counts, because only this screen knows them and a
          teacher cannot see from a thema's name that three classes derive from it. */}
      <Bevestiging
        open={verwijderOpen}
        titel={t("themabeheer.verwijderTitel", { naam: thema.naam })}
        gevolg={t("themabeheer.verwijderGevolg", {
          subthemas: thema.subthemas.length,
          doelen: balans.totaal,
        })}
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijder.isPending}
        onSluit={() => setVerwijderOpen(false)}
        onBevestig={() =>
          verwijder.mutate(thema.id, {
            // Back to the list: the screen the teacher is on no longer describes anything.
            onSuccess: () => navigeer("/themas", { replace: true }),
          })
        }
      />

      {/* WHAT AN UNLINK DOES TO DEKKING, said before it happens (TB-051). Each sentence claims only what this page knows:
          the link on this thema or this subthema, not whether another thema or subthema carries the same doel. */}
      <Bevestiging
        open={ontkoppelMd !== null}
        titel={t("thema.minimumdoelOntkoppelTitel", { ref: ontkoppelMd?.minimumdoelRef ?? "" })}
        gevolg={[
          t("thema.minimumdoelOntkoppelGevolg", { ref: ontkoppelMd?.minimumdoelRef ?? "", thema: thema.naam }),
          // Art. IX.2 asks at least two themadoelen; say so when this unlink takes the thema below that.
          thema.minimumdoelen.length === 2
            ? t("thema.minimumdoelOntkoppelNogEen")
            : thema.minimumdoelen.length === 1
              ? t("thema.minimumdoelOntkoppelGeen")
              : null,
        ]
          .filter((zin) => zin !== null)
          .join(" ")}
        bevestigLabel={t("thema.ontkoppelBevestig")}
        bezig={ontkoppelMinimumdoel.isPending}
        onSluit={() => setTeOntkoppelenMinimumdoel(null)}
        onBevestig={() => {
          if (!ontkoppelMd) return;
          ontkoppelMinimumdoel.mutate(ontkoppelMd.id, { onSettled: () => setTeOntkoppelenMinimumdoel(null) });
        }}
      />

      <Bevestiging
        open={ontkoppelSd !== null && ontkoppelSubthema !== null}
        titel={t("thema.subdoelOntkoppelTitel", { code: ontkoppelSd?.koppeling.leerplandoelCode ?? "" })}
        gevolg={ontkoppelSd && ontkoppelSubthema ? subdoelOntkoppelGevolg(ontkoppelSubthema, ontkoppelSd.id) : undefined}
        bevestigLabel={t("thema.ontkoppelBevestig")}
        bezig={ontkoppelSubdoel.isPending}
        onSluit={() => setTeOntkoppelenSubdoel(null)}
        onBevestig={() => {
          if (!ontkoppelSd || !ontkoppelSubthema) return;
          ontkoppelSubdoel.mutate(
            { subthemaId: ontkoppelSubthema.id, subdoelId: ontkoppelSd.id },
            { onSettled: () => setTeOntkoppelenSubdoel(null) },
          );
        }}
      />

      {subthemaBlad && magSubthemaBlad ? (
        <Subthemaformulier
          open
          subthema={subthemaBlad.subthema}
          // A new subthema at any leeftijd this gebruiker holds; an existing one only to a leeftijd where they hold the
          // right too, since a re-scope needs it at both ends (I13).
          magLeeftijd={(leeftijd) => {
            const huidige = subthemaBlad.subthema?.leeftijd;
            return huidige === undefined ? mag.subthemaBeheren(leeftijd) : mag.subthemaHerschikken(huidige, leeftijd);
          }}
          bezig={subthemaBlad.subthema ? wijzigSubthema.isPending : maakSubthema.isPending}
          fout={
            subthemaBlad.subthema
              ? wijzigSubthema.isError
                ? wijzigSubthema.error
                : undefined
              : maakSubthema.isError
                ? maakSubthema.error
                : undefined
          }
          // A refusal the form showed is left behind with it, so the line below does not repeat it after a close.
          onSluit={() => {
            maakSubthema.reset();
            wijzigSubthema.reset();
            setSubthemaBlad(null);
          }}
          onBewaar={(invoer) => {
            const bestaand = subthemaBlad.subthema;
            if (bestaand) {
              wijzigSubthema.mutate(
                { subthemaId: bestaand.id, invoer },
                { onSuccess: () => setSubthemaBlad(null) },
              );
            } else {
              maakSubthema.mutate(invoer, { onSuccess: () => setSubthemaBlad(null) });
            }
          }}
        />
      ) : null}

      <Bevestiging
        open={teVerwijderenSubthema !== null}
        titel={t("subthemabeheer.verwijderTitel", { naam: teVerwijderenSubthema?.naam ?? "" })}
        // The verrijkingen are named once the count is read and above zero. While it is out, the delete waits (the
        // owner's ruling is that the count comes first); if it cannot be read, the sentence says so rather than delete
        // other klassen's texts without a number. The woordwebs (FB-036) follow as a sentence of their own, only once
        // their count is read and above zero.
        gevolg={[
          verrijkingenWeg.isError
            ? t("subthemabeheer.verwijderGevolgVerrijkingenOnbekend", {
                activiteiten: teVerwijderenSubthema?.activiteiten.length ?? 0,
                doelen: teVerwijderenSubthema?.subdoelen.length ?? 0,
              })
            : (verrijkingenWeg.data?.aantal ?? 0) > 0
            ? t("subthemabeheer.verwijderGevolgMetVerrijkingen", {
                activiteiten: teVerwijderenSubthema?.activiteiten.length ?? 0,
                doelen: teVerwijderenSubthema?.subdoelen.length ?? 0,
                verrijkingen: telWoord(
                  verrijkingenWeg.data?.aantal ?? 0,
                  "subthemabeheer.eenVerrijking",
                  "subthemabeheer.aantalVerrijkingen",
                ),
              })
            : t("subthemabeheer.verwijderGevolg", {
                activiteiten: teVerwijderenSubthema?.activiteiten.length ?? 0,
                doelen: teVerwijderenSubthema?.subdoelen.length ?? 0,
              }),
          teVerwijderenWoordwebs && teVerwijderenWoordwebs.length > 0
            ? telWoord(teVerwijderenWoordwebs.length, "woordweb.verwijderGevolgEen", "woordweb.verwijderGevolgMeer")
            : null,
        ]
          .filter((zin) => zin !== null)
          .join(" ")}
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijderSubthema.isPending || (teVerwijderenSubthema !== null && verrijkingenWeg.isPending)}
        onSluit={() => setTeVerwijderenSubthema(null)}
        onBevestig={() => {
          if (!teVerwijderenSubthema) return;
          verwijderSubthema.mutate(teVerwijderenSubthema.id, {
            onSuccess: () => setTeVerwijderenSubthema(null),
          });
        }}
      />

      {activiteitBlad && bladSubthema && bladActiviteit ? (
        <BestaandeActiviteit
          open
          activiteit={bladActiviteit}
          // The facts rather than the form for a gebruiker who may not change this activiteit (a colleague's own one
          // included, ADR-0049 D4); the goal section for whoever may link its goals (R19, E3).
          alleenLezen={!mag.activiteitInhoudBewerken({ ...bladActiviteit, leeftijd: bladSubthema.leeftijd })}
          magDoelen={mag.activiteitDoelenKoppelen({ ...bladActiviteit, leeftijd: bladSubthema.leeftijd })}
          themaId={id}
          onGebruik={
            mag.activiteitGebruiken({ ...bladActiviteit, leeftijd: bladSubthema.leeftijd })
              ? () =>
                  gebruikActiviteit.mutate(bladActiviteit.id, {
                    // Closed rather than switched to the copy: the list has not refetched yet, and a sheet looking
                    // for an id it does not hold would open as a NEW activiteit. The copy shows in the list as "Eigen".
                    onSuccess: () => setActiviteitBlad(null),
                  })
              : undefined
          }
          gebruikBezig={gebruikActiviteit.isPending}
          onderzoeksvragen={bladSubthema.onderzoeksvragen}
          bezig={wijzigActiviteit.isPending}
          fout={
            wijzigActiviteit.isError
              ? wijzigActiviteit.error
              : gebruikActiviteit.isError
                ? gebruikActiviteit.error
                : undefined
          }
          koppelenBezig={koppelActiviteitdoel.isPending || ontkoppelActiviteitdoel.isPending}
          onKoppel={(code) =>
            koppelActiviteitdoel.mutate({
              activiteitId: bladActiviteit.id,
              leerplandoelCode: code,
            })
          }
          onOntkoppel={(koppelingId) =>
            ontkoppelActiviteitdoel.mutate({ activiteitId: bladActiviteit.id, koppelingId })
          }
          onSluit={() => setActiviteitBlad(null)}
          onBewaar={(invoer) =>
            wijzigActiviteit.mutate(
              { activiteitId: bladActiviteit.id, invoer },
              { onSuccess: () => setActiviteitBlad(null) },
            )
          }
        />
      ) : activiteitBlad && bladSubthema ? (
        // A new one takes its "voor wie" and its goal picker from the subthema's leeftijd.
        <NieuweActiviteit
          open
          leeftijd={bladSubthema.leeftijd}
          onderzoeksvragen={bladSubthema.onderzoeksvragen}
          subdoelen={bladSubthema.subdoelen}
          bezig={maakActiviteit.isPending}
          fout={maakActiviteit.isError ? maakActiviteit.error : undefined}
          onSluit={() => setActiviteitBlad(null)}
          onBewaar={(invoer) =>
            maakActiviteit.mutate(
              { subthemaId: bladSubthema.id, invoer },
              { onSuccess: () => setActiviteitBlad(null) },
            )
          }
        />
      ) : null}

      {/* No count of scheduled days in this sentence: the server refuses the delete outright for an
          activiteit that still sits in the weekplanning, and its own message names the day count
          that this screen does not have. */}
      <Bevestiging
        open={teVerwijderenActiviteit !== null}
        titel={t("activiteit.verwijderTitel", { naam: teVerwijderenActiviteit?.naam ?? "" })}
        gevolg={t("activiteit.verwijderGevolg", {
          doelen: teVerwijderenActiviteit?.doelkoppelingen.length ?? 0,
        })}
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijderActiviteit.isPending}
        onSluit={() => setTeVerwijderenActiviteit(null)}
        onBevestig={() => {
          if (!teVerwijderenActiviteit) return;
          verwijderActiviteit.mutate(teVerwijderenActiviteit.id, {
            onSuccess: () => setTeVerwijderenActiviteit(null),
          });
        }}
      />

      {/* The one refusal a teacher will actually hit: an activiteit that is still on a day. The
          server's sentence names how many days, which is why it is shown instead of a catalogue
          line. The same place carries a refused action from a control without an error line of
          its own (`geweigerd`, above), so the two can never stack on top of each other. */}
      {verwijderActiviteit.isError || geweigerd ? (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-24 z-50 rounded-veld border border-attentie/40 bg-attentie-zacht p-3 shadow-zweef sm:inset-x-auto sm:right-6 sm:w-96"
        >
          <p className="text-meta font-medium text-attentie-inkt">
            {verwijderActiviteit.isError
              ? verwijderActiviteit.error instanceof ApiError && verwijderActiviteit.error.detail
                ? verwijderActiviteit.error.detail
                : t("themabeheer.bewaarMislukt")
              : geweigerd}
          </p>
        </div>
      ) : null}
    </>
  );
}

/** One of the four figures under the title: the number, then its word. `dt` first in the markup, as a `dl` asks. */
function Cijfer({ aantal, een, meer }: { aantal: number; een: Vertaalsleutel; meer: Vertaalsleutel }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="order-2 text-inkt-zacht">{t(aantal === 1 ? een : meer)}</dt>
      <dd className="mono font-medium text-inkt">{aantal}</dd>
    </div>
  );
}

/** One fact about the thema: a label in sentence case, its value beside it from `sm`, under it on a phone. */
function Gegeven({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-meta text-inkt-zacht sm:pt-0.5">{label}</dt>
      <dd className="-mt-2 min-w-0 text-inkt sm:mt-0">{children}</dd>
    </div>
  );
}

/** "Thema's / Herfst in het bos": where this page sits, in place of a separate back button. */
function Kruimelpad({ naam }: { naam: string }) {
  return (
    <nav aria-label={t("thema.kruimelpad")} className="flex min-w-0 items-center gap-2 text-meta text-inkt-zacht">
      <Link
        to="/themas"
        className="-mx-1 inline-flex min-h-raak items-center rounded-veld px-1 underline decoration-lijn-veld underline-offset-4 hover:text-inkt hover:decoration-inkt sm:min-h-0"
      >
        {t("themas.titel")}
      </Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page" className="truncate">
        {naam}
      </span>
    </nav>
  );
}

/** The mijlpaal a minimumdoel's ref starts with: `K-1.1.3` is `K-`, the key `MIJLPAAL` names. */
function mijlpaalVan(ref: string): string {
  return `${ref.split("-")[0] ?? ""}-`;
}

/**
 * What a doelsuggestie run did, in one line (TB-007, FB-053): how many proposals it added, out of how many minimumdoelen,
 * of which mijlpalen ("mijlpaal K"). Every figure is read off the server's answer, so the line states what the run
 * searched, not what the buttons say now. With no candidates the server answers before calling the model, which is what
 * that sentence claims.
 */
function resultaatZin(resultaat: DoelMatchResultaat): string {
  const korte = resultaat.mijlpalen.map((code) => code.replace(/-$/, ""));
  const mijlpalen =
    korte.length === 1 ? t("thema.mijlpaalEen", { naam: korte[0] }) : t("thema.mijlpalenMeer", { lijst: opsomming(korte) });
  if (resultaat.aantalKandidaten === 0) return t("thema.suggestiesGeenDoelen", { mijlpalen });

  const doelen = telWoord(resultaat.aantalKandidaten, "thema.kandidaatEen", "thema.kandidatenMeer");
  const nieuw = resultaat.bewaard.length;
  if (nieuw === 0) return t("thema.suggestiesGeenNieuwe", { doelen, mijlpalen });
  return nieuw === 1
    ? t("thema.suggestiesEenNieuw", { doelen, mijlpalen })
    : t("thema.suggestiesNieuw", { aantal: nieuw, doelen, mijlpalen });
}

/**
 * What unlinking a subdoel does to dekking (TB-051). A subdoel and a decided link on an activiteit of the same subthema
 * reach a klas's dekking by the same route (ADR-0047), so the leerplandoel keeps counting while such an activiteit
 * carries it; the sentence says which, from the same count the chapter shows under the subdoel.
 */
function subdoelOntkoppelGevolg(subthema: SubthemaWeergave, subdoelId: string): string {
  const subdoel = subthema.subdoelen.find((s) => s.id === subdoelId);
  if (!subdoel) return "";
  const dragers = subthemabalans(subthema).dragersPerSubdoel.get(subdoelId) ?? [];
  const namen = dragers.map((d) => d.naam).join(", ");
  const woorden = { code: subdoel.koppeling.leerplandoelCode, subthema: subthema.naam, leeftijd: subthema.leeftijd };
  // An undecided subdoel never counted, so nothing is said about what it stops counting for.
  if (!beslist(subdoel.koppeling.status)) return t("thema.subdoelOntkoppelOnbeslist", woorden);
  const eerste = t("thema.subdoelOntkoppelGevolg", woorden);
  const tweede =
    dragers.length === 0
      ? t("thema.subdoelOntkoppelGeenDrager")
      : dragers.length === 1
        ? t("thema.subdoelOntkoppelBlijftEen", { namen })
        : t("thema.subdoelOntkoppelBlijftMeer", { aantal: dragers.length, namen });
  return `${eerste} ${tweede}`;
}

/** "K3", "K3 en L1", "JK, K2 en K3". */
function opsomming(woorden: string[]): string {
  if (woorden.length <= 1) return woorden[0] ?? "";
  return t("thema.opsommingEn", { eerste: woorden.slice(0, -1).join(", "), laatste: woorden[woorden.length - 1] });
}

/**
 * The subthema's in the order a teacher thinks of the ages, not in the order they were typed.
 *
 * The order comes from `/api/jaarfasen`, which is the same list the subthema form offers, because
 * spelling JK, K2, K3, L1 out here would be a second source for domain vocabulary the server already
 * owns (`lib/types.ts` makes the same point about `mogelijkeJaarfasen`). A leeftijd the server does
 * not know is legitimate: older imports carry free text such as "5-6". Those sort after the known
 * ones rather than being hidden or reordered among them, and within any tie the name decides, so the
 * order is stable across renders.
 */
function opLeeftijd(subthemas: SubthemaWeergave[], jaarfasen: string[] | undefined) {
  const volgorde = new Map((jaarfasen ?? []).map((fase, i) => [fase, i]));
  const rang = (leeftijd: string) => volgorde.get(leeftijd) ?? Number.MAX_SAFE_INTEGER;

  return [...subthemas].sort(
    (a, b) =>
      rang(a.leeftijd) - rang(b.leeftijd) ||
      a.leeftijd.localeCompare(b.leeftijd, "nl") ||
      a.naam.localeCompare(b.naam, "nl"),
  );
}

/** Consecutive subthema's of one leeftijd, in the order `opLeeftijd` gave them, which already puts each leeftijd together. */
function perLeeftijd(subthemas: SubthemaWeergave[]) {
  const groepen: { leeftijd: string; subthemas: SubthemaWeergave[] }[] = [];
  for (const subthema of subthemas) {
    const laatste = groepen.at(-1);
    if (laatste?.leeftijd === subthema.leeftijd) laatste.subthemas.push(subthema);
    else groepen.push({ leeftijd: subthema.leeftijd, subthemas: [subthema] });
  }
  return groepen;
}

/**
 * The margins the screen draws: one per leeftijd with subthema's, plus one per leeftijd the subdoelplaatsing lists
 * without a subthema (FB-062, ADR-0064). The server sends such a leeftijd only to whoever may ask there and only while
 * it has open doelen, so its margin holds just the count, the AI button and whatever the AI proposed. Merged in the
 * order of `/api/jaarfasen`, like the subthema's themselves.
 */
function leeftijdsgroepen(
  subthemas: SubthemaWeergave[],
  plaatsingen: LeeftijdPlaatsing[] | undefined,
  jaarfasen: string[] | undefined,
) {
  const groepen = perLeeftijd(subthemas);
  for (const plaatsing of plaatsingen ?? []) {
    if (!plaatsing.heeftSubthema && !groepen.some((g) => g.leeftijd === plaatsing.leeftijd)) {
      groepen.push({ leeftijd: plaatsing.leeftijd, subthemas: [] });
    }
  }

  const volgorde = new Map((jaarfasen ?? []).map((fase, i) => [fase, i]));
  const rang = (leeftijd: string) => volgorde.get(leeftijd) ?? Number.MAX_SAFE_INTEGER;
  return groepen.sort((a, b) => rang(a.leeftijd) - rang(b.leeftijd));
}

function Terug() {
  return (
    <Link
      to="/themas"
      className="inline-flex h-9 items-center rounded-veld border border-lijn px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-lijn-veld hover:text-inkt"
    >
      {t("thema.terug")}
    </Link>
  );
}
