---
id: TB-023
titel: AI-knoppen krijgen een eigen regenboogstijl, zodat je ziet dat AI meewerkt
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 16:49
opgepakt-door: ai-knoppen
branch: ticket/TB-023-ai-knoppen
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar wil dat een leerkracht of de directie aan de knop zelf ziet dat die de AI aanroept, zoals Apple dat doet
met een regenboogachtige stijl. Vandaag ziet "Genereren" in het jaarplan eruit als elke andere hoofdknop, en "Vraag
suggesties" op de themapagina als een stille knop met een toverstokje. Wie op zo'n knop drukt, weet dus niet op
voorhand dat wat volgt een voorstel van de AI is en geen vaststaand resultaat (Art. IV).

## Voorgestelde wijziging

- Eén nieuwe knopstijl voor elke knop die de AI aanroept: een rand in een regenboogverloop rond een gewone kaartknop
  met inkttekst, altijd met het toverstokicoon ervoor. Bij hover verschijnt een zachte gloed; zolang de AI bezig is,
  schuift het verloop rond de knop. Bij "minder beweging" staat die animatie stil.
- In de code: een component `AiKnop` in `frontend/src/components/ui/Knop.tsx`, een rang `ai` in `knopklassen.ts`, de
  kleurtokens `--color-ai-*` met een donkere waarde en een utility `knop-ai` in `frontend/src/index.css`.
- Toegepast op de drie AI-knoppen die er vandaag zijn: "Genereren" en "Genereer" in `PlanScherm.tsx`, "Vraag
  suggesties" in `ThemadetailScherm.tsx`.
- Vastgelegd in een nieuwe ADR-0039, die beslissing 4 van ADR-0024 (geen merkkleur, één accent) aanvult: het verloop is
  voorbehouden aan AI-knoppen. `CLAUDE.md` en de uitleg bovenaan `index.css` zeggen de regel zoals hij nu geldt.

## Acceptatiecriteria

- [ ] Gegeven het jaarplan van een klas die ik mag plannen, wanneer ik het scherm open, dan hebben "Genereren" en in
      het venster "Genereer" een regenboogrand en een toverstokicoon.
- [ ] Gegeven een thema en het recht om doelsuggesties te maken, wanneer ik de themapagina open, dan heeft "Vraag
      suggesties" dezelfde regenboogrand en hetzelfde icoon.
- [ ] Gegeven een AI-knop, wanneer de AI bezig is, dan beweegt het verloop rond de knop en meldt de knop zich als
      bezig (`aria-busy`); met "minder beweging" aan staat het verloop stil.
- [ ] Gegeven een AI-knop, wanneer ik de kleuren meet in een echte browser, dan haalt elke kleur van de rand 3:1
      tegen de kaart en de pagina, en de tekst 4,5:1, in de lichte en in de donkere weergave.
- [ ] Gegeven een knop die de AI niet aanroept, dan ziet die er ongewijzigd uit.

## Buiten scope

Knoppen voor AI-functies die nog niet gebouwd zijn (FB-004, FB-024 tot FB-028, FB-030 tot FB-032): die gebruiken
`AiKnop` wanneer ze gebouwd worden. De voorstellen van de AI zelf (de gekoppelde doelen met status voorgesteld)
krijgen geen regenboog: hun kleur blijft de suggestiestatus.

## Open vragen

Geen.

## Werklog

- 2026-09-15 16:49 · ai-knoppen · aangemaakt (status in-uitvoering)
