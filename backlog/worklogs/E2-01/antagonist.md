# Antagonist Review — E2-01: AI client behind an injectable interface

**Verdict:** COMPLIANT
**Scope audited:** git diff `1c439fa..4ed3fd8` on branch `story/E2-01` — the AI seam
(`IAiClient`, `AiRequest`, `AiCompletion`, `DoelMatchingService`, `AzureAIOptions`,
`AzureAiFoundryClient`, Infrastructure DI, csproj, unit tests, appsettings comment).

## Findings

No violations. Two low-priority items surfaced below as QUESTION/MINOR; neither blocks Done.

### [QUESTION] Api-key auth vs. keyless (managed identity / Entra ID)
- **Article/FR:** Art. VI.4 (secrets), ADR-0016 (Azure + EU)
- **Where:** `Jaarplanner.Infrastructure/Ai/AzureAiFoundryClient.cs:63` (`api-key` header)
- **Problem:** The client authenticates with a shared API key. This is explicitly
  sanctioned by Art. VI.4 ("user-secrets locally, Key Vault in the cloud"), so it is
  compliant. However, Azure best practice for a resource already on Azure + Entra ID is
  keyless auth (managed identity / `DefaultAzureCredential`), which removes the secret
  entirely. Not a violation — flagging for a conscious later decision, not a fix now.
- **Required fix:** None for E2-01. Consider a keyless option when the resource is
  provisioned (would strengthen, not contradict, Art. VI.4).

### [MINOR] Two sibling namespaces for one concern
- **Article/FR:** Art. VIII (clarity, don't over-engineer)
- **Where:** `Jaarplanner.Application.Ai` (contracts) vs `Jaarplanner.Application.AiMatching`
  (`DoelMatchingService`)
- **Problem:** The seam is split across two namespaces for a very small surface. Harmless,
  but a single `Ai` namespace would read cleaner. Purely cosmetic.
- **Required fix:** Optional consolidation; no action required.

## Checks run (proof of thoroughness)
- **Art. IV.6 (injectable/fakeable):** `IAiClient` is in Application; `DoelMatchingService`
  depends only on it. `FakeAiClient` returns canned completions with zero I/O. Ran the 3
  unit tests — all pass in 41 ms, no network. "Done when" satisfied.
- **Art. IV.1/IV.2 (advisory, no auto-apply):** `DoelMatchingService.VraagSuggestiesAsync`
  is a pure pass-through returning the raw completion; no status/persistence/auto-apply
  baked in at this layer. Status + `aiMotivatie` correctly deferred to E2-04. Seam preserves
  human-in-the-loop.
- **Art. IV.4 (grounding):** `AiRequest` carries only system+user prompts; no external
  source wiring introduced. Prompt building explicitly deferred to E2-02.
- **Art. IV.5 (structured JSON):** client sets `response_format = json_object` and returns
  raw text; validation explicitly deferred to E2-03. Aligned.
- **Art. VI.4 / secrets (CRITICAL check):** Grep for `ApiKey`/`api-key`/endpoints across
  backend. NO secret committed. `appsettings.json` and `appsettings.Development.json`
  contain only placeholders/comments; the key lives at `AzureAI:ApiKey` via user-secrets /
  Key Vault. Key read only in Infrastructure, set only on a server-side HTTP header, never
  reaches a frontend (no frontend change). `EnsureConfigured()` fails loudly if unset. PASS.
- **Art. VIII (layering):** contract in Application, Azure impl in Infrastructure, DI in
  Infrastructure, Api untouched/thin. Build confirms Infrastructure → Application (no reverse
  dependency). `HttpClient` via `AddHttpClient<IAiClient, AzureAiFoundryClient>` — idiomatic,
  not over-engineered. Old `Api/Configuration/AzureAIOptions.cs` placeholder deleted and moved
  to Infrastructure where the client lives; no dangling references (solution builds).
- **Art. VIII (deps):** new packages `Microsoft.Extensions.Options.ConfigurationExtensions`
  and `Microsoft.Extensions.Http` — both standard MS extensions, no unauthorised framework.
  No EPPlus. No new AI SDK smuggled in (thin REST adapter).
- **Art. II (domain language):** English for infra (`IAiClient`, `AiRequest`, `AiCompletion`,
  `AzureAiFoundryClient`); Dutch for domain surface (`DoelMatchingService`,
  `VraagSuggestiesAsync`, `LaatsteRequest`, `AantalAanroepen`). No hard-coded user-facing
  Dutch strings (backend-only change; no `.tsx`/`nl.json` touched).
- **Scope creep:** Bounded correctly. No prompt building (E2-02), no JSON validation (E2-03),
  no `DoelKoppeling` persistence (E2-04). The `response_format`/`choices[0].message.content`
  handling is the minimal adapter plumbing, not premature contract logic.
- **Art. XIV (open decisions):** none hard-assumed. AI provider (Azure + EU) already settled.
  `ApiVersion` defaulted but overridable per environment.

## Open questions surfaced
- Keyless (managed identity) vs. API-key auth for the Foundry client — see QUESTION above.
  Route to the same decision that provisions the Azure resource; not an E2-01 blocker.
