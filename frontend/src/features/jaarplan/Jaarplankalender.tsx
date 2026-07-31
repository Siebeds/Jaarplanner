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
import { t, tAantal } from "../../i18n";
import { ApiError } from "../../lib/api";
import { Jaarspine } from "./Jaarspine";
import { Periodekolom, Vakantiegat } from "./Periodekolom";
import { Generatieparametersformulier } from "./Generatieparametersformulier";
import { Spreidingsoverzicht } from "./Spreidingsoverzicht";
import { Sleepkaart, Themakaart } from "./Themakaart";
import { Weergaveschakelaar } from "./Weergaveschakelaar";
import {
  bepaalVerplaatsing,
  bouwRibbon,
  formatteerDatum,
  geplandeIn,
  isTeVol,
  plaatsingenIn,
  vervallenPlaatsingen,
} from "./kalenderFormat";
import { GENERATIEBLOKNIVEAU } from "./types";
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
  // Not a second network round trip in the normal case, and not a second grid on screen either. The board opens at
  // this tier, so this observer shares that first response's cache entry, and it stays subscribed when the board zooms
  // away. Nothing is rendered from it except the parameter form's own rows, which name themaperiodes by definition.
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

  // "The tier the teacher asked for could not be derived." Stays true through the teacher's own retry — see
  // `roosterHerstelGeprobeerd`. `rooster.data` is checked rather than `isSuccess` so a retry that has already landed
  // clears it.
  const roosterOnbekend =
    rooster.isError || (roosterHerstelGeprobeerd && rooster.data === undefined && rooster.isFetching);

  function probeerRoosterOpnieuw() {
    setRoosterHerstelGeprobeerd(true);
    void rooster.refetch();
  }

  if (grid === undefined) {
    // Nothing to draw at all: the first load failed, so there is no cached generation grid to stand on. The zoom
    // control comes along, because the other tier is a second thing to try and not merely decoration.
    if (roosterOnbekend) {
      return (
        <div className="flex flex-col gap-3">
          <Weergaveschakelaar niveau={niveau} onKies={setNiveau} bezig={false} />
          <Roosterfout
            terugval={false}
            bezig={rooster.isFetching}
            onOpnieuw={probeerRoosterOpnieuw}
          />
        </div>
      );
    }

    return <Melding soort="rustig">{t("kalender.laden")}</Melding>;
  }

  const segmenten = bouwRibbon(grid.blokken, grid.onderbrekingen);

  // The tier the board is ACTUALLY drawing, read off the answer (`grid.niveau`) rather than off the request
  // (`niveau`). During the one request a switch takes, the previous grid is still on screen, so reading the request
  // would label and enable it as the tier it is not yet.
  const bordNiveau: Planningsblokniveau =
    grid.niveau === "Subthemaperiode" ? "Subthemaperiode" : "Themaperiode";

  // Whether a thema can be moved on this board.
  //
  // Compared against the generation tier rather than against a bare "Themaperiode", because a placement keys on that
  // tier's block starts (ADR-0020 §3) and `VerplaatsPlaatsingAsync` resolves a target against the same tier. Derived
  // from the server's own string, so an unrecognised tier disables moving rather than offering a control that 400s.
  //
  // **The reason the affordance is withheld at the fine tier is semantic, not API-shaped.** It would be easy to read
  // this as "the server refuses those dates", and that is only two thirds true: each parent's *first* sub-block starts
  // on the parent's own start date, so 7 of the 19 fine columns of a real year genuinely ARE accepted targets. That
  // makes the affordance worse rather than better. A drop on sub-block 1 moves the thema into the **whole**
  // themaperiode, so the control would be honest about the request and dishonest about the effect: the teacher aimed at
  // a fortnight and the plan records five weeks. The remaining columns would 400 on top of that. Both halves point the
  // same way, but this one is the argument.
  const kanVerplaatsen = grid.niveau === GENERATIEBLOKNIVEAU;

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
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h2 id="kalender-titel" className="text-2xl font-bold text-ink sm:text-[1.75rem]">
            {t("kalender.titel")}
          </h2>
          {/* The class is the subtitle rather than being spliced into the heading with a dash, which read
              as three unrelated things joined by punctuation. */}
          <p className="mt-1 text-base text-ink-zacht">
            {plan.klasNaam}
            <span aria-hidden="true" className="px-2 text-border">
              |
            </span>
            <span data-cijfers>{plan.schooljaarNaam}</span>
          </p>
        </div>

        {/* Says out loud what the draft cannot do yet, so the review does not mistake absence for a bug. */}
        <p className="max-w-md rounded-md bg-petrol-wash px-3.5 py-2.5 text-xs leading-snug text-petrol">
          <span className="font-semibold">{t("kalender.conceptTitel")}. </span>
          {t("kalender.conceptUitleg")}
        </p>
      </header>

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
            kanVerplaatsen={kanVerplaatsen}
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
                a year with no themaperiode has no subthemaperiode either, so this can never hide the way back. */}
            <Weergaveschakelaar
              niveau={niveau}
              onKies={setNiveau}
              // The requested tier is not the tier on screen yet. `isPlaceholderData` is exactly that state: the
              // previous grid is being shown while the chosen one is in flight.
              bezig={rooster.isPlaceholderData}
            />

            {/* The chosen tier failed, and the board below is the generation tier's instead. Said here, beside the
                control that caused it and above the strip that is not what was asked for, rather than as a full-screen
                replacement. The pressed option stays the one the teacher chose: forcing it back to the tier on screen
                would make pressing it again a no-op (React skips a setState to the same value), i.e. a control that
                does nothing — so the way back out is the explicit retry, or the other option. */}
            {roosterOnbekend && (
              <Roosterfout
                terugval
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
              disabled={generatie.isPending || instellingenOnbekend}
              className="w-full sm:w-auto"
            >
              {generatie.isPending ? t("kalender.genereerBezig") : t("kalender.genereer")}
            </Button>
            <p className="max-w-2xl text-xs leading-snug text-ink-zacht">
              {t("kalender.genereerUitleg")}
            </p>
          </div>

          {/* Pre-generation parameters (E3-04, FR-5.4), collapsed by default so the one-click run stays one click.
              The settings are KEPT per class (owner ruling 2026-07-30), which is why the form takes the klas id: it
              loads what was last used and generating saves the new state. It is given the derived grid because each
              preference names a period, and because a kept preference whose period no longer exists has to be
              spotted against the current grid and said out loud.
              **It is given the GENERATION tier's grid, never the board's**, because that is the tier a kept setting
              keys on: handing over whatever the zoom happens to show made the stranded check a function of the view,
              so the same stored setting was reported as stranded at one tier and as valid at the other (fix round 1,
              finding 1). `niveau` still travels with the blocks and is still checked, so a server that answers another
              tier for a generation-tier request degrades to "cannot tell" rather than to a guess.
              `weergaveNiveau` is the separate question of what the *board* shows, which is what decides whether the
              period rows are offered here or the teacher is pointed at the other view (E3-04 obligation 1). */}
          <Generatieparametersformulier
            klasId={klasId}
            blokken={generatieRooster.data?.blokken ?? []}
            niveau={generatieRooster.data?.niveau ?? ""}
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
            disabled={generatie.isPending || instellingenOnbekend}
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
                ran the full 1350px of a desktop viewport as a single line, which is past any readable measure. */}
            <p className="max-w-4xl text-xs leading-snug text-ink-zacht">
              {kanVerplaatsen ? t("kalender.sleepUitleg") : t("kalender.fijnUitleg")}
            </p>

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
              // The board's accessible name follows the tier. Hard-coded to the coarse one it became a lie at the
              // fine one: a screen-reader user would be told they were in a list of themaperiodes while every column
              // in it was a subthemaperiode.
              aria-label={
                bordNiveau === "Subthemaperiode"
                  ? t("kalender.ribbonLabelFijn")
                  : t("kalender.ribbonLabel")
              }
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
                    kanVerplaatsen={kanVerplaatsen}
                    ouderIsIngepland={
                      segment.blok.ouderOrdinaal !== null &&
                      gevuldeOuderOrdinalen.has(segment.blok.ouderOrdinaal)
                    }
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
 * A period grid that could not be derived, with the two things the old one-liner lacked: what it costs, and a way out.
 *
 * **`terugval` distinguishes the two failures, because they cost a teacher different things.** With a cached generation
 * grid to stand on, nothing is lost: the plan is still on screen at the coarse grain and only the chosen *view* failed.
 * Without one, the screen has nothing to draw at all. One notice, two sentences, so the copy can state the actual
 * consequence instead of a generic "kon niet geladen worden".
 *
 * **Neither sentence says "herlaad de pagina".** The E3-04 audit rejected that outright: the query client has already
 * retried three times with backoff before this appears, so "try what just failed, but by hand" is not a next step. The
 * steps offered are a real refetch, the other tier, and (if it keeps failing) the beheerder.
 *
 * **The `alert` is the sentence, not the box.** The button is a *sibling* of the live region rather than a child of it —
 * the same separation `TeHerzien` and the settings notice use. A live region wrapping a control re-announces its whole
 * contents on every interaction, and pressing this one changes its own label.
 */
function Roosterfout({
  terugval,
  bezig,
  onOpnieuw,
}: {
  terugval: boolean;
  bezig: boolean;
  onOpnieuw: () => void;
}) {
  return (
    <div className="rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5">
      <p
        role="alert"
        className="max-w-3xl text-sm font-medium leading-snug text-suggestie-geweigerd"
      >
        {terugval ? t("kalender.roosterFoutWeergave") : t("kalender.roosterFout")}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={bezig}
        onClick={onOpnieuw}
        // `border-suggestie-geweigerd` rather than the default `border-input`, for the reason the settings notice
        // records: `variant="outline"` puts `bg-card` on this panel's `suggestie-geweigerd/10` wash, so the fill carries
        // no contrast of its own and the border is the only thing delineating the control (SC 1.4.11 wants 3:1 for it).
        // Same hue the panel already spends, so no second chrome accent (Art. XII).
        className="mt-2 h-7 border-suggestie-geweigerd bg-card text-xs"
      >
        {bezig ? t("kalender.roosterOpnieuwBezig") : t("kalender.roosterOpnieuw")}
      </Button>
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
  kanVerplaatsen,
}: {
  plaatsingen: ReturnType<typeof vervallenPlaatsingen>;
  klasId: string;
  blokken: readonly Planningsblok[];
  /**
   * Whether these cards can be given a period from here (E3-08).
   *
   * False at the fine zoom, where `blokken` are subthemaperiodes and the server refuses all but the ones that
   * coincide with a themaperiode start. The notice stays exactly as non-dismissible as it was — nothing is hidden,
   * nothing gains a "later" — but the card says where re-placing works instead of offering a picker that mostly
   * fails. The alternative, fetching the coarse grid alongside the fine one just for this panel, would put two
   * grids on one screen, which is the defect decision 1 of this story's design exists to avoid.
   */
  kanVerplaatsen: boolean;
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
              kanVerplaatsen={kanVerplaatsen}
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
