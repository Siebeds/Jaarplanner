# E0-01 — Repository structure & solution layout

## Build round 1 — .NET solution skeleton + layering

- **FR / Article:** Constitution Art. VIII (Tech Stack & Architecture — pragmatic layering
  `Domain ← Application ← Infrastructure`, thin `Api`, xUnit, current .NET LTS); Art. II
  (project names keep Dutch domain identifier `Jaarplanner`, infra/tooling English).
  Epic E0 (Project Foundation & Scaffolding), Milestone M0.

### What was created

Backend solution under `backend/` and a frontend placeholder under `frontend/`:

- `backend/Jaarplanner.sln` — single solution (classic `.sln` format, as the story requires).
- `backend/src/Jaarplanner.Domain/` — empty class library (no project refs).
- `backend/src/Jaarplanner.Application/` — empty class library.
- `backend/src/Jaarplanner.Infrastructure/` — empty class library.
- `backend/src/Jaarplanner.Api/` — ASP.NET Core Web API (`dotnet new webapi`, minimal-API
  template); WeatherForecast sample trimmed out, OpenAPI wiring kept.
- `backend/tests/Jaarplanner.UnitTests/` — xUnit project, one placeholder smoke test.
- `backend/tests/Jaarplanner.IntegrationTests/` — xUnit project, one placeholder smoke test.
- `backend/.gitignore` — ignores `bin/`, `obj/`, IDE files.
- `frontend/README.md` — placeholder noting the React + TS + Vite SPA is scaffolded in E0-05.

The default template `Class1.cs` files (Domain/Application/Infrastructure) and `UnitTest1.cs`
files were removed; the WeatherForecast endpoint + record were stripped from `Program.cs`.

### Project reference graph (verified via `dotnet list … reference`)

```
Jaarplanner.Domain          -> (none)
Jaarplanner.Application      -> Jaarplanner.Domain
Jaarplanner.Infrastructure   -> Jaarplanner.Application        (Domain transitive)
Jaarplanner.Api              -> Jaarplanner.Application, Jaarplanner.Infrastructure
Jaarplanner.UnitTests        -> Jaarplanner.Domain, Jaarplanner.Application, Jaarplanner.Infrastructure
Jaarplanner.IntegrationTests -> Jaarplanner.Api
```

This enforces the dependency direction `Domain ← Application ← Infrastructure` with a thin
`Api` for composition/DI only. Domain has zero project references, so it cannot depend
upward — the layering is structurally guaranteed by the compiler.

### Key decisions / assumptions

- **SDK:** `dotnet --version` = `10.0.201`. The machine's installed SDK is .NET 10
  (the current LTS), so all projects target `net10.0`. Per the story, **no `global.json`
  was added** (SDK pinning is E0-02).
- **`.sln` vs `.slnx`:** the .NET 10 `dotnet new sln` defaults to the new XML `.slnx`
  format. The story's acceptance criterion explicitly names `backend/Jaarplanner.sln`, so
  the solution was regenerated with `--format sln` to produce a classic `.sln`. All
  `dotnet build/test/format` commands work against it.
- **Api template trimmed:** removed the WeatherForecast sample endpoint and record so the
  app builds empty. Kept the template's `AddOpenApi()` / `MapOpenApi()` / `UseHttpsRedirection()`
  scaffold (default template output) — no health endpoint or DI wiring added (that is E0-04).
- **Placeholder tests:** each test project has one trivial passing test so `dotnet test`
  reports green rather than "no tests". They assert nothing about behaviour; real
  domain/coverage/import tests come with their respective stories.
- **No EF Core / Npgsql / ClosedXML / Azure packages added** — out of scope for E0-01.
- **Open decision (Art. XIV):** none touched. No domain entities, no Excel mapping, no
  planningsblok granularity assumptions were introduced.

### Tests added

- `Jaarplanner.UnitTests/SolutionLayoutTests.Skeleton_builds_and_tests_run` — pins that the
  unit-test project compiles and the test runner is wired.
- `Jaarplanner.IntegrationTests/SolutionLayoutTests.Skeleton_builds_and_tests_run` — same for
  the integration-test project.

### Gates

Run from `backend/`:

- `dotnet build Jaarplanner.sln` -> **Build succeeded. 0 Warning(s), 0 Error(s).**
- `dotnet test Jaarplanner.sln` -> **Passed! UnitTests 1/1, IntegrationTests 1/1.**
- `dotnet format Jaarplanner.sln --verify-no-changes` -> **exit 0 (clean).**
- Frontend gates (`pnpm lint/test/build`): **N/A** — no frontend app in this story (E0-05).

### Branch

`story/E0-01`

### Self-check vs acceptance criteria

- *Solution builds empty (`dotnet build` succeeds, no errors)* -> **met** (0/0 warnings/errors).
- *Layering enforced via project references, direction `Domain ← Application ← Infrastructure`,
  Api thin* -> **met** (see reference graph; verified with `dotnet list … reference`).
  - Domain references nothing -> met.
  - Application -> Domain only -> met.
  - Infrastructure -> Application (Domain transitive) -> met.
  - Api -> Application + Infrastructure -> met.
  - UnitTests / IntegrationTests reference what they need -> met.
- *All projects in a single `backend/Jaarplanner.sln`* -> **met** (6 projects added; classic `.sln`).

### For the test-runner

This is a structural skeleton — **unit/CLI verification only, no Playwright** (no running
UI, no HTTP endpoints). To verify, from the repo's `backend/` directory:

```
dotnet build Jaarplanner.sln          # expect: Build succeeded, 0 errors
dotnet test  Jaarplanner.sln          # expect: 2 passed, 0 failed
dotnet format Jaarplanner.sln --verify-no-changes   # expect: exit 0
```

Confirm the reference graph:

```
dotnet list backend/src/Jaarplanner.Domain/Jaarplanner.Domain.csproj reference         # none
dotnet list backend/src/Jaarplanner.Application/Jaarplanner.Application.csproj reference # Domain
dotnet list backend/src/Jaarplanner.Infrastructure/Jaarplanner.Infrastructure.csproj reference # Application
dotnet list backend/src/Jaarplanner.Api/Jaarplanner.Api.csproj reference                # Application + Infrastructure
```

### Open questions / Art. XIV touched

None. SDK pinning (`global.json`), the health endpoint + DI wiring, EF Core/Npgsql, the
frontend Vite app, and CI are deliberately deferred to E0-02/E0-04/E0-05/E0-08 respectively.
