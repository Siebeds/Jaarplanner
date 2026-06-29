# ADR-0010 — AI advisory architecture (injectable client, server-side, structured + validated)

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

AI is the core feature (matching, plan generation) but is strictly **advisory** (Art. IV): it proposes, the teacher decides; every suggestion is reviewable, accept/reject-able, with a persisted status and a motivation. AI runs **server-side only** (keys never reach the frontend, Art. VI.4), grounded only on the school's own data + loaded goals, returning **structured JSON validated before use**, and the client must be **fakeable in tests** (Art. IV.6). The provider is Azure AI Foundry (Azure OpenAI), preferably an EU data zone.

## Decision

We will place all AI behind an **`IAiClient` port** defined in Application and implemented in Infrastructure (Azure AI Foundry). The flow:
1. **Application** builds the prompt from relevant leerdoelen + the thema's themadoelen/subthema's/activiteiten — **no external sources**.
2. The client requests a **structured JSON** response (goal codes + one-line motivation; or planningsblok→thema's for generation).
3. The response is **schema-validated**; malformed output is rejected/repaired and never reaches the domain.
4. Results persist as `DoelKoppeling`/plan proposals with status `voorgesteld` + `aiMotivatie`; nothing is auto-applied.
5. A **`FakeAiClient`** implements the port for deterministic unit tests; the real client adds Azure specifics (auth, EU data zone, retries).

Keys come from Key Vault/user-secrets (ADR-0012); the SPA only ever sees results, never credentials.

## Alternatives considered

- **Call the AI from the frontend** — would expose keys and bypass validation/grounding. Forbidden (Art. IV/VI). Rejected outright.
- **Auto-apply high-confidence suggestions** — violates human-in-the-loop (Art. IV.1). Rejected; confidence is at most an indicator (FR-4.5, fast-follow E8-04).
- **Free-text AI responses parsed heuristically** — brittle and unsafe; structured JSON + validation is mandated (Art. IV.5).
- **Concrete AI SDK used directly in Application** — would make the use cases untestable without network and couple us to a vendor. The port keeps Application pure (Art. IV.6, ADR-0002).

## Consequences

**Positive**
- Use cases are testable offline with the fake; the trust/validation boundary is explicit; vendor is swappable behind the port.
- Human-in-the-loop is structurally guaranteed (status persisted, nothing auto-final).

**Negative / trade-offs**
- Two client implementations to maintain (fake + real) and a response schema to version.

**Follow-ups**
- E2-01 (port + fake), E2-02 (grounded prompt), E2-03 (schema + validation), E2-04/05 (persist + review), E2-07 (wizard hooks), E3-01 (generation reuses the port).

## Compliance trace

- **Constitution:** Art. IV (all clauses), Art. VI.4 (keys server-side), Art. III (grounding on school data only).
- **Backlog:** E2 (all), E3-01.
- **FR/NFR:** FR-4, FR-5; NFR-5 (key safety), NFR-3.
