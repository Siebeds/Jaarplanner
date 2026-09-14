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


# E6-02 slice 3 — Test report (round 1)

**Verdict:** FAIL
**Mode:** unit/integration (backend only; no Playwright until slice 4)
**Change verified:** `d85c0a5` on `story/E6-02-afdwingen` (from `0073bd7`), incl. migration `20260914114237_Wizardrun`

*Recorded by the orchestrator from the test-runner's final message (no Write tool in its session). Condensed in layout only.*

## Criteria checked
- **1. Each matrix action allowed/denied per relation and resource, server-side, a test per row → PASS.** Every mutating route carries `[Authorize(Policy)]`, `[RechtOp]` or an in-action check (19 controllers, 79 write attributes, one of them the anonymous `afmelden`). `RechtenAfdwingingTests` (17): per row, the allowed relation gets the service's precise status, the nearest denied relation gets 403. Reads stay open (I9): `Lezen_mag_elke_gebruiker_ook_de_planning_van_een_andere_klas_I9`.
- **2. Sweep enumerates every mutating endpoint, expects 403, fails naming a route that loses its guard → FAIL (partial).** Enumeration from `EndpointDataSource`, real seeded ids, ≥70 requests, stale-entry check: pass. `[RechtOp]` removed from `PUT api/hoeken/{hoekId}` → the sweep failed and named it: pass. `Wizardinhoud` removed from `DELETE api/thema-opbouw/wizardruns/{runId}/activiteiten/{activiteitId}` → sweep, `WizardrunEndpointsTests` and `RechtenAfdwingingTests` stayed green (28/28): **D1**.
- **3. Body leeftijden through `UitInvoer`; null refused with the write's own 400 and sentence; never skips the rights check → FAIL (partial).** `L7`, `3K`, `k3`, `""` get the Dutch sentence; `" K3 "` accepted; I13 checked at both leeftijden. A literal `null` never reaches `UitInvoer`: **D2**.
- **4. FR-1 import (R35) → PASS.** HL 403; TB 400 (reached the controller, no file); TB with the option on 403 on both `/voorbeeld` and apply; directie with the option 400 on both. The option is checked before the file is read.
- **5a. Wizard endpoints admit TB and directie only → PASS** (`Een_hoofdleerkracht_gebruikt_de_wizard_niet`; the sweep, apart from D1).
- **5b. Run's own thema, open run, under 14 days since its last write → PASS.** Open while `nu < LaatsteSchrijfactieOp + 14 days` (`Wizardrun.IsOpen`); the unit test pins open at 14 days minus 1 s, closed at exactly 14 days. HTTP test edits `LaatsteSchrijfactieOp` on the real clock: open at 13 days and a write moves the window; at 14 days plus 1 minute 403 "Deze wizard is afgelopen.", for directie too. Afronden/sluiten end the run. Another thema's subthema → 403.
- **5c. I25 → PASS.** Run B on run A's subthema → 403; an HL's subthema under the run's thema → 403; missing → 404; a subthema holding a leerkracht's activiteit is not deleted (403, row still there).
- **5d. I18 → PASS.** `MakerId` equals the themabeheer caller.
- **5e. I22 / R33 → PASS.** TB gets 403 on the ordinary subthema create/PUT, activiteit create, subdoel create, and 201 on its open run's wizard route. Maker delete 204 without a link, 403 with one; a colleague of the same leeftijd 403; an HL 204.
- **Spot checks → PASS.** HL of K2 on K3 content 403 (create and re-scope); leerkracht of K3 blauw on K3 groen's hoeken, fiches, generatie, plaatsing delete, hoek PUT/DELETE → 403; own planning → 201 / reaches the service.
- **6. Existing directie tests unchanged; no pending model changes; migration applies → PASS.**
- **Slice-1 tests changed to seed rights → PASS.** Assertions unchanged; they still test maker = caller and the resolvers.

## Commands run
- `dotnet build` → 0 warnings, 0 errors.
- `dotnet test --no-build` (Postgres 127.0.0.1:5433): UnitTests 1355 passed, 4 skipped; IntegrationTests 411 passed, 1 skipped.
- `dotnet format --verify-no-changes` → exit 0. `has-pending-model-changes` → clean.
- Temporary null probe (copied in, run, deleted); two guard-removal probes (each restored with `git checkout --`).
- `git status --short` → empty; `git log -1` → `d85c0a5`.

## Evidence
- Sweep naming a route: `PUT api/hoeken/{hoekId:guid} answered 400 to a gebruiker who holds no right at all; every write route must answer 403 here.`
- Blind-spot run with the guard removed: `Passed! - Failed: 0, Passed: 28`.
- Null probe (subthema create, no-rights caller): `400 {"title":"One or more validation errors occurred.","errors":{"Leeftijd":["The Leeftijd field is required."]}}`.
- Empty-string probe: `400 {"title":"Ongeldige aanvraag","detail":"'' is geen geldige leeftijd. Kies er een uit: JK, K2, K3, L1, L2, L3, L4, L5, L6."}`.

## Defects
- **D1 [MAJOR] The sweep does not detect a lost guard on a wizard item delete.** Route `DELETE api/thema-opbouw/wizardruns/{runId}/activiteiten/{activiteitId}`; seeded state: an open run and an ordinary activiteit that run did not create. Removing the `[Authorize(Policy = Rechtenmatrix.Beleid.Wizardinhoud)]` above `VerwijderActiviteit` leaves all 28 tests green, because the 403 then comes from the service's `WizardrunWeigering` ("Dit is niet in deze wizard aangemaakt."). With that guard gone, any signed-in gebruiker could delete an item an open run created, unnoticed. `DELETE …/wizardruns/{runId}/subthemas/{subthemaId}` has the same shape (by reading). Fix: seed items through the seeded run and use those ids for the wizard routes, or let the sweep tell an authorisation 403 from a `WizardrunWeigering` 403.
- **D2 [MINOR] A `null` leeftijd gets ASP.NET Core's English 400.** Routes: `POST api/themas/{themaId}/subthemas`, `PUT api/subthemas/{subthemaId}`, `POST …/wizardruns/{runId}/subthemas`, `PUT …/wizardruns/{runId}/subthemas/{subthemaId}`; body with `"leeftijd": null` or omitted. Holds for HL, TB, and on create for a no-rights caller (400 instead of 403, no rights check asked). No rights hole (the write is never reached), but `UitInvoer`'s null branch is dead there and untested. Cause: `SubthemaCreatie.Leeftijd` and `SubthemaWijzigingInvoer.Leeftijd` are non-nullable `string` under `<Nullable>enable</Nullable>`, so an implicit `[Required]` fires before the action. Fix: make them `string?` and add a null test (or have the owner accept the automatic 400 and correct the worklog).

## Notes
- The 14-day window is pinned at the exact edge only by the domain unit test; the HTTP tests edit the timestamp on the real clock.
- The worklog's manual Development sign-in steps were not run; the Postgres HTTP tests cover the same flows.


# E6-02 slice 3 — Test report (round 2)

**Verdict:** PASS
**Mode:** unit/integration (backend only; no Playwright until slice 4)
**Change verified:** `afe46bc` on `story/E6-02-afdwingen`, on top of `d85c0a5`. No new migration.

*Recorded by the orchestrator from the test-runner's final message (no Write tool in its session). Condensed in layout only.*

## Criteria checked
- **Gates → PASS.** `dotnet build` 0/0; UnitTests 1364 passed, 4 skipped (live KOV opt-in); IntegrationTests 418 passed, 1 skipped (live Op.stap opt-in), 1 failed under load: `AanmeldEndpointsTests.Entra_een_token_zonder_acct_krijgt_geen_sessie_maar_de_weigeringspagina` (1 ms), which passed 11/11 when its class ran alone. It tests the Entra refusal page, not the 403 writer this round changed: classed as flaky, not a product defect. `dotnet format --verify-no-changes` exit 0; `has-pending-model-changes` clean.
- **D1 → PASS.** `Wizardinhoud` removed from one route at a time, rebuilt, sweep + `WizardrunEndpointsTests` + `RechtenAfdwingingTests` run, restored with `git checkout --`:
  - `DELETE …/wizardruns/{runId}/subthemas/{subthemaId}` → sweep FAIL, names the route, "answered 204";
  - `DELETE …/subthemas/{subthemaId}/subdoelen/{subdoelId}` → FAIL, names the route, "answered 204";
  - `DELETE …/wizardruns/{runId}/activiteiten/{activiteitId}` (the round-1 blind spot) → FAIL, names the route, "answered 204";
  - control, `[RechtOp]` off `PUT api/hoeken/{hoekId}` → FAIL, "answered 400" (and a per-row test failed too).
  The sweep asserts the detail "Je hebt geen toegang tot deze actie." and sends the wizard item routes the seeded run's own items. On the three wizard probes the other 35 tests stayed green: the sweep is the only net for those guards, and it holds.
- **D2 → PASS** (committed tests, null and omitted): ordinary create — HL 400 `GeenLeeftijd`, no-rights 400 `GeenLeeftijd` (by design, pinned); ordinary PUT — HL 400, no-rights 403; wizard create — TB 400, HL 403; wizard PUT — TB 400, HL 403. `GeenLeeftijd` = "Een subthema heeft een leeftijd nodig. Kies er een uit: JK, K2, K3, L1, L2, L3, L4, L5, L6."
- **I26 → PASS.** `[RechtOp(ThemaVerwijderen, Rechtbron.Thema)]`, column `ThemabeheerZonderAndermansInhoud`: HL content → TB 403 (full detail), directie 204; empty → TB 204; only the open run's items → TB 204; after `afronden` → TB 403, directie 204; missing thema → 404 first; unit test over all eight relations, fails closed without a `Themabron`. The planned/scheduled refusal holds by reading (service check after the rights check, unchanged; tested for directie only).
- **I27 → PASS.** Re-scope of a run subthema holding a leerkracht's activiteit → 403 "…dus de wizard verandert de leeftijd niet." (leeftijd stays K3), same-leeftijd edit 200, re-scope with only the run's items allowed. Linked activiteit delete → TB 403, TB+HL 204. Subthema whose activiteiten carry links → TB 403, TB+HL 204. A run activiteit moved away by directie → 403 on wizard PUT and DELETE.
- **Wizard sentences → PASS** (each asserted in full with an em-dash check; "Deze wizard is niet gevonden." on POST, afronden and GET).
- **Round-1 criteria still hold → PASS** (`RechtenAfdwingingTests` now 21; I9 reads; R35; the 14-day edge; I22–I25 and I18 with exact sentences).

## Commands run
- `dotnet build` (also after the probes) → 0/0. `dotnet test --no-build` (Postgres 127.0.0.1:5433) → the numbers above. `--filter AanmeldEndpointsTests` → 11/11. `dotnet format --verify-no-changes` → 0. `has-pending-model-changes --no-build` → clean.
- Four guard-removal probes, each restored. Final `git status --short` and `git diff` empty; HEAD `afe46bc`.

## Defects
None.

## Notes (non-blocking)
- The password in `docs/dev-setup-secrets.md` does not match the `jaarplanner-db` container (first run: 293 failures with `28P01`); the container's own `POSTGRES_PASSWORD` was used.
- One flaky test (above).
- TB on a planned thema delete is not pinned by a test.
- The subthema-with-links refused delete does not assert the subthema still exists.


# E6-02 slice 3 — Test report (round 3)

**Verdict:** PASS
**Mode:** unit/integration (backend only; no Playwright until slice 4)
**Change verified:** `e83a875` on `story/E6-02-afdwingen`, on top of `afe46bc`. No new migration.

*Recorded by the orchestrator from the test-runner's final message (no Write tool in its session). Condensed in layout only.*

## Criteria checked
- **1. Gates → PASS.** `dotnet build` 0/0. Full `dotnet test --no-build` (Postgres 127.0.0.1:5433, container password): UnitTests 1364 passed, 4 skipped, 0 failed; IntegrationTests 423 passed, 1 skipped, 0 failed (round 2's 419 + 4 new; round 2's flaky `AanmeldEndpointsTests` did not recur). `dotnet format --verify-no-changes` 0. `has-pending-model-changes --no-build` clean.
- **2a. Q4 thema delete (`Een_doel_op_een_activiteit_van_de_open_wizard_beschermt_het_thema_tegen_themabeheer_Q4`) → PASS.** A thema holding only its open run's own subthema and activiteit, with a K3 HL's goal link on that activiteit: TB 403 ("Je hebt geen toegang tot deze actie."), directie 204; on an identical thema TB+HL(K3) 204. Unit (`Themabeheer_verwijdert_een_thema_alleen_zonder_andermans_inhoud`): TB false; TB+HL(K3) true; TB+HL(L1) false; HL alone false; directie true; two linked leeftijden with the right at one false; `bron: null` false.
- **2b. Q4 re-scope (`Een_gekoppelde_wizardactiviteit_verhuist_alleen_mee_voor_wie_op_beide_leeftijden_mag_koppelen_Q4`) → PASS for the listed cases.** TB K3→K2 403 (`GekoppeldVerhuist` in full); TB+HL(K3) K3→K2 403; same-leeftijd edit 200; database still K3; TB+HL(K3,K2) 200 and the database then holds K2.
- **2c. Planned thema (`Een_gepland_thema_verwijdert_ook_themabeheer_niet_I26`) → PASS.** TB gets the service's 400 ("staat nog 1 keer in een jaarplan") after the rights filter lets it through.
- **2d. Rows remain after the refused delete → PASS.** Both the subthema and the activiteit found in a fresh context after the 403 `SubthemaMetDoelen`; the TB+HL delete then gets 204.
- **2e. I28 (`Een_gewone_thema_of_themadoelwijziging_verschuift_het_venster_van_de_wizard_niet_I28`) → PASS.** An ordinary thema PUT and a themadoel POST leave the stored `LaatsteSchrijfactieOp` exactly equal (read from the database).
- **3. Sweep with the guard removed → PASS.** `Wizardinhoud` removed from `DELETE …/wizardruns/{runId}/activiteiten/{activiteitId}`: the sweep failed and named the route ("answered 204 … every write route must answer 403 …"; 1 failed, 39 passed). Restored with `git checkout --`.
- **4. Round-1 and round-2 criteria still hold → PASS.** Full suite green; `RechtenAfdwingingTests` 23, `WizardrunEndpointsTests` 16, `ElkeWijzigendeRouteVraagtEenRechtTests` 1, `ElkeRouteVraagtEenSessieTests` 4, `CurriculumbeheerAutorisatieTests` 5, `RechtenEndpointsTests` 16, `RechtenbeleidTests` 9, `SchoolcontentImportEndpointsTests` 9; unit Toegang/Schoolcontent/GebruikerTests 230. The changed `ActiviteitMetDoelen` sentence is identical in service and test, and covered by the em-dash check with `GekoppeldVerhuist`.

## Extra mutation probes (each restored)
- Thema-delete Q4 clause replaced by `&& true` → the unit ThemaVerwijderen test and the Q4 thema-delete test fail ("Expected 403 … got 204").
- New-leeftijd half of the re-scope check dropped → the Q4 re-scope test fails ("Expected 403 `GekoppeldVerhuist` … got 200").
- Old-leeftijd half (the check reads `nieuw` twice) → `WizardrunEndpointsTests` and `RechtenAfdwingingTests` pass 39/39: **unpinned** (see Notes).

## Commands run
- `dotnet build` 0/0 at HEAD and after every probe and restore; `dotnet test --no-build` as above; format 0; `has-pending-model-changes` clean; four probes, each restored and rebuilt. Final `git status --short`: only the antagonist's round-3 worklog append (another writer), no backend change; HEAD `e83a875`.

## Defects
None.

## Notes (non-blocking)
- The old-leeftijd half of the Q4 re-scope check has no test (confirms the antagonist's round-3 MINOR 1): every refused case lacks the right at K2. Add TB+HL(K2 only) K3→K2 → 403 `GekoppeldVerhuist`, K3 kept.
- The planned-thema test matches its 400 sentence by substring only.
- The password in `docs/dev-setup-secrets.md` does not match the `jaarplanner-db` container.


# E6-02 slice 3 — Test report (round 4)

**Verdict:** PASS
**Mode:** unit/integration (backend only; no Playwright until slice 4)
**Change verified:** `08c10a2` on `story/E6-02-afdwingen`, on top of `e83a875` (PASS in round 3). No new migration.

*Recorded by the orchestrator from the test-runner's final message (no Write tool in its session). Condensed in layout only.*

## Criteria checked
- **1. Gates → PASS.** `dotnet build` 0/0. Full `dotnet test --no-build` (Postgres 127.0.0.1:5433, container password): UnitTests 1364 passed, 4 skipped, 0 failed; IntegrationTests 423 passed, 1 skipped, 0 failed (the new case is a line inside an existing test). `dotnet format --verify-no-changes` 0. `has-pending-model-changes --no-build` clean.
- **2. Mutation proof, repeated by the test-runner → PASS.** In `WizardrunService.cs` line 158, `MagDoelenKoppelenAsync(gebruikerId, huidig.Leeftijd, …)` → `MagDoelenKoppelenAsync(gebruikerId, nieuw, …)`, rebuilt 0/0; `WizardrunEndpointsTests` + `RechtenAfdwingingTests`: 1 failed, 38 passed. The only failure: `Een_gekoppelde_wizardactiviteit_verhuist_alleen_mee_voor_wie_op_beide_leeftijden_mag_koppelen_Q4` at line 259 (the new TB+HL(K2 only) K3→K2 case): `Expected 403 "Aan activiteiten onder dit subthema zijn doelen gekoppeld. Die mag je niet naar een andere leeftijd meenemen, dus de wizard verandert de leeftijd niet.", got 200 "".` Restored with `git checkout --`; `git status --short` empty; HEAD `08c10a2`; rebuilt 0/0 and the Q4 test green again. Round 3 found this half unpinned (39/39 under the same mutation); it is now pinned.
- **3. Round-3 criteria still hold → PASS** (re-run after the restore, 7/7 named tests): Q4 thema delete (`RechtenAfdwingingTests…_Q4` and the unit `RechtenmatrixTests.Themabeheer_verwijdert_een_thema_alleen_zonder_andermans_inhoud`); Q4 re-scope (TB, TB+HL(K3), TB+HL(K2) each 403 `GekoppeldVerhuist`; same-leeftijd 200; K3 kept, asserted after the new refusal; TB+HL(K3,K2) 200 and then K2); the planned thema's whole 400 sentence pinned through `RechtenTestOpzet.VerwachtAsync` (exact status and detail, no em dash); a refused delete keeps the rows (`…_I27`); I28; the sweep. Round-1 and round-2 criteria: full suite green.
- **`Themabron.GekoppeldeLeeftijden` required → PASS.** No default; `StaatToe` lost its `?? []`; the build compiles, so every producer passes it (the only production producer, `EfRechtenbronnen.cs:98`, passes a materialised list); the four unit-test calls pass it explicitly.

## Commands run
- `dotnet build` 0/0 at HEAD, after the mutation and after the restore; full `dotnet test --no-build` as above; format 0; mutation then filtered test run (1 failed, 38 passed); restore and `git status --short` empty; named round-3 tests 7/7; `has-pending-model-changes` clean.

## Evidence
- Mutated failure at `WizardrunEndpointsTests.cs:259`, "Expected 403 … got 200". Full suite output saved in the orchestrator's scratchpad (`full-test.txt`).

## Defects
None.

## Notes (non-blocking)
- Environment issue, retried once: during the first mutated run Docker Desktop restarted `jaarplanner-db` (engine API 500, "the database system is starting up"); every test failed at 1 ms on an Npgsql connect timeout in `PostgresTestDatabase.MaakAsync`. Once healthy, the retry gave the result above.
- The password in `docs/dev-setup-secrets.md` still does not match the `jaarplanner-db` container.
