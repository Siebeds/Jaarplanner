---
id: FB-031
titel: Chatbot legt de tool uit en beantwoordt opzoekvragen over doelen, thema's en activiteiten
soort: functioneel
status: nieuw
prioriteit: laag
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-16 22:46
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar zette op 2026-09-15 *"Chatbot"* op zijn lijst met nieuwe features.

**Beslissing van de eigenaar, 2026-09-15:** de chatbot **helpt bij de tool** en **doet voorstellen**. Dit ticket is het
eerste deel: uitleg over hoe de tool werkt, en (sinds 2026-09-16) opzoekvragen over de eigen inhoud. Het tweede deel
is FB-032.

De gebruikers zijn leerkrachten en een directie zonder technische achtergrond. Er is vandaag geen handleiding in de tool.

## Gewenst gedrag

- Op elk scherm opent een gebruiker een chatvenster.
- Ze stelt in gewone taal een vraag over hoe de tool werkt ("hoe plan ik een algemene fiche?", "waarom is dit doel niet
  gedekt?") en krijgt een kort Nederlands antwoord.
- De chatbot antwoordt alleen op basis van een Nederlandse handleiding van de tool (Art. IV.4: geen externe bronnen). Weet
  hij iets niet, dan zegt hij dat.
- Hij wijzigt niets.

### Opzoekvragen over de eigen inhoud

**Beslissing van de eigenaar, 2026-09-16:** de chatbot beantwoordt ook eenvoudige opzoekvragen over de inhoud van de
school, bv.:

- "Zit doel x in thema y?" (het doel aangeduid met zijn naam of zijn code)
- "Zit activiteit a in subthema z?"
- "Waar wordt doel x gebruikt?" (in welke thema's, subthema's, activiteiten en algemene fiches)
- gelijkaardige vragen: welke doelen horen bij thema y, bij welk subthema hoort activiteit a, ...

Regels:

- Het antwoord komt uit de gegevens van de tool, niet uit wat de AI denkt te weten. Elk antwoord noemt de thema's,
  subthema's of activiteiten waarop het steunt, liefst met een link ernaartoe.
- Een doel is te vinden op zijn code (minimumdoel of leerplandoel) en op (een deel van) zijn naam. Passen meerdere
  doelen, dan toont de chatbot de kandidaten en vraagt hij welk bedoeld is, in plaats van er zelf een te kiezen.
- Hij toont alleen wat de gebruiker ook op het scherm mag zien (Art. VI.1, ADR-0040): een leerkracht krijgt geen
  antwoord over de planning van een klas die ze niet mag inkijken.
- Een koppeling telt als ze vastligt (aanvaard of manueel). Een voorgestelde koppeling noemt hij apart als voorstel, een
  geweigerde niet.
- Hij wijzigt niets, en het ontwikkelingsrapport valt erbuiten.

## Acceptatiecriteria

- [ ] Gegeven de vraag "hoe plan ik een algemene fiche?", dan antwoordt de chatbot met de stappen uit de handleiding.
- [ ] Gegeven een vraag waarover de handleiding niets zegt, dan zegt de chatbot dat hij het niet weet, en verzint hij
  niets.
- [ ] Gegeven de vraag "zit doel <code> in thema <naam>?", dan antwoordt de chatbot ja of nee en zegt hij waar het doel
  in dat thema zit (themadoel, subthema, activiteit), volgens de gegevens van de tool.
- [ ] Gegeven dezelfde vraag met (een deel van) de naam van het doel in plaats van de code, dan krijg je hetzelfde
  antwoord; passen meerdere doelen, dan vraagt de chatbot welk bedoeld is.
- [ ] Gegeven de vraag "zit activiteit a in subthema z?", dan antwoordt de chatbot juist, en hoort a bij een ander
  subthema of een andere leeftijd, dan zegt hij waar ze wel hoort.
- [ ] Gegeven de vraag "waar wordt doel x gebruikt?", dan somt de chatbot de thema's, subthema's, activiteiten en
  algemene fiches op waarin het doel vastligt, en noemt hij voorgestelde koppelingen apart.
- [ ] Gegeven een leerkracht die vraagt naar een klas die ze niet mag inkijken, dan krijgt ze daarover geen gegevens.
- [ ] Gegeven een vraag over een doel, thema of activiteit die niet bestaat, dan zegt de chatbot dat hij het niet vindt,
  en verzint hij niets.
- [ ] Gegeven een gesprek, dan gaan er geen gegevens over kinderen naar de AI, en de tool bewaart het gesprek niet
  (zie Open vragen).
- [ ] Het chatvenster is met het toetsenbord te bedienen en nagekeken in een echte browser op desktop en ~390px.
- [ ] De logica is getest met een nep-AI-client.

## Testscenario's

1. Open de agenda en open de chatbot. Vraag hoe je een algemene fiche plant. Je krijgt de stappen.
2. Vraag iets wat niets met de tool te maken heeft. De chatbot zegt dat hij daar niet bij kan helpen.
3. Sluit en open het venster. Het vorige gesprek staat er niet meer (zie Open vragen).
4. Vraag "zit doel <code> in thema <naam>?" voor een themadoel van dat thema. Je krijgt ja, met de plaats. Vraag het
   voor een doel dat er niet in zit. Je krijgt nee.
5. Vraag hetzelfde met een stuk van de doelnaam dat bij meer doelen past. De chatbot vraagt welk doel je bedoelt.
6. Vraag "waar wordt doel x gebruikt?" en vergelijk het antwoord met de thema's en activiteiten op het scherm.
7. Vraag "zit activiteit a in subthema z?" voor een activiteit van een ander subthema. De chatbot zegt waar ze wel zit.
8. Log in als leerkracht van K1 en vraag naar de planning van een K3-klas. Je krijgt die gegevens niet.
9. Herhaal op ~390px.

## Buiten scope

- Voorstellen doen of iets inplannen: FB-032.
- Vragen over de dekking beantwoorden (is doel x gedekt, hoeveel procent): niet gekozen (beslissing 2026-09-15). De
  opzoekvragen hierboven horen er wel bij (beslissing 2026-09-16).

## Open vragen

- **De handleiding bestaat nog niet.** Wie schrijft ze, en hoort ze bij dit ticket?
- **Opzoekvragen en de AI:** vertaalt de AI de vraag naar een vaste opzoeking in de tool (aanbevolen: het antwoord komt
  dan altijd uit de gegevens en er gaat weinig naar de AI), of krijgt de AI de gegevens zelf mee?
- Gaat "waar wordt doel x gebruikt?" ook over de agenda (in welke week), of alleen over de inhoud?
- Wordt dit ticket te groot, splits dan de opzoekvragen af in een eigen ticket.
- Wordt een gesprek bewaard (bv. om de antwoorden te verbeteren)? **Standaard** niet.
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI. Ook de kost
  per vraag moet gemeten worden.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-16 22:46 · claude · opzoekvragen over de eigen inhoud toegevoegd op vraag van de eigenaar (zit doel x in thema y, zit activiteit a in subthema z, waar wordt doel x gebruikt)
