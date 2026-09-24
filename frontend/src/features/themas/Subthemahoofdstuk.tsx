import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Actiemenu } from "../../components/ui/Actiemenu";
import { Doelmerk } from "../../components/ui/Doelmerk";
import { Verwijderknop } from "../../components/ui/Rijknoppen";
import { Knop } from "../../components/ui/Knop";
import { TEKSTLINK } from "../../components/ui/knopklassen";
import { Toevoegicoon, Toevoegknop } from "../../components/ui/Toevoegknop";
import { Invoer } from "../../components/ui/Veld";
import { IcoonDoelen, IcoonKruis, IcoonZoek } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { useLeerplandoelTeksten } from "../../lib/queries";
import type { Mag } from "../../lib/rechten";
import type { SubdoelvoorstelWeergave, SubthemaWeergave } from "../../lib/types";
import { KLEURSTAAL, kleurSleutel, type Activiteitkleur } from "../activiteiten/kleuren";
import type { ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import { Doelkiezer } from "../activiteiten/Doelkiezer";
import { Eigenaarmerk } from "../activiteiten/Eigenaarmerk";
import { Subkop, Vouwpijl } from "./Fiche";
import { Gekoppelddoel } from "./Gekoppelddoel";
import { ActiviteitvoorstelKnop, ActiviteitvoorstelMelding, Activiteitvoorstellen } from "./Activiteitvoorstellen";
import { Inklaplijst } from "./Inklaplijst";
import { opCode } from "./opCode";
import { Subdoelvoorstellen } from "./Subdoelplaatsing";
import { useActiviteitvoorstellen, useStelActiviteitenVoor } from "./voorgesteldeActiviteiten";
import { beslist, subthemabalans, type Drager } from "./subthemabalans";
import { Woordweb } from "./Woordweb";

/** How many activiteiten an opened subthema shows before "Alle … bekijken". */
export const VOORPROEF = 3;

/**
 * One subthema: a row in its leeftijd's list, which folds open (FB-094).
 *
 * **A row, not a card.** The subthema's of a leeftijd sit in one list divided by rules, with a title a step below the
 * page's own, so the page reads kop, subthema's, doelen instead of a stack of equal boxes.
 *
 * **The arrow is left of the title and one "…" holds the actions** (bewerken, verwijderen) for whoever may use them. The
 * row folds; the menu edits. Shut by default (FB-011), except the one a link from the agenda asked for (FB-037).
 *
 * **Folded, the row says what is inside it**: the duration, how many subdoelen an activiteit works out, the
 * activiteiten, and an open proposal or an activiteit without doel when there is one, so a fold can be scanned.
 *
 * **Opened, nothing is folded a second time.** The onderzoeksvraag and the woordweb on one side, the first activiteiten
 * with "Alle … bekijken", "Activiteit toevoegen" and the AI on the other. The subdoelen are the accounting on top of
 * that work: one line with their count and a link that shows them. A proposal waiting for a decision is never hidden.
 *
 * **Every control asks `mag` about THIS subthema's leeftijd** (E6-02, ADR-0030 §3): a hoofdleerkracht of K3 edits the
 * K3 one and reads the L1 one on the same page. What nobody here may change is not drawn, and an activiteit row still
 * opens, as its facts.
 */
export function Subthemahoofdstuk({
  subthema,
  gevraagd,
  mag,
  onBewerk,
  onVerwijder,
  onNieuweActiviteit,
  onBewerkActiviteit,
  onVerwijderActiviteit,
  onKoppelSubdoel,
  onOntkoppelSubdoel,
  onToonDoel,
  koppelenBezig,
  voorstellen = [],
  onBeslisVoorstel,
  beslisBezig,
}: {
  subthema: SubthemaWeergave;
  /** What the signed-in gebruiker may do, from `useRechten()` on the screen. */
  mag: Mag;
  /** The subthema a link from the agenda asked for (FB-037): it opens on arrival and is brought into view. */
  gevraagd?: boolean;
  onBewerk: () => void;
  onVerwijder: () => void;
  onNieuweActiviteit: () => void;
  onBewerkActiviteit: (activiteit: ActiviteitMetKleur) => void;
  onVerwijderActiviteit: (activiteit: ActiviteitMetKleur) => void;
  onKoppelSubdoel: (leerplandoelCode: string) => void;
  onOntkoppelSubdoel: (subdoelId: string) => void;
  /** Open the detail of a subdoel's leerplandoel; the page owns the one sheet it opens in (TB-016). */
  onToonDoel: (leerplandoelCode: string, knop: HTMLElement) => void;
  koppelenBezig?: boolean;
  /** The AI's open proposals to add a doel to this subthema (FB-057); only whoever may decide them is sent any. */
  voorstellen?: SubdoelvoorstelWeergave[];
  /** Absent without the right to decide them. */
  onBeslisVoorstel?: (voorstelId: string, status: "Aanvaard" | "Geweigerd") => void;
  beslisBezig?: boolean;
}) {
  const activiteiten = subthema.activiteiten as ActiviteitMetKleur[];
  const zonderDoel = activiteiten.filter((a) => a.doelkoppelingen.length === 0).length;
  const balans = subthemabalans(subthema);
  const activiteitenOpNaam = [...activiteiten].sort((a, b) => a.naam.localeCompare(b.naam, "nl", { numeric: true }));
  const subdoelenOpCode = [...subthema.subdoelen].sort((a, b) =>
    opCode(a.koppeling.leerplandoelCode, b.koppeling.leerplandoelCode),
  );
  // A doel search matches the doel's text too. The thema read carries it with each link (TB-017); a text it lacks is
  // fetched only once one of the two doel searches is used.
  const [doelZoekOpen, setDoelZoekOpen] = useState({ subdoelen: false, andere: false });
  const meegestuurdeTeksten = new Map<string, string>();
  for (const koppeling of [...subdoelenOpCode.map((s) => s.koppeling), ...balans.andereDoelen.map((d) => d.koppeling)]) {
    if (typeof koppeling.tekst === "string") meegestuurdeTeksten.set(koppeling.leerplandoelCode, koppeling.tekst);
  }
  const { teksten: doelteksten, laadt: doeltekstenLaden } = useLeerplandoelTeksten(
    [
      ...subdoelenOpCode.map((s) => s.koppeling.leerplandoelCode),
      ...balans.andereDoelen.map((d) => d.koppeling.leerplandoelCode),
    ].filter((code) => !meegestuurdeTeksten.has(code)),
    doelZoekOpen.subdoelen || doelZoekOpen.andere,
  );
  const doelZoektekst = (code: string) =>
    `${code} ${meegestuurdeTeksten.get(code) ?? doelteksten.get(code) ?? ""}`;
  // Local, and deliberately not persisted: shut on every visit (FB-011's default), except the one a link asked for.
  const [open, setOpen] = useState(gevraagd === true);
  const [subdoelenOpen, setSubdoelenOpen] = useState(false);
  // The subdoel search, opened from the first step (no subdoelen yet) or from the plus on the list's heading.
  const [koppelOpen, setKoppelOpen] = useState(false);
  const stapvak = useRef<HTMLElement>(null);
  const koppelplus = useRef<HTMLSpanElement>(null);
  // Closing hands the focus back to the control that opened the search, once it is drawn again.
  const sluitKoppelen = () => {
    setKoppelOpen(false);
    window.setTimeout(() => (stapvak.current ?? koppelplus.current)?.querySelector("button")?.focus(), 0);
  };
  // Folding the list closes its search too, so it does not reopen half-used.
  const wisselSubdoelen = () => {
    if (subdoelenOpen) setKoppelOpen(false);
    setSubdoelenOpen(!subdoelenOpen);
  };
  // After the first subdoel the first step is gone; the focus goes to the line that now counts it.
  const subdoelenlink = useRef<HTMLButtonElement>(null);
  const eersteGekoppeld = useRef(false);
  const aantalSubdoelen = subthema.subdoelen.length;
  useEffect(() => {
    if (!eersteGekoppeld.current || aantalSubdoelen === 0) return;
    eersteGekoppeld.current = false;
    subdoelenlink.current?.focus();
  }, [aantalSubdoelen]);
  const vouwknop = useRef<HTMLButtonElement>(null);
  // Into view, with focus on its fold, so a keyboard or screen-reader user lands where the link pointed.
  useEffect(() => {
    if (!gevraagd) return;
    vouwknop.current?.focus({ preventScroll: true });
    // Optional call: jsdom has no scrollIntoView.
    vouwknop.current?.scrollIntoView?.({ block: "start" });
  }, [gevraagd]);

  const leeftijd = subthema.leeftijd;
  const magSubthema = mag.subthemaBeheren(leeftijd);
  // A new activiteit is the gebruiker's own, or for a hoofdleerkracht a shared one by choice (ADR-0049 D1, D2).
  const magActiviteit = mag.activiteitMaken(leeftijd);
  const magSubdoelen = mag.subdoelenBeheren(leeftijd);
  const geenSubdoelen = subthema.subdoelen.length === 0;
  // What the AI's activiteiten work out: the decided subdoelen, as the server counts them (ADR-0056).
  const besliteSubdoelen = subthema.subdoelen.filter((s) => beslist(s.koppeling.status)).length;
  // AI activiteiten (FB-025): whoever may make an own activiteit here, since an accepted one becomes hers (ADR-0056 D1).
  // The open proposals are fetched only while the subthema is open.
  const magVoorstellen = mag.eigenActiviteitMaken(leeftijd);
  const activiteitvoorstellen = useActiviteitvoorstellen(subthema.id, open && magVoorstellen);
  const stelVoor = useStelActiviteitenVoor(subthema.id);

  // The subdoelen figure comes first: a subthema is built from its subdoelen and its activiteiten work them out
  // (FB-048), and it says how many an activiteit already works out (FB-010).
  const subdoelenZin =
    subthema.subdoelen.length > 0
      ? t(subthema.subdoelen.length === 1 ? "thema.subdoelInActiviteitEen" : "thema.subdoelenInActiviteit", {
          aantal: balans.subdoelenInActiviteit,
          totaal: subthema.subdoelen.length,
        })
      : telWoord(0, "thema.eenSubdoel", "thema.subdoelen");

  // The duration always shows; the rest only while shut, since opened the lists say it themselves.
  const feiten: ReactNode[] = [telWoord(subthema.duurWeken, "thema.eenWeek", "thema.weken")];
  if (!open) {
    feiten.push(subdoelenZin, telWoord(activiteiten.length, "thema.eenActiviteit", "thema.activiteiten"));
    // A shut subthema must not hide a proposal waiting for a decision (FB-057, FB-011's default).
    if (voorstellen.length > 0) {
      feiten.push(
        <span className="font-medium text-inkt">
          {telWoord(voorstellen.length, "plaatsing.eenOpenVoorstel", "plaatsing.openVoorstellen")}
        </span>,
      );
    }
    if (zonderDoel > 0) {
      feiten.push(
        <span className="font-medium text-attentie-inkt">
          {telWoord(zonderDoel, "thema.eenZonderDoel", "thema.aantalZonderDoel")}
        </span>,
      );
    }
  }

  return (
    <div className="px-1 py-1 sm:px-2">
      <div className="flex items-start gap-1">
        <h4 className="min-w-0 flex-1">
          <button
            ref={vouwknop}
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex min-h-raak w-full scroll-mt-6 items-start gap-2 rounded-veld px-2 py-2.5 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
          >
            <Vouwpijl open={open} className="mt-0.5" />
            <span className="min-w-0">
              <span className="block font-display text-sectie text-inkt">
                {subthema.naam}
                {/* The group's heading says the leeftijd once, which a screen reader moving from heading to heading
                    may skip; so each fold names it too (FB-047). */}
                <span className="sr-only">{t("thema.subthemaLeeftijd", { leeftijd })}</span>
              </span>
              <span className="mt-0.5 block text-meta text-inkt-zacht">
                {feiten.map((feit, i) => (
                  <Fragment key={i}>
                    {i > 0 ? ", " : null}
                    <span>{feit}</span>
                  </Fragment>
                ))}
              </span>
            </span>
          </button>
        </h4>
        <Actiemenu
          className="mt-0.5"
          label={t("subthemabeheer.menuAria", { naam: subthema.naam })}
          acties={
            magSubthema
              ? [
                  { label: t("themabeheer.bewerk"), soort: "bewerk", onSelect: onBewerk },
                  { label: t("themabeheer.verwijder"), soort: "verwijder", onSelect: onVerwijder },
                ]
              : []
          }
        />
      </div>

      {open ? (
        <div className="px-2 pb-4 pt-2 sm:pl-9 sm:pr-3">
          {/* WITHOUT SUBDOELEN, THE FIRST STEP COMES FIRST, over both columns: linking them is what the rest of the
              subthema, and the AI's activiteiten, wait for. Its search replaces it in place, at full width. */}
          {geenSubdoelen && magSubdoelen ? (
            koppelOpen ? (
              <Subdoelkoppelvak
                titel={t("thema.subdoelKoppelen")}
                onKies={(code) => {
                  eersteGekoppeld.current = true;
                  onKoppelSubdoel(code);
                }}
                bezig={koppelenBezig}
                alGekozen={[]}
                onSluit={sluitKoppelen}
              />
            ) : (
              <section
                ref={stapvak}
                aria-labelledby={`${subthema.id}-begin`}
                className="mb-6 flex flex-col gap-3 rounded-veld border border-lijn bg-vlak px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="flex items-start gap-3">
                  <IcoonDoelen aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-inkt-zacht" />
                  <div>
                    <h5 id={`${subthema.id}-begin`} className="text-body font-semibold text-inkt">
                      {t("thema.beginSubdoelenTitel")}
                    </h5>
                    <p className="mt-0.5 text-meta text-inkt-zacht">{t("thema.beginSubdoelenUitleg")}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <Toevoegknop
                    label={t("thema.subdoelKoppelen")}
                    aria-label={t("thema.subdoelKoppelenAan", { naam: subthema.naam })}
                    disabled={koppelenBezig}
                    onClick={() => setKoppelOpen(true)}
                  />
                </div>
              </section>
            )
          ) : null}

          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            <div className="flex min-w-0 flex-col gap-6">
              {/* The onderzoeksvraag is the most characteristic object in this domain: a kennisrijk thema is driven by
                  a question (Art. IX), so it is set at reading size, with its probleemstelling smaller under it. */}
              {subthema.onderzoeksvragen.length > 0 ? (
                <Subkop
                  titel={t(
                    subthema.onderzoeksvragen.length === 1 ? "thema.onderzoeksvraagTitel" : "thema.onderzoeksvragenTitel",
                  )}
                >
                  <ul className="flex flex-col gap-2.5">
                    {subthema.onderzoeksvragen.map((vraag) => (
                      <li key={vraag.id}>
                        <p className="text-sectie text-inkt">{vraag.vraag}</p>
                        {vraag.probleemstelling ? (
                          <p className="mt-0.5 text-meta text-inkt-zacht">{vraag.probleemstelling}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Subkop>
              ) : null}
              {/* Mounted only while open, so a folded page asks for no woordwebs at all. */}
              <Woordweb subthemaId={subthema.id} naam={subthema.naam} />
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <Activiteitenlijst
                activiteiten={activiteitenOpNaam}
                render={(activiteit) => (
                  <Activiteitregel
                    activiteit={activiteit}
                    magBewerken={mag.activiteitInhoudBewerken({ ...activiteit, leeftijd })}
                    onBewerk={() => onBewerkActiviteit(activiteit)}
                    onVerwijder={
                      mag.activiteitVerwijderen({ ...activiteit, leeftijd })
                        ? () => onVerwijderActiviteit(activiteit)
                        : undefined
                    }
                  />
                )}
              />
              {magActiviteit || magVoorstellen ? (
                <div className="flex flex-wrap items-center gap-2">
                  {magActiviteit ? (
                    <Toevoegknop label={t("activiteit.toevoegen")} onClick={onNieuweActiviteit} />
                  ) : null}
                  {/* The AI's activiteit proposals (FB-025), only once there is a decided subdoel for them to work
                      out: the server refuses the request before that, and a control that cannot act is not drawn. */}
                  {magVoorstellen && besliteSubdoelen > 0 ? <ActiviteitvoorstelKnop stelVoor={stelVoor} /> : null}
                </div>
              ) : null}
              {magVoorstellen && besliteSubdoelen === 0 ? (
                <p className="text-meta text-inkt-zacht">
                  {t(geenSubdoelen ? "activiteitvoorstel.naSubdoelen" : "activiteitvoorstel.naBeslistSubdoel")}
                </p>
              ) : null}
              {/* THE SUBDOELEN AS ONE LINE, with a link that shows them: the accounting on top of the work above. The
                  link is there only when there is something to show; without subdoelen the first step above says it,
                  and a reader who may not link one gets the one line. */}
              {!geenSubdoelen ? (
                <p className="flex flex-wrap items-center gap-x-1 text-meta text-inkt-zacht">
                  <span>{subdoelenZin}.</span>
                  <button
                    type="button"
                    ref={subdoelenlink}
                    aria-expanded={subdoelenOpen}
                    onClick={() => wisselSubdoelen()}
                    className={TEKSTLINK}
                  >
                    {t(subdoelenOpen ? "thema.subdoelenVerbergen" : "thema.subdoelenBekijken")}
                  </button>
                </p>
              ) : !magSubdoelen || balans.andereDoelen.length > 0 ? (
                <p className="flex flex-wrap items-center gap-x-1 text-meta text-inkt-zacht">
                  {magSubdoelen ? null : <span>{t("thema.geenSubdoelen")}</span>}
                  {balans.andereDoelen.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={subdoelenOpen}
                      onClick={() => wisselSubdoelen()}
                      className={TEKSTLINK}
                    >
                      {t(subdoelenOpen ? "thema.andereDoelenVerbergen" : "thema.andereDoelenBekijken")}
                    </button>
                  ) : null}
                </p>
              ) : null}
              {magVoorstellen ? (
                <>
                  <ActiviteitvoorstelMelding stelVoor={stelVoor} />
                  <Activiteitvoorstellen
                    subthemaId={subthema.id}
                    voorstellen={activiteitvoorstellen.data ?? []}
                    onToon={onToonDoel}
                  />
                </>
              ) : null}
            </div>
          </div>

          {subdoelenOpen ? (
            <div className="mt-6 flex flex-col gap-4 border-t border-lijn pt-4">
              {geenSubdoelen ? null : (
                <Subkop
                  titel={t("thema.subdoelenTitel")}
                  acties={
                    !magSubdoelen ? undefined : koppelOpen ? (
                      <Knop rang="stil" className="sm:h-9 sm:min-h-9 px-3 text-meta" onClick={sluitKoppelen}>
                        {t("themabeheer.annuleer")}
                      </Knop>
                    ) : (
                      <span ref={koppelplus}>
                        <Toevoegicoon
                          label={t("thema.koppelAanSubthema", { naam: subthema.naam })}
                          disabled={koppelenBezig}
                          onClick={() => setKoppelOpen(true)}
                        />
                      </span>
                    )
                  }
                >
                  {/* The search under the heading, at the list's full width, its results above the list they add to. */}
                  {magSubdoelen && koppelOpen ? (
                    <div className="mb-3">
                      <Doelkiezer
                        autoFocus
                        onKies={(code) => {
                          onKoppelSubdoel(code);
                          sluitKoppelen();
                        }}
                        bezig={koppelenBezig}
                        alGekozen={subthema.subdoelen.map((s) => s.koppeling.leerplandoelCode)}
                      />
                    </div>
                  ) : null}
                  <Inklaplijst
                    altijdOpen
                    items={subdoelenOpCode}
                    sleutel={(subdoel) => subdoel.id}
                    lijstnaam={t("thema.lijstSubdoelen")}
                    zoekPlaatshouder={t("thema.zoekDoel")}
                    zoektekst={(subdoel) => doelZoektekst(subdoel.koppeling.leerplandoelCode)}
                    zoekLaadt={doeltekstenLaden}
                    onZoekOpen={(zoekt) => setDoelZoekOpen((huidig) => ({ ...huidig, subdoelen: zoekt }))}
                    render={(subdoel) => (
                      <Gekoppelddoel
                        koppeling={subdoel.koppeling}
                        ontkoppelLabel={t("activiteit.ontkoppel", { code: subdoel.koppeling.leerplandoelCode })}
                        ontkoppelBezig={koppelenBezig}
                        onOntkoppel={magSubdoelen ? () => onOntkoppelSubdoel(subdoel.id) : undefined}
                        onToon={onToonDoel}
                        voet={subdoelvoet(
                          balans.dragersPerSubdoel.get(subdoel.id) ?? [],
                          beslist(subdoel.koppeling.status),
                        )}
                      />
                    )}
                  />
                </Subkop>
              )}

              {/* WHAT THE ACTIVITEITEN OFFER BESIDES THE SUBDOELEN (FB-010), apart, so "a doel of this subthema" and "a
                  doel one of its activiteiten happens to carry" are never one list. Read only. */}
              {balans.andereDoelen.length > 0 ? (
                <Subkop titel={t("thema.andereDoelenTitel")}>
                  <Inklaplijst
                    altijdOpen
                    items={balans.andereDoelen}
                    sleutel={(doel) => doel.koppeling.leerplandoelCode}
                    lijstnaam={t("thema.lijstAndereDoelen")}
                    zoekPlaatshouder={t("thema.zoekDoel")}
                    zoektekst={(doel) => doelZoektekst(doel.koppeling.leerplandoelCode)}
                    zoekLaadt={doeltekstenLaden}
                    onZoekOpen={(zoekt) => setDoelZoekOpen((huidig) => ({ ...huidig, andere: zoekt }))}
                    render={({ koppeling, dragers }) => (
                      <Gekoppelddoel
                        koppeling={koppeling}
                        ontkoppelLabel={t("activiteit.ontkoppel", { code: koppeling.leerplandoelCode })}
                        onToon={onToonDoel}
                        voet={<Dragers dragers={dragers} />}
                      />
                    )}
                  />
                </Subkop>
              ) : null}
            </div>
          ) : null}

          {/* The AI's open subdoel proposals (FB-057), outside the link: a proposal waiting for a decision is never
              hidden. */}
          <Subdoelvoorstellen voorstellen={voorstellen} bezig={beslisBezig} onBeslis={onBeslisVoorstel} onToon={onToonDoel} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Linking the first subdoel (FB-094): the search in its own section, at full width, with Annuleren in its heading and
 * the results under the field. It closes after a pick; the subdoel then shows in the line under the activiteiten.
 */
function Subdoelkoppelvak({
  titel,
  onKies,
  bezig,
  alGekozen,
  onSluit,
}: {
  titel: string;
  onKies: (leerplandoelCode: string) => void;
  bezig?: boolean;
  alGekozen: string[];
  onSluit: () => void;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mb-6 rounded-veld border border-lijn px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <h5 id={id} className="text-body font-semibold text-inkt">
          {titel}
        </h5>
        <Knop rang="stil" className="sm:h-9 sm:min-h-9 px-3 text-meta" onClick={onSluit}>
          {t("themabeheer.annuleer")}
        </Knop>
      </div>
      <div className="mt-2">
        <Doelkiezer
          autoFocus
          onKies={(code) => {
            onKies(code);
            onSluit();
          }}
          bezig={bezig}
          alGekozen={alGekozen}
        />
      </div>
    </section>
  );
}

/**
 * The activiteiten of an opened subthema: the first `VOORPROEF` by name, then "Alle … bekijken" for the rest. The search
 * icon finds one by name, soort or hoek in the whole list and shows every match.
 */
function Activiteitenlijst({
  activiteiten,
  render,
}: {
  activiteiten: ActiviteitMetKleur[];
  render: (activiteit: ActiviteitMetKleur) => ReactNode;
}) {
  const [alle, setAlle] = useState(false);
  const [zoekOpen, setZoekOpen] = useState(false);
  const [zoek, setZoek] = useState("");
  const zoekknop = useRef<HTMLButtonElement>(null);
  const term = normaliseer(zoek.trim());
  const zoekt = zoekOpen && term.length > 0;
  const gevonden = zoekt
    ? activiteiten.filter((activiteit) =>
        normaliseer(
          [
            activiteit.naam,
            activiteit.activiteitType ? t(`activiteitsoort.${activiteit.activiteitType}`) : "",
            activiteit.hoek ?? "",
          ].join(" "),
        ).includes(term),
      )
    : activiteiten;
  const getoond = zoekt || alle ? gevonden : activiteiten.slice(0, VOORPROEF);
  const meer = activiteiten.length > VOORPROEF;
  const zoekLabel = t("lijst.zoekIn", { lijst: t("thema.lijstActiviteiten") });
  const sluitLabel = t("lijst.zoekSluit", { lijst: t("thema.lijstActiviteiten") });
  const sluitZoek = () => {
    setZoek("");
    setZoekOpen(false);
    window.setTimeout(() => zoekknop.current?.focus(), 0);
  };

  return (
    <Subkop
      titel={t("thema.activiteitenTitel")}
      acties={
        meer ? (
          <>
            {zoekOpen ? null : (
              <button
                ref={zoekknop}
                type="button"
                aria-label={zoekLabel}
                title={zoekLabel}
                onClick={() => setZoekOpen(true)}
                className={ICOONKNOP}
              >
                <IcoonZoek aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
            <button type="button" aria-expanded={alle} onClick={() => setAlle(!alle)} className={TEKSTLINK}>
              {alle ? t("thema.minderTonen") : t("thema.alleBekijken", { aantal: activiteiten.length })}
            </button>
          </>
        ) : undefined
      }
    >
      {zoekOpen ? (
        <div className="mb-2">
          <div className="flex items-center gap-1">
            <div className="relative min-w-0 flex-1">
              <IcoonZoek
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-inkt-zwak"
              />
              <Invoer
                autoFocus
                value={zoek}
                aria-label={zoekLabel}
                placeholder={t("thema.zoekActiviteit")}
                onChange={(e) => setZoek(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    sluitZoek();
                  }
                }}
                className="h-raak! min-h-raak pl-7 pr-2 text-meta sm:h-8! sm:min-h-8"
              />
            </div>
            <button type="button" aria-label={sluitLabel} title={sluitLabel} onClick={sluitZoek} className={ICOONKNOP}>
              <IcoonKruis aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <p role="status" className={zoekt ? "mt-1 text-meta text-inkt-zacht" : "sr-only"}>
            {!zoekt
              ? null
              : gevonden.length > 0
                ? t(gevonden.length === 1 ? "lijst.eenGevonden" : "lijst.gevonden", {
                    aantal: gevonden.length,
                    totaal: activiteiten.length,
                  })
                : t("lijst.nietsGevonden")}
          </p>
        </div>
      ) : null}

      {activiteiten.length === 0 ? (
        <p className="text-meta text-inkt-zacht">{t("activiteit.geen")}</p>
      ) : getoond.length > 0 ? (
        <ul
          aria-label={t("thema.activiteitenTitel")}
          className="divide-y divide-lijn overflow-hidden rounded-veld border border-lijn"
        >
          {getoond.map((activiteit) => (
            <li key={activiteit.id}>{render(activiteit)}</li>
          ))}
        </ul>
      ) : null}
    </Subkop>
  );
}

const ICOONKNOP =
  "inline-flex h-raak w-raak shrink-0 items-center justify-center rounded-veld text-inkt-zacht transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt sm:h-8 sm:w-8";

/** Case and accents do not decide a match: "ecologie" finds "Ecologie". */
function normaliseer(tekst: string): string {
  return tekst.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("nl");
}

/**
 * One activiteit: a ruled row, not a box.
 *
 * **The list is closed in one frame and the rows are divided inside it** (owner, 2026-08-31: "zou je
 * de activiteiten volledig kunnen omkaderen ipv wat lijntjes?"). The argument is at `Doellijst`,
 * which took the same change: two hairlines say where a list begins and ends only if you notice both.
 *
 * **The teacher's colour is a bar, where it used to be the whole surface.** A washed rectangle per
 * activiteit turned a list a teacher scans into a stack of cards inside a card inside a page, and at
 * a desktop width each of them was a thousand pixels of pale fill around six words. As a three pixel
 * bar at the left edge the colour survives at full strength as a scanning aid, the rows keep one
 * geometry, and the colour's NAME still travels with it on the line below the title, so nothing
 * rests on hue alone (Art. XII).
 *
 * **The row itself opens the activiteit** (owner, 2026-08-30). An overlay button BEHIND the content
 * rather than around it, the same construction the month cell uses: this row also carries a delete
 * control. Everything above the overlay that is not itself pressable lets its
 * clicks fall through.
 *
 * **The doelmerk is unconditional**, filled or empty. Absence used to be encoded as absence, so "no
 * doelen" and "this row is just shorter" looked identical, and the question this list is scanned for
 * was the one it refused to answer.
 *
 * **The row opens for everyone; its delete control only for whoever holds it** (E6-02). Opening shows the form to a
 * gebruiker who may change the content and the facts to anyone else, so its label says which. The bin is left
 * out, not disabled, when its row of the matrix does not hold.
 *
 * **No goal picker on the row** (owner, 2026-09-16, TB-051): a doel is linked to an activiteit in its own sheet, which
 * the row opens. The row only counts them.
 */
function Activiteitregel({
  activiteit,
  magBewerken,
  onBewerk,
  onVerwijder,
}: {
  activiteit: ActiviteitMetKleur;
  /** Opening shows the form rather than the facts; only the label differs here. */
  magBewerken: boolean;
  onBewerk: () => void;
  /** Absent without the delete right. */
  onVerwijder?: () => void;
}) {
  const kleur = activiteit.kleur as Activiteitkleur | null;
  // Decided doelen only: a proposal or a rejected doel is not linked (ADR-0054 D5).
  const codes = activiteit.doelkoppelingen.filter((k) => beslist(k.status)).map((k) => k.leerplandoelCode);

  return (
    <div className="relative flex gap-3 px-3 py-2.5">
      {/* The hover fill is deliberately faint. This list runs to twenty rows on a real thema, and a
          row that lights up under a pointer merely passing over it keeps claiming to be the one you
          were looking for. Ink at 3.5% reads as "this responds" and no more. */}
      <button
        type="button"
        onClick={onBewerk}
        aria-label={t(magBewerken ? "activiteit.bewerkAria" : "activiteit.bekijkAria", { naam: activiteit.naam })}
        className="absolute inset-0 z-0 transition-colors duration-150 hover:bg-inkt/[0.035]"
      />

      {/* The bar is ALWAYS rendered and only sometimes coloured. Rendering it conditionally left the
          rows without a colour starting three pixels to the left of the rows with one, so a list of
          six activiteiten had a ragged left edge, which is the exact class of defect this redesign
          exists to remove. Reserving the space costs nothing and keeps one hard edge. */}
      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 w-[3px] shrink-0 rounded-full",
          kleur ? KLEURSTAAL[kleur] : "bg-transparent",
        )}
      />

      {/* `pointer-events-none` so the name, the soort and the doelmerk hand their clicks down to the
          overlay; every control above it turns them back on for itself. */}
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* `basis-full` on a phone, so the name gets the whole line and the doelmerk plus the two
            controls drop underneath it. Sharing one line, a real activiteit title wrapped to three
            lines against a 130 pixel column of controls and the row grew to seventy pixels. From
            `sm` the basis goes back to zero and the two sit side by side. */}
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <p className="text-body font-medium text-inkt">{activiteit.naam}</p>
          {/* Whose it is, for an own activiteit (ADR-0049): its own line, so the soort line below keeps its shape. */}
          <Eigenaarmerk activiteit={activiteit} className="mt-0.5 flex" />
          <p className="mt-0.5 text-meta text-inkt-zacht">
            {/* Joined from what is there, so an activiteit without a soort (FB-050) does not start with a separator. */}
            {[
              activiteit.activiteitType ? t(`activiteitsoort.${activiteit.activiteitType}`) : null,
              activiteit.hoek,
              kleur ? t(kleurSleutel(kleur)) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* The count, never the codes (FB-046): with several doelen per activiteit the codes made a long list
            restless, and the activiteit's own sheet names each doel with its code and text. */}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <Doelmerk aantal={codes.length} />
          {onVerwijder ? (
            <Verwijderknop
              className="pointer-events-auto"
              label={t("activiteit.verwijderAria", { naam: activiteit.naam })}
              onClick={onVerwijder}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Under a subdoel: the activiteiten that carry it, or the gap (FB-010).
 *
 * The gap is marked only on a decided subdoel, since an undecided one is not yet a subdoel to work out. It uses the
 * shape and hue of `Doelmerk`'s "Nog geen doel": the same kind of knelpunt, one level up, so a teacher meets one sign
 * for "nothing works this out yet". The hollow ring and the words carry it without the colour (Art. XII).
 *
 * Returns nothing at all when there is nothing to say, so the row adds no empty line under its text.
 */
function subdoelvoet(dragers: Drager[], isBeslist: boolean): ReactNode {
  if (dragers.length > 0) return <Dragers dragers={dragers} />;
  if (!isBeslist) return undefined;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-attentie/40 bg-attentie-zacht py-0.5 pl-1.5 pr-2 text-[0.6875rem] font-medium text-attentie-inkt">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-[1.5px] border-attentie" />
      {t("thema.nogGeenActiviteit")}
    </span>
  );
}

/** The activiteiten carrying a doel, by name and in the subthema's order. */
function Dragers({ dragers }: { dragers: Drager[] }) {
  const namen = dragers.map((d) => d.naam).join(", ");

  return (
    <span className="block text-meta text-inkt-zacht">
      {dragers.length === 1
        ? t("thema.inEenActiviteit", { namen })
        : t("thema.inActiviteiten", { aantal: dragers.length, namen })}
    </span>
  );
}
