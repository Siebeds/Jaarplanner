# E1-06 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (xUnit) — no UI/Playwright (backend/config story)

## Acceptance criterion
"The discipline-import selection is data-driven, NOT compiled in. Neither 'all' nor a
specific subset may be hard-coded in logic; the same code yields either purely depending
on external configuration. A safe documented default is acceptable only if it lives in
config-space and is overridable without a code change."

→ PASS — see criteria breakdown and evidence below.

## Criteria checked
- "Selection is data-driven, not compiled in" → PASS — `GeconfigureerdeDisciplineSelectie.IsInScope`
  (GeconfigureerdeDisciplineSelectie.cs:50-63) is a pure function of the bound
  `DisciplineSelectieOptions`: `Alle => true`, `Selectie => _disciplines.Contains(...)`.
  `_disciplines` is built only from `options.Disciplines` (ctor lines 41-47). No discipline
  list/number is compiled into the logic.
- "The same code yields either 'all' or a subset depending on external config" → PASS —
  `Changing_the_config_changes_the_behaviour_with_no_code_change` (test lines 188-214) runs the
  SAME `ImporteerAsync(Parse("2", ...))` call under two configs: with `Disciplines=["1"]` the
  import is skipped (Overgeslagen, 0 rows in DB); with `Disciplines=["1","2"]` the identical
  call imports (Toegepast, Toegevoegd == ["WI-1"], 1 row). Config-only difference, opposite
  outcomes.
- "Options bind from external configuration" → PASS —
  `Options_bind_from_configuration_so_the_directie_sets_scope_without_a_code_change`
  (lines 118-139) builds options from a raw `ConfigurationBuilder.AddInMemoryCollection` with
  keys `Opstap:DisciplineSelectie:Modus=Selectie`, `Disciplines:0=2`, `Disciplines:1=6`, binds via
  `GetSection(SectionName).Bind(...)`, and asserts IsInScope("2")/("6") true, ("1") false.
- "'all' mode accepts every discipline" → PASS — `Alle_modus_admits_every_discipline`
  [Theory] over "1","2","9.2","11" (lines 48-59) all return true.
- "'Selectie' mode accepts only listed disciplines" → PASS —
  `Selectie_modus_admits_only_the_configured_numbers` (lines 61-76): "1","2","6" true; "3","9.2"
  false. `Selectie_modus_with_no_configured_numbers_admits_nothing` (lines 93-101) confirms empty
  list admits nothing.
- "Import service consults the seam and skips out-of-scope disciplines (nothing inserted/
  flagged/deleted)" → PASS — `OpstapImportService.ImporteerAsync` (lines 104-129) checks
  `_disciplineSelectie.IsInScope(disciplineNummer)` BEFORE touching any data; out-of-scope returns
  a skipped diff (Overgeslagen=true, empty Toegevoegd, review notice). Proven by
  `Import_processes_only_in_scope_disciplines_and_skips_the_rest_when_configured_subset`
  (lines 159-186): in-scope "1" imported, out-of-scope "2" skipped, only 1 row in DB, no row with
  DisciplineNummer=="2". `Out_of_scope_skip_never_touches_existing_rows_of_that_discipline`
  (lines 216-238) proves a re-import while out-of-scope leaves prior rows intact —
  Verdwenen empty, count==2, no NietMeerInOpstap flag set.
- "The seam is always injected (cannot be bypassed)" → PASS — both `OpstapImportService` ctors
  require `IDisciplineSelectie` and throw `ArgumentNullException` if null (lines 74-94). DI
  registers it as the only path (DependencyInjection.cs:54,
  `services.AddSingleton<IDisciplineSelectie, GeconfigureerdeDisciplineSelectie>()`).
- "Documented default lives in config-space, overridable without a code change" → PASS —
  `DisciplineSelectieOptions.Modus` defaults to `Alle` (DisciplineSelectieOptions.cs:45), resolved
  through the standard options-binding path; it is the value an unconfigured deployment resolves
  to, not a decision in logic. `appsettings.json` (lines 9-15) carries the explicit overridable
  section `Opstap:DisciplineSelectie` with `Modus="Alle"`, `Disciplines=[]` and a comment marking
  it an overridable placeholder pending the Art. XIV directie decision. DI binds it via
  `services.Configure<DisciplineSelectieOptions>(configuration.GetSection(...))`
  (DependencyInjection.cs:52-53). `Unconfigured_options_default_to_the_all_placeholder`
  (lines 105-116) pins the documented default behaviour.

## Commands run
- `dotnet tool restore` → success (dotnet-ef 10.0.9 restored)
- `dotnet test` (full suite) → Passed: 235 unit (0 failed), 12 integration (0 failed)
- `dotnet test --filter FullyQualifiedName~OpstapImportDisciplineSelectieTests` → Passed: 13, 0 failed
- `dotnet ef migrations has-pending-model-changes` → "No changes have been made to the model since
  the last migration." (no migration drift — none needed for a config-only story)
- Grep for hard-coded discipline list driving import scope → the only ["1","2","6"]-style literal
  in production source is an XML doc comment EXAMPLE in DisciplineSelectieOptions.cs:48; no code
  path uses a literal discipline list. The ["1","2","6"] in appsettings.json is in the `_comment`
  documentation field, not the active `Disciplines` array (which is []).

## Evidence
- Seam: IDisciplineSelectie (Application/Curriculum/Import/IDisciplineSelectie.cs) — decides scope
  by discipline number only.
- GeconfigureerdeDisciplineSelectie.IsInScope switches purely on options.Modus + options.Disciplines.
- OpstapImportService.cs:111 — `if (!_disciplineSelectie.IsInScope(disciplineNummer))` gates all
  data access; skip path mirrors the empty-file guard (no insert/flag/delete).
- DI wiring: DependencyInjection.cs:52-54 binds options from config + registers the seam.
- Config: backend/src/Jaarplanner.Api/appsettings.json lines 9-15 — overridable placeholder section.
- Test counts and named-test assertions as above.

## Defects
None.
