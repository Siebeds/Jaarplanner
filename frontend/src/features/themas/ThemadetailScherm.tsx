import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Knop } from "../../components/ui/Knop";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak, Laadlijst } from "../../components/ui/Laadvlak";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { IcoonPlus } from "../../components/Iconen";
import {
  useBeoordeelSuggestie,
  useDoelsuggesties,
  useGenereerDoelsuggesties,
  useKlassen,
  useThema,
} from "../../lib/queries";
import { ApiError } from "../../lib/api";
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
 * One thema, top to bottom: what it is, which goals hang on it, and what each class built under it.
 *
 * **All three levels a goal can hang on are reachable here, and each says which level it is.** A
 * themadoel is school-wide, a subdoel belongs to one class's subthema, an activiteit's link belongs to
 * one activiteit (Art. IX.2). Those layers all count towards dekking, but only for a thema that is
 * placed in the plan, which is why nothing on this screen claims anything about coverage.
 *
 * **Read-only facts are text.** Woordenschat is a sentence, goal codes and soorten are text. Only
 * what acts carries an outline, so a card of facts stops looking like a toolbar.
 */
export function ThemadetailScherm() {
  const { themaId } = useParams<{ themaId: string }>();
  const id = themaId ?? "";
  const { data: thema, isPending, isError } = useThema(themaId);
  const { data: suggesties } = useDoelsuggesties(themaId);
  const { data: klassen } = useKlassen();
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
  const klasNaam = (klasId: string) => (klassen ?? []).find((k) => k.id === klasId)?.naam ?? null;

  // The at-a-glance figures, summed here rather than fetched: they are sums over data this screen
  // already holds, and a second endpoint would be a second thing that can disagree with it.
  const aantalActiviteiten = thema.subthemas.reduce((som, s) => som + s.activiteiten.length, 0);
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
          <div className="flex shrink-0 items-center gap-2">
            <Knop
              rang="rustig"
              className="h-9 min-h-9 px-3 text-meta"
              onClick={() => {
                wijzig.reset();
                setBewerkOpen(true);
              }}
            >
              {t("themabeheer.bewerk")}
            </Knop>
            <Knop
              rang="stil"
              className="h-9 min-h-9 px-3 text-meta"
              onClick={() => {
                verwijder.reset();
                setVerwijderOpen(true);
              }}
            >
              {t("themabeheer.verwijder")}
            </Knop>
          </div>
        }
      />

      <Schermvlak>
        <Terug />

        <p className="mono mt-3 text-meta text-inkt-zwak">
          {telWoord(thema.duurWeken, "thema.eenWeek", "thema.weken")} ·{" "}
          {telWoord(thema.subthemas.length, "thema.eenSubthema", "thema.subthemas")} ·{" "}
          {telWoord(aantalActiviteiten, "thema.eenActiviteit", "thema.activiteiten")} ·{" "}
          {telWoord(aantalDoelen, "thema.eenDoel", "thema.doelen")}
        </p>

        {thema.invalshoeken ? <p className="mt-3 text-body text-inkt">{thema.invalshoeken}</p> : null}

        {thema.kernwoordenschat.length > 0 || thema.rijkeWoordenschat.length > 0 ? (
          <Sectie titel={t("themabeheer.woordenschat")}>
            {thema.kernwoordenschat.length > 0 ? (
              <Woordenregel
                label={t("themabeheer.kernwoordenschat")}
                woorden={thema.kernwoordenschat}
                sterk
              />
            ) : null}
            {thema.rijkeWoordenschat.length > 0 ? (
              <Woordenregel label={t("themabeheer.rijkeWoordenschat")} woorden={thema.rijkeWoordenschat} />
            ) : null}
          </Sectie>
        ) : null}

        <Sectie
          titel={t("thema.themadoelen")}
          actie={
            <Doelkoppelaar
              onKies={(code) => koppelThemadoel.mutate(code)}
              bezig={koppelThemadoel.isPending}
              alGekozen={thema.themadoelen.map((td) => td.koppeling.leerplandoelCode)}
            />
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
        </Sectie>

        <Sectie
          titel={t("thema.suggesties")}
          actie={
            <Knop
              rang="rustig"
              className="h-9 min-h-9 px-3 text-meta"
              disabled={genereer.isPending}
              onClick={() => genereer.mutate()}
            >
              {genereer.isPending ? t("thema.suggestiesBezig") : t("thema.suggestiesVragen")}
            </Knop>
          }
        >
          {genereer.isError ? (
            <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {genereer.error instanceof ApiError && genereer.error.detail
                ? genereer.error.detail
                : t("thema.suggestiesMislukt")}
            </p>
          ) : null}

          {openSuggesties.length === 0 ? (
            <p className="text-meta text-inkt-zwak">{t("thema.geenSuggesties")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
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
          )}
        </Sectie>

        <Sectie
          titel={t("thema.subthemasTitel")}
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
                    klasNaam={klasNaam(subthema.klasId)}
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

function Sectie({ titel, actie, children }: { titel: string; actie?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-7 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-micro uppercase text-inkt-zwak">{titel}</h2>
        {actie}
      </div>
      {children}
    </section>
  );
}

/**
 * One vocabulary list, as a sentence.
 *
 * Words are read, not clicked, so they are text with a separator rather than a row of pills. The two
 * lists differ in weight: kernwoordenschat is what every child ends up with, rijke woordenschat is
 * the stretch, which is the same distinction the form's chips carry.
 */
function Woordenregel({ label, woorden, sterk }: { label: string; woorden: string[]; sterk?: boolean }) {
  return (
    <p className="text-body">
      <span className="text-micro uppercase text-inkt-zwak">{label}</span>{" "}
      <span className={sterk ? "text-inkt" : "text-inkt-zacht"}>{woorden.join(" · ")}</span>
    </p>
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
