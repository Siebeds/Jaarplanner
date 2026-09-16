import { t, type Vertaalsleutel } from "../../i18n";

/**
 * The emoji the thema picker offers (FB-060): six groups of six, chosen for the thema's a kleuter and lager school
 * works with. Deliberately small. Any other emoji is still allowed: a teacher who wants one types it into the search
 * field, for instance through the Windows emoji panel, and the server accepts any single emoji.
 *
 * Every name and every search term is a catalogue key written out in full, so the dead-key guard in
 * `catalogus.test.ts` sees each one used.
 */
export interface Emojikeuze {
  teken: string;
  naam: Vertaalsleutel;
  zoek: Vertaalsleutel;
}

export interface Emojigroep {
  id: string;
  titel: Vertaalsleutel;
  emoji: readonly Emojikeuze[];
}

export const EMOJIGROEPEN: readonly Emojigroep[] = [
  {
    id: "seizoenen",
    titel: "emojikiezer.groep.seizoenen",
    emoji: [
      { teken: "🍂", naam: "emojikiezer.naam.herfstblad", zoek: "emojikiezer.zoek.herfstblad" },
      { teken: "🌸", naam: "emojikiezer.naam.bloesem", zoek: "emojikiezer.zoek.bloesem" },
      { teken: "☀️", naam: "emojikiezer.naam.zon", zoek: "emojikiezer.zoek.zon" },
      { teken: "❄️", naam: "emojikiezer.naam.sneeuwvlok", zoek: "emojikiezer.zoek.sneeuwvlok" },
      { teken: "🌧️", naam: "emojikiezer.naam.regen", zoek: "emojikiezer.zoek.regen" },
      { teken: "🌈", naam: "emojikiezer.naam.regenboog", zoek: "emojikiezer.zoek.regenboog" },
    ],
  },
  {
    id: "natuur",
    titel: "emojikiezer.groep.natuur",
    emoji: [
      { teken: "🌳", naam: "emojikiezer.naam.boom", zoek: "emojikiezer.zoek.boom" },
      { teken: "🌻", naam: "emojikiezer.naam.zonnebloem", zoek: "emojikiezer.zoek.zonnebloem" },
      { teken: "🍄", naam: "emojikiezer.naam.paddenstoel", zoek: "emojikiezer.zoek.paddenstoel" },
      { teken: "🐞", naam: "emojikiezer.naam.lieveheersbeestje", zoek: "emojikiezer.zoek.lieveheersbeestje" },
      { teken: "🦋", naam: "emojikiezer.naam.vlinder", zoek: "emojikiezer.zoek.vlinder" },
      { teken: "🌊", naam: "emojikiezer.naam.golf", zoek: "emojikiezer.zoek.golf" },
    ],
  },
  {
    id: "dieren",
    titel: "emojikiezer.groep.dieren",
    emoji: [
      { teken: "🐻", naam: "emojikiezer.naam.beer", zoek: "emojikiezer.zoek.beer" },
      { teken: "🦔", naam: "emojikiezer.naam.egel", zoek: "emojikiezer.zoek.egel" },
      { teken: "🐮", naam: "emojikiezer.naam.koe", zoek: "emojikiezer.zoek.koe" },
      { teken: "🐔", naam: "emojikiezer.naam.kip", zoek: "emojikiezer.zoek.kip" },
      { teken: "🐟", naam: "emojikiezer.naam.vis", zoek: "emojikiezer.zoek.vis" },
      { teken: "🦁", naam: "emojikiezer.naam.leeuw", zoek: "emojikiezer.zoek.leeuw" },
    ],
  },
  {
    id: "feesten",
    titel: "emojikiezer.groep.feesten",
    emoji: [
      { teken: "🎃", naam: "emojikiezer.naam.pompoen", zoek: "emojikiezer.zoek.pompoen" },
      { teken: "🎁", naam: "emojikiezer.naam.cadeau", zoek: "emojikiezer.zoek.cadeau" },
      { teken: "🎄", naam: "emojikiezer.naam.kerstboom", zoek: "emojikiezer.zoek.kerstboom" },
      { teken: "🐣", naam: "emojikiezer.naam.kuiken", zoek: "emojikiezer.zoek.kuiken" },
      { teken: "🎂", naam: "emojikiezer.naam.taart", zoek: "emojikiezer.zoek.taart" },
      { teken: "🎭", naam: "emojikiezer.naam.maskers", zoek: "emojikiezer.zoek.maskers" },
    ],
  },
  {
    id: "wereld",
    titel: "emojikiezer.groep.wereld",
    emoji: [
      { teken: "🏠", naam: "emojikiezer.naam.huis", zoek: "emojikiezer.zoek.huis" },
      { teken: "👪", naam: "emojikiezer.naam.gezin", zoek: "emojikiezer.zoek.gezin" },
      { teken: "🚒", naam: "emojikiezer.naam.brandweerwagen", zoek: "emojikiezer.zoek.brandweerwagen" },
      { teken: "🏥", naam: "emojikiezer.naam.ziekenhuis", zoek: "emojikiezer.zoek.ziekenhuis" },
      { teken: "🌍", naam: "emojikiezer.naam.wereldbol", zoek: "emojikiezer.zoek.wereldbol" },
      { teken: "🚀", naam: "emojikiezer.naam.raket", zoek: "emojikiezer.zoek.raket" },
    ],
  },
  {
    id: "spelen",
    titel: "emojikiezer.groep.spelen",
    emoji: [
      { teken: "🎨", naam: "emojikiezer.naam.verfpalet", zoek: "emojikiezer.zoek.verfpalet" },
      { teken: "🎵", naam: "emojikiezer.naam.muzieknoot", zoek: "emojikiezer.zoek.muzieknoot" },
      { teken: "⚽", naam: "emojikiezer.naam.bal", zoek: "emojikiezer.zoek.bal" },
      { teken: "🧱", naam: "emojikiezer.naam.blokken", zoek: "emojikiezer.zoek.blokken" },
      { teken: "📚", naam: "emojikiezer.naam.boeken", zoek: "emojikiezer.zoek.boeken" },
      { teken: "🍎", naam: "emojikiezer.naam.appel", zoek: "emojikiezer.zoek.appel" },
    ],
  },
];

/**
 * The groups with only the emoji that match `zoekterm`, empty groups dropped. A match is the term inside the name or
 * inside one of the search words, case-insensitive; an empty term keeps everything.
 */
export function zoekEmoji(zoekterm: string): Emojigroep[] {
  const term = zoekterm.trim().toLocaleLowerCase("nl");
  if (term === "") return [...EMOJIGROEPEN];

  return EMOJIGROEPEN.map((groep) => ({
    ...groep,
    emoji: groep.emoji.filter((keuze) =>
      `${t(keuze.naam)} ${t(keuze.zoek)}`.toLocaleLowerCase("nl").includes(term),
    ),
  })).filter((groep) => groep.emoji.length > 0);
}

// What makes a grapheme an emoji here: a character that displays as an emoji by default, a pictograph asked to
// (U+FE0F), a regional indicator (half of a flag), or the keycap mark that turns a digit into one. A bare arrow or
// square is text, so typing one searches instead. The server applies its own rule; this only decides what a typed
// character selects.
const EMOJITEKEN = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️|\p{Regional_Indicator}|⃣/u;

/**
 * The first emoji in `tekst`, as a whole grapheme (a family, a flag or a skin tone stays one), or null when there is
 * none. This is how an emoji typed or pasted into the search field is picked up.
 */
export function eersteEmoji(tekst: string): string | null {
  const delen =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter("nl", { granularity: "grapheme" }).segment(tekst), (deel) => deel.segment)
      : Array.from(tekst);
  return delen.find((deel) => EMOJITEKEN.test(deel)) ?? null;
}
