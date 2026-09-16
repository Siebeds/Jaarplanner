---
id: FB-049
titel: AI stelt leerplandoelen voor bij het aanmaken van een activiteit
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 13:47
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-4.1, FR-4.2, FR-4.3]
---

## Aanleiding

De eigenaar vroeg op 2026-09-16: *"bij het aanmaken van een nieuwe activiteit, moet men ook de mogelijkheid krijgen om
suggesties te krijgen van AI over welke leerplandoelen voor die leeftijd horen bij die activiteit."*

Vandaag kiest wie een activiteit aanmaakt haar doelen met de hand. FB-026 laat de AI doelen zoeken bij een activiteit
die al bestaat; dit ticket doet hetzelfde in het formulier van een nieuwe activiteit, voor ze bewaard is.

## Gewenst gedrag

- In het formulier van een nieuwe activiteit staat bij de doelen een AI-knop "Stel doelen voor", voor wie doelen mag
  koppelen aan activiteiten van die leeftijd.
- De AI krijgt wat al ingevuld is (naam, soort, beschrijving en de andere velden) en de leerplandoelen van de leeftijd
  van het subthema, en stelt hoogstens het ingestelde aantal doelen voor, elk met een korte motivatie. De regels zijn
  die van FB-026: standaard hoogstens 5, opnieuw vragen mag, en een geweigerd doel komt niet terug.
- Per voorstel: aanvaarden of weigeren. Een aanvaard doel komt bij de doelen die met de activiteit bewaard worden.
- Bij het bewaren worden de voorstellen met hun motivatie en de beslissing mee bewaard.
- Zonder ingevulde naam kan er niets gevraagd worden, en dat staat erbij.

## Acceptatiecriteria

- [ ] Gegeven een nieuwe K2-activiteit met een naam, wanneer "Stel doelen voor" aangeklikt wordt, dan komen er hoogstens
  5 voorstellen, allemaal K2-leerplandoelen, elk met een motivatie.
- [ ] Gegeven twee aanvaarde en één geweigerd voorstel, wanneer de activiteit bewaard wordt, dan draagt ze de twee
  aanvaarde doelen, en het geweigerde niet.
- [ ] Gegeven dat geweigerde voorstel, wanneer opnieuw gevraagd wordt, dan komt het niet terug, net als de doelen die al
  gekozen zijn.
- [ ] Gegeven iemand die geen doelen mag koppelen aan activiteiten van die leeftijd, dan staat de knop er niet en weigert
  de server de vraag.
- [ ] Gegeven een modelantwoord met een code die geen leerplandoel van die leeftijd is, dan wordt ze niet getoond.
- [ ] De logica is getest met een nep-AI-client, en het formulier nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Meld aan als hoofdleerkracht van K2. Open een K2-subthema en maak een nieuwe activiteit; vul een naam in.
2. Klik "Stel doelen voor". Je krijgt hoogstens vijf K2-doelen, elk met een motivatie.
3. Aanvaard er twee en weiger er een. De twee staan bij de doelen van het formulier.
4. Vraag opnieuw. Het geweigerde en de twee aanvaarde komen niet terug.
5. Bewaar. Open de activiteit: ze draagt de twee aanvaarde doelen.
6. Maak als leerkracht zonder recht om doelen te koppelen een activiteit: de knop staat er niet.
7. Herhaal stap 1 tot 3 op ~390px.

## Buiten scope

- Doelen zoeken bij een bestaande activiteit: FB-026.
- De lijst van subdoelen om aan te vinken in het formulier: FB-051.

## Open vragen

- **Bewaren van voorstellen bij een activiteit die nog niet bestaat.** De grondwet (Art. IV.1) vraagt dat elk voorstel
  met zijn motivatie bewaard wordt. **Standaard** worden de voorstellen en beslissingen bewaard samen met de activiteit;
  wie het formulier sluit zonder te bewaren, bewaart niets. Is dat goed?
- **Wordt een aanvaard doel dat geen subdoel is ook voorgesteld als subdoel van het subthema, zoals in FB-026?**
  **Standaard** ja, zoals FB-026.
- **Wie mag vragen?** Vandaag koppelen alleen de hoofdleerkracht en de directie doelen aan een gedeelde activiteit.
  Met FB-015 koppelt een leerkracht ook doelen aan haar eigen activiteit. **Standaard** dezelfde rechten als het
  koppelen zelf.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI.

## Werklog

- 2026-09-16 13:47 · demo-opmerkingen · aangemaakt (status nieuw)
