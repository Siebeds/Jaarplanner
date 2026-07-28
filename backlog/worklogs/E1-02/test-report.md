# Test Report — E1-02 School-content entities (autonomous, level-scoped)

**Verdict: PASS**
**Mode:** unit/integration (xUnit) + EF migration/DDL inspection — no UI/Playwright (backend data-model story, no API surface).

## Criteria → result

| # | Acceptance criterion | Result | Evidence |
|---|---|---|---|
| 1 | Migration creates themas, themadoelen, subthemas, subdoelen, activiteiten (+ DoelKoppeling join) and klassen | PASS | `20260630084646_SchoolContentEntities.cs` creates all 7 tables (join landing as owned `activiteiten_Doelkoppelingen`; themadoelen/subdoelen embed their single owned koppeling). |
| 2 | Level scoping enforced structurally | PASS | `themas` has `Kernwoordenschat`/`RijkeWoordenschat text[] NOT NULL` and **no class column**; `subthemas` has `"KlasId" uuid NOT NULL` FK `REFERENCES klassen("Id")` + `"Leeftijd" varchar(8) NOT NULL`; `subdoelen`/`activiteiten` inherit class scope via required `SubthemaId` FK. Structural (ctor throws on empty klasId/leeftijd; configs `IsRequired()`), not a nullable flag. |
| 3 | DoelKoppeling status enum + aiMotivatie + FK to leerplandoelen.Code; E1-01 immutable | PASS | `KoppelingStatus` (Voorgesteld/Aanvaard/Geweigerd/Manueel) persisted by name; `ai_motivatie` nullable; all 3 koppeling landings FK `REFERENCES leerplandoelen("Code") ON DELETE RESTRICT`. `git diff 69211b9..e86f66d` shows zero changes to curriculum entities/configs/E1-01 migration — only additive `DbSet`s. |

## Key facts
- **Tests:** `dotnet test` → **73 unit passed, 7 integration passed, 0 failed**.
- **Live apply:** did NOT run — `docker compose up -d db` failed (`docker: command not found`); `dotnet ef database update` not attempted. **Substituted** with `dotnet ef migrations script --idempotent` → valid Postgres DDL; all NOT NULL scoping columns and FK constraints confirmed by inspection.

## Notes (non-blocking)
- IntegrationTests suite not extended for school content (still 7 E1-01 tests). Not required by the AC; a live runtime round-trip of FK/NOT NULL is impossible without Docker/Postgres. Worth adding once a DB is available.
