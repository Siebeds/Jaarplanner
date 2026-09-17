---
id: TB-052
titel: Generatierapport voorspelt de dekking van minimumdoelen in plaats van leerplandoelen
soort: technisch
status: klaar
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-17 08:59
opgepakt-door: claude-53c162c3
branch: ticket/TB-052-vooruitzicht-minimumdoelen
pr: 138
geblokkeerd:
fr: []
---

## Aanleiding

Na het genereren van een jaarplan toont het rapport hoeveel doelen gedekt zijn, en hoeveel er gedekt zouden zijn "als
je het plan aanvaardt" (`Dekkingsvooruitzicht`, `DekkingService.BerekenVooruitzichtAsync`, en het voortgangsendpoint).
Die telling gaat over leerplandoelen. Sinds FB-053 (ADR-0052) verandert het inplannen van een thema de dekking van
leerplandoelen niet meer: een thema dekt alleen minimumdoelen, via zijn themadoelen. Daarom is het cijfer "als je het
plan aanvaardt" nu altijd gelijk aan het huidige cijfer (`mogelijkGedekt = nuGedekt`), en zegt het rapport niets.

De eigenaar besliste op 2026-09-16 dat de voorspelling voortaan minimumdoelen telt, in een apart ticket.

## Voorgestelde wijziging

- `BerekenVooruitzichtAsync` telt de **minimumdoelen** van de mijlpaal van de klas: hoeveel er nu gedekt zijn en hoeveel
  er gedekt zouden zijn als de voorgestelde themaplaatsingen aanvaard worden (via de themadoelen van die thema's, zoals
  Art. V.1 rekent).
- `Dekkingsvooruitzicht` en het voortgangsendpoint benoemen dat het om minimumdoelen gaat. De tekst in het rapport
  (`nl.json`) zegt "minimumdoelen".
- Code: `Application/Dekking` (`DekkingService`, `Dekkingsvooruitzicht`), `Api/Controllers/DekkingController.cs`, het
  generatierapport in de frontend, en de tests.

## Acceptatiecriteria

- [x] Gegeven een klas zonder ingeplande thema's en een voorgesteld plan met een thema dat drie minimumdoelen van de
  mijlpaal van de klas als themadoel heeft, wanneer het rapport verschijnt, dan is "als je het plan aanvaardt" drie
  hoger dan het huidige cijfer.
- [x] Gegeven een thema waarvan de minimumdoelen al gedekt zijn door een ander ingepland thema, wanneer het voorgesteld
  wordt, dan telt het die doelen niet dubbel.
- [ ] Gegeven het rapport, dan zegt de tekst dat het om minimumdoelen gaat.
- [x] `dotnet test`, `dotnet format` en `pnpm lint` zijn groen.

## Buiten scope

- De dekking van leerplandoelen via subthema's in het rapport.
- Het dekkingsoverzicht zelf.

## Open vragen

Geen.

## Werklog

- 2026-09-16 23:50 · eigenaar · aangemaakt (status nieuw)
- 2026-09-17 08:29 · claude-53c162c3 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-17 08:30 · claude-53c162c3 · geblokkeerd: Het generatierapport bestaat niet meer in de frontend; de enige lezer van het voortgang-endpoint is de Dekkingsbalk boven de agenda (leerplandoelen). Moet de balk mee naar minimumdoelen, of komen de minimumdoelcijfers naast de leerplandoelcijfers?
- 2026-09-17 08:34 · claude-53c162c3 · niet langer geblokkeerd
- 2026-09-17 08:35 · claude-53c162c3 · besluit eigenaar: naast elkaar. De balk blijft leerplandoelen tonen, het endpoint krijgt minimumdoelcijfers erbij, het leerplandoelcijfer na aanvaarding vervalt; geen rapporttekst zolang er geen rapportscherm is (criterium 3 wacht op de herwerkte generatie)
- 2026-09-17 08:47 · claude-53c162c3 · gebouwd: het voortgang-endpoint telt de minimumdoelen nu en na aanvaarding, de balk houdt leerplandoelen; criteria 1 en 2 afgevinkt met DekkingsvooruitzichtTests en DekkingsvooruitzichtPostgresTests; unit 2104 groen, dekking-integratie 52 groen, format en lint schoon; antagonist loopt
- 2026-09-17 08:48 · claude-53c162c3 · volledige integratiesuite groen (573 geslaagd, 1 overgeslagen); criterium 4 afgevinkt
- 2026-09-17 08:50 · claude-53c162c3 · antagonist: COMPLIANT, geen blokkerende bevindingen; MINOR 1 (samenvatting record) en 3 (mock toont geen plafond naast een leeg cijfer) opgelost; MINOR 2 (een vervallen plaatsing is niet apart te tonen in het plafond omdat alle cijfers dan leeg zijn) blijft als notitie
- 2026-09-17 08:50 · claude-53c162c3 · in-uitvoering → klaar: gebouwd: voortgang-endpoint met minimumdoelvooruitzicht naast het leerplandoelcijfer van de balk; unit 2104, integratie 573, vitest 1189 groen, format en lint schoon, antagonist COMPLIANT; criterium 3 wacht op besluit eigenaar tot er weer een rapportscherm is
- 2026-09-17 08:59 · claude-53c162c3 · PR #138
