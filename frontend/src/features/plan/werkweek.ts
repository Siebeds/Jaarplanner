import { datumsTussen, maandagVan, verschuif, weekdagIndex } from "../../lib/datum";

/**
 * THE WERKWEEK: MONDAY TO FRIDAY, AND WHAT IT LEAVES OUT (FB-040).
 *
 * A teacher plans almost everything on the five school days, so the view the agenda opens on drops Saturday and Sunday
 * and gives the school days their width. The week view keeps all seven, for whatever does land on a weekend, and the
 * werkweek says when something has: a weekend it skips is never a silent one.
 */

export function isWeekend(datum: string): boolean {
  return weekdagIndex(datum) >= 5;
}

/** The day itself on a school day, the Monday after on a Saturday or a Sunday. */
function volgendeWerkdagVanaf(datum: string): string {
  let dag = datum;
  while (isWeekend(dag)) dag = verschuif(dag, 1);
  return dag;
}

/** `aantal` weekdays from `datum` on (negative goes back), stepping over every Saturday and Sunday. */
function verschuifWerkdagen(datum: string, aantal: number): string {
  const stap = aantal < 0 ? -1 : 1;
  let dag = datum;
  for (let gezet = 0; gezet < Math.abs(aantal); ) {
    dag = verschuif(dag, stap);
    if (!isWeekend(dag)) gezet += 1;
  }
  return dag;
}

/**
 * The days the werkweek shows for an anchored day: its week's Monday to Friday on a desktop, and on a phone `aantal`
 * weekdays starting at the anchor, as the phone's week starts there too. An anchor on a weekend starts at the Monday
 * after on a phone; on a desktop it shows the week the weekend belongs to, whose Saturday and Sunday the hint names.
 */
export function werkweekdagen(anker: string, aantal: number): string[] {
  if (aantal >= 5) {
    const maandag = maandagVan(anker);
    return [0, 1, 2, 3, 4].map((stap) => verschuif(maandag, stap));
  }
  const eerste = volgendeWerkdagVanaf(anker);
  return Array.from({ length: aantal }, (_, stap) => verschuifWerkdagen(eerste, stap));
}

/**
 * Where Vorige and Volgende take the werkweek: a whole week on a desktop, and on a phone as many weekdays as it shows,
 * so that nothing is skipped, nothing repeats and after Friday comes Monday.
 */
export function schuifWerkweek(anker: string, aantal: number, richting: -1 | 1): string {
  if (aantal >= 5) return verschuif(maandagVan(anker), richting * 7);
  return verschuifWerkdagen(volgendeWerkdagVanaf(anker), richting * aantal);
}

/**
 * The range the werkweek reads: from the Monday of the first day shown to the Sunday of the last. Wider than what it
 * draws, because the weekends of those weeks are what the hint counts, and a count needs a read that reached them.
 */
export function werkweekbereik(dagen: readonly string[]): [string, string] {
  if (dagen.length === 0) return ["", ""];
  return [maandagVan(dagen[0]!), verschuif(maandagVan(dagen[dagen.length - 1]!), 6)];
}

/** A weekend the werkweek skips that holds something, with what it holds. */
export interface OverslagenWeekend {
  zaterdag: string;
  activiteiten: number;
  fiches: number;
}

/**
 * The weekends in `[van, tot]` with something planned on them, in date order: activiteiten and algemene fiche moments
 * counted apart, because the hint names them apart rather than calling a fiche an activiteit.
 */
export function overslagenWeekends(
  van: string,
  tot: string,
  activiteitenOp: (datum: string) => number,
  fichesOp: (datum: string) => number,
): OverslagenWeekend[] {
  if (van.length === 0 || tot.length === 0) return [];
  const perZaterdag = new Map<string, OverslagenWeekend>();
  for (const datum of datumsTussen(van, tot)) {
    if (!isWeekend(datum)) continue;
    const activiteiten = activiteitenOp(datum);
    const fiches = fichesOp(datum);
    if (activiteiten + fiches === 0) continue;
    const zaterdag = verschuif(maandagVan(datum), 5);
    const weekend = perZaterdag.get(zaterdag) ?? { zaterdag, activiteiten: 0, fiches: 0 };
    weekend.activiteiten += activiteiten;
    weekend.fiches += fiches;
    perZaterdag.set(zaterdag, weekend);
  }
  return [...perZaterdag.values()];
}
