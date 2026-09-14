# ADR-0036 — An evaluation resource for the AI doelsuggesties, the v1 route, and Entra as an explicit choice

- **Status:** Proposed
- **Date:** 2026-09-14
- **Deciders:** Siebe De Saedeleir (projecteigenaar) for decisions 3 and 4; decisions 1 and 2 are the implementer's
  proposal within ADR-0010 and ADR-0012, awaiting the owner's acceptance
- **Realises:** [ADR-0016](0016-azure-hosting-eu-residency.md), which left the specific Azure services to their own
  ADR, for the AI evaluation only.
- **Relates to:** [ADR-0010](0010-ai-advisory-architecture.md) (the injectable AI client),
  [ADR-0012](0012-secrets-config-management.md) (the key as a server-side secret),
  [ADR-0034](0034-demo-omgeving-op-azure.md) (the demo, which stays without AI).
- **Backlog:** TB-004 (the eval runner); TB-006 (the school's environments); E7-06 (the processing register); E2-09.

## Context

Step 6 of the thema-opbouw can already ask the AI for leerplandoelen that fit a subthema (E2-07,
`POST /api/thema-opbouw/subdoel-suggesties`), but no screen calls it and nobody knows how good the suggestions are. On
2026-09-14 the owner decided to measure first:

- no Azure AI Search: too expensive for a catalogue of about 5,800 goals;
- start with a small model;
- one Foundry resource in Sweden Central;
- each school gets its own web app and database, so nothing about the AI is shared between schools;
- the gold set comes from the head kindergarten teachers, one class per jaar/fase, linking goals in the app.

Three technical facts shaped the rest:

- The client spoke the deployment-scoped route with `api-version=2024-10-21`. That version predates the gpt-5 family.
  Azure OpenAI's v1 API needs no monthly version.
- The eval runs from the owner's machine. A key would have to be copied there; an Entra sign-in (`az login`) needs no
  secret at all.
- Belgium Central, where the demo runs (ADR-0034), offers none of the small models or embedding models as Data Zone
  Standard (EU). Sweden Central offers all of them.

## Decision

1. **The AI client speaks the Azure OpenAI v1 API.** Requests go to `{endpoint}/openai/v1/chat/completions` with the
   deployment as `model`; the `AzureAI:ApiVersion` option is removed. The client also reads the provider's token usage
   into `AiCompletion.Usage` (for measuring cost only, never for a decision in a flow), and it sends `reasoning_effort`
   and `max_completion_tokens` only when they are configured.
2. **The key stays the default; Entra is an explicit choice.**
   - `AzureAI:Authentication` defaults to `Key`: `AzureAI:ApiKey` is then required, as ADR-0012 describes. A missing key
     is missing configuration: the client throws before sending anything.
   - `AzureAI:Authentication = Entra` makes the client ask Microsoft Entra for a token instead, cached until five
     minutes before it expires (`EntraTokenProvider`). In a host that is `DefaultAzureCredential`; the eval runner
     passes an Azure CLI credential.
   - **Not decided here:** whether a school's app should sign in with its managed identity rather than a key. That
     belongs to TB-006 and gets its own decision.
3. **One evaluation resource, apart from everything else** (`infra/ai-foundry.bicep`, owner 2026-09-14):
   - a Foundry account (`kind: AIServices`) in **Sweden Central**, in its own resource group `rg-jaarplanner-ai`;
   - **Data Zone Standard (EU)** deployments only: `gpt-5.4-mini`, `gpt-5-mini`, `text-embedding-3-small`,
     `text-embedding-3-large`, each pinned to its version (`NoAutoUpgrade`) and capped at a low throughput;
   - **no keys** (`disableLocalAuth: true`), and one least-privilege role, *Cognitive Services OpenAI User*, for the
     person who runs the eval.
4. **Retrieval is chosen by measurement, and evaluation data stays out of git** (owner 2026-09-14):
   - the eval runner (`backend/tools/Jaarplanner.Eval`) compares a model choosing from every goal of a subthema's
     jaar/fase with a model choosing from an embedding top 25, computed in memory. No vector database until the
     measurement asks for one;
   - the repository is public, so real evalsets, reports and caches live in `eval-data/`, which git ignores, and the
     runner refuses to write elsewhere in the repo unless git ignores it. Only an invented example is committed.

## Alternatives considered

- **Azure AI Search as the vector index.** Rejected by the owner on cost; at this catalogue size an in-memory
  comparison, or later pgvector in the existing PostgreSQL, costs nothing extra.
- **Keep the `api-version` route.** It predates the models under test, and the next model would mean another version
  bump.
- **Entra as the fallback when no key is set.** Rejected after the TB-004 audit: a host with an endpoint but a missing
  key would sign in with whatever identity it has and send the prompt, instead of failing before sending anything.
- **The Foundry resource in `main.bicep`.** It would tie the evaluation to the demo's resource group and region.
- **A key for the eval.** It would have to exist on the owner's machine; with `disableLocalAuth` there is none to leak.

## Consequences

**Positive**

- The measurement can run without any secret, and the resource can be deleted in one command.
- A model change is a configuration change on the v1 route, without an `api-version` to follow.
- Production behaviour is unchanged for every existing configuration: a host with a key works as before, a host
  without AI configuration fails as before (ADR-0034's demo sets none).

**Negative / trade-offs**

- A second Azure resource, in a second EU region, to pay for and to remember to delete.
- School content (subthema texts, no pupil data) is processed in the EU data zone for the eval. The processing
  register (E7-06) must name this resource before a real evalset is sent, and the export of a gold set must check its
  free text for pupil names (Art. VI.2).
- `AzureAI:ApiVersion` in an environment's configuration is now ignored.
- The key path on the v1 route has run only against a stub. The evaluation resource has no keys
  (`disableLocalAuth`), so the eval exercises Entra only; the first host that calls a key-based resource on the v1
  route is the one that verifies it. No host configures AI today.

**Follow-ups**

- TB-006 decides how each school environment authenticates to AI.
- The export of the gold set from the school's database is its own ticket.
- E2-09 (a 503 for missing AI configuration) is unaffected: with the default, a missing key still throws before sending.

## Compliance trace

- **Constitution:** Art. IV.4 (the eval grounds only on the catalogue and the evalset's school content), Art. IV.5
  (the production parser validates every answer), Art. IV.6 (the client and the embeddings stay behind fakeable
  seams), Art. VI.2 (no pupil data in an evalset), Art. VI.3 (EU data zone), Art. VI.4 (no keys on the resource; the
  key, where used, stays server-side), Art. VI.6 (the processing register follow-up), Art. VIII (Azure).
- **Backlog:** TB-004; TB-006; E7-06; E2-09 (unchanged).
- **FR/NFR:** FR-4 (step 6 of A.7), NFR-5, NFR-6.
