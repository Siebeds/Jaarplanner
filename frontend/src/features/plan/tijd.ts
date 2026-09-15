/**
 * Clock time, as the agenda's time grid needs it (ADR-0028).
 *
 * **Minutes since midnight is the working unit.** Every position in the grid is a number of pixels from the top, so
 * every calculation is arithmetic on minutes; the ISO string is only what travels on the wire. Converting at the two
 * edges keeps the arithmetic in one place instead of parsing "13:30:00" in six components.
 *
 * **The constants below are presentation, not school data** (ADR-0028 decision 5). The server stores the times a
 * teacher picked, to the minute, and knows nothing about when a lesuur starts. These say what the grid draws and what
 * it snaps to, and they live together so a school setting can later replace them in one file.
 */

/**
 * The hours a teacher sees without scrolling, and where the grid opens.
 *
 * **These are not the hours the grid draws.** It draws the whole day (`HEEL_DE_DAG`); these two say which stretch of
 * it is on screen when the agenda arrives. Owner, 2026-09-11: *"ik wil gewoon kunnen scrollen maar default moet het
 * wel op 7u-18u staan"*, so an opvang at 6:45 or an oudercontact at 19:30 is a scroll away rather than behind a
 * control, and the ordinary school day is still what opens.
 */
export const DAGBEGIN = 7 * 60;
export const DAGEINDE = 18 * 60;

/**
 * The hours the grid draws: all of them.
 *
 * A teacher may pick any time, so every time has to be reachable by the gestures that make one: clicking an empty
 * hour, dragging a block to it. Drawing only the default window and widening it for what already falls outside (which
 * is what this did until 2026-09-11) reached the blocks but not the empty hours: an hour the grid does not draw is an
 * hour a teacher cannot click.
 */
export const HEEL_DE_DAG = { van: 0, tot: 24 * 60 } as const;

/** A drag, a resize and a click all land on a quarter of an hour. */
export const STAP = 15;

/** The shortest block the grid will make. Below this the name no longer fits and the handle is unaimable. */
export const KORTSTE = 15;

/** How long a newly placed activiteit runs when nothing says otherwise (owner, 2026-09-11). */
export const STANDAARDDUUR = 50;

/** The hour a day starts at when a gesture names no time: the first block of an ordinary morning. */
export const STANDAARDBEGIN = 8 * 60 + 30;

/** One minute of the day, in pixels. An hour is 56px, which fits a two-line block at the 50-minute default. */
export const PX_PER_MINUUT = 56 / 60;

/** Minutes since midnight from an ISO time (`"13:30:00"`, and `"13:30"` is accepted too). */
export function minuten(tijd: string): number {
  const [uur, min] = tijd.split(":");
  return Number(uur) * 60 + Number(min);
}

/** The wire format the API expects: `HH:mm:ss`, always with seconds. */
export function alsTijd(minutenVanafMiddernacht: number): string {
  const geklemd = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutenVanafMiddernacht)));
  const uur = Math.floor(geklemd / 60);
  const min = geklemd % 60;
  return `${String(uur).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

/**
 * What a teacher reads: `9:00`, `13:45`.
 *
 * No leading zero on the hour, which is how a Dutch timetable is written and how the server composes its refusals
 * (`Dagnotatie.Formatteer`). The two have to match: a teacher who reads "9:00" on a block and "09:00" in the sentence
 * refusing it has to work out that they are the same moment.
 */
export function toonTijd(tijd: string | number): string {
  const totaal = typeof tijd === "number" ? tijd : minuten(tijd);
  const uur = Math.floor(totaal / 60);
  const min = totaal % 60;
  return `${uur}:${String(min).padStart(2, "0")}`;
}

/** A block as a teacher says it out loud, for a label a screen reader reads: `van 9:00 tot 9:50`. */
export const toonBereik = (begin: string | number, einde: string | number) =>
  `${toonTijd(begin)} - ${toonTijd(einde)}`;

/** To the nearest quarter of an hour. */
export const rond = (minuten: number, stap = STAP) => Math.round(minuten / stap) * stap;

/**
 * The quarter of an hour a minute falls inside: its start, rounded down.
 *
 * What an empty stretch of the grid means under a pointer. `rond` is right for a block being moved, which should
 * snap to the nearest line; a press on empty space means the quarter the pointer is standing in, which is the one
 * the grid lights up (TB-014).
 */
export const vloer = (minuten: number, stap = STAP) => Math.floor(minuten / stap) * stap;

/** Something occupying a stretch of one day. */
export interface Blokje {
  id: string;
  begin: number;
  einde: number;
}

/** Where one blokje sits when several share the same minutes: which column, out of how many. */
export interface Plek {
  kolom: number;
  kolommen: number;
}

/**
 * Lays overlapping blokjes out side by side, the way every calendar does it.
 *
 * **Per cluster, not per day.** A morning of two overlapping blocks and an afternoon of one must not make the
 * afternoon block half as wide: the columns are counted within a run of things that actually touch each other, so a
 * cluster that ends releases the width back.
 *
 * Greedy from the earliest start: each blokje takes the first column free at its start time. That is the standard
 * algorithm and it is stable, which matters here because the result is a layout a teacher watches while dragging.
 */
export function kolommen(blokjes: readonly Blokje[]): Map<string, Plek> {
  const plekken = new Map<string, Plek>();
  const opVolgorde = [...blokjes].sort((a, b) => a.begin - b.begin || b.einde - a.einde || a.id.localeCompare(b.id));

  let cluster: { blokje: Blokje; kolom: number }[] = [];
  let clusterEinde = -1;

  const sluitCluster = () => {
    const breedte = cluster.reduce((max, lid) => Math.max(max, lid.kolom + 1), 1);
    for (const lid of cluster) plekken.set(lid.blokje.id, { kolom: lid.kolom, kolommen: breedte });
    cluster = [];
    clusterEinde = -1;
  };

  for (const blokje of opVolgorde) {
    // A blokje that starts when the cluster has ended belongs to a new one. Touching ends (one stops where the next
    // starts) are NOT an overlap: nine to ten and ten to eleven stand full width under each other.
    if (blokje.begin >= clusterEinde && cluster.length > 0) sluitCluster();

    const bezet = new Set(
      cluster.filter((lid) => lid.blokje.einde > blokje.begin).map((lid) => lid.kolom),
    );
    let kolom = 0;
    while (bezet.has(kolom)) kolom += 1;

    cluster.push({ blokje, kolom });
    clusterEinde = Math.max(clusterEinde, blokje.einde);
  }

  if (cluster.length > 0) sluitCluster();

  return plekken;
}
