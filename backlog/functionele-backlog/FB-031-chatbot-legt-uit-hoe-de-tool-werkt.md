---
id: FB-031
titel: Chatbot legt uit hoe de tool werkt
soort: functioneel
status: nieuw
prioriteit: laag
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 14:10
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar zette op 2026-09-15 *"Chatbot"* op zijn lijst met nieuwe features.

**Beslissing van de eigenaar, 2026-09-15:** de chatbot **helpt bij de tool** en **doet voorstellen**. Dit ticket is het
eerste deel: uitleg over hoe de tool werkt. Het tweede deel is FB-032.

De gebruikers zijn leerkrachten en een directie zonder technische achtergrond. Er is vandaag geen handleiding in de tool.

## Gewenst gedrag

- Op elk scherm opent een gebruiker een chatvenster.
- Ze stelt in gewone taal een vraag over hoe de tool werkt ("hoe plan ik een algemene fiche?", "waarom is dit doel niet
  gedekt?") en krijgt een kort Nederlands antwoord.
- De chatbot antwoordt alleen op basis van een Nederlandse handleiding van de tool (Art. IV.4: geen externe bronnen). Weet
  hij iets niet, dan zegt hij dat.
- Hij wijzigt niets.

## Acceptatiecriteria

- [ ] Gegeven de vraag "hoe plan ik een algemene fiche?", dan antwoordt de chatbot met de stappen uit de handleiding.
- [ ] Gegeven een vraag waarover de handleiding niets zegt, dan zegt de chatbot dat hij het niet weet, en verzint hij
  niets.
- [ ] Gegeven een gesprek, dan gaan er geen gegevens over kinderen naar de AI, en de tool bewaart het gesprek niet
  (zie Open vragen).
- [ ] Het chatvenster is met het toetsenbord te bedienen en nagekeken in een echte browser op desktop en ~390px.
- [ ] De logica is getest met een nep-AI-client.

## Testscenario's

1. Open de agenda en open de chatbot. Vraag hoe je een algemene fiche plant. Je krijgt de stappen.
2. Vraag iets wat niets met de tool te maken heeft. De chatbot zegt dat hij daar niet bij kan helpen.
3. Sluit en open het venster. Het vorige gesprek staat er niet meer (zie Open vragen).
4. Herhaal op ~390px.

## Buiten scope

- Voorstellen doen of iets inplannen: FB-032.
- Vragen over de eigen planning of dekking beantwoorden: niet gekozen (beslissing 2026-09-15).

## Open vragen

- **De handleiding bestaat nog niet.** Wie schrijft ze, en hoort ze bij dit ticket?
- Wordt een gesprek bewaard (bv. om de antwoorden te verbeteren)? **Standaard** niet.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI. Ook de kost
  per vraag moet gemeten worden.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
