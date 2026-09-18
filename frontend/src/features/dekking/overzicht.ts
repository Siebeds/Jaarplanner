import type { Dekkingsstap, Lacuneoorzaak, LeerplandoelDekking, MinimumdoelDekking } from "../../lib/types";

/**
 * The shape of the dekkingsoverzicht (TB-022): the goals grouped by discipline and then domein, and the gaps turned
 * into a short list of things a teacher can do. Pure functions over the one payload, so the screen only renders.
 *
 * The top level is the discipline (Art. VII.0), which the owner asked for in the words "per leergebied" (2026-09-15).
 * The code says discipline because leergebied names something else in Art. XII: a grouping over disciplines. Should
 * directie decide one (the Wereldoriëntatie question, Art. XIV), `groepeerPerDiscipline` is the one place it lands.
 *
 * **Neither function knows whether the figure may be shown**, and that is deliberate. While a stale placement withholds
 * the total (directie 2026-07-28), every count here is a piece of that total: the tallies add up to it and the action
 * counts partition its gaps. The screen owns that gate and renders none of them then.
 */

/** What the action list needs of a goal, leerplandoel or minimumdoel alike. */
export interface Lacunerij {
  isGedekt: boolean;
  oorzaak: Lacuneoorzaak | null;
  kandidaatThemas: string[];
}

/** How many goals of a set stand in each step (ADR-0047). `prognose` excludes the gedekte. */
export interface Stappen {
  gedekt: number;
  prognose: number;
  totaal: number;
}

export function telStappen(doelen: readonly { stap: Dekkingsstap }[]): Stappen {
  return {
    gedekt: doelen.filter((d) => d.stap === "Gedekt").length,
    prognose: doelen.filter((d) => d.stap === "Prognose").length,
    totaal: doelen.length,
  };
}

/** One leergebied of the decree with its minimumdoelen, in the server's order. */
export interface Leergebiedgroep {
  /** Null for the minimumdoelen whose ordering is not known; the screen names that group. */
  naam: string | null;
  doelen: MinimumdoelDekking[];
  gedekt: number;
  totaal: number;
}

/** The minimumdoelen grouped by the decree's leergebied, keeping the server's order (unordered last). */
export function groepeerPerLeergebied(doelen: MinimumdoelDekking[]): Leergebiedgroep[] {
  const groepen = new Map<string | null, Leergebiedgroep>();
  for (const doel of doelen) {
    let groep = groepen.get(doel.leergebied);
    if (!groep) {
      groep = { naam: doel.leergebied, doelen: [], gedekt: 0, totaal: 0 };
      groepen.set(doel.leergebied, groep);
    }
    groep.doelen.push(doel);
    groep.totaal += 1;
    if (doel.isGedekt) groep.gedekt += 1;
  }
  return [...groepen.values()];
}

export interface Domein {
  naam: string;
  doelen: LeerplandoelDekking[];
  gedekt: number;
  totaal: number;
}

export interface Disciplinegroep {
  nummer: string;
  naam: string;
  domeinen: Domein[];
  gedekt: number;
  totaal: number;
}

/**
 * Groups by discipline, then domein, keeping the server's order within each. The counts are over every goal passed in,
 * so pass the whole scope rather than what one view shows: a tally that follows the "Nog te doen" filter reads 0/N.
 */
export function groepeerPerDiscipline(doelen: LeerplandoelDekking[]): Disciplinegroep[] {
  const groepen = new Map<string, Disciplinegroep>();

  for (const doel of doelen) {
    let groep = groepen.get(doel.disciplineNummer);
    if (!groep) {
      groep = { nummer: doel.disciplineNummer, naam: doel.disciplineNaam ?? doel.disciplineNummer, domeinen: [], gedekt: 0, totaal: 0 };
      groepen.set(doel.disciplineNummer, groep);
    }

    let domein = groep.domeinen.find((d) => d.naam === doel.domein);
    if (!domein) {
      domein = { naam: doel.domein, doelen: [], gedekt: 0, totaal: 0 };
      groep.domeinen.push(domein);
    }

    domein.doelen.push(doel);
    domein.totaal += 1;
    groep.totaal += 1;
    if (doel.isGedekt) {
      domein.gedekt += 1;
      groep.gedekt += 1;
    }
  }

  return [...groepen.values()];
}

/** Discipline numbers in their own order: "2" before "9.1" before "10". */
const opNummer = (a: Disciplinegroep, b: Disciplinegroep) => a.nummer.localeCompare(b.nummer, "nl", { numeric: true });

/**
 * The least covered discipline first, because that is where the work is. Without figures (the withheld state) there is
 * nothing to rank by, and ranking on the rows' verdicts would put the withheld figure back in the order: the curriculum's
 * own order then.
 */
export function sorteerDisciplines(groepen: Disciplinegroep[], opDekking: boolean): Disciplinegroep[] {
  if (!opDekking) return [...groepen].sort(opNummer);
  return [...groepen].sort((a, b) => a.gedekt / a.totaal - b.gedekt / b.totaal || opNummer(a, b));
}

/** The three causes a teacher closes on the kalender, one thema at a time. */
export type Themaactiesoort = Extract<Lacuneoorzaak, "WachtOpBeslissing" | "PlaatsingGeweigerd" | "NietIngepland">;

const THEMAACTIES: readonly Themaactiesoort[] = ["WachtOpBeslissing", "PlaatsingGeweigerd", "NietIngepland"];

const isThemaactie = (oorzaak: string): oorzaak is Themaactiesoort => (THEMAACTIES as readonly string[]).includes(oorzaak);

export interface Themaactie {
  soort: Themaactiesoort;
  thema: string;
  /** How many missing goals this thema would cover. Per thema: a goal two thema's could cover counts for both. */
  aantal: number;
}

export interface Acties {
  themaacties: Themaactie[];
  /** The actions beyond the ones shown. */
  aantalOverig: number;
  /** Goals only an undecided link points at: decided on Thema's, not on the kalender. */
  aantalOnbeslist: number;
  /** Goals nothing aims at: no planning action closes these (a planned algemene fiche still can close a leerplandoel). */
  aantalZonderThema: number;
}

export const MAX_THEMAACTIES = 5;

/**
 * The gaps as actions, the largest first (TB-022). A teacher closes gaps by placing thema's, not goal by goal, so each
 * thema the server named for a gap's cause gets one line with how many gaps it would close.
 *
 * A cause this client does not know is skipped rather than guessed at: the server's list of causes is kept in step by
 * hand, and a sentence for an unknown state would be a sentence nobody checked.
 */
export function bepaalActies(doelen: readonly Lacunerij[]): Acties {
  const perActie = new Map<string, Themaactie>();
  let aantalOnbeslist = 0;
  let aantalZonderThema = 0;

  for (const doel of doelen) {
    if (doel.isGedekt || doel.oorzaak === null) continue;

    if (doel.oorzaak === "KoppelingNietBeslist") {
      aantalOnbeslist += 1;
    } else if (doel.oorzaak === "GeenThema") {
      aantalZonderThema += 1;
    } else if (isThemaactie(doel.oorzaak)) {
      for (const thema of new Set(doel.kandidaatThemas)) {
        const sleutel = JSON.stringify([doel.oorzaak, thema]);
        const bestaand = perActie.get(sleutel);
        if (bestaand) bestaand.aantal += 1;
        else perActie.set(sleutel, { soort: doel.oorzaak, thema, aantal: 1 });
      }
    }
  }

  const alle = [...perActie.values()].sort(
    (a, b) =>
      b.aantal - a.aantal || THEMAACTIES.indexOf(a.soort) - THEMAACTIES.indexOf(b.soort) || a.thema.localeCompare(b.thema, "nl"),
  );

  return {
    themaacties: alle.slice(0, MAX_THEMAACTIES),
    aantalOverig: Math.max(0, alle.length - MAX_THEMAACTIES),
    aantalOnbeslist,
    aantalZonderThema,
  };
}
