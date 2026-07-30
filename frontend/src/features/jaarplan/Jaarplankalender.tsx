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
import { Spreidingsoverzicht } from "./Spreidingsoverzicht";
import { Sleepkaart, Themakaart } from "./Themakaart";
import {
  bepaalVerplaatsing,
  bouwRibbon,
  formatteerDatum,
  geplandeIn,
  isTeVol,
  plaatsingenIn,
  vervallenPlaatsingen,
} from "./kalenderFormat";
import type { Planningsblok, Themaplaatsing } from "./types";
import {
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
 * picker is also the route that works on touch and by keyboard. The zoom toggle (E3-08) and the
 * ongeplande-doelen tray (E3-09) are still absent rather than faked.
 */
export interface JaarplankalenderProps {
  klasId: string;
}

export function Jaarplankalender({ klasId }: JaarplankalenderProps) {
  const jaarplan = useJaarplan(klasId);
  const rooster = usePlanningsrooster(jaarplan.data?.schooljaarId);
  const generatie = useGenereerJaarplan(klasId);
  const verplaats = useVerplaatsPlaatsing(klasId);

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

  // Errors are checked BEFORE pending, and the order is load-bearing rather than stylistic. `rooster` is
  // chained behind the schooljaarId the jaarplan returns, so while that id is unknown the rooster query is
  // *disabled* — and a disabled TanStack Query v5 query reports `isPending === true`, not idle. With the
  // pending guard first, a failed jaarplan fetch never reached its error branch: the screen showed
  // "Jaarplan laden…" forever and `kalender.fout` was dead code.
  if (jaarplan.isError) {
    return <Melding soort="fout">{t("kalender.fout")}</Melding>;
  }

  if (rooster.isError) {
    return <Melding soort="fout">{t("kalender.roosterFout")}</Melding>;
  }

  if (jaarplan.isPending || rooster.isPending) {
    return <Melding soort="rustig">{t("kalender.laden")}</Melding>;
  }

  const plan = jaarplan.data;
  const grid = rooster.data;
  const segmenten = bouwRibbon(grid.blokken, grid.onderbrekingen);

  // Placements pointing at a date that is no longer a period boundary. Collected FIRST and always
  // rendered: never silently relocated, never dropped (directie 2026-07-28).
  const vervallen = vervallenPlaatsingen(plan.plaatsingen, grid.blokken);

  // Derived once and shared with the spine, so the strip and the cards can never disagree about which
  // period is full or over-full.
  const gevuldeOrdinalen = new Set<number>();
  const teVolleOrdinalen = new Set<number>();
  for (const blok of grid.blokken) {
    const inBlok = plaatsingenIn(plan.plaatsingen, blok);
    if (geplandeIn(inBlok).length > 0) {
      gevuldeOrdinalen.add(blok.ordinaal);
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
          <TeHerzien plaatsingen={vervallen} klasId={klasId} blokken={grid.blokken} />
        )}

        {grid.blokken.length === 0 ? (
          <Melding soort="rustig">{t("kalender.leegRooster")}</Melding>
        ) : (
          <Jaarspine
            segmenten={segmenten}
            gevuldeOrdinalen={gevuldeOrdinalen}
            teVolleOrdinalen={teVolleOrdinalen}
          />
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
              onClick={() => generatie.mutate()}
              disabled={generatie.isPending}
              className="w-full sm:w-auto"
            >
              {generatie.isPending ? t("kalender.genereerBezig") : t("kalender.genereer")}
            </Button>
            <p className="max-w-2xl text-xs leading-snug text-ink-zacht">
              {t("kalender.genereerUitleg")}
            </p>
          </div>

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
                because the drag is undiscoverable on its own and unusable on a touch screen. */}
            <p className="text-xs leading-snug text-ink-zacht">{t("kalender.sleepUitleg")}</p>

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
              aria-label={t("kalender.ribbonLabel")}
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
}: {
  plaatsingen: ReturnType<typeof vervallenPlaatsingen>;
  klasId: string;
  blokken: readonly Planningsblok[];
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
            <Themakaart plaatsing={plaatsing} klasId={klasId} blokken={blokken} />
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
