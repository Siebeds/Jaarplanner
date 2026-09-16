---
id: FB-050
titel: Nieuwe activiteit start zonder gekozen soort
soort: functioneel
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 13:47
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-3.1]
---

## Aanleiding

De eigenaar merkte op 2026-09-16 in de demo-omgeving: *"bij het aanmaken van een nieuwe activiteit, moet de soort niet
standaard op Experiment staan maar leeg"*.

Vandaag staat de soort van een nieuwe activiteit vooraf op "Experiment". Wie ze niet aanpast, bewaart een activiteit
met een soort die ze nooit koos.

## Gewenst gedrag

- In het formulier van een nieuwe activiteit is de soort leeg, met een neutrale tekst als "Kies een soort".
- De soort is verplicht: wie zonder soort bewaart, krijgt bij het veld te lezen dat ze nog een soort moet kiezen, en er
  wordt niets bewaard.
- Een bestaande activiteit openen toont haar soort zoals nu.

## Acceptatiecriteria

- [ ] Gegeven een nieuw activiteitformulier, wanneer het opent, dan is er geen soort gekozen.
- [ ] Gegeven dat formulier zonder soort, wanneer men bewaart, dan wordt er niets bewaard en staat bij het veld dat er een
  soort gekozen moet worden.
- [ ] Gegeven een gekozen soort, wanneer men bewaart, dan heeft de activiteit die soort.
- [ ] Gegeven een bestaande activiteit, wanneer men ze bewerkt, dan staat haar eigen soort ingevuld.
- [ ] Nagekeken in een echte browser op desktop en ~390px, en de melding is bereikbaar voor een schermlezer.

## Testscenario's

1. Open een subthema en maak een nieuwe activiteit. Het veld Soort is leeg.
2. Vul een naam in en bewaar zonder soort. Er wordt niets bewaard; bij Soort staat dat je er een moet kiezen.
3. Kies "Hoek" en bewaar. De activiteit is een hoek.
4. Open een bestaande activiteit: haar soort staat ingevuld.
5. Herhaal stap 1 en 2 op ~390px.

## Buiten scope

Het aanmaken van activiteiten via de Excel-import: dat blijft zoals nu.

## Open vragen

- Is de soort verplicht, of mag een activiteit zonder soort bewaard worden? **Standaard** verplicht: vandaag heeft elke activiteit een soort.

## Werklog

- 2026-09-16 13:47 · demo-opmerkingen · aangemaakt (status nieuw)
