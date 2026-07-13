# Antagonist Review — E2-02 Grounded matching prompt builder

**Verdict:** COMPLIANT
**Scope audited:** commit `c684e43` on `story/E2-02` (worktree `agent-a65d3c2409677bbb1`). Files:
`backend/src/Jaarplanner.Application/AiMatching/MatchingPromptBuilder.cs`,
`backend/tests/Jaarplanner.UnitTests/Ai/MatchingPromptBuilderTests.cs`.
(The E2-01 `AiRequest`/`IAiClient` seam is unchanged — verified.)

## Findings

### [MINOR] Mixed-language method naming within the builder
- **Article/FR:** Art. II.2 (technical identifiers in English).
- **Where:** `MatchingPromptBuilder.cs` — `Bouw`, `BouwUserPrompt`, `SchrijfSchoolcontent`, `SchrijfLeerplandoelen`, `SchrijfMinimumdoelen`, `SchrijfSubthema`, `SchrijfActiviteit`, `SchrijfLeerplandoel`, `BeschrijfKoppeling` (Dutch verbs) alongside `Line` (English).
- **Problem:** These are generic rendering operations (build/write helpers), not domain behaviours, so Art. II.2 leans English. The class mixes Dutch verbs with an English helper in the same type. This is drift, not a breach: the codebase deliberately uses Dutch verbs for operations acting on domain aggregates (`VoegThemadoelToe`, `StelKernwoordenschatIn`, `WijzigNaam`), and this builder does operate on domain concepts, so the Dutch verbs are defensible; only the internal inconsistency (`Line`) stands out.
- **Required fix:** Optional — pick one convention for the private render helpers for consistency. Not blocking.

## Checks run (proof of thoroughness)
- **Art. IV.4 (grounding) — PASS.** Every line of the user prompt is rendered exclusively from the three arguments (`thema`, `leerdoelen`, optional `minimumdoelen`). No clock, environment, configuration, file, network or static data is read. The fixed `SystemPrompt` explicitly forbids external knowledge/internet/other sources and forbids inventing leerplandoelen, codes, voorbeelden or woordenschat, and instructs the model to only propose codes that literally appear in the "Beschikbare Op.stap-leerplandoelen" list. No leakage path found. Relevance/selection of the candidate leerdoelen is legitimately the caller's job (future `DoelMatchingService`); the builder is grounded on precisely what it is given.
- **Art. IV.1/IV.2/IV.3 (advisory) — PASS.** Builder only prepares a request; it applies/persists nothing. System prompt states "Je stelt enkel voor; de leerkracht beslist. Pas niets automatisch toe." and requires a motivation per suggestion. No status mutation here (correctly deferred to E2-04).
- **Art. IV.5 (structured JSON) — PASS / correctly scoped.** System prompt requests structured JSON (code + motivation). No response schema or validation is implemented — that is E2-03, correctly out of scope.
- **Art. III (curriculum integrity) — PASS.** Read-only access verified against the domain: `Leerplandoel` (private setters, no mutators) and `Minimumdoel` are only read; the builder invokes no setter or mutator on any curriculum or school entity (confirmed by reading `Leerplandoel.cs`, `Thema.cs`, `Themadoel.cs`, `DoelKoppeling.cs`). Only read-only getters and enum `.ToCode()` extensions are used.
- **Art. VIII (layering) — PASS.** `MatchingPromptBuilder` lives in `Jaarplanner.Application/AiMatching` and depends only on `Jaarplanner.Application.Ai` (the E2-01 envelope) and `Jaarplanner.Domain`. `Jaarplanner.Application.csproj` references only `Jaarplanner.Domain` — no Infrastructure/Api leakage. Static class, no DI/IO — appropriate, not over-engineered.
- **Determinism / snapshot-safety — PASS.** Pure function of inputs. Leerplandoelen ordered by `Code` and minimumdoelen by `Ref` using `StringComparer.Ordinal`, so caller ordering cannot leak in (proven by `Is_deterministisch_ongeacht_leerdoelvolgorde`). Newlines are a hard-coded `\n` const, keeping the snapshot stable across Windows/Linux CI.
- **Scope creep — PASS.** No JSON schema/validation (E2-03), no persistence/DoelKoppeling writes (E2-04), no IAiClient change. Stays within "build the prompt".
- **Art. II.3 (Dutch UI strings in nl.json) — N/A.** The Dutch prompt text is model-facing content about the Dutch curriculum, not user-facing UI copy, so it is legitimately in code (a `public const` for snapshot assertion). Not an nl.json concern.
- **Art. X (Definition of Done) — PASS.** `dotnet test` (filter `MatchingPromptBuilderTests`) → Passed 5/5, build clean. Snapshot test present (full-string assertion), plus grounding, determinism and null-guard tests. Change is small and additive (no existing files touched).

## Open questions surfaced
- None. The builder is agnostic to planningsblok granularity, disciplines-first, and other Art. XIV open decisions — it renders whatever thema/goals it is handed and hard-assumes none of them.
