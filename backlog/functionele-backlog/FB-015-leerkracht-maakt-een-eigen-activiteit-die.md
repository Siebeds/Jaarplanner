---
id: FB-015
titel: Leerkracht maakt een eigen activiteit die parallelle collega's lezen en overnemen
soort: functioneel
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-16 22:51
opgepakt-door: claude-fb015
branch: ticket/FB-015-eigen-activiteit
pr:
geblokkeerd:
fr: [FR-3.1, FR-3.2]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"een leerkracht wil kunnen aanduiden dat een zelf gemaakte activiteit enkel voor
zichzelf is zodat deze niet onnodig wordt toegevoegd aan het subthema (standaard staat een nieuwe activiteit op de
leerkracht zelf, maar kan worden aangeduid dat dit mag toegevoegd worden aan het subthema en dit komt dan voor de
kernleerkracht tevoorschijn als suggestie op het subthema dat moet goedgekeurd/afgekeurd worden)"*.

Vandaag is elke nieuwe activiteit meteen gedeeld: ze komt onder het subthema van haar leeftijd, en elke leerkracht van
die leeftijd ziet en bewerkt ze (Art. VI.1). Een activiteit die een leerkracht alleen voor haar eigen klas bedacht,
belandt zo in het gedeelde aanbod.

**Beslissingen van de eigenaar, 2026-09-15:**

- een eigen activiteit is **van de leerkracht** en volgt haar naar een volgend schooljaar;
- **parallelle leerkrachten** (dezelfde jaarfase) kunnen ze **lezen en gebruiken**, niet bewerken; wie ze in de eigen
  agenda zet, krijgt een **eigen kopie** die ze wel kan bewerken;
- de eigenaar **koppelt zelf doelen** aan haar eigen activiteit, en ingepland in de agenda van haar klas **tellen die
  mee voor de dekking** van die klas.

Dit ticket neemt het activiteitendeel van story E6-10 over. Het voorstel aan het subthema is FB-016.

## Gewenst gedrag

- Een activiteit die een leerkracht aanmaakt (in de agenda of onder een subthema), is standaard **haar eigen
  activiteit**. Ze hangt onder een subthema van de leeftijd van haar klas, zoals een gedeelde activiteit.
- Een eigen activiteit is overal herkenbaar als "eigen", met een woord of icoon.
- Alleen de eigenaar bewerkt ze, koppelt er doelen aan, maakt ze los en verwijdert ze.
- De leerkrachten van dezelfde jaarfase zien de eigen activiteiten van hun collega's, met de naam van de maker. Ze kunnen
  ze lezen en "gebruiken": dan krijgen ze een eigen kopie, met dezelfde inhoud en doelen, die van hen is.
- Leerkrachten van een andere jaarfase zien een eigen activiteit niet.
- De doelen van een eigen activiteit tellen mee voor de dekking van een klas zodra die activiteit in de agenda van die klas
  ingepland is. Een kopie telt voor de klas van wie de kopie heeft.
- Een eigen activiteit blijft bestaan als het schooljaar voorbij is, en de leerkracht kan ze het jaar erna opnieuw
  gebruiken.

## Acceptatiecriteria

- [ ] Gegeven een leerkracht van een K3-klas, wanneer ze een activiteit aanmaakt, dan is die haar eigen activiteit, en
  een andere K3-leerkracht kan ze lezen maar niet bewerken.
- [ ] Gegeven die andere K3-leerkracht, wanneer ze de activiteit gebruikt en in haar agenda zet, dan krijgt ze een eigen
  kopie die ze kan bewerken, en de originele activiteit blijft ongewijzigd.
- [ ] Gegeven een leerkracht van een K2-klas, dan ziet ze de eigen activiteiten van de K3-leerkrachten niet.
- [ ] Gegeven een eigen activiteit met een doel, ingepland in de agenda van de klas van de eigenaar, dan staat dat doel in
  het dekkingsoverzicht van die klas als gedekt, met de activiteit als bewijs; in een andere klas niet.
- [ ] Gegeven een eigen activiteit, wanneer het volgende schooljaar begint, dan heeft de eigenaar ze nog.
- [ ] De eigen activiteiten zijn herkenbaar zonder kleur alleen, en nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Meld aan als leerkracht van een K3-klas. Maak in de agenda een nieuwe activiteit. Ze staat er als "eigen".
2. Koppel er een doel aan en plan ze in je agenda. Open de dekking van je klas: het doel is gedekt, met je activiteit als
   bewijs.
3. Meld aan als leerkracht van een andere K3-klas. Je ziet de activiteit met de naam van je collega, zonder knop om te
   bewerken. Kies "gebruiken" en plan ze in. Je hebt nu een eigen kopie; wijzig de naam. Het origineel is onveranderd.
4. Meld aan als leerkracht van een K2-klas. De activiteit is nergens te zien.
5. Kies het volgende schooljaar. Als eigenaar heb je je activiteit nog.

## Buiten scope

- Een eigen activiteit voorstellen aan het subthema: FB-016.
- Persoonlijke subdoelen (het andere deel van E6-10): niet gevraagd.
- Kopieën bijwerken wanneer het origineel verandert: een kopie staat los van het origineel.

## Open vragen

- **Grondwet:** dit wijzigt Art. VI.1 (vandaag maakt elke leerkracht gedeelde activiteiten, en alleen de hoofdleerkracht
  en de directie koppelen doelen aan een activiteit), Art. IX.2 (activiteiten zijn per leeftijd gedeeld) en Art. V.1 (een
  doel telt vandaag via een thema in het jaarplan of een ingeplande algemene fiche). Die wijziging, deel 2 van de
  ADR-0030-wijziging die E6-10 verschuldigd was, hoort bij de bouw van dit ticket.
- Kan een leerkracht nog rechtstreeks een **gedeelde** activiteit maken? **Standaard** nee: een leerkracht maakt eigen
  activiteiten, en gedeeld wordt het via FB-016; een hoofdleerkracht en de directie maken wel rechtstreeks gedeelde.
- Wat met de eigen activiteiten van een gebruiker die de directie verwijdert? **Standaard** worden ze gedeeld, zoals
  vandaag met de activiteiten van een verwijderde maker (I17).
- Mag een hoofdleerkracht of de directie een eigen activiteit van een leerkracht bewerken? **Standaard** de directie
  wel (die bewerkt alles), een hoofdleerkracht niet.

## Werklog

- 2026-09-15 14:09 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-16 22:51 · claude-fb015 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten, als voorwaarde voor FB-025
