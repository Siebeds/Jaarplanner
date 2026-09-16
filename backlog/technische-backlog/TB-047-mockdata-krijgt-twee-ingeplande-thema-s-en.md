---
id: TB-047
titel: Mockdata krijgt twee ingeplande thema's en afwisselende activiteiten
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-17 00:09
opgepakt-door: mockdata-rijker
branch: ticket/mockdata-rijker
pr: 127
geblokkeerd:
fr: []
---

## Aanleiding

De mockmodus van TB-046 is niet realistisch genoeg. Een kleuterjuf doet niet elke dag dezelfde activiteiten, maar in
de nepdata keren per week zes activiteiten telkens terug. Er is ook maar één thema, met weinig doelen, en de weken van
de subthema's tellen niet op tot de duur van het thema. De eigenaar vroeg dit op 2026-09-16. Bouwt verder op de branch
van TB-046 (`ticket/frontend-mockmodus`).

## Voorgestelde wijziging

Alleen de vaste inhoud in `frontend/src/mocks/` verandert, plus het rooster van de mock.

- **Thema 1** (4 weken) loopt van maandag 16 november tot en met vrijdag 11 december 2026.
- **Thema 2** (4 weken) start de week erna: 14 tot en met 18 december, en na de kerstvakantie 4 tot en met 22 januari 2027.
  Op `main` hangt een thema aan één themaperiode, dus het thema staat in twee periodes van het mockrooster (1 en 3 weken).
- **Per thema tellen de weken van de subthema's op tot de duur van het thema** (4 weken), met subthema's van 1 of 2
  weken, en elk subthema heeft een subthemaperiode in de agenda.
- **Meer doelen:** meer minimumdoelen en leerplandoelen, over meer leergebieden, allemaal verzonnen zoals in TB-046.
- **Meer activiteiten:** genoeg per subthema zodat een dag geen activiteit twee keer heeft en twee opeenvolgende
  schooldagen niet dezelfde reeks tonen.
- **De volle agenda blijft 16 tot en met 27 november** (keuze van de eigenaar).

## Acceptatiecriteria

- [x] Gegeven de mockmodus, dan staan er twee thema's van 4 weken in het jaarplan: het eerste van 16 november tot en met 11 december, het tweede op 14 tot en met 18 december en 4 tot en met 22 januari.
- [x] Gegeven elk thema, dan tellen de weken van zijn subthema's op tot 4, en valt elke subthemaperiode binnen de periode van haar thema.
- [x] Gegeven de agenda van 16 tot en met 27 november, dan heeft geen dag een activiteit twee keer, en tonen twee opeenvolgende schooldagen nooit dezelfde activiteiten; de uren blijven 8u30 tot 15u30 met de middagpauze vrij en woensdag alleen de voormiddag.
- [x] Gegeven de mockmodus, dan zijn er meer minimumdoelen en leerplandoelen dan in TB-046, elk subdoel wordt door minstens één activiteit van zijn subthema gedragen, en `pnpm lint`, `pnpm test` en `pnpm build` zijn groen.

## Buiten scope

- Een volle agenda buiten 16 tot en met 27 november.
- Een thema met eigen begin- en einddatum: dat komt met FB-035, en de mock volgt dan het nieuwe contract.

## Open vragen

Geen. De eigenaar koos op 2026-09-16: thema 1 van 16 november tot en met 11 december, thema 2 een week voor en drie
weken na de kerstvakantie, en een volle agenda alleen van 16 tot en met 27 november.

## Werklog

- 2026-09-16 23:52 · mockdata-rijker · aangemaakt (status in-uitvoering)
- 2026-09-16 23:59 · mockdata-rijker · inhoud herschreven: 2 thema's (16 nov-11 dec; 14-18 dec + 4-22 jan), 6 subthema's (1+1+2 en 1+2+1 weken), 10 minimumdoelen, 26 leerplandoelen, 50 activiteiten; routes.test.ts dekt alle criteria, screenshots van week 23 nov, december, januari en thema's per periode; lint, 1017 tests en build groen; beperking: 'thema's per periode' telt thema 2 twee keer tot FB-035
- 2026-09-17 00:01 · mockdata-rijker · antagonist: COMPLIANT; MINOR opgelost: commentaar noemt de te korte mockperiodes, BLOKINDELING zegt dat het een mockrooster is; MINOR open: elke plaatsing van thema 2 toont 4 weken ook in de periode van 1 week, en een handmatige plaatsing telt altijd de volle themaduur (beide tot FB-035)
- 2026-09-17 00:01 · mockdata-rijker · in-uitvoering → klaar: rijkere mockdata klaar: 2 ingeplande thema's, subthemaweken tellen op, afwisselende activiteiten; lint, 1017 tests en build groen, antagonist COMPLIANT
- 2026-09-17 00:09 · mockdata-rijker · PR #127
