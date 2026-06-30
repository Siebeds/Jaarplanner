# E1-04 — Doelsoort recognition & concordance

## Build round 1 — make the minimumdoel↔leerplandoel concordance queryable (bidirectional)

- **FR / Article:** FR-2.2 / FR-2.3. Art. VII.0/VII.1 (taxonomy + Excel D = B+C mapping),
  Art. IX.1 (curriculum data model), Art. III (read-only reference data; concordance is
  derived reference data — never mutated), Art. V.1–2/V.6 (minimumdoel-level coverage depends
  on this; coverage-critical logic must be well tested). ADR-0007 (taxonomy & concordance).

### Cardinality decision (seam 1) — keep the single nullable FK; expose it bidirectionally

ADR-0007 envisions a "many-to-many-**capable**" `Concordantie`. I assessed this against the
actual Op.stap artifact: each leerplandoel **row** carries exactly **one** column D
(`minimumdoelRef` = LfMD + nrMD, Art. VII.1). So the real cardinality is:

- **Leerplandoel → Minimumdoel: 0..1** (one D per row), and
- **Minimumdoel → Leerplandoel: 0..\*** (many leerplandoelen may name the same ref).

That is a **one-to-many** relationship, which E1-01 already models correctly: a single nullable
FK `Leerplandoel.MinimumdoelRef → Minimumdoel.Ref` (`HasPrincipalKey(Ref)`, `OnDelete.Restrict`),
plus an index — see `LeerplandoelConfiguration` and migration `20260630073510_CurriculumReadOnlyEntities`
(`FK_leerplandoelen_minimumdoelen_MinimumdoelRef`, `IX_leerplandoelen_MinimumdoelRef`).

I deliberately **did not** introduce a `Concordantie` join table: the data gives at most one ref
per leerplandoel, so a join would add an empty degree of freedom the source never uses, and would
not change `code`/`Ref` identity. This is faithful to the data while honouring ADR-0007's *intent*
(coverage roll-up to minimumdoel level). The "many-to-many-capable" wording is satisfied on the
many side (a minimumdoel ↔ many leerplandoelen); the one side reflects reality. If a future Op.stap
revision ever puts multiple refs on one row, this becomes a join behind the same query seam —
`IConcordantieQuery` is the abstraction, so callers (E5) are insulated. (Flagged as an open note
for the architect to confirm against ADR-0007's literal phrasing.)

The **bidirectional requirement** (the *Done when*) is met by `IConcordantieQuery`:
- `LeerplandoelenVoorMinimumdoelAsync(ref)` → all concorded leerplandoelen (roll-up direction),
- `MinimumdoelVoorLeerplandoelAsync(code)` → the concorded minimumdoel or `null`.

### Partial / invalid ref decision (seam 2) — no phantom link, ever

The E1-03 parser emits a partial key (e.g. `"6-"` when nrMD is blank/hidden). Decision: a ref that
matches **no** known minimumdoel **never** produces a concordance link.
- At the **DB layer** the FK structurally forbids it: a `MinimumdoelRef` with no matching
  `Minimumdoel.Ref` cannot be saved as a link. `ConcordantieQuery.MinimumdoelVoorLeerplandoelAsync`
  also re-checks the join explicitly and returns `null` on no match (defensive even if the FK were
  relaxed).
- At **build/diagnosis time** the pure `ConcordantieBouwer.Bouw(...)` classifies each ref as a
  real `Concordantie` link or a `VerweesdeMinimumdoelRef` (orphan) and **surfaces** orphans rather
  than dropping them silently (Art. III.5, V.6). This lets re-import/coverage (E1-05/E5) report
  "leerplandoel X names minimumdoel Y, which is unknown" instead of producing phantom coverage.

### Doelsoort recognition (all six codes) — reused, not duplicated

Doelsoort (MD/G/+/P/S/A) is already recognised end-to-end via the single-source
`DoelsoortCodes` (Domain) — used by the E1-03 parser and persisted via the EF value converter.
I added **no** new recognition code (Art. III.3 — mapping lives in one place). All six codes are
already pinned by `DoelsoortCodesTests` (round-trip + case-insensitive + unknown-fails). I left
that as the single source of truth and reference it here rather than duplicating it.

- **Files changed:**
  - `backend/src/Jaarplanner.Application/Curriculum/Concordantie.cs` — link value type (leerplandoel code ↔ minimumdoel ref).
  - `backend/src/Jaarplanner.Application/Curriculum/ConcordantieBouwResultaat.cs` — build result: real links + orphaned (unresolved) refs.
  - `backend/src/Jaarplanner.Application/Curriculum/ConcordantieBouwer.cs` — pure, DB-free concordance builder (orphan classification; no phantom link).
  - `backend/src/Jaarplanner.Application/Curriculum/IConcordantieQuery.cs` — bidirectional query seam (the queryable abstraction E5 consumes).
  - `backend/src/Jaarplanner.Infrastructure/Persistence/ConcordantieQuery.cs` — EF Core implementation over `AppDbContext` (both directions, no-match → null/empty).
  - `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — register `IConcordantieQuery → ConcordantieQuery` (scoped).
  - `backend/tests/Jaarplanner.UnitTests/Jaarplanner.UnitTests.csproj` — add EF Core InMemory provider (test-only).
  - `backend/tests/Jaarplanner.UnitTests/Curriculum/ConcordantieBouwerTests.cs` — builder unit tests.
  - `backend/tests/Jaarplanner.UnitTests/Curriculum/ConcordantieQueryTests.cs` — bidirectional query tests (EF InMemory).

- **Key decisions:** single nullable FK kept (faithful to one-D-per-row); bidirectional access via
  a query seam; orphaned refs surfaced not linked; open-decision seam isolated behind
  `IConcordantieQuery`. No re-import/diff, no coverage computation (E1-05/E5).

- **Migration:** **none required.** No entity/column changed — the FK + index already shipped in
  E1-01 (`20260630073510_CurriculumReadOnlyEntities`). Verified with
  `dotnet ef migrations has-pending-model-changes` → "No changes have been made to the model since
  the last migration." (Docker not used; no DDL to generate.)

- **Tests added (11):**
  - `ConcordantieBouwerTests` (5): links a known ref; skips a no-ref doel; surfaces a partial/orphan
    ref with **no** link; many leerplandoelen → one minimumdoel; mixed resolvable + orphan + none.
  - `ConcordantieQueryTests` (6): forward (minimumdoel → leerplandoelen, ordered, excludes no-ref);
    reverse (leerplandoel → minimumdoel); reverse null for no-ref; reverse null for unmatched ref
    (no phantom); forward empty for unknown minimumdoel; both-directions consistency.
  - Doelsoort six-code recognition already covered by existing `DoelsoortCodesTests` (not duplicated).

- **Gates:** `dotnet build` ✓ (0 warn/0 err) · `dotnet test` ✓ (111 unit + 7 integration, was 100+7)
  · `dotnet format --verify-no-changes` ✓ (clean). pnpm gates n/a (backend-only story).

- **Branch:** story/E1-04 (based on `feature/e1-curriculum-content` tip `eaa3a98`).

- **Self-check vs acceptance criteria:**
  - *Doelsoort enum (MD/G/+/P/S/A) recognised* → met: single-source `DoelsoortCodes`, all six pinned by tests; reused by parser + persistence.
  - *`minimumdoelRef` = B+C* → met: built by E1-03 parser (`ResolveMinimumdoelRef`), persisted, and matched in the query/builder.
  - *Concordance queryable* → met: `IConcordantieQuery` (registered in DI) + tests.
  - *Bidirectional* → met: forward `LeerplandoelenVoorMinimumdoelAsync`, reverse `MinimumdoelVoorLeerplandoelAsync`, both tested.
  - *Minimumdoel-level coverage becomes possible (feeds E5)* → met: forward roll-up returns the concorded leerplandoelen a minimumdoel's coverage depends on; coverage computation itself deliberately **not** built (E5).

- **For the test-runner:** **Unit only — no Playwright/API/UI.** Verify with
  `dotnet test backend/tests/Jaarplanner.UnitTests --filter "FullyQualifiedName~Concordantie"`
  (11 tests). To confirm the *Done when* bidirectionally: `ConcordantieQueryTests` seeds a
  minimumdoel `6-12` with leerplandoelen `LP-1`/`LP-2` and asserts
  `LeerplandoelenVoorMinimumdoelAsync("6-12") == [LP-1, LP-2]` and
  `MinimumdoelVoorLeerplandoelAsync("LP-1").Ref == "6-12"`. The no-phantom-link guarantee is in
  `Reverse_returns_null_when_the_ref_matches_no_minimumdoel` and
  `Bouw_surfaces_an_orphaned_ref_without_creating_a_phantom_link`.

- **Open questions / Art. XIV touched:** Concordance cardinality vs ADR-0007's "many-to-many-capable"
  wording — I kept the single FK as faithful to the one-D-per-row data and isolated the decision
  behind `IConcordantieQuery`. If the architect wants the literal join now, it's a localized change
  behind that seam. No Art. XIV open decision (planningsblok/graadklas/scope) was touched.
