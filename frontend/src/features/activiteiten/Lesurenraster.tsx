import { useDraggable, useDroppable } from "@dnd-kit/core";
import { IcoonHoek, IcoonPlus } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import type { Dagweergave, GeplandeActiviteit } from "../../lib/types";
import { KLEURVLAK, kleurSleutel, type Activiteitkleur } from "./kleuren";
import { LAATSTE_SLOT, LESUREN, slotId } from "./lesuren";

/** A scheduled activiteit as the API sends it now: with the colour and the length in lesuren. */
export type GeplandMetKleur = GeplandeActiviteit & {
  kleur?: Activiteitkleur | null;
  lengteInLesuren?: number;
};

/**
 * Where a lesuur sits in the CSS grid.
 *
 * The noon break gets a row of its own, which is why this is not `slot + 1`. An activiteit that runs
 * through the break therefore spans that row too, and that is the honest drawing: it does run through
 * it.
 */
const RIJ_VAN_MIDDAG = LESUREN.findIndex((l) => l.naMiddag) + 1;
const gridRij = (slot: number) => (slot < RIJ_VAN_MIDDAG ? slot + 1 : slot + 2);
const AANTAL_RIJEN = LESUREN.length + 1;

/** One hoek taking one lesuur on this day: its placement, its name, and the hour it claimed. */
export interface Hoekuur {
  plaatsingId: string;
  naam: string;
  /** The `volgorde` of the moment. Kept because a cell may draw an hour that is not its own. */
  slot: number;
}

/** One frozen empty list, so an hour without hoeken does not hand a new array to every render. */
const GEEN_HOEKEN: readonly Hoekuur[] = [];

/** What a teacher calls this slot. Falls back to the ordinal, which is what the numbering means. */
const nummerVan = (slot: number) => LESUREN.find((l) => l.slot === slot)?.nummer ?? slot + 1;

/**
 * One day, divided into lesuren.
 *
 * **A real grid, so a block that takes three lesuren stands BESIDE hours three and four rather than
 * pushing them down.** The first version was a flex column with a tall card in one row, which made
 * the hours below it slide out from under the block and then repeat its name. Rows and spans put the
 * hour numbers where they belong: next to the thing occupying them.
 *
 * **An empty hour is a row too, and it carries its own plus.** The empty rows are the point: they are
 * where a teacher puts something, and a grid that only listed what is planned would hide the free
 * hours. Adding is one press on the hour you meant.
 *
 * **The whole block drags, and the whole block opens.** Moving an activiteit to another lesuur is one
 * number on the wire (`volgorde`), so a drop is a single mutation and needs no confirmation. There is
 * no separate grip: the pointer sensor needs six pixels of travel before a press counts as a drag, so
 * a press that does not move is a click and opens the activiteit. That is the same pattern the month
 * cards already use, and aiming at a handle at the end of a bar was the odd one out (owner, 2026-08-24).
 * On a keyboard the two jobs are two keys: Enter opens, Space picks up (see `sleep.ts`).
 *
 * **A closed day gets no rows at all.** The server refuses a placement on a vakantie or a vrije dag,
 * so seven empty hours with seven plusses would be seven refusals.
 */
export function Lesurenraster({
  dag,
  hoekenPerSlot,
  onVoegToe,
  onOpen,
  onOpenHoek,
}: {
  dag: Dagweergave;
  /**
   * Which hoeken take which lesuur on this day, by slot.
   *
   * **A hoek that claimed a lesuur OCCUPIES it, like an activiteit does** (owner ruling,
   * 2026-08-31): "dit pakt effectief een uur van de dag in". So it is drawn as a block and the hour
   * stops offering its "vrij" invitation, because the hour is not free.
   *
   * *This reverses the rule that shipped on 2026-08-30, and the reasoning it reversed is worth
   * keeping:* a corner was drawn as a thin line inside an hour that still read as free, on the
   * argument that hoekenwerk is what the class does rather than what the teacher has finished
   * planning. The owner's answer is that the two are the same thing when the corner has been given an
   * hour. A hoek placed with **no** lesuur is the case that argument was really about, and it is
   * unaffected: it writes no moment, so it never reaches this map.
   *
   * The hour stays open for an activiteit beside the corner, through the plus in the hour column,
   * exactly as an hour holding one activiteit does.
   */
  hoekenPerSlot: ReadonlyMap<number, readonly Hoekuur[]>;
  /** Asked for an activiteit in this lesuur. `slot` is what goes into `volgorde`. */
  onVoegToe: (datum: string, slot: number) => void;
  onOpen: (activiteit: GeplandeActiviteit) => void;
  /** Opened a placed hoek, which is where its period and its verrijkingen are read back. */
  onOpenHoek: (plaatsingId: string) => void;
}) {
  if (!dag.isLesdag) {
    return (
      <div className="rounded-kaart border border-lijn bg-vlak-diep/60 px-4 py-8 text-center">
        <p className="text-body font-medium text-inkt">{dag.sluitingsnaam ?? t("periode.geenLesdag")}</p>
      </div>
    );
  }

  const activiteiten = dag.activiteiten as GeplandMetKleur[];
  const lengteVan = (a: GeplandMetKleur) => Math.max(1, a.lengteInLesuren ?? 1);

  // What STARTS in each hour, and which hours are merely covered by a block that began above. Two
  // maps rather than one: a covered hour and a free hour look the same in the data and must not look
  // the same on screen, because one is taken and the other is an invitation.
  //
  // `bedekt` maps a covered hour to the hour whose block covers it, not just to "covered". The value
  // is what lets a hoek in a covered hour be drawn at all: see `hoekenVanCel`.
  const begintIn = new Map<number, GeplandMetKleur[]>();
  const bedekt = new Map<number, number>();
  for (const activiteit of activiteiten) {
    if (activiteit.volgorde > LAATSTE_SLOT) continue;
    begintIn.set(activiteit.volgorde, [...(begintIn.get(activiteit.volgorde) ?? []), activiteit]);
    for (let i = 1; i < lengteVan(activiteit); i++) bedekt.set(activiteit.volgorde + i, activiteit.volgorde);
  }

  /*
    WHICH CELL DRAWS WHICH HOEK, keyed by the cell rather than by the hour.

    Usually the same thing: the hour draws its own corners. The exception is an hour swallowed by a
    three-hour block above it, which gets no cell of its own in the content column, so a corner sitting
    in it would be drawn NOWHERE. That was already true before a hoek occupied its hour, and a comment
    here claimed the opposite ("it is drawn on the hour it starts in") by confusing the activiteit's
    start with the corner's. The corner is handed to the covering cell instead, and it says which hour
    it belongs to, because a block that spans three hours cannot say it by position.
  */
  const hoekenVanCel = new Map<number, Hoekuur[]>();
  for (const lesuur of LESUREN) {
    const eigen = hoekenPerSlot.get(lesuur.slot) ?? [];
    if (eigen.length === 0) continue;
    const heeftEigenCel = (begintIn.get(lesuur.slot) ?? []).length > 0 || !bedekt.has(lesuur.slot);
    const cel = heeftEigenCel ? lesuur.slot : (bedekt.get(lesuur.slot) as number);
    hoekenVanCel.set(cel, [...(hoekenVanCel.get(cel) ?? []), ...eigen]);
  }

  // Placements past the last drawn hour are not dropped on the floor: they exist, so they get their
  // own heading rather than being missing from a day that looks complete.
  const buitenRaster = activiteiten.filter((a) => a.volgorde > LAATSTE_SLOT);

  return (
    <div className="rounded-kaart border border-lijn bg-kaart p-2 sm:p-3">
      <div
        className="grid gap-x-2 gap-y-1"
        style={{
          gridTemplateColumns: "2.75rem minmax(0, 1fr)",
          // The break row is thin; every hour is at least a comfortable touch target tall.
          gridTemplateRows: Array.from({ length: AANTAL_RIJEN }, (_, i) =>
            i + 1 === RIJ_VAN_MIDDAG + 1 ? "auto" : "minmax(3rem, auto)",
          ).join(" "),
        }}
      >
        {LESUREN.map((lesuur) => {
          // Filled by an activiteit or by a corner, since a corner now takes the hour. Keyed on the
          // CELL, so a covered hour still gets no plus: it has no cell to add anything into.
          const gevuld = (begintIn.get(lesuur.slot) ?? []).length > 0 || (hoekenVanCel.get(lesuur.slot) ?? []).length > 0;
          return (
            <div
              key={`nr-${lesuur.slot}`}
              className="flex flex-col items-center self-start pt-2.5"
              style={{ gridColumn: 1, gridRow: gridRij(lesuur.slot) }}
            >
              <p className="mono text-body font-medium text-inkt-zwak">{lesuur.nummer}</p>
              {/* The way to put a SECOND activiteit in an hour that already has one. It lives in the
                  hour column rather than under the block, because in the content column it ate a grid
                  row and left a three-hour block drawn two hours tall. An hour that is free needs no
                  such control: its whole row is already the invitation. */}
              {gevuld ? (
                <button
                  type="button"
                  onClick={() => onVoegToe(dag.datum, lesuur.slot)}
                  aria-label={t("lesuur.nogEenOp", { nummer: lesuur.nummer })}
                  className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded text-inkt-zwak transition-colors duration-150 hover:bg-vlak-diep hover:text-inkt"
                >
                  <IcoonPlus aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}

        {/* The noon break, once, on its own row across both columns. */}
        <p
          className="flex items-center gap-3 py-1 text-micro uppercase text-inkt-zwak"
          style={{ gridColumn: "1 / -1", gridRow: RIJ_VAN_MIDDAG + 1 }}
        >
          <span aria-hidden="true" className="h-px flex-1 bg-lijn" />
          {t("lesuur.middag")}
          <span aria-hidden="true" className="h-px flex-1 bg-lijn" />
        </p>

        {LESUREN.map((lesuur) => {
          const start = begintIn.get(lesuur.slot) ?? [];
          // The block above owns this hour, so this hour gets no cell. Its corners are not lost:
          // `hoekenVanCel` handed them to the covering cell before this loop ran.
          if (start.length === 0 && bedekt.has(lesuur.slot)) return null;
          return (
            <Uurvak
              key={`vak-${lesuur.slot}`}
              datum={dag.datum}
              slot={lesuur.slot}
              start={start}
              hoeken={hoekenVanCel.get(lesuur.slot) ?? GEEN_HOEKEN}
              lengteVan={lengteVan}
              onVoegToe={onVoegToe}
              onOpen={onOpen}
              onOpenHoek={onOpenHoek}
            />
          );
        })}
      </div>

      {buitenRaster.length > 0 ? (
        <section className="mt-3 border-t border-lijn pt-3">
          <h3 className="text-micro uppercase text-inkt-zwak">{t("lesuur.buitenRaster")}</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {buitenRaster.map((activiteit) => (
              <li key={activiteit.plaatsingId}>
                <Blok activiteit={activiteit} lengte={lengteVan(activiteit)} onOpen={() => onOpen(activiteit)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The content column of one hour: what starts there, or an invitation.
 *
 * Spans as many grid rows as the longest thing starting in it, so the hours it covers keep their
 * numbers in the left column and gain nothing in the right.
 */
function Uurvak({
  datum,
  slot,
  start,
  hoeken,
  lengteVan,
  onVoegToe,
  onOpen,
  onOpenHoek,
}: {
  datum: string;
  slot: number;
  start: GeplandMetKleur[];
  hoeken: readonly Hoekuur[];
  lengteVan: (a: GeplandMetKleur) => number;
  onVoegToe: (datum: string, slot: number) => void;
  onOpen: (activiteit: GeplandeActiviteit) => void;
  onOpenHoek: (plaatsingId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(datum, slot) });
  const langste = start.reduce((max, a) => Math.max(max, lengteVan(a)), 1);
  const eindSlot = Math.min(slot + langste - 1, LAATSTE_SLOT);
  const span = gridRij(eindSlot) - gridRij(slot) + 1;
  // The grid stops at the last lesuur, so a block starting near the end is drawn shorter than the
  // activiteit actually is. Without saying so, the drawing would claim it fits.
  const tekort = slot + langste - 1 - LAATSTE_SLOT;

  return (
    <div
      ref={setNodeRef}
      style={{ gridColumn: 2, gridRow: `${gridRij(slot)} / span ${span}` }}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-veld transition-colors duration-100",
        isOver && "bg-accent-zacht",
      )}
    >
      {/* The corners running in this hour, above whatever else is in it. A block, because the hour is
          taken (see the prop's note). No colour: the palette on a block means the activiteit's own
          colour, so borrowing one here would say something about a corner that corners do not have.
          What distinguishes it is the icon and the word underneath, which is also what makes it
          readable without colour at all (Art. XII, WCAG 2.2 AA).

          It opens the placement rather than sitting there inert: a block that ignores a click beside
          blocks that answer one reads as broken. It does NOT drag, because moving a single moment to
          another hour has no endpoint yet, and a grabbing cursor over a gesture that cannot land is
          the E3-06 rule with a different control. */}
      {hoeken.map((hoek) => (
        <button
          key={hoek.plaatsingId + hoek.slot}
          type="button"
          onClick={() => onOpenHoek(hoek.plaatsingId)}
          className="flex min-h-raak flex-1 flex-col justify-center rounded-veld border border-lijn bg-vlak px-3 py-1.5 text-left transition-colors duration-150 hover:border-accent"
        >
          <span className="flex min-w-0 items-center gap-1.5 text-body font-medium text-inkt">
            <IcoonHoek aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">{hoek.naam}</span>
          </span>
          <span className="truncate text-meta text-inkt-zacht">
            {hoek.slot === slot ? t("lesuur.hoekenwerk") : t("lesuur.hoekenwerkOp", { nummer: nummerVan(hoek.slot) })}
          </span>
        </button>
      ))}

      {/* The invitation, and only where there is genuinely nothing in the hour. An hour holding a
          corner is not free, so it does not offer to be filled; the plus in the hour column beside it
          is still there for an activiteit alongside. */}
      {start.length === 0 && hoeken.length === 0 ? (
        <button
          type="button"
          onClick={() => onVoegToe(datum, slot)}
          className="flex h-full min-h-raak w-full items-center gap-2 rounded-veld border border-dashed border-lijn px-3 text-left text-meta text-inkt-zwak transition-colors duration-150 hover:border-accent hover:text-accent"
        >
          <IcoonPlus aria-hidden="true" className="h-4 w-4 shrink-0" />
          {t("lesuur.vrij")}
        </button>
      ) : (
        start.map((activiteit) => (
          <Blok
            key={activiteit.plaatsingId}
            activiteit={activiteit}
            lengte={lengteVan(activiteit)}
            tekort={lengteVan(activiteit) === langste ? tekort : 0}
            onOpen={() => onOpen(activiteit)}
          />
        ))
      )}
    </div>
  );
}

/**
 * One placed activiteit.
 *
 * It fills the height its hour-block was given, and says its length in words as well. The height is
 * the fastest way to read "this runs three hours"; the words are what make it true for someone who
 * cannot see the height (Art. XII, WCAG 2.2 AA).
 */
function Blok({
  activiteit,
  lengte,
  tekort = 0,
  onOpen,
}: {
  activiteit: GeplandMetKleur;
  lengte: number;
  /** How many lesuren run past the end of the day. Zero when it fits, which is the normal case. */
  tekort?: number;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: activiteit.plaatsingId,
    data: { naam: activiteit.activiteitNaam },
  });
  const kleur = activiteit.kleur ?? null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      {...listeners}
      {...attributes}
      className={cn(
        "flex min-h-raak flex-1 cursor-grab touch-none flex-col justify-center rounded-veld border px-3 py-1.5 text-left",
        "transition-opacity duration-100 active:cursor-grabbing",
        kleur ? KLEURVLAK[kleur] : "border-lijn bg-vlak-diep/40",
        isDragging && "opacity-40",
      )}
    >
      <span className="truncate text-body font-medium text-inkt">{activiteit.activiteitNaam}</span>
      <span className="truncate text-meta text-inkt-zacht">
        {activiteit.subthemaNaam}
        {lengte > 1 ? ` · ${t("lesuur.duurt", { aantal: lengte })}` : ""}
        {kleur ? ` · ${t(kleurSleutel(kleur))}` : ""}
        {activiteit.valtBuitenThemaperiode ? ` · ${t("periode.buitenPeriode")}` : ""}
      </span>
      {tekort > 0 ? (
        <span className="mt-1 self-start rounded bg-attentie-zacht px-1.5 py-0.5 text-micro font-medium text-attentie-inkt">
          {telWoord(tekort, "lesuur.pastNietEen", "lesuur.pastNietMeer")}
        </span>
      ) : null}
    </button>
  );
}
