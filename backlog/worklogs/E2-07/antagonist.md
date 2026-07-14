# Antagonist Review — E2-07 Goal-first authoring assist (thema-opbouw wizard hooks)

**Verdict:** COMPLIANT
**Scope audited:** diff `cac9155..c292990` (branch `story/E2-07`). Files: `Jaarplanner.Application/AiAuthoring/*` (service, prompt builder, ports, DTOs), `Jaarplanner.Infrastructure/AiAuthoring/EfLeerdoelCatalogus.cs`, `Jaarplanner.Api/Controllers/ThemaOpbouwController.cs`, `Jaarplanner.Infrastructure/DependencyInjection.cs`, unit tests under `AiAuthoring/`. 16 files, all additions (1287 insertions, 0 deletions).

## Findings
No violations. One QUESTION surfaced (pre-existing, not introduced by this change).

### [QUESTION] No authorization attribute on the new AI-invoking endpoint
- **Article/FR:** Art. VI.1 (role-based permissions)
- **Where:** `ThemaOpbouwController.cs` — `[Route("api/thema-opbouw")]`, no `[Authorize]`.
- **Problem:** The controller exposes two endpoints that trigger a server-side (paid) AI call with no auth attribute. NOT a regression: a repo-wide grep for `Authorize|AllowAnonymous` returns zero matches — no controller has auth yet, so RBAC is clearly a separate, not-yet-built epic. Flagging only so the coordinator confirms the AI-assist endpoints get covered when RBAC lands.
- **Required fix:** None for E2-07. Ensure the RBAC epic covers `api/thema-opbouw/*`.

## Checks run (proof of thoroughness)
- **Art. IV.1/IV.2/IV.8 (advisory / no persistence):** VERIFIED clean. `ThemaOpbouwAssistService` depends only on `IAiClient` + `ILeerdoelCatalogus` (a read-only query port). There is NO DbContext, repository, or writer reachable from the service; it returns transient `ThemaOpbouwAdviesResultaat`/`ThemaOpbouwAdvies` records. No `Themadoel`/`Subdoel`/`DoelKoppeling` is created. Tests assert transient/advisory behavior; docs state persistence happens only on teacher-accept via E1/E6 beheer. Suggestions carry no auto-applied status — correct, since status is stamped at accept time downstream (consistent with the E2-04 distinction).
- **Art. IV.4 (grounding):** VERIFIED. `ThemaOpbouwPromptBuilder` renders every user-prompt line exclusively from the passed transient thema/subthema context + the loaded leerplandoelen. System prompts (`GemeenschappelijkeRegels`) explicitly forbid external knowledge/internet/other sources and forbid invented codes. No config/clock/IO read. Deterministic (ordered by stable code). No leakage.
- **Art. IV.5 (validate before use):** VERIFIED. Reuses E2-03 `DoelMatchResponseParser`; on `!IsGeldig` the service returns `Mislukt` with empty `Suggesties`. Tests `Malformed_json_..._stap2/stap6` confirm malformed output yields nothing usable; empty valid list succeeds with zero suggestions.
- **Art. IV.6 (fakeable):** VERIFIED. Both seams (`IAiClient`, `ILeerdoelCatalogus`) injected; `FakeAiClient` + `FakeLeerdoelCatalogus` drive the whole flow with no network/DB.
- **Art. III (integrity):** VERIFIED. `EfLeerdoelCatalogus` reads `AsNoTracking` — pure read of read-only reference data; enrichment copies leerplandoel fields verbatim, never mutates. Hallucinated codes are routed to `OvergeslagenOnbekend`, never fabricated (test `Een_verzonnen_code_wordt_overgeslagen_niet_verzonnen`). `code` treated as opaque (`StringComparer.Ordinal`). Leerplandoel domain members all have private setters.
- **Art. VIII (layering):** VERIFIED. Service + prompt builder + `ILeerdoelCatalogus`/`IThemaOpbouwAssistService` ports live in Application; EF impl in Infrastructure; controller is thin (bind → delegate → Ok). No EF/Npgsql reference in Application. Correct dependency direction. Not over-engineered.
- **Art. II (Dutch domain / English infra / no hard-coded UI strings):** VERIFIED. Domain terms Dutch (Themadoel, Subdoel, Leerdoel, Advies…); comments English. Controller embeds NO user-facing Dutch — it returns the result object as JSON. The `Fout` field is an English technical diagnostic (e.g. "Malformed JSON"), not a UI string; the frontend maps its own nl.json message. Dutch prompt text is model input, not UI copy — appropriate.
- **Art. VI.4 (AI key server-side):** VERIFIED. Key/endpoint stay in `AzureAIOptions` (server config); controller never touches them; nothing reaches the frontend.
- **Scope / collision:** VERIFIED. `git diff --stat` shows the diff did NOT touch the frontend, `nl.json`, `MatchingPromptBuilder.cs`, `DoelMatchingService.cs`, or `DoelMatchResponseParser.cs` (reuse-only). Only shared-file edit is `DependencyInjection.cs`, and its diff is strictly additive: 2 `using` imports + 2 `AddScoped` registrations (`ILeerdoelCatalogus`→`EfLeerdoelCatalogus`, `IThemaOpbouwAssistService`→`ThemaOpbouwAssistService`); no existing line modified or removed.
- **Art. XIV (open decisions):** VERIFIED. `LeerdoelSelectie` is caller-driven (disciplines/jaarFasen filters); default `Alles` is an explicit "no filter", not a compiled-in disciplines-first commitment. No subdoel-persistence (E8-07) assumed — nothing is persisted. Candidate set is caller/config-driven, not hard-coded.

## Open questions surfaced
- Authorization on `api/thema-opbouw/*` (Art. VI.1) — deferred to the RBAC epic; confirm coverage there.
