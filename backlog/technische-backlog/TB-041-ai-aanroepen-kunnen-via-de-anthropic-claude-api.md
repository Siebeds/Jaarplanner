---
id: TB-041
titel: AI-aanroepen kunnen via de Anthropic Claude API lopen, kiesbaar naast Azure AI Foundry
soort: technisch
status: klaar
prioriteit: hoog
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 21:40
opgepakt-door: claude-code-anthropic
branch: ticket/TB-anthropic-client
pr:
geblokkeerd:
fr: []
---

## Aanleiding

Azure AI Foundry is voor de eigenaar op dit moment niet beschikbaar, waardoor elke AI-functie (doelsuggesties,
jaarplangeneratie, woordweb, thema-opbouw, herschrijven van een rapporttekst) faalt. De eigenaar wil dezelfde
functies laten lopen via de Anthropic Claude API, met een eigen API-sleutel en een instelbaar endpoint.

## Voorgestelde wijziging

- Een nieuwe `AnthropicClient` in `Jaarplanner.Infrastructure/Ai` die `IAiClient` implementeert via de Messages API,
  met de officiële Anthropic C#-SDK. De systeemprompt en de gebruikersprompt gaan ongewijzigd mee; de ruwe tekst en
  het tokenverbruik komen terug in `AiCompletion`.
- Een nieuwe configuratiesectie `Anthropic` (`Endpoint`, `ApiKey`, `Model`, `MaxTokens`, `Effort`). De sleutel is een
  server-side geheim (user-secrets lokaal, Key Vault in Azure) en komt nooit in de repo of de frontend.
- Een keuze van provider via configuratie (`Ai:Provider` = `AzureAI` of `Anthropic`) in `DependencyInjection.cs`.
  Zonder instelling blijft Azure AI Foundry de provider, zodat bestaande omgevingen niet wijzigen.
- Unit tests voor de nieuwe client en de providerkeuze; documentatie in `backend/README.md`.
- Een ADR die de tweede provider vastlegt, met de beslissing van de eigenaar over de EU-datazone.

## Acceptatiecriteria

- [x] Gegeven `Ai:Provider` = `Anthropic` en een ingevulde sleutel en model, wanneer een AI-functie wordt aangeroepen, dan gaat de aanvraag naar het ingestelde endpoint met de systeemprompt en de gebruikersprompt, en krijgt de aanroeper de tekst van het antwoord terug.
- [x] Gegeven een ingesteld `Anthropic:Endpoint`, wanneer de client een aanvraag stuurt, dan gaat die naar dat endpoint in plaats van naar `https://api.anthropic.com`.
- [x] Gegeven een ontbrekende sleutel of een ontbrekend model, wanneer een AI-functie wordt aangeroepen, dan faalt de aanroep met een duidelijke Engelse foutmelding en wordt er niets verstuurd; de app start wel.
- [x] Gegeven geen `Ai:Provider`, wanneer de app start, dan is Azure AI Foundry nog altijd de provider.
- [x] Gegeven een antwoord met tokenverbruik, wanneer de client het verwerkt, dan staan de input-, output- en cachetokens in `AiCompletion.Usage`.
- [x] De sleutel staat nergens in de repo en komt nooit in een antwoord naar de frontend.

## Buiten scope

- De eval-tool (`backend/tools/Jaarplanner.Eval`) blijft op Azure AI Foundry.
- Het uitrollen van een sleutel naar de Azure-demo (Key Vault, app settings).
- Het herschrijven of afstemmen van de prompts op Claude.

## Open vragen

Geen. De eigenaar besliste op 2026-09-16 dat de eis van Art. VI.3 (AI-verwerking in een EU-omgeving) niet geldt voor
deze provider; dat wordt in een ADR en in `docs/constitutie-log.md` vastgelegd.

## Werklog

- 2026-09-16 21:28 · claude-code-anthropic · aangemaakt (status in-uitvoering)
- 2026-09-16 21:35 · claude-code-anthropic · Client (AnthropicClaudeClient, officiële SDK), providerkeuze Ai:Provider, tests, ADR-0048 en constitutiewijziging Art. VI.3/VIII gebouwd; volledige testsuite loopt.
- 2026-09-16 21:40 · claude-code-anthropic · Acceptatiecriteria afgevinkt op basis van AnthropicClaudeClientTests (22 tests: endpoint, prompts, sleutel, geen omgevingstoken, usage, weigering, configuratiefouten, providerkeuze). Standaardmodel op wens van de eigenaar: claude-haiku-4-5.
- 2026-09-16 21:40 · claude-code-anthropic · Antagonist ronde 1: 1 MAJOR (constitutiewijziging niet in eigen commit), opgelost door de commit te splitsen; MINORs opgelost (ADR-0035-noot, Art. VIII-laagregel, FA-noot, registerzin als advies, csproj-volgorde, AuthToken uit de omgeving genegeerd). Ronde 2: COMPLIANT.
- 2026-09-16 21:40 · claude-code-anthropic · in-uitvoering → klaar: Gebouwd: Claude API-client naast Azure AI Foundry, kiesbaar met Ai:Provider. Gates: unit 1927 groen (4 overgeslagen), integratie 135 groen en 400 overgeslagen (geen Postgres-container), dotnet format schoon; geen frontendwijziging, dus pnpm lint niet nodig.
