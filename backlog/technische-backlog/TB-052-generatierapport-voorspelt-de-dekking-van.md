---
id: TB-052
titel: Generatierapport voorspelt de dekking van minimumdoelen in plaats van leerplandoelen
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-17 08:30
opgepakt-door: claude-53c162c3
branch: ticket/TB-052-vooruitzicht-minimumdoelen
pr:
geblokkeerd: Het generatierapport bestaat niet meer in de frontend; de enige lezer van het voortgang-endpoint is de Dekkingsbalk boven de agenda (leerplandoelen). Moet de balk mee naar minimumdoelen, of komen de minimumdoelcijfers naast de leerplandoelcijfers?
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

- [ ] Gegeven een klas zonder ingeplande thema's en een voorgesteld plan met een thema dat drie minimumdoelen van de
  mijlpaal van de klas als themadoel heeft, wanneer het rapport verschijnt, dan is "als je het plan aanvaardt" drie
  hoger dan het huidige cijfer.
- [ ] Gegeven een thema waarvan de minimumdoelen al gedekt zijn door een ander ingepland thema, wanneer het voorgesteld
  wordt, dan telt het die doelen niet dubbel.
- [ ] Gegeven het rapport, dan zegt de tekst dat het om minimumdoelen gaat.
- [ ] `dotnet test`, `dotnet format` en `pnpm lint` zijn groen.

## Buiten scope

- De dekking van leerplandoelen via subthema's in het rapport.
- Het dekkingsoverzicht zelf.

## Open vragen

Geen.

## Werklog

- 2026-09-16 23:50 · eigenaar · aangemaakt (status nieuw)
- 2026-09-17 08:29 · claude-53c162c3 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
- 2026-09-17 08:30 · claude-53c162c3 · geblokkeerd: Het generatierapport bestaat niet meer in de frontend; de enige lezer van het voortgang-endpoint is de Dekkingsbalk boven de agenda (leerplandoelen). Moet de balk mee naar minimumdoelen, of komen de minimumdoelcijfers naast de leerplandoelcijfers?
