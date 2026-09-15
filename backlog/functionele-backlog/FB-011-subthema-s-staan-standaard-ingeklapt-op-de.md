---
id: FB-011
titel: Subthema's staan standaard ingeklapt op de themapagina
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:09
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-3.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"standaard subthema's ingeklapt op thema pagina"*.

Vandaag staan alle subthema's open wanneer je een thema opent. Bij een thema met subthema's voor drie leeftijden wordt de
pagina lang, en wie één subthema zoekt, moet ver scrollen.

## Gewenst gedrag

- Wie een thema opent, ziet alle subthema's ingeklapt, elk met zijn samenvatting (naam, leeftijd, duur en de tellingen die
  een ingeklapt subthema nu al toont).
- Een klik op een subthema klapt het open; een tweede klik klapt het weer in.
- Openklappen werkt ook met het toetsenbord.

## Acceptatiecriteria

- [ ] Gegeven een thema met meerdere subthema's, wanneer ik de themapagina open, dan zijn alle subthema's ingeklapt en
  toont elk zijn samenvatting.
- [ ] Gegeven een ingeklapt subthema, wanneer ik erop klik of het met Enter of Spatie activeer, dan klapt het open, en
  bij een tweede keer weer in.
- [ ] Gegeven een ander thema, wanneer ik dat open, dan zijn ook daar alle subthema's ingeklapt.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Open een thema met subthema's. Alles staat ingeklapt.
2. Klik op één subthema. Alleen dat subthema klapt open.
3. Klik er opnieuw op. Het klapt in.
4. Ga met Tab naar een subthema en druk op Enter. Het klapt open.
5. Open een ander thema. Alles staat weer ingeklapt.

## Buiten scope

Niets.

## Open vragen

- Moet de tool onthouden welk subthema je openklapte, bv. tot je de pagina verlaat? **Standaard** niet: elke keer
  ingeklapt.

## Werklog

- 2026-09-15 14:09 · wensen-tickets · aangemaakt (status nieuw)
