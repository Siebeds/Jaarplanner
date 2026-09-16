---
id: FB-044
titel: 'Doelen per leeftijd' op het thema toont alleen nog leerplandoelen
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 15:54
opgepakt-door: claude-fb-044
branch: ticket/FB-044-doelen-per-leeftijd
pr: 113
geblokkeerd:
fr: [FR-2.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-16: *"De leerplandoelen staan er dan onder (zoals nu via "doelen per leeftijd") maar daar
moet het minimumdoel niet meer worden weergegeven in de lijst aangezien dat erboven staat bij themadoel en ook de
counter hiernaast is dan de counter voor leerplandoelen en niet minimumdoel."*

Vandaag toont het overzicht "Doelen per leeftijd" op de themapagina (FB-009) per leeftijd de leerplandoelen én de
minimumdoelen waarnaar ze leiden, en de teller telt minimumdoelen. Zodra de minimumdoelen als themadoel bovenaan staan
(FB-043), is dat dubbel.

## Gewenst gedrag

- "Doelen per leeftijd" toont per leeftijd alleen nog **leerplandoelen**, zoals nu berekend uit wat onder het thema
  hangt, met waar elk doel voorkomt.
- De groep "Minimumdoelen" in dit overzicht verdwijnt.
- De teller naast elke leeftijd telt **leerplandoelen**.
- Een leerplandoel aanklikken opent zijn detail; daar ziet men zijn minimumdoel.

## Acceptatiecriteria

- [x] Gegeven een thema met K3-subthema's met subdoelen, wanneer de themapagina opent, dan toont "Doelen per leeftijd"
  bij K3 de leerplandoelen en geen groep minimumdoelen.
- [x] Gegeven K3 met 4 verschillende leerplandoelen, dan staat naast K3 "4 leerplandoelen".
- [x] Gegeven een leerplandoel in het overzicht, wanneer men het aanklikt, dan opent het detail met zijn minimumdoel.
- [x] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Open een thema met subthema's voor K2 en K3. Klap "Doelen per leeftijd" open.
2. Bij K2 en K3 staat een teller in leerplandoelen, en de lijst bevat alleen leerplandoelen.
3. Tel de doelen bij K3: het aantal klopt met de teller.
4. Klik een leerplandoel aan. Het detail noemt het minimumdoel.
5. Herhaal op ~390px.

## Buiten scope

- Minimumdoelen als themadoel koppelen en tonen: FB-043.
- Het overzicht bij de subthema's: dat blijft zoals het is.

## Open vragen

- ~~Hangt af van FB-043: zonder dat ticket staan de minimumdoelen van een thema nergens meer op de themapagina.~~
  **Beantwoord door de eigenaar, 2026-09-16:** FB-043 wordt eerst gebouwd, daarna dit ticket.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-16 14:27 · eigenaar · nieuw → klaar-voor-bouw: open vragen beantwoord door de eigenaar; klaar voor bouw
- 2026-09-16 15:42 · claude-fb-044 · klaar-voor-bouw → in-uitvoering: opgepakt, FB-043 staat op main
- 2026-09-16 15:48 · claude-fb-044 · gebouwd: 'Doelen per leeftijd' toont en telt alleen leerplandoelen; de server berekent de minimumdoelen niet meer; detail van een leerplandoel toont zijn minimumdoel al (Doeldetail); Vitest 981, lint, dotnet format en backendtests groen
- 2026-09-16 15:49 · claude-fb-044 · antagonist: COMPLIANT, niets anders gebruikte de weggehaalde minimumdoelen; vier MINOR
- 2026-09-16 15:53 · claude-fb-044 · in-uitvoering → te-testen: gebouwd: 'Doelen per leeftijd' toont alleen leerplandoelen met teller in leerplandoelen; browsercheck PASS op desktop en 390px (backlog/worklogs/FB-044), Vitest 981, backend unit en integratie, format en lint groen, antagonist COMPLIANT; MINOR open: ongebruikte prop minimumdoelRef in Doeldetailblad
- 2026-09-16 15:54 · claude-fb-044 · PR #113
