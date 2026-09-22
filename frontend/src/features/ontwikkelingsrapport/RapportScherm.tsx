import { useId, useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, useParams } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Aandachtsmelding } from "../../components/ui/Aandachtsmelding";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { AiKnop, Knop } from "../../components/ui/Knop";
import { knopklassen } from "../../components/ui/knopklassen";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Tekstvlak } from "../../components/ui/Veld";
import { IcoonPijlLinks, IcoonPlus, IcoonVink, IcoonVuilbak } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { cn } from "../../lib/cn";
import { isGeenToegang, useRechten } from "../../lib/rechten";
import { t, telWoord } from "../../i18n";
import { useAutobewaren, type Bewaarstand } from "./autobewaren";
import { Foutregel } from "./Foutregel";
import { Subdoelregel } from "./RapportdoelenScherm";
import { rapportadres, rapportpad } from "./rapportdelen";
import { foutzin } from "./rapporthulp";
import {
  MAX_TEKENING_MB,
  MOMENTEN,
  TEKENINGTYPES,
  isMoment,
  tekeningadres,
  tekeningweigering,
  useBewaarBeoordeling,
  useBewaarBesluit,
  useBewaarTekening,
  useHerschrijf,
  useRapport,
  useVerwijderTekening,
  useWeigerHerschrijving,
  herschrijffout,
  type Herschrijfvoorstel,
  type Rapport,
  type Rapportregel,
} from "./rapporten";
import { useGradaties, type Gradatie, type Rapportsubdoel } from "./rapportset";
import { Rapportwissel } from "./Rapportwissel";
import { Ster, Sterlabel } from "./Ster";

/** The longest text per rapportdoel and the longest besluit: the server's `Ontwikkelingsrapport` limits. */
const MAX_TEKST = 2000;
const MAX_BESLUIT = 4000;

/**
 * One child's ontwikkelingsrapport at one evaluatiemoment (FB-003, FR-13.3, ADR-0035 §3.1): per rapportdoel of the K3
 * set a star and a text, and an algemeen besluit (R8, R9).
 *
 * **Laid out as the report the parents will get**: the child, then the rapportdoelen in the set's order, then the
 * besluit. What only the teacher sees, the subdoelen a rapportdoel bundles (R11), stays folded under a count. The star
 * choice is the one bold thing on the page: every star of the scale drawn with its label (Art. XII), the chosen one
 * filled in, so a report reads at a glance.
 *
 * **No save button.** A star is saved when chosen, a text after a pause in typing or when the field is left
 * (`useAutobewaren`), each rapportdoel on its own, so twenty reports do not hang on one forgotten button.
 *
 * **Who fills in is the server's** (`RapportInvullen`: admin, and the klas's K3 leerkrachten during its schooljaar,
 * R26). Anyone else who may read it gets the same report with no fields, and the one sentence that explains that is
 * said only when the schooljaar is the reason (`mag.rapportAlleenNogLezen`). Someone who may not read it at all gets the
 * server's refusal, also when they came by the address (R17).
 */
export function RapportScherm() {
  const { leerlingId = "", moment } = useParams();
  const nummer = Number(moment);
  if (!isMoment(nummer)) return <Navigate to={rapportadres(leerlingId, 1)} replace />;
  // Keyed on child and moment, so every field starts from what is stored for this report, never from the one before.
  return <Rapportinhoud key={`${leerlingId}/${nummer}`} leerlingId={leerlingId} moment={nummer} />;
}

function Rapportinhoud({ leerlingId, moment }: { leerlingId: string; moment: number }) {
  const { mag, laadt: rechtenLaden } = useRechten();
  const rapport = useRapport(leerlingId, moment);
  const gradaties = useGradaties();

  return (
    <>
      <Schermkop titel={t("ontwikkelingsrapport.titel")} smal zonderKat onder={<Rapportwissel />} />
      <Schermvlak smal>
        <div className="flex flex-col gap-5">
          <Link
            to={rapportpad("kinderen")}
            className="inline-flex min-h-9 items-center gap-1.5 self-start text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:text-inkt"
          >
            <IcoonPijlLinks aria-hidden="true" className="h-4 w-4" />
            {t("ontwikkelingsrapport.alleKinderen")}
          </Link>

          {rechtenLaden || rapport.isPending || gradaties.isPending ? (
            <Laadlijst rijen={4} />
          ) : rapport.isError ? (
            <Foutregel
              zin={
                isGeenToegang(rapport.error)
                  ? t("ontwikkelingsrapport.geenToegangRapport")
                  : foutzin(rapport.error, "ontwikkelingsrapport.rapportLaadFout")
              }
            />
          ) : gradaties.isError ? (
            <Foutregel zin={t("ontwikkelingsrapport.schaalLaadFout")} />
          ) : (
            <Rapportblad
              rapport={rapport.data}
              gradaties={gradaties.data}
              magInvullen={mag.rapportInvullen(rapport.data.klasId)}
              alleenNogLezen={mag.rapportAlleenNogLezen(rapport.data.klasId)}
            />
          )}
        </div>
      </Schermvlak>
    </>
  );
}

function Rapportblad({
  rapport,
  gradaties,
  magInvullen,
  alleenNogLezen,
}: {
  rapport: Rapport;
  gradaties: Gradatie[];
  magInvullen: boolean;
  alleenNogLezen: boolean;
}) {
  const kopId = useId();

  return (
    <article aria-labelledby={kopId} className="flex flex-col gap-5">
      <header className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={kopId} className="break-words font-display text-hoofdstuk text-inkt">
            {rapport.voornaam} {rapport.achternaam}
          </h2>
          <p className="text-meta text-inkt-zacht">
            {t("ontwikkelingsrapport.rapportVan", { klas: rapport.klasNaam, schooljaar: rapport.schooljaarNaam })}
          </p>
        </div>
        <Momentwissel leerlingId={rapport.leerlingId} />
      </header>

      {alleenNogLezen ? <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.rapportAlleenLezen")}</p> : null}
      {magInvullen && gradaties.length === 0 ? (
        <p className="text-meta text-inkt-zacht">{t("ontwikkelingsrapport.schaalLeeg")}</p>
      ) : null}

      {rapport.rapportdoelen.length === 0 ? (
        <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.rapportZonderDoelen")}</p>
      ) : (
        // One card with a rule between the rapportdoelen, as the children's list: the report is read down, like the
        // paper one.
        <ol className="divide-y divide-lijn rounded-kaart border border-lijn bg-kaart">
          {rapport.rapportdoelen.map((regel) => (
            <li key={regel.rapportdoelId}>
              {magInvullen ? (
                <Beoordelingveld leerlingId={rapport.leerlingId} moment={rapport.moment} regel={regel} gradaties={gradaties} />
              ) : (
                <Beoordelinglezen regel={regel} gradaties={gradaties} />
              )}
            </li>
          ))}
        </ol>
      )}

      <Tekeningvak rapport={rapport} magInvullen={magInvullen} />
      <Besluitvak rapport={rapport} magInvullen={magInvullen} />
    </article>
  );
}

// --- The kindtekening (FB-005). ---

/**
 * The one drawing of this report (R10), between the rapportdoelen and the besluit: under the work a teacher does per
 * child, so twenty reports are not twenty scrolls past a photo.
 *
 * **The drawing is the one bold thing in this block.** It lies centred on a mat of the page's deeper plane, like a
 * drawing pinned to a board, at its own proportions (its width and height are known, so nothing jumps while it loads).
 * The controls under it step back: no accent, which this interface spends elsewhere.
 *
 * **Only who may fill in the report gets the controls**, and the one line that asks for a photo of the drawing alone
 * (ADR-0035 §3.1: the app cannot check it, so it asks). Anyone else who may read the report sees the drawing and can
 * open it; the sentence that explains why there are no controls is the report's own, above.
 */
function Tekeningvak({ rapport, magInvullen }: { rapport: Rapport; magInvullen: boolean }) {
  const kopId = useId();
  const bewaar = useBewaarTekening(rapport.leerlingId, rapport.moment);
  const verwijder = useVerwijderTekening(rapport.leerlingId, rapport.moment);
  const [weigering, setWeigering] = useState<string | null>(null);
  const [bevestigen, setBevestigen] = useState(false);
  const [laadFout, setLaadFout] = useState(false);
  const tekening = rapport.tekening;

  function kies(bestand: File | undefined) {
    if (!bestand) return;
    const zin = tekeningweigering(bestand);
    setWeigering(zin);
    if (zin) return;
    verwijder.reset();
    setLaadFout(false);
    bewaar.mutate(bestand);
  }

  const stand: Bewaarstand = bewaar.isPending || verwijder.isPending ? "bezig" : bewaar.isSuccess ? "bewaard" : "rust";
  const fout = weigering ?? (bewaar.isError ? tekeningfout(bewaar.error) : null);

  return (
    <section aria-labelledby={kopId} className="flex flex-col gap-3 rounded-kaart border border-lijn bg-kaart px-4 py-4">
      <Blokkop id={kopId} titel={t("ontwikkelingsrapport.tekening")} stand={magInvullen ? stand : "rust"} />

      {tekening ? (
        <div className="flex justify-center rounded-veld bg-vlak-diep p-3 sm:p-5">
          {laadFout ? (
            <p className="py-6 text-body text-inkt-zacht">{t("ontwikkelingsrapport.tekeningLaadFout")}</p>
          ) : (
            <img
              src={tekeningadres(rapport.leerlingId, rapport.moment, tekening.versie)}
              alt={t("ontwikkelingsrapport.tekeningVan", { naam: rapport.voornaam })}
              width={tekening.breedte}
              height={tekening.hoogte}
              onError={() => setLaadFout(true)}
              className="h-auto max-h-[28rem] w-auto max-w-full rounded-[0.25rem] bg-kaart object-contain shadow-licht"
            />
          )}
        </div>
      ) : (
        // "Nog" only for who can still add one: to a reader after the schooljaar no drawing is coming.
        <p className="text-body text-inkt-zacht">
          {t(magInvullen ? "ontwikkelingsrapport.nogGeenTekening" : "ontwikkelingsrapport.geenTekening")}
        </p>
      )}

      {magInvullen ? (
        <p className="text-meta text-inkt-zacht">{t("ontwikkelingsrapport.tekeningUitleg", { mb: MAX_TEKENING_MB })}</p>
      ) : null}
      {fout ? <Aandachtsmelding>{fout}</Aandachtsmelding> : null}
      {verwijder.isError ? (
        <Aandachtsmelding>{foutzin(verwijder.error, "ontwikkelingsrapport.verwijderMislukt")}</Aandachtsmelding>
      ) : null}

      {magInvullen || tekening ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {magInvullen ? (
            <Bestandknop
              label={t(tekening ? "ontwikkelingsrapport.tekeningVervangen" : "ontwikkelingsrapport.tekeningToevoegen")}
              bezig={bewaar.isPending}
              onKies={kies}
            />
          ) : null}
          {magInvullen && tekening ? (
            <Knop rang="stil" onClick={() => setBevestigen(true)} disabled={verwijder.isPending || bewaar.isPending}>
              <IcoonVuilbak aria-hidden="true" className="h-4 w-4" />
              {t("ontwikkelingsrapport.tekeningVerwijderen")}
            </Knop>
          ) : null}
          {tekening && !laadFout ? (
            <a
              href={tekeningadres(rapport.leerlingId, rapport.moment, tekening.versie)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center text-meta font-medium text-inkt-zacht underline underline-offset-2 transition-colors duration-150 hover:text-inkt sm:ml-auto"
            >
              {t("ontwikkelingsrapport.tekeningOpenen")}
            </a>
          ) : null}
        </div>
      ) : null}

      <Bevestiging
        open={bevestigen}
        titel={t("ontwikkelingsrapport.tekeningVerwijderTitel")}
        gevolg={t("ontwikkelingsrapport.tekeningVerwijderGevolg")}
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijder.isPending}
        onSluit={() => setBevestigen(false)}
        onBevestig={() => {
          bewaar.reset();
          setWeigering(null);
          verwijder.mutate(undefined, { onSettled: () => setBevestigen(false) });
        }}
      />
    </section>
  );
}

/** The server's sentence for a refused drawing, and the size refusal for a request it stopped reading (413). */
function tekeningfout(fout: unknown): string {
  if (fout instanceof ApiError && fout.status === 413) {
    return t("ontwikkelingsrapport.tekeningTeGroot", { mb: MAX_TEKENING_MB });
  }
  return foutzin(fout, "ontwikkelingsrapport.tekeningNietBewaard");
}

/**
 * Choosing a photo, drawn as a button. The real `<input type="file">` sits inside the label, out of sight but in the tab
 * order, so it keeps its own keyboard behaviour and its name is the label's; the ring shows where the focus is. On a
 * phone the picker offers the camera as well. The value is cleared after each choice, so the same file can be chosen
 * again after a refusal.
 */
function Bestandknop({ label, bezig, onKies }: { label: string; bezig: boolean; onKies: (bestand: File | undefined) => void }) {
  return (
    <label
      className={cn(
        knopklassen("rustig"),
        "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        bezig && "pointer-events-none opacity-45",
      )}
    >
      <input
        type="file"
        accept={TEKENINGTYPES.join(",")}
        disabled={bezig}
        className="sr-only"
        onChange={(e) => {
          onKies(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <IcoonPlus aria-hidden="true" className="h-4 w-4" />
      {label}
    </label>
  );
}

/** Rapport 1, 2 and 3 of this child, each at its own address. Drawn like the part switch above it. */
function Momentwissel({ leerlingId }: { leerlingId: string }) {
  return (
    <nav aria-label={t("ontwikkelingsrapport.momenten")}>
      <ul className="inline-flex max-w-full rounded-veld border border-lijn bg-vlak-diep p-1">
        {MOMENTEN.map((moment) => (
          <li key={moment} className="shrink-0">
            <NavLink
              to={rapportadres(leerlingId, moment)}
              className={({ isActive }) =>
                cn(
                  "flex min-h-9 items-center whitespace-nowrap rounded-[0.5rem] border px-3 text-meta font-medium transition-colors duration-150",
                  // The outline in `inkt-zwak` is the state, as on `Segment`: it measures above 3:1 on the track.
                  isActive
                    ? "border-inkt-zwak bg-kaart text-inkt shadow-licht"
                    : "border-transparent text-inkt-zacht hover:text-inkt",
                )
              }
            >
              {t("ontwikkelingsrapport.rapport", { moment })}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// --- Filling in. ---

interface Beoordelingstand {
  gradatieId: string | null;
  tekst: string;
}

/** Whether two states would store the same thing: the server trims a text, so spaces at its ends change nothing. */
function zelfdeBeoordeling(a: Beoordelingstand, b: Beoordelingstand): boolean {
  return a.gradatieId === b.gradatieId && a.tekst.trim() === b.tekst.trim();
}

function zelfdeTekst(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

/** One rapportdoel to fill in: the star and the text, saved together as the teacher works. */
function Beoordelingveld({
  leerlingId,
  moment,
  regel,
  gradaties,
}: {
  leerlingId: string;
  moment: number;
  regel: Rapportregel;
  gradaties: Gradatie[];
}) {
  const bewaar = useBewaarBeoordeling(leerlingId, moment);
  const begin: Beoordelingstand = { gradatieId: regel.gradatieId, tekst: regel.tekst ?? "" };
  const [stand, setStand] = useState(begin);
  const automatisch = useAutobewaren(
    begin,
    (waarde) => bewaar.mutateAsync({ rapportdoelId: regel.rapportdoelId, invoer: waarde }),
    zelfdeBeoordeling,
  );

  function wijzig(volgende: Beoordelingstand, wanneer: "nu" | "straks") {
    setStand(volgende);
    automatisch.zet(volgende, wanneer);
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <Blokkop titel={regel.titel} stand={automatisch.stand} />
      <Sterkeuze
        titel={regel.titel}
        gradaties={gradaties}
        gekozen={stand.gradatieId}
        onKies={(gradatieId) => wijzig({ ...stand, gradatieId }, "nu")}
      />
      <Tekstvlak
        aria-label={t("ontwikkelingsrapport.tekstBij", { titel: regel.titel })}
        value={stand.tekst}
        maxLength={MAX_TEKST}
        onChange={(e) => wijzig({ ...stand, tekst: e.target.value }, "straks")}
        onBlur={() => automatisch.zet(stand, "nu")}
      />
      {automatisch.stand === "fout" ? (
        <Bewaarfout fout={automatisch.fout} onOpnieuw={() => void automatisch.opnieuw()} />
      ) : null}
      <Herschrijfvak
        leerlingId={leerlingId}
        moment={moment}
        rapportdoelId={regel.rapportdoelId}
        knoplabel={t("ontwikkelingsrapport.herschrijvenBij", { titel: regel.titel })}
        tekst={stand.tekst}
        maxLengte={MAX_TEKST}
        bezig={automatisch.stand === "bezig"}
        onOvergenomen={(nieuweTekst, zegel) => void neemOver(nieuweTekst, zegel)}
      />
      <Subdoelen subdoelen={regel.subdoelen} />
    </div>
  );

  /**
   * Taking an AI proposal over: one explicit save that carries the server's seal, not the automatic one, because only a
   * request with the seal can be found to be `aanvaard` (D13). The hook is then told what is stored, so its next pause
   * does not send the same text again without the seal.
   */
  async function neemOver(nieuweTekst: string, zegel: string) {
    const volgende = { ...stand, tekst: nieuweTekst };
    setStand(volgende);
    try {
      await bewaar.mutateAsync({
        rapportdoelId: regel.rapportdoelId,
        invoer: { ...volgende, herschrijving: zegel },
      });
      automatisch.meldBewaard(volgende);
    } catch {
      // Refused: the text stands on screen, so the automatic save takes it from here and shows its own sentence rather
      // than leaving the teacher with a proposal that quietly went nowhere.
      automatisch.zet(volgende, "nu");
    }
  }
}


/**
 * Having one text rewritten by the AI (FB-004, R21 to R25), under the field it belongs to.
 *
 * **The button appears only once there is a text**, because the AI reworks a text, it never writes one: a control that
 * could only be refused is not offered. It is an `AiKnop`, the one control kind that wears the rainbow ring (ADR-0039).
 *
 * **The notice about the names is here, at the button, and is said once** (R25): the panel opens on the click, so the
 * teacher reads it while the model is working and before she decides. It is not repeated per rapportdoel, because only
 * one panel is open at a time.
 *
 * **The proposal is editable in place.** That is the third decision of R23 without a third control: taking over an
 * edited text sends the seal too, the server finds it no longer covers this text, and stores `manueel`, which is what a
 * text the teacher shaped is.
 *
 * **Nothing here is stored until she decides.** The proposal lives in this component; closing the panel, or leaving the
 * screen, takes it with it.
 */
function Herschrijfvak({
  leerlingId,
  moment,
  rapportdoelId,
  knoplabel,
  tekst,
  maxLengte,
  bezig,
  onOvergenomen,
}: {
  leerlingId: string;
  moment: number;
  /** The rapportdoel whose text this is, or null for the algemeen besluit. */
  rapportdoelId: string | null;
  /** The button's accessible name: it says which text it works on, where the visible label cannot. */
  knoplabel: string;
  /** The text as it stands on screen. It is the only thing that goes to the AI (R21). */
  tekst: string;
  maxLengte: number;
  /** Whether an automatic save is on its way: a rewrite of a text still in flight would race it. */
  bezig: boolean;
  onOvergenomen: (tekst: string, zegel: string) => void;
}) {
  const herschrijf = useHerschrijf(leerlingId, moment);
  const weiger = useWeigerHerschrijving(leerlingId, moment);
  const [open, setOpen] = useState(false);
  const [voorstel, setVoorstel] = useState<Herschrijfvoorstel | null>(null);
  const [bewerkt, setBewerkt] = useState("");
  // The text as it stood when the AI was asked, held apart from the field. "Je eigen tekst" then names the text this
  // proposal was actually made for, also when the teacher keeps typing in the field while the panel is open. Showing
  // the live field there would put a heading over a text the proposal has nothing to do with.
  const [bron, setBron] = useState("");
  const eigenId = useId();
  const voorstelId = useId();

  if (tekst.trim() === "") return null;

  function vraag() {
    setOpen(true);
    setVoorstel(null);
    setBron(tekst);
    herschrijf.reset();
    weiger.reset();
    herschrijf.mutate(
      { rapportdoelId, tekst },
      {
        onSuccess: (gekregen) => {
          setVoorstel(gekregen);
          setBewerkt(gekregen.voorstel);
        },
      },
    );
  }

  function sluit() {
    setOpen(false);
    setVoorstel(null);
    herschrijf.reset();
    weiger.reset();
  }

  return (
    <div className="flex flex-col gap-3">
      <AiKnop
        className="self-start"
        aria-label={knoplabel}
        bezig={herschrijf.isPending}
        disabled={bezig || herschrijf.isPending}
        onClick={vraag}
      >
        {t("ontwikkelingsrapport.herschrijven")}
      </AiKnop>

      {open ? (
        <div
          className="flex flex-col gap-3 rounded-veld border border-lijn bg-vlak px-3 py-3"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              sluit();
            }
          }}
        >
          {/* R25: said before she decides, and never said twice, since one panel is open at a time. */}
          <p className="text-meta text-inkt-zacht">{t("ontwikkelingsrapport.herschrijfNamen")}</p>

          {herschrijf.isPending ? (
            <p aria-live="polite" className="text-meta text-inkt-zacht">
              {t("ontwikkelingsrapport.herschrijfBezig")}
            </p>
          ) : herschrijf.isError ? (
            <>
              <Aandachtsmelding>{herschrijffout(herschrijf.error)}</Aandachtsmelding>
              <Knop rang="stil" className="self-start" onClick={sluit}>
                {t("ontwikkelingsrapport.herschrijfSluiten")}
              </Knop>
            </>
          ) : voorstel ? (
            <>
              {/* Side by side from `sm`, stacked on a phone: two texts to compare, never two narrow columns. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <h4 id={eigenId} className="text-meta font-medium text-inkt-zacht">
                    {t("ontwikkelingsrapport.herschrijfEigen")}
                  </h4>
                  <p className="whitespace-pre-line break-words rounded-veld border border-lijn bg-kaart px-3 py-2 text-body text-inkt">
                    {bron}
                  </p>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <h4 id={voorstelId} className="text-meta font-medium text-inkt-zacht">
                    {t("ontwikkelingsrapport.herschrijfVoorstel")}
                  </h4>
                  <Tekstvlak
                    aria-labelledby={voorstelId}
                    rows={5}
                    value={bewerkt}
                    maxLength={maxLengte}
                    onChange={(e) => setBewerkt(e.target.value)}
                  />
                </div>
              </div>

              {weiger.isError ? (
                <Aandachtsmelding>{foutzin(weiger.error, "ontwikkelingsrapport.herschrijfWeigerenMislukt")}</Aandachtsmelding>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Knop
                  rang="hoofd"
                  disabled={bewerkt.trim() === "" || weiger.isPending}
                  onClick={() => {
                    onOvergenomen(bewerkt.trim(), voorstel.herschrijving);
                    sluit();
                  }}
                >
                  {t("ontwikkelingsrapport.herschrijfOvernemen")}
                </Knop>
                <Knop
                  rang="rustig"
                  disabled={weiger.isPending}
                  onClick={() =>
                    weiger.mutate({ rapportdoelId, herschrijving: voorstel.herschrijving }, { onSuccess: sluit })
                  }
                >
                  {weiger.isPending ? t("algemeen.bezig") : t("ontwikkelingsrapport.herschrijfWeigeren")}
                </Knop>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
/**
 * The scale as a row of choices, one per star and one for none: a radiogroup, so a keyboard user arrows through it.
 * A star offered is drawn hollow and the chosen one filled, with its outline as the state; every star carries its
 * label (Art. XII: never colour alone).
 */
function Sterkeuze({
  titel,
  gradaties,
  gekozen,
  onKies,
}: {
  titel: string;
  gradaties: Gradatie[];
  gekozen: string | null;
  onKies: (gradatieId: string | null) => void;
}) {
  const naam = useId();
  return (
    <fieldset>
      <legend className="sr-only">{t("ontwikkelingsrapport.sterVoor", { titel })}</legend>
      <div className="flex flex-wrap gap-2">
        {gradaties.map((gradatie) => (
          <Steroptie
            key={gradatie.id}
            naam={naam}
            gekozen={gekozen === gradatie.id}
            onKies={() => onKies(gradatie.id)}
            label={gradatie.label}
          >
            <Ster kleur={gradatie.kleur} hol={gekozen !== gradatie.id} />
          </Steroptie>
        ))}
        <Steroptie naam={naam} gekozen={gekozen === null} onKies={() => onKies(null)} label={t("ontwikkelingsrapport.geenSter")} />
      </div>
    </fieldset>
  );
}

function Steroptie({
  naam,
  gekozen,
  onKies,
  label,
  children,
}: {
  naam: string;
  gekozen: boolean;
  onKies: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name={naam} checked={gekozen} onChange={onKies} className="peer sr-only" />
      <span
        className={cn(
          "inline-flex min-h-9 items-center gap-2 rounded-veld border px-3 text-meta transition-colors duration-150",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          gekozen
            ? "border-inkt-zwak bg-kaart font-medium text-inkt shadow-licht"
            : "border-lijn text-inkt-zacht hover:border-lijn-sterk hover:text-inkt",
        )}
      >
        {children}
        {label}
      </span>
    </label>
  );
}

/** The algemeen besluit, set apart under the rapportdoelen: it closes the report. */
function Besluitvak({ rapport, magInvullen }: { rapport: Rapport; magInvullen: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-kaart border border-lijn bg-kaart px-4 py-4">
      {magInvullen ? (
        <Besluitveld leerlingId={rapport.leerlingId} moment={rapport.moment} begin={rapport.besluit ?? ""} />
      ) : (
        <>
          <h3 className="text-sectie text-inkt">{t("ontwikkelingsrapport.besluit")}</h3>
          <Leestekst tekst={rapport.besluit} leeg={t("ontwikkelingsrapport.nogGeenBesluit")} />
        </>
      )}
    </section>
  );
}

function Besluitveld({ leerlingId, moment, begin }: { leerlingId: string; moment: number; begin: string }) {
  const bewaar = useBewaarBesluit(leerlingId, moment);
  const [tekst, setTekst] = useState(begin);
  const automatisch = useAutobewaren(begin, (waarde) => bewaar.mutateAsync({ tekst: waarde }), zelfdeTekst);
  const kopId = useId();

  /** As the rapportdoel's: one explicit save with the seal, then the automatic one is told what is stored. */
  async function neemOver(nieuweTekst: string, zegel: string) {
    setTekst(nieuweTekst);
    try {
      await bewaar.mutateAsync({ tekst: nieuweTekst, herschrijving: zegel });
      automatisch.meldBewaard(nieuweTekst);
    } catch {
      automatisch.zet(nieuweTekst, "nu");
    }
  }

  return (
    <>
      <Blokkop id={kopId} titel={t("ontwikkelingsrapport.besluit")} stand={automatisch.stand} />
      <Tekstvlak
        aria-labelledby={kopId}
        rows={5}
        value={tekst}
        maxLength={MAX_BESLUIT}
        onChange={(e) => {
          setTekst(e.target.value);
          automatisch.zet(e.target.value, "straks");
        }}
        onBlur={() => automatisch.zet(tekst, "nu")}
      />
      {automatisch.stand === "fout" ? (
        <Bewaarfout fout={automatisch.fout} onOpnieuw={() => void automatisch.opnieuw()} />
      ) : null}
      <Herschrijfvak
        leerlingId={leerlingId}
        moment={moment}
        rapportdoelId={null}
        knoplabel={t("ontwikkelingsrapport.herschrijvenBesluit")}
        tekst={tekst}
        maxLengte={MAX_BESLUIT}
        bezig={automatisch.stand === "bezig"}
        onOvergenomen={(nieuweTekst, zegel) => void neemOver(nieuweTekst, zegel)}
      />
    </>
  );
}

/** A block's title with, at its right, whether what was typed is saved. */
function Blokkop({ id, titel, stand }: { id?: string; titel: string; stand: Bewaarstand }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 id={id} className="min-w-0 break-words text-sectie text-inkt">
        {titel}
      </h3>
      {/* Polite, and only the two calm states: a refusal is an alert of its own under the field. */}
      <p aria-live="polite" className="text-meta text-inkt-zacht">
        {stand === "bezig" ? (
          t("ontwikkelingsrapport.bewaren")
        ) : stand === "bewaard" ? (
          <span className="inline-flex items-center gap-1">
            <IcoonVink aria-hidden="true" className="h-3.5 w-3.5" />
            {t("ontwikkelingsrapport.bewaard")}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** A refused save: the server's own sentence where it gave one, and a way to try again. */
function Bewaarfout({ fout, onOpnieuw }: { fout: unknown; onOpnieuw: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-veld bg-attentie-zacht px-3 py-2">
      <p className="text-meta font-medium text-attentie-inkt">{foutzin(fout, "ontwikkelingsrapport.nietBewaard")}</p>
      <Knop rang="rustig" className="h-8 min-h-8 px-3 text-meta" onClick={onOpnieuw}>
        {t("ontwikkelingsrapport.opnieuwProberen")}
      </Knop>
    </div>
  );
}

// --- Reading. ---

/** One rapportdoel as someone who may only read the report sees it. */
function Beoordelinglezen({ regel, gradaties }: { regel: Rapportregel; gradaties: Gradatie[] }) {
  const gradatie = gradaties.find((kandidaat) => kandidaat.id === regel.gradatieId);
  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      <h3 className="break-words text-sectie text-inkt">{regel.titel}</h3>
      {gradatie ? (
        <Sterlabel kleur={gradatie.kleur} label={gradatie.label} />
      ) : (
        <p className="text-meta text-inkt-zacht">{t("ontwikkelingsrapport.nogGeenSter")}</p>
      )}
      <Leestekst tekst={regel.tekst} leeg={t("ontwikkelingsrapport.nogGeenTekst")} />
      <Subdoelen subdoelen={regel.subdoelen} />
    </div>
  );
}

/** A stored text with its line breaks, or what stands in for none. */
function Leestekst({ tekst, leeg }: { tekst: string | null; leeg: string }) {
  return tekst ? (
    <p className="whitespace-pre-line break-words text-body text-inkt">{tekst}</p>
  ) : (
    <p className="text-body text-inkt-zacht">{leeg}</p>
  );
}

/** What a rapportdoel bundles, folded under a count: for the teacher (R11), and only when asked for. */
function Subdoelen({ subdoelen }: { subdoelen: Rapportsubdoel[] }) {
  if (subdoelen.length === 0) return null;
  return (
    <details>
      <summary className="cursor-pointer text-meta text-inkt-zacht hover:text-inkt">
        {telWoord(subdoelen.length, "ontwikkelingsrapport.eenSubdoel", "ontwikkelingsrapport.aantalSubdoelen")}
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {subdoelen.map((subdoel) => (
          <li key={subdoel.id}>
            <Subdoelregel subdoel={subdoel} />
          </li>
        ))}
      </ul>
    </details>
  );
}
