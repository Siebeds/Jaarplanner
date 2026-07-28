# E2-01 — AI client behind an injectable interface

## Build round 1 — injectable AI-client seam + faked client + real Azure client

- **FR / Article:** FR-4 (AI-matching). Constitution **Art. IV.6** (matching/plan logic testable
  with a faked, injected AI client), **Art. VI.4** (AI key server-side only, never in repo/frontend),
  **Art. VIII** (AI client lives in Infrastructure; Application orchestrates).

- **Files changed:**
  - `backend/src/Jaarplanner.Application/Ai/IAiClient.cs` — the injectable AI-client interface
    (the seam); one method `CompleteAsync(AiRequest) → AiCompletion`; no provider/credential leakage.
  - `backend/src/Jaarplanner.Application/Ai/AiRequest.cs` — transport-agnostic request (system +
    user prompt); serves both matching (FR-4) and plan generation (FR-5).
  - `backend/src/Jaarplanner.Application/Ai/AiCompletion.cs` — raw completion envelope (opaque
    string; parsing/validation is E2-03).
  - `backend/src/Jaarplanner.Application/AiMatching/DoelMatchingService.cs` — the matching-service
    seam; depends only on `IAiClient`. Thin pass-through for now; E2-02/03/04 flesh it out.
  - `backend/src/Jaarplanner.Infrastructure/Ai/AzureAIOptions.cs` — **moved here from
    `Jaarplanner.Api/Configuration`** (Art. VIII: options belong beside the client that reads them,
    which the old placeholder explicitly instructed). Extended with `Deployment` + `ApiVersion`
    (non-secret); `ApiKey` remains the server-side secret.
  - `backend/src/Jaarplanner.Infrastructure/Ai/AzureAiFoundryClient.cs` — the real `IAiClient`: a
    thin adapter over the Azure OpenAI/Foundry chat-completions REST API via a typed `HttpClient`;
    reads endpoint/key/deployment from `AzureAIOptions`; sets the key on the `api-key` header only;
    asks for `response_format: json_object` (Art. IV.5); returns the raw `choices[0].message.content`.
  - `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — DI wiring:
    `Configure<AzureAIOptions>(section "AzureAI")`, `AddHttpClient<IAiClient, AzureAiFoundryClient>()`,
    and `AddScoped<DoelMatchingService>()`.
  - `backend/src/Jaarplanner.Infrastructure/Jaarplanner.Infrastructure.csproj` — added
    `Microsoft.Extensions.Options.ConfigurationExtensions` and `Microsoft.Extensions.Http`.
  - `backend/src/Jaarplanner.Api/Configuration/AzureAIOptions.cs` — **deleted** (moved to
    Infrastructure).
  - `backend/src/Jaarplanner.Api/appsettings.Development.json` — updated the `//AzureAI` doc comment
    (the client now exists; documents the non-secret keys and the server-side secret path).
  - `backend/tests/Jaarplanner.UnitTests/Ai/FakeAiClient.cs` — in-memory `IAiClient`; canned
    completion; **no network**; records last request + call count.
  - `backend/tests/Jaarplanner.UnitTests/Ai/DoelMatchingServiceTests.cs` — the "Done when" evidence.

- **Key decisions:**
  - The interface lives in **Application** (the AI-orchestration layer per CLAUDE.md/Art. VIII) and
    exposes no Azure specifics — so the provider is swappable and the key stays server-side.
  - Technical transport types use **English** identifiers (`IAiClient`, `AiRequest`, `AiCompletion`,
    `CompleteAsync`) per the CLAUDE.md rule (infra/tooling in English); the matching seam keeps the
    Dutch domain term (`DoelMatchingService`, `VraagSuggestiesAsync`).
  - The real client returns the **raw** model text — no JSON parsing/validation here — to keep a
    clean boundary for E2-03 (structured-JSON contract + validation).
  - Missing AI config fails **loudly on first use** (not at startup), so dev/CI/test hosts that never
    call AI keep running with no AI config.
  - **Secrets:** only non-secret values may sit in appsettings; `AzureAI:ApiKey` is user-secrets
    locally / Key Vault in the cloud, set on the `api-key` header inside Infrastructure only. No key
    anywhere in the repo or tests.

- **Tests added (Jaarplanner.UnitTests/Ai):**
  - `Matching_service_runs_against_the_fake_and_returns_its_canned_completion` — the seam runs with
    the fake, no network; returns the canned content; client called once.
  - `Matching_service_forwards_the_grounded_prompt_to_the_client` — the request built by the logic is
    exactly what the client received (transparent seam).
  - `Matching_service_rejects_a_null_client` — guards the injection contract.

- **Gates:**
  - `dotnet build` ✓ (0 errors; 4 pre-existing NU1903 `Microsoft.OpenApi` warnings from the E0 base,
    unrelated to this change).
  - `dotnet test` (unit) ✓ — 4 passed / 0 failed (3 new + 1 pre-existing skeleton test), no network.
  - `dotnet test` (integration) ✓ — 7 passed / 0 failed (app boots with the new DI wiring).
  - `dotnet format --verify-no-changes` ✓ — no changes needed.

- **Branch:** `story/E2-01`

- **Self-check vs acceptance criteria:**
  - *Done when: the matching service runs against the fake in unit tests with no network* → **met**.
    `DoelMatchingServiceTests` constructs `DoelMatchingService` with `FakeAiClient` (pure in-memory,
    no `HttpClient`/sockets) and asserts the flow works. Keys server-side only → **met** (interface
    exposes no credential; key read only in `AzureAiFoundryClient` from server-side config; nothing
    in repo/appsettings/tests).

- **For the test-runner:** **Unit only** — no Playwright, no API route, no DB. Verify with:
  `cd backend && dotnet test tests/Jaarplanner.UnitTests/Jaarplanner.UnitTests.csproj`
  The proving test is
  `Jaarplanner.UnitTests.Ai.DoelMatchingServiceTests.Matching_service_runs_against_the_fake_and_returns_its_canned_completion`.
  No network is possible because the fake (`FakeAiClient`) has no HTTP dependency at all.

- **Open questions / Art. XIV touched:** none. **Note for the orchestrator:** this worktree was
  created from the **E0 foundation** commit (it does not contain E1 work). E2-01 is an infrastructure
  seam that does not depend on any E1 domain entity, so it builds cleanly here; the `DoelMatchingService`
  seam intentionally takes an `AiRequest`/returns an `AiCompletion` rather than E1 domain types.
  When this branch is merged onto the E1 line, downstream E2 stories (E2-02 prompt builder, E2-03
  validation, E2-04 `DoelKoppeling` persistence) attach to `IAiClient`/`DoelMatchingService`.
