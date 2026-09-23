---
id: FB-031
titel: Chatbot legt de tool uit en beantwoordt opzoekvragen over doelen, thema's en activiteiten
soort: functioneel
status: te-testen
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-23 20:31
opgepakt-door: claude-fb031
branch: ticket/FB-031-chuck-kopje
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar zette op 2026-09-15 *"Chatbot"* op zijn lijst met nieuwe features.

**Beslissing van de eigenaar, 2026-09-15:** de chatbot **helpt bij de tool** en **doet voorstellen**. Dit ticket is het
eerste deel: uitleg over hoe de tool werkt, en (sinds 2026-09-16) opzoekvragen over de eigen inhoud. Het tweede deel
is FB-032.

**Aangevuld door de eigenaar, 2026-09-18:** de chatbot is de kat (FB-071). Hij slaapt rechtsboven in een mandje;
wie op hem klikt, opent zijn venster, met bovenaan wat hij meebracht en daaronder deze chat. Dit ticket hoort bij fase 1
van de kat (FB-063 tot en met FB-071).

De gebruikers zijn leerkrachten en een directie zonder technische achtergrond. Er is vandaag geen handleiding in de tool.

## Gewenst gedrag

- Op elk scherm opent een gebruiker het chatvenster door op de kat te klikken (FB-071).
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

- [x] Gegeven de vraag "hoe plan ik een algemene fiche?", dan antwoordt de chatbot met de stappen uit de handleiding.
- [x] Gegeven een vraag waarover de handleiding niets zegt, dan zegt de chatbot dat hij het niet weet, en verzint hij
  niets.
- [x] Gegeven de vraag "zit doel <code> in thema <naam>?", dan antwoordt de chatbot ja of nee en zegt hij waar het doel
  in dat thema zit (themadoel, subthema, activiteit), volgens de gegevens van de tool.
- [x] Gegeven dezelfde vraag met (een deel van) de naam van het doel in plaats van de code, dan krijg je hetzelfde
  antwoord; passen meerdere doelen, dan vraagt de chatbot welk bedoeld is.
- [x] Gegeven de vraag "zit activiteit a in subthema z?", dan antwoordt de chatbot juist, en hoort a bij een ander
  subthema of een andere leeftijd, dan zegt hij waar ze wel hoort.
- [x] Gegeven de vraag "waar wordt doel x gebruikt?", dan somt de chatbot de thema's, subthema's, activiteiten en
  algemene fiches op waarin het doel vastligt, en noemt hij voorgestelde koppelingen apart.
- [x] Gegeven een leerkracht die vraagt naar een klas die ze niet mag inkijken, dan krijgt ze daarover geen gegevens.
- [x] Gegeven een vraag over een doel, thema of activiteit die niet bestaat, dan zegt de chatbot dat hij het niet vindt,
  en verzint hij niets.
- [x] Gegeven een gesprek, dan gaan er geen gegevens over kinderen naar de AI, en de tool bewaart het gesprek niet
  (zie Open vragen).
- [x] Het chatvenster is met het toetsenbord te bedienen en nagekeken in een echte browser op desktop en ~390px.
- [x] De logica is getest met een nep-AI-client.

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

- ~~**De handleiding bestaat nog niet.** Wie schrijft ze, en hoort ze bij dit ticket?~~ **Beslist door de eigenaar,
  2026-09-23:** de sessie schrijft een eerste versie als deel van dit ticket, de eigenaar kijkt ze na
  (`backend/src/Jaarplanner.Application/Kat/Chat/Handleiding.md`).
- ~~**Opzoekvragen en de AI:** vertaalt de AI de vraag naar een vaste opzoeking in de tool, of krijgt de AI de gegevens
  zelf mee?~~ **Beslist door de eigenaar, 2026-09-23:** de AI kiest een vaste opzoeking, de tool zoekt het antwoord in
  haar eigen gegevens ([ADR-0066](../../docs/adr/0066-de-chat-van-de-kat-kiest-een-opzoeking.md)).
- ~~Gaat "waar wordt doel x gebruikt?" ook over de agenda?~~ **Beslist door de eigenaar, 2026-09-23:** ja, in welke
  weken, voor de klassen die de gebruiker mag inkijken.
- Wordt een gesprek bewaard (bv. om de antwoorden te verbeteren)? **Standaard** niet, en zo gebouwd.
- Elke vraag staat op zichzelf: een vervolgvraag die op het vorige antwoord steunt, begrijpt de kat mogelijk niet
  (ADR-0066 D1).
- **AI-omgeving:** er is nog geen werkende AI-omgeving (TB-004 wacht op Azure), en de demo draait zonder AI. Ook de kost
  per vraag moet gemeten worden.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-16 22:46 · claude · opzoekvragen over de eigen inhoud toegevoegd op vraag van de eigenaar (zit doel x in thema y, zit activiteit a in subthema z, waar wordt doel x gebruikt)
- 2026-09-18 17:56 · kat-sparring · tekst aangevuld: de chatbot is de kat (FB-071), fase 1; prioriteit laag naar middel (eigenaar)
- 2026-09-23 10:39 · claude-fb031 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten; open vragen beantwoord (handleiding door de sessie, opzoeking via tool use, ook de agenda)
- 2026-09-23 11:01 · claude-fb031 · backend klaar: één AI-aanroep kiest uitleg uit de handleiding of een vaste opzoeking, de tool antwoordt met de rechten van de gebruiker; eerste versie van de handleiding en ADR-0066; unit- en Postgres-tests groen
- 2026-09-23 11:24 · claude-fb031 · browserpas op een kopie van de database met Claude Haiku: uitleg, onbekend, ja/nee met plek, niet gevonden, kiezen en opnieuw zoeken werken, op 1440px en 390px, zonder horizontale scroll; lange doelteksten ingekort
- 2026-09-23 11:32 · claude-fb031 · antagonist: COMPLIANT, geen CRITICAL of MAJOR; drie MINOR opgelost (geweigerde themaplaatsing niet in de agenda, eigen activiteit via de rechtenmatrix, geen gedachtestreepje in een uitleg); open MINOR: een 400 met een Nederlandse zin (prompt te groot) toont de algemene fouttekst; vraag aan de eigenaar: de handleiding uitdrukkelijk in Art. IV.4 noemen
- 2026-09-23 11:32 · claude-fb031 · in-uitvoering → te-testen: chat van Chuck gebouwd: uitleg uit de handleiding (eerste versie, na te kijken door de eigenaar) en vijf opzoekingen uit de eigen gegevens met de rechten van de gebruiker, ook de agenda; niets bewaard of gelogd (ADR-0066); criteria bewezen met unit-, Postgres- en Vitest-tests en een browserpas op 1440px en 390px; volledige suites, dotnet format en pnpm lint groen
- 2026-09-23 11:33 · claude-fb031 · PR #172
- 2026-09-23 20:23 · eigenaar · te-testen → klaar-voor-bouw: Bevinding van de eigenaar: (1) terwijl Chuck een antwoord zoekt, overlappen de drie puntjes de tekst 'Chuck denkt na' in de ballon; verwacht een kleine ruimte tussen tekst en puntjes, gezien puntjes over de laatste letter (oorzaak: .ai-puntjes heeft margin-left -4px, index.css). (2) De kat is in het chatvenster niet zichtbaar en het staartje van de ballon wijst naar niets; gewenst: een klein kopje van Chuck (ca. 32px) als chaticoon naast elke ballon van hem, met het staartje ernaartoe, en naast 'Chuck' in de kop van het venster.
- 2026-09-23 20:26 · claude-fb031 · klaar-voor-bouw → in-uitvoering: opgepakt: bevindingen van de eigenaar (puntjes, kopje van Chuck)
- 2026-09-23 20:31 · claude-fb031 · in-uitvoering → te-testen: bevindingen verwerkt: puntjes staan 4px na 'Chuck denkt na' (alleen in de chat, de AI-knop blijft), en een kopje van Chuck (32px) naast elke ballon, met het staartje ernaartoe, en naast zijn naam in de kop; nagekeken in de browser op 1440px en 390px zonder horizontale scroll; kat-tests en pnpm lint groen; antagonist COMPLIANT, één MINOR (het kopje draagt de klasse chuck) gelaten
