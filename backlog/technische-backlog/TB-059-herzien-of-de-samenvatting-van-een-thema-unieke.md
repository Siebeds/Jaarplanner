---
id: TB-059
titel: Herzien of de samenvatting van een thema unieke doelen telt in plaats van koppelingen
soort: technisch
status: nieuw
prioriteit: laag
aangemaakt: 2026-09-22
bijgewerkt: 2026-09-22 00:48
opgepakt-door:
branch:
pr: 150
geblokkeerd:
fr: []
---

## Aanleiding

TB-039 (PR 148) heeft het label van de samenvatting bovenaan een thema van "Doelen" naar
"Doelkoppelingen" gebracht, omdat de drie getallen koppelingen tellen en niet verschillende
leerplandoelen. Hangt hetzelfde leerplandoel onder twee subthema's, of aan twee activiteiten, dan
telt het twee keer. In de mockdata zegt "Herfst in het bos" 18 op subthema's, terwijl je er 17 telt
als je de subthema's openklapt: `4.2.GK3.81` staat onder "Paddenstoelen en bladeren" en onder
"Wind en regen".

De eigenaar koos die tekstoplossing bewust als eerste stap, maar wil later beslissen of de
samenvatting toch **unieke doelen** moet tellen. Voor een leerkracht is "hoeveel verschillende doelen
raakt dit thema" mogelijk de nuttigere vraag dan "hoeveel koppelingen liggen er".

## Voorgestelde wijziging

Te beslissen door de eigenaar, daarna te bouwen. Als de keuze unieke doelen wordt:

- `themabalans` (`frontend/src/features/themas/themabalans.ts`) telt per niveau verschillende
  leerplandoelcodes in plaats van rijen, en het label gaat terug naar "Doelen".
- Dan moet `totaal` uit elkaar: dat getal vult vandaag ook `themabeheer.verwijderGevolg`
  ("Hiermee verdwijnen ook {subthemas} subthema's en {doelen} gekoppelde doelen"), en die zin gaat
  over wat er verdwijnt, dus over rijen. De verwijderbevestiging heeft dan een eigen telling nodig.
- De tests van TB-039 in `themabalans.test.ts` en `ThemadetailScherm.test.tsx` leggen het huidige
  gedrag vast en moeten mee omgedraaid worden.

Let op: `totaal` is vandaag al niet precies het aantal rijen dat een delete meeneemt. Onbesliste
activiteitkoppelingen tellen hier niet mee en verdwijnen wel. Wie dit oppakt, kiest meteen wat dat
getal moet zijn.

## Acceptatiecriteria

- [ ] De eigenaar heeft beslist: unieke doelen of koppelingen. Het besluit staat in dit ticket.
- [ ] Bij de keuze "unieke doelen": gegeven een thema waarin een leerplandoel onder twee subthema's
  hangt, dan telt de samenvatting het één keer, en komt het getal overeen met wat je telt als je de
  subthema's openklapt.
- [ ] Bij de keuze "unieke doelen": de verwijderbevestiging noemt nog steeds een getal dat klopt met
  wat er werkelijk verdwijnt.
- [ ] Bij de keuze "koppelingen": dit ticket wordt gesloten zonder codewijziging, met de reden erin.
- [ ] De frontendtests dekken het gekozen gedrag.

## Buiten scope

"Doelen per leeftijd" op dezelfde pagina. Dat blok telt sinds TB-048 de leerplandoelen van de
gekozen minimumdoelen, gekoppeld of niet, en staat los van deze telling. De dekking (Art. V.1).

## Open vragen

- Unieke doelen of koppelingen? Dit is de beslissing waarvoor dit ticket bestaat.
- Als het unieke doelen worden: uniek per niveau (een doel dat zowel op een subthema als op een
  activiteit hangt, telt in beide delen) of uniek over de drie niveaus samen?

## Werklog

- 2026-09-22 00:03 · claude-tb-039 · aangemaakt (status nieuw)
- 2026-09-22 00:48 · claude-tb-039 · PR #150
