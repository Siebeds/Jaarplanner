---
id: TB-061
titel: Sessie pusht en zet een PR klaar zodra het werk af is
soort: technisch
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-22
bijgewerkt: 2026-09-22 22:40
opgepakt-door: claude-tb061
branch: ticket/TB-pr-klaarzetten
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De skill `ticket-uitvoeren` zei tot nu toe: pushen en een PR openen gebeurt alleen wanneer de eigenaar het vraagt. Het
gevolg is dat afgewerkte tickets als lokale branches blijven liggen, op een machine waar de eigenaar niet bij kan. Op
2026-09-22 stonden FB-076 en FB-077 allebei op "Te testen" terwijl er op GitHub niets te zien was, en de sessie wees
de eigenaar zelfs naar PR's die niet bestonden.

De eigenaar besliste diezelfde dag: telkens wanneer het werk af is, wordt er gepusht en staat er een PR klaar.

## Voorgestelde wijziging

- Stap 6 van `.claude/skills/ticket-uitvoeren/SKILL.md` draait om: pushen en de PR openen hoort bij het afronden, niet
  bij een aparte vraag van de eigenaar.
- De beschrijving van de skill noemt die laatste stap mee, zodat ze ook zichtbaar is voor wie de skill alleen uit de
  lijst kent.
- De PR-tekst is Nederlands, zoals het ticket: ze is voor de eigenaar en is het enige dat hij leest voor hij beslist.
  Ze zegt wat er veranderde en waarom, wat er gemeten is, en wat er gevonden maar niet opgelost is, met het ticket
  waarin dat staat. De commits blijven Engels.
- Alleen de eigenaar merget. Een PR openen is geen beslissing nemen.

## Acceptatiecriteria

- [x] Gegeven een ticket waarvan het werk af is, dan zegt de skill dat de sessie pusht en een PR opent zonder dat de eigenaar erom vraagt.
- [x] Gegeven die PR, dan zegt de skill dat titel en beschrijving Nederlands zijn en wat erin hoort.
- [x] Gegeven de skill, dan staat er nergens meer dat pushen of een PR openen op een vraag van de eigenaar wacht.
- [x] Gegeven de beschrijving van de skill, dan noemt die het openen van de PR als laatste stap.

## Buiten scope

- De skill `jaarplan-build`. Daar gaat een story naar de feature-branch van haar epic en niet naar `main`, dus
  "een PR per story" is daar een andere vraag. Die beslissing is aan de eigenaar en staat onder Open vragen.
- Wie merget: dat blijft de eigenaar.

## Open vragen

- Moet `jaarplan-build` hetzelfde doen, en dan met een PR per epic in plaats van per story? Gevraagd aan de eigenaar
  op 2026-09-22.

## Werklog

- 2026-09-22 22:40 · claude-tb061 · aangemaakt (status in-uitvoering)
- 2026-09-22 22:40 · claude-tb061 · beslissing van de eigenaar op 2026-09-22, na FB-076 en FB-077 die als lokale branch bleven liggen
