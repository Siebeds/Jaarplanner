---
id: FB-048
titel: Subthema toont eerst het aantal subdoelen, dan het aantal activiteiten
soort: functioneel
status: in-uitvoering
prioriteit: laag
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 20:25
opgepakt-door: sessie-fb048
branch: ticket/FB-048-subthema-tellingen-volgorde
pr:
geblokkeerd:
fr: [FR-3.1]
---

## Aanleiding

De eigenaar merkte op 2026-09-16 in de demo-omgeving: *"bij een subthema wordt in dat blokje naast de naam ook aantal
activiteiten en aantal subdoelen getoond, verander dit van positie: eerst aantal subdoelen, dan aantal activiteiten"*.

Het subthema bouwt op vanuit zijn subdoelen; de activiteiten werken ze uit. De volgorde in het blokje zegt vandaag het
omgekeerde.

## Gewenst gedrag

- In het blokje van een subthema staat naast de naam eerst het aantal subdoelen (zoals nu, bv. "5 van 7 subdoelen in
  een activiteit"), dan het aantal activiteiten.
- Verder verandert er niets aan wat er staat.

## Acceptatiecriteria

- [ ] Gegeven een subthema met subdoelen en activiteiten, wanneer de themapagina opent, dan staat in zijn blokje de
  telling van de subdoelen vóór die van de activiteiten.
- [ ] Gegeven een subthema zonder subdoelen, dan staat "0 subdoelen" nog altijd eerst.
- [ ] Een schermlezer leest de tellingen in dezelfde volgorde als ze op het scherm staan.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Open een thema. Bij elk subthema staat naast de naam eerst de telling van de subdoelen, dan die van de activiteiten.
2. Kijk naar een subthema zonder subdoelen: "0 subdoelen" staat eerst.
3. Herhaal op ~390px.

## Buiten scope

De volgorde van de secties in een opengeklapt subthema (activiteiten, dan subdoelen): niet gevraagd.

## Open vragen

- In een opengeklapt subthema staan de activiteiten vandaag vóór de subdoelen. Moet die volgorde ook omdraaien?
  **Standaard** nee, dit ticket gaat alleen over het blokje.

## Werklog

- 2026-09-16 13:46 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-16 20:25 · eigenaar · nieuw → klaar-voor-bouw: verfijnd: open vraag standaard nee
- 2026-09-16 20:25 · sessie-fb048 · klaar-voor-bouw → in-uitvoering: opgepakt
