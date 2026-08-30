import { MAX_THEMADOELEN } from "../../lib/types";
import type { ActiviteitWeergave, SubthemaWeergave, ThemaWeergave } from "../../lib/types";

/**
 * Reading the school's own content as a list of places one leerplandoel could go.
 *
 * The Doelen register links the other way round from every other screen. Everywhere else a teacher
 * opens a thema and looks for a doel; here they are holding a doel and looking for the thema. The
 * data is the same `ThemaWeergave` tree either way, so this module does not fetch anything: it takes
 * the trees the app already has and answers the two questions the register needs of them, namely
 * *where does this doel already sit* and *what is left after the search box*.
 *
 * Pure on purpose. Both answers are decisions a teacher acts on: one hides a button, the other
 * hides a whole thema. Neither should need a rendered component or a server to be checked.
 */

/** One activiteit as a destination, plus whether the doel is already on it. */
export interface Activiteitbestemming {
  activiteit: ActiviteitWeergave;
  alGekoppeld: boolean;
}

/** One subthema as a destination, with the activiteiten that survived the search. */
export interface Subthemabestemming {
  subthema: SubthemaWeergave;
  alGekoppeld: boolean;
  activiteiten: Activiteitbestemming[];
}

/** One thema as a destination, with the subthema's that survived the search. */
export interface Themabestemming {
  thema: ThemaWeergave;
  alGekoppeld: boolean;
  /**
   * Whether a themadoel can still be added.
   *
   * Read here rather than discovered from a 400. A thema anchors at most three school-wide
   * themadoelen (Art. IX.2) and the domain refuses the fourth, so a "Koppel aan thema" button on a
   * full thema is a control that cannot do its job, which is the thing the E3-06 rule forbids. The row says
   * the thema is full instead, which is also the more useful sentence: three themadoelen is a
   * finished thema, not an error.
   */
  themaVol: boolean;
  subthemas: Subthemabestemming[];
}

export function themaHeeftDoel(thema: ThemaWeergave, code: string): boolean {
  return thema.themadoelen.some((themadoel) => themadoel.koppeling.leerplandoelCode === code);
}

export function subthemaHeeftDoel(subthema: SubthemaWeergave, code: string): boolean {
  return subthema.subdoelen.some((subdoel) => subdoel.koppeling.leerplandoelCode === code);
}

export function activiteitHeeftDoel(activiteit: ActiviteitWeergave, code: string): boolean {
  return activiteit.doelkoppelingen.some((koppeling) => koppeling.leerplandoelCode === code);
}

function bevat(tekst: string, term: string): boolean {
  return tekst.toLocaleLowerCase("nl").includes(term);
}

/**
 * The thema trees narrowed to what matches `zoekterm`, annotated with where `code` already sits.
 *
 * **A match keeps its ancestors and its descendants.** Typing an activiteit's name leaves that
 * activiteit under its own subthema under its own thema, because an activiteit named "Bladerslinger"
 * means nothing without the two names above it: a school runs the same activiteit in three thema's.
 * Typing a thema's name keeps everything under it, because the teacher who searched for the thema is
 * looking for a place inside it.
 *
 * An empty term returns every tree untouched, which is the state the sheet opens in.
 */
export function filterBestemmingen(
  themas: readonly ThemaWeergave[],
  code: string,
  zoekterm: string,
): Themabestemming[] {
  const term = zoekterm.trim().toLocaleLowerCase("nl");

  return themas
    .map((thema): Themabestemming | null => {
      const themaMatcht = term.length === 0 || bevat(thema.naam, term);

      const subthemas = thema.subthemas
        .map((subthema): Subthemabestemming | null => {
          const subthemaMatcht = themaMatcht || bevat(subthema.naam, term);

          const activiteiten = subthema.activiteiten
            .filter((activiteit) => subthemaMatcht || bevat(activiteit.naam, term))
            .map((activiteit) => ({
              activiteit,
              alGekoppeld: activiteitHeeftDoel(activiteit, code),
            }));

          // A subthema that neither matches nor holds a matching activiteit is not a destination the
          // teacher asked about. It comes back when the box is cleared.
          if (!subthemaMatcht && activiteiten.length === 0) return null;

          return { subthema, alGekoppeld: subthemaHeeftDoel(subthema, code), activiteiten };
        })
        .filter((tak): tak is Subthemabestemming => tak !== null);

      if (!themaMatcht && subthemas.length === 0) return null;

      return {
        thema,
        alGekoppeld: themaHeeftDoel(thema, code),
        themaVol: thema.themadoelen.length >= MAX_THEMADOELEN,
        subthemas,
      };
    })
    .filter((tak): tak is Themabestemming => tak !== null);
}

/**
 * How many places the doel could go, counted over a filtered tree.
 *
 * Counts every level, including thema's and subthema's it is already linked to: the number answers
 * "did the search find anything", not "how many links can still be made". A teacher who searches for
 * a thema they can see in the list should never read that there are no results.
 */
export function telBestemmingen(takken: readonly Themabestemming[]): number {
  return takken.reduce(
    (som, tak) =>
      som +
      1 +
      tak.subthemas.reduce((subsom, sub) => subsom + 1 + sub.activiteiten.length, 0),
    0,
  );
}
