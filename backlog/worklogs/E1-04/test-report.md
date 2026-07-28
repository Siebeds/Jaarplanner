# E1-04 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (xUnit)

## Criteria checked

- **AC1 — Concordance is queryable bidirectionally (feeds E5 coverage).** PASS.
  - Forward (minimumdoel → leerplandoelen, one-to-many): `ConcordantieQueryTests.Forward_returns_all_leerplandoelen_concorded_to_a_minimumdoel` seeds MD "6-12" + LP-1, LP-2 (both ref "6-12") + LP-3 (null ref), then asserts `LeerplandoelenVoorMinimumdoelAsync("6-12")` returns exactly `["LP-1","LP-2"]` — real, non-vacuous (excludes the null-ref doel).
  - Reverse (leerplandoel → minimumdoel): `Reverse_returns_the_minimumdoel_for_a_concorded_leerplandoel` asserts `MinimumdoelVoorLeerplandoelAsync("LP-1")` returns the MD with `Ref == "4-3"`.
  - Round-trip consistency: `Lookups_are_consistent_in_both_directions` walks forward then back for each result and asserts the ref matches.
  - Query impl (`ConcordantieQuery.cs`) keys both directions on `Leerplandoel.MinimumdoelRef == Minimumdoel.Ref` (Excel D = B+C), as required.

- **AC2 — Doelsoort enum (MD/G/+/P/S/A) recognised end-to-end via single-source `DoelsoortCode` (no duplication).** PASS.
  - `DoelsoortCodesTests.ToCode_returns_the_official_short_code` is a `[Theory]` covering all six codes MD/G/+/P/S/A.
  - `FromCode` parses case-insensitively and trims; `Every_enum_value_round_trips_through_code` iterates `Enum.GetValues<Doelsoort>()`; `FromCode_throws_on_an_unknown_code` ("ZZ") fails loudly; `TryFromCode` handles unknown/empty/null.
  - Single-source reuse confirmed: `DoelsoortCodes` (Domain) is the only mapping; `LeerplandoelConfiguration` persists via a `ValueConverter` calling `d.ToCode()` / `DoelsoortCodes.FromCode(code)` — no second copy. `CurriculumModelConfigurationTests.Leerplandoel_doelsoort_is_stored_as_its_short_code_string` asserts the converter emits "MD"/"+".

- **AC3 — Partial/invalid `minimumdoelRef` must NOT create a phantom link; surfaced, not silently linked/dropped.** PASS — proven at two layers.
  - Pure build logic: `ConcordantieBouwerTests.Bouw_surfaces_an_orphaned_ref_without_creating_a_phantom_link` feeds LP-1 ref "6-" (partial B-only key) against known refs {"6-12","4-3"} and asserts `Links` empty, `VerweesdeRefs` has exactly the (LP-1, "6-") orphan, and `IsVolledig == false`. `Bouw_separates_resolvable_links_from_orphans_in_a_mixed_set` confirms a mixed set splits correctly; `Bouw_skips_a_leerplandoel_without_a_ref` confirms a null ref is neither linked nor orphaned.
  - Query layer: `ConcordantieQueryTests.Reverse_returns_null_when_the_ref_matches_no_minimumdoel` (ref "9-99", no MD row) returns null — no phantom — even though the in-memory provider does not enforce the FK. `Forward_returns_empty_for_an_unknown_minimumdoel` returns empty.
  - DB-level guarantee: `LeerplandoelConfiguration` declares a nullable FK `MinimumdoelRef → Minimumdoel.Ref` (`OnDelete Restrict`), present in the E1-01 migration as `FK_leerplandoelen_minimumdoelen_MinimumdoelRef` + `IX_leerplandoelen_MinimumdoelRef`. Postgres therefore rejects persisting a non-null ref that matches no minimumdoel — phantom coverage is structurally impossible.

## Commands run
- `dotnet tool restore` → restored dotnet-ef 10.0.9.
- `dotnet test` (full suite) → **Passed: 111 unit, 0 failed; Passed: 7 integration, 0 failed** (matches implementer report).
- `dotnet test tests/Jaarplanner.UnitTests --filter "FullyQualifiedName~Concordantie|FullyQualifiedName~Doelsoort"` → 36 passed, 0 failed (Concordantie* + Doelsoort* run and pass).
- `dotnet ef migrations has-pending-model-changes --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api` → **"No changes have been made to the model since the last migration."**

## Evidence
- Migration `20260630073510_CurriculumReadOnlyEntities.cs` already contains `FK_leerplandoelen_minimumdoelen_MinimumdoelRef`, `IX_leerplandoelen_MinimumdoelRef`, and the nullable `MinimumdoelRef` column — confirming the implementer's claim that no new migration was needed (concordance reuses the E1-01 FK + index). `has-pending-model-changes` reports clean, so no migration was silently skipped.
- Assertions inspected are concrete (exact code arrays, exact refs, empty/single collections) — not vacuous.

## Defects
None.
