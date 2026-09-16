import { useEffect, useRef, useState, type ReactNode } from "react";
import { Doelmerk } from "../../components/ui/Doelmerk";
import { Bewerkknop, Verwijderknop } from "../../components/ui/Rijknoppen";
import { IcoonChevron, IcoonDoelen } from "../../components/Iconen";
import { Toevoegicoon } from "../../components/ui/Toevoegknop";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { useLeerplandoelTeksten } from "../../lib/queries";
import type { Mag } from "../../lib/rechten";
import type { SubdoelvoorstelWeergave, SubthemaWeergave } from "../../lib/types";
import { KLEURSTAAL, kleurSleutel, type Activiteitkleur } from "../activiteiten/kleuren";
import type { ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import { Doelkoppelaar } from "../activiteiten/Doelkoppelaar";
import { Eigenaarmerk } from "../activiteiten/Eigenaarmerk";
import { Kaart, Subkop } from "./Fiche";
import { Gekoppelddoel } from "./Gekoppelddoel";
import { Inklaplijst } from "./Inklaplijst";
import { opCode } from "./opCode";
import { Subdoelvoorstellen } from "./Subdoelplaatsing";
import { beslist, subthemabalans, type Drager } from "./subthemabalans";
import { Woordweb } from "./Woordweb";

/**
 * One age's derivation of a thema: a chapter of the fiche.
 *
 * **It is a card again, but it is no longer a card INSIDE a section, and that is the change that
 * mattered.** It used to sit nested in a "Subthema's" panel, so the level a doel hangs on was
 * expressed by one border and twenty pixels of indent, and on a wide screen the box stretched to
 * eleven hundred pixels around a list of two short lines. It now hangs off the fiche's own margin as
 * a sibling of the thema's facts and its themadoelen, with its leeftijd set out in that margin and its
 * width bounded by the fiche. Same three levels, carried by where the card sits rather than by how
 * deeply it is buried. The screen draws that margin once per leeftijd, beside all of its cards
 * (FB-047), so this component draws only the card.
 *
 * **The card folds shut, and the heading is what folds it** (owner, 2026-08-31: "ik wil dat de
 * subthema cards collapsible worden, zodat ik ze kan dicht en openklappen"). A disclosure button with
 * `aria-expanded` and a chevron that turns, which is the shape this app already uses in `Themarij`
 * and `Doelenboom`. One pattern for one gesture.
 *
 * **Shut by default** (FB-011, owner 2026-09-15: "standaard subthema's ingeklapt op thema pagina").
 * The 2026-08-31 ruling had them open; with chapters for three leeftijden the page grew long enough
 * that finding one meant scrolling past the others, so every visit now starts on the folded summaries.
 *
 * **That cost the "press the subthema to edit it" gesture, and the pencil comes back for it.** The
 * heading of a card that folds has to fold it: that is what a teacher has met everywhere else, and a
 * header that edited when pressed here and folded when pressed there would be worse than either. So
 * editing needs a control of its own again. The objection on 2026-08-30 was never to a pencil as
 * such, it was to a bare 16 pixel one hiding in a corner ("ik wil niet telkens op dat potloodje
 * klikken"); this is the bordered 44 pixel control the owner asked for on 2026-08-31, beside the
 * bin, exactly like the thema's own card. Every card now carries the same two controls in the same
 * place.
 *
 * **Folded, the card says what is inside it.** Counts, and the gap when there is one. The point of
 * folding is scanning, and a fold that leaves only a name gives a teacher nothing to scan. They show
 * only while it is shut: printed above the lists they count, they would restate them.
 *
 * **Activiteiten come before subdoelen**, which is the other way round from the version this
 * replaced. The activiteiten are what the teacher built; the subdoelen are the accounting on top of
 * it.
 *
 * **Every control asks `mag` about THIS chapter's leeftijd** (E6-02, ADR-0030 §3). A thema holds chapters of several
 * leeftijden, and a hoofdleerkracht of K3 edits the K3 one and reads the L1 one on the same page. The subthema itself,
 * its subdoelen and the goal links are directie's and that leeftijd's hoofdleerkrachten'; a new activiteit and its
 * content are every leerkracht's of that leeftijd too; the delete is the hoofdleerkracht's, or the maker's while no goal
 * is linked. What nobody here may change is simply not drawn, and an activiteit row still opens, as its facts.
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
  /** The chapter a link from the agenda asked for (FB-037): it opens on arrival and is brought into view. */
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
  // The three lists below are shut and paged (TB-051), each in the order it is read in: activiteiten by name, doelen by
  // code (`subthemabalans` already orders the other doelen). A doel search matches the doel's text too, fetched for
  // every doel only once one of the two doel searches opens.
  const activiteitenOpNaam = [...activiteiten].sort((a, b) => a.naam.localeCompare(b.naam, "nl", { numeric: true }));
  const subdoelenOpCode = [...subthema.subdoelen].sort((a, b) =>
    opCode(a.koppeling.leerplandoelCode, b.koppeling.leerplandoelCode),
  );
  const [doelZoekOpen, setDoelZoekOpen] = useState({ subdoelen: false, andere: false });
  const { teksten: doelteksten, laadt: doeltekstenLaden } = useLeerplandoelTeksten(
    [
      ...subdoelenOpCode.map((s) => s.koppeling.leerplandoelCode),
      ...balans.andereDoelen.map((d) => d.koppeling.leerplandoelCode),
    ],
    doelZoekOpen.subdoelen || doelZoekOpen.andere,
  );
  const doelZoektekst = (code: string) => `${code} ${doelteksten.get(code) ?? ""}`;
  // Local, and deliberately not persisted: shut on every visit (FB-011's default), except the chapter a link asked for.
  // Remembering a fold across a route change is a different feature and would need somewhere to remember it.
  const [open, setOpen] = useState(gevraagd === true);
  const vouwknop = useRef<HTMLButtonElement>(null);
  // Into view, with focus on its fold, so a keyboard or screen-reader user lands where the link pointed rather than at
  // the top of a long page.
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

  return (
    // The leeftijd is not on the card: the screen sets it once in the margin beside all of that leeftijd's cards
    // (FB-047), so the card carries its own duration instead.
    <Kaart>
      {/* THE CARD'S TWO CONTROLS SIT BESIDE THE TITLE ONLY, not in a column down the whole card (TB-051): that column
          took 100 pixels from every row below it, and on a phone it left the lists a column of 190. */}
      <div className="flex items-start gap-3">
        <h3 className="min-w-0 flex-1">
          {/* THE CHEVRON IS ON THE RIGHT, and that is an alignment fix rather than a preference. Beside
              the title it pushed the name thirty pixels further in than the question and the two
              section headings below it, so the card had a ragged left edge: exactly the defect this
              redesign exists to remove. On the right the title starts where the whole card body starts,
              and the chevron still sits on the row it opens. */}
          <button
            ref={vouwknop}
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="-mx-2 -my-1.5 flex scroll-mt-6 w-[calc(100%+1rem)] items-start justify-between gap-3 rounded-veld px-2 py-1.5 text-left transition-colors duration-150 hover:bg-inkt/[0.035]"
          >
            <span className="min-w-0">
              <span className="block font-display text-hoofdstuk text-inkt">
                {subthema.naam}
                {/* The margin says the leeftijd once for the whole group, which a screen reader moving from heading to
                    heading never hears; so each fold names it too (FB-047). A subthema holds for every klas of that
                    leeftijd (Art. IX.2), so no class is named. */}
                <span className="sr-only">{t("thema.subthemaLeeftijd", { leeftijd })}</span>
              </span>
              {/* The duration always shows; the rest only while shut. The subdoelen figure comes first, the activiteiten
                  second: a subthema is built from its subdoelen and its activiteiten work them out (FB-048). It says how
                  many of them an activiteit already works out (FB-010), so a fold can be scanned for the chapter that
                  still needs one. It counts the same subdoelen the chapter lists; with none it is the plain count. On a
                  phone the facts stack: wrapped on one line they left a separator dangling at the end of each row. */}
              <span className="mt-1 flex flex-col gap-y-0.5 text-meta text-inkt-zacht sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                <span>{telWoord(subthema.duurWeken, "thema.eenWeek", "thema.weken")}</span>
                {open ? null : (
                  <>
                    <Punt />
                    <span>
                      {subthema.subdoelen.length > 0
                        ? t(
                            subthema.subdoelen.length === 1 ? "thema.subdoelInActiviteitEen" : "thema.subdoelenInActiviteit",
                            { aantal: balans.subdoelenInActiviteit, totaal: subthema.subdoelen.length },
                          )
                        : telWoord(0, "thema.eenSubdoel", "thema.subdoelen")}
                    </span>
                    <Punt />
                    <span>{telWoord(activiteiten.length, "thema.eenActiviteit", "thema.activiteiten")}</span>
                    {/* A shut chapter must not hide a proposal waiting for a decision (FB-057, FB-011's default). */}
                    {voorstellen.length > 0 ? (
                      <>
                        <Punt />
                        <span className="font-medium text-inkt">
                          {telWoord(voorstellen.length, "plaatsing.eenOpenVoorstel", "plaatsing.openVoorstellen")}
                        </span>
                      </>
                    ) : null}
                    {zonderDoel > 0 ? (
                      <>
                        <Punt />
                        <span className="font-medium text-attentie-inkt">
                          {telWoord(zonderDoel, "thema.eenZonderDoel", "thema.aantalZonderDoel")}
                        </span>
                      </>
                    ) : null}
                  </>
                )}
              </span>
            </span>
            <IcoonChevron
              aria-hidden="true"
              className={cn(
                "mt-2 h-5 w-5 shrink-0 text-inkt-zwak transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
        </h3>
        {magSubthema ? (
          <div className="flex shrink-0 items-center gap-2">
            <Bewerkknop omrand label={t("subthemabeheer.bewerkAria", { naam: subthema.naam })} onClick={onBewerk} />
            <Verwijderknop omrand label={t("subthemabeheer.verwijderAria", { naam: subthema.naam })} onClick={onVerwijder} />
          </div>
        ) : null}
      </div>

      {open ? (
        <>
          {/* THE BRAINSTORM COMES FIRST (owner, 2026-09-16, TB-051): the woordweb opens the chapter, above the question it
              leads to. Mounted only while the chapter is open, so a folded page asks for no woordwebs at all. */}
          <Woordweb subthemaId={subthema.id} naam={subthema.naam} />

          {/* The onderzoeksvraag is the most characteristic object in this domain: a kennisrijk thema is driven by a
              question (Art. IX), so it is set at reading size, with its probleemstelling smaller under it. No rule down
              its left (owner, 2026-08-31: "die verticale lijn mag weg bij de vragen"). */}
          {subthema.onderzoeksvragen.length > 0 ? (
            <Subkop
              titel={t(subthema.onderzoeksvragen.length === 1 ? "thema.onderzoeksvraagTitel" : "thema.onderzoeksvragenTitel")}
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

          {/* THE THREE LISTS: each heading is its fold, with its count, its small add control and its search right after
              it (TB-051). */}
          <Inklaplijst
            kop={{
              titel: t("thema.activiteitenTitel"),
              leeg: t("activiteit.geen"),
              acties: magActiviteit ? (
                <Toevoegicoon label={t("activiteit.toevoegen")} onClick={onNieuweActiviteit} />
              ) : undefined,
            }}
            items={activiteitenOpNaam}
            sleutel={(activiteit) => activiteit.id}
            lijstnaam={t("thema.lijstActiviteiten")}
            zoekPlaatshouder={t("thema.zoekActiviteit")}
            zoektekst={(activiteit) =>
              [
                activiteit.naam,
                activiteit.activiteitType ? t(`activiteitsoort.${activiteit.activiteitType}`) : "",
                activiteit.hoek ?? "",
              ].join(" ")
            }
            render={(activiteit) => (
              <li>
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
              </li>
            )}
          />

          <Inklaplijst
            kop={{
              titel: t("thema.subdoelenTitel"),
              icoon: <IcoonDoelen aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-inkt-zacht" />,
              leeg: t("thema.geenSubdoelen"),
              acties: magSubdoelen ? (
                <Doelkoppelaar
                  klein
                  onKies={onKoppelSubdoel}
                  bezig={koppelenBezig}
                  alGekozen={subthema.subdoelen.map((s) => s.koppeling.leerplandoelCode)}
                  toelichting={t("thema.koppelAanSubthema", { naam: subthema.naam })}
                />
              ) : undefined,
            }}
            items={subdoelenOpCode}
            sleutel={(subdoel) => subdoel.id}
            lijstnaam={t("thema.lijstSubdoelen")}
            zoekPlaatshouder={t("thema.zoekDoel")}
            zoektekst={(subdoel) => doelZoektekst(subdoel.koppeling.leerplandoelCode)}
            zoekLaadt={doeltekstenLaden}
            onZoekOpen={(open) => setDoelZoekOpen((huidig) => ({ ...huidig, subdoelen: open }))}
            render={(subdoel) => (
              <Gekoppelddoel
                koppeling={subdoel.koppeling}
                ontkoppelLabel={t("activiteit.ontkoppel", { code: subdoel.koppeling.leerplandoelCode })}
                ontkoppelBezig={koppelenBezig}
                onOntkoppel={magSubdoelen ? () => onOntkoppelSubdoel(subdoel.id) : undefined}
                onToon={onToonDoel}
                voet={subdoelvoet(balans.dragersPerSubdoel.get(subdoel.id) ?? [], beslist(subdoel.koppeling.status))}
              />
            )}
          />
          {/* The AI's open subdoel proposals (FB-057), under the subdoelen and outside their fold: a proposal waiting
              for a decision is never hidden. */}
          <Subdoelvoorstellen
            voorstellen={voorstellen}
            bezig={beslisBezig}
            onBeslis={onBeslisVoorstel}
            onToon={onToonDoel}
          />

          {/* WHAT THE ACTIVITEITEN OFFER BESIDES THE SUBDOELEN (FB-010), under its own heading so that "a doel of
              this subthema" and "a doel one of its activiteiten happens to carry" are never one list. Only when there
              is something: an empty group would be a second "nothing here" line under the subdoelen' own. Read only;
              linking stays on the activiteit and the subdoelen. */}
          {balans.andereDoelen.length > 0 ? (
            <Inklaplijst
              kop={{ titel: t("thema.andereDoelenTitel"), icoon: <IcoonDoelen aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-inkt-zacht" />, leeg: "" }}
              items={balans.andereDoelen}
              sleutel={(doel) => doel.koppeling.leerplandoelCode}
              lijstnaam={t("thema.lijstAndereDoelen")}
              zoekPlaatshouder={t("thema.zoekDoel")}
              zoektekst={(doel) => doelZoektekst(doel.koppeling.leerplandoelCode)}
              zoekLaadt={doeltekstenLaden}
              onZoekOpen={(open) => setDoelZoekOpen((huidig) => ({ ...huidig, andere: open }))}
              render={({ koppeling, dragers }) => (
                <Gekoppelddoel
                  koppeling={koppeling}
                  ontkoppelLabel={t("activiteit.ontkoppel", { code: koppeling.leerplandoelCode })}
                  onToon={onToonDoel}
                  voet={<Dragers dragers={dragers} />}
                />
              )}
            />
          ) : null}
        </>
      ) : null}
    </Kaart>
  );
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
  // Decided doelen only: a proposal or a rejected doel is not linked (ADR-0053 D5).
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
 * The separator in the folded card's summary. Decorative, so it is hidden from the reading order, and only from `sm`:
 * on a phone the facts stack and need no separator.
 */
function Punt() {
  return (
    <span aria-hidden="true" className="hidden text-inkt-zacht sm:inline">
      ·
    </span>
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
