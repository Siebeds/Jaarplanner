---
id: TB-043
titel: AI-aanvragen worden goedkoper: caching, begrensde output, geen gekoppelde doelen
soort: technisch
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 22:56
opgepakt-door: claude-tb043
branch: ticket/TB-043-ai-goedkoper
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eerste echte test van de doelsuggesties bij een thema kostte 37.000 inputtokens en 1.200 outputtokens voor één
vraag. Zo'n 90 % van die input is de lijst met kandidaat-doelen (`LeerplandoelPromptlijst`), die voor elk thema van
dezelfde leeftijd identiek is en toch bij elke klik opnieuw volledig betaald wordt. Met het maandbudget van FB-055 telt
elke token voor de school.

Drie oorzaken:

- **Geen cache.** `MatchingPromptBuilder` zet eerst de schoolcontent, die per thema verschilt, en pas daarna de vaste
  doelenlijst. Een cache werkt alleen op een identiek begin van de prompt, dus die mist altijd. De Claude-client
  (`AnthropicClaudeClient`, TB-041) zet ook geen `cache_control`.
- **Onbegrensde output.** De prompt legt geen maximum aantal suggesties op, en `Anthropic:MaxTokens` staat op 16.000.
- **Overbodige kandidaten.** Doelen die al aan het thema gekoppeld zijn, gaan mee in de lijst en worden achteraf als
  dubbel weggegooid.

## Voorgestelde wijziging

1. **Prompt caching.**
   - De prompt krijgt een vast deel (systeemprompt en doelenlijst) en een variabel deel (het thema). `AiRequest` krijgt
     daarvoor een apart veld voor het vaste deel, zodat de client weet waar de cachegrens ligt.
   - De prompt-builders zetten de doelenlijst vóór de schoolcontent: `MatchingPromptBuilder` en
     `ThemaOpbouwPromptBuilder`, plus elke andere builder die `LeerplandoelPromptlijst` gebruikt. De verwijzingen in de
     systeemprompts ("hieronder", "hierboven") gaan mee.
   - `AnthropicClaudeClient` stuurt het vaste deel als systeemblok met `cache_control` (ephemeral, 5 minuten) en leest
     `CacheCreationInputTokens` en `CacheReadInputTokens` apart uit. Voor Azure AI Foundry is de volgorde genoeg:
     die cachet een identiek begin vanaf 1.024 tokens vanzelf.
   - Claude Haiku 4.5 cachet pas vanaf 4.096 tokens. De doelenlijst is ruim groter, maar een kleine lijst (één
     discipline) cachet niet. Dat is geen fout.
2. **Gekoppelde doelen weglaten zonder de cache te breken.** De doelenlijst blijft per leeftijd identiek, anders
   verschilt ze per thema en mist de cache weer. In het variabele deel komt een korte regel met de codes die al
   gekoppeld of geweigerd zijn, met de opdracht die niet voor te stellen. De bestaande controle op dubbels in
   `DoelMatchingService` blijft staan als vangnet.
3. **Output begrenzen.**
   - De systeemprompt vraagt hoogstens 8 suggesties, met een motivatie van één zin.
   - `Anthropic:MaxTokens` gaat van 16.000 naar 2.000.
   - Stopt het model op `max_tokens` (`StopReason.MaxTokens`), dan meldt de client dat duidelijk en wordt er niets
     bewaard, in plaats van dat de parser een afgekapt JSON-antwoord als ongeldig ziet.
   - Voor Azure zet de configuratie `AzureAI:MaxCompletionTokens` en `AzureAI:ReasoningEffort` (bv. `low`).
4. **Compactere doelenlijst.** `LeerplandoelPromptlijst` schrijft domein en subdomein één keer als kop en de doelen
   eronder, in plaats van `domein > subdomein` op elke regel. Hetzelfde voor de doelsoort en de jaarfase wanneer die
   voor de hele lijst gelijk zijn.

Code: `Application/Ai` (`AiRequest`, `LeerplandoelPromptlijst`), `Application/AiMatching`, `Application/AiAuthoring`,
`Infrastructure/Ai` (`AnthropicClaudeClient`, `AzureAiFoundryClient`), `appsettings.json`, en de snapshottests van de
prompts.

## Acceptatiecriteria

- [x] Gegeven twee thema's met subthema's van dezelfde leeftijd, wanneer hun prompts gebouwd worden, dan is het vaste
  deel (systeemprompt en doelenlijst) byte voor byte gelijk en staat alle schoolcontent erna (snapshottest).
- [x] Gegeven de Claude-client, wanneer hij een vraag stuurt, dan draagt het vaste deel `cache_control`, en
  `AiUsage` geeft de gecachete en de in de cache geschreven tokens apart terug (unittest met een nep-HTTP-antwoord).
- [ ] Gegeven een echte Claude-sleutel, wanneer de eigenaar kort na elkaar suggesties vraagt voor twee thema's van
  dezelfde leeftijd, dan toont de tweede vraag gecachete inputtokens (handmatige controle, resultaat in de Werklog).
- [x] Gegeven een thema met gekoppelde en geweigerde doelen, wanneer de prompt gebouwd wordt, dan staan hun codes in het
  variabele deel als "niet voorstellen" en is de doelenlijst ongewijzigd.
- [x] Gegeven een antwoord dat op `max_tokens` stopt, wanneer het verwerkt wordt, dan wordt er niets bewaard en krijgt de
  gebruiker een duidelijke Nederlandse melding.
- [x] `dotnet test`, `dotnet format` en `pnpm lint` zijn groen.

## Buiten scope

- Het maandbudget en de weging van gecachete tokens: FB-055.
- Voorselectie met embeddings: volgt uit de meting van TB-004.
- De overstap van leerplandoelen naar minimumdoelen bij het thema: FB-053. Dat ticket bouwt verder op deze cache-opbouw.
- Een cache van 1 uur of het opwarmen van de cache.

## Open vragen

- **Het maximum van 8 suggesties** komt uit de eval-variant van TB-004. Een ander getal kan, en de meting van TB-004
  kan het later bijstellen.

## Werklog

- 2026-09-16 22:23 · eigenaar · aangemaakt (status nieuw)
- 2026-09-16 22:34 · claude-tb043 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten, samen met het andere ticket
- 2026-09-16 22:43 · claude-tb043 · AiRequest heeft een VasteContext; de doelenlijst staat nu vóór de schoolcontent, compacter, en beide clients cachen of begrenzen de output
- 2026-09-16 22:56 · claude-tb043 · Criteria 1, 2, 4 en 5 afgevinkt op unittests (MatchingPromptBuilderTests, AnthropicClaudeClientTests, DoelMatchingServiceTests) en een integratietest (502 met Nederlandse melding, niets bewaard); criterium 3 wacht op de handmatige controle van de eigenaar met een echte sleutel
- 2026-09-16 22:56 · claude-tb043 · Gates groen: dotnet test (1944 unit, 559 integratie tegen Postgres), dotnet format zonder wijzigingen, pnpm lint
