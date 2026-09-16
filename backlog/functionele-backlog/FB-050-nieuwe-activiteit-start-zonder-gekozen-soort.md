---
id: FB-050
titel: Nieuwe activiteit start zonder gekozen soort
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 21:42
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

- In het formulier van een nieuwe activiteit is de soort leeg, met de neutrale tekst "Geen soort".
- Ook de snelle regel "Nieuwe activiteit" in het koppelpaneel van het doelenregister start zonder soort.
- De soort is optioneel: wie zonder soort bewaart, bewaart een activiteit zonder soort. Nergens wordt een lege soort
  stil "Experiment", ook niet in de backend.
- Een activiteit zonder soort toont nergens een soort (geen lege scheiding, geen "Experiment").
- Een bestaande activiteit openen toont haar soort zoals nu, en haar soort kan weer leeg gemaakt worden.

## Acceptatiecriteria

- [ ] Gegeven een nieuw activiteitformulier, wanneer het opent, dan is er geen soort gekozen.
- [ ] Gegeven dat formulier zonder soort, wanneer men bewaart, dan wordt de activiteit bewaard zonder soort.
- [ ] Gegeven een gekozen soort, wanneer men bewaart, dan heeft de activiteit die soort.
- [ ] Gegeven een bestaande activiteit, wanneer men ze bewerkt, dan staat haar eigen soort ingevuld, en kan men die
  leeg maken.
- [ ] Gegeven de snelle regel in het koppelpaneel, wanneer ze opent, dan is er geen soort gekozen, en maken zonder
  soort geeft een activiteit zonder soort.
- [ ] Gegeven een aanvraag aan de backend zonder soort, dan wordt de activiteit bewaard zonder soort, nooit als
  Experiment.
- [ ] Gegeven een activiteit zonder soort, dan tonen de schermen die de soort van een activiteit tonen geen soort voor
  haar.
- [ ] Nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Open een subthema en maak een nieuwe activiteit. Het veld Soort is leeg.
2. Vul een naam in en bewaar zonder soort. De activiteit staat in de lijst, zonder soort.
3. Maak er nog een, kies "Hoek" en bewaar. De activiteit is een hoek.
4. Open de hoek-activiteit: haar soort staat ingevuld. Maak de soort leeg en bewaar: ze heeft geen soort meer.
5. Open het doelenregister, open het koppelpaneel van een doel en kies "Nieuwe activiteit": de soort is leeg; maak ze.
6. Herhaal stap 1 en 2 op ~390px.

## Buiten scope

Het aanmaken van activiteiten via de Excel-import: dat blijft zoals nu (daar blijft de soort verplicht).

## Open vragen

- Is de soort verplicht, of mag een activiteit zonder soort bewaard worden? **Beantwoord (eigenaar, 2026-09-16):**
  eerst verplicht; na de eerste bouw herzien: optioneel. Een lege soort blijft leeg en wordt nooit stil "Experiment".
  Dat wijzigt Art. IX van de grondwet: `activiteitType` wordt optioneel.

## Werklog

- 2026-09-16 13:47 · demo-opmerkingen · aangemaakt (status nieuw)
- 2026-09-16 20:26 · eigenaar · nieuw → klaar-voor-bouw: verfijnd: soort verplicht
- 2026-09-16 20:26 · claude-fb-050 · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-16 20:31 · claude-fb-050 · Soortveld start leeg en is verplicht; Vitest (1003) en lint groen
- 2026-09-16 20:34 · claude-fb-050 · Criteria afgevinkt: Vitest (Activiteitformulier.test.tsx) en browserpas op desktop en 390px (worklogs/FB-050/test-report.md)
- 2026-09-16 20:35 · claude-fb-050 · Antagonist: COMPLIANT; open MINOR: de snelle regel in het koppelpaneel kiest nog standaard Experiment (worklogs/FB-050/antagonist.md)
- 2026-09-16 20:35 · claude-fb-050 · in-uitvoering → te-testen: Soortveld start leeg en is verplicht met melding bij het veld; Vitest 1003 groen, lint groen, browser desktop en 390px PASS, antagonist COMPLIANT
- 2026-09-16 21:29 · eigenaar · te-testen → klaar-voor-bouw: teruggestuurd: ook het koppelpaneel niet standaard op Experiment; de backend maakt nooit stil Experiment, een lege soort blijft leeg (soort optioneel)
- 2026-09-16 21:29 · claude-fb-050 · klaar-voor-bouw → in-uitvoering: opnieuw opgepakt met de uitbreiding van de eigenaar
- 2026-09-16 21:42 · claude-fb-050 · Soort optioneel gebouwd: formulier, koppelpaneel, backend (nullable kolom, migratie ActiviteitTypeOptioneel) en Art. IX.2 gewijzigd; backend 2462 en lint groen
