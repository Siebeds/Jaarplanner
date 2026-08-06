import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { DEKKING_PAD, JAARFASE_PARAM } from "../../app/routes";
import { Jaarfasekiezer } from "../dekking/Jaarfasekiezer";
import { Button } from "../../components/ui/button";
import { t, tAantal, type TranslationKey } from "../../i18n";
import { ApiError } from "../../lib/api";
import { useDekking } from "../dekking/useDekking";
import { Jaarspine } from "./Jaarspine";
import { Periodekolom, Vakantiegat, type Periodefoutsoort } from "./Periodekolom";
import { Generatieparametersformulier, type Periodestaat } from "./Generatieparametersformulier";
import { Spreidingsoverzicht, type Verouderingsreden } from "./Spreidingsoverzicht";
import { Sleepkaart, Themakaart, type Verplaatsstaat } from "./Themakaart";
import { Weergaveschakelaar } from "./Weergaveschakelaar";
import {
  belastingPerStart,
  bepaalVerplaatsing,
  bouwRibbon,
  formatteerDatum,
  formatteerOrdinalen,
  geplandeIn,
  plaatsingenIn,
  plaatsingssignatuur,
  themaPeriodeOrdinalen,
  vervallenPlaatsingen,
} from "./kalenderFormat";
import { GENERATIEBLOKNIVEAU, leesNiveau } from "./types";
import type {
  Generatieparameters,
  Generatieresultaat,
  Planningsblok,
  Planningsblokniveau,
  Themaplaatsing,
} from "./types";
import {
  useGeneratieparameters,
  useGenereerJaarplan,
  useGenereerPeriode,
  useJaarplan,
  usePlanningsrooster,
  useVerplaatsPlaatsing,
} from "./useJaarplan";

/**
 * The kalender: a class's jaarplan over the school year's derived periods (E3-06, FR-6.1).
 *
 * **The year is a sequence of unequal periods, and the vakanties are literal gaps in it** — the structural
 * idea from the approved E3-10 wireframe. It is rendered twice, on purpose: the {@link Jaarspine} carries
 * the *proportional* view (width ∝ teaching days, vakanties as openings), and the grid below carries the
 * *planning* view in uniform, readable cards. A uniform month grid is refused either way — the school year
 * runs September→June and Belgian vakanties fall mid-month, so twelve equal columns would misstate the
 * year twice over (Art. IX.3 forbids assuming months; ADR-0013 forbids referencing them in planning).
 *
 * **Thema's move between periods by dragging (E3-07, FR-6.2), and by a period picker on each card.** Two routes
 * on purpose: WCAG 2.2's SC 2.5.7 requires a single-pointer alternative to every dragging movement, and the
 * picker is also the route that works on touch and by keyboard.
 *
 * **The grain is switchable (E3-08, FR-6.3), and one tier drives everything.** {@link Weergaveschakelaar} chooses a
 * `Planningsblokniveau`, that tier is the `/rooster` argument, and the spine, the board and the parameter form all
 * read the one answer. Neither tier is "the year" and the other "a period": both show the whole school year, at the
 * ratified themaperiode or subthemaperiode grain (directie 2026-07-14, Art. IX.3) — no calendar unit is named
 * anywhere, which is what Art. XIV still leaves open. The ongeplande-doelen tray (E3-09) is still absent rather
 * than faked.
 */
export interface JaarplankalenderProps {
  klasId: string;
}

export function Jaarplankalender({ klasId }: JaarplankalenderProps) {
  const jaarplan = useJaarplan(klasId);

  // The zoom level (E3-08, FR-6.3).
  //
  // Plain component state, and **ratified as such**: ADR-0014 and ADR-0021 both listed "view zoom" among the things
  // Zustand owns, and both carry an amendment of 2026-07-31 (owner ruling on the E3-08 audit) recording that the zoom
  // and E3-07's drag state stay here. The value has exactly ONE reader tree, rooted in this component, which already
  // owns the fetch and passes the resulting grid down as props. A module-scoped store would add a second home for a
  // value with a single owner and would outlive the component: it would carry one class's chosen grain into the next
  // class and leak between tests. The accepted cost is that the tier does not survive a reload and is not shareable.
  //
  // The initial value is the coarse tier, matching `/rooster`'s own default. Written as the literal rather than as
  // GENERATIEBLOKNIVEAU because they are two different decisions that happen to name the same tier: one is "which
  // grain does a teacher see first", the other is "which grain does a placement key on".
  const [niveau, setNiveau] = useState<Planningsblokniveau>("Themaperiode");

  /**
   * Which single jaar/fase the coverage figure below is measured against, or `null` for all of this class's own codes
   * (owner ruling, 2026-08-05).
   *
   * **Component state, not a URL param**, matching the zoom above it and for the reason ADR-0021's 2026-07-31 amendment
   * gives: one reader tree, rooted where the fetch lives, and no module-scoped store to carry one class's choice into
   * the next. `JaarplanPagina` renders this component with `key={klasId}`, so a class switch remounts and the narrowing
   * resets rather than quietly following the teacher to another class.
   *
   * **Why it has to exist here and not only on `/dekking`.** `Klas.Leerjaar` is a single ordinal: `0` means "a
   * kleutergroep" and cannot say *which* kleuterjaar, so `Jaarfasen.VoorLeerjaar` derives `JK + K2 + K3` and a derde
   * kleuterklas is measured against roughly three times the doelen it teaches. E5-02 gave the dekkingsoverzicht this
   * control; E3-09 then put the resulting figure on the anchor screen **without** it, so the number a teacher meets
   * first was the unlabelled, threefold one. The antagonist audit raised it as a QUESTION and the owner ruled the
   * chooser belongs here too.
   */
  const [jaarFase, setJaarFase] = useState<string | null>(null);

  /**
   * The class's available jaar/fase codes, remembered across a narrowing.
   *
   * **Declared here with the other hooks, not beside the derivation that uses it**, because this component early-returns
   * on the loading and error paths: a `useRef` further down is a conditional hook, and React answers that with
   * "Rendered more hooks than during the previous render" and a blank screen. Found by a test suite that went from 105
   * passing to 5 files of nothing.
   *
   * See the latching note further down for why the value is held at all rather than read off the current answer.
   */
  const beschikbaarLatch = useRef<readonly string[]>([]);

  const rooster = usePlanningsrooster(jaarplan.data?.schooljaarId, niveau);

  /**
   * The coverage read behind the knelpunt line and behind the chooser above it (E3-09).
   *
   * **One query for both**, lifted out of `OngeplandeDoelen` in the fix round: the control needs
   * `beschikbareJaarFasen` and the sentence needs the counts, and they must be the *same* answer or the chooser could
   * offer a code the figure was not measured against. TanStack would dedupe two identical keys, but "they happen to
   * share a cache entry" is a weaker guarantee than "there is one call".
   *
   * `EigenJaarFase` always: the whole-curriculum scope is a deliberate choice a teacher makes on `/dekking`, and
   * offering it here would put a second scope control on the board for a figure that is about *this class*.
   */
  const dekking = useDekking(klasId, "EigenJaarFase", jaarFase);

  // The GENERATION tier's grid, fetched independently of the zoom (E3-08 fix round 1, antagonist finding 1).
  //
  // A kept generation setting keys on a *themaperiode* start (ADR-0020 §3), so "does this setting still name a period
  // that exists?" is a statement about that tier and must not change with the tier the board happens to show. Read off
  // the displayed grid it did: at the fine zoom the check could not run, so a stranded kept startthema stopped being
  // counted as stranded and started being counted as a **valid** one. Same state, same request body, two different
  // claims on the trigger.
  //
  // **What it costs, stated accurately** (fix round 2, QUESTION-G — the earlier comment claimed "not a second network
  // round trip in the normal case", which is true only at mount). At the coarse tier this observer shares the board's
  // cache entry, so mount is one request. At the fine tier the two keys are separate, and with the app's default
  // `staleTime: 0` + `refetchOnWindowFocus` **every window focus refetches both**, each re-deriving a grid
  // server-side. Accepted rather than fixed with a `staleTime`: E3-04 depends on this query refetching on focus to
  // notice a beheerder's vakantie edit, which is what makes a stranded placement visible at all. One school, two small
  // requests per focus.
  //
  // Not a second grid on screen either: nothing is rendered from it except the parameter form's own rows, which name
  // themaperiodes by definition.
  const generatieRooster = usePlanningsrooster(jaarplan.data?.schooljaarId, GENERATIEBLOKNIVEAU);

  // The chosen kleuterjaar travels with the run, so the panel's dekkingsvooruitzicht and the live dekking line
  // above it are measured against the same set (E3-03, antagonist round 1).
  const generatie = useGenereerJaarplan(klasId, jaarFase ?? undefined);

  // One mutation for every column (E4-05, FR-8.2). The period is a `mutate()` argument rather than a hook parameter,
  // so `variables` says which column is running and a stale closure cannot regenerate the wrong period. It carries the
  // same `jaarFase` as the whole-plan run, for the same reason: it narrows the reported dekkingsvooruitzicht only.
  const periodegeneratie = useGenereerPeriode(klasId, jaarFase ?? undefined);
  const verplaats = useVerplaatsPlaatsing(klasId);

  // Whether the teacher has pressed *Opnieuw proberen* on a failed grid fetch.
  //
  // Needed because `refetch()` on an errored query holding **no** data puts TanStack back to `pending` rather than to
  // "errored and fetching": its fetch reducer resets `status` whenever `data === undefined`. Keying the notice on
  // `isError` alone therefore unmounts it — and with it the only way forward — for the whole retry. That is the exact
  // defect E3-04's fix round 4 recorded for the settings load; the same shape, so the same remedy.
  const [roosterHerstelGeprobeerd, setRoosterHerstelGeprobeerd] = useState(false);

  // The class's KEPT pre-generation settings (E3-04 persistence half), and the teacher's edits on top of them.
  //
  // Two values rather than one, because "the teacher changed nothing" and "the teacher cleared everything" must send
  // different requests: the saved settings, and an empty set. The form reports only edits, so `wijziging` stays
  // undefined until one happens and the run falls back to what was loaded. Both are undefined only while the settings
  // are still loading (or failed to load), and then no body is sent at all — which makes the server use the saved
  // settings, so a run in that window can never wipe them.
  //
  // **`wijziging` belongs to ONE class, and nothing in here enforces that** — the caller does, by keying this
  // component on the class id ({@link JaarplanPagina}). The klas selector sits above the router outlet on the same
  // route, so without that key switching class would leave A's edit sitting on top of B's loaded settings and the
  // next run would post A's parameters for B, replacing B's stored settings. The invariant this file can state is
  // narrower than "closed by construction": *while this component instance lives, `wijziging` and `instellingen`
  // describe the same class.*
  //
  // Same query key as the form's own, so TanStack serves both from one request.
  const instellingen = useGeneratieparameters(klasId);
  const [wijziging, setWijziging] = useState<Generatieparameters | undefined>(undefined);
  const parameters = wijziging ?? instellingen.data;

  // **Generation waits until the kept settings are known**, and that is a deliberate refusal rather than a spinner.
  // With them unknown the run sends no body, so the server applies whatever it has stored — while the collapsed form
  // could only have said "(niets ingesteld)" about it. A teacher cannot consent to a run whose parameters the screen
  // is unable to state, so the button is disabled and the form says why in visible text (its summary while loading,
  // an alert outside the collapse when the load failed). The window is one request long in the normal case.
  //
  // The SAME flag gates the form's fields (see the prop below): editing is not merely useless while the settings are
  // unknown, it is unsafe, because a submitted body replaces them wholesale.
  const instellingenOnbekend = instellingen.isPending || instellingen.isError;

  // **The same refusal, for the periods those settings name** (fix round 2, MAJOR-A). The E3-04 rule is that a run
  // whose parameters the screen cannot state is a run nobody can consent to, and a kept startthema is only half a
  // parameter without the themaperiode it points at: whether it still names an existing period is exactly what
  // decides whether the run will honour it or report it as vervallen.
  //
  // So this is one state with two causes, and both must gate. The grid is missing (its fetch failed, and at the fine
  // zoom that failure is invisible because the *board* loaded fine), or it came back at a tier this app does not
  // recognise. Round 1 gated neither: `isGeneratieNiveau` simply went false inside the form, `vervallen` emptied, and
  // the summary counted a stranded setting as a valid startthema — the very claim finding 1 was about, re-created one
  // query further out.
  const periodestaat: Periodestaat =
    generatieRooster.data === undefined
      ? "nietGeladen"
      : generatieRooster.data.niveau === GENERATIEBLOKNIVEAU
        ? "bekend"
        : "nietGelezen";
  const periodesOnbekend = periodestaat !== "bekend";

  // The card currently under the cursor, kept only so the DragOverlay can render a copy of it.
  const [sleepKaart, setSleepKaart] = useState<Themaplaatsing | null>(null);

  // A drag over a scrolling ribbon of unequal columns: `pointerWithin` asks "is the pointer inside this
  // droppable", which is what a teacher believes is happening. The default `rectIntersection` picks the column
  // whose rectangle overlaps the dragged card most, so a wide card straddling two narrow periods can land in
  // the one the cursor was never over.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Below this a click on the card's own "Aanpassen" button would be swallowed as a micro-drag.
      activationConstraint: { distance: 6 },
    }),
  );

  if (klasId.length === 0) {
    return <Melding soort="rustig">{t("kalender.geenKlas")}</Melding>;
  }

  // The jaarplan's error is checked BEFORE its pending state, and the order is load-bearing rather than stylistic.
  // `rooster` is chained behind the schooljaarId the jaarplan returns, so while that id is unknown the rooster query is
  // *disabled* — and a disabled TanStack Query v5 query reports `isPending === true`, not idle. With a combined pending
  // guard first, a failed jaarplan fetch never reached its error branch: the screen showed "Jaarplan laden…" forever
  // and `kalender.fout` was dead code.
  if (jaarplan.isError) {
    return <Melding soort="fout">{t("kalender.fout")}</Melding>;
  }

  if (jaarplan.isPending) {
    return <Melding soort="rustig">{t("kalender.laden")}</Melding>;
  }

  const plan = jaarplan.data;

  // **A failed grid fetch no longer takes the screen down with it** (E3-08 fix round 1, antagonist finding 2).
  //
  // `placeholderData: keepPreviousData` is gated on `status === 'pending'`, so the moment the newly-keyed fine-tier
  // query *errors* the placeholder is dropped and `rooster.data` is undefined again. The old early return then replaced
  // the spine, the board, the plan, the generation card **and the zoom control itself** with one sentence: the teacher
  // pressed a button and their year plan vanished, with nothing left to press. Before this story that state was
  // reachable only on first load, where there was nothing on screen to lose.
  //
  // So the failure degrades instead: the generation tier's grid (already cached, since the board opens at it) keeps the
  // whole screen standing at that grain, and the failure is one line beside the control that caused it. Only when there
  // is genuinely nothing to draw does it take the page, and even then it keeps the control and a retry. The rule is
  // E3-04 fix round 4's: a screen that refuses everything must still carry one live control.
  const terugvalGrid = niveau === GENERATIEBLOKNIVEAU ? undefined : generatieRooster.data;
  const grid = rooster.data ?? terugvalGrid;

  // **Which failure of the chosen tier this is**, because the three cost a teacher different things and round 1
  // described all of them with the same sentence (fix round 2, MAJOR-B). `terugval` was passed as a hard-coded `true`
  // wherever the board rendered, so a *background refetch* that failed — TanStack keeps `data` and sets
  // `status: "error"`, its own comment calls it "flag existing data as invalidated if we get a background error", and
  // with the app's `staleTime: 0` + `refetchOnWindowFocus` one alt-tab during an API blip reaches it — announced
  // "Je ziet nog de themaperiodes" while nineteen subthemaperiode columns were on screen. Both clauses false, and a
  // regression in honesty on the version that merely blanked the screen.
  //
  // `rooster.data` is what tells them apart, never `isError` alone: data survives an errored refetch.
  const eigenGridOntbreekt = rooster.data === undefined;
  // "A fetch of the chosen tier failed." Stays true through the teacher's own retry — see `roosterHerstelGeprobeerd`,
  // and note that branch only applies while no data is held, since a refetch with data keeps `status: "error"`.
  const eigenGridMislukt =
    rooster.isError || (roosterHerstelGeprobeerd && eigenGridOntbreekt && rooster.isFetching);
  const roosterfout: Roosterfoutsoort | null = !eigenGridMislukt
    ? null
    : !eigenGridOntbreekt
      ? // The chosen tier IS on screen; a refresh of it failed and changed nothing.
        "verversen"
      : terugvalGrid === undefined
        ? "geenGrid"
        : "terugval";

  function probeerRoosterOpnieuw() {
    setRoosterHerstelGeprobeerd(true);
    void rooster.refetch();
  }

  if (grid === undefined) {
    // Nothing to draw at all: the first load failed, so there is no cached generation grid to stand on. The zoom
    // control comes along, because the other tier is a second thing to try and not merely decoration.
    if (roosterfout !== null) {
      return (
        // **The page header stays** (fix round 2, kept deliberately). The gate observed that this branch dropped the
        // title and the klas/schooljaar line, leaving the shell's own `h1` as the only heading: a teacher who had just
        // pressed something was left on a page that no longer said which class it was about, and a screen reader lost
        // the section's accessible name with it. Two lines of markup against a teacher's orientation is not a trade
        // worth making. The concept banner is deliberately *not* repeated here: it describes what you can do on the
        // board, and there is no board.
        <section className="flex flex-col gap-6" aria-labelledby="kalender-titel">
          <Kalenderkop klasNaam={plan.klasNaam} schooljaarNaam={plan.schooljaarNaam} />
          <div className="flex flex-col gap-3">
            <Weergaveschakelaar niveau={niveau} onKies={setNiveau} bezig={false} />
            <Roosterfout
              soort={roosterfout}
              bezig={rooster.isFetching}
              onOpnieuw={probeerRoosterOpnieuw}
            />
          </div>
        </section>
      );
    }

    return <Melding soort="rustig">{t("kalender.laden")}</Melding>;
  }

  const segmenten = bouwRibbon(grid.blokken, grid.onderbrekingen);

  // The tier the board is ACTUALLY drawing, read off the answer (`grid.niveau`) rather than off the request
  // (`niveau`). During the one request a switch takes, the previous grid is still on screen, so reading the request
  // would label and enable it as the tier it is not yet.
  //
  // An unrecognised answer falls back to the coarse labels, and that fallback is a *presentation* default, never a
  // claim: the columns have to be called something. What it may not do is drive an instruction, which is what round 1
  // let it do (fix round 2, MINOR-F): moving demands strict equality with the generation tier, so an unrecognised tier
  // both told the teacher to switch to "Themaperiodes" and labelled itself as being on it. Hence the third
  // `Verplaatsstaat` below, which carries its own sentences.
  //
  // Read through `leesNiveau` since fix round 4 (MINOR-4b) rather than by comparing against two literals here: the
  // tiers now exist as data, so a third one is a compile error where the tiers are declared instead of a silent detour
  // into the degrade below. `null` *is* the "unrecognised" flag, so there is no separate boolean to keep in step with
  // it: two derivations of one fact is how a refusal and its explanation drifted apart three rounds running.
  // See {@link Planningsblokniveau}.
  const gelezenNiveau = leesNiveau(grid.niveau);
  const bordNiveau: Planningsblokniveau = gelezenNiveau ?? "Themaperiode";

  // Whether a thema can be moved on this board, and if not, why not (see {@link Verplaatsstaat}).
  //
  // Compared against the generation tier rather than against a bare "Themaperiode", because a placement keys on that
  // tier's block starts (ADR-0020 §3) and `VerplaatsPlaatsingAsync` resolves a target against the same tier. Derived
  // from the server's own string, so an unrecognised tier disables moving rather than offering a control that 400s.
  //
  // **Three states rather than a boolean** (fix round 3, owner ruling). "Cannot move here" had two causes with one
  // sentence between them, and the sentence belonged to the first: the fine tier really does have a working picker one
  // view away, while the unrecognised-tier degrade has none and labels itself as being on the very view it named. The
  // same collapse the round-2 fix removed from the periods, removed here from the board.
  //
  // **The reason the affordance is withheld at the fine tier is semantic, not API-shaped.** It would be easy to read
  // this as "the server refuses those dates", and that is only two thirds true: each parent's *first* sub-block starts
  // on the parent's own start date, so 7 of the 19 fine columns of a real year genuinely ARE accepted targets. That
  // makes the affordance worse rather than better. A drop on sub-block 1 moves the thema into the **whole**
  // themaperiode, so the control would be honest about the request and dishonest about the effect: the teacher aimed at
  // a fortnight and the plan records five weeks. The remaining columns would 400 on top of that. Both halves point the
  // same way, but this one is the argument.
  //
  // **Table-driven for the tiers this app recognises** (fix round 4, MINOR-4b). The `=== GENERATIEBLOKNIVEAU` test
  // stays a real comparison, because that is the coupling that makes `kan` true (a placement keys on that tier's block
  // starts, ADR-0020 §3) and it must keep following the constant if the constant ever moves. Every *other* recognised
  // tier goes through {@link ANDERNIVEAUSTAAT}, whose key type is the union minus that one tier — so a third
  // `Planningsblokniveau` is a missing-property error here and somebody has to decide what that board offers, instead
  // of it quietly inheriting `anderNiveau` (or, before this round, `niveauOnbekend`).
  const verplaatsstaat: Verplaatsstaat =
    gelezenNiveau === null
      ? "niveauOnbekend"
      : gelezenNiveau === GENERATIEBLOKNIVEAU
        ? "kan"
        : ANDERNIVEAUSTAAT[gelezenNiveau];

  // Placements pointing at a date that is no longer a period boundary. Collected FIRST and always
  // rendered: never silently relocated, never dropped (directie 2026-07-28).
  const vervallen = vervallenPlaatsingen(plan.plaatsingen, grid.blokken);

  // Derived once and shared with the spine, so the strip and the cards can never disagree about which
  // period is full or over-full.
  //
  // `gevuldeOuderOrdinalen` is the third set and only means anything at the fine tier: which **themaperiodes** hold a
  // thema, by parent ordinal. It exists because a sub-column's own emptiness says nothing about the plan — the class is
  // teaching its parent's thema that fortnight, the tool simply does not record which weeks of the parent the thema
  // occupies. Without it, two of the three sub-columns of a filled 5-week themaperiode read "Nog niets gepland", which
  // is false about the plan while being true about the column (antagonist finding 10).
  const gevuldeOrdinalen = new Set<number>();
  const gevuldeOuderOrdinalen = new Set<number>();
  for (const blok of grid.blokken) {
    const inBlok = plaatsingenIn(plan.plaatsingen, blok);
    if (geplandeIn(inBlok).length > 0) {
      gevuldeOrdinalen.add(blok.ordinaal);

      if (blok.ouderOrdinaal !== null) {
        gevuldeOuderOrdinalen.add(blok.ouderOrdinaal);
      }
    }
  }

  // How full each themaperiode is, measured server-side and read here (E3-09). Keyed on the block start date, like
  // every other plan↔grid join on this screen (ADR-0020 §3).
  const belasting = belastingPerStart(plan.blokken);

  /**
   * Whether to offer the kleuterjaar choice (owner ruling, 2026-08-05).
   *
   * Three conditions, and the last two were found by pointing the running app at a real kleuterklas rather than at the
   * L3 demo class:
   * 1. **more than one code to choose between** — every L1–L6 class has exactly one, and one button that cannot change
   *    anything is the control-that-does-nothing this repo bans (the E3-06 rule);
   * 2. **a figure the choice can govern.** The demo database holds only `L3` goals, so a kleutergroep measures `0 van 0`
   *    and the sentence below does not render at all. A chooser over nothing is the same banned control, one step
   *    removed, and it is the ordinary state until **E1-12** loads real curriculum;
   * 3. **unless the teacher has already narrowed**, in which case it must stay whatever the figures do. Without this
   *    clause, narrowing to a kleuterjaar that happens to carry no goals makes the control that produced that state
   *    disappear, and there is no way back to "Alle drie". That is the trap version of condition 2.
   */
  //
  // `beschikbareJaarFasen` is **latched** rather than read straight off the current answer, and that came out of a test:
  // narrowing creates a NEW query key, `useDekking` deliberately keeps no previous data (E5-02's choice, and not this
  // story's to change), so for the length of the request `dekking.data` is `undefined` and the control would unmount —
  // vanishing from under the cursor that just clicked it, then reappearing. Latching is honest as well as calmer: the
  // set is what this class COULD be measured against, so narrowing cannot change it. A remount per class (`key={klasId}`
  // on this component) is what resets it.
  // `?? []` rather than trusting the field to exist (antagonist round 2, MAJOR). `apiFetch` **casts** the body, it does
  // not validate it, so one payload without this field white-screened the whole kalender on `.length` — which is exactly
  // how it happened: the Storybook decorator answered `/dekking` with a `Jaarplan`. A screen whose worst case is a
  // missing signal must not have a worst case of a missing screen.
  const gemeld = dekking.data?.beschikbareJaarFasen ?? [];
  if (gemeld.length > 0) {
    beschikbaarLatch.current = gemeld;
  }
  const beschikbareJaarFasen = beschikbaarLatch.current;

  const toonJaarfasekiezer =
    beschikbareJaarFasen.length > 1 &&
    (jaarFase !== null || (dekking.data?.aantalLeerplandoelen ?? 0) > 0);

  // Gated on the figure it describes actually rendering, not on the fallback flag alone (antagonist round 2). Two states
  // reach `isTerugvalNaarHeelCurriculum` with no line under it — a stale placement (`aantalGedekt === null`) and a fully
  // covered scope — and the sentence then points at nothing. Same gating discipline as `teVolUitleg` and `beslisUitleg`
  // below, and the same defect they were each fixed for.
  const ongedektAantal =
    dekking.data !== undefined && dekking.data.aantalGedekt !== null
      ? dekking.data.aantalLeerplandoelen - dekking.data.aantalGedekt
      : null;
  const toonDekkingTerugval =
    dekking.data?.isTerugvalNaarHeelCurriculum === true && (ongedektAantal ?? 0) > 0;

  // **Te vol is a themaperiode property, so the board marks columns only at that tier** (owner ruling, 2026-07-31).
  // The arithmetic applied to a fortnight flags every filled sub-column — a thema's whole 4 to 6 weeks against the ~2
  // a sub-block offers — which is a board that signals nothing and, worse, invites the reading that *this* fortnight
  // is overbooked. At the fine tier the signal therefore becomes one sentence above the board naming the te volle
  // themaperiodes, and the strip below carries no marks.
  const teVolleThemaperiodes = plan.blokken
    .filter((blok) => blok.isOverbelast)
    .map((blok) => blok.ordinaal);
  // Keyed on the block START, not the ordinal: this set crosses from the jaarplan response into the `/rooster` one the
  // strip is drawn from, and those are two caches. See the note on `JaarspineProps.teVolleStarts`.
  const teVolleStarts =
    bordNiveau === GENERATIEBLOKNIVEAU
      ? new Set(plan.blokken.filter((blok) => blok.isOverbelast).map((blok) => blok.start))
      : new Set<string>();

  // Whether the last run's MEASUREMENTS still describe what is on screen, and if not, why (E3-03).
  //
  // Two causes, because they need two different sentences. The plan itself may have changed — compared by signature
  // rather than by a mutation counter, so an edit that changes nothing does not blank a correct figure while a change
  // arriving through a refetch does. Or the teacher may have moved the kleuterjaar chooser afterwards, which leaves
  // the plan alone and changes the DENOMINATOR: the live dekking line re-fetches on the new scope while the panel
  // keeps figures over the old one, which is the two-denominator state in a second guise (antagonist rounds 1 and 2).
  //
  // A response carrying no plan (only the failure path) is treated as unchanged: there is nothing to disagree with.
  // The `bereik` half needs to know the CURRENT scope, and `[]` does not mean "the whole curriculum" — it means the
  // latch has not been filled yet, because `/dekking` has not answered once (antagonist round 3). With a persistently
  // failing `/dekking` it never fills at all. Comparing an empty list against a server that reported `["L3"]`
  // mismatches, so the panel told a teacher "je meet nu tegen een ander jaar" while they had changed nothing and had
  // no chooser on screen to change it with, and suppressed the whole report with it. When the current scope is
  // unknown the honest answer is "not stale": a withheld figure needs a reason a teacher can act on.
  // **Which run the report describes (E4-05).** There are two buttons now — the whole plan above the board, one period
  // in every column — and one report area, so the panel shows whichever run finished LAST rather than always the
  // whole-plan one. Compared by `submittedAt` instead of by "is the newer hook successful", because either mutation may
  // hold a stale success from ten minutes ago and the question is which answer is current.
  //
  // A per-period run wins a tie, which is reachable only if both were submitted in the same millisecond and is
  // therefore arbitrary either way; it is written down so the next reader does not take it for a considered rule.
  const laatsteRun: Generatieresultaat | null =
    periodegeneratie.isSuccess &&
    (!generatie.isSuccess || periodegeneratie.submittedAt >= generatie.submittedAt)
      ? periodegeneratie.data
      : generatie.isSuccess
        ? generatie.data
        : null;

  const gemetenBereik = laatsteRun?.vooruitzicht?.gemetenJaarFasen;
  const huidigBereik = jaarFase !== null ? [jaarFase] : beschikbareJaarFasen;
  const verouderingsreden: Verouderingsreden | null =
    laatsteRun === null
      ? null
      : laatsteRun.jaarplan !== null &&
          plaatsingssignatuur(laatsteRun.jaarplan.plaatsingen) !== plaatsingssignatuur(plan.plaatsingen)
        ? "plan"
        : gemetenBereik !== undefined &&
            huidigBereik.length > 0 &&
            gemetenBereik.join(",") !== huidigBereik.join(",")
          ? "bereik"
          : null;

  // How many placements are still waiting for a teacher's decision (E4-02). Counted over the whole plan rather than
  // over `grid.blokken`, deliberately: a **stale** proposal sits in no block at all, and it is still a decision the
  // teacher owes (it can be rejected, which is what resolves it). Reading it off the grid would hide exactly the
  // card the decision copy was most recently wrong about.
  const openBeslissingen = plan.plaatsingen.filter(
    (plaatsing) => plaatsing.status === "Voorgesteld",
  ).length;

  // Whether pressing the button is a **re**generation (E4-04, FR-8.1 — the requirement's own word is *opnieuw*).
  //
  // Deliberately "does this class have any placement at all", and NOT "does it have a replaceable one". The second
  // question is the server's rule (`Themaplaatsing.IsVervangbaar` = `Voorgesteld && !Vergrendeld`), and answering it
  // here would put a second implementation of it in the client — which is the defect E3-09 spent a whole story
  // removing from this very screen, where the kalender guessed a te-vol threshold the server already owned. The copy
  // below is therefore written as a **rule**, not as a prediction: it states what a run does to each kind of
  // placement, which is true in every state, including the one where nothing is replaceable and the run only adds.
  //
  // Safe to read unconditionally: both the error and the pending branches of `jaarplan` return above, so this card
  // never renders while the plan is unknown. There is no third state in which the label would have to guess.
  //
  // What this must NOT grow into is E4-07: *how many* placements will change, and a cancel, are that story's, and
  // stating a count here would be the pre-apply diff wearing a different hat.
  const heeftPlan = plan.plaatsingen.length > 0;

  // Which periods each thema already occupies (E4-03), for the hand-placement picker. Derived once for the board
  // because it is a fact about the whole plan: a column sees only its own placements, so it could not tell a teacher
  // that a thema already sits in period 3. Status-blind on purpose — see `themaPeriodeOrdinalen`.
  //
  // **The board's own tier is passed explicitly** (fix round 1, antagonist MINOR). Left to the default, the map was
  // built from whichever grid was on screen while the copy hard-codes *"themaperiode {ordinaal}"*, so at the fine tier
  // a coarse placement whose start coincides with a sub-block's start would have been annotated with the *fine*
  // ordinal. Only the `verplaatsstaat === "kan"` gate kept that off screen, which is a coincidence rather than a
  // reason. Passing the tier makes the map correctly empty at the fine tier instead of quietly wrong.
  const alGeplaatst = themaPeriodeOrdinalen(plan.plaatsingen, grid.blokken, bordNiveau);

  const ordinaalVan = (blokStart: unknown) =>
    grid.blokken.find((blok: Planningsblok) => blok.start === blokStart)?.ordinaal;

  // The periods the teacher blocked with a vast moment (E4-05), as start date to the moment's own name. A Map because
  // every column looks itself up; built from the plan read rather than from the settings, so the board and the server
  // agree by construction instead of the client re-deriving which block a date falls in.
  const bezetteperiodes = new Map(
    plan.geblokkeerdePeriodes.map((periode) => [periode.blokStart, periode.momentNaam]),
  );

  // Only the periods on screen. A blocked period that no longer exists in the current grid contributes no column, so
  // counting it here would make the board explain a marker nobody can see.
  const bezetOpBord = grid.blokken.some((blok: Planningsblok) => bezetteperiodes.has(blok.start));

  function bijSleepStart(event: DragStartEvent) {
    setSleepKaart((event.active.data.current?.plaatsing as Themaplaatsing) ?? null);
  }

  function bijSleepEinde(event: DragEndEvent) {
    setSleepKaart(null);

    const { active, over } = event;
    const kaart = active.data.current?.plaatsing as Themaplaatsing | undefined;

    // Every "should this drop do anything?" branch lives in `bepaalVerplaatsing`, which is unit-tested. This
    // handler only translates the dnd-kit event into its arguments and fires the mutation.
    const doelStart = bepaalVerplaatsing(kaart, over ? String(over.id) : undefined);
    if (doelStart === null) {
      return;
    }

    verplaats.mutate({ plaatsingId: String(active.id), blokStart: doelStart });
  }

  /**
   * Dutch live-region announcements for the drag.
   *
   * dnd-kit's defaults are English and would be read out verbatim to a screen-reader user of a Dutch-only app.
   * They matter even though the grip is not the accessible route: a pointer user running a screen reader still
   * hears these.
   */
  const aankondigingen: Announcements = {
    onDragStart: ({ active }) =>
      t("kalender.sleepStart", { thema: themaNaamVan(active.data.current) }),
    onDragOver: ({ active, over }) => {
      const ordinaal = ordinaalVan(over?.id);
      const thema = themaNaamVan(active.data.current);

      return ordinaal === undefined
        ? t("kalender.sleepBuiten", { thema })
        : t("kalender.sleepBoven", { thema, ordinaal });
    },
    onDragEnd: ({ active, over }) => {
      const ordinaal = ordinaalVan(over?.id);
      const thema = themaNaamVan(active.data.current);

      return ordinaal === undefined
        ? t("kalender.sleepGeannuleerd", { thema })
        : t("kalender.sleepGeplaatst", { thema, ordinaal });
    },
    onDragCancel: ({ active }) =>
      t("kalender.sleepGeannuleerd", { thema: themaNaamVan(active.data.current) }),
  };

  return (
    <section className="flex flex-col gap-6" aria-labelledby="kalender-titel">
      <Kalenderkop klasNaam={plan.klasNaam} schooljaarNaam={plan.schooljaarNaam} concept />

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        accessibility={{ announcements: aankondigingen }}
        onDragStart={bijSleepStart}
        onDragEnd={bijSleepEinde}
        onDragCancel={() => setSleepKaart(null)}
      >
        {vervallen.length > 0 && (
          <TeHerzien
            plaatsingen={vervallen}
            klasId={klasId}
            blokken={grid.blokken}
            verplaatsstaat={verplaatsstaat}
          />
        )}

        {grid.blokken.length === 0 ? (
          <Melding soort="rustig">{t("kalender.leegRooster")}</Melding>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Directly above the strip it reshapes, and above the board below that. Not in the page header, which
                carries identity (title, klas, schooljaar), and not inside the generation card, which is a different
                task and reads the tier from here anyway.

                Only rendered when there is a grid to reshape: with zero blocks the switch would be a control that
                does nothing. Safe in both directions, because the fine tier subdivides the coarse one (ADR-0020) —
                a year with no themaperiode has no subthemaperiode either, so this can never hide the way back.

                **That argument covers the switch and nothing else, and the branch withholds more than the switch**
                (named in fix round 4, MINOR-7; it was left implicit before). A zero-block grid also swallows the
                `Roosterfout` notice two blocks below and, further down, the board's own re-placement sentence
                (`BORDUITLEG`), because all three sit inside a `blokken.length > 0` branch. So a *failed* fetch of a
                year that happens to have no periods says only "Dit schooljaar heeft nog geen themaperiodes", which is
                a statement about the year rather than about the failure, and offers no retry. The fix is to hoist the
                control and the notices above this fork; it is **not** done here because this round changed no render
                structure. Filed in this story's worklog (round-3 open list, MINOR-3) and handed to **E3-09** in the
                groepschat. Unreachable from the product today: nothing can empty a periodestructuur until E6-03. */}
            <Weergaveschakelaar
              niveau={niveau}
              onKies={setNiveau}
              // The requested tier is not the tier on screen yet. `isPlaceholderData` is exactly that state: the
              // previous grid is being shown while the chosen one is in flight.
              bezig={rooster.isPlaceholderData}
            />

            {/* Which jaar/fase the coverage figure below is measured against (owner ruling, 2026-08-05).
                See the `jaarFase` state for why the kalender needs this and not only `/dekking`.

                **The same component `/dekking` uses, imported rather than reimplemented.** It is already written to the
                right condition — it renders on "this class has more than one available code", not on "is this a
                kleutergroep", which is a question the data model cannot answer and which the still-open graadklas
                decision would answer differently while producing exactly this shape. A second copy here would be the
                two-implementations-of-one-rule problem this whole story exists to end, one layer up.

                **Gated on there being something to choose.** With a single code (every L1–L6 class) the control would be
                one button that cannot change anything, which is the E3-06 rule. With `HeelCurriculum` in force
                `beschikbareJaarFasen` is empty and it likewise does not render. */}
            {toonJaarfasekiezer && (
              <Jaarfasekiezer
                beschikbaar={beschikbareJaarFasen}
                gekozen={jaarFase}
                onKies={setJaarFase}
                uitlegKey="kalender.jaarFaseUitleg"
              />
            )}

            {/* Nothing to choose, and the figure below is not about this class's own year (owner: the chosen option left
                this case unlabelled; I am labelling it anyway and saying so, because an unlabelled number here is the
                same defect as the one the audit's first MAJOR was about). A class whose `Leerjaar` maps to no jaar/fase
                — the open graadklas case — is silently measured against the WHOLE curriculum, so without this the
                teacher reads a number several times too large with no way to tell. `/dekking` already renders its own
                sentence for exactly this state; this is that sentence, worded for this screen. */}
            {toonDekkingTerugval && (
              <p className="max-w-prose text-xs text-ink-zacht">{t("kalender.dekkingTerugval")}</p>
            )}

            {/* The chosen tier failed. Said here, beside the control that caused it and above the strip it is about,
                rather than as a full-screen replacement. Which of the two sentences it is, is derived rather than
                assumed (see `roosterfout`): the board may be showing the generation tier as a fallback, or it may be
                showing exactly what the teacher chose with only a background refresh having failed. The pressed option
                stays the one the teacher chose: forcing it back to the tier on screen would make pressing it again a
                no-op (React skips a setState to the same value), i.e. a control that does nothing — so the way back
                out is the explicit retry, or the other option. */}
            {roosterfout !== null && (
              <Roosterfout
                soort={roosterfout}
                bezig={rooster.isFetching}
                onOpnieuw={probeerRoosterOpnieuw}
              />
            )}

            <Jaarspine
              segmenten={segmenten}
              gevuldeOrdinalen={gevuldeOrdinalen}
              teVolleStarts={teVolleStarts}
              niveau={bordNiveau}
            />
          </div>
        )}

        {/* Generation (FR-5.1) with its spreading report (E3-02, FR-5.2), and from E4-04 also **re**generation
            (FR-8.1): the same endpoint, pressed on a class that already has a plan.

            It never discards a teacher's decision or a locked placement (Art. IV.1, Art. IX.3), which is also why a
            thema the teacher has dragged survives it: a move sets the placement to `manueel`. **It does discard the
            untouched proposals** — `Voorgesteld && !vergrendeld` — and this comment used to read "it only ever ADDS
            proposals", which is true of the first run and false of every one after it. That sentence was the whole of
            E4-04: the run has always been repeatable and has always replaced, while the button said "Jaarplan
            genereren…" both times and nothing said so before the press. The counts afterwards
            (`Spreidingsoverzicht`) come from the server and always did. */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
          {/* Stacked on a phone, side by side from `sm`. As a single wrapping flex row the explanation
              shrank into a narrow column beside the button and clipped it. */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Button
              type="button"
              onClick={() => generatie.mutate(parameters)}
              disabled={generatie.isPending || instellingenOnbekend || periodesOnbekend}
              className="w-full sm:w-auto"
            >
              {generatie.isPending
                ? t("kalender.genereerBezig")
                : heeftPlan
                  ? t("kalender.hergenereer")
                  : t("kalender.genereer")}
            </Button>
            {/* The explanation is **replaced**, not supplemented, once a plan exists: two paragraphs beside one button
                is the wall of prose this screen keeps having to cut. So the regeneration sentence has to carry
                everything the first-run one did, and the audit's second MAJOR is what proves that is not a formality.
                The first draft justified dropping the human-in-the-loop clause by pointing at the board's own
                `beslisUitleg` — which is gated on `openBeslissingen > 0` further down, precisely so it disappears once
                every card is decided. On a **fully decided plan**, the state a teacher most plausibly regenerates
                from, both sentences were therefore absent and nothing on the screen said that what arrives is a
                proposal they still decide on (Art. IV.1/IV.2). It is now the third clause of the string itself, which
                depends on no other component's render condition. Pinned by a test with an all-decided fixture.

                **The sentence names what is lost as the complement of what is kept, and that shape is also a fix**
                (round-2 MAJOR). Round 1 spelled the losers out as "AI-voorstellen waarover je nog niets beslist hebt",
                which is false for a **locked** proposal: the teacher decided nothing about it, `vergrendelUitlegVrij`
                invites exactly that, and `IsVervangbaar` keeps it — so the paragraph contradicted itself two clauses
                later, where "vastgezet" appears among the survivors. A second list of exclusions can drift from the
                first; "de overige" cannot. *One edge left standing deliberately:* a drag that ends in the period it
                started in writes nothing (`VerplaatsPlaatsingAsync` treats it as a normal gesture), so such a
                placement stays `Voorgesteld` and does disappear, while a teacher might call it "verplaatst". Making
                the no-op write would cost a standing proposal its motivation, which is the worse trade. */}
            <p className="max-w-2xl text-xs leading-snug text-ink-zacht">
              {t(heeftPlan ? "kalender.hergenereerUitleg" : "kalender.genereerUitleg")}
            </p>
          </div>

          {/* Why the button above is refused, beside the button. **Rendered for BOTH causes** (fix round 3, MINOR-1).
              Round 2 gated the button on `periodesOnbekend` and this notice on `nietGeladen` alone, leaving
              `nietGelezen` as a dead primary action with nothing beside it saying so: the only trace was a summary
              clause and, behind a disclosure that is closed by default, `parameters.periodesNietGelezen` — which does
              not mention the run at all. A refusal and its explanation wired on different conditions is the same
              defect this story has now paid for three rounds running, so they are wired on one condition here.

              The difference between the two is the retry, not the volume: `nietGeladen` is a fetch that failed and can
              be tried again, `nietGelezen` is a request that succeeded with an answer this app cannot read, where a
              retry would deterministically produce the same answer. So that state gets no button rather than a button
              that cannot help — and its copy ends at the beheerder instead.

              Only reachable while the board is at the *other* tier: at the generation tier this query and the board's
              are one and the same, so a missing grid takes the early return above and never gets here. */}
          {periodesOnbekend && (
            <div className="mt-4">
              {periodestaat === "nietGeladen" ? (
                <Roosterfout
                  soort="generatie"
                  bezig={generatieRooster.isFetching}
                  onOpnieuw={() => void generatieRooster.refetch()}
                />
              ) : (
                <Roosterfout soort="generatieNiveauOnbekend" />
              )}
            </div>
          )}

          {/* Pre-generation parameters (E3-04, FR-5.4), collapsed by default so the one-click run stays one click.
              The settings are KEPT per class (owner ruling 2026-07-30), which is why the form takes the klas id: it
              loads what was last used and generating saves the new state. It is given the derived grid because each
              preference names a period, and because a kept preference whose period no longer exists has to be
              spotted against the current grid and said out loud.
              **It is given the GENERATION tier's grid, never the board's**, because that is the tier a kept setting
              keys on: handing over whatever the zoom happens to show made the stranded check a function of the view,
              so the same stored setting was reported as stranded at one tier and as valid at the other (fix round 1,
              finding 1).
              **And it is told whether that grid is trustworthy at all** (`periodestaat`, fix round 2). Round 1 passed
              the answer's `niveau` string and let the form infer, which meant an absent grid and a mistiered one both
              landed in the same silent `false` — the form then claimed counts it could not check and generation stayed
              enabled. One derivation, in one place, gating the button and the form's claims together.
              `weergaveNiveau` is the separate question of what the *board* shows, which is what decides whether the
              period rows are offered here or the teacher is pointed at the other view (E3-04 obligation 1). */}
          <Generatieparametersformulier
            klasId={klasId}
            blokken={generatieRooster.data?.blokken ?? []}
            periodestaat={periodestaat}
            weergaveNiveau={bordNiveau}
            onWijzig={setWijziging}
            // The SAME gate as the button, not just `generatie.isPending`. Gating only the button left the fields live
            // behind a primary action that could never fire, and an edit made there would post a body that *replaces*
            // the kept settings: a teacher who set one startthema in a form that had failed to load would silently
            // delete a stored blocking vast moment they never saw. It also keeps `wijziging` and the form's own rows
            // in step across a retry: an errored query is stale, so a refetch that succeeded would reload the fields
            // while `wijziging` still held the earlier edit, and the run would post what the screen no longer showed.
            //
            // It does NOT cover a change of class, and never could: this gate closes only while the settings are
            // *unknown*, whereas a class switch desyncs precisely once the new class's settings are known (and with
            // `staleTime: Infinity` a previously-visited class is cached, so there is no window at all). That case is
            // closed one level up, by remounting on the class id — see the note on `wijziging`.
            //
            // `periodesOnbekend` joins it for the same safety reason (fix round 2, MAJOR-A): a row can only be edited
            // where the tool knows which period it targets, and a body posted from a form that could not name the
            // periods replaces the kept settings wholesale.
            disabled={generatie.isPending || instellingenOnbekend || periodesOnbekend}
          />

          {/* The 422 body is an English operator diagnostic (a model parse failure a teacher cannot act on),
              so it is never echoed — the teacher gets Dutch copy from nl.json keyed on the STATUS.
              422 and 5xx are told apart deliberately: 422 means the model answered badly and retrying is
              sensible, while anything else means the tool is broken or unconfigured (with no AzureAI:ApiKey
              set the client throws, which surfaces as a 500). Showing "de AI gaf geen bruikbaar antwoord" for
              a missing API key would blame the model for a configuration fault and send the teacher into a
              pointless retry loop. Both messages state that nothing changed, which Art. IV.5 guarantees. */}
          {generatie.isError && (
            <p
              role="alert"
              className="mt-4 rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
            >
              {generatie.error instanceof ApiError && generatie.error.status === 422
                ? t("kalender.genereerMislukt")
                : t("kalender.genereerOnbeschikbaar")}
            </p>
          )}

          {/* One report area for both runs, showing whichever finished last (see `laatsteRun`). The report names its own
              scope, so a per-period run cannot be read as a whole-plan one even though it lands in the card whose button
              says "Hele jaarplan": `periodeOrdinaal` is what lets it say *which* period in the teacher's own numbering.

              Looked up in the GENERATION grid rather than in the board's, because a period run always targets the
              themaperiode tier: at the fine tier `grid.blokken` holds sub-blocks, and a coincidental start-date match
              would print the fortnight's ordinal for a five-week period. `undefined` when the grid is unreadable or the
              period has since vanished, which the report answers with a sentence that names no number. */}
          {laatsteRun && (
            <Spreidingsoverzicht
              resultaat={laatsteRun}
              verouderd={verouderingsreden}
              periodeOrdinaal={
                generatieRooster.data?.blokken.find(
                  (blok: Planningsblok) => blok.start === laatsteRun.geregenereerdePeriode,
                )?.ordinaal
              }
            />
          )}
        </div>

        {grid.blokken.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* How to move a thema, said ONCE above the board rather than on every card. Names both routes,
                because the drag is undiscoverable on its own and unusable on a touch screen.
                At the fine tier it is replaced rather than supplemented: there is no grip and no picker there, so
                the sentence would describe controls that are absent. Its replacement carries the two facts that
                view owes a teacher — why a thema sits in only one part of its period, and where moving does work
                (visible text, not a tooltip, per the E3-06 rule). */}
            {/* `max-w-4xl` found by looking at it: the fine tier's sentence is twice as long as the coarse one and
                ran the full 1350px of a desktop viewport as a single line, which is past any readable measure.
                Three branches, not two (fix round 2, MINOR-F): an unrecognised tier gets its own sentence, because
                `fijnUitleg` sends the teacher to "de weergave Themaperiodes" and that degrade labels itself as being
                on it. An instruction nobody can follow is worse than saying plainly that nothing was changed.
                Paired through {@link BORDUITLEG} since fix round 3, so this sentence and the one a stale card's panel
                shows are decided by the same three states and cannot drift apart again. */}
            <p className="max-w-4xl text-xs leading-snug text-ink-zacht">
              {t(BORDUITLEG[verplaatsstaat])}
            </p>

            {/* Where hand-planning works, said only where the control is absent (E4-03). See {@link PLAATSUITLEG}
                for why `kan` contributes no sentence: the button is in every column and labels itself. */}
            {PLAATSUITLEG[verplaatsstaat] !== null && (
              <p className="max-w-4xl text-xs leading-snug text-ink-zacht">
                {t(PLAATSUITLEG[verplaatsstaat]!)}
              </p>
            )}

            {/* What the per-period button does, said ONCE here rather than beside seven identical buttons (E4-05,
                FR-8.2). The button itself carries its scope in its label; what it cannot carry is *what it replaces*,
                and that is a four-clause sentence.

                It names what disappears as **the complement of what stays**, which is E4-04's round-2 shape and not a
                stylistic echo: two enumerations of the same partition drift apart, and that story's own copy was wrong
                in both directions within a day before it was rewritten this way. A locked proposal is undecided and
                survives, so "the AI proposals you have not decided on" is the false version.

                Gated on the button existing at all: at the fine tier and on an unreadable grid there is no per-period
                control in any column, so the sentence would describe something absent. */}
            {verplaatsstaat === "kan" && (
              <p className="max-w-4xl text-xs leading-snug text-ink-zacht">
                {t("kalender.periodeHergenereerUitleg")}
              </p>
            )}

            {/* What "Bezet:" on a column means, once for the board (E4-05, owner rulings 2026-08-06).

                The columns carry the marker and the moment's name; this carries the three consequences, which are the
                part a teacher cannot infer from the word: the tool places nothing there, they cannot place anything
                there either, and what already stood in the period stays. That last clause is not filler — it is the
                clause that keeps the marker from reading as "this period has been emptied".

                Gated on a blocked period being **on screen** rather than merely stored, so the board never explains a
                marker no column is showing. At the fine tier that is always the case, since a vast moment blocks a
                themaperiode and the marker is withheld from sub-columns. */}
            {bezetOpBord && (
              <p className="max-w-4xl text-xs leading-snug text-ink-zacht">
                {t("kalender.bezetteperiodesUitleg")}
              </p>
            )}

            {/* What aanvaarden and weigeren mean, said ONCE here rather than on every card (E4-02). The decision
                buttons live on the card face, and a dozen proposals with a two-line explanation each is the wall of
                prose this screen keeps having to cut. Deliberately **not** tier-dependent, unlike the sentence above
                it: a decision is available on every proposal in every view, which is exactly why it is not paired
                through {@link BORDUITLEG}. It also says nothing about *how* a thema comes to count beyond
                aanvaarden, because "of zelf verplaatsen" is only true on the tier where moving works.

                **E4-01 put that exact clause in here and its round-2 audit took it back out** (2026-08-04). The
                owner had ruled that a teacher must be told a verplaatsing makes a thema count, and this looked
                like the place: the dekking rule already lives here. But this sentence is tier-independent by
                design and moving is not, so the clause promised a drag on the two states where the grip and the
                picker are both withheld, one of them (`niveauOnbekend`) directly under a sentence saying no thema
                can be moved here at all. The comment above was the warning, and it was walked past. The clause now
                lives in `kalender.sleepUitleg`, i.e. the `kan` entry of {@link BORDUITLEG}, which is the mechanism
                this file already had for exactly this hazard. **The lesson, since this file has now paid for it
                twice: a sentence about an affordance belongs in the record that is keyed on that affordance's
                state, not next to the topic it happens to share.**

                **Gated on a decision actually being outstanding** (re-audit, fix round 2). The design empties the
                board as the teacher works, so on a fully decided plan this sentence described controls that were
                nowhere on screen: the same defect as the stale card it was already fixed for, one level up. The
                file's own precedent is `teVolUitleg` below, which is gated the same way on the state it describes.

                *Two residues, stated so they are choices rather than oversights (round-3 audit).* When the only
                outstanding proposal is **stale**, this renders in the board section while the decision itself sits
                on a card in the "Te herzien" notice above — the sentence is true about the plan and points at no
                card on the board. Suppressing it instead would be worse: the teacher would then have a decision to
                make and no explanation of what it does, which is the defect this gate exists to prevent. And with
                a zero-block grid the whole branch is skipped, so a decision in the notice would be unexplained;
                that is pre-existing, unreachable until E6-03, and already filed to E3-09. */}
            {openBeslissingen > 0 && (
              <p className="max-w-4xl text-xs leading-snug text-ink-zacht">
                {t("kalender.beslisUitleg")}
              </p>
            )}

            {/* KNELPUNT 1 — te vol (FR-6.4).

                Said ONCE, above the board, instead of repeated inside every flagged column. The disclosure is still
                visible text rather than a tooltip (E3-06) — it just is not printed seven times.

                **Two shapes, one signal.** At the themaperiode tier the columns carry the flag themselves and this is
                only the explanation of what it means. At the subthemaperiode tier no column may carry it (the
                arithmetic belongs to the parent, owner ruling 2026-07-31), so the sentence has to name the periods
                itself or the signal disappears when a teacher zooms in. */}
            {teVolleThemaperiodes.length > 0 && (
              <p className="rounded-md bg-attentie-zacht px-3.5 py-2.5 text-xs leading-snug text-attentie-ink">
                <span aria-hidden="true">▲</span>{" "}
                {bordNiveau === GENERATIEBLOKNIVEAU
                  ? t("kalender.teVolUitleg")
                  : tAantal(
                      teVolleThemaperiodes.length,
                      "kalender.teVolEldersEnkelvoud",
                      "kalender.teVolElders",
                      { ordinalen: formatteerOrdinalen(teVolleThemaperiodes) },
                    )}
              </p>
            )}

            {/* KNELPUNT 2 — goals that appear nowhere (FR-6.4).
                See {@link OngeplandeDoelen} for why this is a count and a route rather than a list.

                **Inside the zero-block gate, and that is a decision rather than an accident** (filed to this story by
                E4-02's round-3 audit). With a grid of no blocks this whole section is skipped, so neither te vol nor
                this line renders. For te vol that is exactly right: a year with no periods has no period that can be
                over-full. For this line it is a judgement, and the judgement is that a plan with nowhere to teach
                anything has a bigger problem than its coverage, which the empty grid itself states. The third knelpunt,
                the stale-placement notice, sits deliberately OUTSIDE this gate, because a stale card must be resolvable
                even when the grid it no longer fits has collapsed. All of this is unreachable until E6-03 lets someone
                configure a year that derives no blocks; it is written down so the next reader does not have to
                rediscover which of the three placements were chosen and which were inherited. */}
            <OngeplandeDoelen dekking={dekking} jaarFase={jaarFase} />

            {/* A refused move (a date that is no longer a period boundary, or a thema already in the target
                period). Stated at board level because a drop has no panel to report into, and it says the plan
                is unchanged so nobody goes looking for a thema that never moved. */}
            {verplaats.isError && (
              <p
                role="alert"
                className="rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
              >
                {t("kalender.verplaatsMislukt")}
              </p>
            )}

            <ol
              // The board: periods left to right, vakanties as literal gaps. `items-start` is load-bearing —
              // without it flex stretches every column to the tallest and one full period turns its
              // neighbours into empty troughs, which is what made the first version unusable.
              //
              // `tabIndex={0}` makes the scroll region reachable by keyboard, which axe's
              // `scrollable-region-focusable` rule asks for. The cards now hold their own focusable control
              // ("Aanpassen"), so this is no longer the only way in — but it is still the only way to scroll
              // the year sideways without a pointer.
              className="subtle-scrollbar -mx-1 flex items-start gap-2 overflow-x-auto px-1 pb-3"
              // The board's accessible name follows the tier, paired by {@link RIBBONLABEL} rather than by a ternary
              // (fix round 4): hard-coded to the coarse one it became a lie at the fine one, and a ternary would make
              // the same lie the default for any tier added later.
              aria-label={t(RIBBONLABEL[bordNiveau])}
              tabIndex={0}
            >
              {segmenten.map((segment) =>
                segment.soort === "blok" ? (
                  <Periodekolom
                    key={`blok-${segment.blok.start}`}
                    blok={segment.blok}
                    plaatsingen={plaatsingenIn(plan.plaatsingen, segment.blok)}
                    klasId={klasId}
                    blokken={grid.blokken}
                    niveau={bordNiveau}
                    verplaatsstaat={verplaatsstaat}
                    ouderIsIngepland={
                      segment.blok.ouderOrdinaal !== null &&
                      gevuldeOuderOrdinalen.has(segment.blok.ouderOrdinaal)
                    }
                    alGeplaatst={alGeplaatst}
                    // Only at the tier the load belongs to. Handing the fine columns their parent's figures would
                    // print "5 weken nodig, 2 beschikbaar" on a fortnight that is teaching exactly what it should.
                    belasting={
                      bordNiveau === GENERATIEBLOKNIVEAU
                        ? belasting.get(segment.blok.start)
                        : undefined
                    }
                    // Which periods the teacher blocked, straight off the plan read (E4-05). Looked up by the block's
                    // own start date, the same key the server reports and placements are stored under.
                    //
                    // **Only at the generation tier**, like `belasting` and for the same reason: a vast moment blocks a
                    // *themaperiode*, so marking one fine sub-column as bezet would put the label on a fortnight while
                    // the other sub-columns of the same blocked period looked free.
                    bezetDoor={
                      bordNiveau === GENERATIEBLOKNIVEAU
                        ? (bezetteperiodes.get(segment.blok.start) ?? null)
                        : null
                    }
                    // The mutation is narrowed to this column here, so the column itself never has to ask whether the
                    // run in flight is its own. `variables` is the block start the teacher last pressed.
                    hergeneratie={{
                      start: () => periodegeneratie.mutate(segment.blok.start),
                      bezig:
                        periodegeneratie.isPending &&
                        periodegeneratie.variables === segment.blok.start,
                      wachten:
                        periodegeneratie.isPending &&
                        periodegeneratie.variables !== segment.blok.start,
                      foutsoort:
                        periodegeneratie.isError &&
                        periodegeneratie.variables === segment.blok.start
                          ? periodefoutsoort(periodegeneratie.error)
                          : null,
                    }}
                  />
                ) : (
                  <Vakantiegat
                    key={`gat-${segment.onderbreking.start}`}
                    naam={segment.onderbreking.naam}
                  />
                ),
              )}
            </ol>
          </div>
        )}

        {/* The dragged card follows the cursor from a portal, so it is not clipped by the board's horizontal
            scroll container the moment it leaves its own column. `dropAnimation={null}` because the board
            re-renders from the server's response: animating the copy back to a slot the card has already left
            reads as the move having failed. `Sleepkaart` rather than `Themakaart` — see its own note. */}
        <DragOverlay dropAnimation={null}>
          {sleepKaart && <Sleepkaart plaatsing={sleepKaart} />}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

/**
 * The page's identity: what this screen is, and whose year it is.
 *
 * Extracted in fix round 2 so the failure branch can carry it too. It was inline, which is how a state that replaces
 * the board also silently dropped the title and the klas/schooljaar line — the two things that tell a teacher they are
 * still looking at their own class. `concept` is off there on purpose: the banner describes what you can do on the
 * board, so it would be a promise about something that is not on screen.
 */
function Kalenderkop({
  klasNaam,
  schooljaarNaam,
  concept = false,
}: {
  klasNaam: string;
  schooljaarNaam: string;
  concept?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div>
        <h2 id="kalender-titel" className="text-2xl font-bold text-ink sm:text-[1.75rem]">
          {t("kalender.titel")}
        </h2>
        {/* The class is the subtitle rather than being spliced into the heading with a dash, which read
            as three unrelated things joined by punctuation. */}
        <p className="mt-1 text-base text-ink-zacht">
          {klasNaam}
          <span aria-hidden="true" className="px-2 text-border">
            |
          </span>
          <span data-cijfers>{schooljaarNaam}</span>
        </p>
      </div>

      {/* Says out loud what the draft cannot do yet, so the review does not mistake absence for a bug. */}
      {concept && (
        <p className="max-w-md rounded-md bg-petrol-wash px-3.5 py-2.5 text-xs leading-snug text-petrol">
          <span className="font-semibold">{t("kalender.conceptTitel")}. </span>
          {t("kalender.conceptUitleg")}
        </p>
      )}
    </header>
  );
}

/** A single line of page-level feedback: loading, empty, or failed. */
function Melding({ soort, children }: { soort: "rustig" | "fout"; children: ReactNode }) {
  const isFout = soort === "fout";

  return (
    <p
      {...(isFout ? { role: "alert" as const } : {})}
      className={[
        "rounded-lg border px-4 py-6 text-center text-sm",
        isFout
          ? "border-suggestie-geweigerd/30 bg-suggestie-geweigerd/5 font-medium text-suggestie-geweigerd"
          : "border-dashed border-border bg-card/60 text-ink-zacht",
      ].join(" ")}
    >
      {children}
    </p>
  );
}

/**
 * What the board says about moving a thema, one sentence per {@link Verplaatsstaat}.
 *
 * A `Record` rather than a ternary chain (fix round 3) for the reason its sibling in {@link Themakaart} is one: the
 * compiler then refuses a new board state that has not been given copy, which is what "one sentence, two causes" cost
 * this story twice. The pairing itself is unchanged from round 2.
 */
const BORDUITLEG: Record<Verplaatsstaat, TranslationKey> = {
  kan: "kalender.sleepUitleg",
  anderNiveau: "kalender.fijnUitleg",
  niveauOnbekend: "kalender.roosterNiveauOnbekend",
};

/**
 * What the board says about **hand-planning** a thema, one entry per {@link Verplaatsstaat} (E4-03, FR-7.2).
 *
 * A second record beside {@link BORDUITLEG} rather than three longer sentences inside it: those are E3-08's, they are
 * about *moving*, and each has been through its own audit. Two gestures, two statements, so neither has to be reworded
 * to accommodate the other.
 *
 * **`kan` is deliberately `null`.** At the generation tier every period column carries a labelled "Thema toevoegen"
 * button, so a sentence above the board saying the same thing would be the per-row prose CLAUDE.md says to cut. The
 * other two states have no control at all, and there the E3-06 rule bites: an unavailable destination is stated in
 * visible text, not left to be discovered. Typed with `| null` so the compiler still demands an answer for any state
 * added later, instead of letting a new one silently say nothing.
 */
const PLAATSUITLEG: Record<Verplaatsstaat, TranslationKey | null> = {
  kan: null,
  anderNiveau: "kalender.plaatsAnderNiveau",
  niveauOnbekend: "kalender.plaatsNiveauOnbekend",
};

/**
 * Which of a per-period run's four failures happened (E4-05), decided by **status** and never by the response text.
 *
 * The 422 body is an English operator diagnostic about a model parse failure, so it is never echoed to a teacher
 * (Art. II.3) — the same rule the whole-plan run's error notice follows, and the reason this maps to a key rather than
 * returning a message.
 *
 * The two refusals are told apart because they ask for different things: **409** means the settings changed elsewhere
 * and the teacher should reload to see what is now fixed, **400** means the school year's grid moved under the page.
 * Anything that is not one of the three is treated as "the tool is broken", where a retry cannot help.
 */
function periodefoutsoort(fout: unknown): Periodefoutsoort {
  if (!(fout instanceof ApiError)) {
    return "onbeschikbaar";
  }

  if (fout.status === 409) {
    return "bezet";
  }

  if (fout.status === 400) {
    return "vervallen";
  }

  return fout.status === 422 ? "mislukt" : "onbeschikbaar";
}

/**
 * What a board at a **recognised** tier other than the generation tier offers (E3-08 fix round 4, MINOR-4b).
 *
 * Keyed on the union *minus* the generation tier, which is the whole point: the `kan` case stays a live comparison
 * against {@link GENERATIEBLOKNIVEAU} (see the derivation), and every other tier this app can draw has to be given an
 * answer here by hand. Today that is one entry. Add a third `Planningsblokniveau` and this object fails to compile
 * until someone decides whether a thema can be moved on that board — which is exactly the decision that used to be
 * made silently, and wrongly, by falling through into `niveauOnbekend`.
 */
const ANDERNIVEAUSTAAT: Record<Exclude<Planningsblokniveau, typeof GENERATIEBLOKNIVEAU>, Verplaatsstaat> = {
  // The finer grain subdivides the generation tier, so moving is possible; it just is not possible *here*.
  Subthemaperiode: "anderNiveau",
};

/**
 * The board's accessible name per tier (E3-08 fix round 4, MINOR-4b).
 *
 * A `Record` for the same reason as its neighbours: hard-coded to the coarse label this became a lie at the fine tier
 * (a screen-reader user was told they were in a list of themaperiodes while every column was a subthemaperiode), and a
 * ternary would have re-created that lie for any tier added later. `bordNiveau` falls back to the coarse tier for an
 * *unrecognised* answer, which is a presentation default the board's own sentence contradicts in words.
 */
const RIBBONLABEL: Record<Planningsblokniveau, TranslationKey> = {
  Themaperiode: "kalender.ribbonLabel",
  Subthemaperiode: "kalender.ribbonLabelFijn",
};

/**
 * Which grid could not be had, and what that costs the teacher. **One state per sentence, and never a constant.**
 *
 * - `geenGrid` — the first load failed and there is nothing cached to stand on, so the screen has nothing to draw.
 * - `terugval` — the *chosen* tier failed; the board below is the generation tier's cached grid instead.
 * - `verversen` — the chosen tier IS on screen and a background refresh of it failed, so nothing was lost.
 * - `generatie` — the generation tier's grid is missing while another tier is on screen: the plan is fine, but the
 *   kept settings cannot be tied to periods, so generating is refused.
 * - `generatieNiveauOnbekend` — the same refusal, other cause: that grid arrived at a tier this app cannot read. The
 *   one state here with **no retry**, because the request already succeeded and repeating it changes nothing.
 *
 * `terugval` and `verversen` used to be one notice with `terugval` hard-coded to `true`, which is how a failed
 * background refetch announced "Je ziet nog de themaperiodes" over nineteen subthemaperiode columns (fix round 2,
 * MAJOR-B). TanStack keeps `data` on an errored refetch, so "errored" and "has nothing to show" are different
 * questions and must be asked separately.
 */
type Roosterfoutsoort =
  | "geenGrid"
  | "terugval"
  | "verversen"
  | "generatie"
  | "generatieNiveauOnbekend";

/**
 * The copy per state, plus whether it is announced.
 *
 * **`verversen` is deliberately quiet: no `alert`, no red wash.** A refresh that failed and changed nothing costs the
 * teacher nothing, and interrupting a screen reader mid-task to say so would be the same over-claim as the wrong-tier
 * sentence, one notch softer. It still carries the retry, because a stale grid is exactly what hides a beheerder's
 * vakantie edit (E3-04), so "try again" is a real next step rather than reassurance.
 */
const ROOSTERFOUT: Record<Roosterfoutsoort, { sleutel: TranslationKey; luid: boolean }> = {
  geenGrid: { sleutel: "kalender.roosterFout", luid: true },
  terugval: { sleutel: "kalender.roosterFoutWeergave", luid: true },
  verversen: { sleutel: "kalender.roosterVerversenMislukt", luid: false },
  generatie: { sleutel: "kalender.generatieRoosterFout", luid: true },
  generatieNiveauOnbekend: { sleutel: "kalender.generatieRoosterNiveauOnbekend", luid: true },
};

/**
 * A period grid that could not be derived, with the two things the old one-liner lacked: what it costs, and a way out.
 *
 * **Neither sentence says "herlaad de pagina".** The E3-04 audit rejected that outright: the query client has already
 * retried three times with backoff before this appears, so "try what just failed, but by hand" is not a next step. The
 * steps offered are a real refetch, the other tier, and (if it keeps failing) the beheerder.
 *
 * **The `alert` is the sentence, not the box.** The button is a *sibling* of the live region rather than a child of it —
 * the same separation `TeHerzien` and the settings notice use. A live region wrapping a control re-announces its whole
 * contents on every interaction, and pressing this one changes its own label.
 *
 * **`onOpnieuw` is optional, and its absence is a statement** (fix round 3). One state here is not a failed fetch at
 * all: `generatieNiveauOnbekend` is a request that succeeded and answered something this app cannot read, so a retry
 * would deterministically return the same answer. Offering it would be the control-that-does-nothing this project
 * banned, dressed as a remedy — and the E3-04 ruling that produced this component was precisely that a notice must
 * never prescribe the step already exhausted. The copy for that state therefore ends at the beheerder, and this stays
 * the only place a `Roosterfout` may render without a button.
 */
function Roosterfout({
  soort,
  bezig = false,
  onOpnieuw,
}: {
  soort: Roosterfoutsoort;
  bezig?: boolean;
  onOpnieuw?: () => void;
}) {
  const { sleutel, luid } = ROOSTERFOUT[soort];

  return (
    <div
      className={
        luid
          ? "rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5"
          : "rounded-md border border-border bg-paper px-3.5 py-2.5"
      }
    >
      <p
        {...(luid ? { role: "alert" as const } : {})}
        className={[
          "max-w-3xl text-sm leading-snug",
          luid ? "font-medium text-suggestie-geweigerd" : "text-ink",
        ].join(" ")}
      >
        {t(sleutel)}
      </p>
      {onOpnieuw !== undefined && (
        <Button
          type="button"
          variant="outline"
          disabled={bezig}
          onClick={onOpnieuw}
          // `border-suggestie-geweigerd` rather than the default `border-input`, for the reason the settings notice
          // records: `variant="outline"` puts `bg-card` on this panel's `suggestie-geweigerd/10` wash, so the fill
          // carries no contrast of its own and the border is the only thing delineating the control (SC 1.4.11 wants
          // 3:1 for it). Same hue the panel already spends, so no second chrome accent (Art. XII).
          // The quiet variant keeps the default `border-input`: its own panel is `bg-paper`, where that token measures
          // 3.21:1 (measured in a browser for the E3-04 notice, re-measured this round), and borrowing the refusal hue
          // for a state that lost nothing would be the loudness the copy is trying not to have.
          className={
            luid
              ? "mt-2 h-7 border-suggestie-geweigerd bg-card text-xs"
              : "mt-2 h-7 bg-card text-xs"
          }
        >
          {bezig ? t("kalender.roosterOpnieuwBezig") : t("kalender.roosterOpnieuw")}
        </Button>
      )}
    </div>
  );
}

/**
 * The stale-placement notice.
 *
 * Rendered above everything and **not dismissible** — there is no close control, by design. A thema whose
 * period no longer exists must stay visible until a human resolves it, and while it does the plan's dekking
 * cannot be trusted (directie 2026-07-28, Art. V.2).
 *
 * **E3-07 adds the re-placement the ruling asks for, inline and in place.** Each card carries the same
 * "Aanpassen" panel as a card on the board, whose period picker offers every period of the year (a stale
 * placement sits in none, so none is excluded). Dragging works too: these cards are inside the same
 * `DndContext` as the board below. What the application still never does is *choose* a period — clause 1 of
 * the ruling — so nothing here is pre-selected.
 *
 * **It is a labelled `region` with one small `status` line, not one big `alert` — changed in E3-07.** E3-06 could
 * make the whole notice `role="alert"` because it was inert text. It now holds a select, several buttons per card
 * and the confirmation for an unrecoverable delete (itself an `alert`), and a live region nested inside a live
 * region has no defined behaviour: the outer one can re-announce its entire contents every time a panel opens, and
 * the inner one — the delete confirmation — is the message most likely to be swallowed. So the announcement lives
 * in a `role="status"` element carrying just the count sentence, and the container is a plain labelled region a
 * screen-reader user can navigate into. **Still not dismissible:** there is no close control anywhere in it, which
 * is what the ruling actually requires and what the test pins.
 */
function TeHerzien({
  plaatsingen,
  klasId,
  blokken,
  verplaatsstaat,
}: {
  plaatsingen: ReturnType<typeof vervallenPlaatsingen>;
  klasId: string;
  blokken: readonly Planningsblok[];
  /**
   * Whether these cards can be given a period from here, and if not, why not (E3-08). See {@link Verplaatsstaat}.
   *
   * `anderNiveau` at the fine zoom, where `blokken` are subthemaperiodes and the server refuses all but the ones that
   * coincide with a themaperiode start. The notice stays exactly as non-dismissible as it was — nothing is hidden,
   * nothing gains a "later" — but the card says where re-placing works instead of offering a picker that mostly
   * fails. The alternative, fetching the coarse grid alongside the fine one just for this panel, would put two
   * grids on one screen, which is the defect decision 1 of this story's design exists to avoid.
   *
   * `niveauOnbekend` says instead that the view could not be read, because there is no view to send anyone to; and a
   * **rejected** card is told nothing about re-placing at either tier, since its picker is withheld by the rejection
   * rather than by the tier (fix round 3). Both live in {@link Themakaart}, which is where the card's own status is.
   */
  verplaatsstaat: Verplaatsstaat;
}) {
  const titelId = useId();
  const titel = tAantal(
    plaatsingen.length,
    "kalender.herzienTitelEnkelvoud",
    "kalender.herzienTitel",
  );

  return (
    <div
      role="region"
      aria-labelledby={titelId}
      className="rounded-lg border-2 border-attentie bg-attentie-zacht p-4 sm:p-5"
    >
      {/* The announcement, and only the announcement: the count sentence without the controls under it. */}
      <p role="status" className="sr-only">
        {titel}
      </p>
      <h3 id={titelId} className="text-base font-bold text-attentie-ink">
        <span aria-hidden="true">▲</span>{" "}
        {/* Via the shared helper rather than an inline ternary: the same singular/plural bug turned up in
            five separate strings before `tAantal` existed, and each was fixed on its own. */}
        {titel}
      </h3>
      <p className="mt-1.5 max-w-3xl text-sm leading-snug text-attentie-ink">
        {t("kalender.herzienUitleg")}
      </p>

      <ul className="mt-4 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plaatsingen.map((plaatsing) => (
          <li key={plaatsing.id}>
            <Themakaart
              plaatsing={plaatsing}
              klasId={klasId}
              blokken={blokken}
              verplaatsstaat={verplaatsstaat}
            />
            <p className="mt-1 text-xs font-medium text-attentie-ink" data-cijfers>
              {t("kalender.herzienDatum", { datum: formatteerDatum(plaatsing.blokStart) })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * KNELPUNT 2 — how many leerplandoelen this plan does not yet cover (E3-09, FR-6.4).
 *
 * **The sentence says "nog niet gedekt", and getting that wrong was this story's worst defect** (antagonist MAJOR,
 * fixed here). It first read *"komen in geen enkel thema van dit jaarplan voor"*, which is a claim about **placement**
 * while the number is a claim about **coverage**, and the two part company in the single commonest state on this
 * screen: `DekkingService` requires the *placement* to be `Aanvaard`/`Manueel` on top of the link (Art. V.1), so a
 * freshly generated plan is entirely `Voorgesteld` and reports 0 covered. The demo seed makes that concrete — 7 thema's
 * carrying 14 codes, every card announcing *"2 doelen gekoppeld"*, beside a line claiming those 14 goals appeared in no
 * thema at all. **That contradiction was on screen during this story's own browser pass and read as a pass**, which is
 * the useful part of the lesson: looking at a screen only finds what you are looking for, and I was checking the
 * treatment rather than the truth of the sentence.
 *
 * No extra clause explains *why* the figure is high, deliberately: `kalender.beslisUitleg` already sits above this line
 * whenever a decision is outstanding and says *"Zolang een thema een AI-voorstel blijft, telt het niet mee voor de
 * dekking"*, and `/dekking` states the full rule. Repeating it here is the prose this screen exists to cut.
 *
 * **A count and a route, not a list** (owner ruling, 2026-08-04). The approved E3-10 wireframe drew this as its own
 * tray beside the board, and that was the right answer on 2026-07-28, when nothing else could show it. E5-02 has since
 * shipped `/dekking`, which lists every leerplandoel with its coverage, its doelsoort and the thema's that cover it,
 * and E5-03/E5-05 own that presentation. A tray here would be a second, poorer rendering of the same rows on a screen
 * whose standing problem is too much prose above the board, and it would grow to hundreds of entries after a full
 * import. So the board states the fact and names where to act on it. The deviation from the approved wireframe is
 * recorded on the story; the wireframe itself is deliberately not retouched, since it is the record of what directie
 * reviewed.
 *
 * **The scope matches what the link leads to.** It asks for `EigenJaarFase`, which is `DekkingPagina`'s own default, so
 * the number here is the number there. Measuring the whole curriculum instead would state a much larger figure and
 * send the teacher to a screen showing a smaller one, with nothing on either explaining the difference.
 *
 * **It says nothing while dekking is untrustworthy, on purpose.** An unresolved stale placement makes `aantalGedekt`
 * null (directie 2026-07-28, point 4), and a plan that cannot report dekking cannot report a gap in it either. The
 * "Te herzien" notice above is already saying what has to happen first, so a second sentence here would be noise
 * pointing at the same fix.
 *
 * **A failed load says so rather than showing nothing.** Silence here reads as "no goals are missing", which is the
 * one direction this signal must never fail in.
 */
function OngeplandeDoelen({
  dekking,
  jaarFase,
}: {
  dekking: ReturnType<typeof useDekking>;
  /**
   * The narrowing currently applied, threaded into the link so the two screens agree.
   *
   * **This is what makes "the number here is the number there" actually true.** The claim was in this file before the
   * fix round and it only held until the teacher touched anything: `DekkingPagina` keeps its scope in search params and
   * this link went to the bare route, so a kalender narrowed to K3 sent the teacher to a screen measuring all three
   * kleuterjaren, with nothing on either explaining the different figure.
   */
  jaarFase: string | null;
}) {
  // Carries the narrowing, so following the link does not silently widen the scope back out.
  const doel = jaarFase
    ? `${DEKKING_PAD}?${JAARFASE_PARAM}=${encodeURIComponent(jaarFase)}`
    : DEKKING_PAD;

  if (dekking.isError) {
    return (
      <p className={KNELPUNT_DEKKING}>
        {t("kalender.ongeplandeDoelenOnbekend")}{" "}
        <Link to={doel} className="font-semibold text-petrol underline">
          {t("kalender.ongeplandeDoelenLink")}
        </Link>
      </p>
    );
  }

  const data = dekking.data;

  // Nothing to say: still loading, or dekking withheld because a placement is stale (directie 2026-07-28, point 4).
  if (data === undefined || data.aantalGedekt === null) {
    return null;
  }

  // Nothing in scope to measure against.
  //
  // **Silent only when the teacher did not ask for this scope** (antagonist round 2). Unnarrowed it means no curriculum
  // is loaded at all, which is the ordinary state until E1-12 and which the import screen is the place to say something
  // about. But once a kleuterjaar has been CHOSEN, the same emptiness is the direct result of a click, and answering a
  // click with nothing violates this component's own rule that silence here reads as "no goals are missing". `/dekking`
  // renders `dekking.nietMeetbaar` for exactly this state; this is the same fact, worded for one line.
  if (data.aantalLeerplandoelen === 0) {
    return jaarFase === null ? null : <p className={KNELPUNT_DEKKING}>{t("kalender.geenDoelenInJaar")}</p>;
  }

  const ongedekt = data.aantalLeerplandoelen - data.aantalGedekt;
  if (ongedekt <= 0) {
    return null;
  }

  return (
    <p className={KNELPUNT_DEKKING}>
      <span data-cijfers>
        {tAantal(ongedekt, "kalender.ongeplandeDoelenEnkelvoud", "kalender.ongeplandeDoelen", {
          aantal: ongedekt,
        })}
      </span>{" "}
      <Link to={doel} className="font-semibold text-petrol underline">
        {t("kalender.ongeplandeDoelenLink")}
      </Link>
    </p>
  );
}

/**
 * The coverage knelpunt's own treatment: a rule in the dekking colour, and **no fill**.
 *
 * **This is the one thing looking at the screen changed.** It was first built as a tinted band, symmetrical with the
 * te-vol explanation above it, plus a `◦` as the non-colour carrier. In a browser that inverted the hierarchy this
 * story is built on: `bg-dekking-niet-gedekt/10` composites to a distinctly pink full-width slab that was the loudest
 * element on the page, so the *coverage fact* shouted while the *te vol* signal beside it, the one a teacher may
 * actually need to act on today, murmured in cream. And the `◦` rendered as a dot indistinguishable from a bullet, so
 * "never colour alone" (Art. XII) was satisfied on paper and not on screen.
 *
 * Both are fixed by taking things away rather than adding. The left rule keeps it identifiable as a knelpunt and keeps
 * the dekking token doing the semantic work, while leaving it visibly lighter than the te-vol band, which is the
 * ordering the three signals were designed to have: the stale-placement notice heaviest (a human must resolve it), te
 * vol in the middle (a judgement a teacher may accept), this lightest (a fact, and it points off-screen). The SC 1.4.1
 * carrier is now the **sentence itself** — *"zijn nog niet gedekt door dit jaarplan"* needs no glyph to be understood in
 * monochrome, which is a stronger guarantee than an icon nobody can see.
 *
 * *Two corrections by antagonist round 2:* this quoted the copy the fix round **deleted as a falsehood**, stating it as
 * the present carrier — the fifth false doc comment on this story, and the first authored by the round that fixed the
 * other four. And it cited **Art. XII**, which is the constitution's glossary; the rule is WCAG 2.2 AA SC 1.4.1 via
 * Art. VIII and ADR-0017.
 */
const KNELPUNT_DEKKING =
  "border-l-2 border-dekking-niet-gedekt py-1 pl-3 text-xs leading-snug text-ink";

/**
 * The thema name out of a draggable's `data`, for the live-region announcements.
 *
 * Defensive rather than a cast: dnd-kit types `data.current` as an open record, so a card rendered without the
 * payload would otherwise put "undefined" into a sentence a screen reader reads aloud.
 */
function themaNaamVan(data: Record<string, unknown> | undefined): string {
  const plaatsing = data?.plaatsing as Themaplaatsing | undefined;

  return plaatsing?.themaNaam ?? "";
}
