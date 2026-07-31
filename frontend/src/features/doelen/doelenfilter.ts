import type { Doelsoort, DoelsoortNaam } from "../../components/doelsoort";
import { doelsoortBadgeSoort } from "../../components/doelsoort";
import type { Doelenfilter } from "./types";

/**
 * The active filter lives in the query string (ADR-0021: the URL is the single source of truth), so a
 * filtered register is shareable and survives a reload. This module is the one place that reads and writes
 * that mapping.
 *
 * The names match the API's own query parameters. Keeping them identical is deliberate: one vocabulary for
 * the shared link and the request means there is no translation table to get wrong, and a teacher pasting a
 * link gets exactly the view the person who sent it was looking at.
 */

/** The query-string keys this feature owns. Anything else in the URL (`?klas=`, `?schooljaar=`) is left alone. */
const FILTERSLEUTELS = ["zoek", "discipline", "domein", "subdomein", "doelsoort", "jaarFase"] as const;

/** The doelsoort values the API accepts, so an unknown one in a stale link is dropped instead of sent on. */
const DOELSOORTEN = Object.keys(doelsoortBadgeSoort) as DoelsoortNaam[];

/** Reads the filter out of the URL, ignoring blank and unrecognised values. */
export function leesFilter(params: URLSearchParams): Doelenfilter {
  const waarde = (sleutel: string) => params.get(sleutel)?.trim() || undefined;
  const doelsoort = waarde("doelsoort");

  return {
    zoek: waarde("zoek"),
    discipline: waarde("discipline"),
    domein: waarde("domein"),
    // A subdomein without its domein is meaningless: subdomein names are not globally unique (Art. VII.0),
    // so a link carrying only the subdomein would silently mix goals from unrelated domeinen. Dropped rather
    // than sent, which is the same rule the server applies from the other side.
    subdomein: waarde("domein") ? waarde("subdomein") : undefined,
    doelsoort: DOELSOORTEN.find((soort) => soort === doelsoort),
    jaarFase: waarde("jaarFase"),
  };
}

/**
 * Writes a filter back into the URL, in place: it clears this feature's keys and sets the ones that are
 * active, leaving every other parameter untouched so the klas/schooljaar selection survives (ADR-0021).
 */
export function schrijfFilter(params: URLSearchParams, filter: Doelenfilter): URLSearchParams {
  const volgende = new URLSearchParams(params);

  for (const sleutel of FILTERSLEUTELS) {
    volgende.delete(sleutel);
  }

  for (const [sleutel, waarde] of Object.entries(filter)) {
    if (typeof waarde === "string" && waarde.trim().length > 0) {
      volgende.set(sleutel, waarde.trim());
    }
  }

  return volgende;
}

/** Which filter dimensions are active, in the order the chips render. Empty when nothing is filtered. */
export function actieveDimensies(filter: Doelenfilter): (keyof Doelenfilter)[] {
  return FILTERSLEUTELS.filter((sleutel) => {
    const waarde = filter[sleutel];
    return typeof waarde === "string" && waarde.length > 0;
  });
}

/**
 * Clears one dimension. Clearing the domein clears the subdomein with it, because a subdomein alone would
 * not identify anything (Art. VII.0) — the same reason {@link leesFilter} drops it.
 */
export function zonderDimensie(filter: Doelenfilter, dimensie: keyof Doelenfilter): Doelenfilter {
  const volgende: Doelenfilter = { ...filter, [dimensie]: undefined };

  if (dimensie === "domein") {
    volgende.subdomein = undefined;
  }

  return volgende;
}

/** The badge/token key for a doelsoort as the API names it. One mapping, shared with every other list. */
export function badgeSoort(doelsoort: DoelsoortNaam): Doelsoort {
  return doelsoortBadgeSoort[doelsoort];
}

/**
 * The coloured left edge per doelsoort: the register's one bold element, so that scrolling a subdomein shows
 * its composition at a glance.
 *
 * It is **redundant** with the letter badge on every row, on purpose (Art. XII, WCAG 2.2 AA: colour is never
 * the only signal). It introduces no token and no hue: these are the six existing doelsoort tokens from
 * `index.css`, used as a border rather than a fill. The classes are written out because Tailwind scans source
 * text, so a template-built class name (`` `border-l-doelsoort-${soort}` ``) generates no CSS at all.
 */
export const doelsoortRand: Record<Doelsoort, string> = {
  md: "border-l-doelsoort-md",
  gemeenschappelijk: "border-l-doelsoort-gemeenschappelijk",
  verdieping: "border-l-doelsoort-verdieping",
  precurriculum: "border-l-doelsoort-precurriculum",
  specifiek: "border-l-doelsoort-specifiek",
  anderstalige: "border-l-doelsoort-anderstalige",
};
