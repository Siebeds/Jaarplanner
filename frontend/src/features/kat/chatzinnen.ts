import { t, type Vertaalsleutel } from "../../i18n";
import { periode } from "../../lib/datum";
import type { Katagendaplek, Katantwoord, Katonderwerp, Katpleksoort, Katplek } from "./chat";

/**
 * What Chuck says in the chat (FB-031, ADR-0066 C3). The server sends what a lookup found; the sentences live in
 * `nl.json` and are composed here. Only an explanation is text the model wrote.
 */

const NIET_GEVONDEN = {
  Doel: "kat.chat.nietGevonden.Doel",
  Thema: "kat.chat.nietGevonden.Thema",
  Subthema: "kat.chat.nietGevonden.Subthema",
  Activiteit: "kat.chat.nietGevonden.Activiteit",
} as const satisfies Record<Katonderwerp, Vertaalsleutel>;

const KIES = {
  Doel: "kat.chat.kies.Doel",
  Thema: "kat.chat.kies.Thema",
  Subthema: "kat.chat.kies.Subthema",
  Activiteit: "kat.chat.kies.Activiteit",
} as const satisfies Record<Katonderwerp, Vertaalsleutel>;

const PLEK = {
  Themadoel: "kat.chat.plek.Themadoel",
  Subdoel: "kat.chat.plek.Subdoel",
  Activiteit: "kat.chat.plek.Activiteit",
  AlgemeneFiche: "kat.chat.plek.AlgemeneFiche",
} as const satisfies Record<Katpleksoort, Vertaalsleutel>;

const AGENDA = {
  Thema: "kat.chat.agenda.Thema",
  Subthema: "kat.chat.agenda.Subthema",
  Activiteit: "kat.chat.agenda.Activiteit",
  AlgemeneFiche: "kat.chat.agenda.AlgemeneFiche",
} as const satisfies Record<Katagendaplek["soort"], Vertaalsleutel>;

/** The first sentence of an answer: the yes or no, what was not found, or which one she means. */
export function antwoordzin(antwoord: Katantwoord): string {
  const doel = antwoord.doel?.code ?? "";
  const thema = antwoord.thema?.naam ?? "";
  const activiteit = antwoord.activiteit?.naam ?? "";
  switch (antwoord.soort) {
    case "Uitleg":
      return antwoord.uitleg ?? "";
    case "Onbekend":
      return t("kat.chat.onbekend");
    case "NietGevonden":
      return antwoord.nietGevonden
        ? t(NIET_GEVONDEN[antwoord.nietGevonden.wat], { term: antwoord.nietGevonden.term })
        : t("kat.chat.mislukt");
    case "Kies":
      return antwoord.keuze
        ? t(KIES[antwoord.keuze.wat], { term: antwoord.keuze.term })
        : t("kat.chat.mislukt");
    case "DoelInThema":
      if (antwoord.ja) return t("kat.chat.doelInThemaJa", { doel, thema });
      return antwoord.voorstellen.length > 0
        ? t("kat.chat.doelInThemaNeeVoorstel", { doel, thema })
        : t("kat.chat.doelInThemaNee", { doel, thema });
    case "WaarGebruikt":
      if (antwoord.plekken.length > 0 || antwoord.agenda.length > 0) return t("kat.chat.waarGebruikt", { doel });
      return antwoord.voorstellen.length > 0
        ? t("kat.chat.waarGebruiktVoorstel", { doel })
        : t("kat.chat.waarGebruiktNergens", { doel });
    case "DoelenVanThema":
      return antwoord.plekken.length > 0
        ? t("kat.chat.doelenVanThema", { thema })
        : t("kat.chat.doelenVanThemaGeen", { thema });
    case "ActiviteitInSubthema":
      return antwoord.ja
        ? t("kat.chat.activiteitInSubthemaJa", { activiteit, subthema: antwoord.subthema ?? "" })
        : t("kat.chat.activiteitInSubthemaNee", { activiteit, subthema: antwoord.subthema ?? "" });
    case "SubthemaVanActiviteit":
      return t("kat.chat.subthemaVanActiviteit", { activiteit });
    case "DoelenVanSubthema":
      return antwoord.plekken.length > 0
        ? t("kat.chat.doelenVanSubthema", { subthema: antwoord.subthema ?? "" })
        : t("kat.chat.doelenVanSubthemaGeen", { subthema: antwoord.subthema ?? "" });
    default:
      return t("kat.chat.mislukt");
  }
}

/** Where a goal sits or an activiteit hangs, in one line. */
export function plekzin(plek: Katplek): string {
  const waarden = {
    thema: plek.thema,
    subthema: plek.subthema ?? "",
    leeftijd: plek.leeftijd ?? "",
    activiteit: plek.activiteit ?? "",
    fiche: plek.fiche ?? "",
    klas: plek.klas ?? "",
  };
  return t(PLEK[plek.soort], waarden);
}

/** Where a goal of a thema sits, under its code and text. */
export function doelplekzin(plek: Katplek): string {
  return plek.soort === "Subdoel"
    ? t("kat.chat.doelplek.Subdoel", { subthema: plek.subthema ?? "", leeftijd: plek.leeftijd ?? "" })
    : t("kat.chat.doelplek.Themadoel");
}

/** A placement in the agenda: what, and when. */
export function agendazin(plek: Katagendaplek): { wat: string; wanneer: string } {
  return {
    wat: t(AGENDA[plek.soort], { naam: plek.naam }),
    wanneer: periode(plek.van, plek.van === plek.tot ? null : plek.tot),
  };
}

/** The placements grouped by klas, in the order the server sent them. */
export function perKlas(agenda: Katagendaplek[]): { klasId: string; klas: string; plekken: Katagendaplek[] }[] {
  const groepen: { klasId: string; klas: string; plekken: Katagendaplek[] }[] = [];
  for (const plek of agenda) {
    const groep = groepen.find((g) => g.klasId === plek.klasId);
    if (groep) groep.plekken.push(plek);
    else groepen.push({ klasId: plek.klasId, klas: plek.klas, plekken: [plek] });
  }
  return groepen;
}

export type Uitlegblok = { soort: "alinea"; tekst: string } | { soort: "stappen"; stappen: string[] };

/**
 * An explanation split into paragraphs and numbered steps. The model writes steps as "1. …" on their own lines
 * (the chat's system prompt); anything else is a paragraph. Nothing is rendered as HTML.
 */
export function uitlegblokken(tekst: string): Uitlegblok[] {
  const blokken: Uitlegblok[] = [];
  for (const ruw of tekst.split(/\r?\n/)) {
    const regel = ruw.trim();
    if (regel.length === 0) continue;
    const stap = /^\d+[.)]\s+(.*)$/.exec(regel);
    const vorige = blokken[blokken.length - 1];
    if (stap) {
      if (vorige?.soort === "stappen") vorige.stappen.push(stap[1]);
      else blokken.push({ soort: "stappen", stappen: [stap[1]] });
    } else {
      blokken.push({ soort: "alinea", tekst: regel });
    }
  }
  return blokken;
}
