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
import { useId, useState, type ReactNode } from "react";

import { Button } from "../../components/ui/button";
import { t, tAantal, type TranslationKey } from "../../i18n";
import { ApiError } from "../../lib/api";
import { Jaarspine } from "./Jaarspine";
import { Periodekolom, Vakantiegat } from "./Periodekolom";
import { Generatieparametersformulier, type Periodestaat } from "./Generatieparametersformulier";
import { Spreidingsoverzicht } from "./Spreidingsoverzicht";
import { Sleepkaart, Themakaart, type Verplaatsstaat } from "./Themakaart";
import { Weergaveschakelaar } from "./Weergaveschakelaar";
import {
  bepaalVerplaatsing,
  bouwRibbon,
  formatteerDatum,
  geplandeIn,
  isTeVol,
  plaatsingenIn,
  themaPeriodeOrdinalen,
  vervallenPlaatsingen,
} from "./kalenderFormat";
import { GENERATIEBLOKNIVEAU, leesNiveau } from "./types";
import type {
  Generatieparameters,
  Planningsblok,
  Planningsblokniveau,
  Themaplaatsing,
} from "./types";
import {
  useGeneratieparameters,
  useGenereerJaarplan,
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

  const rooster = usePlanningsrooster(jaarplan.data?.schooljaarId, niveau);

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

  const generatie = useGenereerJaarplan(klasId);
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
  const teVolleOrdinalen = new Set<number>();
  for (const blok of grid.blokken) {
    const inBlok = plaatsingenIn(plan.plaatsingen, blok);
    if (geplandeIn(inBlok).length > 0) {
      gevuldeOrdinalen.add(blok.ordinaal);

      if (blok.ouderOrdinaal !== null) {
        gevuldeOuderOrdinalen.add(blok.ouderOrdinaal);
      }
    }
    if (isTeVol(inBlok)) {
      teVolleOrdinalen.add(blok.ordinaal);
    }
  }

  // How many placements are still waiting for a teacher's decision (E4-02). Counted over the whole plan rather than
  // over `grid.blokken`, deliberately: a **stale** proposal sits in no block at all, and it is still a decision the
  // teacher owes (it can be rejected, which is what resolves it). Reading it off the grid would hide exactly the
  // card the decision copy was most recently wrong about.
  const openBeslissingen = plan.plaatsingen.filter(
    (plaatsing) => plaatsing.status === "Voorgesteld",
  ).length;

  // Which periods each thema already occupies (E4-03), for the hand-placement picker. Derived once for the board
  // because it is a fact about the whole plan: a column sees only its own placements, so it could not tell a teacher
  // that a thema already sits in period 3. Status-blind on purpose — see `themaPeriodeOrdinalen`.
  const alGeplaatst = themaPeriodeOrdinalen(plan.plaatsingen, grid.blokken);

  const ordinaalVan = (blokStart: unknown) =>
    grid.blokken.find((blok: Planningsblok) => blok.start === blokStart)?.ordinaal;

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
              teVolleOrdinalen={teVolleOrdinalen}
              niveau={bordNiveau}
            />
          </div>
        )}

        {/* Generation (FR-5.1) with its spreading report (E3-02, FR-5.2). It only ever ADDS proposals — it
            never discards a teacher's decision or a locked placement (Art. IV.1, Art. IX.3), which is also why
            a thema the teacher has dragged survives it: a move sets the placement to `manueel`. */}
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
              {generatie.isPending ? t("kalender.genereerBezig") : t("kalender.genereer")}
            </Button>
            <p className="max-w-2xl text-xs leading-snug text-ink-zacht">
              {t("kalender.genereerUitleg")}
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

          {generatie.isSuccess && <Spreidingsoverzicht resultaat={generatie.data} />}
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

            {/* What aanvaarden and weigeren mean, said ONCE here rather than on every card (E4-02). The decision
                buttons live on the card face, and a dozen proposals with a two-line explanation each is the wall of
                prose this screen keeps having to cut. Deliberately **not** tier-dependent, unlike the sentence above
                it: a decision is available on every proposal in every view, which is exactly why it is not paired
                through {@link BORDUITLEG}. It also says nothing about *how* a thema comes to count beyond
                aanvaarden, because "of zelf verplaatsen" is only true on the tier where moving works.

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

            {/* Said ONCE, above the board, instead of repeated inside every flagged column. The disclosure is
                still visible text rather than a tooltip (E3-06) — it just is not printed seven times. */}
            {teVolleOrdinalen.size > 0 && (
              <p className="rounded-md bg-attentie-zacht px-3.5 py-2.5 text-xs leading-snug text-attentie-ink">
                <span aria-hidden="true">▲</span> {t("kalender.teVolUitleg")}
              </p>
            )}

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
 * The thema name out of a draggable's `data`, for the live-region announcements.
 *
 * Defensive rather than a cast: dnd-kit types `data.current` as an open record, so a card rendered without the
 * payload would otherwise put "undefined" into a sentence a screen reader reads aloud.
 */
function themaNaamVan(data: Record<string, unknown> | undefined): string {
  const plaatsing = data?.plaatsing as Themaplaatsing | undefined;

  return plaatsing?.themaNaam ?? "";
}
