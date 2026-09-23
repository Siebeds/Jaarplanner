---
id: FB-027
titel: AI stelt de activiteiten van het subthema voor in de weekagenda
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-23 20:50
opgepakt-door: claude-fb027
branch: ticket/FB-027-weekvoorstel
pr:
geblokkeerd:
fr: [FR-6.2, FR-7.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"Op jouw week-agenda jouw activiteiten voor dat subthema laten voorstellen (ook terug
goedkeuren/afkeuren) en laten rekening houden met start en eindtijd van schooldag en algemene fiches"*.

Vandaag kan een leerkracht alle activiteiten van een subthema in één keer over gekozen dagen verdelen ("achter elkaar" of
"verspreid"). Dat gebeurt zonder AI, zonder te kiezen welke activiteiten passen, en zonder rekening te houden met
schooluren of fiches.

**Beslissing van de eigenaar, 2026-09-15:** de **AI kiest** welke activiteiten, in welke volgorde en op welke dag; de
**code past ze in** op vrije momenten binnen de schooluren (FB-023), rond de algemene fiches en de hoeken. De leerkracht
aanvaardt of weigert.

## Gewenst gedrag

- In de agenda van haar klas vraagt de leerkracht voor een week "stel mijn week voor".
- De kandidaten zijn de activiteiten van het subthema dat die week loopt: de gedeelde en haar eigen.
- De AI kiest welke activiteiten, in welke volgorde en op welke dag, met een korte motivatie.
- De tool zet ze op vrije momenten binnen de schooluren van die dag, buiten de middagpauze, zonder te overlappen met
  algemene fiches, hoekmomenten of wat al gepland staat, met de lengte van de activiteit.
- De voorstellen staan als voorgestelde blokken in de agenda, herkenbaar met een woord of icoon. De leerkracht aanvaardt
  ze per blok of allemaal, of weigert ze. Niets wat al gepland stond, verschuift.
- Past een gekozen activiteit nergens, dan zegt de tool dat, in plaats van ze ergens te wringen.
- Opnieuw vragen vervangt alleen de voorstellen waarover nog niet beslist is.

## Acceptatiecriteria

- [ ] Gegeven een week met schooluren 8:30 tot 15:30, middagpauze 12:00 tot 13:15 en een algemene fiche elke dag van
  13:15 tot 14:00, wanneer de leerkracht een voorstel vraagt, dan valt geen voorgesteld blok buiten de schooluren, in de
  middagpauze of over de fiche.
- [ ] Gegeven de voorstellen, dan staan ze als voorgesteld in de agenda, en tellen ze pas mee in de dekking als ze
  aanvaard zijn.
- [ ] Gegeven een voorgesteld blok, wanneer de leerkracht het weigert, dan verdwijnt het; wanneer ze het aanvaardt, blijft
  het als gewone planning.
- [ ] Gegeven een activiteit die de AI kiest maar die nergens past, dan meldt de tool dat en plant ze niets.
- [ ] Gegeven een opnieuw gevraagd voorstel, dan blijven aanvaarde blokken en eerder geplande activiteiten staan.
- [ ] De logica is getest met een nep-AI-client, en het inpassen ook zonder AI.

## Testscenario's

1. Stel als directie de schooluren in (FB-023). Plan als leerkracht een algemene fiche elke dag na de middag.
2. Open de agenda van een week met een lopend subthema en kies "stel mijn week voor".
3. Voorgestelde blokken verschijnen, alleen binnen de schooluren en naast de fiche, elk met een motivatie.
4. Aanvaard er twee, weiger er een. Vraag opnieuw: de twee aanvaarde blijven staan.
5. Open de dekking: alleen de aanvaarde tellen mee.

## Buiten scope

- Hele maanden of het hele jaar vullen: de vraag is per week.
- De bestaande verdeler zonder AI: die blijft bestaan.

## Open vragen

- Tellen voorgestelde activiteiten al mee in de dekking? **Standaard** niet, zoals een voorgesteld thema in het jaarplan.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI.
- Hangt af van FB-023 (schooluren); haar eigen activiteiten van FB-015.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-23 20:12 · claude-fb027 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten (vóór FB-032)
- 2026-09-23 20:22 · claude-fb027 · ontwerp vastgelegd in ADR-0067: voorgesteld blok is een activiteitplaatsing met status voorgesteld; AI kiest activiteit, volgorde en dag, de tool het uur; grondwet IV.5 en V.1 aangevuld
- 2026-09-23 20:43 · claude-fb027 · backend en frontend gebouwd; backend 2350 unit + 613 integratie groen, frontend 277 tests groen, lint groen
- 2026-09-23 20:50 · claude-fb027 · antagonist: 1 MAJOR (verslepen van andermans voorstel beslist zonder eigenaarscheck) opgelost met test; MINORs: opnieuw vragen laat voorstellen van een collega staan, geen voorstel meer op een voorbij uur vandaag; rest in worklog
