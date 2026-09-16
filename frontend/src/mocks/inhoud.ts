/**
 * The fixed content of the mock mode (TB-046, TB-047): one K3 klas in 2026-2027 with two planned thema's of four weeks,
 * and a full agenda for the weeks of 16 and 23 november 2026.
 *
 * Everything here is invented. The goal codes have Op.stap's shape but numbers (`.8x`) that Op.stap does not use, and
 * their texts are written for this file, so no screen in mock mode can pass for real curriculum content. No person in
 * it is real either.
 */
import type { Activiteitkleur, ActiviteitType, Doelsoort } from "../lib/types";

/** A stable id per number, shaped like the server's GUIDs. */
function vastId(nummer: number): string {
  return `00000000-0000-4000-8000-${String(nummer).padStart(12, "0")}`;
}

export const SCHOOLJAAR = {
  id: vastId(1),
  naam: "2026-2027",
  start: "2026-09-01",
  eind: "2027-06-30",
};

export const ONDERBREKINGEN = [
  { naam: "Herfstvakantie", start: "2026-11-02", eind: "2026-11-08" },
  { naam: "Kerstvakantie", start: "2026-12-21", eind: "2027-01-03" },
  { naam: "Krokusvakantie", start: "2027-02-15", eind: "2027-02-21" },
  { naam: "Paasvakantie", start: "2027-04-05", eind: "2027-04-18" },
];

/**
 * The themaperiodes of the mock year, never across a vacation. Cut around the two thema's: on `main` a thema belongs
 * to one period, so the one that runs across the kerstvakantie is placed in the period before it and the one after it.
 * That leaves periods of one and three weeks, outside the 4 to 6 weeks of Art. IX: a workaround for this fixture only,
 * which goes once FB-035 gives a thema its own dates.
 */
export const THEMAPERIODES: { start: string; eind: string }[] = [
  { start: "2026-09-01", eind: "2026-10-02" },
  { start: "2026-10-05", eind: "2026-10-30" },
  { start: "2026-11-09", eind: "2026-11-13" },
  { start: "2026-11-16", eind: "2026-12-11" },
  { start: "2026-12-14", eind: "2026-12-18" },
  { start: "2027-01-04", eind: "2027-01-22" },
  { start: "2027-01-25", eind: "2027-02-12" },
  { start: "2027-02-22", eind: "2027-04-02" },
  { start: "2027-04-19", eind: "2027-05-21" },
  { start: "2027-05-24", eind: "2027-06-30" },
];

export const BLOKINDELING = "mockrooster: themaperiodes op maat van de twee thema's, niet volgens de ingestelde indeling";

export const GEBRUIKER = {
  id: vastId(2),
  naam: "Directie (mockmodus)",
  email: "directie@mock.local",
};

export const KLAS = {
  id: vastId(3),
  naam: "K3 De Uilen",
  jaarfase: "K3",
};

export const JAARFASEN = ["JK", "K2", "K3", "L1", "L2", "L3", "L4", "L5", "L6"];

/** The days the agenda is full: every school day in this range gets activiteiten of the subthema that runs. */
export const VOLLE_AGENDA = { van: "2026-11-16", tot: "2026-11-27" };

export const DISCIPLINES: Record<string, string> = {
  "1": "Nederlands en communicatie",
  "2": "Wiskunde",
  "3": "Wetenschap en techniek",
  "4": "Aardrijkskunde",
  "6": "Muzische vorming",
  "7": "Lichamelijke opvoeding en motoriek",
  "9.3": "Sociaal en emotioneel leren",
};

export interface MockMinimumdoel {
  ref: string;
  nr: string;
  omschrijving: string;
  leergebied: string;
  rubriek: string;
  subrubriek: string | null;
}

function md(ref: string, omschrijving: string, leergebied: string, rubriek: string, subrubriek: string | null = null): MockMinimumdoel {
  return { ref, nr: ref.slice(2), omschrijving, leergebied, rubriek, subrubriek };
}

export const MINIMUMDOELEN: MockMinimumdoel[] = [
  md("K-1.1.81", "De kleuters luisteren naar een verhaal en vertellen het in eigen woorden na.", "Nederlands en communicatie", "Luisteren en spreken"),
  md("K-1.2.81", "De kleuters gebruiken nieuwe woorden uit hun omgeving in een gesprek.", "Nederlands en communicatie", "Woordenschat"),
  md("K-2.1.81", "De kleuters tellen hoeveelheden tot tien en vergelijken ze.", "Wiskunde", "Getallen", "Hoeveelheden"),
  md("K-2.3.81", "De kleuters vergelijken en ordenen voorwerpen volgens lengte en grootte.", "Wiskunde", "Meten", "Vergelijken"),
  md("K-3.1.81", "De kleuters nemen planten en dieren in hun omgeving waar en beschrijven wat ze zien.", "Wetenschap en techniek", "Levende natuur", "Planten en dieren"),
  md("K-3.2.81", "De kleuters onderzoeken hoe materialen veranderen door warmte en koude.", "Wetenschap en techniek", "Materie", "Stoffen en materialen"),
  md("K-4.2.81", "De kleuters herkennen hoe het weer en de natuur veranderen met de seizoenen.", "Aardrijkskunde", "Aardrijkskundige kennis"),
  md("K-6.1.81", "De kleuters drukken zich beeldend uit met verschillende materialen.", "Muzische vorming", "Beeld"),
  md("K-7.1.81", "De kleuters bewegen gecoördineerd en houden hun evenwicht.", "Lichamelijke opvoeding en motoriek", "Motorische competenties"),
  md("K-9.3.81", "De kleuters werken samen en tonen hoe ze zich voelen.", "Sociaal en emotioneel leren", "Samen leven"),
];

export interface MockLeerplandoel {
  code: string;
  doelsoort: Doelsoort;
  discipline: string;
  domein: string;
  subdomein: string;
  tekst: string;
  minimumdoelRef: string | null;
}

function lpd(code: string, domein: string, subdomein: string, tekst: string, minimumdoelRef: string | null): MockLeerplandoel {
  const discipline = code.slice(0, code.indexOf(".", code.startsWith("9.") ? 2 : 0));
  return {
    code,
    doelsoort: code.includes(".VK3.") ? "Verdieping" : "Gemeenschappelijk",
    discipline,
    domein,
    subdomein,
    tekst,
    minimumdoelRef,
  };
}

export const LEERPLANDOELEN: MockLeerplandoel[] = [
  lpd("1.1.GK3.81", "Mondelinge taalvaardigheid", "Luisteren", "De leerlingen kunnen de volgorde van gebeurtenissen in een voorgelezen prentenboek navertellen.", "K-1.1.81"),
  lpd("1.1.GK3.82", "Mondelinge taalvaardigheid", "Spreken", "De leerlingen kunnen in de kring vertellen wat ze ontdekt hebben.", "K-1.1.81"),
  lpd("1.2.GK3.81", "Woordenschat", "Nieuwe woorden", "De leerlingen kunnen nieuwe themawoorden gebruiken in een eigen zin.", "K-1.2.81"),
  lpd("1.2.GK3.82", "Woordenschat", "Taalspel", "De leerlingen kunnen woorden herkennen die rijmen.", "K-1.2.81"),
  lpd("2.1.GK3.81", "Getallen", "Tellen", "De leerlingen kunnen tot tien voorwerpen tellen en het aantal benoemen.", "K-2.1.81"),
  lpd("2.1.GK3.82", "Getallen", "Hoeveelheden", "De leerlingen kunnen twee hoeveelheden vergelijken met meer, minder en evenveel.", "K-2.1.81"),
  lpd("2.3.GK3.81", "Meten", "Lengte", "De leerlingen kunnen twee voorwerpen vergelijken volgens lengte.", "K-2.3.81"),
  lpd("2.3.GK3.82", "Meten", "Ordenen", "De leerlingen kunnen voorwerpen ordenen van klein naar groot.", "K-2.3.81"),
  lpd("3.1.GK3.81", "Levende natuur", "Planten", "De leerlingen kunnen delen van een paddenstoel en van een boom aanwijzen en benoemen.", "K-3.1.81"),
  lpd("3.1.GK3.82", "Levende natuur", "Dieren", "De leerlingen kunnen vertellen hoe een dier zich op de winter voorbereidt.", "K-3.1.81"),
  lpd("3.1.GK3.83", "Levende natuur", "Planten", "De leerlingen kunnen bladeren sorteren volgens vorm en kleur.", "K-3.1.81"),
  lpd("3.1.GK3.84", "Levende natuur", "Dieren", "De leerlingen kunnen sporen van dieren herkennen en aan een dier koppelen.", "K-3.1.81"),
  lpd("3.2.GK3.81", "Materie", "Water", "De leerlingen kunnen waarnemen dat water bevriest in de kou en ijs smelt in de warmte.", "K-3.2.81"),
  lpd("3.2.GK3.82", "Materie", "Materialen", "De leerlingen kunnen materialen kiezen die warm houden.", "K-3.2.81"),
  lpd("4.2.GK3.81", "Aardrijkskundige kennis", "Weer en seizoenen", "De leerlingen kunnen kenmerken van de herfst benoemen: wind, regen, vallende bladeren.", "K-4.2.81"),
  lpd("4.2.GK3.82", "Aardrijkskundige kennis", "Weer en seizoenen", "De leerlingen kunnen het weer van de dag waarnemen en met een symbool aanduiden.", "K-4.2.81"),
  lpd("4.2.GK3.83", "Aardrijkskundige kennis", "Weer en seizoenen", "De leerlingen kunnen kenmerken van de winter benoemen: vorst, sneeuw, korte dagen.", "K-4.2.81"),
  lpd("4.2.GK3.84", "Aardrijkskundige kennis", "Dag en nacht", "De leerlingen kunnen vertellen dat het in de winter vroeger donker wordt.", "K-4.2.81"),
  lpd("6.1.GK3.81", "Beeld", "Materialen", "De leerlingen kunnen met natuurmateriaal een beeldend werk maken.", "K-6.1.81"),
  lpd("6.1.GK3.82", "Beeld", "Kleur en licht", "De leerlingen kunnen met kleur en licht experimenteren in een eigen werk.", "K-6.1.81"),
  lpd("6.2.GK3.81", "Muziek", "Zingen", "De leerlingen kunnen een themaliedje meezingen en met gebaren ondersteunen.", null),
  lpd("7.1.GK3.81", "Motorische competenties", "Bewegen op muziek", "De leerlingen kunnen bewegingen van dieren nabootsen op het ritme van muziek.", "K-7.1.81"),
  lpd("7.1.GK3.82", "Motorische competenties", "Evenwicht", "De leerlingen kunnen over een smalle lijn stappen zonder hun evenwicht te verliezen.", "K-7.1.81"),
  lpd("9.3.GK3.81", "Samenwerken", "Samen spelen", "De leerlingen kunnen samen met een klasgenoot een taak verdelen en afwerken.", "K-9.3.81"),
  lpd("9.3.GK3.82", "Gevoelens", "Gevoelens benoemen", "De leerlingen kunnen vertellen hoe ze zich voelen en waarom.", "K-9.3.81"),
  lpd("9.3.VK3.81", "Samenwerken", "Helpen", "De leerlingen kunnen een klasgenoot uit zichzelf helpen bij een taak.", null),
];

export interface MockActiviteit {
  id: string;
  naam: string;
  activiteitType: ActiviteitType | null;
  hoek: string | null;
  verwachteUitkomsten: string;
  kleur: Activiteitkleur | null;
  doelen: string[];
}

export interface MockSubthema {
  id: string;
  naam: string;
  onderzoeksvraag: { id: string; vraag: string; probleemstelling: string };
  subdoelen: string[];
  /** Its weeks in the agenda, by their Mondays. Together the subthema's of a thema fill its weeks exactly. */
  weken: string[];
  activiteiten: MockActiviteit[];
}

export interface MockThema {
  id: string;
  naam: string;
  duurWeken: number;
  invalshoeken: string;
  kernwoordenschat: string[];
  rijkeWoordenschat: string[];
  minimumdoelen: string[];
  /** Its placements: the start of each themaperiode it is in, and how many of its weeks fall there. */
  plaatsingen: { blokStart: string; weken: number }[];
  subthemas: MockSubthema[];
}

let volgnummer = 100;

type ActiviteitRij = [
  naam: string,
  type: ActiviteitType | null,
  hoek: string | null,
  verwachteUitkomsten: string,
  kleur: Activiteitkleur | null,
  doelen: string[],
];

function subthema(
  naam: string,
  vraag: string,
  probleemstelling: string,
  weken: string[],
  subdoelen: string[],
  rijen: ActiviteitRij[],
): MockSubthema {
  volgnummer = Math.ceil((volgnummer + 1) / 100) * 100;
  const id = vastId(volgnummer);
  return {
    id,
    naam,
    onderzoeksvraag: { id: vastId(volgnummer + 1), vraag, probleemstelling },
    subdoelen,
    weken,
    activiteiten: rijen.map(([naamA, type, hoek, verwachteUitkomsten, kleur, doelen], i) => ({
      id: vastId(volgnummer + 10 + i),
      naam: naamA,
      activiteitType: type,
      hoek,
      verwachteUitkomsten,
      kleur,
      doelen,
    })),
  };
}

export const THEMAS: MockThema[] = [
  {
    id: vastId(10),
    naam: "🍂 Herfst in het bos",
    duurWeken: 4,
    invalshoeken: "natuur, seizoenen, dieren",
    kernwoordenschat: ["de paddenstoel", "het blad", "de eekhoorn", "de winterslaap", "de wind", "de regen"],
    rijkeWoordenschat: ["de hoed", "de steel", "verzamelen", "ritselen", "het spoor"],
    minimumdoelen: ["K-3.1.81", "K-4.2.81", "K-1.1.81", "K-2.1.81"],
    plaatsingen: [{ blokStart: "2026-11-16", weken: 4 }],
    subthemas: [
      subthema(
        "Paddenstoelen en bladeren",
        "Waarom vallen de bladeren van de bomen?",
        "De kleuters zien de speelplaats vol bladeren liggen en willen weten waar ze vandaan komen.",
        ["2026-11-16"],
        ["3.1.GK3.81", "3.1.GK3.83", "4.2.GK3.81", "1.1.GK3.82", "2.1.GK3.81", "6.1.GK3.81"],
        [
          ["Bladerenwandeling in het park", "Uitstap", null, "De kleuters verzamelen bladeren en vertellen wat ze onderweg zagen.", "Olijf", ["4.2.GK3.81", "1.1.GK3.82"]],
          ["Bladeren sorteren", "Onderzoek", "Ontdekhoek", "De kleuters leggen bladeren in groepjes volgens vorm en kleur.", null, ["3.1.GK3.83"]],
          ["Paddenstoelen onder de loep", "Waarneming", "Ontdekhoek", "De kleuters wijzen hoed, steel en plaatjes aan met een vergrootglas.", "Klei", ["3.1.GK3.81"]],
          ["Prentenboek: Het blad dat niet wou vallen", "Prentenboek", "Leeshoek", "De kleuters vertellen wat er met het blaadje gebeurde.", "Zee", ["1.1.GK3.82", "4.2.GK3.81"]],
          ["Windspel met bladeren", "Beweging", null, "De kleuters dwarrelen als bladeren en vallen stil op het signaal.", null, ["4.2.GK3.81"]],
          ["Bladerencollage", null, "Knutselhoek", "De kleuters maken een collage met de bladeren die ze verzamelden.", "Zand", ["6.1.GK3.81"]],
          ["Kastanjes tellen", "Spel", "Rekenhoek", "De kleuters tellen kastanjes in bakjes tot tien.", "Pruim", ["2.1.GK3.81"]],
          ["Boomschors afwrijven", "Experiment", "Knutselhoek", "De kleuters maken een afdruk van schors en vergelijken de patronen.", null, ["3.1.GK3.81", "6.1.GK3.81"]],
          ["Kringgesprek: wat vond jij in het bos?", null, null, "De kleuters tonen een vondst en vertellen erover.", null, ["1.1.GK3.82"]],
          ["Paddenstoelen van klei", null, "Knutselhoek", "De kleuters boetseren een paddenstoel met hoed en steel.", "Klei", ["3.1.GK3.81", "6.1.GK3.81"]],
          ["Herfstmemory", "Spel", "Rekenhoek", "De kleuters zoeken paren van herfstvruchten en tellen hun kaartjes.", null, ["2.1.GK3.81", "3.1.GK3.83"]],
          ["Boom van de klas", "Waarneming", null, "De kleuters bekijken de boom op de speelplaats en tekenen wat veranderde.", "Olijf", ["4.2.GK3.81", "3.1.GK3.81"]],
        ],
      ),
      subthema(
        "Dieren maken zich klaar voor de winter",
        "Wat doen de dieren in het bos als het koud wordt?",
        "Een kleuter vond een egel onder de bladeren en de klas vraagt zich af waarom hij daar ligt.",
        ["2026-11-23"],
        ["3.1.GK3.82", "3.1.GK3.84", "1.1.GK3.81", "7.1.GK3.81", "9.3.VK3.81", "2.3.GK3.82", "1.2.GK3.81"],
        [
          ["Wintervoorraad van de eekhoorn", "Spel", null, "De kleuters verstoppen samen nootjes en zoeken ze terug.", "Pruim", ["3.1.GK3.82", "9.3.VK3.81"]],
          ["Een egelhuis bouwen", "Experiment", "Bouwhoek", "De kleuters bouwen een schuilplaats en testen of ze droog blijft.", "Klei", ["3.1.GK3.82", "9.3.VK3.81"]],
          ["Prentenboek: Egel gaat slapen", "Prentenboek", "Leeshoek", "De kleuters vertellen in eigen woorden wat egel doet voor hij gaat slapen.", "Zee", ["1.1.GK3.81"]],
          ["Dierendans", "Beweging", null, "De kleuters bewegen als een egel, een eekhoorn en een vos op de muziek.", "Indigo", ["7.1.GK3.81"]],
          ["Sporen zoeken in het bos", "Uitstap", null, "De kleuters zoeken pootafdrukken en raden welk dier voorbijkwam.", "Olijf", ["3.1.GK3.84"]],
          ["Sporen stempelen", null, "Knutselhoek", "De kleuters stempelen pootafdrukken en koppelen ze aan een dierenkaart.", null, ["3.1.GK3.84"]],
          ["Dieren van klein naar groot", "Spel", "Rekenhoek", "De kleuters leggen dierenfiguren op een rij van klein naar groot.", null, ["2.3.GK3.82"]],
          ["Woordmuur: dieren in de winter", null, null, "De kleuters leren winterslaap, hol en voorraad en gebruiken ze in een zin.", null, ["1.2.GK3.81"]],
          ["Wie slaapt waar?", "Onderzoek", "Ontdekhoek", "De kleuters zoeken uit welk dier in een hol, een nest of onder de bladeren slaapt.", "Zand", ["3.1.GK3.82", "1.2.GK3.81"]],
          ["Poppenkast: de vos zoekt eten", "Prentenboek", "Poppenhoek", "De kleuters spelen het verhaal na en vertellen het verder.", null, ["1.1.GK3.81"]],
          ["Egelparcours in de turnzaal", "Beweging", null, "De kleuters kruipen als egels door een parcours onder en over hindernissen.", "Indigo", ["7.1.GK3.81"]],
          ["Nestjes maken voor de vogels", null, "Bouwhoek", "De kleuters helpen elkaar om een nestje van takjes en wol te maken.", "Klei", ["9.3.VK3.81", "3.1.GK3.82"]],
        ],
      ),
      subthema(
        "Wind en regen",
        "Waar komt de wind vandaan?",
        "Op een stormachtige dag waait de muts van een kleuter weg, en de klas wil weten hoe sterk wind is.",
        ["2026-11-30", "2026-12-07"],
        ["4.2.GK3.82", "4.2.GK3.81", "2.3.GK3.81", "1.2.GK3.82", "6.2.GK3.81"],
        [
          ["Weerbericht van de dag", "Waarneming", null, "De kleuters kijken naar buiten en hangen het juiste weersymbool op.", null, ["4.2.GK3.82"]],
          ["Een windvaan maken", "Experiment", "Knutselhoek", "De kleuters maken een windvaan en kijken van waar de wind komt.", "Zee", ["4.2.GK3.81"]],
          ["Regen opvangen en meten", "Onderzoek", "Ontdekhoek", "De kleuters vergelijken hoe hoog het water in hun potjes staat.", "Zee", ["2.3.GK3.81", "4.2.GK3.82"]],
          ["Rijmen met regen", "Spel", null, "De kleuters zoeken woorden die rijmen op regen en wind.", null, ["1.2.GK3.82"]],
          ["Liedje: de wind waait", null, null, "De kleuters zingen het windlied met gebaren.", "Pruim", ["6.2.GK3.81"]],
          ["Plassen springen", "Beweging", null, "De kleuters springen over en in plassen en vertellen wat ze voelden.", "Olijf", ["4.2.GK3.81"]],
          ["Welke stof waait het verst?", "Experiment", "Ontdekhoek", "De kleuters blazen veertjes, papier en stof weg en vergelijken de afstand.", null, ["2.3.GK3.81"]],
        ],
      ),
    ],
  },
  {
    id: vastId(20),
    naam: "✨ Licht in de winter",
    duurWeken: 4,
    invalshoeken: "licht en donker, winter, samen",
    kernwoordenschat: ["het licht", "de kaars", "de sneeuw", "het ijs", "de want"],
    rijkeWoordenschat: ["schitteren", "bevriezen", "smelten", "de lantaarn"],
    minimumdoelen: ["K-3.2.81", "K-4.2.81", "K-6.1.81", "K-9.3.81"],
    plaatsingen: [
      { blokStart: "2026-12-14", weken: 1 },
      { blokStart: "2027-01-04", weken: 3 },
    ],
    subthemas: [
      subthema(
        "Lichtjes in de donkere dagen",
        "Waarom is het 's morgens nog donker?",
        "De kleuters komen in het donker naar school en merken dat de lichtjes in de straat nog branden.",
        ["2026-12-14"],
        ["4.2.GK3.84", "6.1.GK3.82", "9.3.GK3.82", "1.1.GK3.82"],
        [
          ["Lantaarns knutselen", null, "Knutselhoek", "De kleuters maken een lantaarn met gekleurd papier.", "Zand", ["6.1.GK3.82"]],
          ["Schaduwtheater", "Experiment", null, "De kleuters maken schaduwen met een zaklamp en vertellen wat ze zien.", "Indigo", ["6.1.GK3.82", "1.1.GK3.82"]],
          ["Donker en licht in de klas", "Waarneming", null, "De kleuters doen de lichten uit en vertellen hoe het voelt.", null, ["4.2.GK3.84", "9.3.GK3.82"]],
          ["Prentenboek: Het lichtje van de beer", "Prentenboek", "Leeshoek", "De kleuters vertellen waarom beer bang was in het donker.", "Zee", ["9.3.GK3.82"]],
          ["Kringgesprek: wanneer wordt het donker?", null, null, "De kleuters vertellen wanneer ze thuiskomen en of het dan al donker is.", null, ["4.2.GK3.84", "1.1.GK3.82"]],
          ["Lichtwandeling", "Uitstap", null, "De kleuters wandelen met lantaarns rond de school.", "Olijf", ["4.2.GK3.84"]],
        ],
      ),
      subthema(
        "Sneeuw en ijs",
        "Hoe wordt water ijs?",
        "Na een koude nacht ligt er ijs op de plassen van de speelplaats, en de kleuters willen weten hoe dat kan.",
        ["2027-01-04", "2027-01-11"],
        ["3.2.GK3.81", "4.2.GK3.83", "2.1.GK3.82", "7.1.GK3.82"],
        [
          ["IJsblokjes maken", "Experiment", "Ontdekhoek", "De kleuters zetten water buiten en kijken de volgende dag wat er gebeurde.", "Zee", ["3.2.GK3.81"]],
          ["Wat smelt het snelst?", "Onderzoek", "Ontdekhoek", "De kleuters leggen ijs op verschillende plaatsen en vergelijken.", null, ["3.2.GK3.81"]],
          ["Sneeuwballen tellen", "Spel", "Rekenhoek", "De kleuters vergelijken wie meer, minder of evenveel sneeuwballen heeft.", "Pruim", ["2.1.GK3.82"]],
          ["Schaatsen op sokken", "Beweging", null, "De kleuters glijden over een lijn zonder te vallen.", "Indigo", ["7.1.GK3.82"]],
          ["Wintertafel", "Waarneming", null, "De kleuters verzamelen winterse voorwerpen en vertellen wat winter is.", null, ["4.2.GK3.83"]],
          ["Sneeuwlandschap schilderen", null, "Knutselhoek", "De kleuters schilderen een winterlandschap met wit en blauw.", "Zand", ["4.2.GK3.83"]],
          ["Evenwichtsparcours op het ijs", "Beweging", null, "De kleuters stappen over een smalle balk als over een bevroren beek.", null, ["7.1.GK3.82"]],
        ],
      ),
      subthema(
        "Warm blijven in de winter",
        "Wat houdt ons warm?",
        "Een kleuter vergat zijn wanten en had koude handen, en de klas zoekt uit wat het beste helpt.",
        ["2027-01-18"],
        ["3.2.GK3.82", "9.3.GK3.81", "1.2.GK3.81"],
        [
          ["Welke want is het warmst?", "Onderzoek", "Ontdekhoek", "De kleuters testen wanten van wol, plastic en katoen met een ijsblokje.", "Klei", ["3.2.GK3.82"]],
          ["Winterkleren aankleden", "Spel", "Poppenhoek", "De kleuters kleden samen een pop aan voor de sneeuw.", null, ["9.3.GK3.81", "1.2.GK3.81"]],
          ["Soep maken", "Experiment", null, "De kleuters verdelen de taken en maken samen groentesoep.", "Olijf", ["9.3.GK3.81"]],
          ["Woordspel: warm en koud", "Spel", null, "De kleuters sorteren prenten bij warm of koud en benoemen ze.", null, ["1.2.GK3.81"]],
          ["Prentenboek: De sjaal van oma", "Prentenboek", "Leeshoek", "De kleuters vertellen waarom de sjaal zo belangrijk was.", "Zee", ["1.2.GK3.81"]],
        ],
      ),
    ],
  },
];

/** The school's hours: 8u30 to 15u30 with a lunch break from 12u to 13u, and no afternoon on Wednesday. */
export const SCHOOLUREN = [1, 2, 3, 4, 5].map((weekdag) =>
  weekdag === 3
    ? { weekdag, begin: "08:30:00", einde: "12:00:00", middagpauzeBegin: null, middagpauzeEinde: null }
    : { weekdag, begin: "08:30:00", einde: "15:30:00", middagpauzeBegin: "12:00:00", middagpauzeEinde: "13:00:00" },
);

/** The agenda slots of a full day. Wednesday keeps only the morning ones. */
export const TIJDSLOTEN: { begin: string; einde: string; voormiddag: boolean }[] = [
  { begin: "08:30:00", einde: "09:20:00", voormiddag: true },
  { begin: "09:20:00", einde: "10:10:00", voormiddag: true },
  { begin: "10:10:00", einde: "11:00:00", voormiddag: true },
  { begin: "11:00:00", einde: "12:00:00", voormiddag: true },
  { begin: "13:00:00", einde: "13:50:00", voormiddag: false },
  { begin: "13:50:00", einde: "14:40:00", voormiddag: false },
  { begin: "14:40:00", einde: "15:30:00", voormiddag: false },
];

const HOEK = {
  ontdek: vastId(50),
  lees: vastId(51),
  bouw: vastId(52),
  knutsel: vastId(53),
  reken: vastId(54),
  poppen: vastId(55),
};

export const HOEKEN = [
  { id: HOEK.ontdek, naam: "Ontdekhoek", omschrijving: "Vergrootglazen, weegschaal en natuurvondsten." },
  { id: HOEK.lees, naam: "Leeshoek", omschrijving: "Prentenboeken over het thema." },
  { id: HOEK.bouw, naam: "Bouwhoek", omschrijving: null },
  { id: HOEK.knutsel, naam: "Knutselhoek", omschrijving: null },
  { id: HOEK.reken, naam: "Rekenhoek", omschrijving: "Telmateriaal en spelletjes." },
  { id: HOEK.poppen, naam: "Poppenhoek", omschrijving: null },
];

const [herfst, winter] = THEMAS;

/** What each subthema adds to a hoek, keyed by subthema id, then hoek id. */
export const HOEKVERRIJKINGEN: Record<string, Record<string, string>> = {
  [herfst.subthemas[0].id]: {
    [HOEK.ontdek]: "Paddenstoelen en bladeren om te bekijken met het vergrootglas.",
    [HOEK.knutsel]: "Bladeren, lijm en karton voor een herfstcollage.",
    [HOEK.reken]: "Kastanjes en eikels om te tellen.",
  },
  [herfst.subthemas[1].id]: {
    [HOEK.lees]: "Boeken over egels en eekhoorns.",
    [HOEK.bouw]: "Takken en bladeren om een dierenhol te bouwen.",
    [HOEK.poppen]: "Dierenpoppen voor de poppenkast.",
  },
  [herfst.subthemas[2].id]: {
    [HOEK.ontdek]: "Potjes om regen op te vangen.",
  },
  [winter.subthemas[1].id]: {
    [HOEK.ontdek]: "Bakjes met ijs en sneeuw.",
    [HOEK.poppen]: "Wanten, sjaals en mutsen.",
  },
};

export const ALGEMENE_FICHES = [
  { id: vastId(60), naam: "Onthaal en kring", omschrijving: "Dagelijks begin van de dag in de kring.", doelen: ["1.1.GK3.82"] },
  { id: vastId(61), naam: "Turnen", omschrijving: "Bewegingsopvoeding in de turnzaal.", doelen: ["7.1.GK3.82"] },
];
