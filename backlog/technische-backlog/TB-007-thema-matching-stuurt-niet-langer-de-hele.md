---
id: TB-007
titel: Thema-matching stuurt niet langer de hele doelencatalogus mee
soort: technisch
status: nieuw
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-14 11:36
opgepakt-door:
branch:
pr:
geblokkeerd: wacht op de eigenaar: wat bij een thema zonder subthema's, en welke bovengrens voor de prompt
fr: []
---

## Aanleiding

De thema-matching (E2-08, FR-4.1) stuurt bij elke klik op doelsuggesties genereren de volledige catalogus mee:

- de frontend post een lege body (`frontend/src/lib/queries.ts`);
- de backend maakt daar `LeerdoelSelectie.Alles` van (`DoelMatchingService.GenereerSuggestiesAsync`);
- `MatchingPromptBuilder` schrijft elk doel uit, met voorbeelden en toelichting.

Sinds de import uit de Op.stap-API (E1-21) zijn dat 5.835 G-doelen. Dat is naar schatting rond 600.000 tokens per
aanvraag: meer dan de meeste modellen aankunnen, en duur per klik. Toen E2-08 getest werd, stonden er alleen
Excel-doelen van enkele disciplines in de databank.

Hetzelfde gebeurt bij de themadoelsuggesties van stap 2 in de wizard (`ThemaOpbouwAssistService`) wanneer de aanroeper
geen selectie meegeeft.

## Voorgestelde wijziging

- De kandidatenset standaard begrenzen op de jaarfasen die het thema raakt: de leeftijden van zijn subthema's. Het aantal
  kandidaten blijft in het resultaat staan, zodat de omvang zichtbaar is.
- De doelen compacter uitschrijven (code, domein, subdomein, tekst), of voorbeelden en toelichting inkorten. Welke vorm,
  daarover beslist de meting van TB-004.
- Een harde bovengrens op de grootte van de prompt. Gaat een aanvraag erover, dan wordt het model niet aangeroepen, wordt
  er niets bewaard en krijgt de gebruiker een Nederlandse melding die zegt hoe het kleiner kan.
- Code: `DoelMatchingService`, `MatchingPromptBuilder`, `ThemaOpbouwAssistService`, `ThemaOpbouwPromptBuilder` en zo
  nodig de aanroep in de frontend.

## Acceptatiecriteria

- [ ] Gegeven een thema met subthema's voor K3 en de volledige Op.stap-import, wanneer suggesties gegenereerd worden,
  dan bevat de prompt alleen K3-doelen en toont het resultaat het aantal kandidaten.
- [ ] Gegeven een thema zonder subthema's, wanneer suggesties gegenereerd worden, dan gebeurt wat de eigenaar beslist
  (zie Open vragen), en nooit stilzwijgend de hele catalogus.
- [ ] Gegeven een kandidatenset boven de bovengrens, wanneer suggesties gevraagd worden, dan wordt het model niet
  aangeroepen, wordt er niets bewaard en ziet de gebruiker een Nederlandse melding.
- [ ] Gegeven de nep-AI-client, dan dekken unit tests de drie gevallen hierboven en zijn de snapshot tests van de prompt
  bijgewerkt.

## Buiten scope

- Retrieval met embeddings in de app: dat volgt uit de meting van TB-004.
- Welke disciplines eerst: dat blijft een open beslissing (Art. XIV).
- Stap 6 van de wizard: TB-004 en het scherm dat daarop volgt.

## Open vragen

- **Een thema zonder subthema's:** de jaarfase van de geselecteerde klas, alle jaarfasen van de school, of de gebruiker
  laten kiezen?
- **De bovengrens:** een vast aantal tokens (bijvoorbeeld 50.000), of per model instelbaar?

## Werklog

- 2026-09-14 11:33 · ai-doelsuggesties · aangemaakt (status nieuw)
- 2026-09-14 11:36 · ai-doelsuggesties · geblokkeerd: wacht op de eigenaar: wat bij een thema zonder subthema's, en welke bovengrens voor de prompt
