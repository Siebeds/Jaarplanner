---
id: TB-042
titel: Azure-demo krijgt de AI-provider uit main.bicep, zodat een nieuwe deploy hem niet wist
soort: technisch
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 22:12
opgepakt-door: claude-code-anthropic
branch: ticket/TB-bicep-ai-provider
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De eigenaar wil de Claude API (TB-041, ADR-0048) op de Azure-demo gebruiken. De provider kiest de app met de
app-instelling `Ai__Provider`, maar `infra/main.bicep` legt de volledige lijst app-instellingen vast: een instelling die
met de hand gezet wordt, verdwijnt bij de volgende deploy van de infrastructuur. De eigenaar vroeg op 2026-09-16:
*"pas eerst in de main.bicep aan en nadien mag je de provider aanzetten en de webapp herstarten"*.

ADR-0034 liet de demo alleen toe met *"AI uit of met een budgetplafond"*. **Beslissing van de eigenaar, 2026-09-16:**
het plafond is de maandelijkse spend limit in de Claude Console op de organisatie of workspace van de sleutel.

## Voorgestelde wijziging

- `infra/main.bicep`: een parameter `aiProvider` (standaard `Anthropic`, toegelaten `''`, `AzureAI`, `Anthropic`) en de
  app-instelling `Ai__Provider` met die waarde. De sleutel blijft het Key Vault-geheim `Anthropic--ApiKey`, nooit een
  app-instelling.
- `infra/README.md`: de demo heeft AI onder een budgetplafond, met een korte sectie over het geheim en de herstart.
- ADR-0034: een statusnoot dat de AI-voorwaarde nu de tweede tak volgt.
- Op de demo zelf, zonder de infrastructuur opnieuw te deployen: `Ai__Provider=Anthropic` zetten en de webapp herstarten.

## Acceptatiecriteria

- [ ] Gegeven `infra/main.bicep`, wanneer het gebouwd wordt (`az bicep build`), dan slaagt dat en staat `Ai__Provider` in de app-instellingen met de waarde van `aiProvider`.
- [ ] Gegeven een nieuwe deploy van de infrastructuur zonder `aiProvider`, dan blijft de demo op `Anthropic`.
- [ ] Gegeven de demo, wanneer `Ai__Provider` gezet is en de webapp herstart, dan antwoorden `/health` en `/health/ready` met 200.
- [ ] De sleutel staat nergens in de repo en niet in een app-instelling.

## Buiten scope

- De infrastructuur zelf opnieuw deployen (dat vraagt het databasewachtwoord uit de kluis, infra/README.md stap 6).
- Het geheim `Anthropic--ApiKey` in de kluis zetten: dat doet de eigenaar zelf.
- Een budgetplafond in Azure: het plafond staat in de Claude Console.

## Open vragen

Geen.

## Werklog

- 2026-09-16 22:09 · claude-code-anthropic · aangemaakt (status in-uitvoering)
- 2026-09-16 22:12 · claude-code-anthropic · main.bicep kreeg parameter aiProvider (standaard Anthropic) en app-instelling Ai__Provider; az bicep build slaagt. README en ADR-0034-statusnoot bijgewerkt (budgetplafond = spend limit in de Claude Console).
