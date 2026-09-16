---
id: FB-044
titel: 'Doelen per leeftijd' op het thema toont alleen nog leerplandoelen
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 13:46
opgepakt-door:
branch:
pr:
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

- [ ] Gegeven een thema met K3-subthema's met subdoelen, wanneer de themapagina opent, dan toont "Doelen per leeftijd"
  bij K3 de leerplandoelen en geen groep minimumdoelen.
- [ ] Gegeven K3 met 4 verschillende leerplandoelen, dan staat naast K3 "4 leerplandoelen".
- [ ] Gegeven een leerplandoel in het overzicht, wanneer men het aanklikt, dan opent het detail met zijn minimumdoel.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

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

- Hangt af van FB-043: zonder dat ticket staan de minimumdoelen van een thema nergens meer op de themapagina. Bouw dit
  ticket dus samen met of na FB-043.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
