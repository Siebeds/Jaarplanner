import { isoDatum } from "../../lib/utils";
import type { ThemaplaatsingWeergave, ThemaWeergave } from "../../lib/types";

/** Monday-first grid, matching how Belgian teachers read a week. */
const DAGNAMEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function dagnamen(): string[] {
  return DAGNAMEN;
}

export function begingVanMaand(datum: Date): Date {
  return new Date(datum.getFullYear(), datum.getMonth(), 1);
}

export function voegDagenToe(datum: Date, aantal: number): Date {
  const kopie = new Date(datum);
  kopie.setDate(kopie.getDate() + aantal);
  return kopie;
}

export function voegMaandenToe(datum: Date, aantal: number): Date {
  const kopie = new Date(datum);
  kopie.setMonth(kopie.getMonth() + aantal);
  return kopie;
}

/** ISO weekday with Monday = 0. */
function maandagIndex(datum: Date): number {
  return (datum.getDay() + 6) % 7;
}

export function beginVanWeek(datum: Date): Date {
  return voegDagenToe(datum, -maandagIndex(datum));
}

/** The 6x7 day grid a month view needs, including the leading/trailing days of neighbour months. */
export function maandRooster(anker: Date): Date[] {
  const eersteVanMaand = begingVanMaand(anker);
  const start = beginVanWeek(eersteVanMaand);
  return Array.from({ length: 42 }, (_, i) => voegDagenToe(start, i));
}

export function weekRooster(anker: Date): Date[] {
  const start = beginVanWeek(anker);
  return Array.from({ length: 7 }, (_, i) => voegDagenToe(start, i));
}

/**
 * A placement's effective [start, end) date range. `blokEind` is the authoritative end when the
 * backend supplies it; otherwise we estimate from `duurWeken` rather than treating the period as
 * open-ended forever, which would make every later month look occupied.
 */
export function plaatsingBereik(plaatsing: ThemaplaatsingWeergave): { start: Date; eind: Date } {
  const start = new Date(plaatsing.blokStart + "T00:00:00");
  const eind = plaatsing.blokEind
    ? new Date(plaatsing.blokEind + "T00:00:00")
    : voegDagenToe(start, plaatsing.duurWeken * 7);
  return { start, eind };
}

export function isActiefOp(plaatsing: ThemaplaatsingWeergave, dag: Date): boolean {
  if (plaatsing.isVervallen || plaatsing.status === "Geweigerd") return false;
  const { start, eind } = plaatsingBereik(plaatsing);
  const dagIso = isoDatum(dag);
  return dagIso >= isoDatum(start) && dagIso < isoDatum(eind);
}

/** Dagoverzicht: het uurrooster loopt van 8u tot 18u, met een lijn per half uur. */
export const DAG_START_UUR = 8;
export const DAG_EIND_UUR = 18;

export function halfUurBlokken(): { uur: number; half: boolean; label: string }[] {
  const blokken: { uur: number; half: boolean; label: string }[] = [];
  for (let uur = DAG_START_UUR; uur < DAG_EIND_UUR; uur++) {
    blokken.push({ uur, half: false, label: `${String(uur).padStart(2, "0")}:00` });
    blokken.push({ uur, half: true, label: `${String(uur).padStart(2, "0")}:30` });
  }
  return blokken;
}

/**
 * Minutes since DAG_START_UUR, clamped to the visible 8u-18u venster — used to position agenda-items.
 * Tolerant of malformed/missing `tijd` (e.g. a leftover agenda-item from an older app-versie in
 * localStorage): rather than throwing and blanking the whole dag-/weekoverzicht, an invalid value
 * is treated as "start van de dag" so the rest of the agenda still renders.
 */
export function minutenSindsStart(tijd: string | undefined): number {
  const deel = typeof tijd === "string" ? tijd.split(":") : [];
  const uur = Number(deel[0]);
  const minuut = Number(deel[1]);
  if (!Number.isFinite(uur) || !Number.isFinite(minuut)) return 0;
  const minuten = (uur - DAG_START_UUR) * 60 + minuut;
  return Math.min(Math.max(minuten, 0), (DAG_EIND_UUR - DAG_START_UUR) * 60);
}

/**
 * A week-view "banner": for a thema active on one or more days of this week, the contiguous
 * [startIdx, eindIdx] (0 = maandag) column span to render as one bar across the days it covers —
 * clipped to the days actually inside the week, even if the placement itself runs longer.
 */
export interface WeekBanner {
  plaatsing: ThemaplaatsingWeergave;
  startIdx: number;
  eindIdx: number;
}

export function weekBanners(dagen: Date[], plaatsingen: ThemaplaatsingWeergave[]): WeekBanner[] {
  const banners: WeekBanner[] = [];
  for (const plaatsing of plaatsingen) {
    const actieveIndexen = dagen.map((d, i) => (isActiefOp(plaatsing, d) ? i : -1)).filter((i) => i >= 0);
    if (actieveIndexen.length === 0) continue;
    banners.push({ plaatsing, startIdx: actieveIndexen[0], eindIdx: actieveIndexen[actieveIndexen.length - 1] });
  }
  return banners;
}

/**
 * The subthema this klas is currently working on within a thema (Art. IX: subthema is scoped
 * per klas). Looks the thema up in the already-fetched `themas`-lijst (no extra request) and finds
 * the one subthema-record for this klas. Returns undefined when the thema is not loaded yet or this
 * klas has none -- the caller then simply shows the thema-naam alone.
 */
export function subthemaNaamVoorKlas(themas: ThemaWeergave[], themaId: string, klasId: string): string | undefined {
  return themas.find((t) => t.id === themaId)?.subthemas.find((s) => s.klasId === klasId)?.naam;
}

/** "Water" alone, or "Water: Regen" when this klas has a subthema scheduled within the thema. */
export function themaBannerLabel(themaNaam: string, subthemaNaam: string | undefined): string {
  return subthemaNaam ? `${themaNaam}: ${subthemaNaam}` : themaNaam;
}

/** A small stable colour class per thema, purely so month-view dots stay visually distinguishable. */
const KLEUR_KLASSEN = [
  "bg-doelsoort-md",
  "bg-doelsoort-gemeenschappelijk",
  "bg-doelsoort-verdieping",
  "bg-doelsoort-precurriculum",
  "bg-doelsoort-specifiek",
  "bg-doelsoort-anderstalige",
];
export function themaKleurKlasse(themaId: string): string {
  let hash = 0;
  for (let i = 0; i < themaId.length; i++) hash = (hash * 31 + themaId.charCodeAt(i)) | 0;
  return KLEUR_KLASSEN[Math.abs(hash) % KLEUR_KLASSEN.length];
}

/**
 * Personal colour-tag for "mijn agenda"-items — a teacher's own organisational choice (bv. "al mijn
 * turnlessen groen"), deliberately drawn from Tailwind's base palette rather than the app's own
 * `terra`/`doelsoort`/`suggestie`/`dekking` tokens: those hues are already reserved for structural chrome
 * and AI-suggestieregels (Art. XII), and reusing one here would make an agenda-item's colour look like it
 * meant something it doesn't. `undefined`/`"standaard"` keeps today's default terra styling unchanged.
 */
export const AGENDA_KLEUR_OPTIES = [
  { waarde: undefined, label: "Standaard", chip: "bg-terra", vlak: "bg-terra-zacht", tekst: "text-terra-diep" },
  { waarde: "blauw", label: "Blauw", chip: "bg-sky-500", vlak: "bg-sky-100", tekst: "text-sky-900" },
  { waarde: "groen", label: "Groen", chip: "bg-emerald-500", vlak: "bg-emerald-100", tekst: "text-emerald-900" },
  { waarde: "paars", label: "Paars", chip: "bg-violet-500", vlak: "bg-violet-100", tekst: "text-violet-900" },
  { waarde: "roze", label: "Roze", chip: "bg-rose-500", vlak: "bg-rose-100", tekst: "text-rose-900" },
  { waarde: "geel", label: "Geel", chip: "bg-amber-500", vlak: "bg-amber-100", tekst: "text-amber-900" },
] as const;

export function agendaKleurKlassen(kleur?: string): { vlak: string; tekst: string } {
  const optie = AGENDA_KLEUR_OPTIES.find((o) => o.waarde === kleur);
  return optie ? { vlak: optie.vlak, tekst: optie.tekst } : { vlak: "bg-terra-zacht", tekst: "text-terra-diep" };
}
