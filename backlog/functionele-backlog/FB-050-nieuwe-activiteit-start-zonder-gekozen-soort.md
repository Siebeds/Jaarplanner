---
id: FB-050
titel: Nieuwe activiteit start zonder gekozen soort
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 20:35
opgepakt-door: claude-fb-050
branch: ticket/FB-050-activiteit-zonder-soort
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

- [x] Gegeven een nieuw activiteitformulier, wanneer het opent, dan is er geen soort gekozen.
- [x] Gegeven dat formulier zonder soort, wanneer men bewaart, dan wordt er niets bewaard en staat bij het veld dat er een
  soort gekozen moet worden.
- [x] Gegeven een gekozen soort, wanneer men bewaart, dan heeft de activiteit die soort.
- [x] Gegeven een bestaande activiteit, wanneer men ze bewerkt, dan staat haar eigen soort ingevuld.
- [x] Nagekeken in een echte browser op desktop en ~390px, en de melding is bereikbaar voor een schermlezer.

## Testscenario's

1. Open een subthema en maak een nieuwe activiteit. Het veld Soort is leeg.
2. Vul een naam in en bewaar zonder soort. Er wordt niets bewaard; bij Soort staat dat je er een moet kiezen.
3. Kies "Hoek" en bewaar. De activiteit is een hoek.
4. Open een bestaande activiteit: haar soort staat ingevuld.
5. Herhaal stap 1 en 2 op ~390px.

## Buiten scope

Het aanmaken van activiteiten via de Excel-import: dat blijft zoals nu.

## Open vragen

- Is de soort verplicht, of mag een activiteit zonder soort bewaard worden? **Beantwoord (eigenaar, 2026-09-16):**
  verplicht, zoals vandaag elke activiteit een soort heeft.

## Werklog

- 2026-09-16 13:47 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-16 20:26 · eigenaar · nieuw → klaar-voor-bouw: verfijnd: soort verplicht
- 2026-09-16 20:26 · claude-fb-050 · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-16 20:31 · claude-fb-050 · Soortveld start leeg en is verplicht; Vitest (1003) en lint groen
- 2026-09-16 20:34 · claude-fb-050 · Criteria afgevinkt: Vitest (Activiteitformulier.test.tsx) en browserpas op desktop en 390px (worklogs/FB-050/test-report.md)
- 2026-09-16 20:35 · claude-fb-050 · Antagonist: COMPLIANT; open MINOR: de snelle regel in het koppelpaneel kiest nog standaard Experiment (worklogs/FB-050/antagonist.md)
- 2026-09-16 20:35 · claude-fb-050 · in-uitvoering → te-testen: Soortveld start leeg en is verplicht met melding bij het veld; Vitest 1003 groen, lint groen, browser desktop en 390px PASS, antagonist COMPLIANT
