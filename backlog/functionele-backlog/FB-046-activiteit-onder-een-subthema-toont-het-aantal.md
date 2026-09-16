---
id: FB-046
titel: Activiteit onder een subthema toont het aantal doelen, niet hun codes
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 13:46
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-3.2]
---

## Aanleiding

De eigenaar merkte op 2026-09-16 in de demo-omgeving: *"bij de activiteit onder een subthema moet de code van de
gelinkte doelen niet zichtbaar zijn in het overzicht, enkel de aantal doelen is voldoende, men kan dan wel doorklikken
om te zien welke doelen"*.

Vandaag toont elke activiteit in de lijst onder een subthema de codes van haar doelen. Met meerdere doelen per
activiteit wordt de lijst lang en onrustig.

## Gewenst gedrag

- Een activiteit in de lijst onder een subthema toont het **aantal** doelen ("3 doelen", "1 doel"), geen codes.
- Een activiteit zonder doel blijft herkenbaar als "zonder doel", zoals nu.
- Wie de activiteit opent, ziet daar de doelen met code en tekst, zoals nu.

## Acceptatiecriteria

- [ ] Gegeven een activiteit met drie doelen, wanneer het subthema openstaat, dan staat bij die activiteit "3 doelen"
  en geen enkele doelcode.
- [ ] Gegeven een activiteit met één doel, dan staat er "1 doel".
- [ ] Gegeven een activiteit zonder doel, dan is ze nog herkenbaar als zonder doel, met tekst of icoon.
- [ ] Gegeven die activiteit, wanneer men ze aanklikt, dan ziet men haar doelen met code en tekst.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Open een thema en klap een subthema met activiteiten open.
2. Bij elke activiteit staat het aantal doelen; er staat nergens een doelcode in de lijst.
3. Klik een activiteit met doelen aan. Het blad toont haar doelen met code en tekst.
4. Zoek een activiteit zonder doel: ze is herkenbaar als zonder doel.
5. Herhaal op ~390px.

## Buiten scope

- Doelen koppelen vanuit de lijst: dat gebeurt in het blad van de activiteit.
- De lijst van subdoelen van het subthema (FB-010): die blijft doelen tonen.

## Open vragen

- Vandaag kan een hoofdleerkracht rechtstreeks in de regel van een activiteit een doel koppelen. **Standaard** blijft
  die knop staan, alleen de codes verdwijnen.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
