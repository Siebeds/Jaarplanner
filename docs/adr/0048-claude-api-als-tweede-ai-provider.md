# ADR-0048 — The Claude API as a second AI provider

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Project owner, 2026-09-16: D1 to D4 below. Directie has not been asked.
- **Supersedes:** in part, [ADR-0016](0016-azure-hosting-eu-residency.md): its rule that every AI call uses an Azure AI
  Foundry EU data zone, and [ADR-0035](0035-ontwikkelingsrapport-derde-kleuter.md) §3.5's "EU only" for the rapporttekst
  rewrite, both for a deployment that picks the Claude API.
- **Relates to:** [ADR-0010](0010-ai-advisory-architecture.md) (the `IAiClient` seam),
  [ADR-0012](0012-secrets-config-management.md) (server-side keys), [ADR-0035](0035-ontwikkelingsrapport-derde-kleuter.md)
  (the rapporttekst rewrite).
- **Realises:** TB-041. **Constitution:** Art. VI.3 and VIII (amended); IV and VI.4 unchanged.

## Context

Azure AI Foundry is not available to the owner at the moment, so every AI feature fails: doelsuggesties, the
jaarplan generation, the woordweb, the thema-opbouw assist and the rapporttekst rewrite. All of them call the model
through one seam, `IAiClient`, which carries only a system prompt and a user prompt. The owner asked for a client for
the Anthropic Claude API, connected to an endpoint he configures, and ruled that the EU requirement does not apply to
it.

## Decision

The owner's rulings:

- **D1.** A second implementation of `IAiClient`, `AnthropicClaudeClient`, calls the Claude Messages API through the
  official Anthropic SDK. It sends the caller's two prompts unchanged and returns the raw text; each caller's parser
  keeps validating the JSON (Art. IV.5).
- **D2.** `Ai:Provider` picks the provider for the whole deployment: empty or `AzureAI` keeps Azure AI Foundry,
  `Anthropic` picks the Claude API, and any other value stops the app at startup.
- **D3.** The `Anthropic` section holds `Endpoint` (optional, default `https://api.anthropic.com`), `Model`,
  `MaxTokens` and `Effort`. The key, `Anthropic:ApiKey`, is a server-side secret like the Foundry key (Art. VI.4).
  A missing key or model fails the call and sends nothing; the app still starts.
- **D4.** A deployment that picks the Claude API is **not held to an EU processing location**. Art. VI.3 says so.

The client authenticates only with the configured key; the SDK then resolves no other credential on the machine. A
Claude.ai subscription does not give API access: the key comes from the Claude Console, billed per use. The eval tool
(`backend/tools/Jaarplanner.Eval`) stays on Azure AI Foundry.

## Consequences

- Every AI feature works again with a Claude API key, with no change to a prompt, a parser or a caller.
- **What leaves the EU.** With the Claude API, the prompts go to Anthropic without an EU guarantee: the school's
  thema's, subthema's, activiteiten and Op.stap goals, a woordweb's words, and, for a rapporttekst rewrite, a
  teacher's text about a child with the klas's names replaced (ADR-0035 §3.5). That text is still personal data. The
  processing register (Art. VI.6) should name Anthropic as an AI processor, and the DPIA that question 15 in
  `docs/besluiten-gevraagd.md` asks about should cover it. This is advice to the school, not a guard: Art. VI.6's
  ruling on processing before the register and the DPIA stands.
- Anthropic's own retention and use terms apply to what is sent; the Foundry EU data zone's terms no longer do.
- A second provider is a second thing to keep working: its tests (`AnthropicClaudeClientTests`) drive it offline
  through a stub HTTP handler, as `AzureAiFoundryClientTests` do for Foundry.
- Switching back is a configuration change: clear `Ai:Provider`.
