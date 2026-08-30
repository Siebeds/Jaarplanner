import { useDraggable, useDroppable } from "@dnd-kit/core";
import { IcoonPlus } from "../../components/Iconen";
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
  onVoegToe,
  onOpen,
}: {
  dag: Dagweergave;
  /** Asked for an activiteit in this lesuur. `slot` is what goes into `volgorde`. */
  onVoegToe: (datum: string, slot: number) => void;
  onOpen: (activiteit: GeplandeActiviteit) => void;
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
  const begintIn = new Map<number, GeplandMetKleur[]>();
  const bedekt = new Set<number>();
  for (const activiteit of activiteiten) {
    if (activiteit.volgorde > LAATSTE_SLOT) continue;
    begintIn.set(activiteit.volgorde, [...(begintIn.get(activiteit.volgorde) ?? []), activiteit]);
    for (let i = 1; i < lengteVan(activiteit); i++) bedekt.add(activiteit.volgorde + i);
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
          const gevuld = (begintIn.get(lesuur.slot) ?? []).length > 0;
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
          if (start.length === 0 && bedekt.has(lesuur.slot)) return null; // the block above owns it
          return (
            <Uurvak
              key={`vak-${lesuur.slot}`}
              datum={dag.datum}
              slot={lesuur.slot}
              start={start}
              lengteVan={lengteVan}
              onVoegToe={onVoegToe}
              onOpen={onOpen}
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
  lengteVan,
  onVoegToe,
  onOpen,
}: {
  datum: string;
  slot: number;
  start: GeplandMetKleur[];
  lengteVan: (a: GeplandMetKleur) => number;
  onVoegToe: (datum: string, slot: number) => void;
  onOpen: (activiteit: GeplandeActiviteit) => void;
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
      {start.length === 0 ? (
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
