import { t, telWoord, type Vertaalsleutel } from "../../i18n";
import { dagMaand } from "../../lib/datum";
import type { Deurmatsignaal, Deurmatvoorstel } from "./gegevens";
import type { Houdingsoort } from "./houding";

/**
 * Chuck's sentences (FB-071). The server sends what a signal needs, keyed by the placeholders of its sentence; the
 * sentence itself lives in `nl.json` (owner ruling 2026-09-22), so it is composed here.
 */

const tekst = (waarde: unknown) => (typeof waarde === "string" ? waarde : String(waarde ?? ""));
const getal = (waarde: unknown) => (typeof waarde === "number" ? waarde : Number(waarde ?? 0));
const lijst = (waarde: unknown) => (Array.isArray(waarde) ? waarde.map(tekst).join(", ") : tekst(waarde));

/** The full sentence of a signal, as the window shows it. */
export function signaalzin(signaal: Deurmatsignaal): string {
  const g = signaal.gegevens;
  switch (signaal.soort) {
    case "MinimumdoelInGevaar": {
      const vrij = getal(g.vrijeLesweken);
      const waarden = {
        doelRef: tekst(g.doelRef),
        thema: tekst(g.thema),
        themaDuur: telWoord(getal(g.themaLesweken), "kat.eenLesweek", "kat.lesweken"),
        vrij: t("kat.lesweken", { aantal: vrij }),
      };
      if (vrij === 0) return t("kat.signaal.minimumdoelInGevaarGeen", waarden);
      if (vrij === 1) return t("kat.signaal.minimumdoelInGevaarEen", waarden);
      return t("kat.signaal.minimumdoelInGevaar", waarden);
    }
    case "SubthemaNietGepland": {
      const aantal = getal(g.aantalDoelen);
      const waarden = { subthema: tekst(g.subthema), thema: tekst(g.thema), aantalDoelen: aantal, doelen: lijst(g.doelen) };
      return aantal === 1 ? t("kat.signaal.subthemaNietGeplandEen", waarden) : t("kat.signaal.subthemaNietGepland", waarden);
    }
    default:
      return t("kat.signaal.onbekend", { klas: signaal.klasnaam });
  }
}

/** What Chuck says about a goal at risk, in his balloon: short, and naming the klas. */
export function gevaarzin(signaal: Deurmatsignaal): string {
  if (signaal.soort === "SubthemaNietGepland") {
    return t("kat.zegtSubthema", { klas: signaal.klasnaam, subthema: tekst(signaal.gegevens.subthema) });
  }
  return t("kat.zegtMinimumdoel", { klas: signaal.klasnaam, doelRef: tekst(signaal.gegevens.doelRef) });
}

const VOORSTELSLEUTEL = {
  Activiteitvoorstel: "kat.voorstel.Activiteitvoorstel",
  Subdoelvoorstel: "kat.voorstel.Subdoelvoorstel",
  Subthemavoorstel: "kat.voorstel.Subthemavoorstel",
  Minimumdoelsuggestie: "kat.voorstel.Minimumdoelsuggestie",
} as const satisfies Record<Deurmatvoorstel["soort"], Vertaalsleutel>;

/** The line of a proposal in the window. */
export function voorstelzin(voorstel: Deurmatvoorstel): string {
  return t(VOORSTELSLEUTEL[voorstel.soort], { titel: voorstel.titel });
}

const HOUDINGSLEUTEL = {
  slaapt: "kat.houding.slaapt",
  klaar: "kat.houding.klaar",
  gevaar: "kat.houding.gevaar",
  spint: "kat.houding.spint",
} as const satisfies Record<Houdingsoort, Vertaalsleutel>;

/** The label every posture carries, visible or in his balloon (never colour or form alone). */
export function houdingzin(soort: Houdingsoort): string {
  return t(HOUDINGSLEUTEL[soort]);
}

/** "08:30:00" becomes "8.30", the way a Flemish timetable writes it. */
function uur(tijd: string): string {
  const [u, m] = tijd.split(":");
  return `${Number(u)}.${m}`;
}

/** For which klas a proposal the cat brought is, and when accepting plans it; `null` for any other proposal. */
export function katvoorstelMoment(voorstel: Deurmatvoorstel): string | null {
  if (!voorstel.klasnaam) return null;
  if (voorstel.datum && voorstel.begin && voorstel.einde) {
    return t("kat.katvoorstelMoment", {
      klas: voorstel.klasnaam,
      dag: dagMaand(voorstel.datum),
      begin: uur(voorstel.begin),
      einde: uur(voorstel.einde),
    });
  }
  return t("kat.katvoorstelKlas", { klas: voorstel.klasnaam });
}
