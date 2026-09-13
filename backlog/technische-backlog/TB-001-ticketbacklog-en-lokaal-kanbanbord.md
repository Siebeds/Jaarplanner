---
id: TB-001
titel: Ticketbacklog en lokaal kanbanbord
soort: technisch
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-13
bijgewerkt: 2026-09-13 17:25
opgepakt-door: ticket-backlog
branch: feature/ticket-backlog
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar wil nieuw werk laten binnenkomen via tickets die een functioneel architect aanmaakt, en op een bord zien
welke tickets de parallelle sessies oppakken. De epics zijn daarvoor niet geschikt: een story is een alinea in een
gedeeld bestand, en een status die een sessie op haar branch schrijft, staat pas na de merge op `main`. Werk dat de
eigenaar zelf start, moet eerst een technisch ticket krijgen, in een andere kleur op het bord.

## Voorgestelde wijziging

- Twee mappen, `backlog/functionele-backlog/` en `backlog/technische-backlog/`, met de handleiding `backlog/TICKETS.md`.
- `tools/backlog-board/`: het formaat op één plaats (`lib/format.mjs`), een parser en validator, het uitlezen van
  `main`, niet-gemergde branches en worktrees, het afleiden van de kolommen, een CLI (`tickets.mjs`) voor elke
  schrijfactie, en een lokale server met één pagina als bord. Geen dependencies.
- Drie skills: `ticket-aanmaken`, `ticket-uitvoeren` en `ticket-testen`.
- Een werkafspraak in `CLAUDE.md` (geen werk zonder ticket of story), en `jaarplan-build` en de technical lead die de
  tickets kennen.
- ADR-0033 en een CI-job die de tickets en de tool controleert.

## Acceptatiecriteria

- [x] Gegeven een ticket op `main`, een branch die het wijzigt en een worktree met een niet-gecommitte wijziging, wanneer het bord laadt, dan toont het de recentste versie in de juiste kolom (`test/sources.test.mjs`).
- [x] Gegeven een eindstatus op een branch die nog niet in `main` zit, wanneer het bord laadt, dan staat de kaart in In review, en na de merge in Te testen of Klaar (`test/sources.test.mjs`).
- [x] Gegeven een ticket dat de structuur breekt, wanneer het bord laadt, dan staat het in de rode balk met de fout en faalt `tickets.mjs check` (`test/parse.test.mjs`, `test/board.test.mjs`).
- [x] Gegeven een statuswijziging via de CLI, dan zijn alleen de toegestane overgangen mogelijk en worden `bijgewerkt` en een werklogregel geschreven (`test/cli.test.mjs`).
- [x] Gegeven het bord in een echte browser, wanneer ik het bekijk op desktop en op 390 px breed, dan is alles leesbaar en bedienbaar met het toetsenbord (`backlog/worklogs/TB-001/browser-pass.md`).
- [ ] Gegeven de volledige wijziging, wanneer de antagonist ze audit, dan zijn alle bevindingen opgelost of uitdrukkelijk opzij gezet.

## Buiten scope

Het omzetten van de bestaande epics naar tickets, remote branches (`refs/remotes`) op het bord, en een automatische
statuswijziging na een merge op GitHub.

## Open vragen

Geen meer. De taalvraag (Art. II.6 hield de backlog Engels) is op 2026-09-13 door de eigenaar beslist met een
amendement: tickets zijn Nederlands, de CLI-opdrachten blijven Engels. Ook beslist die dag: een nieuwe story mag alleen
nog als vervolg binnen een lopende epic, en de functioneel architect werkt in een eigen clone.

## Werklog

- 2026-09-13 14:11 · ticket-backlog · aangemaakt (status in-uitvoering)
- 2026-09-13 14:15 · ticket-backlog · formaat, CLI, bord, skills en ADR-0033 gebouwd; 43 tests groen
- 2026-09-13 14:21 · ticket-backlog · browserpass op 1440 en 390 px, licht en donker: vier gebreken gevonden en opgelost (kolommen, criteria, bewaarde zoekterm, contrast van de randen)
- 2026-09-13 14:41 · ticket-backlog · antagonist ronde 1: VIOLATIONS FOUND (5 MAJOR, 6 MINOR); code en documenten aangepast, 48 tests groen; het Art. II.6-amendement wacht op de eigenaar
- 2026-09-13 15:39 · ticket-backlog · eigenaar: Art. II.6-amendement geratificeerd, vervolgstories alleen binnen een lopende epic, functioneel architect in een eigen clone
- 2026-09-13 15:57 · ticket-backlog · antagonist ronde 2: VIOLATIONS FOUND (3 MAJOR rond de bewaking op oude kopieën); bewaking vergelijkt nu status in plaats van tekst en ziet opgehaalde remote branches, 52 tests groen, browserpass opnieuw gedraaid
- 2026-09-13 16:00 · ticket-backlog · eigenaar: amendement uitgebreid naar de handleiding en de skillnamen, eerste amendement en commitvolgorde bevestigd, afspraak 'alleen aanpassen zolang nieuw' bevestigd
- 2026-09-13 16:19 · ticket-backlog · antagonist ronde 3: VIOLATIONS FOUND (2 MAJOR: blokkering viel weg, verweesde remote branch); elke schrijfactie werkt nu op de nieuwste versie en neemt die eerst over, geblokkeerde tickets worden niet opgepakt, 57 tests groen
- 2026-09-13 16:25 · ticket-backlog · eigenaar: tweede ratificatierij bevestigd; rollen: de architect maakt enkel tickets aan (altijd nieuw), alleen de eigenaar wijzigt statussen op zijn pc en test zelf
- 2026-09-13 16:59 · ticket-backlog · correctie op de regel van 16:25: de eigenaar test niet zelf. Zijn beslissing: de functioneel architect test, de eigenaar zet de status; de sessies draaien alleen op zijn pc; de architect mag de tekst aanscherpen zolang het ticket nieuw is
- 2026-09-13 17:25 · ticket-backlog · antagonist ronde 5: VIOLATIONS FOUND (1 MAJOR: een afgesplitste versie gold als nieuwer); nieuwer betekent nu strikt voor, houdercontrole terug, geen pickup op main, 67 tests groen
- 2026-09-13 17:25 · ticket-backlog · aanvulling: antagonist ronde 4 (op 80cfd61) gaf VIOLATIONS FOUND (6 MAJOR: overnemen van tekst brak latere merges, plus twee keer te ruim gelezen beslissingen van de eigenaar); opgelost in e9e8832, deze regel ontbrak
