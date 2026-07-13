# E2-01 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit (xUnit)

## Criteria checked
- "the matching service runs against the fake in unit tests with no network" → PASS
  - `DoelMatchingService` depends only on `IAiClient` (constructor injection); no HttpClient/Azure reference in the Application layer (grep for `HttpClient|System.Net|Socket|azure.com` in `Jaarplanner.Application` → no matches).
  - Proving test `Matching_service_runs_against_the_fake_and_returns_its_canned_completion` injects `FakeAiClient` and asserts the canned completion `{"suggesties":[]}` is returned and the client was called once.
  - `FakeAiClient.CompleteAsync` is purely in-memory — `Task.FromResult(new AiCompletion{...})`, no HttpClient, no sockets. No network I/O possible.
- "Abstract Azure AI Foundry behind an interface" → PASS
  - `IAiClient.CompleteAsync(AiRequest) → Task<AiCompletion>` in Application; real `AzureAiFoundryClient` in Infrastructure; fake in test project. Provider is swappable.
- "keys server-side only" → PASS
  - `IAiClient` exposes no endpoint/credential. Key read from `AzureAIOptions.ApiKey` (bound from server-side `AzureAI` config) and set only on the `api-key` request header in `AzureAiFoundryClient`.
  - No hardcoded key/endpoint in repo: `appsettings.Development.json` contains only documentation comments (no `AzureAI:ApiKey` value); `EnsureConfigured()` fails loudly if unset. Only `openai.azure.com` hit is a `<resource>` placeholder in a doc comment.

## Commands run
- `dotnet test tests/Jaarplanner.UnitTests/Jaarplanner.UnitTests.csproj` → Build succeeded; Passed: 4, Failed: 0, Skipped: 0
- `dotnet test --filter FullyQualifiedName~DoelMatchingServiceTests` → Passed: 3, Failed: 0 (incl. the proving test)
- grep `HttpClient|System.Net|Socket|azure.com` in Application → no matches
- grep hardcoded key/endpoint across backend `*.cs/*.json` → only a `<resource>` doc-comment placeholder

## Evidence
- Full suite: `Passed! - Failed: 0, Passed: 4, Skipped: 0, Total: 4`
- Proving test green; fake is in-memory (`FakeAiClient.cs:35` returns `Task.FromResult`).
- Application layer has zero network types → network I/O impossible in the tested seam.

## Defects
- None.
