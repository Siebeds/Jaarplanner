---
id: FB-019
titel: Hoeken en hoekenverrijkingen krijgen doelen die meetellen voor de dekking
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:10
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-3.2, FR-9.1]
---

## Aanleiding

De eigenaar wil in de agenda de doelen van hoekenfiches en hoekenverrijkingen kunnen raadplegen (FB-018). Hoeken hebben
vandaag geen doelen: dat besliste de eigenaar op 2026-08-30, omdat de dekking toen alleen via een ingepland thema
bewezen werd.

**Beslissing van de eigenaar, 2026-09-15:** hoeken en hoekenverrijkingen krijgen **doelen, en die tellen mee voor de
dekking**. Dat vervangt de beslissing van 2026-08-30.

## Gewenst gedrag

- Een leerkracht van de klas koppelt leerplandoelen aan een hoek van haar klas en aan een verrijking (FB-020), zoals bij
  een algemene fiche. De keuze is beperkt tot de jaarfase van de klas, en elke koppeling is manueel.
- Een doel van een hoek telt mee voor de dekking van de klas zodra die hoek in haar agenda ingepland is.
- Een doel van een verrijking telt mee zodra die verrijking ingevuld is voor een subthemaperiode in de agenda van de klas.
- In het dekkingsoverzicht, het vooruitzicht en de export staat zo'n bewijs als hoek of verrijking, nooit als thema.
- Het doelenregister en de telling bij een Op.stap-herimport kennen deze koppelingen ook.

## Acceptatiecriteria

- [ ] Gegeven een hoek met een doel, ingepland in de agenda van de klas, wanneer ik de dekking van die klas open, dan is
  dat doel gedekt, met de hoek als bewijs.
- [ ] Gegeven dezelfde hoek, maar niet ingepland, dan is dat doel door de hoek niet gedekt.
- [ ] Gegeven een verrijking met een doel voor een subthemaperiode in de agenda van de klas, dan is dat doel gedekt, met
  de verrijking als bewijs.
- [ ] Gegeven een hoek van een andere klas, dan telt zijn doel niet voor deze klas.
- [ ] Gegeven de export van de dekking, dan staan hoek en verrijking erin als bewijs.
- [ ] Gegeven de keuze van een doel bij een hoek van een K2-klas, dan biedt die alleen K2-doelen.

## Testscenario's

1. Open Instellingen, Hoeken. Koppel een doel aan de bouwhoek van je klas.
2. Plan de bouwhoek in je agenda. Open de dekking: het doel is gedekt, met "hoek: bouwhoek" als bewijs.
3. Verwijder de planning. Het doel is door de hoek niet meer gedekt.
4. Vul een verrijking in voor een subthemaperiode (FB-020) en koppel er een doel aan. De dekking toont het, met de
   verrijking als bewijs.
5. Exporteer de dekking. Hoek en verrijking staan erin.

## Buiten scope

- AI die doelen bij een hoek voorstelt.
- Doelen per dag of per hoekmoment.

## Open vragen

- **Grondwet:** Art. V.1 zegt vandaag welke koppelingen meetellen (een ingepland thema en een ingeplande algemene fiche).
  Die wijziging (Art. XI), en de aanpassing van het hoekmodel in Art. IX.2, horen bij de bouw van dit ticket, vóór de code.
- Neemt het kopiëren van een hoek naar een andere klas zijn doelen mee? **Standaard** ja.
- Hangt voor de verrijkingen af van FB-020.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
