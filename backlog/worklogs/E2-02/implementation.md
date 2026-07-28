# E2-02 — Prompt builder grounded only on school data + loaded goals

## Build round 1 — grounded matching prompt builder + snapshot test

- **FR / Article:** FR-4 · Constitution Art. IV.4 (ground only on the school's own data + loaded
  Op.stap goals; never external sources), supported by Art. IV.1 (advisory), IV.3 (motivatie),
  IV.5 (structured JSON). Feeds E2-03 (response contract) and E2-04 (persistence) without
  implementing them.

- **Files changed:**
  - `backend/src/Jaarplanner.Application/AiMatching/MatchingPromptBuilder.cs` — new. Pure static
    builder that turns a `Thema` (+ its themadoelen/subthema's/activiteiten) plus the relevant
    loaded Op.stap `Leerplandoel`s (and optional concorded `Minimumdoel`s) into an `AiRequest`
    (system + user prompt). This is the prompt content that E2-01's `DoelMatchingService` packs
    into an `AiRequest` for `IAiClient`.
  - `backend/tests/Jaarplanner.UnitTests/Ai/MatchingPromptBuilderTests.cs` — new. Snapshot +
    grounding + determinism tests.

- **Key decisions:**
  - **Pure/deterministic:** static method, no clock, no randomness, no I/O, no config. Reads only
    its arguments. Leerplandoelen and minimumdoelen are ordered by their stable key
    (`Code` / `Ref`, `StringComparer.Ordinal`) so caller ordering cannot change the output — this
    is what makes the snapshot stable. `Thema` child collections keep their domain list order.
  - **Grounding is structural:** every user-prompt line is rendered exclusively from the arguments
    (school content + loaded Op.stap goals). The fixed `SystemPrompt` constant is the only
    non-data text and it explicitly forbids external knowledge/internet/invented codes and asks for
    structured JSON — nothing pulls in outside sources.
  - **Newlines:** explicit `\n` throughout so the built prompt is byte-identical on Windows and
    Linux CI (snapshot stability).
  - **Did not touch the E2-01 interface** (`IAiClient`/`AiRequest`/`AiCompletion`/
    `DoelMatchingService`) — the builder produces an existing `AiRequest`, no seam change needed.
  - **Minimumdoelen optional:** `Bouw(thema, leerdoelen, minimumdoelen = null)`. Minimumdoelen are
    Op.stap data too (their omschrijving grounds concordance reasoning); the section is omitted
    entirely when none are passed, keeping the change minimal while leaving the right seam for E2-03.
  - Uses the existing single-source code maps `Doelsoort.ToCode()` and `ActiviteitType.ToCode()`
    rather than re-deciding labels.

- **Tests added (all in `MatchingPromptBuilderTests`):**
  - `Bouwt_de_verwachte_grounded_prompt` — the snapshot: asserts the full user prompt equals an
    inline expected string and the system prompt equals the public `SystemPrompt` constant.
  - `Prompt_bevat_enkel_de_aangeleverde_school_en_opstap_data` — positive (every supplied datum
    appears) + negative (no `http`/`wikipedia`/external-source strings leak; system prompt carries
    the "Gebruik geen externe kennis" rule).
  - `Is_deterministisch_ongeacht_leerdoelvolgorde` — reversing the leerdoelen input yields an
    identical prompt.
  - `Minimumdoelen_sectie_ontbreekt_wanneer_geen_minimumdoelen_meegegeven` — optional section gating.
  - `Verwerpt_null_argumenten` — null thema / null leerdoelen throw.

- **Gates:**
  - `dotnet build` ✓ (0 errors; only pre-existing NU1903 Microsoft.OpenApi warnings, unrelated)
  - `dotnet test` (UnitTests) ✓ — 243 passed, 0 failed (5 new)
  - `dotnet format --verify-no-changes` ✓ (exit 0, no changes)

- **Branch:** story/E2-02

- **Self-check vs acceptance criteria (*Done when:* prompt contains only school + Op.stap data;
  snapshot-tested):**
  - "prompt contains only school + Op.stap data" → met. User prompt is rendered solely from the
    `Thema`/`Leerplandoel`/`Minimumdoel` arguments; `SystemPrompt` is fixed instruction scaffolding
    that forbids external sources. Evidence: `Prompt_bevat_enkel_de_aangeleverde_school_en_opstap_data`.
  - "snapshot-tested" → met. `Bouwt_de_verwachte_grounded_prompt` is a full-string snapshot
    assertion (inline `.Equal`, matching the repo's existing plain-string assertion convention — no
    new snapshot framework added).

- **For the test-runner:** pure unit test, no API/UI, no Playwright. Verify with:
  `cd backend && dotnet test tests/Jaarplanner.UnitTests/Jaarplanner.UnitTests.csproj --filter "FullyQualifiedName~MatchingPromptBuilder"`
  The proving snapshot test is `Bouwt_de_verwachte_grounded_prompt`.

- **Open questions / Art. XIV touched:** none. The structured-JSON *schema* is intentionally left to
  E2-03 (the system prompt only asks for structured JSON at a high level).
