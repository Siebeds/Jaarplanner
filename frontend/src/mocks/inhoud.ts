/**
 * The fixed content of the mock mode (TB-046): one K3 klas in 2026-2027 with one complete thema, and its agenda for the
 * weeks of 16 and 23 november 2026.
 *
 * Everything here is invented. The goal codes have Op.stap's shape but numbers (`.8x`) that Op.stap does not use, and
 * their texts are written for this file, so no screen in mock mode can pass for real curriculum content. No person in
 * it is real either.
 */
import type { Activiteitkleur, ActiviteitType, Doelsoort } from "../lib/types";

export const SCHOOLJAAR = {
  id: "00000000-0000-4000-8000-000000000001",
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

/** The themaperiodes of the year, as the server's grid would cut them: never across a vacation. */
export const THEMAPERIODES: { start: string; eind: string }[] = [
  { start: "2026-09-01", eind: "2026-10-02" },
  { start: "2026-10-05", eind: "2026-10-30" },
  { start: "2026-11-09", eind: "2026-12-18" },
  { start: "2027-01-04", eind: "2027-02-12" },
  { start: "2027-02-22", eind: "2027-04-02" },
  { start: "2027-04-19", eind: "2027-05-21" },
  { start: "2027-05-24", eind: "2027-06-30" },
];

export const BLOKINDELING =
  "themaperiode 5 wk, subthemaperiode 2 wk (blokken breken op schoolvakanties en worden gelijkmatig over elke " +
  "lesperiode verdeeld; subthemaperiodes verdelen telkens één themaperiode)";

export const GEBRUIKER = {
  id: "00000000-0000-4000-8000-000000000002",
  naam: "Directie (mockmodus)",
  email: "directie@mock.local",
};

export const KLAS = {
  id: "00000000-0000-4000-8000-000000000003",
  naam: "K3 De Uilen",
  jaarfase: "K3",
};

export const JAARFASEN = ["JK", "K2", "K3", "L1", "L2", "L3", "L4", "L5", "L6"];

export const DISCIPLINES: Record<string, string> = {
  "1": "Nederlands en communicatie",
  "3": "Wetenschap en techniek",
  "4": "Aardrijkskunde",
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

export const MINIMUMDOELEN: MockMinimumdoel[] = [
  {
    ref: "K-3.1.81",
    nr: "3.1.81",
    omschrijving: "De kleuters nemen planten en dieren in hun omgeving waar en beschrijven wat ze zien.",
    leergebied: "Wetenschap en techniek",
    rubriek: "Levende natuur",
    subrubriek: "Planten en dieren",
  },
  {
    ref: "K-4.2.81",
    nr: "4.2.81",
    omschrijving: "De kleuters herkennen hoe het weer en de natuur veranderen met de seizoenen.",
    leergebied: "Aardrijkskunde",
    rubriek: "Aardrijkskundige kennis",
    subrubriek: null,
  },
  {
    ref: "K-1.1.81",
    nr: "1.1.81",
    omschrijving: "De kleuters luisteren naar een verhaal en vertellen het in eigen woorden na.",
    leergebied: "Nederlands en communicatie",
    rubriek: "Luisteren en spreken",
    subrubriek: null,
  },
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

export const LEERPLANDOELEN: MockLeerplandoel[] = [
  {
    code: "3.1.GK3.81",
    doelsoort: "Gemeenschappelijk",
    discipline: "3",
    domein: "Levende natuur",
    subdomein: "Planten",
    tekst: "De leerlingen kunnen delen van een paddenstoel en van een boom aanwijzen en benoemen.",
    minimumdoelRef: "K-3.1.81",
  },
  {
    code: "3.1.GK3.82",
    doelsoort: "Gemeenschappelijk",
    discipline: "3",
    domein: "Levende natuur",
    subdomein: "Dieren",
    tekst: "De leerlingen kunnen vertellen hoe een dier zich op de winter voorbereidt.",
    minimumdoelRef: "K-3.1.81",
  },
  {
    code: "3.1.GK3.83",
    doelsoort: "Gemeenschappelijk",
    discipline: "3",
    domein: "Levende natuur",
    subdomein: "Planten",
    tekst: "De leerlingen kunnen bladeren sorteren volgens vorm en kleur.",
    minimumdoelRef: "K-3.1.81",
  },
  {
    code: "4.2.GK3.81",
    doelsoort: "Gemeenschappelijk",
    discipline: "4",
    domein: "Aardrijkskundige kennis",
    subdomein: "Weer en seizoenen",
    tekst: "De leerlingen kunnen kenmerken van de herfst benoemen: wind, regen, vallende bladeren.",
    minimumdoelRef: "K-4.2.81",
  },
  {
    code: "4.2.GK3.82",
    doelsoort: "Gemeenschappelijk",
    discipline: "4",
    domein: "Aardrijkskundige kennis",
    subdomein: "Weer en seizoenen",
    tekst: "De leerlingen kunnen het weer van de dag waarnemen en met een symbool aanduiden.",
    minimumdoelRef: "K-4.2.81",
  },
  {
    code: "1.1.GK3.81",
    doelsoort: "Gemeenschappelijk",
    discipline: "1",
    domein: "Mondelinge taalvaardigheid",
    subdomein: "Luisteren",
    tekst: "De leerlingen kunnen de volgorde van gebeurtenissen in een voorgelezen prentenboek navertellen.",
    minimumdoelRef: "K-1.1.81",
  },
  {
    code: "1.1.GK3.82",
    doelsoort: "Gemeenschappelijk",
    discipline: "1",
    domein: "Mondelinge taalvaardigheid",
    subdomein: "Spreken",
    tekst: "De leerlingen kunnen in de kring vertellen wat ze buiten ontdekt hebben.",
    minimumdoelRef: "K-1.1.81",
  },
  {
    code: "7.1.GK3.81",
    doelsoort: "Gemeenschappelijk",
    discipline: "7",
    domein: "Motorische competenties",
    subdomein: "Bewegen op muziek",
    tekst: "De leerlingen kunnen bewegingen van dieren nabootsen op het ritme van muziek.",
    minimumdoelRef: null,
  },
  {
    code: "9.3.VK3.81",
    doelsoort: "Verdieping",
    discipline: "9.3",
    domein: "Samenwerken",
    subdomein: "Samen spelen",
    tekst: "De leerlingen kunnen samen met een klasgenoot een taak verdelen en afwerken.",
    minimumdoelRef: null,
  },
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
  /** Monday of its week in the agenda. */
  week: string;
  activiteiten: MockActiviteit[];
}

export const THEMA = {
  id: "00000000-0000-4000-8000-000000000010",
  naam: "🍂 Herfst in het bos",
  duurWeken: 4,
  invalshoeken: "natuur, seizoenen, dieren",
  kernwoordenschat: ["de paddenstoel", "het blad", "de eekhoorn", "de winterslaap", "de wind"],
  rijkeWoordenschat: ["de hoed", "de steel", "verzamelen", "ritselen"],
  minimumdoelen: ["K-3.1.81", "K-4.2.81", "K-1.1.81"],
  /** The first school day of its themaperiode, the placement key. */
  blokStart: "2026-11-09",
};

export const SUBTHEMAS: MockSubthema[] = [
  {
    id: "00000000-0000-4000-8000-000000000020",
    naam: "Paddenstoelen en bladeren",
    onderzoeksvraag: {
      id: "00000000-0000-4000-8000-000000000021",
      vraag: "Waarom vallen de bladeren van de bomen?",
      probleemstelling: "De kleuters zien de speelplaats vol bladeren liggen en willen weten waar ze vandaan komen.",
    },
    subdoelen: ["3.1.GK3.81", "3.1.GK3.83", "4.2.GK3.81", "1.1.GK3.82"],
    week: "2026-11-16",
    activiteiten: [
      {
        id: "00000000-0000-4000-8000-000000000101",
        naam: "Bladerenwandeling in het park",
        activiteitType: "Uitstap",
        hoek: null,
        verwachteUitkomsten: "De kleuters verzamelen bladeren en vertellen wat ze onderweg zagen.",
        kleur: "Olijf",
        doelen: ["4.2.GK3.81", "1.1.GK3.82"],
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        naam: "Bladeren sorteren",
        activiteitType: "Onderzoek",
        hoek: "Ontdekhoek",
        verwachteUitkomsten: "De kleuters leggen bladeren in groepjes volgens vorm en kleur.",
        kleur: null,
        doelen: ["3.1.GK3.83"],
      },
      {
        id: "00000000-0000-4000-8000-000000000103",
        naam: "Paddenstoelen onder de loep",
        activiteitType: "Waarneming",
        hoek: "Ontdekhoek",
        verwachteUitkomsten: "De kleuters wijzen hoed, steel en plaatjes aan met een vergrootglas.",
        kleur: "Klei",
        doelen: ["3.1.GK3.81"],
      },
      {
        id: "00000000-0000-4000-8000-000000000104",
        naam: "Prentenboek: Het blad dat niet wou vallen",
        activiteitType: "Prentenboek",
        hoek: "Leeshoek",
        verwachteUitkomsten: "De kleuters vertellen het verhaal na met prenten in de juiste volgorde.",
        kleur: "Zee",
        doelen: ["1.1.GK3.82", "4.2.GK3.81"],
      },
      {
        id: "00000000-0000-4000-8000-000000000105",
        naam: "Windspel met bladeren",
        activiteitType: "Beweging",
        hoek: null,
        verwachteUitkomsten: "De kleuters dwarrelen als bladeren in de wind en vallen stil op het signaal.",
        kleur: null,
        doelen: ["4.2.GK3.81"],
      },
      {
        id: "00000000-0000-4000-8000-000000000106",
        naam: "Bladerenkunst",
        activiteitType: null,
        hoek: "Knutselhoek",
        verwachteUitkomsten: "De kleuters maken een collage met de bladeren die ze verzamelden.",
        kleur: "Zand",
        doelen: ["3.1.GK3.83"],
      },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000030",
    naam: "Dieren maken zich klaar voor de winter",
    onderzoeksvraag: {
      id: "00000000-0000-4000-8000-000000000031",
      vraag: "Wat doen de dieren in het bos als het koud wordt?",
      probleemstelling: "Een kleuter vond een egel onder de bladeren en de klas vraagt zich af waarom hij daar ligt.",
    },
    subdoelen: ["3.1.GK3.82", "4.2.GK3.82", "1.1.GK3.81", "7.1.GK3.81", "9.3.VK3.81"],
    week: "2026-11-23",
    activiteiten: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        naam: "Wintervoorraad van de eekhoorn",
        activiteitType: "Spel",
        hoek: null,
        verwachteUitkomsten: "De kleuters verstoppen samen nootjes en zoeken ze terug.",
        kleur: "Pruim",
        doelen: ["3.1.GK3.82", "9.3.VK3.81"],
      },
      {
        id: "00000000-0000-4000-8000-000000000202",
        naam: "Een egelhuis bouwen",
        activiteitType: "Experiment",
        hoek: "Bouwhoek",
        verwachteUitkomsten: "De kleuters bouwen met takken en bladeren een schuilplaats en testen of ze droog blijft.",
        kleur: "Klei",
        doelen: ["3.1.GK3.82", "9.3.VK3.81"],
      },
      {
        id: "00000000-0000-4000-8000-000000000203",
        naam: "Prentenboek: Egel gaat slapen",
        activiteitType: "Prentenboek",
        hoek: "Leeshoek",
        verwachteUitkomsten: "De kleuters vertellen in eigen woorden wat egel doet voor hij gaat slapen.",
        kleur: "Zee",
        doelen: ["1.1.GK3.81"],
      },
      {
        id: "00000000-0000-4000-8000-000000000204",
        naam: "Weerbericht van de dag",
        activiteitType: "Waarneming",
        hoek: null,
        verwachteUitkomsten: "De kleuters kijken naar buiten en hangen het juiste weersymbool op.",
        kleur: null,
        doelen: ["4.2.GK3.82"],
      },
      {
        id: "00000000-0000-4000-8000-000000000205",
        naam: "Dierendans",
        activiteitType: "Beweging",
        hoek: null,
        verwachteUitkomsten: "De kleuters bewegen als een egel, een eekhoorn en een vos op de muziek.",
        kleur: "Indigo",
        doelen: ["7.1.GK3.81"],
      },
      {
        id: "00000000-0000-4000-8000-000000000206",
        naam: "Sporen zoeken in het bos",
        activiteitType: "Uitstap",
        hoek: null,
        verwachteUitkomsten: "De kleuters zoeken pootafdrukken en vertellen welk dier er voorbijkwam.",
        kleur: "Olijf",
        doelen: ["3.1.GK3.82", "4.2.GK3.82"],
      },
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

export const HOEKEN = [
  { id: "00000000-0000-4000-8000-000000000301", naam: "Ontdekhoek", omschrijving: "Vergrootglazen, weegschaal en natuurvondsten." },
  { id: "00000000-0000-4000-8000-000000000302", naam: "Leeshoek", omschrijving: "Prentenboeken over het thema." },
  { id: "00000000-0000-4000-8000-000000000303", naam: "Bouwhoek", omschrijving: null },
  { id: "00000000-0000-4000-8000-000000000304", naam: "Knutselhoek", omschrijving: null },
];

/** What each subthema adds to a hoek, keyed by subthema id, then hoek id. */
export const HOEKVERRIJKINGEN: Record<string, Record<string, string>> = {
  "00000000-0000-4000-8000-000000000020": {
    "00000000-0000-4000-8000-000000000301": "Paddenstoelen en bladeren om te bekijken met het vergrootglas.",
    "00000000-0000-4000-8000-000000000304": "Bladeren, lijm en karton voor een herfstcollage.",
  },
  "00000000-0000-4000-8000-000000000030": {
    "00000000-0000-4000-8000-000000000302": "Boeken over egels en eekhoorns.",
    "00000000-0000-4000-8000-000000000303": "Takken en bladeren om een dierenhol te bouwen.",
  },
};

export const ALGEMENE_FICHES = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    naam: "Onthaal en kring",
    omschrijving: "Dagelijks begin van de dag in de kring.",
    doelen: ["1.1.GK3.82"],
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    naam: "Turnen",
    omschrijving: "Bewegingsopvoeding in de turnzaal.",
    doelen: ["7.1.GK3.81"],
  },
];
