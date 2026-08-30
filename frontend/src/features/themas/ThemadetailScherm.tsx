import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Knop } from "../../components/ui/Knop";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak, Laadlijst } from "../../components/ui/Laadvlak";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Bewerkknop, Verwijderknop } from "../../components/ui/Rijknoppen";
import { Toevoegknop } from "../../components/ui/Toevoegknop";
import {
  useBeoordeelSuggestie,
  useDoelsuggesties,
  useGenereerDoelsuggesties,
  useJaarfasen,
  useThema,
} from "../../lib/queries";
import { ApiError } from "../../lib/api";
import type { SubthemaWeergave } from "../../lib/types";
import { t, telWoord, type Vertaalsleutel } from "../../i18n";
import { Doelkoppelaar } from "../activiteiten/Doelkoppelaar";
import { Activiteitformulier, type ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import { Themaformulier } from "./Themaformulier";
import { Subthemaformulier } from "./Subthemaformulier";
import { Subthemahoofdstuk } from "./Subthemahoofdstuk";
import { Blok, Doellijst, Doelregel, Feit, Kop, Ontkoppel } from "./Fiche";
import { themabalans } from "./themabalans";
import {
  useKoppelActiviteitdoel,
  useKoppelSubdoel,
  useKoppelThemadoel,
  useMaakActiviteit,
  useMaakSubthema,
  useOntkoppelActiviteitdoel,
  useOntkoppelSubdoel,
  useOntkoppelThemadoel,
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
 * - **The fiche has a measure.** `54rem`, rather than the screen's full `80rem`. The rules and the
 *   rows stop stretching to the width of the window, and the leftover space on a wide screen reads
 *   as a margin instead of as a gap. A document is not improved by being wider.
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

  const [bewerkOpen, setBewerkOpen] = useState(false);
  const [verwijderOpen, setVerwijderOpen] = useState(false);
  // One piece of state per sheet, holding what it is editing. `{}` means "a new one"; two booleans
  // would allow the state where both are true.
  const [subthemaBlad, setSubthemaBlad] = useState<{ subthema?: SubthemaWeergave } | null>(null);
  const [teVerwijderenSubthema, setTeVerwijderenSubthema] = useState<SubthemaWeergave | null>(null);
  const [activiteitBlad, setActiviteitBlad] = useState<{
    subthemaId: string;
    activiteitId?: string;
  } | null>(null);
  const [teVerwijderenActiviteit, setTeVerwijderenActiviteit] = useState<ActiviteitMetKleur | null>(null);

  const wijzig = useWijzigThema(id);
  const verwijder = useVerwijderThema();
  const maakSubthema = useMaakSubthema(id);
  const wijzigSubthema = useWijzigSubthema(id);
  const verwijderSubthema = useVerwijderSubthema(id);
  const maakActiviteit = useMaakActiviteit(id);
  const wijzigActiviteit = useWijzigActiviteit(id);
  const verwijderActiviteit = useVerwijderActiviteit(id);
  const koppelThemadoel = useKoppelThemadoel(id);
  const ontkoppelThemadoel = useOntkoppelThemadoel(id);
  const koppelSubdoel = useKoppelSubdoel(id);
  const ontkoppelSubdoel = useOntkoppelSubdoel(id);
  const koppelActiviteitdoel = useKoppelActiviteitdoel(id);
  const ontkoppelActiviteitdoel = useOntkoppelActiviteitdoel(id);

  if (isError) {
    return (
      <>
        <Schermkop titel={t("themas.titel")} />
        <Schermvlak>
          <Leegte titel={t("thema.fout")} actie={<Terug />} />
        </Schermvlak>
      </>
    );
  }

  if (isPending || !thema) {
    return (
      <>
        <Schermkop titel={t("themas.titel")} />
        <Schermvlak>
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

  return (
    <>
      <Schermkop
        titel={thema.naam}
        rechts={
          <div className="flex shrink-0 items-center gap-0.5">
            <Bewerkknop
              label={t("themabeheer.bewerkAria", { naam: thema.naam })}
              onClick={() => {
                wijzig.reset();
                setBewerkOpen(true);
              }}
            />
            <Verwijderknop
              label={t("themabeheer.verwijderAria", { naam: thema.naam })}
              onClick={() => {
                verwijder.reset();
                setVerwijderOpen(true);
              }}
            />
          </div>
        }
      />

      <Schermvlak>
        {/* The fiche's own measure. Narrower than the screen on purpose: see the note at the top. */}
        <div className="max-w-[54rem]">
          <Terug />

          {/* WHAT THIS THEMA IS. The duration goes in the margin, where every other block keeps its
              measure, and the rest are labelled facts in one aligned column. Three of the four
              counts this block used to carry are gone from it entirely: they sat directly above the
              lists they counted, and each one now lives in the margin of the block that holds those
              lists. */}
          <Blok
            eerste
            figuur={thema.duurWeken}
            onder={t(thema.duurWeken === 1 ? "themas.weekEen" : "themas.weekMeer")}
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

          {/* THEMADOELEN AND DOELSUGGESTIES ARE ONE BLOCK. A doelsuggestie is a proposed themadoel:
              accepting one makes it a themadoel, in this very list. As a sibling section it cost a
              second heading, a second empty state and a permanent "Geen open suggesties" line.

              The AI half is unchanged where it counts (Art. IV): every suggestion is still shown
              with its motivation and still has to be accepted or rejected by hand, and "Vraag
              suggesties" is always reachable rather than appearing only when the list is empty. */}
          <Blok
            figuur={thema.themadoelen.length}
            onder={t(thema.themadoelen.length === 1 ? "themas.doelEen" : "themas.doelMeer")}
          >
            <Kop
              titel={t("thema.themadoelen")}
              acties={
                <>
                  <Doelkoppelaar
                    onKies={(code) => koppelThemadoel.mutate(code)}
                    bezig={koppelThemadoel.isPending}
                    alGekozen={thema.themadoelen.map((td) => td.koppeling.leerplandoelCode)}
                  />
                  {/* Deliberately NOT a `Toevoegknop`, and it is the exception that makes the rule
                      legible: this does not add a themadoel, it asks the model for candidates that a
                      teacher then has to accept one by one (Art. IV). */}
                  <Knop
                    rang="stil"
                    className="h-9 min-h-9 px-3 text-meta"
                    disabled={genereer.isPending}
                    onClick={() => genereer.mutate()}
                  >
                    {genereer.isPending ? t("thema.suggestiesBezig") : t("thema.suggestiesVragen")}
                  </Knop>
                </>
              }
            >
              {thema.themadoelen.length === 0 ? (
                <p className="text-meta text-inkt-zwak">{t("thema.geenThemadoelen")}</p>
              ) : (
                <Doellijst>
                  {thema.themadoelen.map((themadoel) => (
                    <Doelregel key={themadoel.id}>
                      <span className="mono min-w-0 truncate text-meta font-medium text-inkt">
                        {themadoel.koppeling.leerplandoelCode}
                      </span>
                      <Statusmerk status={themadoel.koppeling.status} className="ml-auto" />
                      <Ontkoppel
                        label={t("activiteit.ontkoppel", {
                          code: themadoel.koppeling.leerplandoelCode,
                        })}
                        bezig={ontkoppelThemadoel.isPending}
                        onClick={() => ontkoppelThemadoel.mutate(themadoel.id)}
                      />
                    </Doelregel>
                  ))}
                </Doellijst>
              )}

              {genereer.isError ? (
                <p className="mt-3 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
                  {genereer.error instanceof ApiError && genereer.error.detail
                    ? genereer.error.detail
                    : t("thema.suggestiesMislukt")}
                </p>
              ) : null}

              {/* Open suggestions, when there are any. They keep a white surface where the rest of
                  this screen has none, and that is the point: everything else here is a fact to
                  read, and these are the only objects on the page waiting for a decision. */}
              {openSuggesties.length > 0 ? (
                <>
                  <h3 className="mt-5 text-micro uppercase tracking-wide text-inkt-zwak">
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

          {/* The heading that introduces the chapters, and the one control that adds one. The
              chapters themselves are NOT nested under it: they are siblings hanging off the same
              margin, which is what keeps their leeftijd legible as an axis. */}
          <Blok
            figuur={thema.subthemas.length}
            onder={t(thema.subthemas.length === 1 ? "themas.subthemaEen" : "themas.subthemaMeer")}
          >
            <Kop
              titel={t("thema.subthemasTitel")}
              acties={
                <Toevoegknop
                  label={t("subthemabeheer.toevoegen")}
                  onClick={() => {
                    maakSubthema.reset();
                    setSubthemaBlad({});
                  }}
                />
              }
            >
              {subthemas.length === 0 ? (
                <p className="text-meta text-inkt-zwak">{t("thema.geenSubthemas")}</p>
              ) : null}
            </Kop>
          </Blok>

          {subthemas.map((subthema) => (
            <Subthemahoofdstuk
              key={subthema.id}
              subthema={subthema}
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
              // Linking from the list uses the same mutation as the bewerk-blad, so a doel linked
              // here shows up there and both invalidate the same query. Removing one stays in the
              // blad: that needs a per-koppeling id, and putting a row of remove controls on a list
              // meant for scanning is how the card became a toolbar before.
              onKoppelActiviteitdoel={(activiteitId, code) =>
                koppelActiviteitdoel.mutate({ activiteitId, leerplandoelCode: code })
              }
            />
          ))}
        </div>
      </Schermvlak>

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

      {subthemaBlad ? (
        <Subthemaformulier
          open
          subthema={subthemaBlad.subthema}
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
          onSluit={() => setSubthemaBlad(null)}
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
        gevolg={t("subthemabeheer.verwijderGevolg", {
          activiteiten: teVerwijderenSubthema?.activiteiten.length ?? 0,
          doelen: teVerwijderenSubthema?.subdoelen.length ?? 0,
        })}
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijderSubthema.isPending}
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
          line. */}
      {verwijderActiviteit.isError ? (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-24 z-50 rounded-veld border border-attentie/40 bg-attentie-zacht p-3 shadow-zweef sm:inset-x-auto sm:right-6 sm:w-96"
        >
          <p className="text-meta font-medium text-attentie-inkt">
            {verwijderActiviteit.error instanceof ApiError && verwijderActiviteit.error.detail
              ? verwijderActiviteit.error.detail
              : t("themabeheer.bewaarMislukt")}
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
      className="inline-flex h-9 items-center rounded-full border border-lijn px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-lijn-veld hover:text-inkt"
    >
      {t("thema.terug")}
    </Link>
  );
}
