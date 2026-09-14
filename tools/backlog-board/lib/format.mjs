// The ticket format, in one place. The parser, the CLI, the board and the tests all read these
// constants; backlog/TICKETS.md describes the same rules for people, and a test keeps the two in
// step. Change the format here first, then there.
//
// Identifiers are English (tooling code, CLAUDE.md); the values are Dutch because they are what the
// functional architect writes and reads.

export const FOLDERS = {
  FB: 'backlog/functionele-backlog',
  TB: 'backlog/technische-backlog',
};

export const KIND_OF_PREFIX = { FB: 'functioneel', TB: 'technisch' };

// Status values as written in a ticket file, in board order.
export const STATUSES = ['nieuw', 'klaar-voor-bouw', 'in-uitvoering', 'te-testen', 'klaar'];

// Board columns. `in-review` is not a status anyone writes: the board derives it when an agent's
// final status (te-testen / klaar) is visible on a branch or worktree but not yet on main.
export const COLUMNS = [
  { id: 'nieuw', title: 'Nieuw' },
  { id: 'klaar-voor-bouw', title: 'Klaar voor bouw' },
  { id: 'in-uitvoering', title: 'In uitvoering' },
  { id: 'in-review', title: 'In review' },
  { id: 'te-testen', title: 'Te testen' },
  { id: 'klaar', title: 'Klaar' },
];

export const PRIORITIES = ['hoog', 'middel', 'laag'];

// Every key must be present (an empty value is fine for the optional ones), and the CLI writes them
// in this order. Unknown keys are an error: the point of the format is that it is the same everywhere.
export const KEYS = [
  'id',
  'titel',
  'soort',
  'status',
  'prioriteit',
  'aangemaakt',
  'bijgewerkt',
  'opgepakt-door',
  'branch',
  'pr',
  'geblokkeerd',
  'fr',
];

export const REQUIRED_VALUES = ['id', 'titel', 'soort', 'status', 'prioriteit', 'aangemaakt', 'bijgewerkt'];

// Sections, in order, per prefix. `Werklog` is always last, because the CLI appends to the end of
// the file.
export const SECTIONS = {
  FB: ['Aanleiding', 'Gewenst gedrag', 'Acceptatiecriteria', "Testscenario's", 'Buiten scope', 'Open vragen', 'Werklog'],
  // TB has Open vragen too: it is the path the owner starts without refinement, so it is where an open
  // decision (Art. XIV) must have somewhere to be written down.
  TB: ['Aanleiding', 'Voorgestelde wijziging', 'Acceptatiecriteria', 'Buiten scope', 'Open vragen', 'Werklog'],
};

// Sections that may be empty. Everything else needs content once HTML comments are stripped.
export const MAY_BE_EMPTY = ['Werklog'];

// Guidance the CLI writes into a fresh ticket as HTML comments, so it never renders and an unfilled
// section still reads as empty to the validator.
export const GUIDANCE = {
  Aanleiding: 'Waarom is dit nodig? Welk probleem heeft een leerkracht of de directie vandaag?',
  'Gewenst gedrag': 'Wat moet de gebruiker kunnen, in gewone taal. Beschrijf het wat, niet het hoe.',
  'Voorgestelde wijziging': 'Wat verandert er technisch, en in welke delen van de code?',
  Acceptatiecriteria: 'Een lijst met "- [ ]" regels, elk controleerbaar: Gegeven ..., wanneer ..., dan ...',
  "Testscenario's": 'De stappen die de tester in de app doorloopt, met wat die moet zien.',
  'Buiten scope': 'Wat hoort er uitdrukkelijk niet bij? Schrijf "Niets." als er niets uitgesloten wordt.',
  'Open vragen': 'Wat is nog niet beslist? Schrijf "Geen." als alles duidelijk is.',
};

// Allowed status changes. The CLI enforces them; a person editing a file by hand is not stopped, but
// the validator still checks the per-status rules in parse.mjs.
const TRANSITIONS = {
  nieuw: ['klaar-voor-bouw', 'in-uitvoering'],
  'klaar-voor-bouw': ['in-uitvoering', 'nieuw'],
  'in-uitvoering': ['te-testen', 'klaar', 'klaar-voor-bouw'],
  'te-testen': ['klaar', 'klaar-voor-bouw'],
  klaar: ['klaar-voor-bouw'],
};

export function transitionAllowed(prefix, from, to) {
  if (!TRANSITIONS[from]?.includes(to)) return false;
  // A functional ticket is refined before anyone builds it, and it always passes the tester.
  if (prefix === 'FB' && from === 'nieuw' && to === 'in-uitvoering') return false;
  if (prefix === 'FB' && from === 'in-uitvoering' && to === 'klaar') return false;
  // A technical ticket has no tester column.
  if (prefix === 'TB' && to === 'te-testen') return false;
  return true;
}

// The status an agent writes in the last commit of its branch.
export const FINAL_STATUS = { FB: 'te-testen', TB: 'klaar' };

export const FILE_NAME = /^(FB|TB)-(\d{3,})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
export const IGNORED_FILES = ['README.md', '.gitkeep'];
export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
export const WORKLOG_LINE = /^- (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · ([^·]+?) · (.+)$/;
export const PR = /^(#?\d+|https:\/\/\S+)$/;
export const FR = /^N?FR-\d+(\.\d+)*$/;
export const MAX_TITLE = 90;
