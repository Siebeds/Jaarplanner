---
id: TB-007
titel: Thema-matching stuurt niet langer de hele doelencatalogus mee
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-15 19:12
opgepakt-door: prompt-begrenzing
branch: ticket/TB-007-prompt-begrenzing
pr:
geblokkeerd:
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
- Bij een thema zonder subthema's kiest de gebruiker vóór het genereren één of meer jaarfasen; de kandidaten zijn dan
  de doelen van die jaarfasen.
- Een harde bovengrens op de grootte van de prompt, als instelling in de configuratie met standaard 50.000 tokens. Gaat
  een aanvraag erover, dan wordt het model niet aangeroepen, wordt er niets bewaard en krijgt de gebruiker een
  Nederlandse melding die zegt hoe het kleiner kan.
- Code: `DoelMatchingService`, `MatchingPromptBuilder`, `ThemaOpbouwAssistService`, `ThemaOpbouwPromptBuilder`, de
  aanroep in de frontend en de keuze van de jaarfasen (UI-werk, dus eerst de skill `frontend-design`).

## Acceptatiecriteria

- [ ] Gegeven een thema met subthema's voor K3 en de volledige Op.stap-import, wanneer suggesties gegenereerd worden,
  dan bevat de prompt alleen K3-doelen en toont het resultaat het aantal kandidaten.
- [ ] Gegeven een thema zonder subthema's, wanneer de gebruiker suggesties wil genereren, dan kiest hij eerst één of meer
  jaarfasen en bevat de prompt alleen doelen van die jaarfasen; zonder keuze wordt het model niet aangeroepen, en nooit
  gaat stilzwijgend de hele catalogus mee.
- [ ] Gegeven een kandidatenset boven de ingestelde bovengrens (standaard 50.000 tokens), wanneer suggesties gevraagd
  worden, dan wordt het model niet aangeroepen, wordt er niets bewaard en ziet de gebruiker een Nederlandse melding.
- [ ] Gegeven de nep-AI-client, dan dekken unit tests de drie gevallen hierboven en zijn de snapshot tests van de prompt
  bijgewerkt.

## Buiten scope

- Retrieval met embeddings in de app: dat volgt uit de meting van TB-004.
- Welke disciplines eerst: dat blijft een open beslissing (Art. XIV).
- Stap 6 van de wizard: TB-004 en het scherm dat daarop volgt.

## Open vragen

Beantwoord door de eigenaar op 2026-09-14:

- **Een thema zonder subthema's:** de gebruiker kiest de jaarfasen. Directie en themabeheer hebben geen eigen klas, dus
  de gekozen klas zegt weinig over een schoolbreed thema.
- **De bovengrens:** één instelling in de configuratie, standaard 50.000 tokens, aan te passen zonder codewijziging
  (bijvoorbeeld na de meting van TB-004). Niet per model.

Beantwoord door de eigenaar op 2026-09-15:

- **De promptvorm:** meteen compact, niet pas na TB-004. Per doel code, doelsoort, jaarfase, domein, subdomein en tekst.
  Gemeten op de volledige Op.stap-import is alleen K3 in de oude vorm ongeveer 54.000 tokens, boven de grens, en compact
  ongeveer 22.000. TB-004 kan de vorm later nog bijsturen.

## Werklog

- 2026-09-14 11:33 · ai-doelsuggesties · aangemaakt (status nieuw)
- 2026-09-14 11:36 · ai-doelsuggesties · geblokkeerd: wacht op de eigenaar: wat bij een thema zonder subthema's, en welke bovengrens voor de prompt
- 2026-09-14 14:35 · ai-doelsuggesties · niet langer geblokkeerd
- 2026-09-14 14:36 · ai-doelsuggesties · eigenaar besliste: bij een thema zonder subthema's kiest de gebruiker de jaarfasen; bovengrens is een configinstelling, standaard 50.000 tokens
- 2026-09-15 18:45 · eigenaar · nieuw → klaar-voor-bouw: eigenaar gaf vrij voor bouw; de compactere promptvorm wacht op de meting van TB-004
- 2026-09-15 18:45 · prompt-begrenzing · klaar-voor-bouw → in-uitvoering: opgepakt
- 2026-09-15 18:50 · prompt-begrenzing · eigenaar besliste: compacte promptvorm nu (code, doelsoort, jaarfase, domein, subdomein, tekst), want in de huidige vorm is alleen K3 al ~54.000 tokens (gemeten op de lokale databank met de volledige Op.stap-import)
- 2026-09-15 19:12 · prompt-begrenzing · gevonden: EfDoelMatchOpslag laadde de subthema's van een thema niet mee, dus de matchingprompt schreef altijd '(nog geen)' subthema's en activiteiten; nu laadt ze subthema's, onderzoeksvragen en activiteiten, nodig voor de standaardjaarfasen
