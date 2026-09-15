---
id: TB-021
titel: Claude-instellingen opkuisen: antagonist beperken, groepschat weg, CLAUDE.md en constitutie inkorten
soort: technisch
status: klaar
prioriteit: hoog
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 15:20
opgepakt-door: claude-opkuis
branch: ticket/claude-config-opkuis
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar ziet sessies die veel te lang duren. De antagonist loopt drie tot vijf keer, soms veel vaker: E6-02
kreeg 23 rondes, met 61 MINOR-bevindingen tegenover 7 MAJOR. De claim op `nl.json` in de groepschat blokkeert sessies
urenlang. De groepschat zelf kost tijd en tokens: 945 regels chatlog die elke sessie bij de start leest. En
`CLAUDE.md` (45 KB) en `CONSTITUTION.md` (99 KB) worden in elke sessie en bij elke audit ingelezen, terwijl ze
grotendeels geschiedenis bevatten.

## Voorgestelde wijziging

- **Antagonist** (`.claude/agents/antagonist.md`, `jaarplan-build`, `ticket-uitvoeren`, Art. X.7 en XIII): één audit
  per story of ticket, op de diff. Alleen CRITICAL en MAJOR blokkeren. Hoogstens twee rondes, de tweede enkel op de
  open blokkerende bevindingen. Een kort rapport. Het model blijft Opus.
- **Groepschat weg:** de skill, de claims, de chatlog en de sessiebestanden, en de verwijzingen in de skills,
  `backlog/TICKETS.md` en `.gitignore`. Iedereen mag `nl.json` en andere gedeelde bestanden wijzigen; conflicten
  lossen we op bij de merge. Voor poorten kijk je welke vrij is.
- **Technical-lead:** alleen op vraag, zonder claims, chat of BOARD.md.
- **`CLAUDE.md`** herschreven tot de huidige werkafspraken, zonder statusgeschiedenis.
- **`CONSTITUTION.md`:** de geschiedenis eruit, elke geldende regel letterlijk behouden; het ratificatielog naar
  `docs/constitutie-log.md`.
- **ADR-0037** legt het besluit vast.

## Acceptatiecriteria

- [x] Gegeven een antagonistaudit met alleen MINOR-bevindingen, wanneer de sessie het verdict leest, dan is dat
  COMPLIANT en volgt er geen nieuwe ronde.
- [x] Gegeven een fixronde, wanneer de antagonist opnieuw draait, dan controleert hij alleen de open blokkerende
  bevindingen, en er zijn nooit meer dan twee rondes.
- [x] Gegeven de repo na deze wijziging, wanneer je zoekt in `CLAUDE.md`, `.claude/` en `backlog/TICKETS.md`, dan vraagt
  geen enkele actieve instructie nog een groepschat-claim, en de skill `groepschat` bestaat niet meer.
- [x] Gegeven de nieuwe `CONSTITUTION.md`, wanneer die naast de versie van `f5804bc` gelegd wordt, dan staat elke
  geldende regel er nog in, en staat het ratificatielog volledig in `docs/constitutie-log.md`.
- [x] Gegeven de tests van het bord, wanneer ze draaien, dan zijn ze groen.

## Buiten scope

- De inhoud van de regels, behalve Art. X.7, XIII en de nieuwe XI.4.
- De verouderde stack in Art. VIII (React 18, shadcn/ui) tegenover ADR-0024 en `CLAUDE.md`: een aparte vraag aan de
  eigenaar.
- Oude worklogs en backlogteksten die de groepschat als geschiedenis vermelden.

## Open vragen

Geen.

## Werklog

- 2026-09-15 14:37 · claude-opkuis · aangemaakt (status in-uitvoering)
- 2026-09-15 14:59 · claude-opkuis · Antagonist begrensd, groepschat verwijderd (demo-slot blijft als lockbestand), CLAUDE.md 45 naar 12 KB, constitutie 99 naar 64 KB met het log in docs/constitutie-log.md, ADR-0037; bordtests 84/84 groen
- 2026-09-15 15:10 · claude-opkuis · Antagonist ronde 1: 1 MAJOR (drie regels uit de opgeloste lijst van Art. XIV ontbraken), 4 MINOR, 1 vraag; alles verwerkt, verslag in backlog/worklogs/TB-021/antagonist.md
- 2026-09-15 15:20 · claude-opkuis · in-uitvoering → klaar: Antagonist ronde 2 COMPLIANT; bordtests 84/84 groen. Groepschat weg, antagonist begrensd (ADR-0037), CLAUDE.md 45 naar 12 KB, constitutie 99 naar 65 KB
