import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Knop } from "../../components/ui/Knop";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak, Laadlijst } from "../../components/ui/Laadvlak";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Bewerkknop, Verwijderknop } from "../../components/ui/Rijknoppen";
import { IcoonPlus } from "../../components/Iconen";
import {
  useBeoordeelSuggestie,
  useDoelsuggesties,
  useGenereerDoelsuggesties,
  useThema,
} from "../../lib/queries";
import { ApiError } from "../../lib/api";
import { cn } from "../../lib/cn";
import type { SubthemaWeergave } from "../../lib/types";
import { t, telWoord } from "../../i18n";
import { Doelkoppelaar } from "../activiteiten/Doelkoppelaar";
import { Activiteitformulier, type ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import { Themaformulier } from "./Themaformulier";
import { Subthemaformulier } from "./Subthemaformulier";
import { Subthemakaart } from "./Subthemakaart";
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
 * One thema, top to bottom: what it is, which goals hang on it, and what was built under it per age.
 *
 * **All three levels a goal can hang on are reachable here, and each says which level it is.** A
 * themadoel is school-wide, a subdoel belongs to one age's subthema, an activiteit's link belongs to
 * one activiteit (Art. IX.2). Those layers all count towards dekking, but only for a thema that is
 * placed in the plan, which is why nothing on this screen claims anything about coverage.
 *
 * **Read-only facts are text.** Goal codes and soorten are text; what the thema IS is a label and
 * value table. Only what acts carries a surface, so a page of facts stops looking like a toolbar.
 *
 * **The 2026-08-30 pass was one complaint from the owner: everything was the same size.** Section
 * headings sat below the body text they introduced, the four counts were the faintest line on the
 * screen, an unlabelled sentence floated between them, and DOELSUGGESTIES took a heading, an empty
 * state and a button to report that nothing had been suggested. What each of those became, and why,
 * is written at the place it happened.
 */
export function ThemadetailScherm() {
  const { themaId } = useParams<{ themaId: string }>();
  const id = themaId ?? "";
  const { data: thema, isPending, isError } = useThema(themaId);
  const { data: suggesties } = useDoelsuggesties(themaId);
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

  // Every doel hanging anywhere under this thema, summed here rather than fetched: it is a sum over
  // data this screen already holds, and a second endpoint would be a second thing that can disagree
  // with it. Only the delete confirmation uses it now, to say what a delete takes with it; the
  // activiteit tally that used to sit beside it went with the counts line, because every card
  // already counts its own.
  const aantalDoelen =
    thema.themadoelen.length +
    thema.subthemas.reduce(
      (som, s) =>
        som + s.subdoelen.length + s.activiteiten.reduce((n, a) => n + a.doelkoppelingen.length, 0),
      0,
    );

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
        <Terug />

        {/* WHAT THIS THEMA IS, as one label-and-value table (owner, 2026-08-30: this whole block
            was "super onduidelijk").

            It was four separate shapes stacked: a grey monospace count line, an unlabelled sentence,
            and a WOORDENSCHAT section whose two rows each began with the word "woordenschat" again.
            Nothing said which parts were labels and which were content, because label and content
            were the same size and nearly the same colour.

            Now every fact is a label in the quiet column and its value in the loud one, so the eye
            can run down either column alone. Three of the old four counts are gone from here
            entirely: "1 subthema" sat directly above the list of subthema's and "1 activiteit" above
            the activiteiten, so they restated what they introduced. Each now lives on the section
            heading that counts it. Duur stays because nothing else on the page says how long this
            thema runs.

            `dl` and not a `div`: these ARE term and description, and a screen reader reading the
            page in order should get them paired rather than as eight loose strings. */}
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <Feit label={t("themabeheer.duur")}>
            {telWoord(thema.duurWeken, "thema.eenWeek", "thema.weken")}
          </Feit>

          {thema.invalshoeken ? (
            <Feit label={t("themabeheer.invalshoeken")}>{thema.invalshoeken}</Feit>
          ) : null}

          {/* The two vocabulary lists keep their full names rather than being shortened to "Kern"
              and "Rijk": they are Op.stap's own terms and a teacher meets them in the thema form
              under exactly these words. What was repetitive was the SECTION heading above them
              saying "Woordenschat" a third time, and that heading is what went. */}
          {thema.kernwoordenschat.length > 0 ? (
            <Feit label={t("themabeheer.kernwoordenschat")}>{thema.kernwoordenschat.join(" · ")}</Feit>
          ) : null}
          {thema.rijkeWoordenschat.length > 0 ? (
            <Feit label={t("themabeheer.rijkeWoordenschat")} zacht>
              {thema.rijkeWoordenschat.join(" · ")}
            </Feit>
          ) : null}
        </dl>

        {/* THEMADOELEN AND DOELSUGGESTIES ARE ONE SECTION NOW.
            A doelsuggestie is a proposed themadoel: accepting one makes it a themadoel, in this very
            list. As a sibling section it cost a second heading, a second empty state and a permanent
            "Geen open suggesties" line under it, so a thema with nothing suggested spent four lines
            and a button saying nothing had been suggested.

            The AI half is unchanged where it counts (Art. IV): every suggestion is still shown with
            its motivation and still has to be accepted or rejected by hand, and "Vraag suggesties"
            is still always reachable rather than appearing only when the list is empty: a teacher
            with two themadoelen may well want more. */}
        <Sectie
          titel={t("thema.themadoelen")}
          telling={telWoord(thema.themadoelen.length, "thema.eenDoel", "thema.doelen")}
          actie={
            <>
              <Knop
                rang="stil"
                className="h-9 min-h-9 px-3 text-meta"
                disabled={genereer.isPending}
                onClick={() => genereer.mutate()}
              >
                {genereer.isPending ? t("thema.suggestiesBezig") : t("thema.suggestiesVragen")}
              </Knop>
              <Doelkoppelaar
                onKies={(code) => koppelThemadoel.mutate(code)}
                bezig={koppelThemadoel.isPending}
                alGekozen={thema.themadoelen.map((td) => td.koppeling.leerplandoelCode)}
              />
            </>
          }
        >
          {thema.themadoelen.length === 0 ? (
            <p className="text-meta text-inkt-zwak">{t("thema.geenThemadoelen")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {thema.themadoelen.map((themadoel) => (
                <li
                  key={themadoel.id}
                  className="flex items-center gap-2 rounded-veld border border-lijn bg-kaart px-3 py-2"
                >
                  <span className="mono min-w-0 truncate text-meta font-medium text-inkt">
                    {themadoel.koppeling.leerplandoelCode}
                  </span>
                  <Statusmerk status={themadoel.koppeling.status} className="ml-auto" />
                  <Ontkoppel
                    label={t("activiteit.ontkoppel", { code: themadoel.koppeling.leerplandoelCode })}
                    bezig={ontkoppelThemadoel.isPending}
                    onClick={() => ontkoppelThemadoel.mutate(themadoel.id)}
                  />
                </li>
              ))}
            </ul>
          )}

          {genereer.isError ? (
            <p className="mt-3 rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {genereer.error instanceof ApiError && genereer.error.detail
                ? genereer.error.detail
                : t("thema.suggestiesMislukt")}
            </p>
          ) : null}

          {/* Open suggestions, when there are any. No empty state of their own: the section above
              already says whether there are themadoelen, and a second "nothing here" under it was
              the line the owner was looking at. */}
          {openSuggesties.length > 0 ? (
            <>
              <h3 className="mt-4 text-micro uppercase tracking-wide text-inkt-zwak">
                {t("thema.suggesties")}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
              {openSuggesties.map((suggestie) => (
                <li key={suggestie.id} className="rounded-kaart border border-lijn bg-kaart p-3">
                  <div className="flex items-center gap-2">
                    {suggestie.doelsoort ? <Doelsoortmerk soort={suggestie.doelsoort} /> : null}
                    <span className="mono text-micro font-medium text-inkt-zacht">
                      {suggestie.leerplandoelCode}
                    </span>
                    <Statusmerk status={suggestie.status} className="ml-auto" />
                  </div>

                  {suggestie.tekst ? <p className="mt-1.5 text-body text-inkt">{suggestie.tekst}</p> : null}

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
                      onClick={() => beoordeel.mutate({ suggestieId: suggestie.id, status: "Aanvaard" })}
                    >
                      {t("thema.aanvaard")}
                    </Knop>
                    <Knop
                      rang="rustig"
                      className="h-9 min-h-9 px-3 text-meta"
                      disabled={beoordeel.isPending}
                      onClick={() => beoordeel.mutate({ suggestieId: suggestie.id, status: "Geweigerd" })}
                    >
                      {t("thema.weiger")}
                    </Knop>
                  </div>
                </li>
              ))}
              </ul>
            </>
          ) : null}
        </Sectie>

        <Sectie
          titel={t("thema.subthemasTitel")}
          telling={telWoord(thema.subthemas.length, "thema.eenSubthema", "thema.subthemas")}
          actie={
            <Knop
              rang="rustig"
              className="h-9 min-h-9 px-3 text-meta"
              onClick={() => {
                maakSubthema.reset();
                setSubthemaBlad({});
              }}
            >
              <IcoonPlus aria-hidden="true" className="h-4 w-4" />
              {t("subthemabeheer.toevoegen")}
            </Knop>
          }
        >
          {thema.subthemas.length === 0 ? (
            <p className="text-meta text-inkt-zwak">{t("thema.geenSubthemas")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {thema.subthemas.map((subthema) => (
                <li key={subthema.id}>
                  <Subthemakaart
                    subthema={subthema}
                    koppelenBezig={
                      koppelSubdoel.isPending ||
                      ontkoppelSubdoel.isPending ||
                      koppelActiviteitdoel.isPending
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
                    // Linking from the list uses the same mutation as the bewerk-blad, so a doel
                    // linked here shows up there and both invalidate the same query. Removing one
                    // stays in the blad: that needs a per-koppeling id, and putting a row of remove
                    // controls on a card meant for scanning is how the card became a toolbar before.
                    onKoppelActiviteitdoel={(activiteitId, code) =>
                      koppelActiviteitdoel.mutate({ activiteitId, leerplandoelCode: code })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Sectie>
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
          doelen: aantalDoelen,
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
          activiteit that still sits in the weekplanning, and its own message names the day count that
          this screen does not have. */}
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
          server's sentence names how many days, which is why it is shown instead of a catalogue line. */}
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

/**
 * A section heading, its count, and whatever acts on it.
 *
 * **The heading was almost invisible and it is the page's own structure.** `text-micro` in
 * `inkt-zwak` put WOORDENSCHAT, THEMADOELEN and SUBTHEMA'S below the body text they introduced, so
 * five sections read as one undifferentiated column (owner, 2026-08-30). They are a step up in size
 * and ink now, and still uppercase and unbold: enough to be found, not enough to compete with the
 * content, which is the thing being looked for.
 *
 * **The count is a separate slot here and a phrase inside the card.** They are two different things:
 * `Blok` titles a list of three subdoelen and its whole title IS the sentence "3 subdoelen", while
 * this titles a named section that happens to hold a number. Putting "0 doelen" in the heading text
 * would have made the heading change its own name as content is added.
 */
function Sectie({
  titel,
  telling,
  actie,
  children,
}: {
  titel: string;
  /** How many of the thing this section is about, when the section is a list of countable things. */
  telling?: string;
  actie?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-lijn pb-2">
        <h2 className="flex items-baseline gap-2">
          <span className="text-meta font-semibold uppercase tracking-wide text-inkt-zacht">{titel}</span>
          {telling ? <span className="mono text-meta text-inkt-zwak">{telling}</span> : null}
        </h2>
        <div className="flex flex-wrap items-center gap-1">{actie}</div>
      </div>
      {children}
    </section>
  );
}

/**
 * One fact about the thema: what it is called, and what it says.
 *
 * A `dt`/`dd` pair in a two column grid, so the labels line up and the values start at one edge.
 * Everything above was previously label and value at the same size in the same line, which is the
 * reading the owner objected to: nothing said which half was the question.
 *
 * `zacht` is the one distinction the values carry. Kernwoordenschat is what every child ends up
 * with and rijke woordenschat is the stretch, the same distinction the thema form's chips make.
 */
function Feit({ label, zacht, children }: { label: string; zacht?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 text-micro uppercase tracking-wide text-inkt-zwak">{label}</dt>
      <dd className={cn("text-body", zacht ? "text-inkt-zacht" : "text-inkt")}>{children}</dd>
    </>
  );
}

/** A small remove control for a goal link, sitting next to the code it removes. */
function Ontkoppel({ label, bezig, onClick }: { label: string; bezig?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={bezig}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
    >
      <span aria-hidden="true" className="block h-[1.5px] w-3.5 bg-current" />
    </button>
  );
}
