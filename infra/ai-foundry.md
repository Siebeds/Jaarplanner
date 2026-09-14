# The Foundry resource for the AI eval (TB-004)

`ai-foundry.bicep` creates one Azure AI Foundry resource for measuring the AI doelsuggesties with the eval runner
(`backend/tools/Jaarplanner.Eval`). The decision is recorded in
[ADR-0036](../docs/adr/0036-ai-evaluatieomgeving-en-v1-route.md). It is separate from the demo environment
(`main.bicep`, ADR-0034) and from any school's environment, in a resource group of its own, so it can be deleted without
touching anything else.

Everything is in code. `ai-foundry.bicep` is deployed at subscription scope and creates the resource group itself;
`ai-foundry-account.bicep` holds the account, its deployments and the role, and is only deployed through it.
`deploy-ai.ps1` runs the deployment.

## What it creates

| Resource | Setting | Why |
| --- | --- | --- |
| Foundry account (`kind: AIServices`, S0) | Sweden Central | Every model below is offered there as Data Zone Standard (EU). Belgium Central offers none of them. |
| | `disableLocalAuth: true` | No keys exist. Every call carries a Microsoft Entra token (Art. VI.4). |
| Deployments | `DataZoneStandard` | Prompts and completions are processed within the EU only (ADR-0016). |
| | `gpt-5.4-mini` | The small chat model under test, 50K tokens per minute. |
| | `text-embedding-3-small` | The embedding model for variant B, 100K tokens per minute. |
| | `NoAutoUpgrade` | A measurement is only comparable against the same model version. |
| Role assignment | *Cognitive Services OpenAI User* for the person who runs the eval | Call the models, nothing else. |

Only these two have Data Zone Standard quota on the subscription; `gpt-5-mini` and `text-embedding-3-large` have none,
so the owner limited the comparison to what has quota (2026-09-14). A second model is an entry in `modelDeployments`,
after a quota request.

The capacity of a deployment caps how fast the eval can spend, not what a token costs. Billing is per token. At 50K
tokens per minute a chat model handles roughly one or two subthema's a minute with variant A, which is slow on purpose.

## Deploying

After `az login`:

```powershell
./infra/deploy-ai.ps1 -WhatIf            # shows what would change, changes nothing
./infra/deploy-ai.ps1 -SetEvalEndpoint   # deploys, and writes AzureAI:Endpoint into the eval runner's user-secrets
```

The script gives the signed-in user the role; pass `-EvaluatorObjectId` for someone else. A redeploy updates the same
resource, because its names derive from the resource group. The role assignment can take a few minutes before the first
call is allowed.

If a deployment is refused (no quota for that model in the data zone, or the model is not offered), leave it out with
`-Skip <name>`, and leave it out of the runner's `--models` too.

## Data and costs

- The eval sends a school's subthema texts to this resource, processed in the EU data zone. The processing register
  (E7-06) should name it before a real evalset is sent (ADR-0036).
- Pay per token. The subscription budget from `infra/README.md` (ADR-0034) also counts this resource and sends its
  alerts, but it does not cap.
- The first run with variant B embeds the catalogue once per embedding model; later runs read those vectors from
  the cache in `eval-data/cache/`.
- When the measurement is done: `az group delete --name rg-jaarplanner-ai`.
