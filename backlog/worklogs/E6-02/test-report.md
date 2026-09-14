# E6-02 slice 1 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration, plus a live API spot-check against a throwaway database (no UI in this slice, so no Playwright)
**Change verified:** `d6460ef` on `story/E6-02-fundament` (on top of `60020b9`)

*Recorded by the orchestrator from the test-runner's final message: the test-runner's session had no Write tool and it
did not work around that through Bash. The content below is its report, condensed only in layout.*

## Criteria checked

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Model and one migration | PASS | `GebruikerTests` pin themabeheer grant/revoke (idempotent). Klastoewijzing is unique per pair on Postgres, and a second leerkracht on one klas is allowed. Several hoofdleerkrachten per jaarfase, a duplicate throws, no klastoewijzing needed (`Een_hoofdleerkracht_zonder_klastoewijzing_heeft_toch_het_recht`). Maker set to the caller over HTTP on `POST /api/subthemas/{id}/activiteiten`, null for the FR-1 import (`SchoolcontentImportServiceTests`) and for existing rows (nullable column), set to null (not deleted) when the gebruiker is removed. Removing a gebruiker removes its klastoewijzingen and aanstellingen; removing a klas removes its klastoewijzingen. The migration applies to a fresh database; `has-pending-model-changes` reports none. |
| 2 | One rights service | PASS | Unit: the last school day counts and the day after does not; a year not yet started counts; an ended year does not. Postgres: 21:59Z on 30 June counts, 22:30Z does not (Brussels midnight). LK eigen has no end date. `Leeftijdsrechten.VoorKlas` is the one klas→leeftijden mapping, used only by `Rechtenberekening`; nothing in the rights code uses `Klasleeftijden`. A klas without a valid jaarfase grants nothing (six unit cases plus a legacy row on Postgres). A graadklas grants only its stated jaarfase. The union rule is tested in the service and the matrix. |
| 3 | Named policies in one place | PASS | 16 rows, each registered as "signed in" plus the row requirement. `RechtenmatrixTests` checks 112 row × relation cases against §3, with a guard against a row added without a test. Maker deletes only without links (any link blocks, `HeeftDoelkoppelingen = Any()`); HL deletes anything; LK leeftijd moves only without links and being the maker gives no move right; directie passes every row. Mistakes fail closed: a missing or wrong resource, or a resource row used as an attribute. |
| 4 | `Curriculumbeheer` is directie-only | PASS | A gebruiker with themabeheer, an HL appointment and a klastoewijzing gets 403 on `POST /api/opstap-import` and `GET /api/opstap-import/stand`; directie gets 400 (reaches the controller); no session gets 401. The test client always sends the CSRF header, so the 403 is the policy's. |
| 5 | `GET /api/ik` shape and the frontend `Ik` type | PASS | The eight JSON property names and values are pinned in a test. `aanmelding.ts` is updated and both fixtures carry the new fields. `tsc` is clean. |
| 6 | Development sign-in and tenant-free tests | PASS | Live: signing in as three gebruikers gives 302, then 200 on `/api/ik`. `TestAuthenticatie` lives only in the test project and nothing in `backend/src` references it. The principal carries only the gebruiker-id claim; the directie shortcut applies only to the default test id, which has no database row, and the rights tests use seeded ids that go through the real `RechtenService`. |

## Commands run
- `dotnet build` → succeeded, 0 warnings.
- Unit tests → 1301 passed, 4 skipped (opt-in live KOV tests), 0 failed.
- Integration tests with `JAARPLANNER_TEST_POSTGRES` on `jaarplanner-db` (port 5433) → 381 passed, 1 skipped (opt-in live import), 0 failed. All 14 `RechtenEndpointsTests`, 8 `RechtenbeleidTests` and 4 `CurriculumbeheerAutorisatieTests` ran.
- `dotnet format --verify-no-changes` → clean. `has-pending-model-changes` → no changes.
- `pnpm lint` → exit 0; `pnpm test` → 233 passed; `pnpm build` → OK (the >500 kB chunk warning predates this change).

## Evidence: live check
Throwaway database `jp_spotcheck_e602`, API in Development on port 5391 (environment variables override user-secrets, so the owner's dev database was not touched); the API was stopped and the database dropped afterwards. Seeded on 2026-09-14: a leerkracht with themabeheer and klassen K3 (current year), L4 (last year) and a legacy klas without jaarfase; HL appointments L2 (next year), L6 (last year), K2 (2028-29); and a gebruiker without rights.
- `/api/ik` for the leerkracht: hoofdleerkracht `["K2","L2"]`, leeftijd `["K3"]`, all three klassen as eigen klassen.
- `POST /api/opstap-import` with the CSRF header: leerkracht 403, gebruiker without rights 403, directie 400 ("Er is geen bestand meegestuurd."), no session 401.
- `GET /api/opstap-import/stand`: leerkracht 403, directie 200.
- Deleting the 2028-29 schooljaar removed its appointment; `/api/ik` then showed only `["L2"]`.

## Defects
None.

## Non-blocking notes
- No automated test covers "deleting a schooljaar removes its hoofdleerkracht appointments" (cascade set in the migration and confirmed live).
- Only a `manueel` link is exercised for "any link blocks the maker's delete".
- `MagAsync` through the registered policies is tested only for directie and anonymous; HTTP-level tests for the other resource rows belong to slice 3.

## Round 2

**Verdict:** PASS
**Mode:** unit/integration (no frontend file changed; no live spot-check needed)
**Change verified:** `138a605` on top of `d6460ef`

*Recorded by the orchestrator from the test-runner's final message (no Write tool in its session).*

### Commands run
- `dotnet build` → 0 warnings, 0 errors.
- `dotnet test --no-build` with `JAARPLANNER_TEST_POSTGRES` on `jaarplanner-db` (127.0.0.1:5433): unit 1315 passed, 4 skipped (opt-in live KOV), 0 failed (round 1 plus 12 `LeeftijdsinhoudTests` and 2 `SchoolklokTests`); integration 382 passed, 1 skipped (opt-in live import), 0 failed (round 1 plus the new cascade test).
- `dotnet format --verify-no-changes` → exit 0. `has-pending-model-changes` → no changes.

### The new tests pin the behaviour
- `Zonder_zone_valt_de_klok_terug_op_UTC_en_waarschuwt_een_keer`: two calls on one `Eenmalig`, offset zero, equal results, exactly one `LogLevel.Warning`. `Met_de_zone_is_het_vandaag_in_Brussel`: 22:30Z on 30 June is 1 July, no warning. Callers get a real logger (`RechtenService` required; `ClosedXmlDekkingExport` optional but supplied by DI); all 26 `ClosedXmlDekkingExportTests` pass.
- `LeeftijdsinhoudTests`: every case asserts both `WatIsErMisMet` and `UitInvoer` (trim, case-sensitive, invalid codes, null/blank, and a K3 hoofdleerkracht passing `SubthemaBeheren` on `" K3"`).
- `Een_schooljaar_verwijderen_ruimt_zijn_hoofdleerkrachtaanstellingen_op`: deletes one schooljaar in a fresh context so only the database cascade can remove its appointment; the other year's appointment and the gebruiker survive. Closes round 1's first note.

### Criteria (round 1, from the suite)
All six PASS: `GebruikerTests` 19/19, `SchoolcontentImportServiceTests` 17/17, `RechtenberekeningTests` 23/23, `RechtenmatrixTests` 127/127, `RechtenbeleidTests` 9/9, `CurriculumbeheerAutorisatieTests` 4/4, `RechtenEndpointsTests` 15/15, `ElkeRouteVraagtEenSessieTests` 4/4.

### Defects
None.

### Non-blocking notes
- `UitInvoer` has no production caller yet; slice 3's review should check that request-body leeftijden go through it.
- "One warning across callers" rests on the shared static `Eenmalig`, not on a two-caller test.
- `Met_de_zone_is_het_vandaag_in_Brussel` fails on a host without tzdata/ICU (intended; a CI image without tzdata would go red).
- Round 1 miscounted `RechtenbeleidTests` (9, not 8).

## Round 3

**Verdict:** PASS
**Mode:** unit/integration (no frontend file changed; no live spot-check needed)
**Change verified:** `f75fb15` (code) and `bdb6683` (docs only) on top of `138a605`

*Recorded by the orchestrator from the test-runner's final message.*

### Commands run
- `dotnet build` → 0 warnings, 0 errors.
- `dotnet test --no-build` with `JAARPLANNER_TEST_POSTGRES` on `jaarplanner-db` (127.0.0.1:5433): unit 1340 passed, 4 skipped (opt-in live KOV), 0 failed (round 2's 1315 plus 25 `SubthemaLeeftijdInvoerTests`: 12 create, 12 re-scope, 1 sentence); integration 383 passed, 1 skipped, 0 failed (plus the new reflection test).
- `dotnet format --verify-no-changes` → exit 0. `has-pending-model-changes` → no changes.
- Filtered: all 37 `SubthemaLeeftijdInvoerTests` + `LeeftijdsinhoudTests` cases pass; all 5 `CurriculumbeheerAutorisatieTests` pass, including `Elke_controller_onder_de_opstap_importroute_noemt_het_curriculumbeheerbeleid`.
- `git diff --stat 138a605 bdb6683 -- backend/src/Jaarplanner.Api frontend` → empty.

### The rights check agrees with the real write path
`SubthemaLeeftijdInvoerTests` runs 12 inputs (trimmed valid, exact valid, invalid codes incl. lower case, blank/null) through the real `MaakSubthemaAsync` and `WijzigSubthemaAsync`: when `UitInvoer` returns a value the write succeeds and stores exactly the trimmed form; when it returns null the write throws `SchoolcontentValidatieFout`. Widening either side fails the test. The three callers of `Jaarfasen.LeesLeeftijd` are equivalent to their predecessors. `LeeftijdsinhoudTests` now asserts fixed values rather than comparing `UitInvoer` with the function it is built from.

### No refusal sentence or status changed
- Subthema leeftijd sentence identical at `138a605` and HEAD, still 400, now pinned verbatim by `De_weigering_van_het_schrijfpad_behoudt_haar_eigen_zin`.
- Klas jaarfase sentences (`WatIsErMisMet`) byte-identical in the diff; the existing `KlasJaarfaseTests` pin them only by substring.
- No file under `Api/` or `frontend/` changed.

### The reflection test fails when a controller lacks the policy
It requires exactly the four named controllers under `api/opstap-import`, a class-level `[Authorize(Policy = Curriculumbeheer)]` on each, and no `[AllowAnonymous]` on class or action. An action-only route or a leading-`/` template is outside it, and is covered by the endpoint-metadata test beside it.

### Defects
None.

### Non-blocking notes
- `VereisLeeftijd` now carries three stacked `<summary>` blocks (one stale from before, round 1's, round 2's); the doc comment reads badly.
- No test pins the klas jaarfase refusal sentences word for word.
- The endpoint test matches only a `RawText` without a leading `/` (predates this round).
