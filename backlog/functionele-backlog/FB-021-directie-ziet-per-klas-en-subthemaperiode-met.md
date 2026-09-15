---
id: FB-021
titel: Directie ziet per klas en subthemaperiode met welke verrijkingen de hoeken liepen
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:10
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-12.3]
---

## Aanleiding

De eigenaar zei op 2026-09-15 bij de hoekenverrijkingen (FB-020): *"de directie moet wel kunnen zien met welke
verrijkingen ze de hoeken hebben gedaan in die subthema periode"*.

Een verrijking is geen blok in de agenda, dus de directie ziet ze niet door de agenda te bekijken.

## Gewenst gedrag

- De directie opent een overzicht van de hoekenverrijkingen.
- Ze kiest een schooljaar en een klas (of alle klassen).
- Per subthemaperiode (subthema, van, tot) ziet ze per hoek de verrijking die de klas invulde, en welke hoeken leeg
  bleven.
- Het overzicht is alleen-lezen.

## Acceptatiecriteria

- [ ] Gegeven een klas met verrijkingen in twee subthemaperiodes, wanneer de directie het overzicht voor die klas opent,
  dan ziet ze per periode per hoek de verrijking.
- [ ] Gegeven een hoek zonder verrijking in een periode, dan staat hij erbij als leeg.
- [ ] Gegeven de keuze "alle klassen", dan staan de klassen onder elkaar, elk met hun periodes.
- [ ] Gegeven een leerkracht zonder directierecht, dan krijgt ze dit overzicht niet te zien (zie Open vragen).
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Vul als leerkracht van een K2-klas verrijkingen in voor twee subthemaperiodes (FB-020).
2. Meld aan als directie en open het overzicht van de hoekenverrijkingen. Kies het schooljaar en de K2-klas.
3. Je ziet twee periodes, met per hoek de tekst, en de hoeken zonder verrijking als leeg.
4. Kies alle klassen. Elke klas staat erbij.
5. Meld aan als leerkracht zonder directierecht. Het overzicht is er niet.

## Buiten scope

- Een export van het overzicht.
- Verrijkingen wijzigen vanuit het overzicht.

## Open vragen

- Waar staat het overzicht: bij Instellingen, of bij een klas? Te beslissen in de ontwerpstap.
- Mag een hoofdleerkracht het ook zien voor haar jaarfase, of iedereen die de klas mag inkijken (FB-013)? **Standaard**
  alleen de directie, zoals gevraagd.
- Hangt af van FB-020.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
