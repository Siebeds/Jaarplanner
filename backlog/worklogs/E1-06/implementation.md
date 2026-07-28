# E1-06 — Discipline selection (starter set vs all)

## Build round 1 — data-driven discipline-selection seam (no choice compiled in)

- **FR / Article:** FR-2; Art. XIV ("Disciplines first" open decision behind a seam; "cluster presence" kept non-assuming), Art. III (import is the sanctioned writer), Art. VII.0 (taxonomy; `cluster` nullable), Art. VIII (config-driven, no over-engineering), Art. II (Dutch domain language). New ADR-0019.

### What was built — the seam
The story is explicitly an Art. XIV open decision the code **must not answer**. So the deliverable is the *seam* that keeps "all vs. a starter selection" a **runtime-config choice**, not a compiled-in one.

- **`IDisciplineSelectie`** (Application) — the seam: `bool IsInScope(string disciplineNummer)` + `string Omschrijving` (Dutch, for review notices). The import path asks this; the answer is never a list in logic.
- **`DisciplineSelectieOptions`** (Infrastructure) — options bound from config section **`Opstap:DisciplineSelectie`**: `Modus` (`Alle` | `Selectie`) + `Disciplines` (the in-scope numbers when `Selectie`). Default `Modus = Alle`.
- **`GeconfigureerdeDisciplineSelectie`** (Infrastructure) — config-driven `IDisciplineSelectie`; behaviour is a pure function of the options. **No discipline list anywhere in its logic.**
- **`OpstapImportService`** now consults the seam *first*: an out-of-scope discipline is **skipped** (nothing inserted/flagged/deleted) with a Dutch review notice (`Overgeslagen = true`), mirroring the existing empty-file guard. The seam is injected (DI); legacy parameterless `(context)` / `(context,bool)` ctors were replaced with `(context, IDisciplineSelectie)` / `(context, IDisciplineSelectie, bool)` so the seam can never be silently bypassed.

### How it is data-driven (where config lives, how to override)
- Config section: **`Opstap:DisciplineSelectie`** in `appsettings.json` (also overridable via environment, user-secrets, Key Vault — any standard .NET config source).
- Bound in `AddInfrastructure` via `services.Configure<DisciplineSelectieOptions>(section)` + `AddSingleton<IDisciplineSelectie, GeconfigureerdeDisciplineSelectie>()`.
- **Import all:** `Modus = "Alle"`. **Import a subset:** `Modus = "Selectie"`, `Disciplines = ["1","2","6"]`. Same code; **config alone decides** — proven by a test that runs one identical import call under two configs and gets two outcomes with no code change.

### Documented safe default (and that it is an overridable placeholder)
- Absent config → `Modus = Alle`. This lives in **configuration space** (it is what an unconfigured deployment resolves to), is overridable purely by adding the section, and is documented as a **placeholder pending the Art. XIV directie decision** — in the `DisciplineSelectieOptions` XML doc, in `appsettings.json` (`_comment` key), in the DI comment, and in ADR-0019. It is explicitly *not* the project's answer to "which disciplines first".

### Cluster-presence concern (kept non-assuming)
The seam scopes by discipline **number only** and makes no statement about whether a discipline's Excel carries a `cluster` column. `cluster` stays nullable (Art. VII.0); no per-discipline cluster rule is baked anywhere. Documented in `IDisciplineSelectie` / `DisciplineSelectieOptions`.

### Files changed
- `backend/src/Jaarplanner.Application/Curriculum/Import/IDisciplineSelectie.cs` — new seam abstraction.
- `backend/src/Jaarplanner.Infrastructure/OpstapImport/DisciplineSelectieOptions.cs` — config options (modus + list) + placeholder-default doc.
- `backend/src/Jaarplanner.Infrastructure/OpstapImport/GeconfigureerdeDisciplineSelectie.cs` — config-driven implementation (no list in logic).
- `backend/src/Jaarplanner.Infrastructure/OpstapImport/OpstapImportService.cs` — consult seam first; skip out-of-scope discipline with a notice; seam-injecting ctors.
- `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — bind options + register the seam.
- `backend/src/Jaarplanner.Infrastructure/Jaarplanner.Infrastructure.csproj` — add `Microsoft.Extensions.Options.ConfigurationExtensions` 10.0.9 (options-pattern config binding).
- `backend/src/Jaarplanner.Api/appsettings.json` — documented placeholder section `Opstap:DisciplineSelectie`.
- `backend/tests/Jaarplanner.UnitTests/Curriculum/OpstapImportDisciplineSelectieTests.cs` — new tests proving data-driven, not compiled in.
- `backend/tests/Jaarplanner.UnitTests/Curriculum/OpstapImportServiceTests.cs` — inject an explicit "all in scope" selection into the existing E1-05 tests (seam ctor change).
- `docs/adr/0019-discipline-selection-config-seam.md` — new ADR; wired into `docs/adr/README.md` index + traceability matrix.

### Key decisions
- **Options pattern, not a DB table.** Art. VIII (don't over-engineer): config already makes the set runtime-switchable. The `IDisciplineSelectie` interface leaves room to swap in a data-source-backed implementation later with no change to the import path.
- **Out-of-scope = skip + notice**, identical to the empty-file guard — no destructive over-reaction; existing rows of an out-of-scope discipline are left untouched (pinned by a test).
- **No silent-"all" fallback ctor** on the service; the seam is always injected so it cannot be bypassed.

### Tests added (all in `OpstapImportDisciplineSelectieTests`)
- `Alle_modus_admits_every_discipline` (theory, 4 numbers incl. `9.2`) — `Alle` admits everything.
- `Selectie_modus_admits_only_the_configured_numbers` — subset admits only the listed ones.
- `Configured_numbers_are_trimmed_and_matched_exactly` — trim/ordinal matching.
- `Selectie_modus_with_no_configured_numbers_admits_nothing` — empty selection behaves safely.
- `Unconfigured_options_default_to_the_all_placeholder` — default is the documented placeholder, resolved from config space.
- `Options_bind_from_configuration_so_the_directie_sets_scope_without_a_code_change` — built from raw `ConfigurationBuilder` key/values via the standard options path → proves the choice travels as data.
- `Import_accepts_every_discipline_when_configured_all` — end-to-end "all".
- `Import_processes_only_in_scope_disciplines_and_skips_the_rest_when_configured_subset` — end-to-end subset; out-of-scope skipped with a notice, row never persisted.
- `Changing_the_config_changes_the_behaviour_with_no_code_change` — one identical import call, two configs, two outcomes (the headline data-driven proof).
- `Out_of_scope_skip_never_touches_existing_rows_of_that_discipline` — non-destructive skip.

### Gates
- `dotnet build` ✓ (0 warnings, 0 errors)
- `dotnet format --verify-no-changes` ✓ (clean)
- `dotnet test` ✓ — **235 unit** (was 222; +13: 10 new selection tests incl. theory cases, existing suite unchanged) + **12 integration**, 0 failed.
- Frontend gates: not applicable (backend-only story; no UI).
- Migration: **none** (options/config pattern, no DB-backed table — preferred per the story).

### Branch
`story/E1-06` (rebased onto `feature/e1-curriculum-content` @ 85b0c3a).

### Self-check vs acceptance criteria
- *Done when: the choice is data-driven, not compiled in.* → **Met.** No discipline list drives any logic; `GeconfigureerdeDisciplineSelectie` is a pure function of `DisciplineSelectieOptions` bound from `Opstap:DisciplineSelectie`. `Changing_the_config_changes_the_behaviour_with_no_code_change` proves one identical call yields skip vs. import purely from config. The default (`Alle`) is an overridable placeholder in config space, documented as pending the Art. XIV directie decision — not an answer baked into logic.

### For the test-runner
- **Unit only** — no UI, no API endpoint, no Playwright. Verify via:
  `cd backend && dotnet test --filter FullyQualifiedName~OpstapImportDisciplineSelectieTests`
- To see data-driven behaviour by hand: edit `backend/src/Jaarplanner.Api/appsettings.json` → `Opstap:DisciplineSelectie:Modus` to `Selectie` and set `Disciplines` to e.g. `["1"]`; the import path then skips any other discipline with a Dutch notice (`OpstapHerimportDiff.Overgeslagen = true`) and persists nothing for it — with no code change.

### Open questions / Art. XIV touched
- The actual "which disciplines first" decision is **deliberately left to the directie** as `Opstap:DisciplineSelectie` config (Art. XIV). When resolved, set the config and record it in Art. XIV — no code change. The companion "cluster presence per discipline" open decision is kept non-assuming (scope by number only; `cluster` stays nullable).
