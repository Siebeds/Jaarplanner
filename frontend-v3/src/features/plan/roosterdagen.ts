import type { Dagweergave } from "../../lib/types";
import { valtBinnen } from "../../lib/datum";

/**
 * A day of the grid, which is not the same thing as a day the server returned.
 *
 * `buitenSchooljaar` days exist only here: the server has nothing to say about them and does not
 * pretend to, so the grid has to fill them in itself or leave a hole where a Tuesday should be.
 */
export interface Agendadag extends Dagweergave {
  buitenSchooljaar: boolean;
}

/**
 * The days a view asked for, filled in with what the server actually sent.
 *
 * **The grid is built from the DATES, never from the response.** The weekplanning endpoint clamps the
 * range it is given into the school year and says so in its own `van`/`tot`, so asking for 24 to 30
 * august comes back as a single day, 1 september. Rendering that array straight put one column on
 * screen, labelled "di 1", under a heading that read "24 aug - 30 aug": a day from another week,
 * presented as the week you were looking at. Laying the grid out by date instead makes that
 * impossible to express.
 *
 * A day the server did not send is not an empty teaching day. It is outside the school year, so it
 * carries no add button and takes no drop: the server would refuse a placement on it, and a target
 * that leads to a refusal should not accept.
 */
export function roosterdagen(
  datums: string[],
  geleverd: Dagweergave[],
  schooljaarVan: string,
  schooljaarTot: string,
): Agendadag[] {
  const opDatum = new Map(geleverd.map((dag) => [dag.datum, dag]));

  return datums.map((datum) => {
    const dag = opDatum.get(datum);
    if (dag) return { ...dag, buitenSchooljaar: false };

    // Without a school year loaded yet there is nothing to be outside of, so an unknown day is
    // treated as a plain empty one rather than as a refusal the caller cannot justify.
    const bekend = schooljaarVan.length > 0 && schooljaarTot.length > 0;
    return {
      datum,
      isLesdag: false,
      sluitingsnaam: null,
      activiteiten: [],
      buitenSchooljaar: bekend && !valtBinnen(datum, schooljaarVan, schooljaarTot),
    };
  });
}
