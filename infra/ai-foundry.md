# The Foundry resource for the AI eval (TB-004)

`ai-foundry.bicep` creates one Azure AI Foundry resource for measuring the AI doelsuggesties with the eval runner
(`backend/tools/Jaarplanner.Eval`). The decision is recorded in
[ADR-0036](../docs/adr/0036-ai-evaluatieomgeving-en-v1-route.md). It is separate from the demo environment
(`main.bicep`, ADR-0034) and from any school's environment, in a resource group of its own, so it can be deleted without
touching anything else.

## What it creates

| Resource | Setting | Why |
| --- | --- | --- |
| Foundry account (`kind: AIServices`, S0) | Sweden Central | Every model below is offered there as Data Zone Standard (EU). Belgium Central offers none of them. |
| | `disableLocalAuth: true` | No keys exist. Every call carries a Microsoft Entra token (Art. VI.4). |
| Deployments | `DataZoneStandard` | Prompts and completions are processed within the EU only (ADR-0016). |
| | `gpt-5.4-mini`, `gpt-5-mini` | The two small chat models under comparison, 50K tokens per minute each. |
| | `text-embedding-3-small`, `text-embedding-3-large` | The two embedding models for variant B, 100K tokens per minute each. |
| | `NoAutoUpgrade` | A measurement is only comparable against the same model version. |
| Role assignment | *Cognitive Services OpenAI User* for the person who runs the eval | Call the models, nothing else. |

The capacity of a deployment caps how fast the eval can spend, not what a token costs. Billing is per token. At 50K
tokens per minute a chat model handles roughly one or two subthema's a minute with variant A, which is slow on purpose.

## Deploying

```powershell
az group create --name rg-jaarplanner-ai --location swedencentral --tags project=jaarplanner purpose=ai-eval
$me = az ad signed-in-user show --query id -o tsv
az deployment group create --resource-group rg-jaarplanner-ai --template-file infra/ai-foundry.bicep `
  --parameters evaluatorObjectId=$me --query properties.outputs
```

The `endpoint` output goes into the eval runner's user-secrets as `AzureAI:Endpoint` (see its README). The role
assignment can take a few minutes before the first call is allowed.

If a deployment is refused (no quota for that model in the data zone, or the model is not offered), leave it out by
passing `modelDeployments` without it, and leave it out of `--models` too.

## Data and costs

- The eval sends a school's subthema texts to this resource, processed in the EU data zone. The processing register
  (E7-06) should name it before a real evalset is sent (ADR-0036).
- Pay per token. The subscription budget from `infra/README.md` (ADR-0034) also counts this resource and sends its
  alerts, but it does not cap.
- The first run with variant B embeds the catalogue once per embedding model; later runs read those vectors from
  the cache in `eval-data/cache/`.
- When the measurement is done: `az group delete --name rg-jaarplanner-ai`.
