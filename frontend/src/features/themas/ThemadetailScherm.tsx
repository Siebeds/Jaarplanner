import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SUBTHEMA_PARAMETER } from "./themapagina";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { AiKnop, Knop } from "../../components/ui/Knop";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak, Laadlijst } from "../../components/ui/Laadvlak";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Bewerkknop, Verwijderknop } from "../../components/ui/Rijknoppen";
import { Toevoegknop } from "../../components/ui/Toevoegknop";
import { IcoonDoelen } from "../../components/Iconen";
import {
  useBeoordeelSuggestie,
  useDoelsuggesties,
  useGenereerDoelsuggesties,
  useJaarfasen,
  useThema,
} from "../../lib/queries";
import { ApiError } from "../../lib/api";
import { geenToegangZin, useRechten } from "../../lib/rechten";
import type { DoelMatchResultaat, SubthemaWeergave } from "../../lib/types";
import { t, telWoord, type Vertaalsleutel } from "../../i18n";
import { useAantalHoekverrijkingen } from "../hoeken/gegevens";
import { Activiteitformulier, type ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import { Themaformulier } from "./Themaformulier";
import { Subthemaformulier } from "./Subthemaformulier";
import { Subthemahoofdstuk } from "./Subthemahoofdstuk";
import { Blok, Feit, Groep, Kop } from "./Fiche";
import { Leeftijdkeuze } from "./Leeftijdkeuze";
import { Doeldetailblad } from "./Doeldetailblad";
import { Themadoelenoverzicht } from "./Themadoelenoverzicht";
import { Minimumdoelkoppelaar, Themaminimumdoelen } from "./Themaminimumdoelen";
import { themabalans } from "./themabalans";
import { useWoordwebs } from "./woordwebs";
import {
  useKoppelActiviteitdoel,
  useKoppelMinimumdoel,
  useKoppelSubdoel,
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
 * One thema, as a document rather than as a stack of tables.
 *
 * **The three earlier passes fixed controls; this one fixes the page.** The complaints were "too
 * many buttons", "everything the same size", "no consistency", "sloppy", and each was answered where
 * it was reported: icons instead of words, one shape for adding, the counts moved onto the headings.
 * The screen was still ugly afterwards, because none of that touched the reason. There was no
 * composition, only a stack: every object began at the same x, every object was the same width,
 * every gap was the same size. At 1440 that made an activiteit holding eight words a box eleven
 * hundred pixels wide, and it made three levels of nesting a matter of twenty pixels of indent.
 *
 * **So the page has a margin now, and the blocks hang off it as siblings.** `Fiche.tsx` holds the
 * grid and the argument. Here is what that buys, in order:
 *
 * - **The fiche has a measure, and the whole screen takes it.** A document measure rather than the
 *   default `80rem`, so the rows stop stretching to the width of the window. It is set on `Schermkop`
 *   and `Schermvlak` together via `smal`, which also CENTRES it. The first version put a 54rem
 *   wrapper inside the default measure, and that measure is left aligned: on a wide window it left a
 *   small gap on one side and a large one on the other, which reads as a mistake rather than as a
 *   margin (owner, 2026-08-31). Applying it to the header too is what keeps the title lined up with
 *   the fiche's margin.
 * - **The margin carries the figures**, so a section heading no longer has to be a count as well as
 *   a name, and the loudest thing in a block is not its add-button.
 * - **A subthema is a chapter, not a card**, at the same axis as the thema's own facts. The level a
 *   doel hangs on (Art. IX.2) is carried by the page's structure rather than by a border.
 * - **The labels of the thema's facts line up**, so the values start at one edge. Four labels of
 *   four different lengths put four values at four different x positions, which is the "slordig"
 *   the owner reported in its second form.
 *
 * **The subthema's are ordered by leeftijd** (the server's own order, from `/api/jaarfasen`), so the
 * ages group instead of arriving in insertion order. A thema is school-wide and its subthema's are
 * per age; two of them are usually two ages running side by side in two classes, not a sequence.
 *
 * **Nothing here claims anything about dekking.** A doel is gedekt when it is linked AND the thema
 * is placed in a plan (Art. V.1), and this screen knows nothing about any plan. The margin counts
 * links and the copy says "gekoppeld".
 *
 * **Each control is drawn only for whoever holds its row of the ADR-0030 §3 matrix** (E6-02 slice 4), decided in
 * `lib/rechten.ts`. The thema, its themadoelen and the doelsuggesties are directie's and themabeheer's. Deleting the
 * thema is directie's, and themabeheer's while the thema is empty (I26). The server also lets themabeheer delete a
 * thema holding only its own open wizard run's items, but this read does not carry a run's items, so that case waits
 * for E6-05. Each chapter asks about its own leeftijd.
 * Everyone reads the whole fiche. No sentence explains a missing control: on this screen most visitors read, and a
 * hint repeated per block is the prose this interface cuts first. Open doelsuggesties are shown only to whoever may
 * decide them, since for anyone else they are proposals waiting on somebody else (owner, 2026-09-14: kept hidden).
 * *Until fix round 1 this said no read carries the delete's fact at all; the empty thema is one it does carry.*
 */
export function ThemadetailScherm() {
  const { themaId } = useParams<{ themaId: string }>();
  const id = themaId ?? "";
  const { data: thema, isPending, isError } = useThema(themaId);
  const { data: suggesties } = useDoelsuggesties(themaId);
  const { data: jaarfasen } = useJaarfasen();
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
  // The doel whose detail is open (TB-016): a leerplandoel from any list on the page, or a minimumdoel from the doelen
  // per leeftijd (FB-009), and the row button that opened it, which gets focus back when the sheet closes.
  const [getoondDoel, setGetoondDoel] = useState<{
    code: string | null;
    ref: string | null;
    knop: HTMLElement;
  } | null>(null);
  const toonDoel = (code: string, knop: HTMLElement) => setGetoondDoel({ code, ref: null, knop });
  const toonMinimumdoel = (ref: string, knop: HTMLElement) => setGetoondDoel({ code: null, ref, knop });

  const wijzig = useWijzigThema(id);
  const verwijder = useVerwijderThema();
  const maakSubthema = useMaakSubthema(id);
  const wijzigSubthema = useWijzigSubthema(id);
  const verwijderSubthema = useVerwijderSubthema(id);
  const maakActiviteit = useMaakActiviteit(id);
  const wijzigActiviteit = useWijzigActiviteit(id);
  const verwijderActiviteit = useVerwijderActiviteit(id);
  const koppelMinimumdoel = useKoppelMinimumdoel(id);
  const ontkoppelMinimumdoel = useOntkoppelMinimumdoel(id);
  const koppelSubdoel = useKoppelSubdoel(id);
  const ontkoppelSubdoel = useOntkoppelSubdoel(id);
  const koppelActiviteitdoel = useKoppelActiviteitdoel(id);
  const ontkoppelActiviteitdoel = useOntkoppelActiviteitdoel(id);

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
    verwijder,
    verwijderSubthema,
    // The form shows its own refusal while it is open; once the rights closed it, this line does.
    ...(magSubthemaBlad ? [] : [maakSubthema, wijzigSubthema]),
  ]
    .map((mutatie) => geenToegangZin(mutatie.error))
    .find((zin) => zin !== null);

  return (
    <>
      {/* THE THEMA'S TWO CONTROLS ARE NOT UP HERE ANY MORE (owner, 2026-08-31: "het edit potloodje
          en trashcan zitten nog wat te verdoken in de hoek"). In the screen header they were two
          bare 36 pixel icons at the far right of a 1440 wide bar, eleven hundred pixels from the
          title they act on and with nothing around them to be read against. They now sit on the
          thema's own card, which is exactly the card whose contents the pencil opens for editing. */}
      <Schermkop smal titel={thema.naam} />

      <Schermvlak smal>
        <Terug />

        {/* WHAT THIS THEMA IS. The duration goes in the margin, where every other block keeps its
            measure, and the rest are labelled facts in one aligned column. Three of the four
            counts this block used to carry are gone from it entirely: they sat directly above the
            lists they counted, and each one now lives in the margin of the block that holds those
            lists. */}
        <Blok
          figuur={thema.duurWeken}
          onder={t(thema.duurWeken === 1 ? "themas.weekEen" : "themas.weekMeer")}
          acties={
            mag.themaBewerken || mag.themaVerwijderen(thema) ? (
              <>
                {mag.themaBewerken ? (
                  <Bewerkknop
                    omrand
                    label={t("themabeheer.bewerkAria", { naam: thema.naam })}
                    onClick={() => {
                      wijzig.reset();
                      setBewerkOpen(true);
                    }}
                  />
                ) : null}
                {mag.themaVerwijderen(thema) ? (
                  <Verwijderknop
                    omrand
                    label={t("themabeheer.verwijderAria", { naam: thema.naam })}
                    onClick={() => {
                      verwijder.reset();
                      setVerwijderOpen(true);
                    }}
                  />
                ) : null}
              </>
            ) : undefined
          }
        >
          <dl className="flex flex-col gap-2">
            {thema.invalshoeken ? (
              <Feit label={t("themabeheer.invalshoeken")}>{thema.invalshoeken}</Feit>
            ) : null}

            {/* The two vocabulary lists keep their full names rather than being shortened to
                "Kern" and "Rijk": they are Op.stap's own terms and a teacher meets them in the
                thema form under exactly these words. */}
            {thema.kernwoordenschat.length > 0 ? (
              <Feit label={t("themabeheer.kernwoordenschat")}>
                {thema.kernwoordenschat.join(" · ")}
              </Feit>
            ) : null}
            {thema.rijkeWoordenschat.length > 0 ? (
              <Feit label={t("themabeheer.rijkeWoordenschat")} zacht>
                {thema.rijkeWoordenschat.join(" · ")}
              </Feit>
            ) : null}

            {/* WHERE THE DOELEN ARE, AND WHERE THE HOLE IS (owner's pick, 2026-08-30). They hang
                at three depths and were nowhere added up, so the one question a teacher opens this
                screen with, "what still needs a doel", could only be answered by scrolling the
                whole page and counting. `gekoppeld`, never `gedekt`: see `themabalans.ts`. */}
            <Feit label={t("thema.doelenLabel")}>
              {balans.totaal === 0 ? (
                t("thema.geenDoelenGekoppeld")
              ) : (
                // Only the levels that carry something. A thema with two themadoelen and nothing
                // else would otherwise read "2 op het thema, 0 op subthema's, 0 op activiteiten",
                // which spends three facts to state one.
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Deel aantal={balans.themadoelen} woord="thema.doelenOpThema" />
                  <Deel aantal={balans.subdoelen} woord="thema.doelenOpSubthemas" />
                  <Deel aantal={balans.activiteitdoelen} woord="thema.doelenOpActiviteiten" />
                </span>
              )}
            </Feit>

            {/* Only when there is a hole, and it then states only what it counted. An activiteit
                with no doel at all can never contribute to coverage whatever else happens to it,
                which is what earns `attentie` here; the label carries the meaning without the
                colour (Art. XII). */}
            {balans.activiteitenZonderDoel > 0 ? (
              <Feit label={t("thema.zonderDoelLabel")}>
                <span className="font-medium text-attentie-inkt">
                  {telWoord(
                    balans.activiteitenZonderDoel,
                    "thema.zonderDoelEen",
                    "thema.zonderDoelMeer",
                  )}
                </span>
              </Feit>
            ) : null}
          </dl>
        </Blok>

        {/* THEMADOELEN AND DOELSUGGESTIES ARE ONE BLOCK. As a sibling section the suggesties cost a second heading, a
            second empty state and a permanent "Geen open suggesties" line.

            A themadoel is a minimumdoel (FB-043): each opens to its leeftijden, and each leeftijd to the leerplandoelen
            that lead there. The doelsuggesties still propose leerplandoelen; what becomes of them is another ticket.

            The AI half is unchanged where it counts (Art. IV): every suggestion is still shown
            with its motivation and still has to be accepted or rejected by hand, and "Vraag
            suggesties" is always reachable rather than appearing only when the list is empty. */}
        <Blok
          figuur={thema.minimumdoelen.length}
          onder={t(thema.minimumdoelen.length === 1 ? "themas.doelEen" : "themas.doelMeer")}
        >
          <Kop
            titel={t("thema.themadoelen")}
            icoon={<IcoonDoelen aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zacht" />}
            acties={
              mag.themaBewerken || mag.doelsuggestiesMaken ? (
                <>
                  {mag.themaBewerken ? (
                    <Minimumdoelkoppelaar
                      onKies={(ref) => koppelMinimumdoel.mutate(ref)}
                      bezig={koppelMinimumdoel.isPending}
                      alGekozen={thema.minimumdoelen.map((m) => m.minimumdoelRef)}
                    />
                  ) : null}
                  {/* Deliberately NOT a `Toevoegknop`, and it is the exception that makes the rule
                      legible: this does not add a themadoel, it asks the model for candidates that a
                      teacher then has to accept one by one (Art. IV). Directie and themabeheer only (R14). */}
                  {/* FB-042: the heading carries only "Vraag suggesties". It asks nothing yet: it swaps itself for the
                      choice, which reads on as the same phrase, "Vraag suggesties voor K3 L1", then the send button
                      that does call the model and so is the one ring on show (ADR-0039), and a way back. */}
                  {mag.doelsuggestiesMaken ? (
                    <div ref={vraagRef} className="contents">
                      {vraagOpen ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-meta text-inkt-zacht">{t("thema.suggestiesVragenVoor")}</span>
                          {jaarfasen ? (
                            <Leeftijdkeuze
                              jaarfasen={jaarfasen}
                              gekozen={gekozenLeeftijden}
                              onWijzig={setLeeftijdkeuze}
                            />
                          ) : null}
                          <AiKnop
                            className="h-9 min-h-9 px-2.5 text-meta"
                            bezig={genereer.isPending}
                            disabled={genereer.isPending || geenLeeftijd}
                            aria-describedby={geenLeeftijd ? "doelsuggesties-kies-leeftijd" : undefined}
                            onClick={verstuurVraag}
                          >
                            {genereer.isPending ? t("thema.suggestiesBezig") : t("thema.suggestiesVersturen")}
                          </AiKnop>
                          <Knop
                            className="h-9 min-h-9 px-2.5 text-meta"
                            disabled={genereer.isPending}
                            onClick={sluitVraag}
                          >
                            {t("thema.suggestiesAnnuleren")}
                          </Knop>
                        </div>
                      ) : (
                        <AiKnop
                          className="h-9 min-h-9 px-2.5 text-meta"
                          onClick={() => setVraagOpen(true)}
                        >
                          {t("thema.suggestiesVragen")}
                        </AiKnop>
                      )}
                    </div>
                  ) : null}
                </>
              ) : undefined
            }
          >
            {/* Why the AI button is disabled, directly under it, and only while it is. */}
            {mag.doelsuggestiesMaken && vraagOpen && geenLeeftijd ? (
              <p id="doelsuggesties-kies-leeftijd" className="mb-3 text-meta text-inkt-zacht">{t("thema.kiesLeeftijd")}</p>
            ) : null}

            {thema.minimumdoelen.length === 0 ? (
              <p className="text-meta text-inkt-zacht">{t("thema.geenThemadoelen")}</p>
            ) : (
              <Themaminimumdoelen
                koppelingen={thema.minimumdoelen}
                ontkoppelBezig={ontkoppelMinimumdoel.isPending}
                onOntkoppel={mag.themaBewerken ? (koppelingId) => ontkoppelMinimumdoel.mutate(koppelingId) : undefined}
                onToonDoel={toonDoel}
              />
            )}

            {/* A link that did not happen, other than a refusal (the page's line below says that): an already linked
                minimumdoel or one no longer loaded. The server's own Dutch sentence. */}
            {koppelMinimumdoel.isError && geenToegangZin(koppelMinimumdoel.error) === null ? (
              <p role="alert" className="mt-3 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                {koppelMinimumdoel.error instanceof ApiError && koppelMinimumdoel.error.detail
                  ? koppelMinimumdoel.error.detail
                  : t("thema.minimumdoelKoppelMislukt")}
              </p>
            ) : null}

            {/* A refusal's own Dutch sentence where the server wrote one (too many goals, no leeftijd). A 422 is a bad
                model answer and its detail is an English operator diagnostic (Art. II.3), so the catalogue line stands
                in for it. */}
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

            {/* Open suggestions, when there are any. They keep a white surface where the rest of
                this screen has none, and that is the point: everything else here is a fact to
                read, and these are the only objects on the page waiting for a decision.

                Only for whoever may make that decision (R14: directie and themabeheer). For anyone
                else a card waiting on somebody else's verdict is noise, and a card without its two
                buttons would read as a themadoel that is not one. Kept hidden by the owner's ruling
                (owner, 2026-09-14), asked after the slice 4 audit. */}
            {mag.doelsuggestiesBeoordelen && openSuggesties.length > 0 ? (
              <>
                <h3 className="mt-5 text-micro uppercase tracking-wide text-inkt-zacht">
                  {t("thema.suggesties")}
                </h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {openSuggesties.map((suggestie) => (
                    <li key={suggestie.id} className="rounded-kaart border border-lijn bg-kaart p-3 shadow-licht">
                      <div className="flex items-center gap-2">
                        {suggestie.doelsoort ? <Doelsoortmerk soort={suggestie.doelsoort} /> : null}
                        <span className="mono text-micro font-medium text-inkt-zacht">
                          {suggestie.leerplandoelCode}
                        </span>
                        <Statusmerk status={suggestie.status} className="ml-auto" />
                      </div>

                      {suggestie.tekst ? (
                        <p className="mt-1.5 text-body text-inkt">{suggestie.tekst}</p>
                      ) : null}

                      {suggestie.aiMotivatie ? (
                        <p className="mt-2 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">
                          {suggestie.aiMotivatie}
                        </p>
                      ) : null}

                      <div className="mt-3 flex gap-2">
                        <Knop
                          rang="hoofd"
                          className="h-9 min-h-9 px-3 text-meta"
                          disabled={beoordeel.isPending}
                          onClick={() =>
                            beoordeel.mutate({ suggestieId: suggestie.id, status: "Aanvaard" })
                          }
                        >
                          {t("thema.aanvaard")}
                        </Knop>
                        <Knop
                          rang="rustig"
                          className="h-9 min-h-9 px-3 text-meta"
                          disabled={beoordeel.isPending}
                          onClick={() =>
                            beoordeel.mutate({ suggestieId: suggestie.id, status: "Geweigerd" })
                          }
                        >
                          {t("thema.weiger")}
                        </Knop>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Kop>
        </Blok>

        {/* WHAT THE THEMA REACHES, PER LEEFTIJD (FB-009), between its anchors and the chapters it is computed from. */}
        <Themadoelenoverzicht themaId={id} onToonDoel={toonDoel} onToonMinimumdoel={toonMinimumdoel} />

        {/* THE HEADING AND ITS CHAPTERS SIT IN ONE TRAY (owner, 2026-08-31: "ik vind het wat
            verwarrend dat de subthemas niet een sectie is"). The chapters are still not nested
            INSIDE the heading's block: they are siblings hanging off the same margin, which is what
            keeps their leeftijd legible as an axis. What the tray adds is the boundary that says
            those siblings and that heading are one section. See `Groep`. */}
        <Groep>
        <Blok
          kaal
          strak
          figuur={thema.subthemas.length}
          onder={t(thema.subthemas.length === 1 ? "themas.subthemaEen" : "themas.subthemaMeer")}
        >
          <Kop
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
            {subthemas.length === 0 ? (
              <p className="text-meta text-inkt-zacht">{t("thema.geenSubthemas")}</p>
            ) : null}
          </Kop>
        </Blok>

        {subthemas.map((subthema) => (
          <Subthemahoofdstuk
            key={subthema.id}
            subthema={subthema}
            mag={mag}
            gevraagd={subthema.id === gevraagdSubthema}
            koppelenBezig={
              koppelSubdoel.isPending || ontkoppelSubdoel.isPending || koppelActiviteitdoel.isPending
            }
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
            onOntkoppelSubdoel={(subdoelId) =>
              ontkoppelSubdoel.mutate({ subthemaId: subthema.id, subdoelId })
            }
            onToonDoel={toonDoel}
            // Linking from the list uses the same mutation as the bewerk-blad, so a doel linked
            // here shows up there and both invalidate the same query. Removing one stays in the
            // blad: that needs a per-koppeling id, and putting a row of remove controls on a list
            // meant for scanning is how the card became a toolbar before.
            onKoppelActiviteitdoel={(activiteitId, code) =>
              koppelActiviteitdoel.mutate({ activiteitId, leerplandoelCode: code })
            }
          />
        ))}
        </Groep>
      </Schermvlak>

      <Doeldetailblad
        code={getoondDoel?.code ?? null}
        minimumdoelRef={getoondDoel?.ref ?? null}
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

      {activiteitBlad && bladSubthema ? (
        <Activiteitformulier
          open
          activiteit={bladActiviteit}
          // The facts rather than the form for a gebruiker who may not change this leeftijd's activiteiten; the goal
          // section for whoever may link goals there (R19), on an existing activiteit and on a new one's create.
          alleenLezen={bladActiviteit !== undefined && !mag.activiteitBewerken(bladSubthema.leeftijd)}
          magDoelen={mag.doelenKoppelen(bladSubthema.leeftijd)}
          onderzoeksvragen={bladSubthema.onderzoeksvragen}
          bezig={bladActiviteit ? wijzigActiviteit.isPending : maakActiviteit.isPending}
          fout={
            bladActiviteit
              ? wijzigActiviteit.isError
                ? wijzigActiviteit.error
                : undefined
              : maakActiviteit.isError
                ? maakActiviteit.error
                : undefined
          }
          koppelenBezig={koppelActiviteitdoel.isPending || ontkoppelActiviteitdoel.isPending}
          onKoppel={
            bladActiviteit
              ? (code) =>
                  koppelActiviteitdoel.mutate({
                    activiteitId: bladActiviteit.id,
                    leerplandoelCode: code,
                  })
              : undefined
          }
          onOntkoppel={
            bladActiviteit
              ? (koppelingId) =>
                  ontkoppelActiviteitdoel.mutate({ activiteitId: bladActiviteit.id, koppelingId })
              : undefined
          }
          onSluit={() => setActiviteitBlad(null)}
          onBewaar={(invoer) => {
            if (bladActiviteit) {
              wijzigActiviteit.mutate(
                { activiteitId: bladActiviteit.id, invoer },
                { onSuccess: () => setActiviteitBlad(null) },
              );
            } else {
              maakActiviteit.mutate(
                { subthemaId: bladSubthema.id, invoer },
                { onSuccess: () => setActiviteitBlad(null) },
              );
            }
          }}
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

/**
 * One level's share of the doelen: the figure in the mono face, the level in words.
 *
 * The same pairing the thema library card uses for its counts, and for the same reason: the number
 * carries the weight, the word steps back, and three of them read as three separate facts on one
 * line instead of as a sentence to parse. Renders nothing at all for a level that holds none.
 */
function Deel({ aantal, woord }: { aantal: number; woord: Vertaalsleutel }) {
  if (aantal === 0) return null;

  return (
    <span className="whitespace-nowrap">
      <span className="mono font-medium text-inkt">{aantal}</span> {t(woord)}
    </span>
  );
}

/**
 * What a doelsuggestie run did, in one line (TB-007): how many proposals it added, out of how many goals, of which
 * leeftijden. Every figure is read off the server's answer, so the line states what the run searched, not what the
 * buttons say now. With no candidates the server answers before calling the model, which is what that sentence claims.
 */
function resultaatZin(resultaat: DoelMatchResultaat): string {
  const leeftijden = opsomming(resultaat.jaarFasen);
  if (resultaat.aantalKandidaten === 0) return t("thema.suggestiesGeenDoelen", { leeftijden });

  const doelen = telWoord(resultaat.aantalKandidaten, "thema.kandidaatEen", "thema.kandidatenMeer");
  const nieuw = resultaat.bewaard.length;
  if (nieuw === 0) return t("thema.suggestiesGeenNieuwe", { doelen, leeftijden });
  return nieuw === 1
    ? t("thema.suggestiesEenNieuw", { doelen, leeftijden })
    : t("thema.suggestiesNieuw", { aantal: nieuw, doelen, leeftijden });
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
