---
id: FB-017
titel: Activiteiten als derde sectie in de zijbalk van de agenda
soort: functioneel
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:10
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-6.2]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"een leerkracht moet bij het klikken op de agenda ook de activiteiten te zien krijgen
(op dezelfde manier als algemene fiches) waarbij deze standaard activiteiten van het subthema van die week weergeeft,
maar mogelijkheid om te switchen van thema/subthema selectie op basis van klas die geselecteerd is"*.

Vandaag heeft de zijbalk naast de agenda twee schakelaars, Hoekenfiches en Algemene fiches, met kaarten die je naar het
tijdraster sleept of aanklikt. Activiteiten staan daar niet: je vindt ze alleen in de kiezer die opent wanneer je op een
leeg kwartier klikt.

**Beslissing van de eigenaar, 2026-09-15:** de activiteiten komen als **derde sectie in de zijbalk**, naast Hoekenfiches
en Algemene fiches.

## Gewenst gedrag

- In de zijbalk staat een derde schakelaar, **Activiteiten**.
- Standaard toont die de activiteiten van het subthema dat in de zichtbare week loopt voor de gekozen klas.
- Een keuzelijst laat de leerkracht een ander thema en subthema kiezen, beperkt tot de leeftijd(en) van de gekozen klas.
- Elke activiteit is een kaart, zoals een fiche: naar het tijdraster slepen, of aanklikken om ze in te plannen met dag en
  uur (de weg zonder slepen).
- De lijst toont de gedeelde activiteiten van het subthema, de eigen activiteiten van de leerkracht, en die van
  parallelle collega's die ze mag gebruiken (FB-015), elk herkenbaar.
- Loopt er die week geen subthema, dan zegt de sectie dat en biedt ze de keuzelijst aan.
- Wie de klas niet mag plannen, ziet de kaarten zonder sleep- of plannenknop.

## Acceptatiecriteria

- [ ] Gegeven een klas met een subthema dat in de zichtbare week loopt, wanneer de leerkracht de sectie Activiteiten
  opent, dan staan de activiteiten van dat subthema er als kaarten.
- [ ] Gegeven die sectie, wanneer ze een ander thema en subthema kiest, dan toont de lijst die activiteiten, en de keuze
  biedt alleen subthema's van de leeftijd van de klas.
- [ ] Gegeven een kaart, wanneer ze die naar een dag en uur sleept, of aanklikt en dag en uur kiest, dan staat de
  activiteit daar ingepland.
- [ ] Gegeven een week zonder lopend subthema, dan zegt de sectie dat en toont ze de keuzelijst.
- [ ] Gegeven een gebruiker die de klas alleen mag inkijken, dan kan ze niets inplannen vanuit de sectie.
- [ ] Bereikbaar met het toetsenbord, zichtbare focusring, nagekeken in een echte browser op desktop en ~390px.

## Testscenario's

1. Open de agenda van een K3-klas in een week waarin een subthema loopt. Kies in de zijbalk Activiteiten: de
   activiteiten van dat subthema staan er.
2. Sleep er een naar dinsdag 10:00. Ze staat ingepland.
3. Klik een andere kaart aan, kies woensdag 9:00 en bewaar. Ze staat ingepland.
4. Kies in de keuzelijst een ander thema en subthema. De lijst verandert; alleen K3-subthema's zijn te kiezen.
5. Ga naar een week zonder subthema. De sectie zegt dat en biedt de keuzelijst aan.
6. Herhaal stap 1 tot 3 op ~390px.

## Buiten scope

- Een activiteit bewerken vanuit de kaart: dat blijft in het activiteitblad.
- AI-voorstellen voor de week: FB-027.

## Open vragen

- Moet er onderaan, zoals bij de fiches (TB-015), een tegel met een plus komen om een nieuwe activiteit aan te maken?
- De eigen activiteiten van parallelle collega's verschijnen pas als FB-015 gebouwd is.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
