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
# E6-04 slice 2 — Test report (round 1)

**Verdict:** PASS
**Mode:** both (unit/integration, and a browser pass in headless Chrome over the DevTools protocol, driven from Bash with real mouse and keyboard input; no Playwright MCP in the test-runner's session)
**Commit:** `224815f` on `story/E6-04-beheer`

*Recorded by the orchestrator from the test-runner's final message (no Write tool in its session). Condensed in layout only.*

## Criteria checked
- **Invite by UPN, normalised; a case/whitespace duplicate refused in Dutch → PASS.** `"  Eva.Janssens@School.be "` stored as `eva.janssens@school.be`; `" EVA.JANSSENS@school.be  "` showed "De uitnodiging is niet bewaard. / Er is al een gebruiker met de aanmeldnaam eva.janssens@school.be." API: 409 on a duplicate, 400 "Vul één Microsoft-aanmeldnaam in, zoals an.peeters@school.be." on `"an peeters"`; both pinned by value.
- **Grant/revoke themabeheer and the directie right → PASS** (row reads "Directie · Themabeheer · …"; unticking removes both; DB `IsDirectie=f`, `HeeftThemabeheer=f`).
- **Link/unlink leerkrachten to klassen, many-to-many → PASS** (one toewijzing left after unticking; Klassen shows "Leerkrachten: An Peeters, Bert Claes, Eva Janssens"; Bert holds two klassen).
- **Appoint/withdraw hoofdleerkrachten per (schooljaar, jaarfase), several, no klas needed → PASS** ("K2 / Eva Janssens" without a K2 klas; three on K3; unknown `K7` → 400 with the leeftijd sentence).
- **Remove a gebruiker; activiteiten stay with no maker (I17); links and appointments go → PASS** (DB: 0 rows for his id; "Regenmeter bouwen" `MakerId` NULL; L2 rood reads "Nog geen leerkracht").
- **The last directie cannot be removed or demoted; 409 in Dutch; count under a row lock → PASS.** UI refusals: "directie@jaarplanner.local is de enige met het directierecht. Geef het directierecht eerst aan iemand anders." and "… kan niet verwijderd worden. …". `TelAndereDirectieledenOnderSlotAsync` runs `SELECT … WHERE "IsDirectie" ORDER BY "Id" FOR UPDATE` in the writing transaction. **Mutation check:** with ` FOR UPDATE` removed in a disposable copy, `Twee_directieleden_die_elkaar_tegelijk_afzetten_laten_er_een_over` fails (Expected Conflict, Actual OK).
- **Every new endpoint directie-only: 403 for TB, HL, LK, combined, none; 401 without a session → PASS** (5 × 12 theory plus 401 over 12; own check with real dev-sign-in cookies: 403 for An, Bert, Carla; 401 anonymous).
- **"Nog niet aangemeld" as text → PASS** (on every unbound row, absent on the bound one; the sheet adds "Wie zich als eerste met deze aanmeldnaam aanmeldt, krijgt deze rechten.").
- **R20 "no longer counts" → PASS** (the ended-year notice once in the list and once in the sheet; `voorbijeSchooljaarIds` exactly the ended year; per-item flags correct).
- **I12 note in the same callout → PASS** (one `bg-attentie-zacht` element: "Leeftijd nog niet ingesteld / Zo geeft deze klas haar leerkrachten geen rechten op de gedeelde activiteiten.").
- **Non-directie: no Gebruikers link, direct visit redirects, Klassen without buttons → PASS** (Bert and An at 1440 and 390: no link, `/instellingen/gebruikers` and `/instellingen` land on `/instellingen/klassen`, no add/edit/delete/leeftijd buttons, no leerkracht names, 0 `/api/gebruikers` requests). Known and accepted: the klas routes are enforced only in slice 3.
- **Copy in nl.json, Dutch, no em dashes; 390 without overflow; accent only for sanctioned uses → PASS** (43 new keys; `scrollWidth` 390 on every screen and sheet; accent only on the primary actions, the active destination and the focus outline; checkboxes ink).

## Commands run
- `dotnet build` → 0 warnings, 0 errors. `dotnet test --no-build` (Postgres 127.0.0.1:5433) → UnitTests 1340 passed, 4 skipped; IntegrationTests 410 passed, 1 skipped. `--filter GebruikerbeheerEndpointsTests` → 27/27. `dotnet format --verify-no-changes` → exit 0.
- Mutation copy (outside the worktree) without ` FOR UPDATE`, race test only → failed as expected.
- `pnpm lint` → exit 0; `pnpm test` → 253/253; `pnpm build` → exit 0 (existing >500 kB chunk warning).
- Browser: API in Development, `--no-launch-profile`, on :5395 against throwaway DB `jp_tr_e604_r1`; Vite on :5185. Teardown: both stopped, `DROP DATABASE jp_tr_e604_r1 WITH (FORCE)`, mutation copy deleted, worktree clean at `224815f`.

## Evidence
- Screenshots `01`–`17` and the log `verslag.txt` in the orchestrator's scratchpad under `tr\shots\`.
- Contrast (Chrome, alpha composited), all ≥ 4.5:1: row meta 6.51/7.58; "Nog niet aangemeld" 17.78/13.12; ended-year notice on `vlak-diep` 5.51/8.97; "Gebruiker uitnodigen" 6.10/7.06; refusal alerts and I12 callout 9.39/8.00 (light/dark).
- No console errors; the only HTTP failures were the four deliberate 409s.

## Defects
None.

## Notes (not blocking)
- [LOW] The directie's phone Instellingen switch now has five items; "Weergave" sits past the right edge (it scrolls, the page does not overflow).
- [LOW] The race test covers demotion only; removal shares the locked-count helper without its own concurrent test.
- [INFO] A list row names a klas without jaarfase without saying it gives no rights; the sheet and the Klassen callout carry the I12 sentence.
- [INFO] The bootstrap directie shows "Nog niet aangemeld" in Development, because the dev sign-in binds no Entra identity.


# E6-04 slice 2 — Test report (round 2)

**Verdict:** FAIL (one MINOR defect, the phone switch fade; everything else passes)
**Mode:** both (unit/integration plus a mutation run; browser pass in headless Chrome 152 over the DevTools protocol, driven from Node with real mouse and keyboard input; no Playwright MCP in the test-runner's session)
**Commit:** `3e4ee04` on `story/E6-04-beheer`

*Recorded by the orchestrator from the test-runner's final message (no Write tool in its session). Condensed in layout only.*

## Criteria checked
- **Gates → PASS.** `dotnet build` 0/0; UnitTests 1340 passed, 4 skipped; IntegrationTests 419 passed, 1 skipped (410 + 9 new); `GebruikerbeheerEndpointsTests` 36/36; `dotnet format --verify-no-changes` exit 0; `pnpm lint` 0; `pnpm test` 258/258; `pnpm build` 0 (existing >500 kB chunk warning).
- **The new backend tests pin what they claim → PASS** (mutation run in a copy outside the worktree, four mutations, exactly the six predicted tests failed, 30 passed): flag always true → `Alleen_de_ontwikkelaanmelding_laat_een_directie_die_niet_gekoppeld_is_meetellen`; unbound directie counted → `Een_directie_die_zich_nog_niet_aanmeldde_telt_niet_mee_voor_de_laatste_directie` and `Zodra_een_tweede_directie_zich_aanmeldde_mag_het_directierecht_weg`; FK catch off → `Koppelen_aan_een_klas_die_intussen_verwijderd_wordt_is_404_en_geen_500` (deterministic, blocks ≥ 1 s on an uncommitted delete); `FOR UPDATE` removed → both race tests.
- **Frontend tests → PASS on reading** (focus test asserts `aria-disabled`, `not.toBeDisabled()`, focus kept, box ticked, no second write; self-demotion tests: cancel sends nothing, confirm sends one DELETE and refetches `ik` only, no `laadMislukt`, others' rights get no dialog, self-removal text).
- **(a) Keyboard only, focus stays on the box → PASS at 1440 and 390.** Tab to Rechten, Enter, Tab to the box, Space with 1500 ms latency: 142 samples at 10 ms, focus never left, never `disabled`, stayed in the DOM; a second Space during the save ignored (one PUT); a third after the save unticked it with focus kept.
- **(b) Only directie unticks their own Directie → PASS at both widths.** "Je eigen directierecht afgeven?" with its consequence and "Directierecht afgeven"; cancel sends nothing. At 1440, confirming as the only directie shows the 409 in the sheet (8.00:1) and the box falls back to ticked.
- **(b) With a second directie, confirm lands on `/instellingen/klassen` with no error flash → PASS at both widths** (route polled every 10 ms: gebruikers then klassen, nothing between; DELETE 200, GET `/api/ik` 200, no `/api/gebruikers` refetch; the Gebruikers link gone from column and switch).
- **(c) Removing yourself says you will be signed out → PASS** (`verwijderZelfGevolg`, 13.12:1 dark, 17.78:1 light; someone else's removal shows `verwijderGevolg` with their name).
- **(e) The reworded sentence renders → PASS** (under K3/L1/L2 "Geen hoofdleerkracht", 7.58:1 dark, 6.51:1 light; no overflow at 390).
- **(d) Phone switch at 390 → FAIL** (defect 1). Gebruikers: only the right edge fades, active part fully in view. Weergave: only the left edge fades (scroll 93 of 97), active part in view. Scrolling by hand flips the fades; four parts (non-directie): no fade. Text under a fade on those routes belongs only to parts partly outside the row. **Algemene fiches, opened fresh:** the active part is in view but the right fade covers the end of its label.
- **Bound-directie refusal in the browser → not reproducible, by design** (the dev sign-in counts every directie); proven by the integration tests and the mutation run.

## Commands run
- As above; browser setup: throwaway DB `jp_tr_e604_r2`, API in Development `--no-launch-profile` on :5395, Vite on :5185, Chrome 152 headless; seeded schooljaar 2026-2027, K3 blauw / L1 blauw / L2 rood, An on K3 blauw, Bert, later Eva as directie.
- Teardown: all processes stopped, ports free; `DROP DATABASE jp_tr_e604_r2 WITH (FORCE)` (0 rows left); mutation copy deleted; `git status` clean at `3e4ee04`.

## Evidence
- Screenshots and raw measurements in the orchestrator's scratchpad under `tr\shots\` and `tr\` (`1440-a-tijdens.png`, `390-a-tijdens.png`, `1440-b-*.png`, `1440-c-zelf.png`, `390-b-na-afgeven.png`, `390-d-*.png`, `zoom-{light,dark}-*.png`; `verslag-1440.json`, `verslag-390.json`, `verslag-licht.json`).
- Console: no errors apart from the deliberate 409; HTTP ≥ 400: only that 409.

## Defects
- **[MINOR] The phone switch fade dims the active, fully visible "Algemene fiches" label.** At 390, as directie (five parts), open `/instellingen/algemene-fiches` fresh: the row sits at scroll 8 of 97; the active part spans [249,373], inside the visible [17,373]; the right fade (Weergave hidden) covers [341,373], the last 19.3 px of the label; contrast falls below 4.5:1 for the final ~5 px, down to 2.79:1 (dark) / 2.88:1 (light). Cause: `scrollIntoView({ inline: "nearest" })` lands the part flush at the edge; the 6 px slack allows for padding, not the 32 px fade. Klassen, Gebruikers, Weergave measured clean; Hoeken clean by geometry at scroll 0; 360/375 not tested. Possible fix: `scroll-padding-inline` equal to the fade width (`scroll-px-8`), then re-measure all five landing routes.

## Notes (not blocking)
- `Zodra_een_tweede_directie_zich_aanmeldde_mag_de_eerste_verwijderd_worden` does not first assert a 409 before the bind (covered elsewhere).
- Headless Chrome on Windows draws a classic scrollbar under the phone switch (pre-existing; phones use overlay scrollbars).


# E6-04 slice 2 — Test report (round 3)

**Verdict:** FAIL (one MINOR defect, new in `c5ab799`; the round-2 fade defect is fixed and everything else passes)
**Mode:** both (unit/integration plus a mutation run; browser pass in headless Chrome 152 over the DevTools protocol from Node, with real keyboard, wheel and mouse input; font files intercepted and held back to simulate a cold, slow cache; no Playwright MCP in the test-runner's session)
**Commit:** `02394a3` on `story/E6-04-beheer`

*Recorded by the orchestrator from the test-runner's final message (no Write tool in its session). Condensed in layout only.*

## Criteria checked
- **Gates → PASS.** `dotnet build` 0/0; UnitTests 1340 passed, 4 skipped; IntegrationTests 424 passed, 1 skipped; `dotnet format --verify-no-changes` 0; `pnpm lint` 0; `pnpm test` 258/258; `pnpm build` 0.
- **The new race tests are deterministic and pin the 404 and the Dutch sentence → PASS, with a scope note.** Five unmutated runs in a copy outside the worktree: runs 2–5 clean (each write pending > 1 s on the row or FK lock, then 404); run 1 failed all 7 in 1 ms at the moment of the test-runner's own teardown (fixture setup) and did not recur. Mutation `catch (DbUpdateConcurrencyException) when (DateTime.UtcNow.Year < 2000)` → exactly the four `BewaarWijzigingAsync` tests fail (NotFound expected, InternalServerError actual). Scope: three toggles and the removal; the fourth toggle (DELETE directierecht) answers 404 "Gebruiker {guid} is niet gevonden." via the `FOR UPDATE` path, never a 500, but a different sentence.
- **No fade overlaps the active part; five parts × 390/360 × light/dark → PASS.** 20 cold-cache landings: box and text overlap 0, the active part fully inside the row (Algemene fiches [212.8,337.3] vs fade [341,373] at 390; [182.8,307.3] vs [311,343] at 360), matching the implementer's table.
- **Contrast of the active label → PASS** (17.78:1 light, 13.12:1 dark, in all 20).
- **Re-placement after the fonts load (cold cache) → PASS.** Fonts held back 1500 ms: scroll 38/91 before, 44/97 after, overlap 0 both times; without the second placement Algemene fiches would run 2.3 px into the fade.
- **Nothing steals focus or scrolls the page when the fonts arrive → PASS** (`document.activeElement` unchanged in all 8 keyboard cases; page `scrollY` 600→601 on Gebruikers, a 1 px reflow; 249→249 and 301→301 on Klassen).
- **Tab into the switch; focus stays where you put it → FAIL** (defect 1: focus keeps the same element, but the row scrolls it out of view).
- **The reworded (c) sentence renders → PASS** (under K3/L1/L2 "Geen hoofdleerkracht" at 390 and 360; 6.51:1 light, 7.58:1 dark; from `t("gebruikers.zonderHoofdleerkracht")`).

## Commands run
- Gates as above; mutation copy (5 unmutated runs, 1 mutated run, a scratch test for the fourth toggle; copy deleted).
- Browser: throwaway DB `jp_tr_e604_r3`; API Development `--no-launch-profile` on :5395; Vite on :5185; 14 gebruikers seeded; signed in as `directie@jaarplanner.local`; cache disabled and cleared before every load; 118 font requests intercepted.
- Teardown: API, Vite and Chrome stopped (5395, 5185, 9333 free); `DROP DATABASE jp_tr_e604_r3 WITH (FORCE)` (0 rows left); profile deleted; `git status` clean at `02394a3`.

## Evidence
- In the orchestrator's scratchpad under `tr\`: `verslag-r3.json` (phases A–E), `verslag-r3c.json` (targeted keyboard repro), `shots3\A-*.png`, `shots3\B-*-algemene-fiches.png`, `shots3\C-*.png`, `shots3\E-*.png`, `shots3\R-390-klassen-3000-voor.png` / `-na.png` (the defect). Console: no errors; HTTP ≥ 400: none.

## Defects
- **[MINOR] After the web font arrives late, the phone switch scrolls a keyboard-focused link entirely out of view** (WCAG 2.2 AA 2.4.7, 2.4.11). Cause: the `document.fonts.ready.then(() => zetInBeeld())` callback from `c5ab799` always calls `scrollIntoView` on the active part, even when focus is on another link in the row. Repro: directie, 390, fonts held back 3 s, land on `/instellingen/klassen`, Tab 4× at human pace so "Weergave" is focused and fully visible (85/85 px); when the font arrives the row scrolls back to 0/97 and Weergave sits at [381,466] against the visible [17,373], still focused, no focus ring visible. Same when landing on Weergave with focus on "Klassen" ([-76,-3.1] at 390, [-106,-33.1] at 360). Control: with fonts undelayed, Weergave stays visible. Possible fix: in the callback, if focus is inside the row and not on the active link, only re-measure, or bring the focused link into view; a Vitest with a mocked `document.fonts.ready`; then re-run the keyboard repro and the 20 landings.

## Notes (not blocking)
- [LOW] The fourth toggle (DELETE `…/directierecht`) raced with a removal has no test and answers "Gebruiker {guid} is niet gevonden." (a GUID in Dutch copy a directie can see), not "Deze gebruiker is intussen verwijderd.".
- [INFO] The race tests use a fixed 1 s pending window rather than waiting on `pg_locks` (could cause a false failure under heavy load, never a false pass).
- [INFO] Headless Chrome on Windows draws a classic scrollbar under the switch (existing).


# E6-04 slice 2 — Test report (round 4)

**Verdict:** PASS (the round-3 defect is fixed; all gates green; both browser checks pass; two LOW notes)
**Mode:** both (unit/integration plus a backend mutation run; browser pass in headless Chrome over the DevTools protocol from Node, with real key and mouse input and font files held back; no Playwright MCP in the test-runner's session)
**Commit:** `ef4d23c` on `story/E6-04-beheer`

*Recorded by the orchestrator from the test-runner's final message (no Write tool in its session). Condensed in layout only.*

## Criteria checked
- **Gates → PASS.** `dotnet build` 0/0; UnitTests 1340 passed, 4 skipped; IntegrationTests 426 passed, 1 skipped (+2 race cases); `dotnet format --verify-no-changes` 0; `pnpm lint` 0; `pnpm test` 261/261 (+3); `pnpm build` 0 (usual chunk warning).
- **The new race tests are deterministic and pin the sentence → PASS.** `Een_directie_afzetten_of_verwijderen_die_intussen_verwijderd_wordt_is_404_en_geen_500` covers `/directierecht` and removal, asserting 404 and exactly "Deze gebruiker is intussen verwijderd."; the request waits on `LeesAndereDirectieOnderSlotAsync`'s `FOR UPDATE` (the target's row included) and then reaches `VindNaSlotAsync`. Mutation (copy outside the worktree): `VindNaSlotAsync` throwing `NietGevonden()` → exactly the two new cases fail (Expected "…intussen verwijderd.", Actual "Deze gebruiker bestaat niet (meer)."). Unmutated, the 8 race tests passed 8/8 three runs in a row. The lifecycle test also pins "Deze gebruiker bestaat niet (meer)." on a GET and a PUT after removal.
- **Late font while a keyboard user is in the row; focus stays fully in view → PASS.** Directie, 390 and 360, cold cache, woff held back (measured before the font arrived): land on Klassen, Tab 4× to Weergave, font held 3 s → Weergave keeps focus and `:focus-visible`, 0 px outside the row, 0 px under a fade ([284.3,369] vs visible [17,373] at 390; [254.3,339] vs [17,343] at 360; round 3 pushed it to [381,466]). Land on Weergave, Shift+Tab 4× (3 s) and forward Tab 12× (8 s) to Klassen → focus stays, box [21,93.9], 0 px outside, 0 px under a fade at both widths (round 3: [-76,-3.1]). The next Tab behaves normally; controls with the font undelayed give the same positions.
- **Active part clear of the fades on a fresh landing → PASS** (five parts × 390/360, font undelayed and held 1500 ms: 20 landings, 0 px overlap, active part fully inside the row).
- **Two-tab 404: sheet closes, list refreshes, alert names the person → PASS.** Seven cases (PUT klassen, DELETE klassen, themabeheer, PUT directierecht, at 1280, low in the list, and a real second browser tab removing through its own sheet): the write answered 404 "Deze gebruiker bestaat niet (meer).", the app refetched `/gebruikers`, `/klassen`, `/schooljaren`, the sheet closed, the row was gone, and one `role="alert"` above the list read "{naam} is intussen verwijderd en staat niet meer in de lijst." (equal to `gebruikers.verdwenen`; 8:1 in dark). Returning to tab A does not refetch by itself (`refetchOnWindowFocus: false`).
- **No raw id anywhere → PASS** (all 8 cases: id absent from page text and `outerHTML`, no GUID pattern; the eighth, the sheet's own Verwijderen after a removal elsewhere, shows "Deze gebruiker bestaat niet (meer)." under the list).

## Commands run
- Gates as above (Postgres connection with the container's own password). Mutation copy (1 mutated, 3 unmutated runs; deleted).
- Browser: throwaway DB `jp_tr_e604_r4`; API Development `--no-launch-profile` on :5395; Vite on :5185; Chrome headless on :9333; 1 schooljaar, 3 klassen, 14 gebruikers seeded; signed in as `directie@jaarplanner.local`.
- Teardown: all processes killed, ports free; `DROP DATABASE jp_tr_e604_r4 WITH (FORCE)`; profile and mutation copy removed; `git status --short` empty at `ef4d23c`.

## Evidence
- In the orchestrator's scratchpad under `tr\`: `verslag-r4a.json`, `verslag-r4c.json`, `verslag-r4b.json`; `shots4\R4-390-klassen-3000-na.png`, `shots4\R4c-390-weergave-3000-na.png`, `shots4\L4-*.png`, `shots4\B4-*-voor.png` / `-na.png`. Console: no JS errors (only the browser's own lines for the 8 expected 404s). HTTP ≥ 400: only those 8.

## Defects
None blocking.

## Notes (not blocking)
- [LOW] The alert can render off-screen: at 390, for a person low in a long list, the "intussen verwijderd" alert sits above the list out of view (Mieke case, scrollY 1149), so a sighted teacher sees the sheet close and the person vanish with no visible reason; `role="alert"` still announces it. The Greet case's message renders under the list (not measured in view). Possible fix: scroll the alert into view or focus it (`tabIndex={-1}`).
- [LOW] Focus falls to `<body>` after the sheet closes on its own (all 8 cases), because the trigger no longer exists; focusing the alert fixes both notes.
- [INFO] The frontend Vitest for the fonts callback was not mutation-run (by reading, the old callback would fail it).
- [INFO] The race tests use a fixed 1 s waiting window rather than `pg_locks` (could fail falsely under heavy load, never pass falsely).
