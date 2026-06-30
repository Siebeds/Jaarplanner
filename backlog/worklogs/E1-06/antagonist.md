# Antagonist Review — E1-06 Discipline selection (starter set vs all)

**Verdict:** COMPLIANT
**Scope audited:** `git diff 85b0c3a..95e3df9` on branch `story/E1-06` — 12 files: `IDisciplineSelectie` seam, `DisciplineSelectieOptions`, `GeconfigureerdeDisciplineSelectie`, `OpstapImportService` wiring, DI, appsettings, csproj, two test files, ADR-0019, ADR index, worklog.

## Ruling on the Art. XIV question (the whole point of the story)
**The default `Modus = Alle` is a config-space placeholder, NOT a compiled-in answer to the open decision.** Verified rigorously:
- Behaviour is a **pure function of bound configuration** — `GeconfigureerdeDisciplineSelectie.IsInScope` switches solely on `options.Modus`/`options.Disciplines`. No discipline list anywhere in logic (grepped the committed delta for all 11 discipline name literals → zero hits; the only number literals are in appsettings comments + test data).
- `Modus = Alle` is the property-initialiser default (what an unconfigured deployment resolves to), overridable to `Selectie` purely via the `Opstap:DisciplineSelectie` config section — no recompile. Tests `Options_bind_from_configuration_...` and `Changing_the_config_changes_the_behaviour_with_no_code_change` prove the choice travels as data and flips outcome with config alone.
- Documented as deferred-not-decided in three places (appsettings `_comment`, options XML doc, ADR-0019).

A "baked-in import all" violation would require the import path unconditionally processing every discipline with no overridable seam, or `Alle` being unreachable-to-override. Neither holds. **`Alle` is the unconfigured resolution of a data-driven seam — the acceptable outcome the story asked for.**

## Findings — no violations

### [MINOR] `Alle` modus admits disciplines never named in Art. VII.0
- `GeconfigureerdeDisciplineSelectie.cs:60` (`Alle => true`). Any non-blank disciplineNummer is in scope, incl. a number outside the canonical set. Not a breach — the seam's job is scope selection, not taxonomy validation (parser owns identity correctness). No action.

### [QUESTION] `Selectie` + empty list silently admits nothing
- A misconfiguration (`Modus = Selectie`, `Disciplines = []`) skips all imports. Safe (skip never mutates) and explained by the Dutch review notice. Flagged so the directie knows it resolves to "import nothing" rather than erroring. No action mandated.

## Checks run
- **Art. XIV (primary)** — seam end-to-end inspected; no discipline literal drives behaviour; pure function of config, proven by tests. PASS — open decision behind a seam, not answered in code.
- **Art. III** — out-of-scope disciplines skipped before any data touched (nothing inserted/flagged/deleted), mirroring the empty-file guard; tested. Curriculum read-only untouched. PASS.
- **Art. VII.0** — seam scopes by disciplineNummer only; no per-discipline cluster rule; cluster stays nullable. PASS.
- **Art. VIII** — interface in Application, config impl + options in Infrastructure; thin DI wiring; one authorised first-party package (`Microsoft.Extensions.Options.ConfigurationExtensions` 10.0.9); DB-table alternative correctly rejected in ADR-0019 as heavier than needed. PASS.
- **ADR-0019** — exists, follows repo ADR structure + compliance trace (`Art. XIV, III, VII.0, VIII, II | E1-06 | FR-2`), wired into index + traceability matrix + open-decisions note; accurately records "build the seam, defer the choice to config"; default explicitly a placeholder. PASS. (Note: CLAUDE.md ADR-range header still read "0001…0018" — out of this story's scope; orchestrator fixed it 0018→0019 on landing.)
- **Art. II** — Dutch domain seam names; infra English; skip-notice/Omschrijving are server-side diagnostic strings (import-diff opmerkingen), not UI strings → correctly not in nl.json; no frontend touched. PASS.
- **Art. VI** — no secrets; appsettings carries only non-secret config. PASS.
- **Art. X / DoD** — dedicated test file (selection seam + binding + end-to-end), existing tests updated to new ctor with no regression; small reviewable change. PASS.
- **Scope creep** — no rework of parser/import-diff beyond plugging in the seam; no CRUD/shared-library/AI/coverage/UI. PASS.

## Open questions surfaced
- **Art. XIV "Disciplines first"** correctly left unresolved; deferred to runtime config. ADR-0019's follow-up (set `Opstap:DisciplineSelectie` + record the resolution in Art. XIV when directie decides) is the right closure path.

**Conclusion:** COMPLIANT — DONE w.r.t. the constitution. The two MINOR/QUESTION items need no action. (Post-merge: orchestrator ran integrated `dotnet test` — 235 unit + 12 integration passing.)
